import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { z } from "zod";
import { MichiError, errorPayload } from "../errors.js";
import type { Result } from "../result.js";
import { ok } from "../result.js";
import { STATE_FILE, brainDir, readYaml, writeYaml } from "../fs/brain.js";
import { StateSchema } from "../schemas/state.js";
import { EvidenceSchema, TaskSchema } from "../schemas/task.js";
import type { Evidence, Task } from "../schemas/task.js";
import { parseOrInvalid } from "../schemas/parse.js";
import { runAllowed } from "../verification/execute.js";
import { loadTasks, taskPath, withDerivedReadiness } from "./plan-tasks.js";
import { requireInitialized } from "./scan.js";
import { cmd } from "../identity.js";

/**
 * Verification: the act that turns "the agent says it works" into something
 * the project can stand behind.
 *
 * The whole phase rests on one line from P3 — *no completion without
 * evidence* — and on OQ-006's distinction between what MICHI observed and what
 * it was told. `verify` is the only path to `VERIFIED`, and it refuses to take
 * that step on an agent's word alone.
 */

export interface VerifyOptions {
  root: string;
  now: () => string;
  id: string;
}

function taskOrFail(root: string, id: string): Task {
  const found = withDerivedReadiness(loadTasks(root)).find((t) => t.task_id === id);
  if (found) return found;
  throw new MichiError({
    class: "UNKNOWN", code: "NOT_FOUND",
    message: `${id} is not a task on this project.`,
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
  const tasks = withDerivedReadiness(loadTasks(root));
  writeYaml(statePath, {
    ...state,
    counts: {
      ...state.counts,
      tasks_done: tasks.filter((t) => t.status === "DONE").length,
      tasks_blocked: tasks.filter((t) => t.status === "BLOCKED" || t.status === "NEEDS_HUMAN").length,
      tasks_verified: tasks.filter((t) => t.verification.status === "PASSED").length,
    },
    updated_at: now,
  });
}

function readJsonFile<T>(file: string, schema: z.ZodType<T, z.ZodTypeDef, unknown>, what: string): T {
  if (!existsSync(file)) {
    throw new MichiError({
      class: "UNKNOWN", code: "NOT_FOUND", message: `${file} does not exist.`,
    });
  }
  let raw: unknown;
  try {
    raw = JSON.parse(readFileSync(file, "utf8"));
  } catch (e) {
    throw new MichiError({
      class: "INVALID", code: "VALIDATION_ERROR",
      message: `The ${what} is not valid JSON.`,
      detail: { file, reason: e instanceof Error ? e.message : String(e) },
    });
  }
  return parseOrInvalid(schema, raw, `that ${what}`);
}

function addEvidence(root: string, task: Task, evidence: Evidence, now: string, status?: Task["status"]): Task {
  return save(root, {
    ...task,
    status: status ?? task.status,
    verification: {
      ...task.verification,
      evidence: [...task.verification.evidence, parseOrInvalid(EvidenceSchema, evidence, "that evidence")],
    },
  }, now);
}

// ---------------------------------------------------------------------------
// test
// ---------------------------------------------------------------------------

export interface RunTestData {
  task: Task;
  evidence: Evidence;
  passed: boolean;
}

/** MICHI runs an allow-listed command itself and keeps what it observed. */
export function runTest(options: VerifyOptions & { key: string }): Result<RunTestData> {
  try {
    const { root, now, id, key } = options;
    requireInitialized(root);
    const task = taskOrFail(root, id);

    const run = runAllowed({ root, now, key });
    if (!run.ok) return run;

    const timestamp = now();
    const updated = addEvidence(root, task, run.data.evidence, timestamp, "TESTING");
    syncCounts(root, timestamp);
    return ok({ task: updated, evidence: run.data.evidence, passed: run.data.passed });
  } catch (e) {
    return errorPayload(MichiError.from(e));
  }
}

const ReportedEvidenceSchema = z
  .object({
    kind: z.enum(["TESTS", "BUILD", "TYPECHECK", "LINT", "RUNTIME", "SECURITY", "SCREENSHOT"]),
    summary: z.string().min(1),
    passed: z.boolean(),
  })
  .strict();

/** The agent's own account, kept as a claim and never dressed up as more. */
export function recordTest(options: VerifyOptions & { file: string }): Result<RunTestData> {
  try {
    const { root, now, id, file } = options;
    requireInitialized(root);
    const task = taskOrFail(root, id);
    const reported = readJsonFile(file, ReportedEvidenceSchema, "test record");
    const timestamp = now();

    const evidence = parseOrInvalid(EvidenceSchema, {
      kind: reported.kind,
      produced_by: "AGENT",
      summary: reported.summary,
      exit_code: reported.passed ? 0 : 1,
      output_summary: reported.summary,
    }, "that evidence");

    const updated = addEvidence(root, task, evidence, timestamp, "TESTING");
    return ok({ task: updated, evidence, passed: reported.passed });
  } catch (e) {
    return errorPayload(MichiError.from(e));
  }
}

// ---------------------------------------------------------------------------
// review
// ---------------------------------------------------------------------------

const FindingsSchema = z
  .object({
    findings: z
      .array(z.object({
        file: z.string().min(1),
        line: z.number().int().positive().optional(),
        problem: z.string().min(1),
        why: z.string().min(1),
        fix: z.string().min(1),
      }))
      .default([]),
  })
  .strict();

export interface ReviewData {
  task: Task;
  verdict: "PASS" | "CHANGES_REQUIRED";
  findings: z.infer<typeof FindingsSchema>["findings"];
}

export function review(
  options: VerifyOptions & { verdict: "PASS" | "CHANGES_REQUIRED"; file: string },
): Result<ReviewData> {
  try {
    const { root, now, id, verdict, file } = options;
    requireInitialized(root);
    const task = taskOrFail(root, id);
    const { findings } = readJsonFile(file, FindingsSchema, "review");

    // "Looks bad" is not a review any more than "looks good" is.
    if (verdict === "CHANGES_REQUIRED" && findings.length === 0) {
      throw new MichiError({
        class: "INVALID", code: "VALIDATION_ERROR",
        message: "A review asking for changes has to say what they are.",
        next: "Each finding names a file, what is wrong, why it matters, and what to do instead.",
      });
    }

    const timestamp = now();
    const evidence = parseOrInvalid(EvidenceSchema, {
      kind: "REVIEW",
      produced_by: "AGENT",
      verdict,
      by: "reviewer",
      output_summary: verdict === "PASS"
        ? "PASS"
        : findings.map((f) => `${f.file}${f.line ? `:${f.line}` : ""} — ${f.problem}`).join("\n"),
    }, "that evidence");

    const updated = addEvidence(
      root, task, evidence, timestamp,
      verdict === "PASS" ? "REVIEWING" : "CHANGES_DETECTED",
    );
    return ok({ task: updated, verdict, findings });
  } catch (e) {
    return errorPayload(MichiError.from(e));
  }
}

// ---------------------------------------------------------------------------
// debug
// ---------------------------------------------------------------------------

export const DEBUG_STAGES = [
  "REPRODUCE", "OBSERVE", "HYPOTHESIS", "ROOT_CAUSE", "FIX", "VERIFY",
] as const;
export type DebugStage = (typeof DEBUG_STAGES)[number];

export interface DebugData {
  task: Task;
  stages: { stage: DebugStage; note: string }[];
}

function stagesSoFar(task: Task): { stage: DebugStage; note: string }[] {
  return task.verification.evidence
    .filter((e) => e.kind === "REPRODUCTION" && e.by !== null)
    .map((e) => ({ stage: e.by as DebugStage, note: e.summary ?? "" }));
}

/**
 * The disciplined process, enforced at the one place it matters.
 *
 * A fix before a reproduction is a guess. MICHI refuses it — not because the
 * guess is always wrong, but because nobody can tell afterwards whether it was.
 */
export function debugStage(
  options: VerifyOptions & { stage: DebugStage; note: string },
): Result<DebugData> {
  try {
    const { root, now, id, stage, note } = options;
    requireInitialized(root);
    const task = taskOrFail(root, id);
    const done = stagesSoFar(task);

    if ((stage === "FIX" || stage === "VERIFY") && !done.some((s) => s.stage === "REPRODUCE")) {
      throw new MichiError({
        class: "BLOCKED", code: "CONFLICT",
        message: `Nothing has been reproduced for ${id}, so there is nothing to fix yet.`,
        detail: { recorded: done.map((s) => s.stage) },
        next:
          `Reproduce it first: ${cmd(`debug ${id} --stage REPRODUCE --note "<what you did and saw>"`)}. ` +
          "A bug that cannot be reproduced cannot be confirmed fixed.",
      });
    }

    const timestamp = now();
    const evidence = parseOrInvalid(EvidenceSchema, {
      kind: "REPRODUCTION",
      produced_by: "AGENT",
      by: stage,
      summary: note,
      output_summary: `${stage}: ${note}`,
    }, "that evidence");

    const updated = addEvidence(root, task, evidence, timestamp);
    return ok({ task: updated, stages: stagesSoFar(updated) });
  } catch (e) {
    return errorPayload(MichiError.from(e));
  }
}

// ---------------------------------------------------------------------------
// verify
// ---------------------------------------------------------------------------

const VerdictSchema = z
  .object({
    criteria: z
      .array(z.object({
        id: z.string().min(1),
        status: z.enum(["SATISFIED", "UNSATISFIED", "NOT_APPLICABLE"]),
        reason: z.string().min(1),
        evidence: z.array(z.string().min(1)).default([]),
      }))
      .min(1),
  })
  .strict();

export interface VerifyData {
  task: Task;
  rested_on: { michi: number; agent: number };
  warnings: string[];
}

export function verify(options: VerifyOptions & { file: string }): Result<VerifyData> {
  try {
    const { root, now, id, file } = options;
    requireInitialized(root);
    const task = taskOrFail(root, id);
    const { criteria } = readJsonFile(file, VerdictSchema, "verdict");

    const observed = task.verification.evidence.filter((e) => e.produced_by === "MICHI");

    /*
     * The line this whole phase exists to hold.
     *
     * An agent reporting that its own work passed is the party being evaluated
     * marking its own paper. MICHI will not sign that off, and there is no
     * flag to make it.
     */
    if (observed.length === 0) {
      throw new MichiError({
        class: "BLOCKED", code: "BLOCKED",
        message:
          `MICHI has not observed anything for ${id} — every piece of evidence was reported by the agent. ` +
          `That is a claim about its own work, not evidence.`,
        detail: {
          agent_evidence: task.verification.evidence.length,
          michi_evidence: 0,
        },
        next:
          `Run something MICHI can see: ${cmd(`test ${id} --run test`)}. ` +
          "If there is nothing to run, add a command under `verification.allow` in .michi/config.yaml.",
      });
    }

    const failed = observed.filter((e) => e.exit_code !== 0);
    if (failed.length > 0) {
      throw new MichiError({
        class: "BLOCKED", code: "BLOCKED",
        message:
          `${failed.length} of the command(s) MICHI ran for ${id} failed. Nothing was verified.`,
        detail: {
          failed: failed.map((e) => ({ allow_key: e.allow_key, exit_code: e.exit_code })),
        },
        next: "Fix the work, then run them again.",
      });
    }

    const addressed = new Set(criteria.map((c) => c.id));
    const missing = task.acceptance_criteria.filter((c) => !addressed.has(c.id)).map((c) => c.id);
    if (missing.length > 0) {
      throw new MichiError({
        class: "BLOCKED", code: "BLOCKED",
        message: `${missing.length} acceptance criterion/criteria for ${id} were not addressed.`,
        detail: { unaddressed: missing },
        next: "Every criterion needs SATISFIED, UNSATISFIED or NOT_APPLICABLE, each with a reason.",
      });
    }

    // Which criteria rest only on what the agent said?
    const observedKinds = new Set(observed.map((e) => e.kind));
    const warnings: string[] = [];
    let michiBacked = 0;
    let agentBacked = 0;
    for (const criterion of criteria) {
      if (criterion.status !== "SATISFIED") continue;
      if (criterion.evidence.some((kind) => observedKinds.has(kind as Evidence["kind"]))) {
        michiBacked += 1;
      } else {
        agentBacked += 1;
        warnings.push(
          `${criterion.id} rests on evidence MICHI did not observe — "${criterion.reason}"`,
        );
      }
    }

    const passed = criteria.every((c) => c.status !== "UNSATISFIED");
    const timestamp = now();

    const updated = save(root, {
      ...task,
      status: passed ? "VERIFIED" : "CHANGES_DETECTED",
      verification: {
        status: passed ? "PASSED" : "FAILED",
        verified_at: timestamp,
        evidence: task.verification.evidence,
        criteria,
      },
    }, timestamp);
    syncCounts(root, timestamp);

    return ok({ task: updated, rested_on: { michi: michiBacked, agent: agentBacked }, warnings });
  } catch (e) {
    return errorPayload(MichiError.from(e));
  }
}
