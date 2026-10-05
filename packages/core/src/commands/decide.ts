import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { z } from "zod";
import { MichiError, errorPayload } from "../errors.js";
import type { Result } from "../result.js";
import { ok } from "../result.js";
import { STATE_FILE, brainDir, readYaml, writeText, writeYaml } from "../fs/brain.js";
import { StateSchema } from "../schemas/state.js";
import { RequirementsRegistrySchema, isActive } from "../schemas/discovery.js";
import { openSession } from "./discover.js";
import {
  DecisionSchema, RegistrySchema, adrFileName, findDecision, newRegistry,
  nextAdrId, nextDecisionId,
} from "../schemas/decision.js";
import type { Decision, DecisionRegistry } from "../schemas/decision.js";
import { parseOrInvalid } from "../schemas/parse.js";
import { requireInitialized } from "./scan.js";
import { cmd } from "../identity.js";

const REGISTRY = join("decisions", "index.yaml");

export interface DecideOptions {
  root: string;
  now: () => string;
}

function registryPath(root: string): string {
  return join(brainDir(root), REGISTRY);
}

function loadRegistry(root: string): DecisionRegistry {
  const file = registryPath(root);
  if (!existsSync(file)) return newRegistry();
  return readYaml(file, RegistrySchema);
}

function saveRegistry(root: string, registry: DecisionRegistry): void {
  writeYaml(registryPath(root), RegistrySchema.parse(registry));
}

function decisionOrFail(registry: DecisionRegistry, id: string): Decision {
  const found = findDecision(registry, id);
  if (found) return found;
  throw new MichiError({
    class: "UNKNOWN",
    code: "NOT_FOUND",
    message: `${id} is not a decision on this project.`,
    detail: { known: registry.decisions.map((d) => d.id) },
    next: `See what exists: ${cmd("decide")}`,
  });
}

/** A locked decision is changed by superseding it, never by editing it (P10). */
function refuseIfSettled(decision: Decision, verb: string): void {
  if (decision.status !== "LOCKED" && decision.status !== "SUPERSEDED") return;
  throw new MichiError({
    class: "BLOCKED",
    code: "CONFLICT",
    message: `${decision.id} is ${decision.status.toLowerCase()} and cannot be ${verb}.`,
    detail: { id: decision.id, status: decision.status, selected: decision.selected_option },
    next:
      `To change it, propose a replacement and then run: ` +
      `${cmd(`decide supersede ${decision.id} --with <new-id>`)}`,
  });
}

function syncCounts(root: string, registry: DecisionRegistry, now: string): void {
  const statePath = join(brainDir(root), STATE_FILE);
  const state = readYaml(statePath, StateSchema);
  writeYaml(statePath, {
    ...state,
    counts: {
      ...state.counts,
      decisions_locked: registry.decisions.filter((d) => d.status === "LOCKED").length,
      decisions_open: registry.decisions.filter((d) => d.status === "PROPOSED").length,
    },
    updated_at: now,
  });
}

// ---------------------------------------------------------------------------
// propose
// ---------------------------------------------------------------------------

/**
 * Options must carry a plain-language explanation. A founder cannot choose
 * between four labels they have never heard of, and a menu with no reasoning
 * is not the decision workflow — it is an interrogation (P11).
 */
const ProposalSchema = z
  .object({
    title: z.string().min(1),
    type: z.enum(["product", "engineering"]),
    category: z.string().min(1),
    options: z
      .array(z.object({
        key: z.string().min(1),
        label: z.string().min(1),
        explanation: z.string().min(1, "each option needs a plain-language explanation"),
        tradeoffs: z.string().min(1, "each option needs its tradeoffs stated").nullable().default(null),
      }))
      .min(2, "a decision needs at least two options; one option is not a choice"),
    affects_requirements: z.array(z.string()).default([]),
    affects_components: z.array(z.string()).default([]),
  })
  .strict();

export interface ProposeOptions extends DecideOptions {
  file: string;
}

function readJsonFile<T>(file: string, schema: z.ZodType<T, z.ZodTypeDef, unknown>, what: string): T {
  if (!existsSync(file)) {
    throw new MichiError({
      class: "UNKNOWN",
      code: "NOT_FOUND",
      message: `${file} does not exist.`,
      next: `Write the ${what}, then run the command again.`,
    });
  }
  let raw: unknown;
  try {
    raw = JSON.parse(readFileSync(file, "utf8"));
  } catch (e) {
    throw new MichiError({
      class: "INVALID",
      code: "VALIDATION_ERROR",
      message: `The ${what} is not valid JSON.`,
      detail: { file, reason: e instanceof Error ? e.message : String(e) },
    });
  }
  const parsed = schema.safeParse(raw);
  if (!parsed.success) {
    const first = parsed.error.issues[0];
    throw new MichiError({
      class: "INVALID",
      code: "VALIDATION_ERROR",
      message: first ? `${first.path.join(".")}: ${first.message}` : `The ${what} is not valid.`,
      detail: {
        file,
        issues: parsed.error.issues.map((i) => ({ path: i.path.join("."), message: i.message })),
      },
    });
  }
  return parsed.data;
}

export function decidePropose(options: ProposeOptions): Result<{ decision: Decision }> {
  try {
    const { root, now, file } = options;
    requireInitialized(root);
    const proposal = readJsonFile(file, ProposalSchema, "proposal");

    // A decision claiming to govern a requirement that does not exist breaks
    // the traceability the architecture gate depends on.
    //
    // A decision may legitimately be proposed mid-discovery — the user agrees
    // a requirement and the technical choice it forces in the same
    // conversation — so a requirement confirmed in the open session counts,
    // even though it has not been merged into the registry yet.
    if (proposal.affects_requirements.length > 0) {
      const registryFile = join(brainDir(root), "requirements", "requirements.yaml");
      const known = new Set(
        existsSync(registryFile)
          ? readYaml(registryFile, RequirementsRegistrySchema).requirements.filter(isActive).map((r) => r.id)
          : [],
      );
      for (const r of openSession(root)?.requirements ?? []) {
        if (r.status === "CONFIRMED") known.add(r.id);
      }
      const unknown = proposal.affects_requirements.filter((id) => !known.has(id));
      if (unknown.length > 0) {
        throw new MichiError({
          class: "UNKNOWN", code: "NOT_FOUND",
          message:
            `This decision says it is for ${unknown.join(", ")}, which ${unknown.length === 1 ? "is not a requirement" : "are not requirements"} in force on this project.`,
          detail: { unknown, active: [...known].sort() },
          next: "Name a requirement the user has confirmed, or leave the list empty.",
        });
      }
    }

    const registry = loadRegistry(root);
    const timestamp = now();

    const decision = parseOrInvalid(DecisionSchema, {
      id: nextDecisionId(registry),
      title: proposal.title,
      type: proposal.type,
      category: proposal.category,
      status: "PROPOSED",
      options: proposal.options,
      selected_option: null,
      rationale: null,
      alternatives_rejected: [],
      consequences: [],
      approval: null,
      adr: null,
      adr_file: null,
      affects_requirements: proposal.affects_requirements,
      affects_components: proposal.affects_components,
      supersedes: null,
      superseded_by: null,
      rejected_reason: null,
      created_at: timestamp,
      updated_at: timestamp,
    }, "that proposal");

    registry.decisions.push(decision);
    registry.next_decision_id += 1;
    saveRegistry(root, registry);
    syncCounts(root, registry, timestamp);
    return ok({ decision });
  } catch (e) {
    return errorPayload(MichiError.from(e));
  }
}

// ---------------------------------------------------------------------------
// confirm
// ---------------------------------------------------------------------------

export interface ConfirmOptions extends DecideOptions {
  id: string;
  choice: string;
  by: string;
  rationale: string;
  adrFile: string;
}

export function decideConfirm(options: ConfirmOptions): Result<{ decision: Decision; adr_path: string }> {
  try {
    const { root, now, id, choice, by, rationale, adrFile } = options;
    requireInitialized(root);
    const registry = loadRegistry(root);
    const decision = decisionOrFail(registry, id);
    refuseIfSettled(decision, "confirmed again");

    if (!existsSync(adrFile)) {
      throw new MichiError({
        class: "UNKNOWN",
        code: "NOT_FOUND",
        message: `The ADR body ${adrFile} does not exist.`,
        next:
          "Write the reasoning as a Markdown file first — a locked decision " +
          "without an ADR is how a project forgets why it is shaped this way.",
      });
    }

    if (!decision.options.some((o) => o.key === choice)) {
      throw new MichiError({
        class: "INVALID",
        code: "VALIDATION_ERROR",
        message: `"${choice}" is not one of the options offered for ${id}.`,
        detail: { offered: decision.options.map((o) => o.key) },
      });
    }

    const timestamp = now();
    const adrId = nextAdrId(registry);
    const fileName = adrFileName(adrId, decision.title);

    const updated = DecisionSchema.parse({
      ...decision,
      status: "LOCKED",
      selected_option: choice,
      rationale,
      alternatives_rejected: decision.options
        .filter((o) => o.key !== choice)
        .map((o) => ({ key: o.key, reason: o.tradeoffs ?? "Not chosen." })),
      approval: { by, at: timestamp },
      adr: adrId,
      adr_file: fileName,
      updated_at: timestamp,
    });

    const adrPath = join(brainDir(root), "decisions", fileName);
    writeText(adrPath, renderAdr(updated, readFileSync(adrFile, "utf8")));

    registry.decisions = registry.decisions.map((d) => (d.id === id ? updated : d));
    registry.next_adr_id += 1;
    saveRegistry(root, registry);
    syncCounts(root, registry, timestamp);
    return ok({ decision: updated, adr_path: adrPath });
  } catch (e) {
    return errorPayload(MichiError.from(e));
  }
}

/**
 * The frontmatter is deliberately thin (DECISION_MODEL.md): an ADR identifies
 * itself and names its decision. Status, approval and supersession live in the
 * registry only — duplicating them here guarantees the two copies disagree the
 * first time a decision is superseded.
 */
function renderAdr(decision: Decision, body: string): string {
  const chosen = decision.options.find((o) => o.key === decision.selected_option);
  const lines = [
    "---",
    `adr: ${decision.adr}`,
    `decision: ${decision.id}`,
    `title: ${decision.title}`,
    `date: ${decision.approval?.at.slice(0, 10) ?? ""}`,
    "---",
    "",
    `# ${decision.adr} — ${decision.title}`,
    "",
    "## Decision",
    "",
    chosen ? chosen.label : String(decision.selected_option),
    "",
  ];
  if (chosen?.explanation) lines.push("## In plain language", "", chosen.explanation, "");
  lines.push("## Why", "", body.trim(), "");
  const rejected = decision.options.filter((o) => o.key !== decision.selected_option);
  if (rejected.length > 0) {
    lines.push("## Alternatives considered", "", "| Option | Why not |", "|---|---|");
    for (const o of rejected) lines.push(`| ${o.label} | ${o.tradeoffs ?? "Not chosen."} |`);
    lines.push("");
  }
  lines.push("## Approved by", "", `${decision.approval?.by}, ${decision.approval?.at.slice(0, 10)}.`, "");
  return lines.join("\n");
}

// ---------------------------------------------------------------------------
// reject / supersede / read
// ---------------------------------------------------------------------------

export interface RejectOptions extends DecideOptions {
  id: string;
  reason: string;
}

export function decideReject(options: RejectOptions): Result<{ decision: Decision }> {
  try {
    const { root, now, id, reason } = options;
    requireInitialized(root);
    const registry = loadRegistry(root);
    const decision = decisionOrFail(registry, id);
    refuseIfSettled(decision, "rejected");

    const timestamp = now();
    const updated = DecisionSchema.parse({
      ...decision, status: "REJECTED", rejected_reason: reason, updated_at: timestamp,
    });
    registry.decisions = registry.decisions.map((d) => (d.id === id ? updated : d));
    saveRegistry(root, registry);
    syncCounts(root, registry, timestamp);
    return ok({ decision: updated });
  } catch (e) {
    return errorPayload(MichiError.from(e));
  }
}

export interface SupersedeOptions extends DecideOptions {
  id: string;
  withId: string;
}

export function decideSupersede(
  options: SupersedeOptions,
): Result<{ superseded: Decision; replacement: Decision }> {
  try {
    const { root, now, id, withId } = options;
    requireInitialized(root);
    const registry = loadRegistry(root);
    const old = decisionOrFail(registry, id);
    const replacement = decisionOrFail(registry, withId);

    if (old.status !== "LOCKED") {
      throw new MichiError({
        class: "INVALID", code: "CONFLICT",
        message: `${id} is ${old.status.toLowerCase()}; only a locked decision can be superseded.`,
      });
    }
    if (replacement.status !== "LOCKED") {
      throw new MichiError({
        class: "INVALID", code: "CONFLICT",
        message: `${withId} is ${replacement.status.toLowerCase()}; a replacement must itself be locked first.`,
        next: `Confirm it: ${cmd(`decide confirm ${withId} --choice <key> --by user --adr <file>`)}`,
      });
    }

    const timestamp = now();
    // The old decision is marked, never deleted, and its ADR is left exactly
    // as written — it is an accurate record of what was decided then.
    const supersededOld = DecisionSchema.parse({
      ...old, status: "SUPERSEDED", superseded_by: withId, updated_at: timestamp,
    });
    const linkedNew = DecisionSchema.parse({
      ...replacement, supersedes: id, updated_at: timestamp,
    });

    registry.decisions = registry.decisions.map((d) =>
      d.id === id ? supersededOld : d.id === withId ? linkedNew : d,
    );
    saveRegistry(root, registry);
    syncCounts(root, registry, timestamp);
    return ok({ superseded: supersededOld, replacement: linkedNew });
  } catch (e) {
    return errorPayload(MichiError.from(e));
  }
}

export function decideList(options: DecideOptions): Result<{ decisions: Decision[] }> {
  try {
    requireInitialized(options.root);
    return ok({ decisions: loadRegistry(options.root).decisions });
  } catch (e) {
    return errorPayload(MichiError.from(e));
  }
}

export function decideShow(
  options: DecideOptions & { id: string },
): Result<{ decision: Decision; adr_text: string | null }> {
  try {
    const { root, id } = options;
    requireInitialized(root);
    const decision = decisionOrFail(loadRegistry(root), id);
    const adrPath = decision.adr_file ? join(brainDir(root), "decisions", decision.adr_file) : null;
    return ok({
      decision,
      adr_text: adrPath && existsSync(adrPath) ? readFileSync(adrPath, "utf8") : null,
    });
  } catch (e) {
    return errorPayload(MichiError.from(e));
  }
}
