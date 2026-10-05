import { describe, it, expect } from "vitest";
import {
  TASK_STATES, TaskSchema, RoadmapSchema, newRoadmap, taskId, runId,
  isTerminal, readyFrom, RunRecordSchema,
} from "../src/schemas/task.js";
import { NOW } from "./helpers.js";

const base = {
  schema_version: 1,
  task_id: "TASK-001",
  title: "Record stock coming in",
  description: "A delivery increases the recorded quantity.",
  requirements: ["REQ-003"],
  decisions: ["D001"],
  dependencies: [],
  acceptance_criteria: [{ id: "AC-003", text: "Recording a delivery increases the quantity" }],
  scope: { in: ["the endpoint", "tests"], out: ["warehouse management"] },
  attempt: 0,
  context: null,
  runs: [],
  files_touched: [],
  verification: { status: "PENDING", evidence: [] },
  created_at: NOW,
  updated_at: NOW,
};

describe("task states", () => {
  it("are exactly the ones STATE_MODEL names", () => {
    expect(TASK_STATES).toEqual([
      "PENDING", "READY", "RUNNING", "CHANGES_DETECTED", "TESTING", "REVIEWING",
      "VERIFIED", "DONE", "FAILED", "BLOCKED", "STALLED", "NEEDS_HUMAN",
    ]);
  });

  it("knows which states are finished", () => {
    expect(isTerminal("DONE")).toBe(true);
    expect(isTerminal("READY")).toBe(false);
    expect(isTerminal("BLOCKED")).toBe(false);
  });
});

describe("a task record", () => {
  it("accepts a freshly planned task", () => {
    expect(() => TaskSchema.parse({ ...base, status: "PENDING" })).not.toThrow();
  });

  it("REFUSES VERIFIED with no evidence — no evidence, no VERIFIED", () => {
    expect(() => TaskSchema.parse({ ...base, status: "VERIFIED" })).toThrow(/evidence/i);
  });

  it("accepts VERIFIED once evidence exists", () => {
    expect(() => TaskSchema.parse({
      ...base, status: "VERIFIED",
      verification: {
        status: "PASSED",
        evidence: [{ kind: "TESTS", produced_by: "MICHI", command: "pnpm test",
                     exit_code: 0, output_summary: "14 passed" }],
      },
    })).not.toThrow();
  });

  it("REFUSES DONE unless the verification passed", () => {
    expect(() => TaskSchema.parse({ ...base, status: "DONE" })).toThrow(/verif/i);
  });

  it("REFUSES a blocked task with no reason", () => {
    expect(() => TaskSchema.parse({ ...base, status: "BLOCKED" })).toThrow(/reason/i);
  });

  it("accepts a blocked task that says why", () => {
    expect(() => TaskSchema.parse({
      ...base, status: "BLOCKED", blocked_reason: "Needs a payment provider account.",
    })).not.toThrow();
  });

  it("requires at least one requirement — a task serving nothing is scope creep", () => {
    expect(() => TaskSchema.parse({ ...base, status: "PENDING", requirements: [] })).toThrow();
  });

  it("requires at least one acceptance criterion", () => {
    expect(() => TaskSchema.parse({ ...base, status: "PENDING", acceptance_criteria: [] })).toThrow();
  });

  it("refuses to depend on itself", () => {
    expect(() => TaskSchema.parse({
      ...base, status: "PENDING", dependencies: ["TASK-001"],
    })).toThrow(/itself/i);
  });
});

describe("readiness is derived from the dependencies", () => {
  const done = { "TASK-001": "DONE" } as const;

  it("a task with no dependencies is ready", () => {
    expect(readyFrom([], {})).toBe("READY");
  });

  it("a task waiting on unfinished work is pending", () => {
    expect(readyFrom(["TASK-001"], { "TASK-001": "RUNNING" })).toBe("PENDING");
  });

  it("a task becomes ready when every dependency is done", () => {
    expect(readyFrom(["TASK-001"], done)).toBe("READY");
  });

  it("one unfinished dependency is enough to hold it back", () => {
    expect(readyFrom(["TASK-001", "TASK-002"], { ...done, "TASK-002": "READY" })).toBe("PENDING");
  });
});

describe("the roadmap", () => {
  it("starts empty with its counter at one", () => {
    const r = newRoadmap(NOW);
    expect(() => RoadmapSchema.parse(r)).not.toThrow();
    expect(r.next_task_id).toBe(1);
    expect(r.tasks).toEqual([]);
  });

  it("names ids from project-wide counters", () => {
    expect(taskId(1)).toBe("TASK-001");
    expect(taskId(34)).toBe("TASK-034");
    expect(runId(71)).toBe("RUN-0071");
  });
});

describe("an agent run record", () => {
  const run = {
    schema_version: 1,
    run_id: "RUN-0001",
    task_id: "TASK-001",
    agent: "claude-code",
    started_at: NOW,
    ended_at: null,
    attempt: 1,
    input_hash: "sha256:a",
    context_hash: "sha256:b",
    instruction_hash: "sha256:c",
    result: null,
    files_touched: [],
    tests: null,
    verification_status: "PENDING",
    new_decisions_requested: [],
    notes: null,
  };

  it("accepts an open run", () => {
    expect(() => RunRecordSchema.parse(run)).not.toThrow();
  });

  it("REFUSES a closed run with no result", () => {
    expect(() => RunRecordSchema.parse({ ...run, ended_at: NOW })).toThrow(/result/i);
  });

  it("records what the agent said as a claim, with its own result vocabulary", () => {
    const closed = RunRecordSchema.parse({
      ...run, ended_at: NOW, result: "REPORTED",
      files_touched: ["src/stock.ts"], notes: "Added the endpoint.",
    });
    expect(closed.result).toBe("REPORTED");
    expect(closed.verification_status).toBe("PENDING");
  });

  it("rejects a result outside the vocabulary", () => {
    expect(() => RunRecordSchema.parse({ ...run, ended_at: NOW, result: "PROBABLY_FINE" })).toThrow();
  });
});
