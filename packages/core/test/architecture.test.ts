import { describe, it, expect } from "vitest";
import { writeFileSync, readFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import { tempProject } from "./helpers.js";
import { init } from "../src/commands/init.js";
import { discoverStart, discoverAnswer, discoverClose } from "../src/commands/discover.js";
import { decidePropose, decideConfirm, decideSupersede } from "../src/commands/decide.js";
import { planUpdate, planClose } from "../src/commands/plan.js";
import { architectureStatus, architectureExport, architectureClose } from "../src/commands/architecture.js";
import { readYaml } from "../src/fs/brain.js";
import { StateSchema } from "../src/schemas/state.js";

const unwrap = <T,>(r: { ok: true; data: T } | { ok: false; error: unknown }): T => {
  if (!r.ok) throw new Error(`expected ok, got ${JSON.stringify(r.error)}`);
  return r.data;
};

let n = 0;
let t = 0;
const BASE = Date.parse("2026-10-05T09:00:00.000Z");
const tick = () => new Date(BASE + t++ * 60_000).toISOString();
const payload = (root: string, data: unknown): string => {
  const f = join(root, `x${n++}.json`);
  writeFileSync(f, typeof data === "string" ? data : JSON.stringify(data), "utf8");
  return f;
};
const plan = (root: string, u: object) => planUpdate({ root, now: tick, file: payload(root, u) });
const discover = (root: string, u: object) => discoverAnswer({ root, now: tick, file: payload(root, u) });
const state = (root: string) => readYaml(join(root, ".michi/state/state.yaml"), StateSchema);

const draft = (title: string) => ({
  title, description: `${title} description.`, type: "functional", priority: "high",
  origin_confidence: "STATED", acceptance_criteria: ["agreed in words"],
});

/** Two MVP requirements, specification published, nothing decided yet. */
function specified() {
  const root = tempProject({ "package.json": '{"name":"shop"}' });
  init({ root, now: tick });
  unwrap(discoverStart({ root, now: tick }));
  unwrap(discover(root, {
    intent: {
      problem: { value: "Retailers lose track of stock.", confidence: "STATED" },
      goal: { value: "See and correct stock.", confidence: "STATED" },
      constraints: { value: ["One shop", "No budget for paid services yet"], confidence: "STATED" },
    },
    requirements: [draft("Manage products"), draft("See current stock")],
  }));
  unwrap(discover(root, {
    confirm: { requirements: ["REQ-001", "REQ-002"], by: "user" }, confirm_intent: { by: "user" },
  }));
  unwrap(discoverClose({ root, now: tick }));
  unwrap(plan(root, {
    personas: [{ name: "Store owner", description: "Runs one shop.", goals: ["Know the stock"] }],
    scope: [{ requirement: "REQ-001", scope: "MVP", reason: "nothing works without products" },
            { requirement: "REQ-002", scope: "MVP", reason: "the whole point" }],
    criteria: [{ requirement: "REQ-001", kind: "PLAIN", text: "A product can be added." },
               { requirement: "REQ-002", kind: "PLAIN", text: "The count is visible." }],
  }));
  unwrap(plan(root, {
    confirm: { scope: ["REQ-001", "REQ-002"], by: "user" }, confirm_specification: { by: "user" },
  }));
  unwrap(planClose({ root, now: tick }));
  return root;
}

/** Lock one decision governing the named requirements. */
function lock(root: string, id: string, title: string, category: string, requirements: string[]) {
  unwrap(decidePropose({ root, now: tick, file: payload(root, {
    title, type: "engineering", category,
    options: [
      { key: "chosen", label: "The recommended way", explanation: "Plain words about it.", tradeoffs: "A real cost." },
      { key: "other", label: "The other way", explanation: "Plain words about it.", tradeoffs: "A different cost." },
    ],
    affects_requirements: requirements,
  })}));
  const adr = join(root, `adr-${id}.md`);
  writeFileSync(adr, "Because this is the cheaper mistake to make.", "utf8");
  unwrap(decideConfirm({ root, now: tick, id, choice: "chosen",
    by: "user", rationale: "Cheapest mistake to make.", adrFile: adr }));
}

describe("architecture — preconditions", () => {
  it("refuses before init", () => {
    const r = architectureStatus({ root: tempProject(), now: tick });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error.code).toBe("NOT_INITIALIZED");
  });

  it("refuses while there is no published specification", () => {
    const root = tempProject({ "package.json": '{"name":"a"}' });
    init({ root, now: tick });
    const r = architectureStatus({ root, now: tick });
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.error.code).toBe("BLOCKED");
      expect(r.error.next).toMatch(/plan|discover/);
    }
  });

  it("reports every MVP requirement as undecided to begin with", () => {
    const root = specified();
    const d = unwrap(architectureStatus({ root, now: tick }));
    expect(d.status).toBe("UNSET");
    expect(d.undecided).toEqual(["REQ-001", "REQ-002"]);
    expect(d.decided).toEqual([]);
    expect(d.next_step).toMatch(/decide|propose/i);
  });
});

describe("architecture — what Core can actually check", () => {
  it("counts a requirement as decided when a locked decision governs it", () => {
    const root = specified();
    lock(root, "D001", "Where stock is kept", "database", ["REQ-001", "REQ-002"]);
    const d = unwrap(architectureStatus({ root, now: tick }));
    expect(d.decided).toEqual(["REQ-001", "REQ-002"]);
    expect(d.undecided).toEqual([]);
    expect(d.governing["REQ-001"]).toEqual(["D001"]);
  });

  it("does not count a proposal that nobody has confirmed", () => {
    const root = specified();
    unwrap(decidePropose({ root, now: tick, file: payload(root, {
      title: "Where stock is kept", type: "engineering", category: "database",
      options: [{ key: "a", label: "A", explanation: "e", tradeoffs: "t" },
                { key: "b", label: "B", explanation: "e", tradeoffs: "t" }],
      affects_requirements: ["REQ-001"],
    })}));
    const d = unwrap(architectureStatus({ root, now: tick }));
    expect(d.undecided).toEqual(["REQ-001", "REQ-002"]);
    expect(d.open_decisions).toEqual(["D001"]);
    expect(d.next_step).toMatch(/waiting|confirm/i);
  });

  it("ignores a superseded decision when deciding what is governed", () => {
    const root = specified();
    lock(root, "D001", "Where stock is kept", "database", ["REQ-001", "REQ-002"]);
    lock(root, "D002", "Where stock is kept, revisited", "database", ["REQ-001"]);
    // D001 replaced by D002, which only governs REQ-001
    unwrap(decideSupersede({ root, now: tick, id: "D001", withId: "D002" }));
    const d = unwrap(architectureStatus({ root, now: tick }));
    expect(d.decided).toEqual(["REQ-001"]);
    expect(d.undecided).toEqual(["REQ-002"]);
  });

  it("does not demand decisions for requirements outside the first version", () => {
    const root = specified();
    unwrap(plan(root, {
      revision: { reason: "The owner wants the stock view in version two instead.", by: "user" },
      scope: [{ requirement: "REQ-002", scope: "FUTURE", reason: "version two" }],
    }));
    unwrap(plan(root, { confirm: { scope: ["REQ-002"], by: "user" }, confirm_specification: { by: "user" } }));
    unwrap(planClose({ root, now: tick }));
    lock(root, "D001", "Where stock is kept", "database", ["REQ-001"]);

    const d = unwrap(architectureStatus({ root, now: tick }));
    expect(d.undecided).toEqual([]);
    expect(d.next_step).toMatch(/architecture close|everything/i);
  });
});

describe("architecture close", () => {
  it("refuses while an MVP requirement has no locked decision", () => {
    const root = specified();
    lock(root, "D001", "Where stock is kept", "database", ["REQ-001"]);
    const r = architectureClose({ root, now: tick });
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.error.code).toBe("CONFLICT");
      expect(JSON.stringify(r.error.detail)).toMatch(/REQ-002/);
    }
    expect(existsSync(join(root, ".michi/architecture/SYSTEM.md"))).toBe(false);
  });

  it("refuses while a decision is still waiting on the user", () => {
    const root = specified();
    lock(root, "D001", "Where stock is kept", "database", ["REQ-001", "REQ-002"]);
    unwrap(decidePropose({ root, now: tick, file: payload(root, {
      title: "How it is deployed", type: "engineering", category: "deployment",
      options: [{ key: "a", label: "A", explanation: "e", tradeoffs: "t" },
                { key: "b", label: "B", explanation: "e", tradeoffs: "t" }],
      affects_requirements: [],
    })}));
    const r = architectureClose({ root, now: tick });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(JSON.stringify(r.error.detail)).toMatch(/D002/);
  });

  it("refuses while the specification itself needs review", () => {
    const root = specified();
    lock(root, "D001", "Where stock is kept", "database", ["REQ-001", "REQ-002"]);
    discoverStart({ root, now: tick });
    unwrap(discover(root, { requirements: [draft("Scan barcodes")] }));
    unwrap(discover(root, { confirm: { requirements: ["REQ-003"], by: "user" }, confirm_intent: { by: "user" } }));
    unwrap(discoverClose({ root, now: tick }));

    const r = architectureClose({ root, now: tick });
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.error.code).toBe("CONFLICT");
      expect(r.error.message).toMatch(/specification/i);
    }
  });

  it("writes SYSTEM.md and TRD.md, locks the architecture and moves to DESIGN", () => {
    const root = specified();
    lock(root, "D001", "Where the stock information is kept", "database", ["REQ-001", "REQ-002"]);
    lock(root, "D002", "How the app is put in front of people", "deployment", []);
    const d = unwrap(architectureClose({ root, now: tick }));

    expect(d.stage).toBe("DESIGN");
    expect(d.artifacts).toEqual(["architecture/SYSTEM.md", "requirements/TRD.md"]);
    expect(existsSync(join(root, ".michi/architecture/SYSTEM.md"))).toBe(true);
    expect(existsSync(join(root, ".michi/requirements/TRD.md"))).toBe(true);

    const s = state(root);
    expect(s.stage).toBe("DESIGN");
    expect(s.architecture_status).toBe("LOCKED");
  });

  it("writes a SYSTEM.md a non-engineer can read", () => {
    const root = specified();
    lock(root, "D001", "Where the stock information is kept", "database", ["REQ-001", "REQ-002"]);
    unwrap(architectureClose({ root, now: tick }));
    const system = readFileSync(join(root, ".michi/architecture/SYSTEM.md"), "utf8");
    expect(system).toContain("Where the stock information is kept");
    expect(system).toContain("The recommended way");
    expect(system).toContain("Cheapest mistake to make.");
    expect(system).toMatch(/REQ-001/);
    expect(system).toMatch(/D001/);
  });

  it("writes a TRD grouped by what was decided", () => {
    const root = specified();
    lock(root, "D001", "Where the stock information is kept", "database", ["REQ-001", "REQ-002"]);
    lock(root, "D002", "How people log in", "authentication", []);
    unwrap(architectureClose({ root, now: tick }));
    const trd = readFileSync(join(root, ".michi/requirements/TRD.md"), "utf8");
    expect(trd).toMatch(/## Database/i);
    expect(trd).toMatch(/## Authentication/i);
    expect(trd).toContain("ADR-001");
    // The constraints the user stated belong here, not invented ones.
    expect(trd).toContain("No budget for paid services yet");
  });

  it("refuses to close twice", () => {
    const root = specified();
    lock(root, "D001", "Where stock is kept", "database", ["REQ-001", "REQ-002"]);
    unwrap(architectureClose({ root, now: tick }));
    const r = architectureClose({ root, now: tick });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error.code).toBe("CONFLICT");
  });
});

describe("architecture goes stale when the specification changes under it", () => {
  function locked() {
    const root = specified();
    lock(root, "D001", "Where stock is kept", "database", ["REQ-001", "REQ-002"]);
    unwrap(architectureClose({ root, now: tick }));
    return root;
  }

  it("flags the architecture for review when the specification is republished", () => {
    const root = locked();
    expect(state(root).needs_review).not.toContain("architecture");

    unwrap(plan(root, {
      revision: { reason: "The owner decided the stock view can wait for version two.", by: "user" },
      scope: [{ requirement: "REQ-002", scope: "FUTURE", reason: "version two" }],
    }));
    unwrap(plan(root, { confirm: { scope: ["REQ-002"], by: "user" }, confirm_specification: { by: "user" } }));
    unwrap(planClose({ root, now: tick }));

    const s = state(root);
    expect(s.needs_review).toContain("architecture");
    // The decisions stay locked. Nothing is unlocked or destroyed.
    expect(s.architecture_status).toBe("LOCKED");
    expect(existsSync(join(root, ".michi/architecture/SYSTEM.md"))).toBe(true);
  });

  it("lets the architecture be closed again, which clears the flag", () => {
    const root = locked();
    unwrap(plan(root, {
      revision: { reason: "The owner decided the stock view can wait for version two.", by: "user" },
      scope: [{ requirement: "REQ-002", scope: "FUTURE", reason: "version two" }],
    }));
    unwrap(plan(root, { confirm: { scope: ["REQ-002"], by: "user" }, confirm_specification: { by: "user" } }));
    unwrap(planClose({ root, now: tick }));

    const d = unwrap(architectureClose({ root, now: tick }));
    expect(d.stage).toBe("DESIGN");
    expect(state(root).needs_review).not.toContain("architecture");
  });

  it("says plainly that the architecture needs looking at again", () => {
    const root = locked();
    unwrap(plan(root, {
      revision: { reason: "The owner decided the stock view can wait for version two.", by: "user" },
      scope: [{ requirement: "REQ-002", scope: "FUTURE", reason: "version two" }],
    }));
    unwrap(plan(root, { confirm: { scope: ["REQ-002"], by: "user" }, confirm_specification: { by: "user" } }));
    unwrap(planClose({ root, now: tick }));

    const d = unwrap(architectureStatus({ root, now: tick }));
    expect(d.needs_review).toBe(true);
    expect(d.next_step).toMatch(/changed|review|again/i);
  });
});

describe("decisions must name requirements that exist", () => {
  it("refuses a proposal governing a requirement this project has never had", () => {
    const root = specified();
    const r = decidePropose({ root, now: tick, file: payload(root, {
      title: "Something", type: "engineering", category: "database",
      options: [{ key: "a", label: "A", explanation: "e", tradeoffs: "t" },
                { key: "b", label: "B", explanation: "e", tradeoffs: "t" }],
      affects_requirements: ["REQ-999"],
    })});
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error.code).toBe("NOT_FOUND");
  });

  it("accepts a proposal that names no requirements at all", () => {
    const root = specified();
    const r = decidePropose({ root, now: tick, file: payload(root, {
      title: "How we deploy", type: "engineering", category: "deployment",
      options: [{ key: "a", label: "A", explanation: "e", tradeoffs: "t" },
                { key: "b", label: "B", explanation: "e", tradeoffs: "t" }],
    })});
    expect(r.ok).toBe(true);
  });
});

describe("architecture reads stay deterministic", () => {
  it("export never mutates and never fabricates a timestamp", () => {
    const root = specified();
    lock(root, "D001", "Where stock is kept", "database", ["REQ-001", "REQ-002"]);
    const before = readFileSync(join(root, ".michi/state/state.yaml"), "utf8");
    const a = architectureExport({ root, now: () => "2026-01-01T00:00:00.000Z" });
    const b = architectureExport({ root, now: () => "2099-12-31T00:00:00.000Z" });
    expect(JSON.stringify(a)).toBe(JSON.stringify(b));
    expect(readFileSync(join(root, ".michi/state/state.yaml"), "utf8")).toBe(before);
  });
});
