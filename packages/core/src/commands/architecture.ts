import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { MichiError, errorPayload } from "../errors.js";
import type { Result } from "../result.js";
import { ok } from "../result.js";
import { STATE_FILE, brainDir, readYaml, writeText, writeYaml } from "../fs/brain.js";
import { StateSchema } from "../schemas/state.js";
import { RequirementsRegistrySchema, isActive } from "../schemas/discovery.js";
import type { Requirement } from "../schemas/discovery.js";
import { RegistrySchema } from "../schemas/decision.js";
import type { Decision } from "../schemas/decision.js";
import { SpecificationSchema, effectiveScope } from "../schemas/product.js";
import type { ProductSpecification } from "../schemas/product.js";
import { requireInitialized } from "./scan.js";
import { cmd } from "../identity.js";

/**
 * Architecture.
 *
 * Phase 4 adds no decision machinery: `michi decide` already proposes options,
 * records the user's choice and writes the ADR. What architecture adds is a
 * **gate** — and one Core can actually enforce.
 *
 * Core cannot know that a project needs an authentication decision; that is
 * reasoning, and it belongs to the skill. But Core can check something better
 * than a self-declared agenda: **every requirement in the first version must be
 * governed by at least one locked decision.** A requirement nobody decided how
 * to build is the hole that matters, and an agent cannot talk its way past it.
 *
 * There is therefore no architecture state file. Everything here is derived
 * from the requirements, the specification and the decision registry.
 */

const SPEC_FILE = join("requirements", "specification.yaml");
const REQUIREMENTS_FILE = join("requirements", "requirements.yaml");
const DECISIONS_FILE = join("decisions", "index.yaml");
const SYSTEM_FILE = join("architecture", "SYSTEM.md");
const TRD_FILE = join("requirements", "TRD.md");
const IDENTITY_FILE = join("project", "identity.md");

export interface ArchitectureOptions {
  root: string;
  now: () => string;
}

interface Ground {
  spec: ProductSpecification;
  requirements: Requirement[];
  decisions: Decision[];
  mvp: Requirement[];
}

function requireGround(root: string): Ground {
  const brain = brainDir(root);
  const specPath = join(brain, SPEC_FILE);
  const spec = existsSync(specPath) ? readYaml(specPath, SpecificationSchema) : null;

  if (!spec || spec.status !== "PUBLISHED") {
    throw new MichiError({
      class: "BLOCKED",
      code: "BLOCKED",
      message:
        "There is nothing to design yet: this project has no agreed specification of what it is building first.",
      detail: { specification: spec?.status ?? "none" },
      next: spec
        ? `Finish agreeing what ships first — run: ${cmd("plan status")}`
        : `Work out what the user wants, then what ships first — run: ${cmd("discover start")}`,
    });
  }

  const requirementsPath = join(brain, REQUIREMENTS_FILE);
  const requirements = existsSync(requirementsPath)
    ? readYaml(requirementsPath, RequirementsRegistrySchema).requirements.filter(isActive)
    : [];

  const decisionsPath = join(brain, DECISIONS_FILE);
  const decisions = existsSync(decisionsPath)
    ? readYaml(decisionsPath, RegistrySchema).decisions
    : [];

  return {
    spec,
    requirements,
    decisions,
    mvp: requirements.filter((r) => effectiveScope(spec.scope, r.id) === "MVP"),
  };
}

export interface ArchitectureStatusData {
  status: "UNSET" | "PROPOSED" | "LOCKED";
  needs_review: boolean;
  /** First-version requirements with at least one locked decision governing them. */
  decided: string[];
  /** First-version requirements nobody has decided how to build. */
  undecided: string[];
  /** Which locked decisions govern each first-version requirement. */
  governing: Record<string, string[]>;
  /** Decisions proposed and still waiting on the user. */
  open_decisions: string[];
  locked_decisions: { id: string; title: string; category: string; choice: string }[];
  next_step: string;
}

function summarise(root: string): ArchitectureStatusData {
  const { spec, decisions, mvp } = requireGround(root);
  const state = readYaml(join(brainDir(root), STATE_FILE), StateSchema);

  // A superseded decision governs nothing: its replacement does.
  const locked = decisions.filter((d) => d.status === "LOCKED");
  const open = decisions.filter((d) => d.status === "PROPOSED").map((d) => d.id);

  const governing: Record<string, string[]> = {};
  for (const requirement of mvp) {
    governing[requirement.id] = locked
      .filter((d) => d.affects_requirements.includes(requirement.id))
      .map((d) => d.id);
  }

  const decided = mvp.filter((r) => (governing[r.id] ?? []).length > 0).map((r) => r.id);
  const undecided = mvp.filter((r) => (governing[r.id] ?? []).length === 0).map((r) => r.id);
  const needsReview = state.needs_review.includes("architecture");
  const specNeedsReview = state.needs_review.includes("specification");

  const nextStep = (): string => {
    if (specNeedsReview) {
      return `What the project is building changed. Settle the specification first — run: ${cmd("plan status")}`;
    }
    if (needsReview) {
      return `The specification changed since this architecture was agreed. Check the decisions still hold, then run: ${cmd("architecture close")}`;
    }
    if (open.length > 0) {
      return `${open.length} decision(s) are waiting on the user — run: ${cmd("decide")}`;
    }
    if (undecided.length > 0) {
      return `${undecided.length} first-version requirement(s) have no decided approach. Put the options to the user — run: ${cmd("decide propose --file <proposal.json>")}`;
    }
    if (state.architecture_status === "LOCKED") return "The architecture is agreed. Design comes next.";
    return `Everything in the first version has a decided approach — run: ${cmd("architecture close")}`;
  };

  return {
    status: state.architecture_status,
    needs_review: needsReview,
    decided,
    undecided,
    governing,
    open_decisions: open,
    locked_decisions: locked.map((d) => ({
      id: d.id,
      title: d.title,
      category: d.category,
      choice: d.options.find((o) => o.key === d.selected_option)?.label ?? String(d.selected_option),
    })),
    next_step: nextStep(),
  };
}

export function architectureStatus(options: ArchitectureOptions): Result<ArchitectureStatusData> {
  try {
    requireInitialized(options.root);
    return ok(summarise(options.root));
  } catch (e) {
    return errorPayload(MichiError.from(e));
  }
}

export const architectureExport = architectureStatus;

export interface ArchitectureCloseData {
  status: "LOCKED";
  decided: string[];
  locked_decisions: number;
  artifacts: string[];
  stage: string;
}

export function architectureClose(options: ArchitectureOptions): Result<ArchitectureCloseData> {
  try {
    const { root, now } = options;
    requireInitialized(root);
    const ground = requireGround(root);
    const brain = brainDir(root);
    const statePath = join(brain, STATE_FILE);
    const state = readYaml(statePath, StateSchema);
    const summary = summarise(root);

    if (state.needs_review.includes("specification")) {
      throw new MichiError({
        class: "BLOCKED", code: "CONFLICT",
        message:
          "The specification is no longer settled, so the architecture cannot be agreed on top of it. Nothing was written.",
        next: `Settle what the project is building first — run: ${cmd("plan status")}`,
      });
    }

    if (state.architecture_status === "LOCKED" && !summary.needs_review) {
      throw new MichiError({
        class: "INVALID", code: "CONFLICT",
        message: "Nothing has changed since this architecture was agreed.",
        next: `See where the project stands: ${cmd("status")}`,
      });
    }

    if (summary.undecided.length > 0 || summary.open_decisions.length > 0) {
      throw new MichiError({
        class: "BLOCKED", code: "CONFLICT",
        message: "The architecture is not settled yet. Nothing was written.",
        detail: {
          undecided_requirements: summary.undecided,
          decisions_awaiting_the_user: summary.open_decisions,
        },
        next: `See what is outstanding: ${cmd("architecture status")}`,
      });
    }

    const timestamp = now();
    writeText(join(brain, SYSTEM_FILE), renderSystem(root, ground, timestamp));
    writeText(join(brain, TRD_FILE), renderTrd(root, ground, timestamp));

    writeYaml(statePath, {
      ...state,
      stage: "DESIGN",
      stage_entered_at: timestamp,
      stage_reason: "The architecture-defining decisions are locked.",
      architecture_status: "LOCKED",
      needs_review: state.needs_review.filter((a) => a !== "architecture"),
      updated_at: timestamp,
    });

    return ok({
      status: "LOCKED",
      decided: summary.decided,
      locked_decisions: summary.locked_decisions.length,
      artifacts: ["architecture/SYSTEM.md", "requirements/TRD.md"],
      stage: "DESIGN",
    });
  } catch (e) {
    return errorPayload(MichiError.from(e));
  }
}

// ---------------------------------------------------------------------------
// Generated documents
// ---------------------------------------------------------------------------

function constraintsOf(root: string): string[] {
  const identityPath = join(brainDir(root), IDENTITY_FILE);
  if (!existsSync(identityPath)) return [];
  const text = readFileSync(identityPath, "utf8");
  const section = /## Limits we know about\s*\n\s*\n([^\n]+)/.exec(text)?.[1]?.trim();
  if (!section || section === "not recorded") return [];
  return section.split(",").map((s) => s.trim()).filter((s) => s.length > 0);
}

const live = (d: Decision) => d.status === "LOCKED";

/**
 * SYSTEM.md — the shape of the thing, in plain language.
 *
 * Generated from the locked decisions, because that is where the shape
 * actually lives. Never hand-edited.
 */
function renderSystem(root: string, ground: Ground, now: string): string {
  const locked = ground.decisions.filter(live);
  const titleOf = (id: string) => ground.requirements.find((r) => r.id === id)?.title ?? id;

  const lines: string[] = [
    "# How this is built",
    "",
    "_Generated by MICHI from the decisions you approved. Do not edit this file by",
    "hand — change a decision and regenerate._",
    "",
    `Agreed ${now.slice(0, 10)} · ${locked.length} decision(s) in force`,
    "",
    "## The short version",
    "",
  ];

  if (locked.length === 0) {
    lines.push("Nothing has been decided yet.", "");
  } else {
    for (const d of locked) {
      const choice = d.options.find((o) => o.key === d.selected_option);
      lines.push(`- **${d.title}** — ${choice?.label ?? d.selected_option}`);
    }
    lines.push("");
  }

  lines.push("## Each decision, and why", "");
  for (const d of locked) {
    const choice = d.options.find((o) => o.key === d.selected_option);
    lines.push(`### ${d.id} — ${d.title}`, "", `**What was chosen:** ${choice?.label ?? d.selected_option}`, "");
    if (choice?.explanation) lines.push(choice.explanation, "");
    if (d.rationale) lines.push(`**Why:** ${d.rationale}`, "");
    if (d.affects_requirements.length > 0) {
      lines.push("**What this is for:**", "");
      for (const id of d.affects_requirements) lines.push(`- ${id} — ${titleOf(id)}`);
      lines.push("");
    }
    const rejected = d.options.filter((o) => o.key !== d.selected_option);
    if (rejected.length > 0) {
      lines.push("**What was not chosen:**", "");
      for (const o of rejected) lines.push(`- ${o.label}${o.tradeoffs ? ` — ${o.tradeoffs}` : ""}`);
      lines.push("");
    }
    lines.push(`Written up in ${d.adr}${d.adr_file ? ` (\`decisions/${d.adr_file}\`)` : ""}.`, "");
  }

  const superseded = ground.decisions.filter((d) => d.status === "SUPERSEDED");
  if (superseded.length > 0) {
    lines.push("## Decisions this replaced", "",
      "Kept on the record, because knowing what was tried matters.", "");
    for (const d of superseded) {
      lines.push(`- ${d.id} — ${d.title} (replaced by ${d.superseded_by})`);
    }
    lines.push("");
  }

  return lines.join("\n");
}

/**
 * TRD.md — the technical requirements, assembled from locked decisions.
 *
 * Phase 3 deliberately did not write this: a technical requirements document
 * is a projection of architectural decisions, and those did not exist yet.
 */
function renderTrd(root: string, ground: Ground, now: string): string {
  const locked = ground.decisions.filter(live);
  const byCategory = new Map<string, Decision[]>();
  for (const d of locked) {
    byCategory.set(d.category, [...(byCategory.get(d.category) ?? []), d]);
  }

  const heading = (category: string) =>
    category.replace(/[_-]+/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());

  const lines: string[] = [
    "# Technical requirements",
    "",
    "_Generated by MICHI from the decisions you approved and the limits you told it",
    "about. Do not edit this file by hand._",
    "",
    `Assembled ${now.slice(0, 10)}`,
    "",
  ];

  const constraints = constraintsOf(root);
  if (constraints.length > 0) {
    lines.push("## Limits this has to work within", "",
      "Stated by you, not assumed by MICHI.", "");
    for (const c of constraints) lines.push(`- ${c}`);
    lines.push("");
  }

  if (byCategory.size === 0) {
    lines.push("Nothing has been decided yet.", "");
    return lines.join("\n");
  }

  for (const category of [...byCategory.keys()].sort()) {
    lines.push(`## ${heading(category)}`, "");
    for (const d of byCategory.get(category) ?? []) {
      const choice = d.options.find((o) => o.key === d.selected_option);
      lines.push(`**${choice?.label ?? d.selected_option}** — ${d.id}, written up in ${d.adr}.`, "");
      if (d.rationale) lines.push(d.rationale, "");
      if (d.consequences.length > 0) {
        lines.push("What follows from it:", "");
        for (const c of d.consequences) lines.push(`- ${c}`);
        lines.push("");
      }
      if (d.affects_requirements.length > 0) {
        lines.push(`Applies to: ${d.affects_requirements.join(", ")}`, "");
      }
    }
  }

  const mvp = ground.mvp.map((r) => r.id);
  lines.push("---", "",
    `Covers ${mvp.length} requirement(s) in the first version: ${mvp.join(", ")}`, "");
  return lines.join("\n");
}
