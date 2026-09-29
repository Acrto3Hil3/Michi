import { describe, it, expect } from "vitest";
import {
  DecisionSchema, RegistrySchema, DECISION_STATES, newRegistry,
  nextDecisionId, nextAdrId, adrFileName,
} from "../src/schemas/decision.js";
import { NOW } from "./helpers.js";

const base = {
  id: "D001",
  title: "How people log in",
  type: "engineering",
  category: "authentication",
  options: [
    { key: "managed", label: "A login service", tradeoffs: "Costs money at scale." },
    { key: "passwords", label: "Email and password", tradeoffs: "You hold the passwords." },
  ],
  alternatives_rejected: [],
  consequences: [],
  affects_requirements: [],
  affects_components: [],
  supersedes: null,
  superseded_by: null,
  created_at: NOW,
  updated_at: NOW,
};

describe("decision lifecycle", () => {
  it("has the states from DECISION_MODEL.md", () => {
    expect(DECISION_STATES).toEqual([
      "PROPOSED", "USER_CONFIRMED", "LOCKED", "REJECTED", "SUPERSEDED",
    ]);
  });

  it("accepts a proposal with no choice, no approval and no ADR", () => {
    const d = { ...base, status: "PROPOSED", selected_option: null, rationale: null,
                approval: null, adr: null, adr_file: null };
    expect(() => DecisionSchema.parse(d)).not.toThrow();
  });

  it("REFUSES a locked decision with no approval", () => {
    const d = { ...base, status: "LOCKED", selected_option: "managed",
                rationale: "Least security-sensitive code.", approval: null,
                adr: "ADR-001", adr_file: "ADR-001-authentication.md" };
    expect(() => DecisionSchema.parse(d)).toThrow(/approval/i);
  });

  it("REFUSES a locked decision with no ADR", () => {
    const d = { ...base, status: "LOCKED", selected_option: "managed",
                rationale: "…", approval: { by: "user", at: NOW },
                adr: null, adr_file: null };
    expect(() => DecisionSchema.parse(d)).toThrow(/adr/i);
  });

  it("REFUSES a locked decision with no rationale", () => {
    const d = { ...base, status: "LOCKED", selected_option: "managed",
                rationale: null, approval: { by: "user", at: NOW },
                adr: "ADR-001", adr_file: "ADR-001-authentication.md" };
    expect(() => DecisionSchema.parse(d)).toThrow(/rationale/i);
  });

  it("REFUSES a selected option that is not one of the offered options", () => {
    const d = { ...base, status: "LOCKED", selected_option: "carrier-pigeon",
                rationale: "…", approval: { by: "user", at: NOW },
                adr: "ADR-001", adr_file: "ADR-001-authentication.md" };
    expect(() => DecisionSchema.parse(d)).toThrow(/option/i);
  });

  it("accepts a properly locked decision", () => {
    const d = { ...base, status: "LOCKED", selected_option: "managed",
                rationale: "Removes most of the ways we could get this wrong.",
                approval: { by: "user", at: NOW },
                adr: "ADR-001", adr_file: "ADR-001-authentication.md" };
    expect(() => DecisionSchema.parse(d)).not.toThrow();
  });
});

describe("decision and ADR identity (OQ-003)", () => {
  it("allocates decision ids and ADR ids from separate counters", () => {
    const r = newRegistry();
    expect(nextDecisionId(r)).toBe("D001");
    expect(nextAdrId(r)).toBe("ADR-001");
    expect(r.next_decision_id).toBe(1);
    expect(r.next_adr_id).toBe(1);
  });

  it("never derives one id from the other by string manipulation", () => {
    const r = { ...newRegistry(), next_decision_id: 5, next_adr_id: 2 };
    expect(nextDecisionId(r)).toBe("D005");
    expect(nextAdrId(r)).toBe("ADR-002");
  });

  it("names the ADR file from the ADR id and a slug of the title", () => {
    expect(adrFileName("ADR-004", "How people log in")).toBe("ADR-004-how-people-log-in.md");
  });

  it("validates a registry holding both proposed and locked decisions", () => {
    const r = newRegistry();
    r.decisions.push(
      { ...base, status: "PROPOSED", selected_option: null, rationale: null,
        approval: null, adr: null, adr_file: null },
    );
    expect(() => RegistrySchema.parse(r)).not.toThrow();
  });
});
