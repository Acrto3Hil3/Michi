import { describe, it, expect } from "vitest";
import { MichiError, ExitCode, exitCodeFor, errorPayload } from "../src/errors.js";

describe("exit codes", () => {
  it("uses the numeric mapping from CLI_CONTRACT.md", () => {
    expect(ExitCode.SUCCESS).toBe(0);
    expect(ExitCode.INTERNAL_ERROR).toBe(1);
    expect(ExitCode.USAGE_ERROR).toBe(2);
    expect(ExitCode.NOT_INITIALIZED).toBe(3);
    expect(ExitCode.VALIDATION_ERROR).toBe(4);
    expect(ExitCode.BLOCKED).toBe(5);
    expect(ExitCode.PERMISSION_DENIED).toBe(6);
    expect(ExitCode.CONFLICT).toBe(7);
    expect(ExitCode.NOT_FOUND).toBe(8);
  });

  it("maps every error code to a contract exit code", () => {
    expect(exitCodeFor("USAGE_ERROR")).toBe(2);
    expect(exitCodeFor("NOT_INITIALIZED")).toBe(3);
    expect(exitCodeFor("ALREADY_INITIALIZED")).toBe(7);
    expect(exitCodeFor("VALIDATION_ERROR")).toBe(4);
    expect(exitCodeFor("CONFLICT")).toBe(7);
    expect(exitCodeFor("EXECUTION_ERROR")).toBe(1);
    expect(exitCodeFor("INTERNAL_ERROR")).toBe(1);
    expect(exitCodeFor("NOT_FOUND")).toBe(8);
    expect(exitCodeFor("PERMISSION_DENIED")).toBe(6);
    expect(exitCodeFor("BLOCKED")).toBe(5);
  });
});

describe("MichiError", () => {
  it("carries class, code, message and a next step", () => {
    const e = new MichiError({
      class: "BLOCKED",
      code: "NOT_INITIALIZED",
      message: "No MICHI project here.",
      next: "Run: michi init",
    });
    expect(e.exitCode).toBe(3);
    expect(e.payload.class).toBe("BLOCKED");
    expect(e.payload.next).toBe("Run: michi init");
  });

  it("serialises to the documented error envelope", () => {
    const e = new MichiError({
      class: "INVALID",
      code: "VALIDATION_ERROR",
      message: "state.yaml failed validation.",
      detail: { file: "state/state.yaml" },
    });
    expect(errorPayload(e)).toEqual({
      ok: false,
      error: {
        class: "INVALID",
        code: "VALIDATION_ERROR",
        message: "state.yaml failed validation.",
        detail: { file: "state/state.yaml" },
      },
    });
  });

  it("wraps an unknown throwable as INTERNAL_ERROR without losing the message", () => {
    const e = MichiError.from(new Error("disk on fire"));
    expect(e.exitCode).toBe(1);
    expect(e.payload.code).toBe("INTERNAL_ERROR");
    expect(e.payload.message).toContain("disk on fire");
  });

  it("passes a MichiError through unchanged", () => {
    const original = new MichiError({ class: "INVALID", code: "USAGE_ERROR", message: "bad" });
    expect(MichiError.from(original)).toBe(original);
  });
});
