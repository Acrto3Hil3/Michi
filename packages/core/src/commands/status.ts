import { join } from "node:path";
import { MichiError, errorPayload } from "../errors.js";
import type { Result } from "../result.js";
import { ok } from "../result.js";
import { CONFIG_FILE, MAP_FILE, STATE_FILE, brainDir, readJson, readYaml } from "../fs/brain.js";
import { ConfigSchema } from "../schemas/config.js";
import { StateSchema } from "../schemas/state.js";
import type { ProjectStage } from "../schemas/state.js";
import type { SessionState } from "../schemas/discovery.js";
import { ProjectMapSchema } from "../schemas/scan.js";
import type { Detections } from "../schemas/scan.js";
import { requireInitialized } from "./scan.js";
import { openSession } from "./discover.js";
import { cmd } from "../identity.js";

export interface StatusOptions {
  root: string;
  now: () => string;
}

export interface StatusData {
  initialized: true;
  schema_version: number;
  project: { id: string; name: string };
  stage: ProjectStage;
  stage_entered_at: string;
  architecture_status: "UNSET" | "PROPOSED" | "LOCKED";
  current_milestone: string | null;
  active_task: string | null;
  counts: Record<string, number>;
  last_scan: { at: string; project_map_hash: string } | null;
  discovery: { session_id: string; status: SessionState; open_questions: number } | null;
  detected: { generated_at: string; detections: Detections } | null;
  needs_you: string[];
}

/**
 * A status report that does not say what is waiting on the human is a wall of
 * numbers (CLI_CONTRACT.md).
 */
function needsYou(
  state: { stage: ProjectStage; counts: StatusData["counts"] },
  hasMap: boolean,
  discovery: StatusData["discovery"],
): string[] {
  const items: string[] = [];
  if (state.stage === "DISCOVERY") {
    if (!discovery) {
      items.push(`Tell MICHI what you want to build — run: ${cmd("discover start")}`);
    } else if (discovery.status === "READY_FOR_CONFIRMATION") {
      items.push(
        `${discovery.session_id} is waiting for you to confirm what MICHI understood — ` +
          `run: ${cmd("discover status")}`,
      );
    } else if (discovery.open_questions > 0) {
      items.push(
        `${discovery.session_id} has ${discovery.open_questions} question(s) for you — ` +
          `run: ${cmd("discover status")}`,
      );
    } else {
      items.push(
        `${discovery.session_id} is under way (${discovery.status}) — run: ${cmd("discover status")}`,
      );
    }
  }
  const open = state.counts.decisions_open ?? 0;
  if (open > 0) {
    items.push(
      `${open} decision${open === 1 ? "" : "s"} waiting on your answer — run: ${cmd("decide")}`,
    );
  }
  if ((state.counts.tasks_blocked ?? 0) > 0) {
    items.push(`${state.counts.tasks_blocked} task(s) blocked — run: ${cmd("task list --status BLOCKED")}`);
  }
  if (!hasMap) {
    items.push(`MICHI has not looked at your code yet — run: ${cmd("scan")}`);
  }
  return items;
}

export function status(options: StatusOptions): Result<StatusData> {
  try {
    const { root } = options;
    requireInitialized(root);

    const brain = brainDir(root);
    const config = readYaml(join(brain, CONFIG_FILE), ConfigSchema);
    const state = readYaml(join(brain, STATE_FILE), StateSchema);

    // A missing map is an ordinary early state; a corrupt one is not.
    let detected: StatusData["detected"] = null;
    try {
      const map = readJson(join(brain, MAP_FILE), ProjectMapSchema);
      detected = { generated_at: map.generated_at, detections: map.detections };
    } catch (e) {
      if (MichiError.from(e).payload.code !== "NOT_FOUND") throw e;
    }

    const session = openSession(root);
    const discovery: StatusData["discovery"] = session
      ? {
          session_id: session.session_id,
          status: session.status,
          open_questions: session.open_questions.length,
        }
      : null;

    return ok({
      initialized: true,
      schema_version: state.schema_version,
      project: { id: config.project.id, name: config.project.name },
      stage: state.stage,
      stage_entered_at: state.stage_entered_at,
      architecture_status: state.architecture_status,
      current_milestone: state.current_milestone,
      active_task: state.active_task,
      counts: state.counts,
      last_scan: state.last_scan,
      discovery,
      detected,
      needs_you: needsYou(state, detected !== null, discovery),
    });
  } catch (e) {
    return errorPayload(MichiError.from(e));
  }
}
