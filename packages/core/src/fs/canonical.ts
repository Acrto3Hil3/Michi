import { createHash } from "node:crypto";

/**
 * One canonicalisation function, used by every hash.
 *
 * CONTEXT_MODEL.md: a hash may only cover content that genuinely affects the
 * output. Unstable key order or an embedded timestamp turns a cache into a
 * random number generator, so keys are sorted and the caller strips anything
 * that varies between identical runs.
 */
export function canonicalJson(value: unknown): string {
  return JSON.stringify(sort(value));
}

function sort(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(sort);
  if (value && typeof value === "object") {
    const out: Record<string, unknown> = {};
    for (const key of Object.keys(value as Record<string, unknown>).sort()) {
      out[key] = sort((value as Record<string, unknown>)[key]);
    }
    return out;
  }
  return value;
}

export function hashOf(value: unknown): string {
  return "sha256:" + createHash("sha256").update(canonicalJson(value)).digest("hex");
}
