import { describe, it, expect } from "vitest";
import { writeFileSync, readFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import { tempProject, clock } from "./helpers.js";
import { init } from "../src/commands/init.js";
import { discoverStart, discoverAnswer, discoverClose } from "../src/commands/discover.js";
import { decidePropose, decideConfirm } from "../src/commands/decide.js";
import { planStatus, planUpdate, planExport, planClose } from "../src/commands/plan.js";
import { readYaml } from "../src/fs/brain.js";
import { StateSchema } from "../src/schemas/state.js";
import { SpecificationSchema } from "../src/schemas/product.js";

const unwrap = <T,>(r: { ok: true; data: T } | { ok: false; error: unknown }): T => {
  if (!r.ok) throw new Error(`expected ok, got ${JSON.stringify(r.error)}`);
  return r.data;
};

let n = 0;
const payload = (root: string, data: unknown): string => {
  const f = join(root, `p${n++}.json`);
  writeFileSync(f, JSON.stringify(data), "utf8");
  return f;
};

const send = (root: string, update: object) =>
  planUpdate({ root, now: clock, file: payload(root, update) });

const draft = (title: string) => ({
  title, description: `${title} description.`, type: "functional", priority: "high",
  origin_confidence: "STATED", acceptance_criteria: ["a criterion"],
});

/** A project that has been through discovery with `titles` confirmed. */
function specified(titles: string[] = ["Manage products", "See current stock"]) {
  const root = tempProject({ "package.json": '{"name":"shop"}' });
  init({ root, now: clock });
  discoverStart({ root, now: clock });
  discoverAnswer({ root, now: clock, file: payload(root, {
    intent: { problem: { value: "P", confidence: "STATED" }, goal: { value: "G", confidence: "STATED" } },
    requirements: titles.map(draft),
  })});
  const ids = titles.map((_, i) => `REQ-${String(i + 1).padStart(3, "0")}`);
  discoverAnswer({ root, now: clock, file: payload(root, {
    confirm: { requirements: ids, by: "user" }, confirm_intent: { by: "user" },
  })});
  discoverClose({ root, now: clock });
  return { root, ids };
}

const spec = (root: string) =>
  readYaml(join(root, ".michi/requirements/specification.yaml"), SpecificationSchema);

describe("plan — preconditions", () => {
  it("refuses before init", () => {
    const r = planStatus({ root: tempProject(), now: clock });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error.code).toBe("NOT_INITIALIZED");
  });

  it("refuses to plan a project with no confirmed requirements", () => {
    const root = tempProject({ "package.json": '{"name":"a"}' });
    init({ root, now: clock });
    const r = send(root, { out_of_scope: [{ title: "Accounting", reason: "no" }] });
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.error.code).toBe("BLOCKED");
      expect(r.error.next).toMatch(/discover/);
    }
  });

  it("reports an empty specification without complaining", () => {
    const { root, ids } = specified();
    const d = unwrap(planStatus({ root, now: clock }));
    expect(d.specification.status).toBe("DRAFT");
    expect(d.requirements.map((r) => r.id)).toEqual(ids);
    expect(d.unplaced).toEqual(ids);
    // Who it is for comes before what ships — that ordering is deliberate.
    expect(d.next_step).toMatch(/who this is for/i);
  });
});

describe("plan update — personas, use cases, criteria", () => {
  it("allocates project-wide ids", () => {
    const { root } = specified();
    const a = unwrap(send(root, {
      personas: [{ name: "Store owner", description: "Runs one shop.", goals: ["Know the stock"] }],
    }));
    expect(a.applied.personas_added).toEqual(["PER-001"]);

    const b = unwrap(send(root, {
      use_cases: [{ title: "Correct a count", persona: "PER-001", trigger: "A delivery arrives.",
                    steps: ["find the product", "record what arrived"], requirements: ["REQ-001"] }],
      criteria: [{ requirement: "REQ-001", kind: "GWT", given: ["5 units in stock"],
                   when: "1 is sold", then: ["stock shows 4"] }],
    }));
    expect(b.applied.use_cases_added).toEqual(["UC-001"]);
    expect(b.applied.criteria_added).toEqual(["AC-001"]);
    expect(spec(root).next_criterion_id).toBe(2);
  });

  it("refuses a use case pointing at a requirement that does not exist", () => {
    const { root } = specified();
    send(root, { personas: [{ name: "Owner", description: "d", goals: [] }] });
    const r = send(root, {
      use_cases: [{ title: "T", persona: "PER-001", trigger: "t", steps: ["s"], requirements: ["REQ-404"] }],
    });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error.code).toBe("NOT_FOUND");
  });

  it("refuses a use case pointing at a persona that does not exist", () => {
    const { root } = specified();
    const r = send(root, {
      use_cases: [{ title: "T", persona: "PER-404", trigger: "t", steps: ["s"], requirements: ["REQ-001"] }],
    });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error.code).toBe("NOT_FOUND");
  });

  it("refuses a criterion for a requirement that does not exist", () => {
    const { root } = specified();
    const r = send(root, { criteria: [{ requirement: "REQ-404", kind: "PLAIN", text: "t" }] });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error.code).toBe("NOT_FOUND");
  });

  it("refuses an unusable criterion", () => {
    const { root } = specified();
    const r = send(root, { criteria: [{ requirement: "REQ-001", kind: "GWT", given: ["g"] }] });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error.code).toBe("VALIDATION_ERROR");
  });
});

describe("plan update — scope", () => {
  it("records a scope call as PROPOSED until a human agrees", () => {
    const { root } = specified();
    const d = unwrap(send(root, {
      scope: [{ requirement: "REQ-001", scope: "MVP", reason: "nothing works without it" }],
    }));
    expect(d.applied.scope_proposed).toEqual(["REQ-001"]);
    expect(spec(root).scope[0]?.status).toBe("PROPOSED");
    expect(spec(root).scope[0]?.confirmed_by).toBeNull();
  });

  it("REFUSES to confirm a scope call without naming the human", () => {
    const { root } = specified();
    send(root, { scope: [{ requirement: "REQ-001", scope: "MVP", reason: "r" }] });
    const r = send(root, { confirm: { scope: ["REQ-001"] } });
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.error.code).toBe("VALIDATION_ERROR");
      expect(r.error.message.toLowerCase()).toMatch(/by/);
    }
  });

  it("confirms a scope call when the human is named", () => {
    const { root } = specified();
    send(root, { scope: [{ requirement: "REQ-001", scope: "FUTURE", reason: "later" }] });
    const d = unwrap(send(root, { confirm: { scope: ["REQ-001"], by: "user" } }));
    expect(d.applied.scope_confirmed).toEqual(["REQ-001"]);
    const a = spec(root).scope[0];
    expect(a?.status).toBe("CONFIRMED");
    expect(a?.confirmed_by).toBe("user");
    expect(a?.scope).toBe("FUTURE");
  });

  it("replaces an earlier scope call for the same requirement", () => {
    const { root } = specified();
    send(root, { scope: [{ requirement: "REQ-001", scope: "FUTURE", reason: "later" }] });
    send(root, { scope: [{ requirement: "REQ-001", scope: "MVP", reason: "actually essential" }] });
    const assignments = spec(root).scope.filter((a) => a.requirement === "REQ-001");
    expect(assignments).toHaveLength(1);
    expect(assignments[0]?.scope).toBe("MVP");
    expect(assignments[0]?.status).toBe("PROPOSED");
  });

  it("keeps FUTURE out of the MVP", () => {
    const { root } = specified();
    send(root, { scope: [
      { requirement: "REQ-001", scope: "MVP", reason: "r" },
      { requirement: "REQ-002", scope: "FUTURE", reason: "r" },
    ]});
    const d = unwrap(planStatus({ root, now: clock }));
    expect(d.by_scope.MVP).toEqual(["REQ-001"]);
    expect(d.by_scope.FUTURE).toEqual(["REQ-002"]);
    expect(d.by_scope.UNKNOWN).toEqual([]);
  });
});

describe("plan update — contradictions with locked decisions", () => {
  function lockedAgainst(requirement: string) {
    const { root, ids } = specified();
    const proposal = payload(root, {
      title: "Where stock is kept", type: "engineering", category: "database",
      options: [
        { key: "relational", label: "A relational database", explanation: "Linked tables.", tradeoffs: "One more thing to run." },
        { key: "file", label: "A file", explanation: "One file.", tradeoffs: "Concurrent edits are lost." },
      ],
      affects_requirements: [requirement],
    });
    decidePropose({ root, now: clock, file: proposal });
    const adr = payload(root, "reasoning");
    writeFileSync(adr, "Because concurrent edits matter.", "utf8");
    decideConfirm({ root, now: clock, id: "D001", choice: "relational", by: "user",
                    rationale: "Concurrent edits.", adrFile: adr });
    return { root, ids };
  }

  it("refuses to drop a requirement a locked decision depends on", () => {
    const { root } = lockedAgainst("REQ-001");
    const r = send(root, {
      scope: [{ requirement: "REQ-001", scope: "OUT_OF_SCOPE", reason: "not needed" }],
    });
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.error.code).toBe("CONFLICT");
      expect(r.error.message).toMatch(/D001/);
      expect(r.error.next).toMatch(/supersede/i);
    }
  });

  it("allows deferring that requirement to FUTURE", () => {
    const { root } = lockedAgainst("REQ-001");
    const r = send(root, {
      scope: [{ requirement: "REQ-001", scope: "FUTURE", reason: "version two" }],
    });
    expect(r.ok).toBe(true);
  });

  it("allows dropping a requirement no locked decision depends on", () => {
    const { root } = lockedAgainst("REQ-001");
    const r = send(root, {
      scope: [{ requirement: "REQ-002", scope: "OUT_OF_SCOPE", reason: "not needed" }],
    });
    expect(r.ok).toBe(true);
  });
});

describe("plan close", () => {
  /** Place every requirement in the MVP, give each a criterion, confirm it all. */
  function ready(titles?: string[]) {
    const { root, ids } = specified(titles);
    send(root, {
      personas: [{ name: "Store owner", description: "Runs one shop.", goals: ["Know the stock"] }],
    });
    send(root, {
      scope: ids.map((id) => ({ requirement: id, scope: "MVP", reason: "needed from day one" })),
      criteria: ids.map((id) => ({ requirement: id, kind: "PLAIN", text: `${id} behaves as agreed` })),
      use_cases: [{ title: "Keep stock right", persona: "PER-001", trigger: "A delivery arrives.",
                    steps: ["record it"], requirements: ids }],
    });
    send(root, { confirm: { scope: ids, by: "user" } });
    return { root, ids };
  }

  it("refuses while the specification is not confirmed", () => {
    const { root } = ready();
    const r = planClose({ root, now: clock });
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.error.code).toBe("CONFLICT");
      expect(r.error.message).toMatch(/confirm/i);
    }
  });

  it("refuses while a requirement has no agreed scope", () => {
    const { root, ids } = specified(["A", "B"]);
    send(root, { scope: [{ requirement: ids[0] as string, scope: "MVP", reason: "r" }],
                 criteria: [{ requirement: ids[0] as string, kind: "PLAIN", text: "t" }] });
    send(root, { confirm: { scope: [ids[0] as string], by: "user" }, confirm_specification: { by: "user" } });
    const r = planClose({ root, now: clock });
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.error.code).toBe("CONFLICT");
      expect(JSON.stringify(r.error.detail)).toMatch(/REQ-002/);
    }
  });

  it("refuses while an MVP requirement has no acceptance criterion", () => {
    const { root, ids } = specified(["A", "B"]);
    send(root, { scope: ids.map((id) => ({ requirement: id, scope: "MVP", reason: "r" })),
                 criteria: [{ requirement: ids[0] as string, kind: "PLAIN", text: "t" }] });
    send(root, { confirm: { scope: ids, by: "user" }, confirm_specification: { by: "user" } });
    const r = planClose({ root, now: clock });
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.error.code).toBe("CONFLICT");
      expect(JSON.stringify(r.error.detail)).toMatch(/REQ-002/);
    }
  });

  it("does not demand criteria for requirements outside the MVP", () => {
    const { root, ids } = specified(["A", "B"]);
    send(root, {
      scope: [{ requirement: ids[0] as string, scope: "MVP", reason: "r" },
              { requirement: ids[1] as string, scope: "FUTURE", reason: "later" }],
      criteria: [{ requirement: ids[0] as string, kind: "PLAIN", text: "t" }],
      personas: [{ name: "Owner", description: "d", goals: [] }],
    });
    send(root, { confirm: { scope: ids, by: "user" }, confirm_specification: { by: "user" } });
    const d = unwrap(planClose({ root, now: clock }));
    expect(d.mvp).toEqual([ids[0]]);
    expect(d.future).toEqual([ids[1]]);
  });

  it("writes the PRD and advances the project to ARCHITECTURE", () => {
    const { root, ids } = ready();
    send(root, { confirm_specification: { by: "user" } });
    const d = unwrap(planClose({ root, now: clock }));

    expect(d.stage).toBe("ARCHITECTURE");
    expect(d.artifacts).toContain("requirements/PRD.md");
    expect(existsSync(join(root, ".michi/requirements/PRD.md"))).toBe(true);
    expect(existsSync(join(root, ".michi/requirements/TRD.md"))).toBe(false);

    const state = readYaml(join(root, ".michi/state/state.yaml"), StateSchema);
    expect(state.stage).toBe("ARCHITECTURE");
    expect(spec(root).status).toBe("PUBLISHED");

    const prd = readFileSync(join(root, ".michi/requirements/PRD.md"), "utf8");
    for (const id of ids) expect(prd).toContain(id);
    expect(prd).toContain("Store owner");
    expect(prd).toMatch(/In the first version/i);
  });

  it("refuses to close twice", () => {
    const { root } = ready();
    send(root, { confirm_specification: { by: "user" } });
    planClose({ root, now: clock });
    const r = planClose({ root, now: clock });
    expect(r.ok).toBe(false);
  });
});

describe("plan export", () => {
  it("is stable even before a specification has ever been written", () => {
    // A read must not invent a timestamp: two reads of an untouched project
    // have to return the same bytes.
    const { root } = specified();
    const a = planExport({ root, now: clock });
    const b = planExport({ root, now: () => "2099-01-01T00:00:00.000Z" });
    expect(JSON.stringify(a)).toBe(JSON.stringify(b));
  });

  it("is read-only and stable", () => {
    const { root } = specified();
    send(root, { scope: [{ requirement: "REQ-001", scope: "MVP", reason: "r" }] });
    const before = readFileSync(join(root, ".michi/requirements/specification.yaml"), "utf8");
    const a = planExport({ root, now: clock });
    const b = planExport({ root, now: clock });
    expect(JSON.stringify(a)).toBe(JSON.stringify(b));
    expect(readFileSync(join(root, ".michi/requirements/specification.yaml"), "utf8")).toBe(before);
  });

  it("reports coverage gaps rather than hiding them", () => {
    const { root } = specified();
    send(root, { scope: [{ requirement: "REQ-001", scope: "MVP", reason: "r" }] });
    const d = unwrap(planExport({ root, now: clock }));
    expect(d.gaps.unplaced).toEqual(["REQ-002"]);
    expect(d.gaps.mvp_without_criteria).toEqual(["REQ-001"]);
    expect(d.gaps.unconfirmed_scope).toEqual(["REQ-001"]);
  });
});
