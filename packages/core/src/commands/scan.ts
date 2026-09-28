import { join } from "node:path";
import { MichiError, errorPayload } from "../errors.js";
import type { Result } from "../result.js";
import { ok } from "../result.js";
import { MAP_FILE, STATE_FILE, brainDir, isInitialized, readYaml, writeJson, writeYaml } from "../fs/brain.js";
import { StateSchema } from "../schemas/state.js";
import type { ProjectMap } from "../schemas/scan.js";
import { mapHash, scanProject } from "../scan/scanner.js";
import { cmd } from "../identity.js";

export interface ScanOptions {
  root: string;
  now: () => string;
}

export interface ScanData {
  map: ProjectMap;
  hash: string;
  previous_hash: string | null;
  changed: boolean;
}

export function requireInitialized(root: string): void {
  if (isInitialized(root)) return;
  throw new MichiError({
    class: "BLOCKED",
    code: "NOT_INITIALIZED",
    message: "This folder is not set up for MICHI yet.",
    detail: { expected: brainDir(root) },
    next: `Run: ${cmd("init")}`,
  });
}

export function scan(options: ScanOptions): Result<ScanData> {
  try {
    const { root, now } = options;
    requireInitialized(root);

    const statePath = join(brainDir(root), STATE_FILE);
    const state = readYaml(statePath, StateSchema);

    const timestamp = now();
    const map = scanProject(root, timestamp);
    const hash = mapHash(map);
    const previous = state.last_scan?.project_map_hash ?? null;
    const changed = previous !== hash;

    // Nothing changed: leave both files untouched so repeated scans are
    // genuinely idempotent rather than merely harmless.
    if (changed) {
      writeJson(join(brainDir(root), MAP_FILE), map);
      writeYaml(statePath, {
        ...state,
        last_scan: { at: timestamp, project_map_hash: hash },
        updated_at: timestamp,
      });
    }

    return ok({ map, hash, previous_hash: previous, changed });
  } catch (e) {
    return errorPayload(MichiError.from(e));
  }
}
