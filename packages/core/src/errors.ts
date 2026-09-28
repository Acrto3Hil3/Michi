/**
 * Errors and exit codes.
 *
 * The numeric exit codes are the ones fixed by docs/specs/CLI_CONTRACT.md.
 * Error *codes* are the precise channel and several may share one exit code —
 * an exit code is a coarse signal for a shell, the payload is for an agent.
 */

export const ExitCode = {
  SUCCESS: 0,
  INTERNAL_ERROR: 1,
  USAGE_ERROR: 2,
  NOT_INITIALIZED: 3,
  VALIDATION_ERROR: 4,
  BLOCKED: 5,
  PERMISSION_DENIED: 6,
  CONFLICT: 7,
  NOT_FOUND: 8,
} as const;

export type ExitCodeValue = (typeof ExitCode)[keyof typeof ExitCode];

/** Uncertainty classes from MICHI.md §104. */
export type ErrorClass =
  | "UNKNOWN"
  | "AMBIGUOUS"
  | "INVALID"
  | "BLOCKED"
  | "UNSUPPORTED"
  | "FAILED";

export type ErrorCode =
  | "USAGE_ERROR"
  | "NOT_INITIALIZED"
  | "ALREADY_INITIALIZED"
  | "VALIDATION_ERROR"
  | "CONFLICT"
  | "EXECUTION_ERROR"
  | "INTERNAL_ERROR"
  | "NOT_FOUND"
  | "PERMISSION_DENIED"
  | "BLOCKED";

const EXIT_BY_CODE: Record<ErrorCode, ExitCodeValue> = {
  USAGE_ERROR: ExitCode.USAGE_ERROR,
  NOT_INITIALIZED: ExitCode.NOT_INITIALIZED,
  ALREADY_INITIALIZED: ExitCode.CONFLICT,
  VALIDATION_ERROR: ExitCode.VALIDATION_ERROR,
  CONFLICT: ExitCode.CONFLICT,
  EXECUTION_ERROR: ExitCode.INTERNAL_ERROR,
  INTERNAL_ERROR: ExitCode.INTERNAL_ERROR,
  NOT_FOUND: ExitCode.NOT_FOUND,
  PERMISSION_DENIED: ExitCode.PERMISSION_DENIED,
  BLOCKED: ExitCode.BLOCKED,
};

export function exitCodeFor(code: ErrorCode): ExitCodeValue {
  return EXIT_BY_CODE[code];
}

export interface ErrorPayload {
  class: ErrorClass;
  code: ErrorCode;
  message: string;
  detail?: Record<string, unknown>;
  next?: string;
}

export class MichiError extends Error {
  readonly payload: ErrorPayload;

  constructor(payload: ErrorPayload) {
    super(payload.message);
    this.name = "MichiError";
    this.payload = payload;
  }

  get exitCode(): ExitCodeValue {
    return exitCodeFor(this.payload.code);
  }

  /** Never let an unexpected throwable escape untyped. */
  static from(thrown: unknown): MichiError {
    if (thrown instanceof MichiError) return thrown;
    const message = thrown instanceof Error ? thrown.message : String(thrown);
    return new MichiError({
      class: "FAILED",
      code: "INTERNAL_ERROR",
      message,
    });
  }
}

export function errorPayload(e: MichiError): { ok: false; error: ErrorPayload } {
  const { class: cls, code, message, detail, next } = e.payload;
  return {
    ok: false,
    error: {
      class: cls,
      code,
      message,
      ...(detail === undefined ? {} : { detail }),
      ...(next === undefined ? {} : { next }),
    },
  };
}
