import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { MichiError, errorPayload, isInitialized, ok } from "@subhashyadav98146/michi-core";
import type { Result } from "@subhashyadav98146/michi-core";
import {
  ADAPTERS, adapterFor, detectAll, loadSkills, reconcile,
} from "@subhashyadav98146/michi-adapters";
import type { DetectionResult, InstallOutcome, PlannedFile } from "@subhashyadav98146/michi-adapters";
import { basename } from "node:path";

/**
 * Installing agent integration files.
 *
 * The adapters decide *what* should be written; this decides nothing about any
 * agent and does the writing, which is where the permission policy lives
 * (SECURITY_MODEL.md: one checkpoint, not twelve).
 */

export interface AgentsData {
  detected: string[];
  agents: {
    id: string;
    name: string;
    present: boolean;
    evidence: string[];
    writes: string[];
    runs_commands: boolean | null;
    native_skills: boolean;
  }[];
}

function projectName(root: string): string {
  try {
    const pkg = join(root, "package.json");
    if (existsSync(pkg)) {
      const parsed: unknown = JSON.parse(readFileSync(pkg, "utf8"));
      const name = (parsed as { name?: unknown }).name;
      if (typeof name === "string" && name.length > 0) return name;
    }
  } catch {
    // An unreadable package.json is not a reason to refuse to install.
  }
  return basename(root) || "this project";
}

function started(root: string): void {
  if (!isInitialized(root)) {
    throw new MichiError({
      class: "INVALID", code: "NOT_INITIALIZED",
      message: "MICHI is not set up in this project yet.",
      next: "Run michi init first.",
    });
  }
}

export function agents(options: { root: string }): Promise<Result<AgentsData>> {
  const { root } = options;
  return (async () => {
    try {
      const skills = loadSkills();
      const found: DetectionResult[] = await detectAll(root);
      return ok({
        detected: found.filter((d) => d.present && d.id !== "manual").map((d) => d.id),
        agents: found.map((d) => {
          const adapter = adapterFor(d.id);
          return {
            id: d.id,
            name: d.displayName,
            present: d.present,
            evidence: [...d.evidence],
            writes: adapter
              .installPlan({ projectRoot: root, projectName: projectName(root), skills })
              .files.map((f) => f.path),
            runs_commands: adapter.capabilities.runs_commands,
            native_skills: adapter.capabilities.native_skills,
          };
        }),
      });
    } catch (e) {
      return errorPayload(MichiError.from(e));
    }
  })();
}

export interface InstallData {
  agents: string[];
  dry_run: boolean;
  written: string[];
  unchanged: string[];
  would_write: string[];
  conflicts: { path: string; diff: string[] }[];
  notes: string[];
}

/**
 * Deduplicate across adapters: two agents both wanting `AGENTS.md` is normal,
 * and the baseline is identical by construction, so the first one wins and the
 * file is written once.
 */
function merge(plans: readonly { files: readonly PlannedFile[] }[]): PlannedFile[] {
  const byPath = new Map<string, PlannedFile>();
  for (const plan of plans) {
    for (const file of plan.files) if (!byPath.has(file.path)) byPath.set(file.path, file);
  }
  return [...byPath.values()].sort((a, b) => a.path.localeCompare(b.path));
}

export function install(options: {
  root: string;
  agentIds: string[];
  dryRun: boolean;
}): Result<InstallData> {
  try {
    const { root, dryRun } = options;
    started(root);
    const skills = loadSkills();

    const ids = options.agentIds.length > 0 ? options.agentIds : ["manual"];
    const adapters = ids.map((id) => {
      try {
        return adapterFor(id);
      } catch (e) {
        throw new MichiError({
          class: "UNKNOWN", code: "NOT_FOUND",
          message: e instanceof Error ? e.message : String(e),
          detail: { known: Object.keys(ADAPTERS) },
          next: `See what MICHI knows about: michi agents`,
        });
      }
    });

    const plans = adapters.map((a) =>
      a.installPlan({ projectRoot: root, projectName: projectName(root), skills }),
    );
    const outcomes: InstallOutcome[] = reconcile(merge(plans), (path) => {
      const at = join(root, path);
      return existsSync(at) ? readFileSync(at, "utf8") : null;
    });

    const notes = [...new Set(plans.flatMap((p) => p.notes))];
    const conflicts = outcomes
      .filter((o) => o.action === "CONFLICT")
      .map((o) => ({ path: o.path, diff: [...(o.diff ?? [])] }));
    const unchanged = outcomes.filter((o) => o.action === "UNCHANGED").map((o) => o.path);
    const pending = outcomes.filter((o) => o.action === "WRITE");

    if (dryRun) {
      return ok({
        agents: ids, dry_run: true, written: [],
        unchanged, would_write: pending.map((o) => o.path), conflicts, notes,
      });
    }

    // Write what can be written, even when something else conflicts: a
    // partial install the user can finish beats refusing the whole thing.
    const written: string[] = [];
    for (const outcome of pending) {
      const at = join(root, outcome.path);
      mkdirSync(dirname(at), { recursive: true });
      writeFileSync(at, outcome.content ?? "", "utf8");
      written.push(outcome.path);
    }

    const data: InstallData = {
      agents: ids, dry_run: false, written, unchanged, would_write: [], conflicts, notes,
    };

    if (conflicts.length > 0) {
      throw new MichiError({
        class: "BLOCKED", code: "CONFLICT",
        message: conflicts.length === 1
          ? `${conflicts[0]?.path} already exists with different content, and MICHI did not touch it.`
          : `${conflicts.length} files already exist with different content, and MICHI did not touch them.`,
        detail: { ...data },
        next: "Read the difference, merge what you want by hand, and run install again.",
      });
    }
    return ok(data);
  } catch (e) {
    return errorPayload(MichiError.from(e));
  }
}

/**
 * An agent's default context budget, if it has one.
 *
 * The CLI resolves this to a number before Core sees it. OQ-005 keeps the
 * `chars/4` estimate as the method either way; an adapter may suggest a size,
 * never a different way of counting.
 */
export function agentBudget(id: string): number | undefined {
  return adapterFor(id).defaults?.budgetTokens;
}
