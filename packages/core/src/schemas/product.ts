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

/**
 * A product artifact is never physically deleted once persisted.
 *
 * OQ-008, locked 2026-10-02. If a persona, use case or criterion stops
 * applying, the user removes it explicitly and it becomes a tombstone: the
 * record stays, with who removed it, when and why. The engineering history of
 * a product includes the parts that were taken out, and why.
 *
 * REMOVED is an artifact lifecycle state. It is **not** a scope value: FUTURE
 * means "we want this later", REMOVED means "this was in the specification and
 * the user took it out". Conflating them loses the distinction that matters.
 */
export const ARTIFACT_STATES = ["ACTIVE", "REMOVED"] as const;
export const ArtifactStateSchema = z.enum(ARTIFACT_STATES);
export type ArtifactState = z.infer<typeof ArtifactStateSchema>;

const removable = {
  /** Active unless explicitly removed — so nothing has to opt in to existing. */
  status: ArtifactStateSchema.default("ACTIVE"),
  removed_by: z.string().min(1).nullable().default(null),
  removed_at: z.string().datetime().nullable().default(null),
  removal_reason: z.string().min(1).nullable().default(null),
};

interface Removable {
  status: ArtifactState;
  removed_by: string | null;
  removed_at: string | null;
  removal_reason: string | null;
}

/** A removal must be attributable, like every other consequential act (P2). */
function checkRemoval(a: Removable, ctx: z.RefinementCtx): void {
  if (a.status !== "REMOVED") return;
  const fail = (path: string, message: string) =>
    ctx.addIssue({ code: z.ZodIssueCode.custom, path: [path], message });
  if (!a.removed_by) fail("removed_by", "a REMOVED artifact must record removed_by — nothing is taken out anonymously");
  if (!a.removed_at) fail("removed_at", "a REMOVED artifact must record removed_at");
  if (!a.removal_reason) fail("removal_reason", "a REMOVED artifact must record why it was removed");
}

export function isLive(artifact: { status: ArtifactState }): boolean {
  return artifact.status === "ACTIVE";
}

export const PersonaSchema = z.object({
  id: z.string().regex(/^PER-\d{3,}$/),
  name: z.string().min(1),
  description: z.string().min(1),
  goals: z.array(z.string().min(1)),
  ...removable,
  ...timestamps,
}).superRefine(checkRemoval);
export type Persona = z.infer<typeof PersonaSchema>;

export const UseCaseSchema = z.object({
  id: z.string().regex(/^UC-\d{3,}$/),
  title: z.string().min(1),
  persona: z.string().regex(/^PER-\d{3,}$/),
  trigger: z.string().min(1),
  steps: z.array(z.string().min(1)).min(1, "a use case with no steps describes nothing"),
  /** A use case that satisfies no requirement is scope creep (§76). */
  requirements: z.array(REQ).min(1, "a use case must serve at least one requirement"),
  ...removable,
  ...timestamps,
}).superRefine(checkRemoval);
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
    ...removable,
    ...timestamps,
  })
  .superRefine((c, ctx) => {
    checkRemoval(c, ctx);
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

/**
 * How a published specification changed.
 *
 * OQ-008 chose cumulative-with-revisions over document versioning: one
 * specification that keeps evolving, with a durable record of each change to
 * an already-published one. The specification is the current state; the
 * revisions explain how it got there.
 *
 * Core checks that a reason exists and is a sentence rather than a word. It
 * does not judge prose quality — that belongs to the skill, which can read the
 * room.
 */
export const RevisionSchema = z.object({
  id: z.string().regex(/^REV-\d{3,}$/),
  reason: z.string().min(10, "a revision needs a real reason, not a word"),
  confirmed_by: z.string().min(1),
  created_at: z.string().datetime(),
  changes: z.array(z.string().min(1)).min(1, "a revision that changed nothing is not a revision"),
});
export type Revision = z.infer<typeof RevisionSchema>;

/** What was published, when, and by whose sign-off. */
export const PublicationSchema = z.object({
  at: z.string().datetime(),
  confirmed_by: z.string().min(1),
  revision: z.string().regex(/^REV-\d{3,}$/).nullable().default(null),
  mvp: z.array(REQ),
  future: z.array(REQ),
  out_of_scope: z.array(REQ),
});
export type Publication = z.infer<typeof PublicationSchema>;

export const SPECIFICATION_STATES = ["DRAFT", "CONFIRMED", "PUBLISHED"] as const;

export const SpecificationSchema = z
  .object({
    schema_version: z.literal(SCHEMA_VERSION),
    status: z.enum(SPECIFICATION_STATES),
    next_persona_id: z.number().int().positive(),
    next_use_case_id: z.number().int().positive(),
    next_criterion_id: z.number().int().positive(),
    next_out_of_scope_id: z.number().int().positive(),
    next_revision_id: z.number().int().positive(),
    personas: z.array(PersonaSchema),
    use_cases: z.array(UseCaseSchema),
    criteria: z.array(AcceptanceCriterionSchema),
    scope: z.array(ScopeAssignmentSchema),
    out_of_scope: z.array(OutOfScopeItemSchema),
    revisions: z.array(RevisionSchema),
    publications: z.array(PublicationSchema),
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
    next_revision_id: 1,
    personas: [],
    use_cases: [],
    criteria: [],
    scope: [],
    out_of_scope: [],
    revisions: [],
    publications: [],
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
export const revisionId = (n: number): string => `REV-${pad(n)}`;

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
