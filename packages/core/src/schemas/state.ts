import { z } from "zod";
import { SCHEMA_VERSION } from "./version.js";

/** STATE_MODEL.md — the ten project stages, in order. */
export const PROJECT_STAGES = [
  "DISCOVERY",
  "SPECIFICATION",
  "ARCHITECTURE",
  "DESIGN",
  "PLANNING",
  "IMPLEMENTATION",
  "VALIDATION",
  "REVIEW",
  "RELEASE",
  "OPERATIONS",
] as const;

export const ProjectStageSchema = z.enum(PROJECT_STAGES);
export type ProjectStage = z.infer<typeof ProjectStageSchema>;

/**
 * Counts are a cache so `michi status` is one file read. The records are
 * authoritative; `--recompute` rebuilds these and reports drift.
 */
export const CountsSchema = z.object({
  requirements: z.number().int().nonnegative(),
  decisions_locked: z.number().int().nonnegative(),
  decisions_open: z.number().int().nonnegative(),
  tasks_total: z.number().int().nonnegative(),
  tasks_done: z.number().int().nonnegative(),
  tasks_blocked: z.number().int().nonnegative(),
  tasks_verified: z.number().int().nonnegative(),
});

export const LastScanSchema = z.object({
  at: z.string().datetime(),
  project_map_hash: z.string().min(1),
});

export const StateSchema = z.object({
  schema_version: z.literal(SCHEMA_VERSION),
  project_id: z.string().min(1),
  stage: ProjectStageSchema,
  stage_entered_at: z.string().datetime(),
  /**
   * Why the stage is where it is — required reading when it moved backwards.
   * The stage is current readiness, never maximum historical progress.
   */
  stage_reason: z.string().min(1).nullable().default(null),
  /**
   * Artifacts that still exist but are no longer validated against the latest
   * upstream state. OQ-008: nothing is destroyed when the stage moves back; it
   * becomes identifiable as needing review.
   */
  needs_review: z.array(z.string().min(1)).default([]),
  initialized_at: z.string().datetime(),
  current_milestone: z.string().min(1).nullable(),
  active_task: z.string().min(1).nullable(),
  architecture_status: z.enum(["UNSET", "PROPOSED", "LOCKED"]),
  counts: CountsSchema,
  last_scan: LastScanSchema.nullable(),
  updated_at: z.string().datetime(),
});

export type ProjectState = z.infer<typeof StateSchema>;

export function newState(input: { projectId: string; now: string }): ProjectState {
  return {
    schema_version: SCHEMA_VERSION,
    project_id: input.projectId,
    stage: "DISCOVERY",
    stage_entered_at: input.now,
    stage_reason: null,
    needs_review: [],
    initialized_at: input.now,
    current_milestone: null,
    active_task: null,
    architecture_status: "UNSET",
    counts: {
      requirements: 0,
      decisions_locked: 0,
      decisions_open: 0,
      tasks_total: 0,
      tasks_done: 0,
      tasks_blocked: 0,
      tasks_verified: 0,
    },
    last_scan: null,
    updated_at: input.now,
  };
}
