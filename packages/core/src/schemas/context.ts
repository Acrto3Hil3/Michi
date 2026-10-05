import { z } from "zod";

/** CONTEXT_MODEL.md's inclusion tiers. */
export const CONTEXT_TIERS = ["MUST_INCLUDE", "PREFERRED", "OPTIONAL", "EXCLUDED"] as const;
export const TierSchema = z.enum(CONTEXT_TIERS);
export type ContextTier = z.infer<typeof TierSchema>;

/**
 * A context request.
 *
 * Structured, never prose: the skill decides what the user is trying to do,
 * Core resolves which canonical artifacts answer it. The focus is a
 * requirement today; a task focus arrives when tasks do.
 */
export const ContextRequestSchema = z
  .object({
    focus: z.object({
      type: z.literal("requirement"),
      id: z.string().regex(/^REQ-\d{3,}$/),
    }),
    budget_tokens: z.number().int().positive().optional(),
    /** Pulled in even where the graph would not reach them. */
    include: z.array(z.string().min(1)).default([]),
    /** Deliberately withheld, and recorded as such. */
    exclude: z.array(z.string().min(1)).default([]),
  })
  .strict();
export type ContextRequest = z.infer<typeof ContextRequestSchema>;

export interface ContextItem {
  id: string;
  type: string;
  tier: ContextTier;
  /** Why this is here, in words a person can check. */
  reason: string;
  /** Deterministic score; higher is closer to the target. */
  rank: number;
  estimated_tokens: number;
  content: string;
  /** OQ-009: a locked decision a later change has called into question. */
  needs_review?: boolean;
  review_reason?: string | null;
}

export interface ContextPacket {
  packet_id: string;
  generated_at: string;
  focus: ContextRequest["focus"];
  project: {
    name: string;
    constraints: string[];
    detected: Record<string, string | null>;
  };
  items: ContextItem[];
  excluded: { id: string; reason: string }[];
  dropped_for_budget: string[];
  revisions: { id: string; reason: string; changes: string[] }[];
  warnings: string[];
  budget_tokens: number | null;
  estimated_tokens: number;
  estimation_method: "chars/4";
  input_hash: string;
  state_hash: string;
  context_hash: string;
}
