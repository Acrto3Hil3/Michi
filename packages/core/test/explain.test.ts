import { describe, it, expect } from "vitest";
import { writeFileSync } from "node:fs";
import { join } from "node:path";
import { tempProject } from "./helpers.js";
import { init } from "../src/commands/init.js";
import { discoverStart, discoverAnswer, discoverClose } from "../src/commands/discover.js";
import { decidePropose, decideConfirm } from "../src/commands/decide.js";
import { planUpdate, planClose } from "../src/commands/plan.js";
import { architectureClose } from "../src/commands/architecture.js";
import { planTasks } from "../src/commands/plan-tasks.js";
import { taskStart, taskReport } from "../src/commands/task.js";
import { explain, impactOf } from "../src/commands/explain.js";
import { buildGraph } from "../src/graph/build.js";

const unwrap = <T,>(r: { ok: true; data: T } | { ok: false; error: unknown }): T => {
  if (!r.ok) throw new Error(`expected ok, got ${JSON.stringify(r.error)}`);
  return r.data;
};
const fails = <T,>(r: { ok: true; data: T } | { ok: false; error: { code: string; message: string } }) => {
  if (r.ok) throw new Error(`expected a failure, got ${JSON.stringify(r.data)}`);
  return r.error;
};

let n = 0, t = 0;
const BASE = Date.parse("2026-10-12T09:00:00.000Z");
const tick = () => new Date(BASE + t++ * 60_000).toISOString();
const put = (root: string, body: unknown): string => {
  const p = join(root, `e${n++}${typeof body === "string" ? ".md" : ".json"}`);
  writeFileSync(p, typeof body === "string" ? body : JSON.stringify(body), "utf8");
  return p;
};

/** A project carried as far as a reported task. */
function project(): string {
  const root = tempProject({ "package.json": '{"name":"clinic"}' });
  init({ root, now: tick });
  unwrap(discoverStart({ root, now: tick }));
  unwrap(discoverAnswer({ root, now: tick, file: put(root, {
    intent: {
      problem: { value: "Patient records are kept on paper and get lost.", confidence: "STATED" },
      goal: { value: "Let the practice trust its own records.", confidence: "STATED" },
      constraints: { value: ["Medical data", "One clinic"], confidence: "STATED" },
    },
    requirements: [
      { title: "Let people log in", description: "Staff sign in before seeing records.",
        type: "functional", priority: "high", origin_confidence: "STATED",
        acceptance_criteria: ["a member of staff can sign in"] },
      { title: "Export a report", description: "Monthly summary as a file.",
        type: "functional", priority: "low", origin_confidence: "ASSUMED",
        acceptance_criteria: ["the file downloads"] },
    ],
  })}));
  unwrap(discoverAnswer({ root, now: tick, file: put(root, {
    confirm: { requirements: ["REQ-001", "REQ-002"], by: "dr-patel" },
    confirm_intent: { by: "dr-patel" },
  })}));
  unwrap(discoverClose({ root, now: tick }));
  unwrap(planUpdate({ root, now: tick, file: put(root, {
    personas: [{ name: "Receptionist", description: "Books patients in.", goals: [] }],
    scope: [{ requirement: "REQ-001", scope: "MVP", reason: "nothing works without it" },
             { requirement: "REQ-002", scope: "FUTURE", reason: "not needed to open" }],
    criteria: [{ requirement: "REQ-001", kind: "PLAIN", text: "A member of staff can sign in." }],
  })}));
  unwrap(planUpdate({ root, now: tick, file: put(root, {
    confirm: { scope: ["REQ-001", "REQ-002"], by: "dr-patel" },
    confirm_specification: { by: "dr-patel" },
  })}));
  unwrap(planClose({ root, now: tick }));
  unwrap(decidePropose({ root, now: tick, file: put(root, {
    title: "How people log in", type: "engineering", category: "auth",
    options: [
      { key: "service", label: "A login service",
        explanation: "A specialist company handles passwords and we never store them.",
        tradeoffs: "A monthly cost, and one more company in the chain." },
      { key: "ourselves", label: "Build it ourselves",
        explanation: "We store passwords and check them.",
        tradeoffs: "We become responsible for password security." },
    ],
    affects_requirements: ["REQ-001"],
  })}));
  unwrap(decideConfirm({
    root, now: tick, id: "D001", choice: "service", by: "dr-patel",
    rationale: "The app handles medical records, so a mistake in how people log in would be serious.",
    adrFile: put(root, "We chose a login service."),
  }));
  unwrap(architectureClose({ root, now: tick }));
  unwrap(planTasks({ root, now: tick, fromRequirements: true }));
  return root;
}

describe("explaining a decision", () => {
  it("answers from the artifact: the choice, the reason, who approved it, when", () => {
    const root = project();
    const d = unwrap(explain({ root, now: tick, id: "D001" }));
    expect(d.kind).toBe("DECISION");
    expect(d.title).toBe("How people log in");
    const prose = d.paragraphs.join("\n");
    expect(prose).toContain("A login service");
    expect(prose).toContain("never store them");
    expect(prose).toContain("medical records");
    expect(prose).toContain("dr-patel");
    expect(prose).toContain("ADR-001");
  });

  it("says what was also considered, and why it was ruled out", () => {
    const root = project();
    const prose = unwrap(explain({ root, now: tick, id: "D001" })).paragraphs.join("\n");
    expect(prose).toContain("Build it ourselves");
    expect(prose.toLowerCase()).toMatch(/also considered|we ruled out/);
  });

  it("names the requirements it governs", () => {
    const root = project();
    expect(unwrap(explain({ root, now: tick, id: "D001" })).related).toContain("REQ-001");
  });

  it("explains an ADR id as the decision it documents", () => {
    const root = project();
    const d = unwrap(explain({ root, now: tick, id: "ADR-001" }));
    expect(d.kind).toBe("DECISION");
    expect(d.id).toBe("D001");
  });
});

describe("explaining a requirement", () => {
  it("uses the words the user used, and says who confirmed it", () => {
    const root = project();
    const r = unwrap(explain({ root, now: tick, id: "REQ-001" }));
    expect(r.kind).toBe("REQUIREMENT");
    const prose = r.paragraphs.join("\n");
    expect(prose).toContain("Staff sign in before seeing records.");
    expect(prose).toContain("dr-patel");
    expect(prose.toLowerCase()).toMatch(/first version|version one/);
  });

  it("says plainly when something is deliberately not in the first version", () => {
    const root = project();
    const prose = unwrap(explain({ root, now: tick, id: "REQ-002" })).paragraphs.join("\n");
    expect(prose.toLowerCase()).toMatch(/later|not in the first version/);
    expect(prose).toContain("not needed to open");
  });

  it("marks an assumption as an assumption rather than as a fact", () => {
    const root = project();
    const prose = unwrap(explain({ root, now: tick, id: "REQ-002" })).paragraphs.join("\n");
    expect(prose.toLowerCase()).toMatch(/assum/);
  });

  it("names the decisions that govern it", () => {
    const root = project();
    expect(unwrap(explain({ root, now: tick, id: "REQ-001" })).related).toContain("D001");
  });
});

describe("explaining a task", () => {
  it("says what it is for and where it stands", () => {
    const root = project();
    const prose = unwrap(explain({ root, now: tick, id: "TASK-001" })).paragraphs.join("\n");
    expect(prose).toContain("REQ-001");
    expect(prose.toLowerCase()).toMatch(/nobody has started|not been started|ready/);
  });

  it("calls an agent's report a report, not a result", () => {
    const root = project();
    unwrap(taskStart({ root, now: tick, id: "TASK-001", agent: "claude-code" }));
    unwrap(taskReport({ root, now: tick, id: "TASK-001", file: put(root, {
      result: "REPORTED", files_touched: ["src/login.ts"], tests: { run: 3, passed: 3, failed: 0 },
    })}));
    const prose = unwrap(explain({ root, now: tick, id: "TASK-001" })).paragraphs.join("\n");
    expect(prose.toLowerCase()).toMatch(/said|reported|claim/);
    expect(prose.toLowerCase()).toMatch(/not.*checked|nobody has checked|no evidence/);
  });
});

describe("explaining a file", () => {
  it("says which task reported it, and that reported is not verified", () => {
    const root = project();
    unwrap(taskStart({ root, now: tick, id: "TASK-001", agent: "claude-code" }));
    unwrap(taskReport({ root, now: tick, id: "TASK-001", file: put(root, {
      result: "REPORTED", files_touched: ["src/login.ts"], tests: { run: 1, passed: 1, failed: 0 },
    })}));
    const f = unwrap(explain({ root, now: tick, id: "src/login.ts" }));
    expect(f.kind).toBe("FILE");
    const prose = f.paragraphs.join("\n");
    expect(prose).toContain("TASK-001");
    expect(prose.toLowerCase()).toMatch(/reported/);
    expect(prose.toLowerCase()).not.toMatch(/verified that|proven/);
  });
});

describe("it never reconstructs", () => {
  it("refuses an id the project has never had", () => {
    const root = project();
    const e = fails(explain({ root, now: tick, id: "D999" }));
    expect(e.code).toBe("NOT_FOUND");
    expect(e.message.toLowerCase()).toMatch(/not recorded|never/);
  });

  it("says a component is not recorded rather than inventing one", () => {
    const root = project();
    const e = fails(explain({ root, now: tick, id: "AuthService" }));
    expect(e.message.toLowerCase()).toMatch(/not recorded|does not/);
  });

  it("writes nothing", () => {
    const root = project();
    const before = buildGraph(root);
    unwrap(explain({ root, now: tick, id: "D001" }));
    expect(buildGraph(root)).toEqual(before);
  });

  it("is deterministic", () => {
    const root = project();
    expect(unwrap(explain({ root, now: tick, id: "D001" })))
      .toEqual(unwrap(explain({ root, now: tick, id: "D001" })));
  });

  it("--simple drops the ids a non-coder has no use for", () => {
    const root = project();
    const plain = unwrap(explain({ root, now: tick, id: "D001", simple: true }));
    expect(plain.paragraphs.join("\n")).not.toMatch(/REQ-\d|D\d{3}|ADR-\d/);
    expect(plain.paragraphs.join("\n")).toContain("A login service");
  });
});

describe("the blast radius of changing a decision", () => {
  it("reports what depends on it, grouped by kind", () => {
    const root = project();
    const i = unwrap(impactOf({ root, now: tick, id: "D001" }));
    expect(i.requirements).toContain("REQ-001");
    expect(i.tasks).toContain("TASK-001");
    expect(i.total).toBeGreaterThan(1);
  });

  it("separates work already done from work not started", () => {
    const root = project();
    unwrap(taskStart({ root, now: tick, id: "TASK-001", agent: "claude-code" }));
    unwrap(taskReport({ root, now: tick, id: "TASK-001", file: put(root, {
      result: "REPORTED", files_touched: ["src/login.ts"], tests: { run: 1, passed: 1, failed: 0 },
    })}));
    const i = unwrap(impactOf({ root, now: tick, id: "D001" }));
    expect(i.files).toContain("src/login.ts");
    expect(i.tasks_with_work).toContain("TASK-001");
  });

  it("says plainly when nothing depends on it yet", () => {
    const root = project();
    unwrap(decidePropose({ root, now: tick, file: put(root, {
      title: "Where it runs", type: "engineering", category: "hosting",
      options: [{ key: "a", label: "A server", explanation: "One box.", tradeoffs: "You mind it." },
                { key: "b", label: "A platform", explanation: "Managed.", tradeoffs: "Costs more." }],
      affects_requirements: [],
    })}));
    const i = unwrap(impactOf({ root, now: tick, id: "D002" }));
    expect(i.total).toBe(0);
  });

  it("refuses a decision that does not exist", () => {
    expect(fails(impactOf({ root: project(), now: tick, id: "D404" })).code).toBe("NOT_FOUND");
  });

  it("refuses an id that is not a decision at all", () => {
    expect(fails(impactOf({ root: project(), now: tick, id: "REQ-001" })).code)
      .toBe("VALIDATION_ERROR");
  });
});

describe("the prose is prose", () => {
  it("never doubles a full stop, whatever shape the recorded reason was", () => {
    const root = project();
    for (const id of ["D001", "REQ-001", "REQ-002", "TASK-001"]) {
      const prose = unwrap(explain({ root, now: tick, id })).paragraphs.join("\n");
      expect(prose, id).not.toMatch(/\.\./);
      expect(prose, id).not.toMatch(/[,;]\s*\./);
    }
  });

  it("keeps a recorded title's own capitalisation rather than mangling it", () => {
    const root = project();
    const prose = unwrap(explain({ root, now: tick, id: "D001" })).paragraphs.join("\n");
    expect(prose).toContain('"Let people log in"');
    expect(prose).not.toContain("let people log in");
  });

  it("ends every paragraph like a sentence", () => {
    const root = project();
    for (const id of ["D001", "REQ-001", "TASK-001"]) {
      for (const paragraph of unwrap(explain({ root, now: tick, id })).paragraphs) {
        expect(paragraph.trim(), `${id}: ${paragraph}`).toMatch(/[.!?]$/);
      }
    }
  });
});
