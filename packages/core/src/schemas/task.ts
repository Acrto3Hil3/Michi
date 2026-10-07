import { z } from "zod";
import { SCHEMA_VERSION } from "./version.js";

/**
 * Tasks, their ordering, and the record of what an agent did with one.
 *
 * STATE_MODEL.md specifies all of this; the refinements below are where its
 * prose rules become mechanical. The important one: `VERIFIED` requires
 * evidence and `DONE` requires a passed verification. No evidence, no
 * `VERIFIED`, no exceptions (P3) — and no flag to get around it.
 */

const TASK = z.string().regex(/^TASK-\d{3,}$/);

export const TASK_STATES = [
  "PENDING", "READY", "RUNNING", "CHANGES_DETECTED", "TESTING", "REVIEWING",
  "VERIFIED", "DONE", "FAILED", "BLOCKED", "STALLED", "NEEDS_HUMAN",
] as const;
export const TaskStateSchema = z.enum(TASK_STATES);
export type TaskState = (typeof TASK_STATES)[number];

export function isTerminal(status: TaskState): boolean {
  return status === "DONE";
}

/**
 * `PENDING` and `READY` are derived, never asserted: a task is ready exactly
 * when every task it depends on is done. Everything else is explicit.
 */
export function readyFrom(
  dependencies: string[],
  statuses: Record<string, TaskState | string>,
): "PENDING" | "READY" {
  return dependencies.every((id) => statuses[id] === "DONE") ? "READY" : "PENDING";
}

/**
 * STATE_MODEL.md's evidence kinds, and who observed them (OQ-006).
 *
 * `produced_by` is the most important field here. `MICHI` evidence must carry
 * the full process record, so every execution traces back to a key the user
 * wrote into `verification.allow`. `AGENT` evidence must NOT carry those
 * fields: decorating a report with `allow_key` and timings would dress a claim
 * up as an observation, and keeping the two apart is the whole point.
 */
export const EvidenceSchema = z
  .object({
    kind: z.enum([
      "TESTS", "BUILD", "TYPECHECK", "LINT", "REVIEW", "RUNTIME",
      "SECURITY", "SCREENSHOT", "REPRODUCTION",
    ]),
    produced_by: z.enum(["MICHI", "AGENT"]),
    command: z.string().min(1).nullable().default(null),
    exit_code: z.number().int().nullable().default(null),
    output_summary: z.string().nullable().default(null),
    /** The entry in `verification.allow` that authorised this. MICHI only. */
    allow_key: z.string().min(1).nullable().default(null),
    cwd: z.string().min(1).nullable().default(null),
    started_at: z.string().datetime().nullable().default(null),
    ended_at: z.string().datetime().nullable().default(null),
    output_truncated: z.boolean().default(false),
    /** Whatever the agent said, for AGENT evidence. */
    summary: z.string().min(1).nullable().default(null),
    verdict: z.string().min(1).nullable().default(null),
    by: z.string().min(1).nullable().default(null),
  })
  .superRefine((e, ctx) => {
    const fail = (path: string, message: string) =>
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: [path], message });

    if (e.produced_by === "MICHI") {
      if (!e.allow_key) {
        fail("allow_key", "MICHI evidence must name the allow_key that authorised the command");
      }
      if (!e.command) fail("command", "MICHI evidence must record the command it ran");
      if (!e.started_at) fail("started_at", "MICHI evidence must record when it started");
      if (!e.ended_at) fail("ended_at", "MICHI evidence must record when it ended");
      return;
    }
    // AGENT evidence is a claim. Never let it wear the clothes of an observation.
    for (const field of ["allow_key", "cwd", "started_at", "ended_at"] as const) {
      if (e[field] !== null) {
        fail(field, `AGENT evidence may not carry ${field} — that would imply MICHI observed it`);
      }
    }
  });
export type Evidence = z.infer<typeof EvidenceSchema>;

export const TaskSchema = z
  .object({
    schema_version: z.literal(SCHEMA_VERSION),
    task_id: TASK,
    title: z.string().min(1),
    description: z.string().min(1),
    /** A task serving no requirement is scope creep (§76). */
    requirements: z.array(z.string().regex(/^REQ-\d{3,}$/))
      .min(1, "a task must serve at least one requirement"),
    decisions: z.array(z.string().regex(/^D\d{3,}$/)),
    dependencies: z.array(TASK),
    acceptance_criteria: z
      .array(z.object({ id: z.string().min(1), text: z.string().min(1) }))
      .min(1, "a task with no acceptance criteria cannot be finished, only abandoned"),
    scope: z.object({ in: z.array(z.string().min(1)), out: z.array(z.string().min(1)) }),
    status: TaskStateSchema,
    attempt: z.number().int().nonnegative(),
    context: z
      .object({
        packet: z.string().min(1),
        context_hash: z.string().min(1),
        input_hash: z.string().min(1),
      })
      .nullable(),
    runs: z.array(z.string().regex(/^RUN-\d{4,}$/)),
    files_touched: z.array(z.string().min(1)),
    verification: z.object({
      status: z.enum(["PENDING", "PASSED", "FAILED"]),
      verified_at: z.string().datetime().nullable().default(null),
      evidence: z.array(EvidenceSchema),
      /** Each acceptance criterion, addressed. An unaddressed one blocks VERIFIED. */
      criteria: z
        .array(z.object({
          id: z.string().min(1),
          status: z.enum(["SATISFIED", "UNSATISFIED", "NOT_APPLICABLE"]),
          reason: z.string().min(1),
          evidence: z.array(z.string().min(1)).default([]),
        }))
        .default([]),
    }),
    blocked_reason: z.string().min(1).nullable().default(null),
    created_at: z.string().datetime(),
    updated_at: z.string().datetime(),
  })
  .superRefine((t, ctx) => {
    const fail = (path: string, message: string) =>
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: [path], message });

    if (t.dependencies.includes(t.task_id)) {
      fail("dependencies", "a task cannot depend on itself");
    }
    if (t.status === "VERIFIED" || t.status === "DONE") {
      if (t.verification.evidence.length === 0) {
        fail("verification", "no evidence, no VERIFIED — a task is not done because someone says so");
      }
    }
    if (t.status === "DONE" && t.verification.status !== "PASSED") {
      fail("verification", "DONE is reachable only from a passed verification");
    }
    if ((t.status === "BLOCKED" || t.status === "NEEDS_HUMAN") && !t.blocked_reason) {
      fail("blocked_reason", `a ${t.status} task must record why`);
    }
  });
export type Task = z.infer<typeof TaskSchema>;

export const RoadmapSchema = z.object({
  schema_version: z.literal(SCHEMA_VERSION),
  next_task_id: z.number().int().positive(),
  next_run_id: z.number().int().positive(),
  milestone: z.string().min(1).nullable(),
  /** Every task id ever allocated, in order. */
  tasks: z.array(TASK),
  updated_at: z.string().datetime(),
});
export type Roadmap = z.infer<typeof RoadmapSchema>;

export function newRoadmap(now: string): Roadmap {
  return {
    schema_version: SCHEMA_VERSION,
    next_task_id: 1,
    next_run_id: 1,
    milestone: null,
    tasks: [],
    updated_at: now,
  };
}

export const taskId = (n: number): string => `TASK-${String(n).padStart(3, "0")}`;
export const runId = (n: number): string => `RUN-${String(n).padStart(4, "0")}`;

/**
 * What an agent did with a task.
 *
 * Append-only and immutable once closed. `notes` is the agent's own account —
 * a claim, not evidence. Verification is a separate act (P3).
 */
export const RunRecordSchema = z
  .object({
    schema_version: z.literal(SCHEMA_VERSION),
    run_id: z.string().regex(/^RUN-\d{4,}$/),
    task_id: TASK,
    /** Free-form: Core does not branch on which agent this is (P8). */
    agent: z.string().min(1),
    started_at: z.string().datetime(),
    ended_at: z.string().datetime().nullable(),
    attempt: z.number().int().positive(),
    input_hash: z.string().min(1),
    context_hash: z.string().min(1),
    /** Proof of exactly what instruction was handed over. */
    instruction_hash: z.string().min(1),
    result: z.enum(["REPORTED", "ABORTED", "STOPPED_BY_CONDITION"]).nullable(),
    files_touched: z.array(z.string().min(1)),
    tests: z
      .object({
        run: z.number().int().nonnegative(),
        passed: z.number().int().nonnegative(),
        failed: z.number().int().nonnegative(),
      })
      .nullable(),
    verification_status: z.enum(["PENDING", "PASSED", "FAILED"]),
    new_decisions_requested: z.array(z.string().min(1)),
    notes: z.string().nullable(),
  })
  .superRefine((r, ctx) => {
    if (r.ended_at && !r.result) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom, path: ["result"],
        message: "a closed run must say how it ended",
      });
    }
  });
export type RunRecord = z.infer<typeof RunRecordSchema>;
