import { execFile } from "node:child_process";
import { existsSync } from "node:fs";
import { join } from "node:path";

/**
 * Everything the extension knows about MICHI, which is: how to run the CLI
 * and how to read its `--json`.
 *
 * The extension is a thin client on purpose. It does not know which coding
 * agents exist, what a requirement is, or when something is ready — it asks
 * the CLI and renders the answer. Anything it decided for itself would be a
 * second implementation to keep in step, and the first thing to go stale.
 */

export interface Envelope<T> {
  ok: boolean;
  data?: T;
  error?: { code: string; message: string; next?: string };
}

export interface RunResult<T> {
  ok: boolean;
  data?: T;
  /** Why it failed, already in plain language — the CLI writes these. */
  message?: string;
  next?: string;
  /** True when the michi binary could not be found at all. */
  missing?: boolean;
}

export type Exec = (
  file: string,
  args: string[],
  options: { cwd: string; env?: Record<string, string> },
) => Promise<{ stdout: string; stderr: string; code: number }>;

export const nodeExec: Exec = (file, args, options) =>
  new Promise((resolve) => {
    execFile(file, args, {
      cwd: options.cwd,
      maxBuffer: 8 * 1024 * 1024,
      ...(options.env ? { env: { ...process.env, ...options.env } } : {}),
    },
      (error, stdout, stderr) => {
        const code = error && typeof (error as { code?: unknown }).code === "number"
          ? (error as unknown as { code: number }).code
          : error ? 127 : 0;
        resolve({ stdout, stderr, code });
      });
  });

const NOT_INSTALLED = /ENOENT|not found|not recognized/i;

/**
 * Run a michi command and read its envelope.
 *
 * `--json` puts the whole envelope on stdout whether it succeeded or not, so
 * there is one stream to read and a failure never arrives as an empty result.
 */
export async function michi<T>(
  exec: Exec,
  cli: { command: string; args: readonly string[]; env?: Readonly<Record<string, string>> },
  cwd: string,
  args: string[],
): Promise<RunResult<T>> {
  let out: { stdout: string; stderr: string; code: number };
  try {
    out = await exec(cli.command, [...cli.args, ...args, "--json"], {
      cwd, ...(cli.env ? { env: { ...cli.env } } : {}),
    });
  } catch (e) {
    return { ok: false, missing: true, message: e instanceof Error ? e.message : String(e) };
  }

  if (out.code === 127 || (out.stdout === "" && NOT_INSTALLED.test(out.stderr))) {
    return {
      ok: false,
      missing: true,
      message: `MICHI is not installed, or not on this machine's PATH.`,
      next: `Install it with: npm install -g @dev-subhash/michi`,
    };
  }

  // `--version` answers with a bare version string rather than an envelope.
  // Treating that as a parse failure would report a working CLI as broken.
  if (args[0] === "--version") {
    const version = out.stdout.trim();
    return version
      ? { ok: true, data: version as unknown as T }
      : { ok: false, message: "michi --version printed nothing." };
  }

  let envelope: Envelope<T>;
  try {
    envelope = JSON.parse(out.stdout) as Envelope<T>;
  } catch {
    // A command that printed something other than JSON is a bug, not a user
    // error. Say what happened rather than showing an empty panel.
    return {
      ok: false,
      message: `michi ${args.join(" ")} did not return JSON.`,
      next: out.stderr.trim() || out.stdout.trim() || undefined,
    };
  }

  if (envelope.ok) return { ok: true, ...(envelope.data !== undefined ? { data: envelope.data } : {}) };
  return {
    ok: false,
    ...(envelope.error?.message ? { message: envelope.error.message } : {}),
    ...(envelope.error?.next ? { next: envelope.error.next } : {}),
  };
}

/** Has MICHI been set up in this folder? Cheap enough to call on every event. */
export function isSetUp(folder: string): boolean {
  return existsSync(join(folder, ".michi", "config.yaml"));
}

// ---------------------------------------------------------------------------
// the shapes the extension reads back
// ---------------------------------------------------------------------------

export interface StatusData {
  project: { name: string };
  stage: string;
  needs_you: string[];
}

export interface AgentRow {
  id: string;
  name: string;
  present: boolean;
  evidence: string[];
  writes: string[];
  runs_commands: boolean | null;
}

/** What the status bar says, in as few characters as a status bar deserves. */
export function statusBarText(status: StatusData | undefined): string {
  if (!status) return "$(circle-slash) MICHI";
  const waiting = status.needs_you.length;
  return waiting > 0
    ? `$(bell) MICHI: ${waiting} need${waiting === 1 ? "s" : ""} you`
    : `$(check) MICHI: ${status.stage.toLowerCase()}`;
}

/**
 * Which agents to offer, best first.
 *
 * Detected ones come first because that is almost always the answer, but
 * every adapter stays on the list: detection proposes, the user decides
 * (AGENT_ADAPTER_MODEL.md), and an extension that hid the others would be
 * deciding.
 */
export function agentChoices(agents: AgentRow[]): AgentRow[] {
  const rank = (a: AgentRow) => (a.present && a.id !== "manual" ? 0 : a.id === "manual" ? 2 : 1);
  return [...agents].sort((a, b) => rank(a) - rank(b) || a.id.localeCompare(b.id));
}

/** One line under each agent in the picker. */
export function agentDetail(agent: AgentRow): string {
  const parts: string[] = [];
  if (agent.present && agent.evidence.length > 0 && agent.id !== "manual") {
    parts.push(`found: ${agent.evidence.join(", ")}`);
  }
  parts.push(agent.writes.length === 1 ? `writes ${agent.writes[0]}` : `writes ${agent.writes.length} files`);
  if (agent.runs_commands === null) parts.push("MICHI cannot tell whether it runs commands");
  return parts.join(" · ");
}
