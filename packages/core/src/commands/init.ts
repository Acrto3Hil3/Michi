import { existsSync, readFileSync } from "node:fs";
import { homedir } from "node:os";
import { join, parse as parsePath, resolve, basename } from "node:path";
import { MichiError, errorPayload } from "../errors.js";
import type { Result } from "../result.js";
import { ok } from "../result.js";
import {
  CONFIG_FILE, MAP_FILE, STATE_FILE, brainDir, ensureDirs, isDirectory,
  isInitialized, writeJson, writeText, writeYaml,
} from "../fs/brain.js";
import { newConfig } from "../schemas/config.js";
import { newState } from "../schemas/state.js";
import type { ProjectMap } from "../schemas/scan.js";
import { mapHash, scanProject } from "../scan/scanner.js";
import { IDENTITY, cmd } from "../identity.js";

export interface InitOptions {
  root: string;
  now: () => string;
  /** Restore missing project-brain files. Never overwrites a file with content. */
  force?: boolean;
  /** Work out what would happen and write nothing. */
  dryRun?: boolean;
}

export interface InitData {
  brain: string;
  project: { id: string; name: string };
  /** Files written, or — under dry_run — the files that would be written. */
  created: string[];
  /** Files left alone because they already exist. */
  kept: string[];
  dry_run: boolean;
  scan: ProjectMap;
}

function slugify(name: string): string {
  const slug = name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return slug.length > 0 ? slug : "project";
}

function projectName(root: string): string {
  const manifest = join(root, "package.json");
  if (existsSync(manifest)) {
    try {
      const parsed = JSON.parse(readFileSync(manifest, "utf8")) as { name?: unknown };
      if (typeof parsed.name === "string" && parsed.name.trim().length > 0) {
        return parsed.name.trim();
      }
    } catch {
      // Unreadable manifest — fall through to the directory name.
    }
  }
  return basename(resolve(root));
}

/** Refusing these is cheap; the mistake they prevent is not. */
function isDangerousRoot(root: string): boolean {
  const abs = resolve(root);
  return abs === resolve(homedir()) || abs === parsePath(abs).root;
}

export function init(options: InitOptions): Result<InitData> {
  try {
    const { root, now, force = false, dryRun = false } = options;

    if (!isDirectory(root)) {
      throw new MichiError({
        class: "INVALID",
        code: "USAGE_ERROR",
        message: `${root} is not a directory.`,
        next: `Change to your project's folder and run: ${cmd("init")}`,
      });
    }

    if (isDangerousRoot(root)) {
      throw new MichiError({
        class: "BLOCKED",
        code: "BLOCKED",
        message:
          "That looks like your home directory or the root of the disk, not a project.",
        detail: { root: resolve(root) },
        next: `Change to the folder holding the project you want to build, then run: ${cmd("init")}`,
      });
    }

    const already = isInitialized(root);
    if (already && !force) {
      throw new MichiError({
        class: "INVALID",
        code: "ALREADY_INITIALIZED",
        message: `This project already has a ${brainDir(".")}/ folder. Nothing was changed.`,
        detail: { brain: brainDir(root) },
        next: `To see where the project stands, run: ${cmd("status")}`,
      });
    }

    const timestamp = now();
    const name = projectName(root);
    const id = slugify(name);
    const map = scanProject(root, timestamp);

    if (!dryRun) ensureDirs(root);

    const created: string[] = [];
    const kept: string[] = [];

    const writeIfAbsent = (relative: string, write: (file: string) => void): void => {
      const file = join(brainDir(root), relative);
      if (existsSync(file)) {
        kept.push(relative);
        return;
      }
      created.push(relative);
      if (!dryRun) write(file);
    };

    writeIfAbsent(CONFIG_FILE, (file) =>
      writeYaml(file, newConfig({ projectId: id, projectName: name, now: timestamp })),
    );
    writeIfAbsent(MAP_FILE, (file) => writeJson(file, map));
    writeIfAbsent(STATE_FILE, (file) => {
      const state = newState({ projectId: id, now: timestamp });
      state.last_scan = {
        at: timestamp,
        project_map_hash: mapHash(map),
      };
      writeYaml(file, state);
    });
    writeIfAbsent("README.md", (file) => writeReadme(file, name));

    return ok({
      brain: brainDir(root),
      project: { id, name },
      created,
      kept,
      dry_run: dryRun,
      scan: map,
    });
  } catch (e) {
    return errorPayload(MichiError.from(e));
  }
}

/**
 * The folder appears in someone's repository. If they cannot code, it should
 * still be obvious what it is and that deleting it loses something (P11).
 */
function writeReadme(file: string, name: string): void {
  const tool = IDENTITY.displayName;
  writeText(
    file,
    [
      `# ${brainDir("")}`,
      "",
      `This folder is ${name}'s engineering memory.`,
      "",
      "It holds what this project has decided and why: the requirements, the",
      "technical decisions and the reasoning behind them, the plan, and what has",
      "been checked. It is all plain text, so you can open any of it and read it.",
      "",
      "Keep it in version control. It travels with the project, and it is how a",
      "fresh AI session understands your project without you re-explaining it.",
      "",
      `Nothing in here is your application's source code, and ${tool} never edits`,
      "your code.",
      "",
    ].join("\n"),
  );
}
