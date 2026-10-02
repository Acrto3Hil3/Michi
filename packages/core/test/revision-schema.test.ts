import { describe, it, expect } from "vitest";
import {
  RevisionSchema, PublicationSchema, SpecificationSchema, PersonaSchema,
  UseCaseSchema, AcceptanceCriterionSchema, newSpecification, revisionId,
  isLive, ARTIFACT_STATES, SCOPE_VALUES,
} from "../src/schemas/product.js";
import { StateSchema, newState } from "../src/schemas/state.js";
import { NOW } from "./helpers.js";

describe("revisions", () => {
  const base = {
    id: "REV-001",
    reason: "The founder decided alerts were not worth having before counts are trusted.",
    confirmed_by: "user",
    created_at: NOW,
    changes: ["REQ-005 moved from MVP to FUTURE"],
  };

  it("accepts a revision that records what, why, who and when", () => {
    expect(() => RevisionSchema.parse(base)).not.toThrow();
  });

  it("REFUSES a revision with no reason", () => {
    expect(() => RevisionSchema.parse({ ...base, reason: "" })).toThrow();
  });

  it("REFUSES a one-word reason — structure, not prose quality", () => {
    expect(() => RevisionSchema.parse({ ...base, reason: "updated" })).toThrow();
  });

  it("REFUSES a revision that records no change", () => {
    expect(() => RevisionSchema.parse({ ...base, changes: [] })).toThrow();
  });

  it("REFUSES a revision with nobody named", () => {
    expect(() => RevisionSchema.parse({ ...base, confirmed_by: "" })).toThrow();
  });

  it("names revision ids from a project-wide counter", () => {
    expect(revisionId(1)).toBe("REV-001");
    expect(revisionId(13)).toBe("REV-013");
  });
});

describe("publications", () => {
  it("records the scope as it stood at that publication", () => {
    expect(() => PublicationSchema.parse({
      at: NOW, confirmed_by: "user", revision: null,
      mvp: ["REQ-001"], future: ["REQ-002"], out_of_scope: [],
    })).not.toThrow();
  });

  it("can name the revision it published", () => {
    const p = PublicationSchema.parse({
      at: NOW, confirmed_by: "user", revision: "REV-001",
      mvp: [], future: [], out_of_scope: [],
    });
    expect(p.revision).toBe("REV-001");
  });
});

describe("product artifacts are never hard-deleted", () => {
  it("has exactly two artifact states", () => {
    expect(ARTIFACT_STATES).toEqual(["ACTIVE", "REMOVED"]);
  });

  it("REMOVED is not a scope value — FUTURE and REMOVED mean different things", () => {
    expect(SCOPE_VALUES).not.toContain("REMOVED");
    expect(SCOPE_VALUES).toEqual(["MVP", "FUTURE", "OUT_OF_SCOPE", "UNKNOWN"]);
  });

  const persona = {
    id: "PER-001", name: "Store owner", description: "Runs one shop.", goals: [],
    created_at: NOW, updated_at: NOW,
  };

  it("accepts an active artifact with no removal fields", () => {
    expect(() => PersonaSchema.parse({ ...persona, status: "ACTIVE" })).not.toThrow();
  });

  it("REFUSES a removed artifact with nobody named", () => {
    expect(() => PersonaSchema.parse({
      ...persona, status: "REMOVED", removed_by: null, removed_at: NOW,
      removal_reason: "Not a real user after all.",
    })).toThrow(/removed_by/i);
  });

  it("REFUSES a removed artifact with no reason", () => {
    expect(() => PersonaSchema.parse({
      ...persona, status: "REMOVED", removed_by: "user", removed_at: NOW, removal_reason: null,
    })).toThrow(/reason/i);
  });

  it("accepts a properly tombstoned artifact", () => {
    expect(() => PersonaSchema.parse({
      ...persona, status: "REMOVED", removed_by: "user", removed_at: NOW,
      removal_reason: "The assistant turned out not to touch stock.",
    })).not.toThrow();
  });

  it("applies the same rule to use cases and criteria", () => {
    expect(() => UseCaseSchema.parse({
      id: "UC-001", title: "T", persona: "PER-001", trigger: "t", steps: ["s"],
      requirements: ["REQ-001"], status: "REMOVED", removed_by: null, removed_at: NOW,
      removal_reason: "r", created_at: NOW, updated_at: NOW,
    })).toThrow(/removed_by/i);

    expect(() => AcceptanceCriterionSchema.parse({
      id: "AC-001", requirement: "REQ-001", kind: "PLAIN", text: "t",
      given: [], when: null, then: [], status: "REMOVED", removed_by: null,
      removed_at: NOW, removal_reason: "r", created_at: NOW, updated_at: NOW,
    })).toThrow(/removed_by/i);
  });

  it("knows which artifacts are still live", () => {
    const active = PersonaSchema.parse({ ...persona, status: "ACTIVE" });
    const removed = PersonaSchema.parse({
      ...persona, status: "REMOVED", removed_by: "user", removed_at: NOW, removal_reason: "r",
    });
    expect(isLive(active)).toBe(true);
    expect(isLive(removed)).toBe(false);
  });
});

describe("the specification carries its own history", () => {
  it("starts with no revisions and no publications", () => {
    const spec = newSpecification(NOW);
    expect(() => SpecificationSchema.parse(spec)).not.toThrow();
    expect(spec.revisions).toEqual([]);
    expect(spec.publications).toEqual([]);
    expect(spec.next_revision_id).toBe(1);
  });
});

describe("project state records readiness, not high-water progress", () => {
  it("can say why the stage is where it is", () => {
    const s = newState({ projectId: "p", now: NOW });
    expect(s.stage_reason).toBeNull();
    expect(() => StateSchema.parse({
      ...s, stage: "SPECIFICATION",
      stage_reason: "New requirements were confirmed after architecture began.",
    })).not.toThrow();
  });

  it("can list artifacts that are no longer validated against the latest specification", () => {
    const s = newState({ projectId: "p", now: NOW });
    expect(s.needs_review).toEqual([]);
    expect(() => StateSchema.parse({ ...s, needs_review: ["specification"] })).not.toThrow();
  });
});
