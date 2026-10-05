import { describe, it, expect } from "vitest";
import { writeFileSync } from "node:fs";
import { join } from "node:path";
import { tempProject } from "./helpers.js";
import { init } from "../src/commands/init.js";
import { discoverStart, discoverAnswer, discoverClose } from "../src/commands/discover.js";
import { decidePropose, decideConfirm, decideSupersede } from "../src/commands/decide.js";
import { planUpdate, planClose } from "../src/commands/plan.js";
import { buildGraph, NODE_TYPES, EDGE_TYPES } from "../src/graph/build.js";
import { neighbors, withinHops, orphans, coverage } from "../src/graph/query.js";
import { canonicalJson } from "../src/fs/canonical.js";

const unwrap = <T,>(r: { ok: true; data: T } | { ok: false; error: unknown }): T => {
  if (!r.ok) throw new Error(`expected ok, got ${JSON.stringify(r.error)}`);
  return r.data;
};

let n = 0;
let t = 0;
const BASE = Date.parse("2026-10-06T09:00:00.000Z");
const tick = () => new Date(BASE + t++ * 60_000).toISOString();
const put = (root: string, body: unknown): string => {
  const p = join(root, `g${n++}${typeof body === "string" ? ".md" : ".json"}`);
  writeFileSync(p, typeof body === "string" ? body : JSON.stringify(body), "utf8");
  return p;
};
const plan = (root: string, u: object) => planUpdate({ root, now: tick, file: put(root, u) });
const discover = (root: string, u: object) => discoverAnswer({ root, now: tick, file: put(root, u) });

const draft = (title: string) => ({
  title, description: `${title} description.`, type: "functional", priority: "high",
  origin_confidence: "STATED", acceptance_criteria: ["agreed in words"],
});

/** Three requirements, two personas, two use cases, criteria, one locked decision. */
function project() {
  const root = tempProject({ "package.json": '{"name":"shop"}', "tsconfig.json": "{}" });
  init({ root, now: tick });
  unwrap(discoverStart({ root, now: tick }));
  unwrap(discover(root, {
    intent: { problem: { value: "P", confidence: "STATED" }, goal: { value: "G", confidence: "STATED" } },
    requirements: [draft("Manage products"), draft("See current stock"), draft("Warn before running out")],
  }));
  unwrap(discover(root, {
    confirm: { requirements: ["REQ-001", "REQ-002", "REQ-003"], by: "user" },
    confirm_intent: { by: "user" },
  }));
  unwrap(discoverClose({ root, now: tick }));
  unwrap(plan(root, {
    personas: [{ name: "Store owner", description: "Runs one shop.", goals: ["Know the stock"] },
               { name: "Shop assistant", description: "Serves customers.", goals: [] }],
    use_cases: [
      { title: "Check the shelf", persona: "PER-001", trigger: "A count looks wrong.",
        steps: ["open the list"], requirements: ["REQ-001", "REQ-002"] },
      { title: "Sell something", persona: "PER-002", trigger: "A customer buys.",
        steps: ["record it"], requirements: ["REQ-002"] },
    ],
    scope: [{ requirement: "REQ-001", scope: "MVP", reason: "essential" },
            { requirement: "REQ-002", scope: "MVP", reason: "the point" },
            { requirement: "REQ-003", scope: "FUTURE", reason: "later" }],
    criteria: [{ requirement: "REQ-001", kind: "PLAIN", text: "A product can be added." },
               { requirement: "REQ-002", kind: "GWT", given: ["5 units"], when: "1 is sold", then: ["4 remain"] }],
  }));
  unwrap(plan(root, { confirm: { scope: ["REQ-001", "REQ-002", "REQ-003"], by: "user" },
                      confirm_specification: { by: "user" } }));
  unwrap(planClose({ root, now: tick }));
  unwrap(decidePropose({ root, now: tick, file: put(root, {
    title: "Where stock is kept", type: "engineering", category: "database",
    options: [{ key: "a", label: "A database", explanation: "Linked tables.", tradeoffs: "One more thing." },
              { key: "b", label: "A file", explanation: "One file.", tradeoffs: "Lost edits." }],
    affects_requirements: ["REQ-001", "REQ-002"],
  })}));
  unwrap(decideConfirm({ root, now: tick, id: "D001", choice: "a", by: "user",
    rationale: "Concurrent edits matter.", adrFile: put(root, "Because two people record at once.") }));
  return root;
}

describe("the graph is derived from canonical state", () => {
  it("only declares node types that have a canonical source", () => {
    expect(NODE_TYPES).toEqual([
      "REQUIREMENT", "DECISION", "USE_CASE", "ACCEPTANCE", "PERSONA", "FILE",
    ]);
  });

  it("only declares edge types backed by a real field", () => {
    expect(EDGE_TYPES).toEqual([
      "GOVERNS", "VERIFIES", "SERVES", "PERFORMED_BY", "SUPERSEDES",
    ]);
  });

  it("builds nodes from the requirements, specification and decisions", () => {
    const g = buildGraph(project());
    const ids = g.nodes.map((node) => node.id);
    expect(ids).toContain("REQ-001");
    expect(ids).toContain("D001");
    expect(ids).toContain("UC-001");
    expect(ids).toContain("AC-001");
    expect(ids).toContain("PER-001");
  });

  it("reuses the existing ids rather than inventing a second identity", () => {
    const g = buildGraph(project());
    for (const node of g.nodes) {
      expect(node.id).toMatch(/^(REQ|D|UC|AC|PER)-?\d{3,}$|^[^\s]+$/);
    }
    expect(g.nodes.filter((node) => node.type === "REQUIREMENT").map((node) => node.id))
      .toEqual(["REQ-001", "REQ-002", "REQ-003"]);
  });

  it("links a decision to the requirements it governs", () => {
    const g = buildGraph(project());
    const governs = g.edges.filter((e) => e.type === "GOVERNS");
    expect(governs.map((e) => `${e.from}->${e.to}`)).toEqual(["D001->REQ-001", "D001->REQ-002"]);
  });

  it("links criteria, use cases and personas", () => {
    const g = buildGraph(project());
    const of = (type: string) => g.edges.filter((e) => e.type === type).map((e) => `${e.from}->${e.to}`);
    expect(of("VERIFIES")).toEqual(["AC-001->REQ-001", "AC-002->REQ-002"]);
    expect(of("SERVES")).toEqual(["UC-001->REQ-001", "UC-001->REQ-002", "UC-002->REQ-002"]);
    expect(of("PERFORMED_BY")).toEqual(["UC-001->PER-001", "UC-002->PER-002"]);
  });

  it("records a file node for each file the project map actually knows", () => {
    const g = buildGraph(project());
    const files = g.nodes.filter((node) => node.type === "FILE").map((node) => node.id);
    expect(files).toContain("package.json");
    expect(files).toContain("tsconfig.json");
  });

  it("carries the scope of each requirement onto its node", () => {
    const g = buildGraph(project());
    const node = g.nodes.find((x) => x.id === "REQ-003");
    expect(node?.attrs.scope).toBe("FUTURE");
    expect(g.nodes.find((x) => x.id === "REQ-001")?.attrs.scope).toBe("MVP");
  });
});

describe("the graph is deterministic", () => {
  it("produces a byte-identical serialisation when rebuilt", () => {
    const root = project();
    expect(canonicalJson(buildGraph(root))).toBe(canonicalJson(buildGraph(root)));
  });

  it("sorts nodes by id and edges by from, type, to", () => {
    const g = buildGraph(project());
    const ids = g.nodes.map((node) => node.id);
    expect([...ids].sort()).toEqual(ids);
    const keys = g.edges.map((e) => `${e.from}|${e.type}|${e.to}`);
    expect([...keys].sort()).toEqual(keys);
  });

  it("carries no timestamp, so the same state always gives the same graph", () => {
    const g = buildGraph(project()) as unknown as Record<string, unknown>;
    expect(g.generated_at).toBeUndefined();
    expect(JSON.stringify(g)).not.toMatch(/20\d\d-\d\d-\d\dT/);
  });

  it("builds an empty graph for an untouched project without complaining", () => {
    const root = tempProject({ "package.json": '{"name":"a"}' });
    init({ root, now: tick });
    const g = buildGraph(root);
    expect(g.nodes.filter((node) => node.type === "REQUIREMENT")).toEqual([]);
    expect(g.edges).toEqual([]);
  });
});

describe("the graph never contradicts canonical state", () => {
  it("drops an edge whose other end does not exist, and says so", () => {
    const root = project();
    // A decision governing a requirement that was later superseded away.
    unwrap(discoverStart({ root, now: tick }));
    unwrap(discover(root, { requirements: [draft("Replaces products")] }));
    unwrap(discover(root, { confirm: { requirements: ["REQ-004"], by: "user" }, confirm_intent: { by: "user" } }));
    unwrap(discoverClose({ root, now: tick }));
    const g = buildGraph(root);
    for (const edge of g.edges) {
      expect(g.nodes.some((node) => node.id === edge.from), `${edge.from} missing`).toBe(true);
      expect(g.nodes.some((node) => node.id === edge.to), `${edge.to} missing`).toBe(true);
    }
  });

  it("keeps a superseded decision as a node, linked to its replacement", () => {
    const root = project();
    unwrap(decidePropose({ root, now: tick, file: put(root, {
      title: "Where stock is kept, revisited", type: "engineering", category: "database",
      options: [{ key: "a", label: "A", explanation: "e", tradeoffs: "t" },
                { key: "b", label: "B", explanation: "e", tradeoffs: "t" }],
      affects_requirements: ["REQ-001"],
    })}));
    unwrap(decideConfirm({ root, now: tick, id: "D002", choice: "a", by: "user",
      rationale: "Better.", adrFile: put(root, "Because.") }));
    unwrap(decideSupersede({ root, now: tick, id: "D001", withId: "D002" }));

    const g = buildGraph(root);
    const old = g.nodes.find((node) => node.id === "D001");
    expect(old).toBeDefined();
    expect(old?.attrs.status).toBe("SUPERSEDED");
    expect(g.edges.filter((e) => e.type === "SUPERSEDES").map((e) => `${e.from}->${e.to}`))
      .toEqual(["D002->D001"]);
  });

  it("marks removed product artifacts rather than dropping them", () => {
    const root = project();
    unwrap(plan(root, {
      revision: { reason: "That assistant does not touch stock after all.", by: "user" },
      remove: { personas: ["PER-002"], by: "user", reason: "Does not touch stock." },
    }));
    const g = buildGraph(root);
    const persona = g.nodes.find((node) => node.id === "PER-002");
    expect(persona?.attrs.status).toBe("REMOVED");
  });
});

describe("graph queries", () => {
  it("finds direct neighbours in both directions", () => {
    const g = buildGraph(project());
    expect(neighbors(g, "REQ-001").map((x) => x.id).sort())
      .toEqual(["AC-001", "D001", "UC-001"]);
    expect(neighbors(g, "REQ-001", ["GOVERNS"]).map((x) => x.id)).toEqual(["D001"]);
  });

  it("expands outward by hops, recording the distance", () => {
    const g = buildGraph(project());
    const reach = withinHops(g, "REQ-001", 2);
    expect(reach.get("REQ-001")).toBe(0);
    expect(reach.get("D001")).toBe(1);
    expect(reach.get("UC-001")).toBe(1);
    expect(reach.get("PER-001")).toBe(2);
    expect(reach.has("PER-002")).toBe(false);
  });

  it("reports requirements nobody has decided how to build", () => {
    const g = buildGraph(project());
    // REQ-003 is FUTURE and ungoverned; REQ-001 and REQ-002 are governed.
    expect(orphans(g, "REQUIREMENT", "GOVERNS")).toEqual(["REQ-003"]);
  });

  it("reports requirements with no acceptance criterion", () => {
    const g = buildGraph(project());
    expect(coverage(g)).toEqual(["REQ-003"]);
  });
});
