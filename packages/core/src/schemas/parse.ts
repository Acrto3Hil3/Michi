import type { z } from "zod";
import { MichiError } from "../errors.js";

/**
 * Parse a value into an entity, reporting failure as a validation error.
 *
 * `schema.parse()` throws a ZodError, which `MichiError.from` can only classify
 * as INTERNAL_ERROR — a bug, by definition. But a refinement firing here is not
 * a bug in MICHI; it is bad input that an earlier shape check did not cover.
 * Every entity construction in command code goes through this so the caller
 * gets exit 4 and a readable reason rather than exit 1 and a stack trace.
 */
export function parseOrInvalid<T>(
  schema: z.ZodType<T, z.ZodTypeDef, unknown>,
  value: unknown,
  what: string,
): T {
  const parsed = schema.safeParse(value);
  if (parsed.success) return parsed.data;
  const first = parsed.error.issues[0];
  throw new MichiError({
    class: "INVALID",
    code: "VALIDATION_ERROR",
    message: first
      ? `${what}: ${[...first.path, first.message].join(" ").trim()}`
      : `${what} is not valid.`,
    detail: {
      issues: parsed.error.issues.map((i) => ({ path: i.path.join("."), message: i.message })),
    },
  });
}
