import { z } from "zod";
import { SCHEMA_VERSION } from "./version.js";

/**
 * How sure we are, and why.
 *
 * DETECTED  the repository states it — a dependency, a config file, a lockfile
 * INFERRED  strongly implied by convention, but not stated anywhere
 * UNKNOWN   nothing in the repository establishes it
 *
 * MICHI.md §105 and P9: unknown stays unknown. A scanner that guesses
 * produces a project map nobody can trust, which is worse than a thin one.
 */
export const ConfidenceSchema = z.enum(["DETECTED", "INFERRED", "UNKNOWN"]);
export type Confidence = z.infer<typeof ConfidenceSchema>;

export const detectionSchema = <T extends z.ZodTypeAny>(value: T) =>
  z.object({
    value: value.nullable(),
    confidence: ConfidenceSchema,
    sources: z.array(z.string()),
    note: z.string().optional(),
  });

export interface Detection<T> {
  value: T | null;
  confidence: Confidence;
  sources: string[];
  note?: string;
}

export function detected<T>(value: T, sources: string[], note?: string): Detection<T> {
  return { value, confidence: "DETECTED", sources, ...(note ? { note } : {}) };
}

export function inferred<T>(value: T, sources: string[], note?: string): Detection<T> {
  return { value, confidence: "INFERRED", sources, ...(note ? { note } : {}) };
}

export function unknownDetection<T>(note?: string): Detection<T> {
  return { value: null, confidence: "UNKNOWN", sources: [], ...(note ? { note } : {}) };
}

const str = z.string().min(1);

export const DetectionsSchema = z.object({
  project_type: detectionSchema(str),
  languages: detectionSchema(z.array(str)),
  package_manager: detectionSchema(str),
  runtime: detectionSchema(str),
  frameworks: detectionSchema(z.array(str)),
  database: detectionSchema(str),
  orm: detectionSchema(str),
  test_framework: detectionSchema(str),
  deployment: detectionSchema(z.array(str)),
});

export const StructureSchema = z.object({
  directories: z.array(z.string()),
  config_files: z.array(z.string()),
  entry_points: z.array(z.string()),
});

export const ProjectMapSchema = z.object({
  schema_version: z.literal(SCHEMA_VERSION),
  generated_at: z.string().datetime(),
  detections: DetectionsSchema,
  structure: StructureSchema,
  stats: z.object({
    files_considered: z.number().int().nonnegative(),
  }),
});

export type ProjectMap = z.infer<typeof ProjectMapSchema>;
export type Detections = z.infer<typeof DetectionsSchema>;
