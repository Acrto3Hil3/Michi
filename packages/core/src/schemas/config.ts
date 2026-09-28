import { z } from "zod";
import { SCHEMA_VERSION } from "./version.js";

/** SECURITY_MODEL.md: the three policy settings. */
export const PolicySettingSchema = z.enum(["AUTO", "ASK", "BLOCK"]);
export type PolicySetting = z.infer<typeof PolicySettingSchema>;

export const PolicySchema = z.object({
  source_read: PolicySettingSchema,
  tests: PolicySettingSchema,
  git_diff: PolicySettingSchema,
  state_write: PolicySettingSchema,
  source_write: PolicySettingSchema,
  dependency_install: PolicySettingSchema,
  database_migration: PolicySettingSchema,
  infra_change: PolicySettingSchema,
  deployment: PolicySettingSchema,
  production_database_change: PolicySettingSchema,
  destructive: PolicySettingSchema,
  verification_execute: PolicySettingSchema,
});

/**
 * OQ-006: the allow-list of verification commands MICHI Core may run.
 *
 * Empty until the user fills it in. Phase 1 defines the shape; the executor
 * arrives in Phase 7. Commands are never inferred from the project.
 */
export const VerificationSchema = z.object({
  allow: z.record(z.string().min(1)),
  timeout_seconds: z.number().int().positive(),
  max_output_bytes: z.number().int().positive(),
});

export const ConfigSchema = z.object({
  schema_version: z.literal(SCHEMA_VERSION),
  michi_version: z.string().min(1),
  project: z.object({
    id: z.string().min(1),
    name: z.string().min(1),
  }),
  policy: PolicySchema,
  verification: VerificationSchema,
  created_at: z.string().datetime(),
  updated_at: z.string().datetime(),
});

export type MichiConfig = z.infer<typeof ConfigSchema>;

export function newConfig(input: {
  projectId: string;
  projectName: string;
  michiVersion?: string;
  now: string;
}): MichiConfig {
  return {
    schema_version: SCHEMA_VERSION,
    michi_version: input.michiVersion ?? "0.1.0",
    project: { id: input.projectId, name: input.projectName },
    policy: {
      source_read: "AUTO",
      tests: "AUTO",
      git_diff: "AUTO",
      state_write: "AUTO",
      source_write: "ASK",
      dependency_install: "ASK",
      database_migration: "ASK",
      infra_change: "ASK",
      deployment: "ASK",
      production_database_change: "BLOCK",
      destructive: "BLOCK",
      verification_execute: "AUTO",
    },
    verification: {
      allow: {},
      timeout_seconds: 300,
      max_output_bytes: 65536,
    },
    created_at: input.now,
    updated_at: input.now,
  };
}
