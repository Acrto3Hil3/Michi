import { z } from "zod";
import { SCHEMA_VERSION } from "./version.js";

/**
 * How we came to believe something.
 *
 * Core never promotes one level to another. An inferred answer that turns out
 * to be right is still inferred unless the human states it, because the record
 * has to answer "did they actually say that?" months later (P9).
 */
export const ConfidenceSchema = z.enum(["STATED", "INFERRED", "ASSUMED", "UNKNOWN"]);
export type DiscoveryConfidence = z.infer<typeof ConfidenceSchema>;

const jsonValue: z.ZodType<unknown> = z.lazy(() =>
  z.union([z.string(), z.number(), z.boolean(), z.null(), z.array(jsonValue), z.record(jsonValue)]),
);

export const IntentFieldSchema = z.object({
  value: jsonValue,
  confidence: ConfidenceSchema,
});
export type IntentField = z.infer<typeof IntentFieldSchema>;

export function unknownField(): IntentField {
  return { value: null, confidence: "UNKNOWN" };
}

/** MICHI.md §86 — the intent model, with uncertainty preserved per field. */
export const INTENT_FIELDS = [
  "problem", "goal", "users", "desired_outcome", "constraints", "assumptions",
] as const;
export type IntentFieldName = (typeof INTENT_FIELDS)[number];

export const IntentSchema = z.object({
  problem: IntentFieldSchema,
  goal: IntentFieldSchema,
  users: IntentFieldSchema,
  desired_outcome: IntentFieldSchema,
  constraints: IntentFieldSchema,
  assumptions: IntentFieldSchema,
});
export type Intent = z.infer<typeof IntentSchema>;

export const AnswerSchema = z.object({
  key: z.string().min(1),
  value: jsonValue,
  confidence: ConfidenceSchema,
  question: z.string().min(1),
  recorded_at: z.string().datetime(),
});
export type Answer = z.infer<typeof AnswerSchema>;

export const QuestionSchema = z.object({
  id: z.string().regex(/^Q-\d{3,}$/),
  text: z.string().min(1),
  why: z.string().min(1),
  asked_at: z.string().datetime(),
});
export type Question = z.infer<typeof QuestionSchema>;

/**
 * OQ-007: there is no delete. A requirement no longer wanted is superseded by
 * the one that replaces it, and both are kept — the rule decisions follow.
 */
export const REQUIREMENT_STATES = [
  "PROPOSED", "CONFIRMED", "REJECTED", "SUPERSEDED",
] as const;

/**
 * MICHI.md §98, with the status vocabulary made explicit.
 *
 * The refinement below is the most important rule in discovery: a requirement
 * cannot be CONFIRMED without naming the human who confirmed it. Without that,
 * an agent's inference becomes a project requirement by default, and every
 * downstream artifact inherits something nobody asked for.
 */
export const RequirementSchema = z
  .object({
    id: z.string().regex(/^REQ-\d{3,}$/),
    title: z.string().min(1),
    description: z.string().min(1),
    type: z.enum(["functional", "non_functional", "constraint"]),
    priority: z.enum(["high", "medium", "low"]),
    status: z.enum(REQUIREMENT_STATES),
    origin_confidence: ConfidenceSchema,
    acceptance_criteria: z.array(z.string().min(1)),
    confirmed_by: z.string().min(1).nullable().default(null),
    confirmed_at: z.string().datetime().nullable().default(null),
    /** The session that confirmed it, so the registry stays traceable. */
    confirmed_in: z.string().regex(/^SESSION-\d{3,}$/).nullable().default(null),
    rejected_reason: z.string().min(1).nullable().default(null),
    supersedes: z.string().regex(/^REQ-\d{3,}$/).nullable().default(null),
    superseded_by: z.string().regex(/^REQ-\d{3,}$/).nullable().default(null),
    created_at: z.string().datetime(),
    updated_at: z.string().datetime(),
  })
  .superRefine((r, ctx) => {
    if (r.status !== "CONFIRMED") return;
    if (!r.confirmed_by) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["confirmed_by"],
        message:
          "a CONFIRMED requirement must record confirmed_by — MICHI may not confirm its own inference",
      });
    }
    if (!r.confirmed_at) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["confirmed_at"],
        message: "a CONFIRMED requirement must record confirmed_at",
      });
    }
  });
export type Requirement = z.infer<typeof RequirementSchema>;

export const SESSION_STATES = [
  "STARTED", "GATHERING", "READY_FOR_CONFIRMATION", "CONFIRMED", "COMPLETED",
] as const;
export type SessionState = (typeof SESSION_STATES)[number];

export const SessionSchema = z
  .object({
    schema_version: z.literal(SCHEMA_VERSION),
    session_id: z.string().regex(/^SESSION-\d{3,}$/),
    status: z.enum(SESSION_STATES),
    opened_at: z.string().datetime(),
    updated_at: z.string().datetime(),
    closed_at: z.string().datetime().nullable(),
    intent: IntentSchema,
    answers: z.array(AnswerSchema),
    open_questions: z.array(QuestionSchema),
    requirements: z.array(RequirementSchema),
    next_question_number: z.number().int().nonnegative(),
    intent_confirmed_by: z.string().min(1).nullable(),
    intent_confirmed_at: z.string().datetime().nullable(),
  })
  .superRefine((s, ctx) => {
    const needsHuman = s.status === "CONFIRMED" || s.status === "COMPLETED";
    if (needsHuman && !s.intent_confirmed_by) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["intent_confirmed_by"],
        message:
          "a CONFIRMED session must record intent_confirmed_by — Core cannot confirm intent on the user's behalf",
      });
    }
  });
export type DiscoverySession = z.infer<typeof SessionSchema>;

export function newSession(input: { id: string; now: string }): DiscoverySession {
  return {
    schema_version: SCHEMA_VERSION,
    session_id: input.id,
    status: "STARTED",
    opened_at: input.now,
    updated_at: input.now,
    closed_at: null,
    intent: {
      problem: unknownField(),
      goal: unknownField(),
      users: unknownField(),
      desired_outcome: unknownField(),
      constraints: unknownField(),
      assumptions: unknownField(),
    },
    answers: [],
    open_questions: [],
    requirements: [],
    next_question_number: 1,
    intent_confirmed_by: null,
    intent_confirmed_at: null,
  };
}

/**
 * The project's requirement set, and the authority on id allocation (OQ-007).
 *
 * `next_requirement_id` is bumped the moment a requirement is *proposed*, not
 * when it is confirmed, so a rejected proposal still spends its number. That
 * is what makes an id safe to quote in conversation before anyone has agreed
 * to anything.
 */
export const RequirementsRegistrySchema = z.object({
  schema_version: z.literal(SCHEMA_VERSION),
  next_requirement_id: z.number().int().positive(),
  updated_at: z.string().datetime(),
  requirements: z.array(RequirementSchema),
});
export type RequirementsRegistry = z.infer<typeof RequirementsRegistrySchema>;

export function newRequirementsRegistry(now: string): RequirementsRegistry {
  return {
    schema_version: SCHEMA_VERSION,
    next_requirement_id: 1,
    updated_at: now,
    requirements: [],
  };
}

/** Project-wide, sequential, never reused. */
export function requirementId(next: number): string {
  return `REQ-${String(next).padStart(3, "0")}`;
}

/**
 * A requirement still in force: not rejected, not replaced by a later one.
 */
export function isActive(r: Requirement): boolean {
  return r.status === "CONFIRMED";
}

/**
 * Title comparison for conflict detection.
 *
 * Deliberately crude: case and punctuation are ignored, nothing else. It
 * catches the founder restating something already agreed, and will miss a
 * genuine duplicate worded differently. A guard, not a judgement.
 */
export function titleKey(title: string): string {
  return title.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
}

export function questionId(n: number): string {
  return `Q-${String(n).padStart(3, "0")}`;
}
