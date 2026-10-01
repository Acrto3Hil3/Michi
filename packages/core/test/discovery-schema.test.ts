import { describe, it, expect } from "vitest";
import {
  ConfidenceSchema, RequirementSchema, SessionSchema, IntentSchema,
  RequirementsRegistrySchema, newSession, newRequirementsRegistry,
  SESSION_STATES, REQUIREMENT_STATES, requirementId, isActive, titleKey,
  unknownField,
} from "../src/schemas/discovery.js";
import { NOW } from "./helpers.js";

const baseReq = {
  id: "REQ-001",
  title: "Manage products",
  description: "A store owner can add, edit and retire products.",
  type: "functional",
  priority: "high",
  origin_confidence: "STATED",
  acceptance_criteria: ["A store owner can add a product"],
  created_at: NOW,
  updated_at: NOW,
};

describe("confidence", () => {
  it("has exactly the four levels from STATE_MODEL.md", () => {
    expect(ConfidenceSchema.options).toEqual(["STATED", "INFERRED", "ASSUMED", "UNKNOWN"]);
  });

  it("represents something unestablished as UNKNOWN with no value", () => {
    const f = unknownField();
    expect(f.confidence).toBe("UNKNOWN");
    expect(f.value).toBeNull();
  });
});

describe("requirement status", () => {
  it("accepts a proposed requirement with no confirmation", () => {
    const r = { ...baseReq, status: "PROPOSED", confirmed_by: null, confirmed_at: null };
    expect(() => RequirementSchema.parse(r)).not.toThrow();
  });

  it("REFUSES a confirmed requirement with nobody named as confirming it", () => {
    const r = { ...baseReq, status: "CONFIRMED", confirmed_by: null, confirmed_at: null };
    expect(() => RequirementSchema.parse(r)).toThrow(/confirmed_by/i);
  });

  it("accepts a confirmed requirement that names the human and the moment", () => {
    const r = { ...baseReq, status: "CONFIRMED", confirmed_by: "user", confirmed_at: NOW };
    expect(() => RequirementSchema.parse(r)).not.toThrow();
  });

  it("keeps origin_confidence separate from status — an inferred requirement can be confirmed", () => {
    const r = {
      ...baseReq, origin_confidence: "INFERRED", status: "CONFIRMED",
      confirmed_by: "user", confirmed_at: NOW,
    };
    const parsed = RequirementSchema.parse(r);
    expect(parsed.origin_confidence).toBe("INFERRED");
    expect(parsed.status).toBe("CONFIRMED");
  });

  it("rejects a status outside the vocabulary", () => {
    expect(() => RequirementSchema.parse({ ...baseReq, status: "APPROVED-ISH" })).toThrow();
  });

  it("has SUPERSEDED, because there is no delete (OQ-007)", () => {
    expect(REQUIREMENT_STATES).toEqual(["PROPOSED", "CONFIRMED", "REJECTED", "SUPERSEDED"]);
  });

  it("counts only confirmed requirements as still in force", () => {
    const of = (status: string) => ({ ...baseReq, status, confirmed_by: "user", confirmed_at: NOW });
    expect(isActive(RequirementSchema.parse(of("CONFIRMED")))).toBe(true);
    expect(isActive(RequirementSchema.parse(of("SUPERSEDED")))).toBe(false);
    expect(isActive(RequirementSchema.parse({ ...baseReq, status: "PROPOSED" }))).toBe(false);
    expect(isActive(RequirementSchema.parse({ ...baseReq, status: "REJECTED" }))).toBe(false);
  });

  it("names ids from a project-wide counter, not by scanning a session", () => {
    expect(requirementId(1)).toBe("REQ-001");
    expect(requirementId(8)).toBe("REQ-008");
    expect(requirementId(142)).toBe("REQ-142");
  });

  it("starts the project counter at one and validates the registry", () => {
    const r = newRequirementsRegistry(NOW);
    expect(r.next_requirement_id).toBe(1);
    expect(() => RequirementsRegistrySchema.parse(r)).not.toThrow();
  });

  it("compares titles for conflicts ignoring case and punctuation only", () => {
    expect(titleKey("Manage Products!")).toBe(titleKey("manage  products"));
    expect(titleKey("Manage products")).not.toBe(titleKey("Manage stock"));
  });
});

describe("intent", () => {
  it("keeps every field's confidence, defaulting to unknown", () => {
    const s = newSession({ id: "SESSION-001", now: NOW });
    expect(IntentSchema.parse(s.intent).problem.confidence).toBe("UNKNOWN");
    expect(s.intent.constraints.value).toBeNull();
  });
});

describe("session", () => {
  it("has exactly the five lifecycle states", () => {
    expect(SESSION_STATES).toEqual([
      "STARTED", "GATHERING", "READY_FOR_CONFIRMATION", "CONFIRMED", "COMPLETED",
    ]);
  });

  it("starts empty and STARTED", () => {
    const s = newSession({ id: "SESSION-001", now: NOW });
    expect(() => SessionSchema.parse(s)).not.toThrow();
    expect(s.status).toBe("STARTED");
    expect(s.answers).toEqual([]);
    expect(s.requirements).toEqual([]);
    expect(s.intent_confirmed_by).toBeNull();
    expect(s.closed_at).toBeNull();
  });

  it("REFUSES a CONFIRMED session with nobody named as confirming the intent", () => {
    const s: any = newSession({ id: "SESSION-001", now: NOW });
    s.status = "CONFIRMED";
    expect(() => SessionSchema.parse(s)).toThrow(/intent_confirmed_by/i);
  });
});
