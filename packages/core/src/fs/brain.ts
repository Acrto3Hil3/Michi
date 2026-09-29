import { existsSync, mkdirSync, readFileSync, renameSync, statSync, writeFileSync, rmSync } from "node:fs";
import { dirname, join, basename } from "node:path";
import { randomBytes } from "node:crypto";
import { parse as parseYaml, stringify as stringifyYaml } from "yaml";
import type { ZodType, ZodTypeDef } from "zod";

/**
 * A schema read from an unknown blob on disk.
 *
 * Pinning Input to `unknown` makes TypeScript infer T from the schema's
 * *output*. Without it, a schema using `.default()` infers its input type,
 * where defaulted fields are optional — and every caller then sees a type
 * that does not match what parsing actually returns.
 */
type Reader<T> = ZodType<T, ZodTypeDef, unknown>;
import { MichiError } from "../errors.js";

/** OQ-001: the project-state directory is `.michi/`. */
export const BRAIN = ".michi";

/** STATE_MODEL.md — the project brain's directory tree. */
export const BRAIN_DIRS = [
  "project",
  "requirements",
  "architecture",
  "architecture/diagrams",
  "decisions",
  "graph",
  "tasks",
  "tasks/active",
  "tasks/completed",
  "context",
  "context/packets",
  "context/summaries",
  "sessions",
  "state",
] as const;

export function brainDir(root: string): string {
  return join(root, BRAIN);
}

export function isInitialized(root: string): boolean {
  return existsSync(brainDir(root));
}

export const CONFIG_FILE = "config.yaml";
export const STATE_FILE = join("state", "state.yaml");
export const MAP_FILE = join("project", "map.json");

/**
 * Write atomically: a partially written state file is worse than no state
 * file, because it looks readable.
 */
function atomicWrite(file: string, contents: string): void {
  mkdirSync(dirname(file), { recursive: true });
  const tmp = join(dirname(file), `.${basename(file)}.${randomBytes(6).toString("hex")}.tmp`);
  try {
    writeFileSync(tmp, contents, "utf8");
    renameSync(tmp, file);
  } catch (e) {
    rmSync(tmp, { force: true });
    throw MichiError.from(e);
  }
}

export function writeYaml(file: string, data: unknown): void {
  atomicWrite(file, stringifyYaml(data, { lineWidth: 0 }));
}

export function writeJson(file: string, data: unknown): void {
  atomicWrite(file, JSON.stringify(data, null, 2) + "\n");
}

export function writeText(file: string, contents: string): void {
  atomicWrite(file, contents);
}

function readText(file: string): string {
  if (!existsSync(file)) {
    throw new MichiError({
      class: "UNKNOWN",
      code: "NOT_FOUND",
      message: `${basename(file)} does not exist.`,
      detail: { file },
    });
  }
  try {
    return readFileSync(file, "utf8");
  } catch (e) {
    throw MichiError.from(e);
  }
}

function validate<T>(file: string, raw: unknown, schema: Reader<T>): T {
  const parsed = schema.safeParse(raw);
  if (!parsed.success) {
    throw new MichiError({
      class: "INVALID",
      code: "VALIDATION_ERROR",
      message: `${basename(file)} does not match the schema MICHI expects.`,
      detail: {
        file,
        issues: parsed.error.issues.map((i) => ({
          path: i.path.join("."),
          message: i.message,
        })),
      },
      next: "Fix the file by hand, or restore it from git.",
    });
  }
  return parsed.data;
}

export function readYaml<T>(file: string, schema: Reader<T>): T {
  const text = readText(file);
  let raw: unknown;
  try {
    raw = parseYaml(text);
  } catch (e) {
    throw new MichiError({
      class: "INVALID",
      code: "VALIDATION_ERROR",
      message: `${basename(file)} is not valid YAML.`,
      detail: { file, reason: e instanceof Error ? e.message : String(e) },
      next: "Fix the file by hand, or restore it from git.",
    });
  }
  return validate(file, raw, schema);
}

export function readJson<T>(file: string, schema: Reader<T>): T {
  const text = readText(file);
  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch (e) {
    throw new MichiError({
      class: "INVALID",
      code: "VALIDATION_ERROR",
      message: `${basename(file)} is not valid JSON.`,
      detail: { file, reason: e instanceof Error ? e.message : String(e) },
      next: "Fix the file by hand, or restore it from git.",
    });
  }
  return validate(file, raw, schema);
}

export function isDirectory(path: string): boolean {
  try {
    return statSync(path).isDirectory();
  } catch {
    return false;
  }
}

export function ensureDirs(root: string): void {
  for (const d of BRAIN_DIRS) mkdirSync(join(brainDir(root), d), { recursive: true });
}
