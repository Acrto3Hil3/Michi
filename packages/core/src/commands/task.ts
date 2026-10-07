import { existsSync, readFileSync, renameSync } from "node:fs";
import { join } from "node:path";
import { z } from "zod";
import { MichiError, errorPayload } from "../errors.js";
import type { Result } from "../result.js";
import { ok } from "../result.js";
import { STATE_FILE, brainDir, readYaml, writeYaml } from "../fs/brain.js";
import { hashOf } from "../fs/canonical.js";
import { StateSchema } from "../schemas/state.js";
import { RoadmapSchema, RunRecordSchema, TaskSchema, runId } from "../schemas/task.js";
import type { RunRecord, Task, TaskState } from "../schemas/task.js";
import { parseOrInvalid } from "../schemas/parse.js";
import { compileInstruction } from "../prompt/compile.js";
import { resolveContext } from "./context.js";
import { completedPath, loadRoadmap, loadTasks, roadmapPath, taskPath, withDerivedReadiness } from "./plan-tasks.js";
import { requireInitialized } from "./scan.js";
import { cmd } from "../identity.js";

/**
 * The task lifecycle, and the handoff to the agent.
 *
 * Phase 6 carries a task as far as `CHANGES_DETECTED`: planned, handed over
 * with a compiled instruction, and the agent's account recorded. Everything
 * past that — testing, review, verification — is Phase 7, because getting
 * there requires evidence rather than a report.
 */

const SESSIONS = "sessions";

export interface TaskOptions {
  root: string;
  now: () => string;
}

function all(root: string): Task[] {
  return withDerivedReadiness(loadTasks(root));
}

function taskOrFail(root: string, id: string): Task {
  const found = all(root).find((t) => t.task_id === id);
  if (found) return found;
  throw new MichiError({
    class: "UNKNOWN", code: "NOT_FOUND",
    message: `${id} is not a task on this project.`,
    detail: { known: all(root).map((t) => t.task_id) },
    next: `See what exists: ${cmd("task list")}`,
  });
}

function save(root: string, task: Task, now: string): Task {
  const next = TaskSchema.parse({ ...task, updated_at: now });
  writeYaml(taskPath(root, next.task_id), next);
  return next;
}

function syncCounts(root: string, now: string): void {
  const statePath = join(brainDir(root), STATE_FILE);
  const state = readYaml(statePath, StateSchema);
  const tasks = all(root);
  writeYaml(statePath, {
    ...state,
    active_task: tasks.find((t) => t.status === "RUNNING")?.task_id ?? null,
    counts: {
      ...state.counts,
      tasks_total: tasks.length,
      tasks_done: tasks.filter((t) => t.status === "DONE").length,
      tasks_blocked: tasks.filter((t) => t.status === "BLOCKED" || t.status === "NEEDS_HUMAN").length,
      tasks_verified: tasks.filter((t) => t.verification.status === "PASSED").length,
    },
    updated_at: now,
  });
}

// ---------------------------------------------------------------------------
// reading
// ---------------------------------------------------------------------------

export interface TaskListData {
  tasks: Task[];
  by_status: Record<string, number>;
}

export function taskList(options: TaskOptions & { status?: string }): Result<TaskListData> {
  try {
    requireInitialized(options.root);
    const tasks = all(options.root);
    const filtered = options.status
      ? tasks.filter((t) => t.status === options.status)
      : tasks;
    const by_status: Record<string, number> = {};
    for (const t of tasks) by_status[t.status] = (by_status[t.status] ?? 0) + 1;
    return ok({ tasks: filtered, by_status });
  } catch (e) {
    return errorPayload(MichiError.from(e));
  }
}

export interface TaskShowData {
  task: Task;
  runs: RunRecord[];
}

function runsOf(root: string, task: Task): RunRecord[] {
  return task.runs
    .map((id) => join(brainDir(root), SESSIONS, `${id}.yaml`))
    .filter((file) => existsSync(file))
    .map((file) => readYaml(file, RunRecordSchema));
}

export function taskShow(options: TaskOptions & { id: string }): Result<TaskShowData> {
  try {
    requireInitialized(options.root);
    const task = taskOrFail(options.root, options.id);
    return ok({ task, runs: runsOf(options.root, task) });
  } catch (e) {
    return errorPayload(MichiError.from(e));
  }
}

export interface TaskNextData {
  task: Task | null;
  reason: string;
}

/**
 * The next piece of work a skill should pick up.
 *
 * Respects the dependencies, and never returns a task whose context cannot be
 * resolved — a task that cannot be explained to an agent is not ready, whatever
 * its dependencies say.
 */
export function taskNext(options: TaskOptions): Result<TaskNextData> {
  try {
    const { root, now } = options;
    requireInitialized(root);
    const tasks = all(root);
    if (tasks.length === 0) {
      return ok({ task: null, reason: `No tasks have been planned — run: ${cmd("plan tasks --from-requirements")}` });
    }

    const ready = tasks.filter((t) => t.status === "READY");
    if (ready.length === 0) {
      const waiting = tasks.filter((t) => t.status === "PENDING").length;
      const blocked = tasks.filter((t) => t.status === "BLOCKED").length;
      return ok({
        task: null,
        reason: `Nothing is ready: ${waiting} waiting on other work, ${blocked} blocked, ` +
          `${tasks.filter((t) => t.status === "RUNNING").length} in progress.`,
      });
    }

    for (const task of ready) {
      const context = resolveContext({
        root, now,
        request: { focus: { type: "requirement", id: task.requirements[0] }, include: [], exclude: [] },
      });
      if (context.ok) return ok({ task, reason: "ready, and its context resolves" });
    }
    return ok({
      task: null,
      reason: "Tasks are ready but none of their context can be resolved. Something upstream is inconsistent.",
    });
  } catch (e) {
    return errorPayload(MichiError.from(e));
  }
}

// ---------------------------------------------------------------------------
// handing over
// ---------------------------------------------------------------------------

export interface TaskStartData {
  task: Task;
  run: RunRecord;
  /** The compiled instruction. A generated artifact, never a source of truth. */
  instruction: string;
}

export function taskStart(
  options: TaskOptions & { id: string; agent: string },
): Result<TaskStartData> {
  try {
    const { root, now, id, agent } = options;
    requireInitialized(root);
    const task = taskOrFail(root, id);

    if (task.status === "STALLED") {
      throw new MichiError({
        class: "BLOCKED", code: "CONFLICT",
        message: `${id} has stalled after ${task.attempt} attempts. Handing it over again will not help.`,
        next: "Split it, or work out with the user what is actually in the way.",
      });
    }
    if (task.status !== "READY" && task.status !== "FAILED" && task.status !== "CHANGES_DETECTED") {
      throw new MichiError({
        class: "INVALID", code: "CONFLICT",
        message: `${id} is ${task.status}, not ready to hand over.`,
        detail: { status: task.status, dependencies: task.dependencies },
        next: task.status === "PENDING"
          ? `It is waiting on ${task.dependencies.join(", ")}.`
          : `See where it stands: ${cmd(`task show ${id}`)}`,
      });
    }

    const resolved = resolveContext({
      root, now,
      request: { focus: { type: "requirement", id: task.requirements[0] }, include: [], exclude: [] },
    });
    if (!resolved.ok) {
      throw new MichiError({
        class: "BLOCKED", code: "BLOCKED",
        message: `${id}'s context could not be resolved, so there is nothing to hand over.`,
        detail: { reason: resolved.error.message },
        next: resolved.error.next ?? `Check the project state: ${cmd("status")}`,
      });
    }
    const packet = resolved.data;
    const instruction = compileInstruction({ task, packet });

    const timestamp = now();
    const roadmap = loadRoadmap(root, timestamp);
    const run = parseOrInvalid(RunRecordSchema, {
      schema_version: task.schema_version,
      run_id: runId(roadmap.next_run_id),
      task_id: task.task_id,
      agent,
      started_at: timestamp,
      ended_at: null,
      attempt: task.attempt + 1,
      input_hash: packet.input_hash,
      context_hash: packet.context_hash,
      instruction_hash: hashOf(instruction),
      result: null,
      files_touched: [],
      tests: null,
      verification_status: "PENDING",
      new_decisions_requested: [],
      notes: null,
    }, "that run record");

    writeYaml(join(brainDir(root), SESSIONS, `${run.run_id}.yaml`), run);
    writeYaml(roadmapPath(root), RoadmapSchema.parse({
      ...roadmap, next_run_id: roadmap.next_run_id + 1, updated_at: timestamp,
    }));

    const started = save(root, {
      ...task,
      status: "RUNNING",
      attempt: task.attempt + 1,
      context: {
        packet: packet.packet_id,
        context_hash: packet.context_hash,
        input_hash: packet.input_hash,
      },
      runs: [...task.runs, run.run_id],
    }, timestamp);
    syncCounts(root, timestamp);

    return ok({ task: started, run, instruction });
  } catch (e) {
    return errorPayload(MichiError.from(e));
  }
}

const ReportSchema = z
  .object({
    result: z.enum(["REPORTED", "ABORTED", "STOPPED_BY_CONDITION"]),
    files_touched: z.array(z.string().min(1)).default([]),
    tests: z
      .object({
        run: z.number().int().nonnegative(),
        passed: z.number().int().nonnegative(),
        failed: z.number().int().nonnegative(),
      })
      .optional(),
    new_decisions_requested: z.array(z.string().min(1)).default([]),
    notes: z.string().min(1).optional(),
  })
  .strict();

export interface TaskReportData {
  task: Task;
  run: RunRecord;
}

/**
 * Record what the agent said it did.
 *
 * This is a **claim**, not evidence. Nothing here moves the task towards
 * `VERIFIED`: the verification record is written by a separate act, from
 * observed results (P3). That is Phase 7.
 */
export function taskReport(
  options: TaskOptions & { id: string; file: string },
): Result<TaskReportData> {
  try {
    const { root, now, id, file } = options;
    requireInitialized(root);
    const task = taskOrFail(root, id);

    if (task.status !== "RUNNING") {
      throw new MichiError({
        class: "INVALID", code: "CONFLICT",
        message: `${id} is ${task.status}; there is no open handover to report against.`,
        next: `Hand it over first: ${cmd(`task start ${id} --agent <name>`)}`,
      });
    }
    if (!existsSync(file)) {
      throw new MichiError({
        class: "UNKNOWN", code: "NOT_FOUND",
        message: `${file} does not exist.`,
      });
    }

    let raw: unknown;
    try {
      raw = JSON.parse(readFileSync(file, "utf8"));
    } catch (e) {
      throw new MichiError({
        class: "INVALID", code: "VALIDATION_ERROR",
        message: "The report is not valid JSON.",
        detail: { file, reason: e instanceof Error ? e.message : String(e) },
      });
    }
    const report = parseOrInvalid(ReportSchema, raw, "that report");

    const timestamp = now();
    const openId = task.runs[task.runs.length - 1] as string;
    const runFile = join(brainDir(root), SESSIONS, `${openId}.yaml`);
    const open = readYaml(runFile, RunRecordSchema);

    // A run is immutable once closed; this one is still open.
    const closed = parseOrInvalid(RunRecordSchema, {
      ...open,
      ended_at: timestamp,
      result: report.result,
      files_touched: [...report.files_touched].sort(),
      tests: report.tests ?? null,
      new_decisions_requested: report.new_decisions_requested,
      notes: report.notes ?? null,
    }, "that run record");
    writeYaml(runFile, closed);

    // Three attempts and no progress is a signal to stop, not to loop.
    const nextStatus: TaskState =
      report.result === "REPORTED"
        ? "CHANGES_DETECTED"
        : task.attempt >= 3
          ? "STALLED"
          : "FAILED";

    const updated = save(root, {
      ...task,
      status: nextStatus,
      files_touched: [...new Set([...task.files_touched, ...report.files_touched])].sort(),
      ...(nextStatus === "STALLED"
        ? { blocked_reason: `No progress after ${task.attempt} attempts.` }
        : {}),
    }, timestamp);
    syncCounts(root, timestamp);

    return ok({ task: updated, run: closed });
  } catch (e) {
    return errorPayload(MichiError.from(e));
  }
}

export function taskBlock(
  options: TaskOptions & { id: string; reason: string },
): Result<{ task: Task }> {
  try {
    const { root, now, id, reason } = options;
    requireInitialized(root);
    const task = taskOrFail(root, id);
    const timestamp = now();
    const blocked = save(root, { ...task, status: "BLOCKED", blocked_reason: reason }, timestamp);
    syncCounts(root, timestamp);
    return ok({ task: blocked });
  } catch (e) {
    return errorPayload(MichiError.from(e));
  }
}

/**
 * `VERIFIED → DONE`: the task is closed and filed.
 *
 * Closing is a separate act from verifying, because they answer different
 * questions — whether the evidence holds, and whether this piece of work is
 * finished with. Only this moves a task out of `tasks/active`, and only a
 * verified task can go (STATE_MODEL, "DONE is reachable only from VERIFIED").
 */
export function taskDone(options: TaskOptions & { id: string }): Result<{ task: Task }> {
  try {
    const { root, now, id } = options;
    requireInitialized(root);
    const task = taskOrFail(root, id);

    if (task.status === "DONE") {
      return ok({ task });
    }
    if (task.status !== "VERIFIED") {
      throw new MichiError({
        class: "BLOCKED", code: "BLOCKED",
        message: `${id} is ${task.status}, and only a VERIFIED task can be closed.`,
        detail: { status: task.status, verification: task.verification.status },
        next: task.verification.status === "PASSED"
          ? `Nothing is missing — close it from VERIFIED.`
          : `Get evidence first: ${cmd(`verify ${id}`)}`,
      });
    }

    const timestamp = now();
    const closed = save(root, { ...task, status: "DONE" }, timestamp);
    renameSync(taskPath(root, id), completedPath(root, id));
    syncCounts(root, timestamp);
    return ok({ task: closed });
  } catch (e) {
    return errorPayload(MichiError.from(e));
  }
}
