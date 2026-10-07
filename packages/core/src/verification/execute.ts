import { spawnSync } from "node:child_process";
import { join } from "node:path";
import { MichiError, errorPayload } from "../errors.js";
import type { Result } from "../result.js";
import { ok } from "../result.js";
import { CONFIG_FILE, brainDir, readYaml } from "../fs/brain.js";
import { ConfigSchema } from "../schemas/config.js";
import type { Evidence } from "../schemas/task.js";
import { requireInitialized } from "../commands/scan.js";

/**
 * The allow-listed verification executor.
 *
 * This is the **only** place MICHI Core runs anything in the user's project
 * (OQ-006), and everything about it is deliberately narrow.
 *
 * A command runs if and only if the user wrote it into `verification.allow` in
 * their own config file. There is no parameter for a command string — the
 * caller passes a *key*, and the signature is the enforcement: nothing read
 * from the project can become something executed. Not a `package.json` script,
 * not a README, not an agent's report. Those are data.
 *
 * The command is run through a shell because that is what the user wrote, and
 * MICHI cannot police what a shell command does once started. That is exactly
 * why the allow-list is an explicit written choice rather than anything MICHI
 * infers — the user authorised this specific string, once, in a file they can
 * read.
 */

export interface RunAllowedOptions {
  root: string;
  now: () => string;
  /** A key in `verification.allow`. Never a command. */
  key: string;
}

export interface RunAllowedData {
  /** Always `produced_by: MICHI`, with the full process record. */
  evidence: Evidence;
  passed: boolean;
}

/** Conventional keys map to the evidence kinds STATE_MODEL names. */
const KINDS: Record<string, Evidence["kind"]> = {
  test: "TESTS",
  tests: "TESTS",
  lint: "LINT",
  typecheck: "TYPECHECK",
  types: "TYPECHECK",
  build: "BUILD",
  security: "SECURITY",
};

export function runAllowed(options: RunAllowedOptions): Result<RunAllowedData> {
  try {
    const { root, now, key } = options;
    requireInitialized(root);
    const config = readYaml(join(brainDir(root), CONFIG_FILE), ConfigSchema);

    if (config.policy.verification_execute === "BLOCK") {
      throw new MichiError({
        class: "BLOCKED",
        code: "PERMISSION_DENIED",
        message: "This project's policy blocks MICHI from running verification commands.",
        detail: { policy: config.policy.verification_execute },
        next: "Change `policy.verification_execute` in .michi/config.yaml if that is wrong.",
      });
    }

    const command = config.verification.allow[key];
    if (!command) {
      const known = Object.keys(config.verification.allow).sort();
      throw new MichiError({
        class: "BLOCKED",
        code: "PERMISSION_DENIED",
        message:
          known.length === 0
            ? `MICHI will not run anything: this project's verification allow-list is empty, so "${key}" is not authorised.`
            : `"${key}" is not in this project's verification allow-list.`,
        detail: { requested: key, allowed: known },
        next:
          `Add it under \`verification.allow\` in .michi/config.yaml — for example ` +
          `\`${key}: pnpm test\`. MICHI never infers a command from your project.`,
      });
    }

    const startedAt = now();
    const cap = config.verification.max_output_bytes;
    const result = spawnSync(command, {
      cwd: root,
      shell: true,
      timeout: config.verification.timeout_seconds * 1000,
      encoding: "utf8",
      maxBuffer: Math.max(cap * 4, 1_048_576),
    });
    const endedAt = now();

    const raw = `${result.stdout ?? ""}${result.stderr ?? ""}`.trim();
    const timedOut = result.error !== undefined && /ETIMEDOUT|timed? ?out/i.test(String(result.error));
    const body = timedOut
      ? `Timed out after ${config.verification.timeout_seconds}s and was killed.\n${raw}`.trim()
      : result.error
        ? `${String(result.error)}\n${raw}`.trim()
        : raw;

    const truncated = body.length > cap;
    // A failure to launch is still an observation: record it, do not throw.
    const exitCode = result.status ?? (timedOut || result.error ? 124 : null);

    return ok({
      evidence: {
        kind: KINDS[key] ?? "RUNTIME",
        produced_by: "MICHI",
        summary: null,
        verdict: null,
        by: null,
        allow_key: key,
        command,
        cwd: ".",
        started_at: startedAt,
        ended_at: endedAt,
        exit_code: exitCode,
        output_summary: truncated ? `${body.slice(0, cap)}\n… output truncated` : body,
        output_truncated: truncated,
      },
      passed: exitCode === 0,
    });
  } catch (e) {
    return errorPayload(MichiError.from(e));
  }
}
