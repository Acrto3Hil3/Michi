import { MichiError, errorPayload } from "../errors.js";
import type { Result } from "../result.js";
import { ok } from "../result.js";
import { readYaml, brainDir } from "../fs/brain.js";
import { RegistrySchema } from "../schemas/decision.js";
import type { Decision } from "../schemas/decision.js";
import { RequirementsRegistrySchema } from "../schemas/discovery.js";
import type { Requirement } from "../schemas/discovery.js";
import { SpecificationSchema } from "../schemas/product.js";
import type { ProductSpecification } from "../schemas/product.js";
import { buildGraph } from "../graph/build.js";
import { loadTasks, withDerivedReadiness } from "./plan-tasks.js";
import { runsOf } from "./task.js";
import type { Task } from "../schemas/task.js";
import { requireInitialized } from "./scan.js";
import { cmd } from "../identity.js";
import { existsSync } from "node:fs";
import { join } from "node:path";

/**
 * `michi explain` — the project in plain language.
 *
 * Answers from artifacts only. If the artifacts do not contain the answer, the
 * answer is "that is not recorded" — never a reconstruction (DECISION_MODEL,
 * "Explaining a decision"; P9). Nothing here infers, summarises creatively or
 * fills a gap with something plausible: every sentence traces to a recorded
 * field, and a missing field becomes a sentence saying it is missing.
 *
 * The audience is the person who cannot read the YAML (P11).
 */

export interface ExplainOptions {
  root: string;
  now: () => string;
  id: string;
  /** Strip the ids. The prose is already plain; this makes it id-free too. */
  simple?: boolean;
}

export interface ExplainData {
  kind: "DECISION" | "REQUIREMENT" | "TASK" | "FILE";
  id: string;
  title: string;
  /** Plain-language prose, in reading order. */
  paragraphs: string[];
  /** Ids worth following next. Empty under `simple`. */
  related: string[];
  /** Questions the artifacts cannot answer, stated rather than guessed at. */
  not_recorded: string[];
}

// ---------------------------------------------------------------------------
// reading
// ---------------------------------------------------------------------------

function decisions(root: string): Decision[] {
  const file = join(brainDir(root), "decisions", "index.yaml");
  return existsSync(file) ? readYaml(file, RegistrySchema).decisions : [];
}

function requirements(root: string): Requirement[] {
  const file = join(brainDir(root), "requirements", "requirements.yaml");
  return existsSync(file) ? readYaml(file, RequirementsRegistrySchema).requirements : [];
}

function specification(root: string): ProductSpecification | null {
  const file = join(brainDir(root), "requirements", "specification.yaml");
  return existsSync(file) ? readYaml(file, SpecificationSchema) : null;
}

function tasks(root: string): Task[] {
  return withDerivedReadiness(loadTasks(root));
}

/**
 * Join a recorded fragment onto a sentence without producing "because Lost
 * edits.." or a capital letter mid-clause.
 *
 * Recorded reasons are written by people and arrive in every shape: a clause,
 * a full sentence, with or without a stop. Rather than guess, the prose uses
 * punctuation that reads correctly either way.
 */
function clause(text: string): string {
  return text.trim().replace(/[.;,]+$/, "");
}

/** "26 September" rather than an ISO timestamp — the reader is a person. */
function plainDate(iso: string | null): string | null {
  if (!iso) return null;
  const at = new Date(iso);
  if (Number.isNaN(at.getTime())) return null;
  const month = ["January", "February", "March", "April", "May", "June", "July",
    "August", "September", "October", "November", "December"][at.getUTCMonth()];
  return `${at.getUTCDate()} ${month} ${at.getUTCFullYear()}`;
}

// ---------------------------------------------------------------------------
// the four things that can be explained
// ---------------------------------------------------------------------------

function explainDecision(root: string, d: Decision): ExplainData {
  const out: string[] = [];
  const missing: string[] = [];
  const chosen = d.options.find((o) => o.key === d.selected_option) ?? null;

  if (d.status === "LOCKED" || d.status === "SUPERSEDED") {
    out.push(chosen
      ? `You chose: ${chosen.label}.`
      : `This is settled, but the recorded choice is missing.`);
    if (chosen?.explanation) out.push(chosen.explanation);
    else missing.push("what that option actually means in plain language");

    if (d.rationale) out.push(`Why: ${clause(d.rationale)}.`);
    else missing.push("why it was chosen");

    const when = plainDate(d.approval?.at ?? null);
    if (d.approval) {
      out.push(when
        ? `${d.approval.by} approved this on ${when}.`
        : `${d.approval.by} approved this.`);
    } else {
      missing.push("who approved it");
    }
    if (d.adr) out.push(`It is written up as ${d.adr}.`);
  } else if (d.status === "PROPOSED") {
    out.push(`This is not decided yet — it is waiting on you.`);
    for (const option of d.options) {
      const lines = [`${option.label}.`];
      if (option.explanation) lines.push(option.explanation);
      if (option.tradeoffs) lines.push(`The catch: ${clause(option.tradeoffs)}.`);
      out.push(lines.join(" "));
    }
  } else if (d.status === "REJECTED") {
    out.push(d.rejected_reason
      ? `This was turned down: ${clause(d.rejected_reason)}.`
      : `This was turned down, and no reason was recorded.`);
    if (!d.rejected_reason) missing.push("why it was turned down");
  }

  // What else was on the table. This is the part people forget they were told.
  const rejected = d.alternatives_rejected
    .map((a) => {
      const option = d.options.find((o) => o.key === a.key);
      return option ? `${option.label} — ruled out: ${clause(a.reason)}` : null;
    })
    .filter((x): x is string => x !== null);
  if (rejected.length > 0) {
    out.push(`We also considered ${rejected.length === 1 ? "one other option" : `${rejected.length} other options`}. ${rejected.join(". ")}.`);
  }

  if (d.needs_review) {
    out.push(d.review_reason
      ? `This needs another look: ${clause(d.review_reason)}.`
      : `This needs another look — something it depends on has changed.`);
  }
  if (d.superseded_by) out.push(`It has since been replaced by ${d.superseded_by}.`);

  const governed = d.affects_requirements;
  if (governed.length > 0) {
    const titles = requirements(root)
      .filter((r) => governed.includes(r.id))
      .map((r) => `"${r.title}"`);
    if (titles.length > 0) {
      out.push(`It shapes how ${titles.join(", ")} ${titles.length === 1 ? "gets" : "get"} built.`);
    }
  }

  return {
    kind: "DECISION", id: d.id, title: d.title,
    paragraphs: out, related: [...governed], not_recorded: missing,
  };
}

function explainRequirement(
  root: string, r: Requirement, spec: ProductSpecification | null,
): ExplainData {
  const out: string[] = [];
  const missing: string[] = [];

  out.push(r.description);

  if (r.origin_confidence === "ASSUMED" || r.origin_confidence === "INFERRED") {
    out.push(
      r.origin_confidence === "ASSUMED"
        ? `This was assumed rather than something you said, so it is worth checking.`
        : `This was inferred from what you said, not stated outright.`,
    );
  }

  if (r.status === "CONFIRMED" && r.confirmed_by) {
    const when = plainDate(r.confirmed_at);
    out.push(when
      ? `${r.confirmed_by} confirmed this on ${when}.`
      : `${r.confirmed_by} confirmed this.`);
  } else if (r.status === "PROPOSED") {
    out.push(`Nobody has confirmed this yet, so it is still a suggestion.`);
  } else if (r.status === "REJECTED") {
    out.push(r.rejected_reason
      ? `This was ruled out: ${clause(r.rejected_reason)}.`
      : `This was ruled out, and no reason was recorded.`);
  } else if (r.status === "SUPERSEDED" && r.superseded_by) {
    out.push(`This has been replaced by ${r.superseded_by}. It is kept so the change is visible.`);
  }

  const assignment = spec?.scope.find((a) => a.requirement === r.id) ?? null;
  if (!assignment) {
    missing.push("whether this is in the first version");
  } else if (assignment.scope === "MVP") {
    out.push(`It is in the first version${assignment.reason ? `, because ${clause(assignment.reason)}` : ""}.`);
  } else if (assignment.scope === "FUTURE") {
    out.push(`It is for later, not the first version${assignment.reason ? `, because ${assignment.reason}` : ""}. That is a promise, not a deletion.`);
  } else if (assignment.scope === "OUT_OF_SCOPE") {
    out.push(`It was taken off the list${assignment.reason ? `, because ${clause(assignment.reason)}` : ""}.`);
  }

  const criteria = (spec?.criteria ?? []).filter((c) => c.requirement === r.id);
  if (criteria.length > 0) {
    out.push(`You will know it works when: ${criteria.map((c) => c.text).join(" ")}`);
  } else if (r.acceptance_criteria.length > 0) {
    out.push(`You will know it works when ${r.acceptance_criteria.join(", and ")}.`);
  } else {
    missing.push("how anyone would know it works");
  }

  const governing = decisions(root).filter((d) => d.affects_requirements.includes(r.id));
  if (governing.length > 0) {
    out.push(`Decisions that shape it: ${governing.map((d) => `"${d.title}"`).join(", ")}.`);
  }

  const doing = tasks(root).filter((t) => t.requirements.includes(r.id));
  if (doing.length === 0 && assignment?.scope === "MVP") {
    out.push(`No work has been planned for it yet.`);
  } else if (doing.length > 0) {
    const done = doing.filter((t) => t.status === "DONE" || t.status === "VERIFIED").length;
    out.push(done === doing.length
      ? `All ${doing.length === 1 ? "the work" : `${doing.length} pieces of work`} for it has been checked and finished.`
      : `${done} of ${doing.length} pieces of work for it are finished.`);
  }

  return {
    kind: "REQUIREMENT", id: r.id, title: r.title,
    paragraphs: out,
    related: [...governing.map((d) => d.id), ...doing.map((t) => t.task_id)],
    not_recorded: missing,
  };
}

function explainTask(root: string, t: Task): ExplainData {
  const out: string[] = [];
  const missing: string[] = [];

  out.push(`This is a piece of work towards ${t.requirements.join(", ")}.`);
  if (t.description) out.push(t.description);

  const stance: Partial<Record<Task["status"], string>> = {
    PENDING: `It cannot start yet — it is waiting on ${t.dependencies.join(", ") || "something else"}.`,
    READY: `Nobody has started it. It is ready to hand to an agent.`,
    RUNNING: `An agent has it now, and has not reported back.`,
    CHANGES_DETECTED: `An agent said it made changes. Nobody has checked them yet.`,
    TESTING: `Checks are under way.`,
    REVIEWING: `It is being reviewed.`,
    VERIFIED: `The evidence holds up. It is not closed yet.`,
    DONE: `Finished and closed.`,
    FAILED: `It was attempted and did not work.`,
    BLOCKED: `It cannot proceed: ${t.blocked_reason ? clause(t.blocked_reason) : "no reason was recorded"}.`,
    STALLED: `Repeated attempts got nowhere. It needs a different approach, not another try.`,
    NEEDS_HUMAN: `It needs a person.`,
  };
  out.push(stance[t.status] ?? `Its state is ${t.status}.`);

  // `task.runs` holds run ids; the records themselves live in sessions/.
  const records = runsOf(root, t);
  const latest = records[records.length - 1];
  if (latest) {
    const what = latest.result === "REPORTED" ? "made changes"
      : latest.result === null ? "has not reported back"
      : latest.result === "ABORTED" ? "gave up"
      : "stopped because a stop condition fired";
    const said = [`${latest.agent} said it ${what}`];
    if (latest.files_touched.length > 0) {
      said.push(`and touched ${latest.files_touched.length} file${latest.files_touched.length === 1 ? "" : "s"}`);
    }
    if (latest.tests) {
      said.push(`and that ${latest.tests.passed} of ${latest.tests.run} tests passed`);
    }
    out.push(`${said.join(", ")}. That is what it reported, not something MICHI watched.`);
  }

  const observed = t.verification.evidence.filter((e) => e.produced_by === "MICHI");
  if (t.verification.status === "PASSED") {
    out.push(`MICHI ran ${observed.length} check${observed.length === 1 ? "" : "s"} itself and they passed.`);
  } else if (observed.length === 0 && records.length > 0) {
    out.push(`MICHI has not checked anything here yet, so nothing about this is proven.`);
  } else if (observed.some((e) => e.exit_code !== 0)) {
    out.push(`A check MICHI ran failed. Nothing is finished while that is true.`);
  }

  if (t.acceptance_criteria.length === 0) missing.push("what would count as finished");

  return {
    kind: "TASK", id: t.task_id, title: t.title,
    paragraphs: out,
    related: [...t.requirements, ...t.dependencies],
    not_recorded: missing,
  };
}

function explainFile(root: string, path: string, reporters: Task[]): ExplainData {
  const out: string[] = [];
  const onDisk = existsSync(join(root, path));

  out.push(
    `${reporters.map((t) => t.task_id).join(", ")} reported touching this file.`,
  );
  out.push(`That is the agent's account of its own work. MICHI did not watch it being written, and a file being touched does not make it the thing that satisfies a requirement.`);

  if (!onDisk) {
    out.push(`It is not on disk now. It may have been removed after it was reported.`);
  }

  const verified = reporters.filter((t) => t.verification.status === "PASSED");
  out.push(verified.length > 0
    ? `The work ${verified.map((t) => t.task_id).join(", ")} did has since been checked against evidence MICHI gathered.`
    : `None of the work that touched it has been checked yet.`);

  const serves = [...new Set(reporters.flatMap((t) => t.requirements))];
  return {
    kind: "FILE", id: path, title: path,
    paragraphs: out,
    related: [...reporters.map((t) => t.task_id), ...serves],
    not_recorded: [],
  };
}

// ---------------------------------------------------------------------------

/** Ids are for following links; a plain-language answer should not need them. */
function stripIds(text: string): string {
  return text
    .replace(/\b(?:REQ|TASK|SESSION|RUN|REV|AC)-\d{3,}\b/g, "it")
    .replace(/\bADR-\d{3,}\b/g, "a written record")
    .replace(/\bD\d{3,}\b/g, "another decision")
    .replace(/\bit, it\b/g, "it")
    .replace(/\s{2,}/g, " ")
    .trim();
}

export function explain(options: ExplainOptions): Result<ExplainData> {
  try {
    const { root, id } = options;
    requireInitialized(root);

    let found: ExplainData | null = null;

    // An ADR id names the document; the thing being explained is the decision.
    const all = decisions(root);
    const decision = all.find((d) => d.id === id) ?? all.find((d) => d.adr === id);
    if (decision) found = explainDecision(root, decision);

    if (!found) {
      const requirement = requirements(root).find((r) => r.id === id);
      if (requirement) found = explainRequirement(root, requirement, specification(root));
    }

    if (!found) {
      const task = tasks(root).find((t) => t.task_id === id);
      if (task) found = explainTask(root, task);
    }

    if (!found) {
      const reporters = tasks(root).filter((t) => t.files_touched.includes(id));
      if (reporters.length > 0) found = explainFile(root, id, reporters);
    }

    if (!found) {
      throw new MichiError({
        class: "UNKNOWN", code: "NOT_FOUND",
        message: `"${id}" is not recorded in this project, so there is nothing to explain. ` +
          `MICHI answers from what was written down and never reconstructs an answer.`,
        detail: { id },
        next: `See what exists: ${cmd("status")}, ${cmd("decide list")} or ${cmd("task list")}.`,
      });
    }

    if (options.simple) {
      return ok({
        ...found,
        paragraphs: found.paragraphs.map(stripIds),
        related: [],
      });
    }
    return ok(found);
  } catch (e) {
    return errorPayload(MichiError.from(e));
  }
}

// ---------------------------------------------------------------------------
// impact
// ---------------------------------------------------------------------------

export interface ImpactData {
  id: string;
  title: string;
  status: string;
  requirements: string[];
  tasks: string[];
  /** Tasks an agent has already worked on — changing this means redoing them. */
  tasks_with_work: string[];
  files: string[];
  decisions: string[];
  total: number;
}

/**
 * The blast radius of changing a decision, computed from the graph rather than
 * guessed (DECISION_MODEL, "Impact analysis").
 *
 * It reports what is recorded as depending on the decision. It does not claim
 * to know what a change would cost: files arrive here because a task reported
 * touching them, which is a claim, and the renderer says so.
 */
export function impactOf(options: ExplainOptions): Result<ImpactData> {
  try {
    const { root, id } = options;
    requireInitialized(root);

    if (!/^D\d{3,}$/.test(id)) {
      throw new MichiError({
        class: "INVALID", code: "VALIDATION_ERROR",
        message: `Impact is about decisions, and "${id}" is not a decision id.`,
        detail: { id },
        next: `Decision ids look like D001. For anything else, try ${cmd(`explain ${id}`)}.`,
      });
    }

    const decision = decisions(root).find((d) => d.id === id);
    if (!decision) {
      throw new MichiError({
        class: "UNKNOWN", code: "NOT_FOUND",
        message: `${id} is not a decision this project has ever had.`,
        detail: { known: decisions(root).map((d) => d.id) },
        next: `See them all: ${cmd("decide list")}`,
      });
    }

    const graph = buildGraph(root);
    const governed = new Set(
      graph.edges
        .filter((e) => e.type === "GOVERNS" && e.from === id)
        .map((e) => e.to),
    );

    const affectedTasks = tasks(root).filter((t) =>
      t.requirements.some((r) => governed.has(r)));
    const withWork = affectedTasks.filter((t) => t.runs.length > 0);

    // Decisions that govern any of the same requirements may rest on this one.
    const siblings = decisions(root)
      .filter((d) => d.id !== id && d.status === "LOCKED"
        && d.affects_requirements.some((r) => governed.has(r)))
      .map((d) => d.id);

    const files = [...new Set(affectedTasks.flatMap((t) => t.files_touched))].sort();
    const requirementIds = [...governed].sort();
    const taskIds = affectedTasks.map((t) => t.task_id).sort();

    return ok({
      id, title: decision.title, status: decision.status,
      requirements: requirementIds,
      tasks: taskIds,
      tasks_with_work: withWork.map((t) => t.task_id).sort(),
      files,
      decisions: siblings.sort(),
      total: requirementIds.length + taskIds.length + files.length + siblings.length,
    });
  } catch (e) {
    return errorPayload(MichiError.from(e));
  }
}
