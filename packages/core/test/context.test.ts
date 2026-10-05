import { describe, it, expect } from "vitest";
import { writeFileSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { tempProject } from "./helpers.js";
import { init } from "../src/commands/init.js";
import { discoverStart, discoverAnswer, discoverClose } from "../src/commands/discover.js";
import { decidePropose, decideConfirm } from "../src/commands/decide.js";
import { planUpdate, planClose } from "../src/commands/plan.js";
import { resolveContext } from "../src/commands/context.js";
import { CONTEXT_TIERS } from "../src/schemas/context.js";

const unwrap = <T,>(r: { ok: true; data: T } | { ok: false; error: unknown }): T => {
  if (!r.ok) throw new Error(`expected ok, got ${JSON.stringify(r.error)}`);
  return r.data;
};

let n = 0;
let t = 0;
const BASE = Date.parse("2026-10-06T09:00:00.000Z");
const tick = () => new Date(BASE + t++ * 60_000).toISOString();
const put = (root: string, body: unknown): string => {
  const p = join(root, `c${n++}${typeof body === "string" ? ".md" : ".json"}`);
  writeFileSync(p, typeof body === "string" ? body : JSON.stringify(body), "utf8");
  return p;
};
const plan = (root: string, u: object) => planUpdate({ root, now: tick, file: put(root, u) });
const discover = (root: string, u: object) => discoverAnswer({ root, now: tick, file: put(root, u) });
const draft = (title: string) => ({
  title, description: `${title} description.`, type: "functional", priority: "high",
  origin_confidence: "STATED", acceptance_criteria: ["agreed in words"],
});

/**
 * The inventory project: four requirements, two personas, two use cases,
 * criteria, and two locked decisions — one governing stock, one governing the
 * low-stock warning.
 */
function inventory() {
  const root = tempProject({ "package.json": '{"name":"stockroom"}', "tsconfig.json": "{}" });
  init({ root, now: tick });
  unwrap(discoverStart({ root, now: tick }));
  unwrap(discover(root, {
    intent: {
      problem: { value: "Retailers lose track of stock.", confidence: "STATED" },
      goal: { value: "Trust the counts.", confidence: "STATED" },
      constraints: { value: ["One shop"], confidence: "STATED" },
    },
    requirements: [draft("Manage products"), draft("See current stock"),
                   draft("Warn before running out"), draft("Export a stock report")],
  }));
  unwrap(discover(root, {
    confirm: { requirements: ["REQ-001", "REQ-002", "REQ-003", "REQ-004"], by: "user" },
    confirm_intent: { by: "user" },
  }));
  unwrap(discoverClose({ root, now: tick }));
  unwrap(plan(root, {
    personas: [{ name: "Store owner", description: "Runs one shop.", goals: ["Know the stock"] },
               { name: "Shop assistant", description: "Serves customers.", goals: [] }],
    use_cases: [
      { title: "Notice a product running low", persona: "PER-001",
        trigger: "Stock falls below the chosen level.",
        steps: ["a warning appears", "the owner reorders"], requirements: ["REQ-002", "REQ-003"] },
      { title: "Sell something at the counter", persona: "PER-002",
        trigger: "A customer buys.", steps: ["record it"], requirements: ["REQ-002"] },
    ],
    scope: [{ requirement: "REQ-001", scope: "MVP", reason: "essential" },
            { requirement: "REQ-002", scope: "MVP", reason: "the point" },
            { requirement: "REQ-003", scope: "MVP", reason: "asked for from day one" },
            { requirement: "REQ-004", scope: "FUTURE", reason: "later" }],
    criteria: [
      { requirement: "REQ-001", kind: "PLAIN", text: "A product can be added." },
      { requirement: "REQ-002", kind: "GWT", given: ["5 units"], when: "1 is sold", then: ["4 remain"] },
      { requirement: "REQ-003", kind: "GWT", given: ["stock is below the chosen level"],
        when: "the owner opens the app", then: ["a warning is shown"] },
    ],
  }));
  unwrap(plan(root, { confirm: { scope: ["REQ-001", "REQ-002", "REQ-003", "REQ-004"], by: "user" },
                      confirm_specification: { by: "user" } }));
  unwrap(planClose({ root, now: tick }));

  for (const [id, title, category, reqs] of [
    ["D001", "Where the stock information is kept", "database", ["REQ-001", "REQ-002"]],
    ["D002", "How the low-stock warning reaches the owner", "notifications", ["REQ-003"]],
  ] as const) {
    unwrap(decidePropose({ root, now: tick, file: put(root, {
      title, type: "engineering", category,
      options: [{ key: "a", label: "The chosen way", explanation: "Plain words.", tradeoffs: "A real cost." },
                { key: "b", label: "The other way", explanation: "Plain words.", tradeoffs: "Another cost." }],
      affects_requirements: reqs,
    })}));
    unwrap(decideConfirm({ root, now: tick, id, choice: "a", by: "user",
      rationale: `Because of ${title.toLowerCase()}.`,
      adrFile: put(root, `The reasoning behind ${title}.`) }));
  }
  return root;
}

const ctx = (root: string, request: object) => resolveContext({ root, now: tick, request });
const ids = (packet: { items: { id: string }[] }) => packet.items.map((i) => i.id);
const tierOf = (packet: { items: { id: string; tier: string }[] }, id: string) =>
  packet.items.find((i) => i.id === id)?.tier;
const reasonOf = (packet: { items: { id: string; reason: string }[] }, id: string) =>
  packet.items.find((i) => i.id === id)?.reason;

describe("the tiers are the ones the contract names", () => {
  it("has exactly four", () => {
    expect(CONTEXT_TIERS).toEqual(["MUST_INCLUDE", "PREFERRED", "OPTIONAL", "EXCLUDED"]);
  });
});

describe("selection — what the target actually needs", () => {
  it("refuses a focus this project does not have", () => {
    const r = ctx(inventory(), { focus: { type: "requirement", id: "REQ-999" } });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error.code).toBe("NOT_FOUND");
  });

  it("refuses a malformed request", () => {
    const r = ctx(inventory(), { focus: { type: "galaxy", id: "REQ-001" } });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error.code).toBe("VALIDATION_ERROR");
  });

  it("puts the target, its governing decision and its criteria in MUST_INCLUDE", () => {
    const p = unwrap(ctx(inventory(), { focus: { type: "requirement", id: "REQ-003" } }));
    expect(tierOf(p, "REQ-003")).toBe("MUST_INCLUDE");
    expect(tierOf(p, "D002")).toBe("MUST_INCLUDE");
    expect(tierOf(p, "AC-003")).toBe("MUST_INCLUDE");
    expect(tierOf(p, "ADR-002")).toBe("MUST_INCLUDE");
  });

  it("explains every inclusion in words a person can check", () => {
    const p = unwrap(ctx(inventory(), { focus: { type: "requirement", id: "REQ-003" } }));
    expect(reasonOf(p, "REQ-003")).toBe("direct target");
    expect(reasonOf(p, "D002")).toMatch(/governs REQ-003/);
    expect(reasonOf(p, "AC-003")).toMatch(/verifies REQ-003/);
    expect(reasonOf(p, "ADR-002")).toMatch(/documents D002/);
  });

  it("includes the use case and the person in it as PREFERRED", () => {
    const p = unwrap(ctx(inventory(), { focus: { type: "requirement", id: "REQ-003" } }));
    expect(tierOf(p, "UC-001")).toBe("PREFERRED");
    expect(tierOf(p, "PER-001")).toBe("PREFERRED");
    expect(reasonOf(p, "UC-001")).toMatch(/REQ-003/);
    expect(reasonOf(p, "PER-001")).toMatch(/UC-001/);
  });

  it("leaves unrelated project information out, and says why", () => {
    const p = unwrap(ctx(inventory(), { focus: { type: "requirement", id: "REQ-003" } }));
    expect(ids(p)).not.toContain("REQ-001");
    expect(ids(p)).not.toContain("D001");
    expect(ids(p)).not.toContain("AC-001");
    expect(ids(p)).not.toContain("PER-002");
    const withheld = p.excluded.find((x) => x.id === "D001");
    expect(withheld?.reason).toMatch(/not connected/i);
  });

  it("pulls in a requirement that shares a use case, but only as OPTIONAL", () => {
    const p = unwrap(ctx(inventory(), { focus: { type: "requirement", id: "REQ-003" } }));
    expect(tierOf(p, "REQ-002")).toBe("OPTIONAL");
    expect(reasonOf(p, "REQ-002")).toMatch(/UC-001/);
  });

  it("honours an explicit exclusion from the request", () => {
    const p = unwrap(ctx(inventory(), {
      focus: { type: "requirement", id: "REQ-003" }, exclude: ["UC-001"],
    }));
    expect(ids(p)).not.toContain("UC-001");
    expect(p.excluded.find((x) => x.id === "UC-001")?.reason).toMatch(/withheld by the request/);
  });

  it("honours an explicit inclusion the graph would not have reached", () => {
    const p = unwrap(ctx(inventory(), {
      focus: { type: "requirement", id: "REQ-003" }, include: ["D001"],
    }));
    expect(tierOf(p, "D001")).toBe("PREFERRED");
    expect(reasonOf(p, "D001")).toMatch(/asked for by the request/);
  });
});

describe("ranking", () => {
  it("orders by tier, then by how close the item is", () => {
    const p = unwrap(ctx(inventory(), { focus: { type: "requirement", id: "REQ-003" } }));
    const tiers = p.items.map((i) => i.tier);
    const order = ["MUST_INCLUDE", "PREFERRED", "OPTIONAL"];
    expect(tiers.map((x) => order.indexOf(x))).toEqual([...tiers.map((x) => order.indexOf(x))].sort());
    expect(p.items[0]?.id).toBe("REQ-003");
  });

  it("breaks ties on id, so ordering never depends on traversal order", () => {
    const root = inventory();
    const a = unwrap(ctx(root, { focus: { type: "requirement", id: "REQ-002" } }));
    const b = unwrap(ctx(root, { focus: { type: "requirement", id: "REQ-002" } }));
    expect(ids(a)).toEqual(ids(b));
    const must = a.items.filter((i) => i.tier === "MUST_INCLUDE" && i.rank === a.items[1]?.rank);
    expect(must.map((i) => i.id)).toEqual([...must.map((i) => i.id)].sort());
  });
});

describe("the packet", () => {
  it("estimates its size, and says the estimate is an estimate", () => {
    const p = unwrap(ctx(inventory(), { focus: { type: "requirement", id: "REQ-003" } }));
    expect(p.estimated_tokens).toBeGreaterThan(0);
    expect(p.estimation_method).toBe("chars/4");
  });

  it("names itself from its content, not from a counter", () => {
    const root = inventory();
    const a = unwrap(ctx(root, { focus: { type: "requirement", id: "REQ-003" } }));
    const b = unwrap(ctx(root, { focus: { type: "requirement", id: "REQ-003" } }));
    expect(a.packet_id).toBe(b.packet_id);
    expect(a.packet_id).toMatch(/^CTX-[0-9a-f]{8}$/);
  });

  it("carries the project's own constraints as global context", () => {
    const p = unwrap(ctx(inventory(), { focus: { type: "requirement", id: "REQ-003" } }));
    expect(p.project.constraints).toContain("One shop");
    expect(p.project.detected.package_manager).toBeDefined();
  });

  it("is reproducible: same state and request give the same hash", () => {
    const root = inventory();
    const a = unwrap(ctx(root, { focus: { type: "requirement", id: "REQ-003" } }));
    const b = unwrap(ctx(root, { focus: { type: "requirement", id: "REQ-003" } }));
    expect(a.context_hash).toBe(b.context_hash);
    expect(a.input_hash).toBe(b.input_hash);
    expect(a.state_hash).toBe(b.state_hash);
  });

  it("does not let the clock into the content hash", () => {
    const root = inventory();
    const a = unwrap(resolveContext({ root, now: () => "2026-01-01T00:00:00.000Z",
      request: { focus: { type: "requirement", id: "REQ-003" } } }));
    const b = unwrap(resolveContext({ root, now: () => "2099-12-31T00:00:00.000Z",
      request: { focus: { type: "requirement", id: "REQ-003" } } }));
    expect(a.context_hash).toBe(b.context_hash);
    expect(a.generated_at).not.toBe(b.generated_at);
  });

  it("gives a different hash for a different focus", () => {
    const root = inventory();
    const a = unwrap(ctx(root, { focus: { type: "requirement", id: "REQ-003" } }));
    const b = unwrap(ctx(root, { focus: { type: "requirement", id: "REQ-002" } }));
    expect(a.context_hash).not.toBe(b.context_hash);
    expect(a.input_hash).not.toBe(b.input_hash);
  });

  it("writes nothing", () => {
    const root = inventory();
    const before = readFileSync(join(root, ".michi/requirements/specification.yaml"), "utf8");
    ctx(root, { focus: { type: "requirement", id: "REQ-003" } });
    ctx(root, { focus: { type: "requirement", id: "REQ-003" } });
    expect(readFileSync(join(root, ".michi/requirements/specification.yaml"), "utf8")).toBe(before);
  });
});

describe("the packet follows the project, not a cache", () => {
  it("changes when the governing decision's choice changes", () => {
    const root = inventory();
    const before = unwrap(ctx(root, { focus: { type: "requirement", id: "REQ-003" } }));

    unwrap(decidePropose({ root, now: tick, file: put(root, {
      title: "How the low-stock warning reaches the owner, revisited",
      type: "engineering", category: "notifications",
      options: [{ key: "a", label: "By email", explanation: "Arrives anyway.", tradeoffs: "Costs a little." },
                { key: "b", label: "In the app", explanation: "Seen on opening.", tradeoffs: "Missed if unopened." }],
      affects_requirements: ["REQ-003"],
    })}));
    unwrap(decideConfirm({ root, now: tick, id: "D003", choice: "a", by: "user",
      rationale: "The owner is on the shop floor.", adrFile: put(root, "Reasoning.") }));

    const after = unwrap(ctx(root, { focus: { type: "requirement", id: "REQ-003" } }));
    expect(after.context_hash).not.toBe(before.context_hash);
    expect(ids(after)).toContain("D003");
  });

  it("shows a decision that needs review instead of hiding or trusting it", () => {
    const root = inventory();
    unwrap(plan(root, {
      revision: { reason: "The owner decided the warning can wait for version two.", by: "user" },
      scope: [{ requirement: "REQ-003", scope: "FUTURE", reason: "version two" }],
    }));
    unwrap(plan(root, { confirm: { scope: ["REQ-003"], by: "user" }, confirm_specification: { by: "user" } }));
    unwrap(planClose({ root, now: tick }));

    const p = unwrap(ctx(root, { focus: { type: "requirement", id: "REQ-003" } }));
    const d002 = p.items.find((i) => i.id === "D002");
    expect(d002).toBeDefined();
    expect(d002?.needs_review).toBe(true);
    expect(d002?.review_reason).toMatch(/REQ-003/);
    expect(p.warnings.join(" ")).toMatch(/D002/);
  });

  it("surfaces the revision that moved the target, not the whole history", () => {
    const root = inventory();
    unwrap(plan(root, {
      revision: { reason: "The owner decided the warning can wait for version two.", by: "user" },
      scope: [{ requirement: "REQ-003", scope: "FUTURE", reason: "version two" }],
    }));
    unwrap(plan(root, { confirm: { scope: ["REQ-003"], by: "user" }, confirm_specification: { by: "user" } }));
    unwrap(planClose({ root, now: tick }));
    unwrap(plan(root, {
      revision: { reason: "Adding the assistant persona we missed earlier on.", by: "user" },
      personas: [{ name: "Third party", description: "Nothing to do with stock.", goals: [] }],
    }));
    unwrap(plan(root, { confirm_specification: { by: "user" } }));
    unwrap(planClose({ root, now: tick }));

    const p = unwrap(ctx(root, { focus: { type: "requirement", id: "REQ-003" } }));
    expect(p.revisions.map((r) => r.id)).toEqual(["REV-001"]);
    expect(p.revisions[0]?.reason).toMatch(/wait for version two/);
  });

  it("excludes a removed criterion, and says it was removed", () => {
    const root = inventory();
    unwrap(plan(root, {
      revision: { reason: "That criterion described the wrong behaviour entirely.", by: "user" },
      remove: { criteria: ["AC-003"], by: "user", reason: "Described the wrong behaviour." },
    }));
    const p = unwrap(ctx(root, { focus: { type: "requirement", id: "REQ-003" } }));
    expect(ids(p)).not.toContain("AC-003");
    expect(p.excluded.find((x) => x.id === "AC-003")?.reason).toMatch(/removed/i);
  });
});

describe("the budget", () => {
  it("drops the lowest-priority context first, and says what it dropped", () => {
    const p = unwrap(ctx(inventory(), {
      focus: { type: "requirement", id: "REQ-003" }, budget_tokens: 220,
    }));
    expect(p.estimated_tokens).toBeLessThanOrEqual(220);
    expect(p.items.every((i) => i.tier === "MUST_INCLUDE" || i.tier === "PREFERRED")).toBe(true);
    expect(p.excluded.some((x) => x.reason === "budget")).toBe(true);
  });

  it("keeps everything the target cannot do without, right down to the boundary", () => {
    const root = inventory();
    // The exact cost of the required context, rather than a guessed number.
    const full = unwrap(ctx(root, { focus: { type: "requirement", id: "REQ-003" } }));
    const required = full.items.filter((i) => i.tier === "MUST_INCLUDE");
    const exactly = required.reduce((sum, i) => sum + i.estimated_tokens, 0);

    const p = unwrap(ctx(root, { focus: { type: "requirement", id: "REQ-003" }, budget_tokens: exactly }));
    expect(p.items.map((i) => i.id).sort()).toEqual(required.map((i) => i.id).sort());
    for (const id of ["REQ-003", "D002", "AC-003", "ADR-002"]) expect(ids(p)).toContain(id);

    // One token less and it refuses rather than dropping any of it.
    const r = ctx(root, { focus: { type: "requirement", id: "REQ-003" }, budget_tokens: exactly - 1 });
    expect(r.ok).toBe(false);
  });

  it("refuses rather than truncating when the required context will not fit", () => {
    const r = ctx(inventory(), { focus: { type: "requirement", id: "REQ-003" }, budget_tokens: 10 });
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.error.code).toBe("BLOCKED");
      expect(r.error.message).toMatch(/too large|does not fit/i);
      expect(r.error.detail).toBeDefined();
    }
  });

  it("makes the reduction visible rather than silent", () => {
    const p = unwrap(ctx(inventory(), {
      focus: { type: "requirement", id: "REQ-003" }, budget_tokens: 220,
    }));
    expect(p.budget_tokens).toBe(220);
    expect(p.dropped_for_budget.length).toBeGreaterThan(0);
  });
});
