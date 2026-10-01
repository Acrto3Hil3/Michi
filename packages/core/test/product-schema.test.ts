import { describe, it, expect } from "vitest";
import {
  SCOPE_VALUES, SPECIFICATION_STATES, PersonaSchema, UseCaseSchema,
  AcceptanceCriterionSchema, ScopeAssignmentSchema, OutOfScopeItemSchema,
  SpecificationSchema, newSpecification, personaId, useCaseId, criterionId,
  outOfScopeId, effectiveScope,
} from "../src/schemas/product.js";
import { NOW } from "./helpers.js";

describe("scope", () => {
  it("has exactly the four values from MICHI.md §76", () => {
    expect(SCOPE_VALUES).toEqual(["MVP", "FUTURE", "OUT_OF_SCOPE", "UNKNOWN"]);
  });

  it("treats a requirement with no assignment as UNKNOWN", () => {
    expect(effectiveScope([], "REQ-001")).toBe("UNKNOWN");
  });

  it("reads the assignment when there is one", () => {
    const a = ScopeAssignmentSchema.parse({
      requirement: "REQ-001", scope: "MVP", reason: "nothing works without it",
      status: "CONFIRMED", confirmed_by: "user", confirmed_at: NOW,
    });
    expect(effectiveScope([a], "REQ-001")).toBe("MVP");
  });

  it("REFUSES a confirmed scope call with nobody named", () => {
    expect(() => ScopeAssignmentSchema.parse({
      requirement: "REQ-001", scope: "MVP", reason: "r",
      status: "CONFIRMED", confirmed_by: null, confirmed_at: null,
    })).toThrow(/confirmed_by/i);
  });

  it("accepts a proposed scope call with nobody named yet", () => {
    expect(() => ScopeAssignmentSchema.parse({
      requirement: "REQ-001", scope: "FUTURE", reason: "r", status: "PROPOSED",
      confirmed_by: null, confirmed_at: null,
    })).not.toThrow();
  });

  it("keeps FUTURE and OUT_OF_SCOPE distinct", () => {
    expect(SCOPE_VALUES).toContain("FUTURE");
    expect(SCOPE_VALUES).toContain("OUT_OF_SCOPE");
  });
});

describe("acceptance criteria", () => {
  const base = { id: "AC-001", requirement: "REQ-001", created_at: NOW, updated_at: NOW };

  it("accepts a Given/When/Then criterion", () => {
    expect(() => AcceptanceCriterionSchema.parse({
      ...base, kind: "GWT", text: null,
      given: ["a product has 5 units in stock"],
      when: "1 unit is recorded as sold",
      then: ["the current stock shows 4 units"],
    })).not.toThrow();
  });

  it("REFUSES a GWT criterion missing its when", () => {
    expect(() => AcceptanceCriterionSchema.parse({
      ...base, kind: "GWT", text: null, given: ["g"], when: null, then: ["t"],
    })).toThrow(/when/i);
  });

  it("REFUSES a GWT criterion with no then", () => {
    expect(() => AcceptanceCriterionSchema.parse({
      ...base, kind: "GWT", text: null, given: ["g"], when: "w", then: [],
    })).toThrow(/then/i);
  });

  it("accepts a plain criterion, but requires its text", () => {
    expect(() => AcceptanceCriterionSchema.parse({
      ...base, kind: "PLAIN", text: "Unauthorised users cannot adjust stock.",
      given: [], when: null, then: [],
    })).not.toThrow();
    expect(() => AcceptanceCriterionSchema.parse({
      ...base, kind: "PLAIN", text: null, given: [], when: null, then: [],
    })).toThrow(/text/i);
  });

  it("always names the requirement it checks", () => {
    expect(() => AcceptanceCriterionSchema.parse({
      ...base, requirement: "not-a-requirement", kind: "PLAIN", text: "t",
      given: [], when: null, then: [],
    })).toThrow();
  });
});

describe("personas and use cases", () => {
  it("accepts a persona with goals", () => {
    expect(() => PersonaSchema.parse({
      id: "PER-001", name: "Store owner", description: "Runs one shop.",
      goals: ["Know what is on the shelf"], created_at: NOW, updated_at: NOW,
    })).not.toThrow();
  });

  it("requires a use case to have steps and at least one requirement", () => {
    const base = {
      id: "UC-001", title: "Correct a stock count", persona: "PER-001",
      trigger: "A delivery arrives.", created_at: NOW, updated_at: NOW,
    };
    expect(() => UseCaseSchema.parse({ ...base, steps: ["one"], requirements: ["REQ-001"] })).not.toThrow();
    expect(() => UseCaseSchema.parse({ ...base, steps: [], requirements: ["REQ-001"] })).toThrow();
    expect(() => UseCaseSchema.parse({ ...base, steps: ["one"], requirements: [] })).toThrow();
  });

  it("accepts an out-of-scope area that points at no requirement", () => {
    expect(() => OutOfScopeItemSchema.parse({
      id: "OOS-001", title: "Accounting", reason: "They use an accountant.",
      created_at: NOW, updated_at: NOW,
    })).not.toThrow();
  });
});

describe("the specification", () => {
  it("starts empty, in DRAFT, with every counter at one", () => {
    const spec = newSpecification(NOW);
    expect(() => SpecificationSchema.parse(spec)).not.toThrow();
    expect(spec.status).toBe("DRAFT");
    expect(spec.personas).toEqual([]);
    expect(spec.next_persona_id).toBe(1);
    expect(spec.next_criterion_id).toBe(1);
    expect(spec.confirmed_by).toBeNull();
  });

  it("has the three states", () => {
    expect(SPECIFICATION_STATES).toEqual(["DRAFT", "CONFIRMED", "PUBLISHED"]);
  });

  it("REFUSES a CONFIRMED specification with nobody named", () => {
    const spec: Record<string, unknown> = { ...newSpecification(NOW), status: "CONFIRMED" };
    expect(() => SpecificationSchema.parse(spec)).toThrow(/confirmed_by/i);
  });

  it("names ids from project-wide counters", () => {
    expect(personaId(1)).toBe("PER-001");
    expect(useCaseId(12)).toBe("UC-012");
    expect(criterionId(4)).toBe("AC-004");
    expect(outOfScopeId(2)).toBe("OOS-002");
  });
});
