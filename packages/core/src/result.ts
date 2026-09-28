/**
 * The internal result contract.
 *
 * Designed before either renderer, per Phase 1.6: commands return a typed
 * result, and human text and JSON are both projections of it. Neither
 * rendering may carry information the other cannot.
 */
import type { ErrorPayload } from "./errors.js";

export interface Ok<T> {
  ok: true;
  data: T;
}

export interface Err {
  ok: false;
  error: ErrorPayload;
}

export type Result<T> = Ok<T> | Err;

export function ok<T>(data: T): Ok<T> {
  return { ok: true, data };
}
