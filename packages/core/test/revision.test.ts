import { describe, it, expect } from "vitest";
import { writeFileSync, readFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import { tempProject, clock } from "./helpers.js";
import { init } from "../src/commands/init.js";
import { discoverStart, discoverAnswer, discoverClose } from "../src/commands/discover.js";
import { planStatus, planUpdate, planExport, planClose } from "../src/commands/plan.js";
import { readYaml } from "../src/fs/brain.js";
import { StateSchema } from "../src/schemas/state.js";
import { SpecificationSchema } from "../src/schemas/product.js";

const unwrap = <T,>(r: { ok: true; data: T } | { ok: false; error: unknown }): T => {
  if (!r.ok) throw new Error(`expected ok, got ${JSON.stringify(r.error)}`);
  return r.data;
};

let n = 0;
let t = 0;
// A monotonic clock that stays a valid timestamp however many ticks a test
// takes — a counter pasted into the minutes field runs past 59 and produces
// datetimes the schema rightly rejects.
const BASE = Date.parse("2026-10-02T09:00:00.000Z");
const tick = () => new Date(BASE + t++ * 60_000).toISOString();
const payload = (root: string, data: unknown): string => {
  const f = join(root, `r${n++}.json`);
  writeFileSync(f, JSON.stringify(data), "utf8");
  return f;
};
const plan = (root: string, update: object) =>
  planUpdate({ root, now: tick, file: payload(root, update) });
const discover = (root: string, update: object) =>
  discoverAnswer({ root, now: tick, file: payload(root, update) });

const draft = (title: string, extra: object = {}) => ({
  title, description: `${title} description.`, type: "functional", priority: "high",
  origin_confidence: "STATED", acceptance_criteria: ["agreed in words"], ...extra,
});

const spec = (root: string) =>
  readYaml(join(root, ".michi/requirements/specification.yaml"), SpecificationSchema);
const state = (root: string) => readYaml(join(root, ".michi/state/state.yaml"), StateSchema);

/** A project with a published specification: REQ-001 in the MVP, REQ-002 later. */
function published() {
  const root = tempProject({ "package.json": '{"name":"shop"}' });
  init({ root, now: tick });
  unwrap(discoverStart({ root, now: tick }));
  unwrap(discover(root, {
    intent: { problem: { value: "P", confidence: "STATED" }, goal: { value: "G", confidence: "STATED" } },
    requirements: [draft("Manage products"), draft("Warn before running out")],
  }));
  unwrap(discover(root, { confirm: { requirements: ["REQ-001", "REQ-002"], by: "user" }, confirm_intent: { by: "user" } }));
  unwrap(discoverClose({ root, now: tick }));
  unwrap(plan(root, { personas: [{ name: "Store owner", description: "Runs one shop.", goals: ["Know the stock"] }] }));
  unwrap(plan(root, {
    scope: [{ requirement: "REQ-001", scope: "MVP", reason: "nothing works without products" },
            { requirement: "REQ-002", scope: "FUTURE", reason: "only once counts are trusted" }],
    criteria: [{ requirement: "REQ-001", kind: "GWT", given: ["no products exist"],
                 when: "the owner adds one", then: ["it appears in the list"] }],
  }));
  unwrap(plan(root, { confirm: { scope: ["REQ-001", "REQ-002"], by: "user" }, confirm_specification: { by: "user" } }));
  unwrap(planClose({ root, now: tick }));
  return root;
}

const REASON = "The founder decided barcode scanning matters more than alerts.";

describe("revising a published specification", () => {
  it("refuses a change with no revision", () => {
    const root = published();
    const r = plan(root, { scope: [{ requirement: "REQ-002", scope: "MVP", reason: "wanted now" }] });
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.error.code).toBe("CONFLICT");
      expect(r.error.next).toMatch(/revision|reason/i);
    }
  });

  it("REFUSES a revision with nobody named", () => {
    const root = published();
    const r = plan(root, {
      revision: { reason: REASON },
      scope: [{ requirement: "REQ-002", scope: "MVP", reason: "wanted now" }],
    });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error.code).toBe("VALIDATION_ERROR");
  });

  it("REFUSES a one-word reason", () => {
    const root = published();
    const r = plan(root, {
      revision: { reason: "updated", by: "user" },
      scope: [{ requirement: "REQ-002", scope: "MVP", reason: "wanted now" }],
    });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error.code).toBe("VALIDATION_ERROR");
  });

  it("refuses a revision that changes nothing", () => {
    const root = published();
    const r = plan(root, { revision: { reason: REASON, by: "user" } });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error.message).toMatch(/nothing/i);
  });

  it("records the revision, and derives what changed rather than trusting a summary", () => {
    const root = published();
    const d = unwrap(plan(root, {
      revision: { reason: REASON, by: "user" },
      scope: [{ requirement: "REQ-002", scope: "MVP", reason: "the founder wants it now" }],
    }));
    expect(d.applied.revision).toBe("REV-001");

    const after = spec(root);
    expect(after.revisions).toHaveLength(1);
    const rev = after.revisions[0];
    expect(rev?.id).toBe("REV-001");
    expect(rev?.reason).toBe(REASON);
    expect(rev?.confirmed_by).toBe("user");
    expect(rev?.changes.join(" ")).toMatch(/REQ-002.*FUTURE.*MVP/);
  });

  it("returns the specification to DRAFT so the sign-off must be renewed", () => {
    const root = published();
    expect(spec(root).status).toBe("PUBLISHED");
    plan(root, {
      revision: { reason: REASON, by: "user" },
      scope: [{ requirement: "REQ-002", scope: "MVP", reason: "wanted now" }],
    });
    expect(spec(root).status).toBe("DRAFT");
    expect(spec(root).confirmed_by).toBeNull();
  });

  it("allocates revision ids project-wide and never reuses them", () => {
    const root = published();
    plan(root, { revision: { reason: REASON, by: "user" },
                 scope: [{ requirement: "REQ-002", scope: "MVP", reason: "wanted now" }] });
    plan(root, { confirm: { scope: ["REQ-002"], by: "user" }, confirm_specification: { by: "user" } });
    planClose({ root, now: tick });
    plan(root, { revision: { reason: "Second thoughts about what ships first.", by: "user" },
                 scope: [{ requirement: "REQ-002", scope: "FUTURE", reason: "back to later" }] });
    const ids = spec(root).revisions.map((r) => r.id);
    expect(ids).toEqual(["REV-001", "REV-002"]);
    expect(spec(root).next_revision_id).toBe(3);
  });

  it("does not need a revision while the specification is only a draft", () => {
    const root = tempProject({ "package.json": '{"name":"a"}' });
    init({ root, now: tick });
    discoverStart({ root, now: tick });
    discover(root, { requirements: [draft("A thing")] });
    discover(root, { confirm: { requirements: ["REQ-001"], by: "user" }, confirm_intent: { by: "user" } });
    discoverClose({ root, now: tick });
    const r = plan(root, { scope: [{ requirement: "REQ-001", scope: "MVP", reason: "needed" }] });
    expect(r.ok).toBe(true);
    expect(spec(root).revisions).toEqual([]);
  });
});

describe("publishing again", () => {
  it("re-runs the gates and writes nothing when they fail", () => {
    const root = published();
    plan(root, {
      revision: { reason: REASON, by: "user" },
      scope: [{ requirement: "REQ-002", scope: "MVP", reason: "wanted now" }],
    });
    plan(root, { confirm: { scope: ["REQ-002"], by: "user" }, confirm_specification: { by: "user" } });

    const before = readFileSync(join(root, ".michi/requirements/specification.yaml"), "utf8");
    const prdBefore = readFileSync(join(root, ".michi/requirements/PRD.md"), "utf8");

    // REQ-002 is now MVP but has no acceptance criterion.
    const r = planClose({ root, now: tick });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(JSON.stringify(r.error.detail)).toMatch(/REQ-002/);
    expect(readFileSync(join(root, ".michi/requirements/specification.yaml"), "utf8")).toBe(before);
    expect(readFileSync(join(root, ".michi/requirements/PRD.md"), "utf8")).toBe(prdBefore);
  });

  it("publishes again once the gates pass, recording the publication", () => {
    const root = published();
    plan(root, {
      revision: { reason: REASON, by: "user" },
      scope: [{ requirement: "REQ-002", scope: "MVP", reason: "the founder wants it now" }],
      criteria: [{ requirement: "REQ-002", kind: "PLAIN", text: "A warning appears below the chosen level." }],
    });
    plan(root, { confirm: { scope: ["REQ-002"], by: "user" }, confirm_specification: { by: "user" } });
    const d = unwrap(planClose({ root, now: tick }));

    expect(d.mvp.sort()).toEqual(["REQ-001", "REQ-002"]);
    const after = spec(root);
    expect(after.status).toBe("PUBLISHED");
    expect(after.publications).toHaveLength(2);
    expect(after.publications[1]?.revision).toBe("REV-001");
    expect(after.publications[0]?.mvp).toEqual(["REQ-001"]);
    expect(after.publications[1]?.mvp.sort()).toEqual(["REQ-001", "REQ-002"]);
    // The revision survives publication.
    expect(after.revisions).toHaveLength(1);
  });

  it("regenerates the PRD to the current specification", () => {
    const root = published();
    expect(readFileSync(join(root, ".michi/requirements/PRD.md"), "utf8")).toMatch(/## Later/);
    plan(root, {
      revision: { reason: REASON, by: "user" },
      scope: [{ requirement: "REQ-002", scope: "MVP", reason: "wanted now" }],
      criteria: [{ requirement: "REQ-002", kind: "PLAIN", text: "A warning appears." }],
    });
    plan(root, { confirm: { scope: ["REQ-002"], by: "user" }, confirm_specification: { by: "user" } });
    planClose({ root, now: tick });
    const prd = readFileSync(join(root, ".michi/requirements/PRD.md"), "utf8");
    expect(prd).toContain("Warn before running out");
    expect(prd).toMatch(/What changed/);
    expect(prd).toContain("REV-001");
    expect(existsSync(join(root, ".michi/requirements/PRD-v1.md"))).toBe(false);
  });
});

describe("removal leaves a tombstone", () => {
  function withArtifacts() {
    const root = published();
    plan(root, {
      revision: { reason: "Adding the workflow we missed in the first pass.", by: "user" },
      personas: [{ name: "Shop assistant", description: "Serves customers.", goals: [] }],
      use_cases: [{ title: "Record a sale", persona: "PER-002", trigger: "A customer buys.",
                    steps: ["find it", "record one sold"], requirements: ["REQ-001"] }],
      criteria: [{ requirement: "REQ-001", kind: "PLAIN", text: "A sale reduces the count." }],
    });
    return root;
  }

  it("REFUSES a removal with nobody named", () => {
    const root = withArtifacts();
    const r = plan(root, {
      revision: { reason: "The assistant does not touch stock after all.", by: "user" },
      remove: { personas: ["PER-002"], reason: "Not a real user." },
    });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error.code).toBe("VALIDATION_ERROR");
  });

  it("REFUSES a removal with no reason", () => {
    const root = withArtifacts();
    const r = plan(root, {
      revision: { reason: "The assistant does not touch stock after all.", by: "user" },
      remove: { personas: ["PER-002"], by: "user" },
    });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error.code).toBe("VALIDATION_ERROR");
  });

  it("keeps the record when a persona is removed", () => {
    const root = withArtifacts();
    const d = unwrap(plan(root, {
      revision: { reason: "The assistant turned out not to touch stock.", by: "user" },
      remove: { personas: ["PER-002"], by: "user", reason: "Does not touch stock." },
    }));
    expect(d.applied.removed).toEqual(["PER-002"]);
    const persona = spec(root).personas.find((p) => p.id === "PER-002");
    expect(persona).toBeDefined();
    expect(persona?.status).toBe("REMOVED");
    expect(persona?.removed_by).toBe("user");
    expect(persona?.removal_reason).toBe("Does not touch stock.");
  });

  it("keeps the record when a use case or criterion is removed", () => {
    const root = withArtifacts();
    unwrap(plan(root, {
      revision: { reason: "The counter workflow is not part of version one.", by: "user" },
      remove: { use_cases: ["UC-001"], criteria: ["AC-002"], by: "user", reason: "Deferred." },
    }));
    const after = spec(root);
    expect(after.use_cases.find((u) => u.id === "UC-001")?.status).toBe("REMOVED");
    expect(after.criteria.find((c) => c.id === "AC-002")?.status).toBe("REMOVED");
    // Still traceable to the requirement it belonged to.
    expect(after.criteria.find((c) => c.id === "AC-002")?.requirement).toBe("REQ-001");
  });

  it("a removed criterion no longer covers its requirement", () => {
    const root = published();
    expect(unwrap(planStatus({ root, now: tick })).gaps.mvp_without_criteria).toEqual([]);
    plan(root, {
      revision: { reason: "That criterion described the wrong behaviour.", by: "user" },
      remove: { criteria: ["AC-001"], by: "user", reason: "Described the wrong behaviour." },
    });
    expect(unwrap(planStatus({ root, now: tick })).gaps.mvp_without_criteria).toEqual(["REQ-001"]);
  });

  it("a removed persona cannot be used by a new use case", () => {
    const root = withArtifacts();
    plan(root, {
      revision: { reason: "The assistant turned out not to touch stock.", by: "user" },
      remove: { personas: ["PER-002"], by: "user", reason: "Does not touch stock." },
    });
    const r = plan(root, {
      revision: { reason: "Trying to add a workflow for a removed persona.", by: "user" },
      use_cases: [{ title: "T", persona: "PER-002", trigger: "t", steps: ["s"], requirements: ["REQ-001"] }],
    });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error.code).toBe("NOT_FOUND");
  });

  it("refuses to remove something that does not exist", () => {
    const root = published();
    const r = plan(root, {
      revision: { reason: "Trying to remove something imaginary.", by: "user" },
      remove: { criteria: ["AC-404"], by: "user", reason: "r" },
    });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error.code).toBe("NOT_FOUND");
  });

  it("removing an artifact does not change any requirement's scope", () => {
    const root = withArtifacts();
    const before = spec(root).scope.map((a) => `${a.requirement}:${a.scope}`);
    plan(root, {
      revision: { reason: "The counter workflow is not part of version one.", by: "user" },
      remove: { use_cases: ["UC-001"], by: "user", reason: "Deferred." },
    });
    expect(spec(root).scope.map((a) => `${a.requirement}:${a.scope}`)).toEqual(before);
  });
});

describe("the stage reflects readiness, not progress", () => {
  it("moves back when new requirements are confirmed after publication", () => {
    const root = published();
    expect(state(root).stage).toBe("ARCHITECTURE");

    discoverStart({ root, now: tick });
    discover(root, { requirements: [draft("Scan barcodes")] });
    discover(root, { confirm: { requirements: ["REQ-003"], by: "user" }, confirm_intent: { by: "user" } });
    discoverClose({ root, now: tick });

    const s = state(root);
    expect(s.stage).toBe("SPECIFICATION");
    expect(s.stage_reason).toMatch(/requirement/i);
    expect(s.needs_review).toContain("specification");
  });

  it("preserves the specification and the PRD when the stage moves back", () => {
    const root = published();
    const specBefore = readFileSync(join(root, ".michi/requirements/specification.yaml"), "utf8");
    const prdBefore = readFileSync(join(root, ".michi/requirements/PRD.md"), "utf8");

    discoverStart({ root, now: tick });
    discover(root, { requirements: [draft("Scan barcodes")] });
    discover(root, { confirm: { requirements: ["REQ-003"], by: "user" }, confirm_intent: { by: "user" } });
    discoverClose({ root, now: tick });

    expect(readFileSync(join(root, ".michi/requirements/specification.yaml"), "utf8")).toBe(specBefore);
    expect(readFileSync(join(root, ".michi/requirements/PRD.md"), "utf8")).toBe(prdBefore);
  });

  it("never claims architecture is next while a requirement is unplaced", () => {
    const root = published();
    discoverStart({ root, now: tick });
    discover(root, { requirements: [draft("Scan barcodes")] });
    discover(root, { confirm: { requirements: ["REQ-003"], by: "user" }, confirm_intent: { by: "user" } });
    discoverClose({ root, now: tick });

    const d = unwrap(planStatus({ root, now: tick }));
    expect(d.gaps.unplaced).toEqual(["REQ-003"]);
    expect(d.next_step).not.toMatch(/architecture comes next/i);
    expect(d.next_step).toMatch(/revis|place|scope/i);
  });

  it("the new requirement can be placed, and publication clears the review flag", () => {
    const root = published();
    discoverStart({ root, now: tick });
    discover(root, { requirements: [draft("Scan barcodes")] });
    discover(root, { confirm: { requirements: ["REQ-003"], by: "user" }, confirm_intent: { by: "user" } });
    discoverClose({ root, now: tick });

    const r = plan(root, {
      revision: { reason: "Barcode scanning was added after the first publication.", by: "user" },
      scope: [{ requirement: "REQ-003", scope: "FUTURE", reason: "after the counts are trusted" }],
    });
    expect(r.ok).toBe(true);
    plan(root, { confirm: { scope: ["REQ-003"], by: "user" }, confirm_specification: { by: "user" } });
    unwrap(planClose({ root, now: tick }));

    const s = state(root);
    expect(s.stage).toBe("ARCHITECTURE");
    expect(s.needs_review).not.toContain("specification");
  });

  it("a superseded requirement's scope call is history, not a broken reference", () => {
    const root = published();
    discoverStart({ root, now: tick });
    discover(root, { requirements: [draft("Warn per location", { supersedes: "REQ-002" })] });
    discover(root, { confirm: { requirements: ["REQ-003"], by: "user" }, confirm_intent: { by: "user" } });
    discoverClose({ root, now: tick });

    const d = unwrap(planStatus({ root, now: tick }));
    expect(d.gaps.dangling_references).toEqual([]);
    expect(d.gaps.unplaced).toEqual(["REQ-003"]);
  });
});

describe("reads stay deterministic", () => {
  it("status and export never mutate and never fabricate a timestamp", () => {
    const root = published();
    const before = readFileSync(join(root, ".michi/requirements/specification.yaml"), "utf8");
    const a = planStatus({ root, now: () => "2026-01-01T00:00:00.000Z" });
    const b = planExport({ root, now: () => "2099-12-31T23:59:59.000Z" });
    expect(JSON.stringify(a)).toBe(JSON.stringify(b));
    expect(readFileSync(join(root, ".michi/requirements/specification.yaml"), "utf8")).toBe(before);
  });
});
