/**
 * Human rendering.
 *
 * Both renderings are projections of the same typed result (Phase 1.6), so
 * nothing here may know something the JSON does not. Short, plain language,
 * and always ending with what needs the person (CLI_CONTRACT.md, P11).
 */
import type {
  InitData, ScanData, StatusData, Detection,
  StartData, AnswerData, CloseData, DiscoverStatusData, Decision,
  PlanStatusData, PlanUpdateData, PlanCloseData,
  ArchitectureStatusData, ArchitectureCloseData,
} from "@michi/core";
import { cmd } from "@michi/core";

const bullet = (s: string) => `  ${s}`;

function describe(label: string, d: Detection<string | string[]>): string {
  if (d.confidence === "UNKNOWN") {
    return bullet(`${label.padEnd(16)} not known${d.note ? ` — ${d.note}` : ""}`);
  }
  const value = Array.isArray(d.value) ? d.value.join(", ") : String(d.value);
  const qualifier = d.confidence === "INFERRED" ? " (a guess from convention)" : "";
  return bullet(`${label.padEnd(16)} ${value}${qualifier}`);
}

function detectionLines(detections: StatusData["detected"]): string[] {
  if (!detections) return [bullet("MICHI has not looked at your code yet.")];
  const d = detections.detections;
  return [
    describe("Project type", d.project_type),
    describe("Language", d.languages),
    describe("Package manager", d.package_manager),
    describe("Runtime", d.runtime),
    describe("Frameworks", d.frameworks),
    describe("Database", d.database),
    describe("Data layer", d.orm),
    describe("Tests", d.test_framework),
    describe("Deployment", d.deployment),
  ];
}

export function renderInit(data: InitData): string[] {
  const lines: string[] = [];
  if (data.dry_run) {
    lines.push(`This is a dry run — nothing was written.`, "");
    lines.push(`MICHI would set up ${data.project.name} and create:`);
  } else {
    lines.push(`MICHI is set up for ${data.project.name}.`, "");
    lines.push(`Created in ${data.brain}:`);
  }
  for (const f of data.created) lines.push(bullet(f));
  if (data.kept.length > 0) {
    lines.push("", "Left alone because they already exist:");
    for (const f of data.kept) lines.push(bullet(f));
  }
  lines.push("", "What MICHI found in your project:");
  lines.push(...detectionLines({ generated_at: data.scan.generated_at, detections: data.scan.detections }));
  lines.push("", "Next:");
  lines.push(bullet(`Tell MICHI what you want to build — run: ${cmd("discover start")}`));
  return lines;
}

export function renderScan(data: ScanData): string[] {
  const lines: string[] = [
    data.changed
      ? "MICHI looked at your project and found changes since last time."
      : "MICHI looked at your project. Nothing has changed since the last scan.",
    "",
  ];
  lines.push(...detectionLines({ generated_at: data.map.generated_at, detections: data.map.detections }));
  lines.push("", `Files considered: ${data.map.stats.files_considered}`);
  return lines;
}

export function renderStatus(data: StatusData): string[] {
  const lines: string[] = [
    `MICHI PROJECT STATUS`,
    "",
    bullet(`Project           ${data.project.name}`),
    bullet(`Stage             ${data.stage}`),
    bullet(`Architecture      ${data.architecture_status}`),
    bullet(`Milestone         ${data.current_milestone ?? "none yet"}`),
    bullet(`Active task       ${data.active_task ?? "none"}`),
    bullet(
      `Last look at code ${data.last_scan ? data.last_scan.at : "never"}`,
    ),
  ];
  if (data.stage_reason) lines.push(bullet(`Why this stage     ${data.stage_reason}`));
  if (data.needs_review.length > 0) {
    lines.push("", "No longer checked against the latest requirements:");
    for (const artifact of data.needs_review) lines.push(bullet(artifact));
  }
  lines.push(
    "",
    "What MICHI knows about your project:",
    ...detectionLines(data.detected),
  );
  if (data.needs_you.length > 0) {
    lines.push("", "Needs you:");
    for (const item of data.needs_you) lines.push(bullet(item));
  }
  return lines;
}

// ---------------------------------------------------------------------------
// Discovery
// ---------------------------------------------------------------------------

const show = (value: unknown): string =>
  Array.isArray(value) ? value.join(", ") : value === null || value === undefined ? "—" : String(value);

export function renderDiscoverStart(data: StartData): string[] {
  const n = data.existing_requirements;
  const opening = data.resumed
    ? `Picking up where you left off: ${data.session.session_id} (${data.session.status}).`
    : n === 0
      ? `Started ${data.session.session_id}. MICHI knows nothing about this idea yet.`
      : `Started ${data.session.session_id}. This project already has ${n} ` +
        `requirement${n === 1 ? "" : "s"} agreed — nothing here replaces them.`;
  return [
    opening,
    "",
    "Next:",
    bullet(
      n === 0
        ? "Ask the user what they want to build, in their own words."
        : "Ask the user what has changed or what they want to add.",
    ),
    bullet(`Then record what you learned: ${cmd("discover answer --file <update.json>")}`),
  ];
}

export function renderDiscoverAnswer(data: AnswerData): string[] {
  const a = data.applied;
  const lines = [`Recorded. ${data.session.session_id} is now ${data.session.status}.`, ""];
  const did: string[] = [];
  if (a.intent_fields) did.push(`${a.intent_fields} part(s) of the intent`);
  if (a.answers) did.push(`${a.answers} answer(s)`);
  if (a.questions_opened) did.push(`${a.questions_opened} new question(s)`);
  if (a.questions_resolved) did.push(`${a.questions_resolved} question(s) answered`);
  if (a.requirements_added.length) did.push(`proposed ${a.requirements_added.join(", ")}`);
  if (a.requirements_confirmed.length) did.push(`confirmed ${a.requirements_confirmed.join(", ")}`);
  if (a.requirements_rejected.length) did.push(`rejected ${a.requirements_rejected.join(", ")}`);
  if (a.intent_confirmed) did.push("the user confirmed the overall understanding");
  for (const item of did) lines.push(bullet(item));
  return lines;
}

export function renderDiscoverStatus(data: DiscoverStatusData): string[] {
  const s = data.session;
  const lines = [
    `DISCOVERY — ${s.session_id} (${s.status})`,
    "",
    "What the user has told us:",
  ];
  if (data.known.length === 0) lines.push(bullet("nothing yet"));
  for (const field of data.known) lines.push(bullet(`${field.padEnd(16)} ${show(s.intent[field as "problem"].value)}`));

  if (data.inferred.length > 0) {
    lines.push("", "What MICHI worked out (not confirmed):");
    for (const f of data.inferred) lines.push(bullet(`${f.padEnd(16)} ${show(s.intent[f as "problem"].value)}`));
  }
  if (data.assumed.length > 0) {
    lines.push("", "What MICHI is assuming:");
    for (const f of data.assumed) lines.push(bullet(`${f.padEnd(16)} ${show(s.intent[f as "problem"].value)}`));
  }
  if (data.unknown.length > 0) {
    lines.push("", "Still unknown:");
    for (const f of data.unknown) lines.push(bullet(f));
  }
  if (data.open_questions.length > 0) {
    lines.push("", "Open questions:");
    for (const q of data.open_questions) lines.push(bullet(`${q.id}  ${q.text}  (${q.why})`));
  }
  lines.push(
    "",
    `Requirements: ${data.requirements.confirmed} confirmed, ` +
      `${data.requirements.proposed} awaiting the user, ${data.requirements.rejected} rejected`,
    "",
    "Next:",
    bullet(data.next_step),
  );
  return lines;
}

export function renderDiscoverClose(data: CloseData): string[] {
  const lines = [
    "Discovery is complete.",
    "",
    bullet(`Confirmed in this session: ${data.requirements_written}`),
    bullet(`Requirements now in force on this project: ${data.requirements_total}`),
  ];
  if (data.superseded.length > 0) {
    lines.push("", "Replaced (kept on the record, not deleted):");
    for (const s of data.superseded) lines.push(bullet(`${s.old} → ${s.by}`));
  }
  lines.push("", "Written:", ...data.artifacts.map((f) => bullet(f)));
  lines.push("", `The project has moved to ${data.stage}.`);
  return lines;
}

// ---------------------------------------------------------------------------
// Decisions
// ---------------------------------------------------------------------------

function decisionRow(d: Decision): string {
  const choice = d.options.find((o) => o.key === d.selected_option);
  return bullet(
    `${d.id.padEnd(6)} ${d.category.padEnd(18)} ${(choice?.label ?? "—").padEnd(24)} ${d.status}`,
  );
}

export function renderDecideList(data: { decisions: Decision[] }): string[] {
  if (data.decisions.length === 0) {
    return [
      "No decisions have been made on this project yet.",
      "",
      "MICHI records a decision when there is a real choice to make and you have made it.",
    ];
  }
  const lines = ["DECISIONS", ""];
  for (const d of data.decisions) lines.push(decisionRow(d));
  const open = data.decisions.filter((d) => d.status === "PROPOSED");
  if (open.length > 0) {
    lines.push("", "Waiting on you:");
    for (const d of open) lines.push(bullet(`${d.id}  ${d.title}`));
  }
  return lines;
}

export function renderDecision(data: { decision: Decision; adr_path?: string }): string[] {
  const d = data.decision;
  const chosen = d.options.find((o) => o.key === d.selected_option);
  const lines = [`${d.id} — ${d.title}`, "", bullet(`Status     ${d.status}`)];
  if (chosen) lines.push(bullet(`Chosen     ${chosen.label}`));
  if (d.rationale) lines.push(bullet(`Because    ${d.rationale}`));
  if (d.approval) lines.push(bullet(`Approved   ${d.approval.by}, ${d.approval.at.slice(0, 10)}`));
  if (d.adr) lines.push(bullet(`Written up ${d.adr} (${d.adr_file})`));
  if (d.superseded_by) lines.push(bullet(`Replaced   by ${d.superseded_by}`));
  if (d.rejected_reason) lines.push(bullet(`Rejected   ${d.rejected_reason}`));

  if (d.status === "PROPOSED") {
    lines.push("", "The options:");
    for (const o of d.options) {
      lines.push(bullet(`${o.key.padEnd(12)} ${o.label}`));
      if (o.explanation) lines.push(`      ${o.explanation}`);
      if (o.tradeoffs) lines.push(`      Trade-off: ${o.tradeoffs}`);
    }
    lines.push("", "Nothing is decided until you choose.");
  }
  return lines;
}

export function renderDecideShow(data: { decision: Decision; adr_text: string | null }): string[] {
  const lines = renderDecision(data);
  if (data.adr_text) lines.push("", "--- the written record ---", "", data.adr_text.trimEnd());
  return lines;
}

export function renderSupersede(data: { superseded: Decision; replacement: Decision }): string[] {
  return [
    `${data.superseded.id} has been replaced by ${data.replacement.id}.`,
    "",
    bullet(`${data.superseded.id} is now SUPERSEDED. It was not deleted — the history is the point.`),
    bullet(`Its written record (${data.superseded.adr}) is unchanged; it is an accurate account of what was decided then.`),
  ];
}


// ---------------------------------------------------------------------------
// Product planning
// ---------------------------------------------------------------------------

export function renderPlanStatus(data: PlanStatusData): string[] {
  const spec = data.specification;
  const lines = [`PRODUCT SPECIFICATION — ${spec.status}`, ""];

  if (spec.personas.length === 0) {
    lines.push("Who it is for: not established yet.");
  } else {
    lines.push("Who it is for:");
    for (const p of spec.personas) lines.push(bullet(`${p.id}  ${p.name} — ${p.description}`));
  }

  const label: Record<string, string> = {
    MVP: "In the first version",
    FUTURE: "Later",
    OUT_OF_SCOPE: "Ruled out",
    UNKNOWN: "Not placed yet",
  };
  const titleOf = (id: string) => data.requirements.find((r) => r.id === id)?.title ?? id;
  for (const scope of ["MVP", "FUTURE", "OUT_OF_SCOPE", "UNKNOWN"] as const) {
    const ids = data.by_scope[scope];
    if (ids.length === 0) continue;
    lines.push("", `${label[scope]}:`);
    for (const id of ids) lines.push(bullet(`${id}  ${titleOf(id)}`));
  }

  if (spec.use_cases.length > 0) {
    lines.push("", `Use cases: ${spec.use_cases.length}`);
  }
  lines.push("", `Acceptance criteria: ${spec.criteria.length}`);

  const g = data.gaps;
  const outstanding: string[] = [];
  if (g.dangling_references.length) outstanding.push(`${g.dangling_references.length} reference(s) point at requirements that no longer exist`);
  if (g.unplaced.length) outstanding.push(`${g.unplaced.length} requirement(s) not yet placed in or out of the first version`);
  if (g.unconfirmed_scope.length) outstanding.push(`${g.unconfirmed_scope.length} scope decision(s) the user has not confirmed`);
  if (g.mvp_without_criteria.length) outstanding.push(`${g.mvp_without_criteria.length} first-version requirement(s) with no way to check them`);
  if (outstanding.length > 0) {
    lines.push("", "Outstanding:");
    for (const item of outstanding) lines.push(bullet(item));
  }

  if (spec.revisions.length > 0) {
    lines.push("", "Changes since it was first agreed:");
    for (const revision of spec.revisions) {
      lines.push(bullet(`${revision.id}  ${revision.reason}  (${revision.confirmed_by})`));
    }
  }
  if (spec.publications.length > 0) {
    lines.push("", `Published ${spec.publications.length} time(s).`);
  }

  lines.push("", "Next:", bullet(data.next_step));
  return lines;
}

export function renderPlanUpdate(data: PlanUpdateData): string[] {
  const a = data.applied;
  const lines = [`Recorded. The specification is ${data.specification.status}.`, ""];
  const did: string[] = [];
  if (a.personas_added.length) did.push(`added ${a.personas_added.join(", ")}`);
  if (a.use_cases_added.length) did.push(`added ${a.use_cases_added.join(", ")}`);
  if (a.criteria_added.length) did.push(`added ${a.criteria_added.join(", ")}`);
  if (a.scope_proposed.length) did.push(`proposed scope for ${a.scope_proposed.join(", ")}`);
  if (a.scope_confirmed.length) did.push(`the user confirmed scope for ${a.scope_confirmed.join(", ")}`);
  if (a.out_of_scope_added.length) did.push(`ruled out ${a.out_of_scope_added.join(", ")}`);
  if (a.removed.length) {
    did.push(`removed ${a.removed.join(", ")} — kept on the record, not deleted`);
  }
  if (a.specification_confirmed) did.push("the user confirmed the whole specification");
  for (const item of did) lines.push(bullet(item));

  if (a.revision) {
    lines.push(
      "",
      `Recorded as ${a.revision}. The specification needs the user's sign-off again ` +
        `before it can be published.`,
    );
  }
  return lines;
}

export function renderPlanClose(data: PlanCloseData): string[] {
  const lines = [
    data.publication === 1
      ? "The product specification is published."
      : `The product specification is published again — publication ${data.publication}` +
        (data.revision ? `, carrying ${data.revision}.` : "."),
    "",
    bullet(`In the first version: ${data.mvp.length} requirement(s)`),
    bullet(`Later: ${data.future.length}`),
    bullet(`Ruled out: ${data.out_of_scope.length}`),
    "",
    "Written:",
    ...data.artifacts.map((f) => bullet(f)),
    "",
    `The project has moved to ${data.stage}.`,
  ];
  return lines;
}


// ---------------------------------------------------------------------------
// Architecture
// ---------------------------------------------------------------------------

export function renderArchitectureStatus(data: ArchitectureStatusData): string[] {
  const lines = [`HOW THIS GETS BUILT — ${data.status}`, ""];

  if (data.needs_review) {
    lines.push(
      "What the project is building changed after these decisions were agreed.",
      "Nothing was unlocked — they just need looking at again.",
      "",
    );
  }

  if (data.locked_decisions.length === 0) {
    lines.push("Nothing has been decided yet.");
  } else {
    lines.push("Decided:");
    for (const d of data.locked_decisions) {
      lines.push(bullet(`${d.id}  ${d.title.padEnd(38)} ${d.choice}`));
    }
  }

  if (data.open_decisions.length > 0) {
    lines.push("", "Waiting on you:");
    for (const id of data.open_decisions) lines.push(bullet(`${id} — run: ${cmd(`decide show ${id}`)}`));
  }

  if (data.undecided.length > 0) {
    lines.push("", "In the first version, with no decided approach yet:");
    for (const id of data.undecided) lines.push(bullet(id));
  } else if (data.decided.length > 0) {
    lines.push("", `Everything in the first version has a decided approach (${data.decided.length}).`);
  }

  lines.push("", "Next:", bullet(data.next_step));
  return lines;
}

export function renderArchitectureClose(data: ArchitectureCloseData): string[] {
  return [
    "How this gets built is now agreed.",
    "",
    bullet(`Decisions in force: ${data.locked_decisions}`),
    bullet(`First-version requirements covered: ${data.decided.length}`),
    "",
    "Written:",
    ...data.artifacts.map((f) => bullet(f)),
    "",
    `The project has moved to ${data.stage}.`,
  ];
}
