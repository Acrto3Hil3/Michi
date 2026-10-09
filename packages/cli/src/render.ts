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
  ContextPacket, ProjectGraph,
  PlanTasksData, PlanValidateData, TaskListData, TaskShowData, TaskNextData,
  TaskStartData, TaskReportData, Task,
  RunTestData, ReviewData, DebugData, VerifyData,
} from "@subhashyadav98146/michi-core";
import { cmd } from "@subhashyadav98146/michi-core";
import type { AgentsData, InstallData } from "./agents.js";
import type { ExplainData, ImpactData, ExampleData } from "@subhashyadav98146/michi-core";

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


// ---------------------------------------------------------------------------
// Context
// ---------------------------------------------------------------------------

const thousands = (n: number) => (n >= 1000 ? `${(n / 1000).toFixed(1)}k` : String(n));

export function renderContext(data: ContextPacket, explain = false): string[] {
  const lines = [
    `CONTEXT FOR ${data.focus.id} — ${data.packet_id}`,
    "",
    bullet(`Estimated context size  ~${thousands(data.estimated_tokens)} tokens`),
    bullet(`Estimation method       ${data.estimation_method}`),
  ];
  if (data.budget_tokens !== null) {
    lines.push(bullet(`Budget                  ~${thousands(data.budget_tokens)} tokens`));
  }

  // File paths are ids too, so the column is as wide as the widest one.
  const width = Math.max(10, ...data.items.map((i) => i.id.length));
  const groups: [ContextPacket["items"][number]["tier"], string][] = [
    ["MUST_INCLUDE", "Cannot be done without"],
    ["PREFERRED", "Materially helps"],
    ["OPTIONAL", "Useful if there is room"],
  ];
  for (const [tier, heading] of groups) {
    const items = data.items.filter((i) => i.tier === tier);
    if (items.length === 0) continue;
    lines.push("", `${heading}:`);
    for (const item of items) {
      lines.push(bullet(`${item.id.padEnd(width)}  ${item.reason}`));
      if (item.needs_review) {
        lines.push(`      ⚠ needs review: ${item.review_reason ?? "the specification changed"}`);
      }
    }
  }

  if (data.revisions.length > 0) {
    lines.push("", "Changes that moved this:");
    for (const r of data.revisions) lines.push(bullet(`${r.id}  ${r.reason}`));
  }

  if (data.dropped_for_budget.length > 0) {
    lines.push("", `Dropped to fit the budget: ${data.dropped_for_budget.join(", ")}`);
  }

  if (explain && data.excluded.length > 0) {
    lines.push("", "Left out:");
    const w = Math.max(10, ...data.excluded.map((x) => x.id.length));
    for (const x of data.excluded) lines.push(bullet(`${x.id.padEnd(w)}  ${x.reason}`));
  } else if (data.excluded.length > 0) {
    lines.push("", `${data.excluded.length} item(s) left out — pass --explain to see why.`);
  }

  if (data.warnings.length > 0) {
    lines.push("", "Warnings:");
    for (const w of data.warnings) lines.push(bullet(w));
  }

  lines.push("", `Content hash: ${data.context_hash}`);
  return lines;
}

// ---------------------------------------------------------------------------
// Graph
// ---------------------------------------------------------------------------

const EDGE_WORDS: Record<string, string> = {
  GOVERNS: "governs", VERIFIES: "verifies", SERVES: "serves",
  PERFORMED_BY: "performed by", IMPLEMENTS: "implements",
  TOUCHED: "reported touching", SUPERSEDES: "supersedes",
};

export function renderGraph(graph: ProjectGraph, focus?: string): string[] {
  const nodes = focus
    ? graph.nodes.filter((n) =>
        n.id === focus || graph.edges.some((e) =>
          (e.from === focus && e.to === n.id) || (e.to === focus && e.from === n.id)))
    : graph.nodes;

  const lines = [focus ? `GRAPH AROUND ${focus}` : "PROJECT GRAPH", ""];
  for (const n of nodes) {
    lines.push(bullet(`${n.id.padEnd(12)} ${n.type.padEnd(11)} ${n.label}`));
    for (const e of graph.edges.filter((x) => x.from === n.id)) {
      lines.push(`      ${EDGE_WORDS[e.type] ?? e.type} → ${e.to}`);
    }
  }
  lines.push("", `${nodes.length} node(s), ${graph.edges.length} relationship(s)`);
  if (graph.dropped.length > 0) {
    lines.push("", "References that point at nothing:");
    for (const d of graph.dropped) lines.push(bullet(`${d.from} → ${d.to}: ${d.reason}`));
  }
  return lines;
}

export function renderGraphMermaid(graph: ProjectGraph): string[] {
  const lines = ["flowchart LR"];
  for (const n of graph.nodes) {
    lines.push(`  ${n.id.replace(/[^A-Za-z0-9_]/g, "_")}["${n.id}: ${n.label.replace(/"/g, "'")}"]`);
  }
  for (const e of graph.edges) {
    const a = e.from.replace(/[^A-Za-z0-9_]/g, "_");
    const b = e.to.replace(/[^A-Za-z0-9_]/g, "_");
    lines.push(`  ${a} -->|${EDGE_WORDS[e.type] ?? e.type}| ${b}`);
  }
  return lines;
}

export function renderOrphans(data: { ungoverned: string[]; uncovered: string[] }): string[] {
  const lines = ["HYGIENE", ""];
  lines.push(data.ungoverned.length === 0
    ? "Every requirement has a decided approach."
    : "Requirements with no decided approach:");
  for (const id of data.ungoverned) lines.push(bullet(id));
  lines.push("", data.uncovered.length === 0
    ? "Every requirement has a way to check it."
    : "Requirements with no acceptance criterion:");
  for (const id of data.uncovered) lines.push(bullet(id));
  if (data.ungoverned.length + data.uncovered.length > 0) {
    lines.push("", "A young project is legitimately full of these. They are warnings, not errors.");
  }
  return lines;
}


// ---------------------------------------------------------------------------
// Tasks
// ---------------------------------------------------------------------------

export function renderPlanTasks(data: PlanTasksData): string[] {
  const lines: string[] = [];
  if (data.created.length === 0) {
    lines.push("Every first-version requirement already has work planned for it.");
    if (data.skipped.length > 0) lines.push("", `Already planned: ${data.skipped.join(", ")}`);
    return lines;
  }
  lines.push(`Planned ${data.created.length} piece(s) of work.`, "");
  for (const id of data.created) lines.push(bullet(id));
  if (data.skipped.length > 0) {
    lines.push("", `Left alone, already planned: ${data.skipped.join(", ")}`);
  }
  lines.push("", "Next:", bullet(`Check the plan holds together — run: ${cmd("plan validate")}`));
  return lines;
}

export function renderPlanValidate(data: PlanValidateData): string[] {
  if (data.ok) {
    return [
      `The plan holds together: ${data.tasks} task(s), no problems.`,
      "",
      "It can be executed in dependency order, and every first-version",
      "requirement has work planned for it.",
    ];
  }
  return [
    `The plan has ${data.problems.length} problem(s). Nothing was changed.`,
    "",
    ...data.problems.map((p) => bullet(p)),
  ];
}

const taskRow = (t: Task) =>
  bullet(`${t.task_id.padEnd(10)} ${t.status.padEnd(17)} ${t.title}`);

export function renderTaskList(data: TaskListData): string[] {
  if (data.tasks.length === 0) {
    return ["No tasks match.", "", `Plan some work — run: ${cmd("plan tasks --from-requirements")}`];
  }
  const lines = ["WORK", ""];
  for (const t of data.tasks) lines.push(taskRow(t));
  const summary = Object.entries(data.by_status)
    .sort(([a], [b]) => (a < b ? -1 : 1))
    .map(([status, n]) => `${n} ${status.toLowerCase()}`)
    .join(" · ");
  lines.push("", summary);
  return lines;
}

export function renderTaskShow(data: TaskShowData): string[] {
  const t = data.task;
  const lines = [
    `${t.task_id} — ${t.title}`,
    "",
    bullet(`Status        ${t.status}`),
    bullet(`Serves        ${t.requirements.join(", ")}`),
    bullet(`Governed by   ${t.decisions.length > 0 ? t.decisions.join(", ") : "nothing"}`),
    bullet(`Waiting on    ${t.dependencies.length > 0 ? t.dependencies.join(", ") : "nothing"}`),
    bullet(`Attempts      ${t.attempt}`),
    bullet(`Verification  ${t.verification.status}`),
  ];
  if (t.blocked_reason) lines.push(bullet(`Blocked       ${t.blocked_reason}`));
  if (t.context) lines.push(bullet(`Context       ${t.context.packet}`));

  lines.push("", "How we will know it is done:");
  for (const c of t.acceptance_criteria) lines.push(bullet(`${c.id}  ${c.text}`));

  if (t.files_touched.length > 0) {
    lines.push("", "Files the agent reported changing:");
    for (const file of t.files_touched) lines.push(bullet(file));
    lines.push("", "Reported, not verified.");
  }

  if (data.runs.length > 0) {
    lines.push("", "Handovers:");
    for (const run of data.runs) {
      lines.push(bullet(
        `${run.run_id}  ${run.agent.padEnd(14)} ${run.result ?? "open"}` +
        (run.tests ? `  tests ${run.tests.passed}/${run.tests.run}` : ""),
      ));
    }
  }
  return lines;
}

export function renderTaskNext(data: TaskNextData): string[] {
  if (!data.task) return ["Nothing to pick up.", "", data.reason];
  return [
    `Next: ${data.task.task_id} — ${data.task.title}`,
    "",
    bullet(`Serves ${data.task.requirements.join(", ")}`),
    bullet(data.reason),
    "",
    `Hand it over: ${cmd(`task start ${data.task.task_id} --agent <name>`)}`,
  ];
}

export function renderTaskStart(data: TaskStartData): string[] {
  return [
    `${data.task.task_id} handed to ${data.run.agent} as ${data.run.run_id} ` +
      `(attempt ${data.run.attempt}).`,
    "",
    "Give the agent everything below this line, verbatim.",
    "",
    "----------------------------------------------------------------------",
    "",
    data.instruction,
    "----------------------------------------------------------------------",
    "",
    `When it reports back: ${cmd(`task report ${data.task.task_id} --from <report.json>`)}`,
  ];
}

export function renderTaskReport(data: TaskReportData): string[] {
  const lines = [
    `Recorded. ${data.task.task_id} is now ${data.task.status}.`,
    "",
    bullet(`${data.run.run_id} closed as ${data.run.result}`),
  ];
  if (data.run.files_touched.length > 0) {
    lines.push(bullet(`${data.run.files_touched.length} file(s) reported changed`));
  }
  if (data.run.tests) {
    lines.push(bullet(`tests reported: ${data.run.tests.passed} passed, ${data.run.tests.failed} failed`));
  }
  lines.push(
    "",
    "That is the agent's own account — a claim, not evidence. Nothing is",
    "verified until it has been checked independently.",
  );
  if (data.run.new_decisions_requested.length > 0) {
    lines.push("", "The agent says these need your approval:");
    for (const item of data.run.new_decisions_requested) lines.push(bullet(item));
  }
  return lines;
}

export function renderTaskDone(data: { task: Task }): string[] {
  const observed = data.task.verification.evidence.filter((e) => e.produced_by === "MICHI").length;
  return [
    `${data.task.task_id} is DONE — ${data.task.title}`,
    "",
    bullet(`Verified on ${observed} check${observed === 1 ? "" : "s"} MICHI ran itself.`),
    bullet("Filed under tasks/completed. Nothing was deleted."),
    "",
    "Anything waiting on it can now start.",
  ];
}

export function renderTaskBlock(data: { task: Task }): string[] {
  return [
    `${data.task.task_id} is BLOCKED.`,
    "",
    bullet(String(data.task.blocked_reason)),
    "",
    "It stays on the plan. Nothing was deleted.",
  ];
}


// ---------------------------------------------------------------------------
// Verification
// ---------------------------------------------------------------------------

export function renderTest(data: RunTestData): string[] {
  const e = data.evidence;
  const observed = e.produced_by === "MICHI";
  const lines = [
    observed
      ? `MICHI ran this itself and observed the result.`
      : `Recorded what the agent reported. MICHI did not observe this.`,
    "",
  ];
  if (observed) {
    lines.push(bullet(`Command   ${e.command}`));
    lines.push(bullet(`From      verification.allow.${e.allow_key}`));
    lines.push(bullet(`Exit      ${e.exit_code}  ${data.passed ? "(passed)" : "(FAILED)"}`));
  } else {
    lines.push(bullet(`Reported  ${e.summary}`));
    lines.push(bullet(`Kind      ${e.kind}`));
  }
  if (e.output_summary) {
    lines.push("", "Output:", ...e.output_summary.split("\n").slice(0, 20).map((l) => `      ${l}`));
    if (e.output_truncated) lines.push("      … truncated");
  }
  lines.push("", `${data.task.task_id} is now ${data.task.status}.`);
  if (!data.passed) {
    lines.push("", "That failed. Nothing is verified on a failing check.");
  }
  return lines;
}

export function renderReview(data: ReviewData): string[] {
  const lines = [`Review of ${data.task.task_id}: ${data.verdict}`, ""];
  if (data.findings.length === 0) {
    lines.push("No findings.");
  } else {
    for (const f of data.findings) {
      lines.push(bullet(`${f.file}${f.line ? `:${f.line}` : ""}`));
      lines.push(`      ${f.problem}`);
      lines.push(`      Why it matters: ${f.why}`);
      lines.push(`      Do instead:     ${f.fix}`);
    }
  }
  lines.push("", `${data.task.task_id} is now ${data.task.status}.`);
  if (data.verdict === "PASS") {
    lines.push("", "A review is one person's judgement, recorded as such. It is not",
      "evidence that the work runs.");
  }
  return lines;
}

export function renderDebug(data: DebugData): string[] {
  const lines = [`Debugging ${data.task.task_id}`, "", "Recorded so far:"];
  for (const s of data.stages) lines.push(bullet(`${s.stage.padEnd(12)} ${s.note}`));
  return lines;
}

export function renderVerify(data: VerifyData): string[] {
  const v = data.task.verification;
  const lines = [
    v.status === "PASSED"
      ? `${data.task.task_id} is VERIFIED.`
      : `${data.task.task_id} did NOT verify.`,
    "",
  ];
  for (const c of v.criteria) {
    lines.push(bullet(`${c.id.padEnd(10)} ${c.status.padEnd(15)} ${c.reason}`));
  }
  lines.push(
    "",
    `Rested on: ${data.rested_on.michi} criterion/criteria backed by something MICHI observed, ` +
      `${data.rested_on.agent} by the agent's word alone.`,
  );
  if (data.warnings.length > 0) {
    lines.push("", "Worth knowing:");
    for (const w of data.warnings) lines.push(bullet(w));
  }
  lines.push("", `${data.task.task_id} is now ${data.task.status}.`);
  return lines;
}


// ---------------------------------------------------------------------------
// Agents — the adapter boundary. Detection proposes; it never decides.
// ---------------------------------------------------------------------------

export function renderAgents(data: AgentsData): string[] {
  const lines: string[] = [];
  const found = data.agents.filter((a) => a.present && a.id !== "manual");

  if (found.length === 0) {
    lines.push("No coding agent found in this project.", "");
    lines.push("That is not a problem: AGENTS.md and the michi CLI are the whole");
    lines.push("integration, and every agent can read them.", "");
  } else {
    lines.push(`Found ${found.length === 1 ? "one agent" : `${found.length} agents`} in this project:`, "");
    for (const a of found) {
      lines.push(bullet(`${a.name}  (${a.id})`));
      for (const e of a.evidence) lines.push(`      saw ${e}`);
    }
    lines.push("");
  }

  lines.push("MICHI can install for:", "");
  for (const a of data.agents) {
    const runs = a.runs_commands === true ? "runs commands"
      : a.runs_commands === false ? "cannot run commands"
      : "unknown whether it runs commands";
    lines.push(bullet(`${a.id.padEnd(12)} ${a.name}`));
    lines.push(`      ${a.writes.length === 1 ? a.writes[0] : `${a.writes.length} files`} · ${runs}`);
  }

  lines.push("", "Nothing was written. Pick one — MICHI will not choose for you:", "");
  lines.push(`  michi install --agent ${found[0]?.id ?? "manual"}`);
  return lines;
}

export function renderInstall(data: InstallData): string[] {
  const lines: string[] = [];

  if (data.dry_run) {
    lines.push(`Would install for ${data.agents.join(", ")}. Nothing was written.`, "");
    for (const p of data.would_write) lines.push(bullet(`new       ${p}`));
    for (const p of data.unchanged) lines.push(bullet(`already   ${p}`));
  } else {
    lines.push(`Installed for ${data.agents.join(", ")}.`, "");
    for (const p of data.written) lines.push(bullet(`wrote     ${p}`));
    for (const p of data.unchanged) lines.push(bullet(`unchanged ${p}`));
  }

  for (const c of data.conflicts) {
    lines.push("", `${c.path} already exists and differs. MICHI did not touch it.`, "");
    for (const line of c.diff) lines.push(`      ${line}`);
  }

  if (data.notes.length > 0) {
    lines.push("");
    for (const note of data.notes) lines.push(bullet(note));
  }

  lines.push("", "Nothing in .michi/ changed, and no application code was touched.");
  return lines;
}


// ---------------------------------------------------------------------------
// Explain — the project in plain language, from artifacts only
// ---------------------------------------------------------------------------

export function renderExplain(data: ExplainData): string[] {
  const lines = [data.title, ""];
  for (const paragraph of data.paragraphs) lines.push(paragraph, "");

  if (data.not_recorded.length > 0) {
    lines.push("Not recorded, so MICHI will not guess:", "");
    for (const gap of data.not_recorded) lines.push(bullet(gap));
    lines.push("");
  }
  if (data.related.length > 0) {
    lines.push(`Related: ${data.related.join(" · ")}`);
  }
  return lines;
}

export function renderImpact(data: ImpactData): string[] {
  if (data.total === 0) {
    return [
      `Nothing depends on ${data.id} yet — ${data.title}.`,
      "",
      "Changing it now costs nothing but the conversation.",
    ];
  }

  const lines = [
    `Changing ${data.id} — ${data.title} — affects ${data.total} recorded thing${data.total === 1 ? "" : "s"}.`,
    "",
  ];
  const group = (label: string, ids: readonly string[]) => {
    if (ids.length === 0) return;
    lines.push(`${label} (${ids.length})`);
    for (const id of ids) lines.push(`      ${id}`);
    lines.push("");
  };
  group("Requirements it shapes", data.requirements);
  group("Decisions resting on the same requirements", data.decisions);
  // Tasks already worked on are annotated rather than listed twice: a second
  // group made the same id appear under two headings, and the stated total
  // then looked wrong to anyone counting rows.
  group("Work planned under it", data.tasks.map((id) =>
    data.tasks_with_work.includes(id) ? `${id}  (already worked on)` : id));
  group("Files a task reported touching", data.files);

  if (data.tasks_with_work.length > 0) {
    lines.push(
      `${data.tasks_with_work.length} piece${data.tasks_with_work.length === 1 ? "" : "s"} of work ` +
      `has already been attempted under this decision. Changing it means some of that is wasted.`,
    );
    lines.push("");
  }
  lines.push(
    "The files are there because a task reported touching them, which is a",
    "claim rather than something MICHI watched. Treat the list as where to",
    "look, not as a measured cost.",
  );
  return lines;
}


// ---------------------------------------------------------------------------
// Example — a complete file, because a schema error names one field at a time
// ---------------------------------------------------------------------------

export function renderExample(data: ExampleData): string[] {
  const lines = [
    `${data.name} — ${data.what}`,
    "",
    `Used by:  michi ${data.used_by} <file.json>`,
    "",
    ...data.json.split("\n"),
  ];
  if (data.notes.length > 0) {
    lines.push("", "Worth knowing:", "");
    for (const note of data.notes) lines.push(bullet(note));
  }
  return lines;
}

export function renderExampleList(names: string[]): string[] {
  return [
    "Every command that takes a file has a complete example:",
    "",
    ...names.map((n) => `  michi example ${n}`),
    "",
    "A schema error names one missing field at a time. These name all of them,",
    "with the values each field accepts.",
  ];
}
