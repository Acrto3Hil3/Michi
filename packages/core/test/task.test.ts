import { describe, it, expect } from "vitest";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { tempProject } from "./helpers.js";
import { init } from "../src/commands/init.js";
import { discoverStart, discoverAnswer, discoverClose } from "../src/commands/discover.js";
import { decidePropose, decideConfirm } from "../src/commands/decide.js";
import { planUpdate, planClose } from "../src/commands/plan.js";
import { architectureClose } from "../src/commands/architecture.js";
import { planTasks, planValidate } from "../src/commands/plan-tasks.js";
import { taskList, taskShow, taskNext, taskStart, taskReport, taskBlock } from "../src/commands/task.js";
import { INSTRUCTION_SECTIONS } from "../src/prompt/compile.js";
import { readYaml } from "../src/fs/brain.js";
import { RoadmapSchema, TaskSchema } from "../src/schemas/task.js";

const unwrap = <T,>(r: { ok: true; data: T } | { ok: false; error: unknown }): T => {
  if (!r.ok) throw new Error(`expected ok, got ${JSON.stringify(r.error)}`);
  return r.data;
};

let n = 0;
let t = 0;
const BASE = Date.parse("2026-10-07T09:00:00.000Z");
const tick = () => new Date(BASE + t++ * 60_000).toISOString();
const put = (root: string, body: unknown): string => {
  const p = join(root, `t${n++}${typeof body === "string" ? ".md" : ".json"}`);
  writeFileSync(p, typeof body === "string" ? body : JSON.stringify(body), "utf8");
  return p;
};
const plan = (root: string, u: object) => planUpdate({ root, now: tick, file: put(root, u) });
const discover = (root: string, u: object) => discoverAnswer({ root, now: tick, file: put(root, u) });
const draft = (title: string) => ({
  title, description: `${title} description.`, type: "functional", priority: "high",
  origin_confidence: "STATED", acceptance_criteria: ["agreed in words"],
});
const task = (root: string, id: string) =>
  readYaml(join(root, ".michi/tasks/active", `${id}.yaml`), TaskSchema);
const roadmap = (root: string) =>
  readYaml(join(root, ".michi/tasks/roadmap.yaml"), RoadmapSchema);

/** The inventory project, architecture locked: three MVP requirements, one FUTURE. */
function ready() {
  const root = tempProject({ "package.json": '{"name":"stockroom"}' });
  init({ root, now: tick });
  unwrap(discoverStart({ root, now: tick }));
  unwrap(discover(root, {
    intent: {
      problem: { value: "Retailers lose track of stock.", confidence: "STATED" },
      goal: { value: "Trust the counts.", confidence: "STATED" },
      constraints: { value: ["One shop"], confidence: "STATED" },
    },
    requirements: [draft("Manage products"), draft("See current stock"),
                   draft("Record stock movements"), draft("Export a report")],
  }));
  unwrap(discover(root, {
    confirm: { requirements: ["REQ-001", "REQ-002", "REQ-003", "REQ-004"], by: "user" },
    confirm_intent: { by: "user" },
  }));
  unwrap(discoverClose({ root, now: tick }));
  unwrap(plan(root, {
    personas: [{ name: "Store owner", description: "Runs one shop.", goals: ["Know the stock"] }],
    use_cases: [{ title: "Correct a count", persona: "PER-001", trigger: "A delivery arrives.",
                  steps: ["record it"], requirements: ["REQ-001", "REQ-003"] }],
    scope: [{ requirement: "REQ-001", scope: "MVP", reason: "essential" },
            { requirement: "REQ-002", scope: "MVP", reason: "the point" },
            { requirement: "REQ-003", scope: "MVP", reason: "counts drift without it" },
            { requirement: "REQ-004", scope: "FUTURE", reason: "later" }],
    criteria: [
      { requirement: "REQ-001", kind: "GWT", given: ["no products exist"], when: "one is added", then: ["it appears"] },
      { requirement: "REQ-002", kind: "PLAIN", text: "The count is visible." },
      { requirement: "REQ-003", kind: "GWT", given: ["5 units"], when: "a delivery of 3 is recorded", then: ["it shows 8"] },
    ],
  }));
  unwrap(plan(root, { confirm: { scope: ["REQ-001", "REQ-002", "REQ-003", "REQ-004"], by: "user" },
                      confirm_specification: { by: "user" } }));
  unwrap(planClose({ root, now: tick }));
  unwrap(decidePropose({ root, now: tick, file: put(root, {
    title: "Where the stock information is kept", type: "engineering", category: "database",
    options: [{ key: "a", label: "A relational database", explanation: "Linked tables.", tradeoffs: "One more thing to run." },
              { key: "b", label: "A single file", explanation: "One file.", tradeoffs: "Concurrent edits lost." }],
    affects_requirements: ["REQ-001", "REQ-002", "REQ-003"],
  })}));
  unwrap(decideConfirm({ root, now: tick, id: "D001", choice: "a", by: "user",
    rationale: "Two people record movements at once.",
    adrFile: put(root, "A file loses one of their edits silently.") }));
  unwrap(architectureClose({ root, now: tick }));
  return root;
}

describe("planning tasks", () => {
  it("refuses before the architecture is agreed", () => {
    const root = tempProject({ "package.json": '{"name":"a"}' });
    init({ root, now: tick });
    const r = planTasks({ root, now: tick, fromRequirements: true });
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.error.code).toBe("BLOCKED");
      expect(r.error.next).toMatch(/architecture|discover|plan/);
    }
  });

  it("seeds one task per first-version requirement, and none for later ones", () => {
    const root = ready();
    const d = unwrap(planTasks({ root, now: tick, fromRequirements: true }));
    expect(d.created).toEqual(["TASK-001", "TASK-002", "TASK-003"]);
    expect(roadmap(root).tasks).toEqual(["TASK-001", "TASK-002", "TASK-003"]);
    const all = unwrap(taskList({ root, now: tick })).tasks;
    expect(all.flatMap((x) => x.requirements)).not.toContain("REQ-004");
  });

  it("carries the requirement's criteria and governing decisions onto the task", () => {
    const root = ready();
    unwrap(planTasks({ root, now: tick, fromRequirements: true }));
    const first = task(root, "TASK-001");
    expect(first.requirements).toEqual(["REQ-001"]);
    expect(first.decisions).toEqual(["D001"]);
    expect(first.acceptance_criteria.map((c) => c.id)).toEqual(["AC-001"]);
    expect(first.acceptance_criteria[0]?.text).toMatch(/Given no products exist/);
    expect(first.status).toBe("READY");
  });

  it("does not duplicate a task for a requirement that already has one", () => {
    const root = ready();
    unwrap(planTasks({ root, now: tick, fromRequirements: true }));
    const again = unwrap(planTasks({ root, now: tick, fromRequirements: true }));
    expect(again.created).toEqual([]);
    expect(again.skipped).toEqual(["REQ-001", "REQ-002", "REQ-003"]);
    expect(roadmap(root).tasks).toHaveLength(3);
  });

  it("accepts a skill-authored plan with dependencies", () => {
    const root = ready();
    const d = unwrap(planTasks({ root, now: tick, file: put(root, {
      tasks: [
        { title: "The data model", description: "Tables for products and movements.",
          requirements: ["REQ-001"], acceptance_criteria: [{ id: "AC-001", text: "A product can be stored" }],
          scope: { in: ["the schema"], out: ["the UI"] } },
        { title: "The stock view", description: "Show the current count.",
          requirements: ["REQ-002"], depends_on: [1],
          acceptance_criteria: [{ id: "AC-002", text: "The count is visible" }],
          scope: { in: ["the view"], out: ["editing"] } },
      ],
    })}));
    expect(d.created).toEqual(["TASK-001", "TASK-002"]);
    expect(task(root, "TASK-002").dependencies).toEqual(["TASK-001"]);
    expect(task(root, "TASK-002").status).toBe("PENDING");
    expect(task(root, "TASK-001").status).toBe("READY");
  });

  it("refuses a plan naming a requirement that is not in the first version", () => {
    const root = ready();
    const r = planTasks({ root, now: tick, file: put(root, {
      tasks: [{ title: "T", description: "d", requirements: ["REQ-004"],
                acceptance_criteria: [{ id: "AC-9", text: "x" }], scope: { in: ["a"], out: [] } }],
    })});
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error.code).toBe("CONFLICT");
  });

  it("refuses a plan naming a requirement that does not exist", () => {
    const root = ready();
    const r = planTasks({ root, now: tick, file: put(root, {
      tasks: [{ title: "T", description: "d", requirements: ["REQ-999"],
                acceptance_criteria: [{ id: "AC-9", text: "x" }], scope: { in: ["a"], out: [] } }],
    })});
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error.code).toBe("NOT_FOUND");
  });
});

describe("validating the plan", () => {
  it("passes a plan where every first-version requirement has a task", () => {
    const root = ready();
    unwrap(planTasks({ root, now: tick, fromRequirements: true }));
    const d = unwrap(planValidate({ root, now: tick }));
    expect(d.ok).toBe(true);
    expect(d.problems).toEqual([]);
  });

  it("reports a first-version requirement nobody planned", () => {
    const root = ready();
    unwrap(planTasks({ root, now: tick, file: put(root, {
      tasks: [{ title: "Only one", description: "d", requirements: ["REQ-001"],
                acceptance_criteria: [{ id: "AC-001", text: "x" }], scope: { in: ["a"], out: [] } }],
    })}));
    const d = unwrap(planValidate({ root, now: tick }));
    expect(d.ok).toBe(false);
    expect(d.problems.join(" ")).toMatch(/REQ-002/);
    expect(d.problems.join(" ")).toMatch(/REQ-003/);
  });

  it("catches a dependency cycle before anyone builds against it", () => {
    const root = ready();
    unwrap(planTasks({ root, now: tick, fromRequirements: true }));
    // Hand-edit a cycle in, the way a bad plan would arrive.
    const a = join(root, ".michi/tasks/active/TASK-001.yaml");
    const b = join(root, ".michi/tasks/active/TASK-002.yaml");
    writeFileSync(a, readFileSync(a, "utf8").replace("dependencies: []", "dependencies:\n  - TASK-002"), "utf8");
    writeFileSync(b, readFileSync(b, "utf8").replace("dependencies: []", "dependencies:\n  - TASK-001"), "utf8");

    const d = unwrap(planValidate({ root, now: tick }));
    expect(d.ok).toBe(false);
    expect(d.problems.join(" ")).toMatch(/cycle/i);
  });

  it("catches a dependency on a task that does not exist", () => {
    const root = ready();
    unwrap(planTasks({ root, now: tick, fromRequirements: true }));
    const a = join(root, ".michi/tasks/active/TASK-001.yaml");
    writeFileSync(a, readFileSync(a, "utf8").replace("dependencies: []", "dependencies:\n  - TASK-404"), "utf8");
    const d = unwrap(planValidate({ root, now: tick }));
    expect(d.ok).toBe(false);
    expect(d.problems.join(" ")).toMatch(/TASK-404/);
  });
});

describe("finding the next piece of work", () => {
  it("returns the first ready task", () => {
    const root = ready();
    unwrap(planTasks({ root, now: tick, fromRequirements: true }));
    expect(unwrap(taskNext({ root, now: tick })).task?.task_id).toBe("TASK-001");
  });

  it("respects the dependencies", () => {
    const root = ready();
    unwrap(planTasks({ root, now: tick, file: put(root, {
      tasks: [
        { title: "Second", description: "d", requirements: ["REQ-002"], depends_on: [2],
          acceptance_criteria: [{ id: "AC-002", text: "x" }], scope: { in: ["a"], out: [] } },
        { title: "First", description: "d", requirements: ["REQ-001"],
          acceptance_criteria: [{ id: "AC-001", text: "x" }], scope: { in: ["a"], out: [] } },
      ],
    })}));
    expect(unwrap(taskNext({ root, now: tick })).task?.task_id).toBe("TASK-002");
  });

  it("says plainly when there is nothing ready", () => {
    const root = ready();
    const d = unwrap(taskNext({ root, now: tick }));
    expect(d.task).toBeNull();
    expect(d.reason).toMatch(/no tasks|nothing/i);
  });
});

describe("handing a task to an agent", () => {
  function planned() {
    const root = ready();
    unwrap(planTasks({ root, now: tick, fromRequirements: true }));
    return root;
  }

  it("refuses to start a task that is not ready", () => {
    const root = ready();
    unwrap(planTasks({ root, now: tick, file: put(root, {
      tasks: [
        { title: "First", description: "d", requirements: ["REQ-001"],
          acceptance_criteria: [{ id: "AC-001", text: "x" }], scope: { in: ["a"], out: [] } },
        { title: "Second", description: "d", requirements: ["REQ-002"], depends_on: [1],
          acceptance_criteria: [{ id: "AC-002", text: "x" }], scope: { in: ["a"], out: [] } },
      ],
    })}));
    const r = taskStart({ root, now: tick, id: "TASK-002", agent: "claude-code" });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error.code).toBe("CONFLICT");
  });

  it("moves the task to RUNNING, opens a run, and compiles the instruction", () => {
    const root = planned();
    const d = unwrap(taskStart({ root, now: tick, id: "TASK-001", agent: "claude-code" }));

    expect(d.run.run_id).toBe("RUN-0001");
    expect(d.run.agent).toBe("claude-code");
    expect(d.run.ended_at).toBeNull();
    expect(task(root, "TASK-001").status).toBe("RUNNING");
    expect(task(root, "TASK-001").attempt).toBe(1);
    expect(task(root, "TASK-001").runs).toEqual(["RUN-0001"]);
    expect(existsSync(join(root, ".michi/sessions/RUN-0001.yaml"))).toBe(true);

    // The instruction carries every section the contract names, in order.
    const headings = INSTRUCTION_SECTIONS.map((s) => `## ${s}`);
    let at = -1;
    for (const heading of headings) {
      const found = d.instruction.indexOf(heading);
      expect(found, heading).toBeGreaterThan(at);
      at = found;
    }
  });

  it("compiles deterministically: the same state gives the same instruction", () => {
    const root = planned();
    const a = unwrap(taskStart({ root, now: tick, id: "TASK-001", agent: "claude-code" }));
    unwrap(taskReport({ root, now: tick, id: "TASK-001",
      file: put(root, { result: "REPORTED", files_touched: [], notes: "n" }) }));
    // Starting the same task again (attempt 2) must produce the same instruction.
    const b = unwrap(taskStart({ root, now: tick, id: "TASK-001", agent: "codex" }));
    expect(b.instruction).toBe(a.instruction);
    expect(b.run.instruction_hash).toBe(a.run.instruction_hash);
  });

  it("puts the requirement, the decision and the criteria into the instruction", () => {
    const root = planned();
    const d = unwrap(taskStart({ root, now: tick, id: "TASK-001", agent: "claude-code" }));
    expect(d.instruction).toContain("REQ-001");
    expect(d.instruction).toContain("Manage products");
    expect(d.instruction).toContain("A relational database");
    expect(d.instruction).toContain("Two people record movements at once.");
    expect(d.instruction).toMatch(/Given no products exist/);
    expect(d.instruction).toContain("One shop");
  });

  it("tells the agent when to stop and what to report back", () => {
    const root = planned();
    const d = unwrap(taskStart({ root, now: tick, id: "TASK-001", agent: "claude-code" }));
    const stop = d.instruction.slice(d.instruction.indexOf("## STOP CONDITIONS"));
    expect(stop).toMatch(/ambiguous/i);
    expect(stop).toMatch(/locked decision/i);
    expect(stop.toLowerCase()).toMatch(/files changed/);
    expect(stop.toLowerCase()).toMatch(/tests/);
  });

  it("records what the agent reported as a claim, not as evidence", () => {
    const root = planned();
    unwrap(taskStart({ root, now: tick, id: "TASK-001", agent: "claude-code" }));
    const d = unwrap(taskReport({ root, now: tick, id: "TASK-001", file: put(root, {
      result: "REPORTED",
      files_touched: ["src/products.ts", "src/products.test.ts"],
      tests: { run: 4, passed: 4, failed: 0 },
      notes: "Added the product table and its tests.",
    })}));

    expect(d.task.status).toBe("CHANGES_DETECTED");
    expect(d.task.files_touched).toEqual(["src/products.test.ts", "src/products.ts"]);
    // Nothing is verified by the agent saying so.
    expect(d.task.verification.status).toBe("PENDING");
    expect(d.task.verification.evidence).toEqual([]);
    expect(d.run.verification_status).toBe("PENDING");
    expect(d.run.ended_at).not.toBeNull();
  });

  it("refuses a report for a task nobody started", () => {
    const root = planned();
    const r = taskReport({ root, now: tick, id: "TASK-001",
      file: put(root, { result: "REPORTED", files_touched: [] }) });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error.code).toBe("CONFLICT");
  });

  it("leaves a closed run untouched by a later attempt", () => {
    const root = planned();
    unwrap(taskStart({ root, now: tick, id: "TASK-001", agent: "claude-code" }));
    unwrap(taskReport({ root, now: tick, id: "TASK-001",
      file: put(root, { result: "REPORTED", files_touched: [] }) }));
    const first = readFileSync(join(root, ".michi/sessions/RUN-0001.yaml"), "utf8");
    unwrap(taskStart({ root, now: tick, id: "TASK-001", agent: "claude-code" }));
    expect(readFileSync(join(root, ".michi/sessions/RUN-0001.yaml"), "utf8")).toBe(first);
    expect(task(root, "TASK-001").attempt).toBe(2);
    expect(task(root, "TASK-001").runs).toEqual(["RUN-0001", "RUN-0002"]);
  });

  it("stalls rather than looping after three attempts", () => {
    const root = planned();
    for (let i = 0; i < 3; i += 1) {
      unwrap(taskStart({ root, now: tick, id: "TASK-001", agent: "claude-code" }));
      unwrap(taskReport({ root, now: tick, id: "TASK-001",
        file: put(root, { result: "ABORTED", files_touched: [] }) }));
    }
    expect(task(root, "TASK-001").status).toBe("STALLED");
    const r = taskStart({ root, now: tick, id: "TASK-001", agent: "claude-code" });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error.message).toMatch(/stalled|different approach/i);
  });
});

describe("blocking a task", () => {
  it("records why, and keeps it out of the ready list", () => {
    const root = ready();
    unwrap(planTasks({ root, now: tick, fromRequirements: true }));
    unwrap(taskBlock({ root, now: tick, id: "TASK-001", reason: "Needs a payment provider account." }));
    expect(task(root, "TASK-001").status).toBe("BLOCKED");
    expect(task(root, "TASK-001").blocked_reason).toMatch(/payment provider/);
    expect(unwrap(taskNext({ root, now: tick })).task?.task_id).toBe("TASK-002");
  });
});

describe("reading tasks", () => {
  it("lists them with their state, and filters", () => {
    const root = ready();
    unwrap(planTasks({ root, now: tick, fromRequirements: true }));
    unwrap(taskBlock({ root, now: tick, id: "TASK-002", reason: "Waiting on the owner." }));
    expect(unwrap(taskList({ root, now: tick, status: "BLOCKED" })).tasks.map((x) => x.task_id))
      .toEqual(["TASK-002"]);
    expect(unwrap(taskList({ root, now: tick })).tasks).toHaveLength(3);
  });

  it("shows one task with its context and its runs", () => {
    const root = ready();
    unwrap(planTasks({ root, now: tick, fromRequirements: true }));
    unwrap(taskStart({ root, now: tick, id: "TASK-001", agent: "claude-code" }));
    const d = unwrap(taskShow({ root, now: tick, id: "TASK-001" }));
    expect(d.task.task_id).toBe("TASK-001");
    expect(d.runs).toHaveLength(1);
    expect(d.task.context?.packet).toMatch(/^CTX-/);
  });

  it("refuses a task that does not exist", () => {
    const r = taskShow({ root: ready(), now: tick, id: "TASK-404" });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error.code).toBe("NOT_FOUND");
  });

  it("reads deterministically", () => {
    const root = ready();
    unwrap(planTasks({ root, now: tick, fromRequirements: true }));
    const a = taskList({ root, now: () => "2026-01-01T00:00:00.000Z" });
    const b = taskList({ root, now: () => "2099-01-01T00:00:00.000Z" });
    expect(JSON.stringify(a)).toBe(JSON.stringify(b));
  });
});
