/**
 * Tasks in the graph.
 *
 * A task reports which files it touched. That is a claim about what it did,
 * not evidence that those files implement the requirement — so the graph says
 * exactly that and no more: the task implements the requirement, the task
 * touched the file. Any connection between file and requirement is derived
 * through the task, never asserted.
 */
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
import { buildGraph, NODE_TYPES, EDGE_TYPES } from "../src/graph/build.js";
import { neighbors, withinHops } from "../src/graph/query.js";
import { resolveContext } from "../src/commands/context.js";
import { canonicalJson } from "../src/fs/canonical.js";

const unwrap = <T,>(r: { ok: true; data: T } | { ok: false; error: unknown }): T => {
  if (!r.ok) throw new Error(`expected ok, got ${JSON.stringify(r.error)}`);
  return r.data;
};

let n = 0;
let t = 0;
const BASE = Date.parse("2026-10-08T09:00:00.000Z");
const tick = () => new Date(BASE + t++ * 60_000).toISOString();
const put = (root: string, body: unknown): string => {
  const p = join(root, `gt${n++}${typeof body === "string" ? ".md" : ".json"}`);
  writeFileSync(p, typeof body === "string" ? body : JSON.stringify(body), "utf8");
  return p;
};
const plan = (root: string, u: object) => planUpdate({ root, now: tick, file: put(root, u) });
const discover = (root: string, u: object) => discoverAnswer({ root, now: tick, file: put(root, u) });
const draft = (title: string) => ({
  title, description: `${title} description.`, type: "functional", priority: "high",
  origin_confidence: "STATED", acceptance_criteria: ["agreed"],
});

/** Two requirements, architecture locked, work planned, TASK-001 reported. */
function worked() {
  const root = tempProject({ "package.json": '{"name":"stockroom"}' });
  init({ root, now: tick });
  unwrap(discoverStart({ root, now: tick }));
  unwrap(discover(root, {
    intent: { problem: { value: "P", confidence: "STATED" }, goal: { value: "G", confidence: "STATED" } },
    requirements: [draft("Manage products"), draft("See current stock")],
  }));
  unwrap(discover(root, { confirm: { requirements: ["REQ-001", "REQ-002"], by: "user" },
                          confirm_intent: { by: "user" } }));
  unwrap(discoverClose({ root, now: tick }));
  unwrap(plan(root, {
    personas: [{ name: "Owner", description: "Runs a shop.", goals: [] }],
    scope: [{ requirement: "REQ-001", scope: "MVP", reason: "essential" },
            { requirement: "REQ-002", scope: "MVP", reason: "the point" }],
    criteria: [{ requirement: "REQ-001", kind: "PLAIN", text: "A product can be added." },
               { requirement: "REQ-002", kind: "PLAIN", text: "The count is visible." }],
  }));
  unwrap(plan(root, { confirm: { scope: ["REQ-001", "REQ-002"], by: "user" },
                      confirm_specification: { by: "user" } }));
  unwrap(planClose({ root, now: tick }));
  unwrap(decidePropose({ root, now: tick, file: put(root, {
    title: "Where stock is kept", type: "engineering", category: "database",
    options: [{ key: "a", label: "A database", explanation: "Linked tables.", tradeoffs: "One more thing." },
              { key: "b", label: "A file", explanation: "One file.", tradeoffs: "Lost edits." }],
    affects_requirements: ["REQ-001", "REQ-002"],
  })}));
  unwrap(decideConfirm({ root, now: tick, id: "D001", choice: "a", by: "user",
    rationale: "Concurrent edits.", adrFile: put(root, "Reasoning.") }));
  unwrap(architectureClose({ root, now: tick }));
  unwrap(planTasks({ root, now: tick, fromRequirements: true }));

  unwrap(taskStart({ root, now: tick, id: "TASK-001", agent: "claude-code" }));
  unwrap(taskReport({ root, now: tick, id: "TASK-001", file: put(root, {
    result: "REPORTED",
    files_touched: ["src/products.ts", "src/products.test.ts"],
    tests: { run: 3, passed: 3, failed: 0 },
  })}));
  return root;
}

describe("the model says what happened and no more", () => {
  it("has a TASK node type", () => {
    expect(NODE_TYPES).toContain("TASK");
  });

  it("has IMPLEMENTS and TOUCHED, both hanging off the task", () => {
    expect(EDGE_TYPES).toContain("IMPLEMENTS");
    expect(EDGE_TYPES).toContain("TOUCHED");
  });

  it("never asserts that a file implements a requirement", () => {
    const g = buildGraph(worked());
    for (const edge of g.edges) {
      const from = g.nodes.find((x) => x.id === edge.from);
      const to = g.nodes.find((x) => x.id === edge.to);
      if (edge.type === "IMPLEMENTS") {
        expect(from?.type).toBe("TASK");
        expect(to?.type).toBe("REQUIREMENT");
      }
      if (edge.type === "TOUCHED") {
        expect(from?.type).toBe("TASK");
        expect(to?.type).toBe("FILE");
      }
      // No edge anywhere goes directly from a file to a requirement.
      expect(`${from?.type}->${to?.type}`).not.toBe("FILE->REQUIREMENT");
    }
  });
});

describe("tasks and the files they touched", () => {
  it("builds a node for each planned task", () => {
    const g = buildGraph(worked());
    const tasks = g.nodes.filter((x) => x.type === "TASK").map((x) => x.id);
    expect(tasks).toEqual(["TASK-001", "TASK-002"]);
  });

  it("links a task to the requirement it was planned for", () => {
    const g = buildGraph(worked());
    expect(g.edges.filter((e) => e.type === "IMPLEMENTS").map((e) => `${e.from}->${e.to}`))
      .toEqual(["TASK-001->REQ-001", "TASK-002->REQ-002"]);
  });

  it("links a task to the files it reported touching, and marks them reported", () => {
    const g = buildGraph(worked());
    expect(g.edges.filter((e) => e.type === "TOUCHED").map((e) => `${e.from}->${e.to}`))
      .toEqual(["TASK-001->src/products.test.ts", "TASK-001->src/products.ts"]);
    const file = g.nodes.find((x) => x.id === "src/products.ts");
    expect(file?.type).toBe("FILE");
    expect(file?.attrs.reported_by).toBe("TASK-001");
    expect(file?.attrs.verified).toBe(false);
  });

  it("records whether a reported file actually exists on disk", () => {
    const root = worked();
    const g = buildGraph(root);
    // The agent reported these; nothing created them.
    expect(g.nodes.find((x) => x.id === "src/products.ts")?.attrs.exists).toBe(false);
    writeFileSync(join(root, "package.json"), '{"name":"stockroom"}', "utf8");
    expect(buildGraph(root).nodes.find((x) => x.id === "package.json")?.attrs.exists).toBe(true);
  });

  it("links no files for a task that has not reported", () => {
    const g = buildGraph(worked());
    expect(g.edges.filter((e) => e.type === "TOUCHED" && e.from === "TASK-002")).toEqual([]);
  });

  it("carries the task's state onto its node", () => {
    const g = buildGraph(worked());
    expect(g.nodes.find((x) => x.id === "TASK-001")?.attrs.status).toBe("CHANGES_DETECTED");
    expect(g.nodes.find((x) => x.id === "TASK-001")?.attrs.verification).toBe("PENDING");
  });

  it("stays deterministic", () => {
    const root = worked();
    expect(canonicalJson(buildGraph(root))).toBe(canonicalJson(buildGraph(root)));
  });
});

describe("a file is reachable from a requirement, through the task", () => {
  it("is two hops away, never one", () => {
    const g = buildGraph(worked());
    const reach = withinHops(g, "REQ-001", 2);
    expect(reach.get("TASK-001")).toBe(1);
    expect(reach.get("src/products.ts")).toBe(2);
    expect(neighbors(g, "REQ-001").map((x) => x.id)).not.toContain("src/products.ts");
  });
});

describe("context can now reach the files", () => {
  it("offers the files a task reported for this requirement", () => {
    const p = unwrap(resolveContext({
      root: worked(), now: tick,
      request: { focus: { type: "requirement", id: "REQ-001" }, include: [], exclude: [] },
    }));
    const ids = p.items.map((i) => i.id);
    expect(ids).toContain("TASK-001");
    expect(ids).toContain("src/products.ts");
  });

  it("says the files are reported, not verified", () => {
    const p = unwrap(resolveContext({
      root: worked(), now: tick,
      request: { focus: { type: "requirement", id: "REQ-001" }, include: [], exclude: [] },
    }));
    const file = p.items.find((i) => i.id === "src/products.ts");
    expect(file?.reason).toMatch(/TASK-001/);
    expect(file?.reason.toLowerCase()).toMatch(/reported|not verified/);
    expect(file?.tier).toBe("PREFERRED");
  });

  it("does not offer files another requirement's task touched", () => {
    const p = unwrap(resolveContext({
      root: worked(), now: tick,
      request: { focus: { type: "requirement", id: "REQ-002" }, include: [], exclude: [] },
    }));
    expect(p.items.map((i) => i.id)).not.toContain("src/products.ts");
  });
});

describe("the compiled instruction uses them", () => {
  it("names the files a previous task reported, and warns they are unverified", () => {
    const root = worked();
    const started = unwrap(taskStart({ root, now: tick, id: "TASK-001", agent: "codex" }));
    const files = started.instruction.slice(
      started.instruction.indexOf("## RELEVANT FILES"),
      started.instruction.indexOf("## IMPLEMENTATION RULES"),
    );
    expect(files).toContain("src/products.ts");
    expect(files).toMatch(/TASK-001/);
    expect(files.toLowerCase()).toMatch(/reported|not verified/);
    expect(files.toLowerCase()).not.toMatch(/does not yet know/);
  });

  it("still tells an agent to look before writing when nothing is known", () => {
    const root = worked();
    const started = unwrap(taskStart({ root, now: tick, id: "TASK-002", agent: "codex" }));
    const files = started.instruction.slice(
      started.instruction.indexOf("## RELEVANT FILES"),
      started.instruction.indexOf("## IMPLEMENTATION RULES"),
    );
    expect(files.toLowerCase()).toMatch(/no files|nothing/);
    expect(files.toLowerCase()).toMatch(/inspect|look/);
  });
});
