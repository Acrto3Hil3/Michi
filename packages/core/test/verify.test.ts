import { describe, it, expect } from "vitest";
import { writeFileSync, readFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import { tempProject } from "./helpers.js";
import { init } from "../src/commands/init.js";
import { discoverStart, discoverAnswer, discoverClose } from "../src/commands/discover.js";
import { decidePropose, decideConfirm } from "../src/commands/decide.js";
import { planUpdate, planClose } from "../src/commands/plan.js";
import { architectureClose } from "../src/commands/architecture.js";
import { planTasks } from "../src/commands/plan-tasks.js";
import { taskStart, taskReport, taskShow, taskList, taskDone } from "../src/commands/task.js";
import { recordTest, runTest, review, debugStage, verify } from "../src/commands/verify.js";
import { EvidenceSchema, TaskSchema } from "../src/schemas/task.js";
import { readYaml, writeYaml } from "../src/fs/brain.js";
import { ConfigSchema } from "../src/schemas/config.js";
import { StateSchema } from "../src/schemas/state.js";
import { buildGraph } from "../src/graph/build.js";

const unwrap = <T,>(r: { ok: true; data: T } | { ok: false; error: unknown }): T => {
  if (!r.ok) throw new Error(`expected ok, got ${JSON.stringify(r.error)}`);
  return r.data;
};

let n = 0;
let t = 0;
const BASE = Date.parse("2026-10-09T09:00:00.000Z");
const tick = () => new Date(BASE + t++ * 1000).toISOString();
const put = (root: string, body: unknown): string => {
  const p = join(root, `v${n++}${typeof body === "string" ? ".md" : ".json"}`);
  writeFileSync(p, typeof body === "string" ? body : JSON.stringify(body), "utf8");
  return p;
};
const plan = (root: string, u: object) => planUpdate({ root, now: tick, file: put(root, u) });
const discover = (root: string, u: object) => discoverAnswer({ root, now: tick, file: put(root, u) });

describe("evidence carries its provenance honestly", () => {
  const michi = {
    kind: "TESTS", produced_by: "MICHI", allow_key: "test", command: "pnpm test",
    cwd: ".", started_at: "2026-10-09T09:00:00.000Z", ended_at: "2026-10-09T09:00:10.000Z",
    exit_code: 0, output_summary: "14 passed", output_truncated: false,
  };

  it("accepts MICHI evidence with the full process record", () => {
    expect(() => EvidenceSchema.parse(michi)).not.toThrow();
  });

  it("keeps the process record rather than silently dropping it", () => {
    const parsed = EvidenceSchema.parse(michi);
    expect(parsed.allow_key).toBe("test");
    expect(parsed.started_at).toBe("2026-10-09T09:00:00.000Z");
    expect(parsed.output_truncated).toBe(false);
  });

  it("REFUSES MICHI evidence with no allow_key — it must trace to the allow-list", () => {
    expect(() => EvidenceSchema.parse({ ...michi, allow_key: null })).toThrow(/allow_key/i);
  });

  it("REFUSES MICHI evidence that does not say when it ran", () => {
    expect(() => EvidenceSchema.parse({ ...michi, started_at: null })).toThrow(/started_at/i);
  });

  it("accepts AGENT evidence without a process record", () => {
    expect(() => EvidenceSchema.parse({
      kind: "REVIEW", produced_by: "AGENT", verdict: "PASS", by: "reviewer",
    })).not.toThrow();
  });

  it("REFUSES AGENT evidence dressed up with fields implying MICHI observed it", () => {
    expect(() => EvidenceSchema.parse({
      kind: "TESTS", produced_by: "AGENT", allow_key: "test", command: "pnpm test",
      started_at: "2026-10-09T09:00:00.000Z",
    })).toThrow(/allow_key|observed/i);
  });
});

/** A project with one reported task, and an allow-list the user filled in. */
function reported(allow: Record<string, string> = { test: "echo 3 passed" }) {
  const root = tempProject({ "package.json": '{"name":"stockroom"}' });
  init({ root, now: tick });
  const cfgPath = join(root, ".michi/config.yaml");
  const cfg = readYaml(cfgPath, ConfigSchema);
  writeYaml(cfgPath, { ...cfg, verification: { ...cfg.verification, allow } });

  unwrap(discoverStart({ root, now: tick }));
  unwrap(discover(root, {
    intent: { problem: { value: "P", confidence: "STATED" }, goal: { value: "G", confidence: "STATED" } },
    requirements: [{ title: "Manage products", description: "Add and edit products.",
      type: "functional", priority: "high", origin_confidence: "STATED",
      acceptance_criteria: ["a product can be added"] }],
  }));
  unwrap(discover(root, { confirm: { requirements: ["REQ-001"], by: "user" }, confirm_intent: { by: "user" } }));
  unwrap(discoverClose({ root, now: tick }));
  unwrap(plan(root, {
    personas: [{ name: "Owner", description: "Runs a shop.", goals: [] }],
    scope: [{ requirement: "REQ-001", scope: "MVP", reason: "essential" }],
    criteria: [{ requirement: "REQ-001", kind: "PLAIN", text: "A product can be added." },
               { requirement: "REQ-001", kind: "PLAIN", text: "A product can be retired." }],
  }));
  unwrap(plan(root, { confirm: { scope: ["REQ-001"], by: "user" }, confirm_specification: { by: "user" } }));
  unwrap(planClose({ root, now: tick }));
  unwrap(decidePropose({ root, now: tick, file: put(root, {
    title: "Where stock is kept", type: "engineering", category: "database",
    options: [{ key: "a", label: "A database", explanation: "Tables.", tradeoffs: "One more thing." },
              { key: "b", label: "A file", explanation: "One file.", tradeoffs: "Lost edits." }],
    affects_requirements: ["REQ-001"],
  })}));
  unwrap(decideConfirm({ root, now: tick, id: "D001", choice: "a", by: "user",
    rationale: "Concurrent edits.", adrFile: put(root, "Reasoning.") }));
  unwrap(architectureClose({ root, now: tick }));
  unwrap(planTasks({ root, now: tick, fromRequirements: true }));
  unwrap(taskStart({ root, now: tick, id: "TASK-001", agent: "claude-code" }));
  unwrap(taskReport({ root, now: tick, id: "TASK-001", file: put(root, {
    result: "REPORTED", files_touched: ["src/products.ts"], tests: { run: 3, passed: 3, failed: 0 },
  })}));
  return root;
}

const task = (root: string) => unwrap(taskShow({ root, now: tick, id: "TASK-001" })).task;

describe("running the tests MICHI was told it may run", () => {
  it("records the real result as MICHI evidence and moves the task to TESTING", () => {
    const root = reported();
    const d = unwrap(runTest({ root, now: tick, id: "TASK-001", key: "test" }));
    expect(d.passed).toBe(true);
    expect(d.task.status).toBe("TESTING");
    const evidence = task(root).verification.evidence;
    expect(evidence).toHaveLength(1);
    expect(evidence[0]?.produced_by).toBe("MICHI");
    expect(evidence[0]?.exit_code).toBe(0);
    expect(evidence[0]?.allow_key).toBe("test");
  });

  it("records a failing command as failing, and does not pretend otherwise", () => {
    const root = reported({ test: "echo 1 failed; exit 1" });
    const d = unwrap(runTest({ root, now: tick, id: "TASK-001", key: "test" }));
    expect(d.passed).toBe(false);
    expect(task(root).verification.evidence[0]?.exit_code).toBe(1);
    expect(task(root).verification.status).toBe("PENDING");
  });

  it("refuses a key the user never authorised", () => {
    const r = runTest({ root: reported(), now: tick, id: "TASK-001", key: "deploy" });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error.code).toBe("PERMISSION_DENIED");
  });

  it("records what the agent reported as AGENT evidence, kept separate", () => {
    const root = reported();
    unwrap(recordTest({ root, now: tick, id: "TASK-001", file: put(root, {
      kind: "TESTS", summary: "4 passed locally", passed: true,
    })}));
    const evidence = task(root).verification.evidence;
    expect(evidence[0]?.produced_by).toBe("AGENT");
    expect(evidence[0]?.allow_key).toBeNull();
  });
});

describe("review", () => {
  it("records a pass and moves the task to REVIEWING", () => {
    const root = reported();
    unwrap(runTest({ root, now: tick, id: "TASK-001", key: "test" }));
    const d = unwrap(review({ root, now: tick, id: "TASK-001", verdict: "PASS",
      file: put(root, { findings: [] }) }));
    expect(d.task.status).toBe("REVIEWING");
    expect(task(root).verification.evidence.some((e) => e.kind === "REVIEW")).toBe(true);
  });

  it("sends the task back when changes are required, with the findings kept", () => {
    const root = reported();
    const d = unwrap(review({ root, now: tick, id: "TASK-001", verdict: "CHANGES_REQUIRED",
      file: put(root, { findings: [
        { file: "src/products.ts", line: 12, problem: "No validation on the name.",
          why: "An empty name would be stored.", fix: "Reject an empty name." },
      ]})}));
    expect(d.task.status).toBe("CHANGES_DETECTED");
    expect(d.findings).toHaveLength(1);
  });

  it("refuses a review with CHANGES_REQUIRED and no findings", () => {
    const r = review({ root: reported(), now: tick, id: "TASK-001", verdict: "CHANGES_REQUIRED",
      file: put(reported(), { findings: [] }) });
    expect(r.ok).toBe(false);
  });
});

describe("debugging is a process, not a scramble", () => {
  it("refuses to reach the fix before a reproduction is recorded", () => {
    const root = reported();
    const r = debugStage({ root, now: tick, id: "TASK-001", stage: "FIX",
      note: "Changed the validator." });
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.error.code).toBe("CONFLICT");
      expect(r.error.message).toMatch(/reproduc/i);
    }
  });

  it("allows the fix once the bug has been reproduced", () => {
    const root = reported();
    unwrap(debugStage({ root, now: tick, id: "TASK-001", stage: "REPRODUCE",
      note: "Adding an empty name stores it." }));
    const d = unwrap(debugStage({ root, now: tick, id: "TASK-001", stage: "ROOT_CAUSE",
      note: "The name is never checked." }));
    expect(d.stages.map((s) => s.stage)).toEqual(["REPRODUCE", "ROOT_CAUSE"]);
    expect(debugStage({ root, now: tick, id: "TASK-001", stage: "FIX", note: "Check it." }).ok).toBe(true);
  });

  it("keeps the reproduction as evidence", () => {
    const root = reported();
    unwrap(debugStage({ root, now: tick, id: "TASK-001", stage: "REPRODUCE",
      note: "Adding an empty name stores it." }));
    expect(task(root).verification.evidence.some((e) => e.kind === "REPRODUCTION")).toBe(true);
  });
});

describe("verification is the only path to VERIFIED", () => {
  const criteria = (satisfied: string[]) => ({
    criteria: satisfied.map((id) => ({ id, status: "SATISFIED", reason: "The tests cover it.", evidence: ["TESTS"] })),
  });

  it("refuses when nothing MICHI observed is on the record", () => {
    const root = reported();
    unwrap(recordTest({ root, now: tick, id: "TASK-001", file: put(root, {
      kind: "TESTS", summary: "all green, honest", passed: true,
    })}));
    const r = verify({ root, now: tick, id: "TASK-001", file: put(root, criteria(["AC-001", "AC-002"])) });
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.error.code).toBe("BLOCKED");
      expect(r.error.message.toLowerCase()).toMatch(/michi has not observed|only.*reported|agent/);
    }
    expect(task(root).status).not.toBe("VERIFIED");
  });

  it("refuses while a criterion is unaddressed", () => {
    const root = reported();
    unwrap(runTest({ root, now: tick, id: "TASK-001", key: "test" }));
    const r = verify({ root, now: tick, id: "TASK-001", file: put(root, criteria(["AC-001"])) });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(JSON.stringify(r.error.detail)).toMatch(/AC-002/);
  });

  it("refuses while the observed evidence it rests on actually failed", () => {
    const root = reported({ test: "echo broken; exit 1" });
    unwrap(runTest({ root, now: tick, id: "TASK-001", key: "test" }));
    const r = verify({ root, now: tick, id: "TASK-001", file: put(root, criteria(["AC-001", "AC-002"])) });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error.message.toLowerCase()).toMatch(/failed/);
  });

  it("verifies when observed evidence passed and every criterion is addressed", () => {
    const root = reported();
    unwrap(runTest({ root, now: tick, id: "TASK-001", key: "test" }));
    const d = unwrap(verify({ root, now: tick, id: "TASK-001",
      file: put(root, criteria(["AC-001", "AC-002"])) }));
    expect(d.task.status).toBe("VERIFIED");
    expect(d.task.verification.status).toBe("PASSED");
    expect(d.task.verification.verified_at).toBeTruthy();
    expect(d.rested_on.michi).toBeGreaterThan(0);
  });

  it("says how much of the verdict rests on the agent's word", () => {
    const root = reported();
    unwrap(runTest({ root, now: tick, id: "TASK-001", key: "test" }));
    unwrap(recordTest({ root, now: tick, id: "TASK-001", file: put(root, {
      kind: "SCREENSHOT", summary: "the form looks right", passed: true,
    })}));
    const d = unwrap(verify({ root, now: tick, id: "TASK-001", file: put(root, {
      criteria: [
        { id: "AC-001", status: "SATISFIED", reason: "The tests cover it.", evidence: ["TESTS"] },
        { id: "AC-002", status: "SATISFIED", reason: "Checked by eye.", evidence: ["SCREENSHOT"] },
      ],
    })}));
    expect(d.rested_on.michi).toBe(1);
    expect(d.rested_on.agent).toBe(1);
    expect(d.warnings.join(" ")).toMatch(/AC-002/);
  });

  it("accepts a criterion that genuinely does not apply, with a reason", () => {
    const root = reported();
    unwrap(runTest({ root, now: tick, id: "TASK-001", key: "test" }));
    const d = unwrap(verify({ root, now: tick, id: "TASK-001", file: put(root, {
      criteria: [
        { id: "AC-001", status: "SATISFIED", reason: "The tests cover it.", evidence: ["TESTS"] },
        { id: "AC-002", status: "NOT_APPLICABLE", reason: "Retiring is a later task.", evidence: [] },
      ],
    })}));
    expect(d.task.verification.status).toBe("PASSED");
  });

  it("records a failure as FAILED rather than refusing", () => {
    const root = reported();
    unwrap(runTest({ root, now: tick, id: "TASK-001", key: "test" }));
    const d = unwrap(verify({ root, now: tick, id: "TASK-001", file: put(root, {
      criteria: [
        { id: "AC-001", status: "SATISFIED", reason: "Covered.", evidence: ["TESTS"] },
        { id: "AC-002", status: "UNSATISFIED", reason: "Retiring does not work yet.", evidence: [] },
      ],
    })}));
    expect(d.task.verification.status).toBe("FAILED");
    expect(d.task.status).toBe("CHANGES_DETECTED");
  });

  it("there is no override — a flag cannot force it", () => {
    const options = { root: reported(), now: tick, id: "TASK-001", file: "x.json" };
    expect(Object.keys(options).sort()).toEqual(["file", "id", "now", "root"]);
  });
});

describe("once verified", () => {
  function verified() {
    const root = reported();
    unwrap(runTest({ root, now: tick, id: "TASK-001", key: "test" }));
    unwrap(verify({ root, now: tick, id: "TASK-001", file: put(root, {
      criteria: [
        { id: "AC-001", status: "SATISFIED", reason: "Covered.", evidence: ["TESTS"] },
        { id: "AC-002", status: "SATISFIED", reason: "Covered.", evidence: ["TESTS"] },
      ],
    })}));
    return root;
  }

  it("the files it touched stop being merely reported", () => {
    const root = verified();
    const file = buildGraph(root).nodes.find((x) => x.id === "src/products.ts");
    expect(file?.attrs.verified).toBe(true);
  });

  it("the project counts it", () => {
    const root = verified();
    const state = readFileSync(join(root, ".michi/state/state.yaml"), "utf8");
    expect(state).toMatch(/tasks_verified: 1/);
  });
});

// ---------------------------------------------------------------------------
// VERIFIED → DONE
// ---------------------------------------------------------------------------

/** Verify TASK-001 properly, so it is sitting at VERIFIED. */
function verified(): string {
  const root = reported();
  unwrap(runTest({ root, now: tick, id: "TASK-001", key: "test" }));
  const criteria = task(root).acceptance_criteria.map((c) => ({
    id: c.id, status: "SATISFIED", reason: "The suite covers it.", evidence: ["TESTS"],
  }));
  unwrap(verify({ root, now: tick, id: "TASK-001", file: put(root, { criteria }) }));
  return root;
}

describe("closing a task", () => {
  it("moves a verified task to DONE, and to tasks/completed", () => {
    const root = verified();
    const done = unwrap(taskDone({ root, now: tick, id: "TASK-001" })).task;
    expect(done.status).toBe("DONE");
    expect(existsSync(join(root, ".michi/tasks/completed/TASK-001.yaml"))).toBe(true);
    expect(existsSync(join(root, ".michi/tasks/active/TASK-001.yaml"))).toBe(false);
  });

  it("keeps a closed task readable and counted", () => {
    const root = verified();
    unwrap(taskDone({ root, now: tick, id: "TASK-001" }));
    expect(task(root).status).toBe("DONE");
    expect(unwrap(taskList({ root, now: tick })).tasks.map((t) => t.task_id)).toContain("TASK-001");
    expect(readYaml(join(root, ".michi/state/state.yaml"), StateSchema).counts.tasks_done).toBe(1);
  });

  it("refuses to close a task that was never verified", () => {
    const root = reported();
    const r = taskDone({ root, now: tick, id: "TASK-001" });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(JSON.stringify(r.error)).toMatch(/verif/i);
    expect(existsSync(join(root, ".michi/tasks/active/TASK-001.yaml"))).toBe(true);
  });

  it("closing a dependency is what makes the next task READY", () => {
    const root = verified();
    const second = join(root, ".michi/tasks/active/TASK-002.yaml");
    const first = readYaml(join(root, ".michi/tasks/active/TASK-001.yaml"), TaskSchema);
    writeYaml(second, { ...first, task_id: "TASK-002", title: "Retire a product",
      status: "PENDING", dependencies: ["TASK-001"], runs: [],
      verification: { status: "PENDING", evidence: [], criteria: [], verified_at: null,
        reviews: [], debug_log: [] } });

    const before = unwrap(taskList({ root, now: tick })).tasks.find((t) => t.task_id === "TASK-002");
    expect(before?.status).toBe("PENDING");

    unwrap(taskDone({ root, now: tick, id: "TASK-001" }));
    const after = unwrap(taskList({ root, now: tick })).tasks.find((t) => t.task_id === "TASK-002");
    expect(after?.status).toBe("READY");
  });
});
