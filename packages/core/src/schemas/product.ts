import { z } from "zod";
import { SCHEMA_VERSION } from "./version.js";

/**
 * The product specification.
 *
 * It answers what we are building first, for whom, and how we will know it
 * works. It **references** requirements and never copies them: Phase 2 owns
 * the requirement store, and there is exactly one.
 */

const REQ = z.string().regex(/^REQ-\d{3,}$/);
const timestamps = {
  created_at: z.string().datetime(),
  updated_at: z.string().datetime(),
};

/** MICHI.md §76. */
export const SCOPE_VALUES = ["MVP", "FUTURE", "OUT_OF_SCOPE", "UNKNOWN"] as const;
export const ScopeSchema = z.enum(SCOPE_VALUES);
export type Scope = z.infer<typeof ScopeSchema>;

export const PersonaSchema = z.object({
  id: z.string().regex(/^PER-\d{3,}$/),
  name: z.string().min(1),
  description: z.string().min(1),
  goals: z.array(z.string().min(1)),
  ...timestamps,
});
export type Persona = z.infer<typeof PersonaSchema>;

export const UseCaseSchema = z.object({
  id: z.string().regex(/^UC-\d{3,}$/),
  title: z.string().min(1),
  persona: z.string().regex(/^PER-\d{3,}$/),
  trigger: z.string().min(1),
  steps: z.array(z.string().min(1)).min(1, "a use case with no steps describes nothing"),
  /** A use case that satisfies no requirement is scope creep (§76). */
  requirements: z.array(REQ).min(1, "a use case must serve at least one requirement"),
  ...timestamps,
});
export type UseCase = z.infer<typeof UseCaseSchema>;

/**
 * How a requirement will be checked.
 *
 * Distinct from the requirement's own `acceptance_criteria`, which are the
 * user's words for what was agreed. This is the testable form a later phase
 * can execute — `MICHI.md` §50's `AC-*`.
 */
export const AcceptanceCriterionSchema = z
  .object({
    id: z.string().regex(/^AC-\d{3,}$/),
    requirement: REQ,
    kind: z.enum(["GWT", "PLAIN"]),
    given: z.array(z.string().min(1)).default([]),
    when: z.string().min(1).nullable().default(null),
    then: z.array(z.string().min(1)).default([]),
    text: z.string().min(1).nullable().default(null),
    ...timestamps,
  })
  .superRefine((c, ctx) => {
    const fail = (path: string, message: string) =>
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: [path], message });

    if (c.kind === "GWT") {
      if (c.given.length === 0) fail("given", "a Given/When/Then criterion needs at least one given");
      if (!c.when) fail("when", "a Given/When/Then criterion needs a when");
      if (c.then.length === 0) fail("then", "a Given/When/Then criterion needs at least one then");
    } else if (!c.text) {
      fail("text", "a plain criterion needs its text");
    }
  });
export type AcceptanceCriterion = z.infer<typeof AcceptanceCriterionSchema>;

/**
 * Whether a requirement ships in the first version.
 *
 * The most consequential product call a founder makes, so MICHI may not make
 * it for them: a CONFIRMED assignment with no human named fails validation
 * (P2).
 */
export const ScopeAssignmentSchema = z
  .object({
    requirement: REQ,
    scope: ScopeSchema,
    reason: z.string().min(1),
    status: z.enum(["PROPOSED", "CONFIRMED"]),
    confirmed_by: z.string().min(1).nullable().default(null),
    confirmed_at: z.string().datetime().nullable().default(null),
  })
  .superRefine((a, ctx) => {
    if (a.status !== "CONFIRMED") return;
    if (!a.confirmed_by) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["confirmed_by"],
        message: "a CONFIRMED scope call must record confirmed_by — MICHI may not decide what ships",
      });
    }
    if (!a.confirmed_at) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom, path: ["confirmed_at"],
        message: "a CONFIRMED scope call must record confirmed_at",
      });
    }
  });
export type ScopeAssignment = z.infer<typeof ScopeAssignmentSchema>;

/** A whole area the product deliberately will not cover. Points at no requirement. */
export const OutOfScopeItemSchema = z.object({
  id: z.string().regex(/^OOS-\d{3,}$/),
  title: z.string().min(1),
  reason: z.string().min(1),
  ...timestamps,
});
export type OutOfScopeItem = z.infer<typeof OutOfScopeItemSchema>;

export const SPECIFICATION_STATES = ["DRAFT", "CONFIRMED", "PUBLISHED"] as const;

export const SpecificationSchema = z
  .object({
    schema_version: z.literal(SCHEMA_VERSION),
    status: z.enum(SPECIFICATION_STATES),
    next_persona_id: z.number().int().positive(),
    next_use_case_id: z.number().int().positive(),
    next_criterion_id: z.number().int().positive(),
    next_out_of_scope_id: z.number().int().positive(),
    personas: z.array(PersonaSchema),
    use_cases: z.array(UseCaseSchema),
    criteria: z.array(AcceptanceCriterionSchema),
    scope: z.array(ScopeAssignmentSchema),
    out_of_scope: z.array(OutOfScopeItemSchema),
    confirmed_by: z.string().min(1).nullable(),
    confirmed_at: z.string().datetime().nullable(),
    updated_at: z.string().datetime(),
  })
  .superRefine((s, ctx) => {
    if (s.status === "DRAFT") return;
    if (!s.confirmed_by) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["confirmed_by"],
        message:
          "a CONFIRMED specification must record confirmed_by — Core cannot sign off a specification",
      });
    }
  });
export type ProductSpecification = z.infer<typeof SpecificationSchema>;

export function newSpecification(now: string): ProductSpecification {
  return {
    schema_version: SCHEMA_VERSION,
    status: "DRAFT",
    next_persona_id: 1,
    next_use_case_id: 1,
    next_criterion_id: 1,
    next_out_of_scope_id: 1,
    personas: [],
    use_cases: [],
    criteria: [],
    scope: [],
    out_of_scope: [],
    confirmed_by: null,
    confirmed_at: null,
    updated_at: now,
  };
}

const pad = (n: number) => String(n).padStart(3, "0");
export const personaId = (n: number): string => `PER-${pad(n)}`;
export const useCaseId = (n: number): string => `UC-${pad(n)}`;
export const criterionId = (n: number): string => `AC-${pad(n)}`;
export const outOfScopeId = (n: number): string => `OOS-${pad(n)}`;

/** A requirement nobody has placed is UNKNOWN, not implicitly in the MVP. */
export function effectiveScope(assignments: ScopeAssignment[], requirement: string): Scope {
  return assignments.find((a) => a.requirement === requirement)?.scope ?? "UNKNOWN";
}

export function scopeAssignment(
  assignments: ScopeAssignment[],
  requirement: string,
): ScopeAssignment | undefined {
  return assignments.find((a) => a.requirement === requirement);
}
