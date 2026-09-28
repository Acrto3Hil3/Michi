import { Command, CommanderError } from "commander";
import {
  ExitCode, IDENTITY, MichiError, errorPayload, exitCodeFor, init, scan, status,
} from "@michi/core";
import type { Result } from "@michi/core";
import { renderInit, renderScan, renderStatus } from "./render.js";

export interface Io {
  out(line: string): void;
  err(line: string): void;
}

export interface Env {
  cwd?: string;
  now?: () => string;
}

interface GlobalOpts {
  json?: boolean;
  quiet?: boolean;
  project?: string;
  dryRun?: boolean;
}

/**
 * In --json mode the whole envelope goes to stdout, success or failure: an
 * agent reads one stream, and splitting it across two is how integrations
 * start losing errors.
 */
function emit<T>(
  result: Result<T>,
  opts: GlobalOpts,
  io: Io,
  human: (data: T) => string[],
): number {
  if (opts.json) {
    io.out(JSON.stringify(result, null, 2));
    return result.ok ? ExitCode.SUCCESS : exitCodeFor(result.error.code);
  }
  if (!result.ok) {
    io.err(result.error.message);
    if (result.error.next) io.err(result.error.next);
    return exitCodeFor(result.error.code);
  }
  if (!opts.quiet) for (const line of human(result.data)) io.out(line);
  return ExitCode.SUCCESS;
}

export async function run(argv: string[], io: Io, env: Env = {}): Promise<number> {
  const now = env.now ?? (() => new Date().toISOString());
  const program = new Command();
  let code: number = ExitCode.SUCCESS;

  program
    .name(IDENTITY.binary)
    .description(
      `${IDENTITY.displayName} — the path from idea to software.\n\n` +
        `Turns what you want into engineering decisions your AI coding agent can follow.`,
    )
    .version(IDENTITY.version)
    .option("--json", "machine-readable output")
    .option("--quiet", "errors only")
    .option("--no-color", "disable coloured output")
    .option("--project <path>", "project root (default: the current folder)")
    .option("--dry-run", "show what would change and write nothing")
    .exitOverride()
    .configureOutput({
      writeOut: (s) => io.out(s.replace(/\n$/, "")),
      writeErr: (s) => io.err(s.replace(/\n$/, "")),
    });

  const root = (): string => program.opts<GlobalOpts>().project ?? env.cwd ?? process.cwd();
  const opts = (): GlobalOpts => program.opts<GlobalOpts>();

  program
    .command("init")
    .description("set MICHI up in this project")
    .option("--force", "restore missing MICHI files without overwriting anything")
    .action((local: { force?: boolean }) => {
      const g = opts();
      code = emit(
        init({
          root: root(),
          now,
          force: local.force ?? false,
          dryRun: g.dryRun ?? false,
        }),
        g,
        io,
        renderInit,
      );
    });

  program
    .command("scan")
    .description("look at the project and record what is actually there")
    .action(() => {
      code = emit(scan({ root: root(), now }), opts(), io, renderScan);
    });

  program
    .command("status")
    .description("where the project stands, and what needs you")
    .action(() => {
      code = emit(status({ root: root(), now }), opts(), io, renderStatus);
    });

  try {
    await program.parseAsync(argv, { from: "user" });
    return code;
  } catch (e) {
    if (e instanceof CommanderError) {
      // Help and version are a successful outcome, not a failure.
      if (e.exitCode === 0 || e.code === "commander.helpDisplayed" ||
          e.code === "commander.version") {
        return ExitCode.SUCCESS;
      }
      return ExitCode.USAGE_ERROR;
    }
    const err = MichiError.from(e);
    const payload = errorPayload(err);
    if (opts().json) io.out(JSON.stringify(payload, null, 2));
    else io.err(err.payload.message);
    return err.exitCode;
  }
}
