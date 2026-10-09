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
  /** Why the stage is where it is — the reading that matters when it moved back. */
  stage_reason: string | null;
  /** Artifacts that still exist but are no longer validated against the latest upstream state. */
  needs_review: string[];
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
  state: { stage: ProjectStage; counts: StatusData["counts"]; needs_review: string[] },
  hasMap: boolean,
  discovery: StatusData["discovery"],
): string[] {
  const items: string[] = [];

  // An open session is waiting on the user whatever stage the project is in:
  // under OQ-007 a second discovery on a specified project is ordinary.
  if (state.stage === "DISCOVERY" || discovery) {
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
  for (const artifact of state.needs_review) {
    items.push(
      `The ${artifact} is no longer validated against the latest requirements — ` +
        `run: ${cmd("plan status")}`,
    );
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

  // Nothing specific is outstanding, so answer from the stage. `status` is
  // what the README and every skill point at for "what now", and a stage
  // where it says nothing leaves the user with nowhere to go.
  if (items.length === 0) {
    items.push(BY_STAGE[state.stage]);
  }
  return items;
}

/** The one thing worth doing at each stage, when nothing else is outstanding. */
const BY_STAGE: Record<ProjectStage, string> = {
  DISCOVERY: `Tell MICHI what you want to build — run: ${cmd("discover start")}`,
  SPECIFICATION:
    `Work out what ships first and how anyone will know it works — run: ${cmd("plan status")}`,
  ARCHITECTURE:
    `Settle how the first version gets built — run: ${cmd("architecture status")}`,
  DESIGN: `Nothing is waiting on you. Plan the work — run: ${cmd("plan tasks --from-requirements")}`,
  PLANNING: `Plan the work from what was agreed — run: ${cmd("plan tasks --from-requirements")}`,
  IMPLEMENTATION: `Pick up the next piece of work — run: ${cmd("task next")}`,
  VALIDATION: `Check the work against evidence — run: ${cmd("task list")}`,
  REVIEW: `Review what has been built — run: ${cmd("task list")}`,
  RELEASE: `Everything agreed has been built and checked — run: ${cmd("task list")}`,
  OPERATIONS:
    `Nothing is outstanding. Describe a change when you want one — run: ${cmd("discover start")}`,
};

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
      stage_reason: state.stage_reason,
      needs_review: state.needs_review,
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
