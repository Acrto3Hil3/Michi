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

export const REQUIREMENT_STATES = ["PROPOSED", "CONFIRMED", "REJECTED"] as const;

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
    rejected_reason: z.string().min(1).nullable().default(null),
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

const num = (id: string): number => Number(id.slice(id.lastIndexOf("-") + 1));

/** Sequential and never reused, including for rejected requirements. */
export function nextRequirementId(existing: string[]): string {
  const highest = existing.reduce((max, id) => Math.max(max, num(id)), 0);
  return `REQ-${String(highest + 1).padStart(3, "0")}`;
}

export function questionId(n: number): string {
  return `Q-${String(n).padStart(3, "0")}`;
}
