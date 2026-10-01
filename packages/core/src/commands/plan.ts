import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { z } from "zod";
import { MichiError, errorPayload } from "../errors.js";
import type { Result } from "../result.js";
import { ok } from "../result.js";
import { STATE_FILE, brainDir, readYaml, writeText, writeYaml } from "../fs/brain.js";
import { StateSchema } from "../schemas/state.js";
import { RequirementsRegistrySchema, isActive } from "../schemas/discovery.js";
import type { Requirement } from "../schemas/discovery.js";
import { RegistrySchema } from "../schemas/decision.js";
import type { Decision } from "../schemas/decision.js";
import {
  AcceptanceCriterionSchema, OutOfScopeItemSchema, PersonaSchema, SCOPE_VALUES,
  ScopeAssignmentSchema, ScopeSchema, SpecificationSchema, UseCaseSchema,
  criterionId, effectiveScope, newSpecification, outOfScopeId, personaId, useCaseId,
} from "../schemas/product.js";
import type { ProductSpecification, Scope, ScopeAssignment } from "../schemas/product.js";
import { parseOrInvalid } from "../schemas/parse.js";
import { requireInitialized } from "./scan.js";
import { cmd } from "../identity.js";

const SPEC_FILE = join("requirements", "specification.yaml");
const REQUIREMENTS_FILE = join("requirements", "requirements.yaml");
const DECISIONS_FILE = join("decisions", "index.yaml");
const PRD_FILE = join("requirements", "PRD.md");

export interface PlanOptions {
  root: string;
  now: () => string;
}

export interface PlanUpdateOptions extends PlanOptions {
  file: string;
}

// ---------------------------------------------------------------------------
// Loading
// ---------------------------------------------------------------------------

function specPath(root: string): string {
  return join(brainDir(root), SPEC_FILE);
}

/**
 * The specification, or an empty one.
 *
 * An empty specification's `updated_at` is the project's own
 * `initialized_at`, not the current time: a read must be deterministic, and
 * "nothing has touched it since the project began" is the honest answer for a
 * specification that has never been written.
 */
function loadSpec(root: string): ProductSpecification {
  const file = specPath(root);
  if (existsSync(file)) return readYaml(file, SpecificationSchema);
  const state = readYaml(join(brainDir(root), STATE_FILE), StateSchema);
  return newSpecification(state.initialized_at);
}

function saveSpec(root: string, spec: ProductSpecification, now: string): void {
  writeYaml(specPath(root), parseOrInvalid(SpecificationSchema, { ...spec, updated_at: now }, "the specification"));
}

/**
 * The requirements this specification may reference: confirmed and not
 * superseded. Phase 2 owns this store; nothing here copies its content.
 */
function activeRequirements(root: string): Requirement[] {
  const file = join(brainDir(root), REQUIREMENTS_FILE);
  if (!existsSync(file)) return [];
  return readYaml(file, RequirementsRegistrySchema).requirements.filter(isActive);
}

function lockedDecisions(root: string): Decision[] {
  const file = join(brainDir(root), DECISIONS_FILE);
  if (!existsSync(file)) return [];
  return readYaml(file, RegistrySchema).decisions.filter((d) => d.status === "LOCKED");
}

function requireRequirements(root: string): Requirement[] {
  const requirements = activeRequirements(root);
  if (requirements.length > 0) return requirements;
  throw new MichiError({
    class: "BLOCKED",
    code: "BLOCKED",
    message: "There is nothing to plan yet: this project has no confirmed requirements.",
    next: `Find out what the user wants first — run: ${cmd("discover start")}`,
  });
}

// ---------------------------------------------------------------------------
// The update document
// ---------------------------------------------------------------------------

const UpdateSchema = z
  .object({
    personas: z.array(z.object({
      name: z.string().min(1),
      description: z.string().min(1),
      goals: z.array(z.string().min(1)).default([]),
    })).optional(),
    use_cases: z.array(z.object({
      title: z.string().min(1),
      persona: z.string().min(1),
      trigger: z.string().min(1),
      steps: z.array(z.string().min(1)).min(1),
      requirements: z.array(z.string().min(1)).min(1),
    })).optional(),
    criteria: z.array(z.object({
      requirement: z.string().min(1),
      kind: z.enum(["GWT", "PLAIN"]),
      given: z.array(z.string().min(1)).optional(),
      when: z.string().min(1).optional(),
      then: z.array(z.string().min(1)).optional(),
      text: z.string().min(1).optional(),
    })).optional(),
    scope: z.array(z.object({
      requirement: z.string().min(1),
      scope: ScopeSchema,
      reason: z.string().min(1),
    })).optional(),
    out_of_scope: z.array(z.object({
      title: z.string().min(1),
      reason: z.string().min(1),
    })).optional(),
    confirm: z.object({
      scope: z.array(z.string().min(1)).default([]),
      by: z.string().min(1).optional(),
    }).optional(),
    confirm_specification: z.object({ by: z.string().min(1).optional() }).optional(),
  })
  .strict()
  .superRefine((u, ctx) => {
    // P2: whether a feature ships is the user's call, never MICHI's.
    if (u.confirm && u.confirm.scope.length > 0 && !u.confirm.by) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom, path: ["confirm", "by"],
        message: "confirm requires `by` — MICHI may not decide what ships in the first version",
      });
    }
    if (u.confirm_specification && !u.confirm_specification.by) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom, path: ["confirm_specification", "by"],
        message: "confirm_specification requires `by` — only a human can sign off a specification",
      });
    }
  });

export type PlanUpdateDocument = z.infer<typeof UpdateSchema>;

function readUpdate(file: string): PlanUpdateDocument {
  if (!existsSync(file)) {
    throw new MichiError({
      class: "UNKNOWN", code: "NOT_FOUND",
      message: `${file} does not exist.`,
      next: "Write the update file, then run the command again.",
    });
  }
  let raw: unknown;
  try {
    raw = JSON.parse(readFileSync(file, "utf8"));
  } catch (e) {
    throw new MichiError({
      class: "INVALID", code: "VALIDATION_ERROR",
      message: "The planning update is not valid JSON.",
      detail: { file, reason: e instanceof Error ? e.message : String(e) },
    });
  }
  const parsed = UpdateSchema.safeParse(raw);
  if (!parsed.success) {
    const first = parsed.error.issues[0];
    throw new MichiError({
      class: "INVALID", code: "VALIDATION_ERROR",
      message: first ? `${first.path.join(".")}: ${first.message}` : "The planning update is not valid.",
      detail: {
        file,
        issues: parsed.error.issues.map((i) => ({ path: i.path.join("."), message: i.message })),
      },
    });
  }
  return parsed.data;
}

function requirementOrFail(requirements: Requirement[], id: string, what: string): void {
  if (requirements.some((r) => r.id === id)) return;
  throw new MichiError({
    class: "UNKNOWN", code: "NOT_FOUND",
    message: `${what} points at ${id}, which is not a requirement in force on this project.`,
    detail: { active: requirements.map((r) => r.id) },
    next: "Either name a requirement that exists, or agree it with the user first.",
  });
}

// ---------------------------------------------------------------------------
// update
// ---------------------------------------------------------------------------

export interface PlanUpdateData {
  specification: ProductSpecification;
  applied: {
    personas_added: string[];
    use_cases_added: string[];
    criteria_added: string[];
    scope_proposed: string[];
    scope_confirmed: string[];
    out_of_scope_added: string[];
    specification_confirmed: boolean;
  };
}

export function planUpdate(options: PlanUpdateOptions): Result<PlanUpdateData> {
  try {
    const { root, now, file } = options;
    requireInitialized(root);
    const requirements = requireRequirements(root);
    const update = readUpdate(file);
    const timestamp = now();
    const spec = loadSpec(root);

    if (spec.status === "PUBLISHED") {
      throw new MichiError({
        class: "INVALID", code: "CONFLICT",
        message: "This specification has already been published. Nothing was changed.",
        next: "Changing it now means superseding decisions made against it — raise that with the user.",
      });
    }

    const next: ProductSpecification = {
      ...spec,
      personas: [...spec.personas],
      use_cases: [...spec.use_cases],
      criteria: [...spec.criteria],
      scope: spec.scope.map((a) => ({ ...a })),
      out_of_scope: [...spec.out_of_scope],
    };

    const applied: PlanUpdateData["applied"] = {
      personas_added: [], use_cases_added: [], criteria_added: [],
      scope_proposed: [], scope_confirmed: [], out_of_scope_added: [],
      specification_confirmed: false,
    };

    for (const persona of update.personas ?? []) {
      const id = personaId(next.next_persona_id);
      next.personas.push(parseOrInvalid(PersonaSchema, {
        ...persona, id, created_at: timestamp, updated_at: timestamp,
      }, "that persona"));
      next.next_persona_id += 1;
      applied.personas_added.push(id);
    }

    for (const useCase of update.use_cases ?? []) {
      if (!next.personas.some((p) => p.id === useCase.persona)) {
        throw new MichiError({
          class: "UNKNOWN", code: "NOT_FOUND",
          message: `"${useCase.title}" names ${useCase.persona}, which is not a persona on this project.`,
          detail: { known: next.personas.map((p) => p.id) },
        });
      }
      for (const id of useCase.requirements) {
        requirementOrFail(requirements, id, `"${useCase.title}"`);
      }
      const id = useCaseId(next.next_use_case_id);
      next.use_cases.push(parseOrInvalid(UseCaseSchema, {
        ...useCase, id, created_at: timestamp, updated_at: timestamp,
      }, "that use case"));
      next.next_use_case_id += 1;
      applied.use_cases_added.push(id);
    }

    for (const criterion of update.criteria ?? []) {
      requirementOrFail(requirements, criterion.requirement, "An acceptance criterion");
      const id = criterionId(next.next_criterion_id);
      next.criteria.push(parseOrInvalid(AcceptanceCriterionSchema, {
        id,
        requirement: criterion.requirement,
        kind: criterion.kind,
        given: criterion.given ?? [],
        when: criterion.when ?? null,
        then: criterion.then ?? [],
        text: criterion.text ?? null,
        created_at: timestamp,
        updated_at: timestamp,
      }, "that acceptance criterion"));
      next.next_criterion_id += 1;
      applied.criteria_added.push(id);
    }

    const locked = lockedDecisions(root);
    for (const assignment of update.scope ?? []) {
      requirementOrFail(requirements, assignment.requirement, "A scope decision");

      if (assignment.scope === "OUT_OF_SCOPE") {
        // Dropping work a locked decision was made for would strand that
        // decision. The fix is to supersede it deliberately (P10).
        const dependent = locked.find((d) => d.affects_requirements.includes(assignment.requirement));
        if (dependent) {
          throw new MichiError({
            class: "BLOCKED", code: "CONFLICT",
            message:
              `${assignment.requirement} cannot be dropped: ${dependent.id} ` +
              `("${dependent.title}") was decided for it and is locked.`,
            detail: { requirement: assignment.requirement, decision: dependent.id },
            next:
              `Either defer it to FUTURE instead, or supersede the decision first: ` +
              `${cmd(`decide supersede ${dependent.id} --with <new-id>`)}`,
          });
        }
      }

      // A later call replaces an earlier one: the specification records the
      // current scope, not a history of opinions about it.
      const parsed = parseOrInvalid(ScopeAssignmentSchema, {
        ...assignment, status: "PROPOSED", confirmed_by: null, confirmed_at: null,
      }, "that scope decision");
      const existing = next.scope.findIndex((a) => a.requirement === assignment.requirement);
      if (existing >= 0) next.scope[existing] = parsed;
      else next.scope.push(parsed);
      applied.scope_proposed.push(assignment.requirement);
    }

    for (const item of update.out_of_scope ?? []) {
      const id = outOfScopeId(next.next_out_of_scope_id);
      next.out_of_scope.push(parseOrInvalid(OutOfScopeItemSchema, {
        ...item, id, created_at: timestamp, updated_at: timestamp,
      }, "that out-of-scope item"));
      next.next_out_of_scope_id += 1;
      applied.out_of_scope_added.push(id);
    }

    if (update.confirm) {
      const by = update.confirm.by as string;
      for (const id of update.confirm.scope) {
        const assignment = next.scope.find((a) => a.requirement === id);
        if (!assignment) {
          throw new MichiError({
            class: "UNKNOWN", code: "NOT_FOUND",
            message: `There is no scope decision recorded for ${id} to confirm.`,
            detail: { recorded: next.scope.map((a) => a.requirement) },
          });
        }
        assignment.status = "CONFIRMED";
        assignment.confirmed_by = by;
        assignment.confirmed_at = timestamp;
        applied.scope_confirmed.push(id);
      }
    }

    if (update.confirm_specification) {
      next.status = "CONFIRMED";
      next.confirmed_by = update.confirm_specification.by as string;
      next.confirmed_at = timestamp;
      applied.specification_confirmed = true;
    }

    saveSpec(root, next, timestamp);
    return ok({ specification: next, applied });
  } catch (e) {
    return errorPayload(MichiError.from(e));
  }
}

// ---------------------------------------------------------------------------
// status / export
// ---------------------------------------------------------------------------

export interface PlanGaps {
  unplaced: string[];
  unconfirmed_scope: string[];
  mvp_without_criteria: string[];
  dangling_references: string[];
}

export interface PlanStatusData {
  specification: ProductSpecification;
  requirements: { id: string; title: string; scope: Scope }[];
  by_scope: Record<Scope, string[]>;
  unplaced: string[];
  gaps: PlanGaps;
  next_step: string;
}

function gapsOf(spec: ProductSpecification, requirements: Requirement[]): PlanGaps {
  const ids = new Set(requirements.map((r) => r.id));
  const unplaced = requirements
    .filter((r) => effectiveScope(spec.scope, r.id) === "UNKNOWN")
    .map((r) => r.id);
  const unconfirmed = spec.scope.filter((a) => a.status !== "CONFIRMED").map((a) => a.requirement);
  const withCriteria = new Set(spec.criteria.map((c) => c.requirement));
  const mvpWithout = requirements
    .filter((r) => effectiveScope(spec.scope, r.id) === "MVP" && !withCriteria.has(r.id))
    .map((r) => r.id);

  const dangling = [
    ...spec.scope.map((a) => a.requirement),
    ...spec.criteria.map((c) => c.requirement),
    ...spec.use_cases.flatMap((u) => u.requirements),
  ].filter((id) => !ids.has(id));

  return {
    unplaced,
    unconfirmed_scope: [...new Set(unconfirmed)],
    mvp_without_criteria: mvpWithout,
    dangling_references: [...new Set(dangling)],
  };
}

function summarise(root: string): PlanStatusData {
  const requirements = requireRequirements(root);
  const spec = loadSpec(root);
  const gaps = gapsOf(spec, requirements);

  const by_scope = Object.fromEntries(SCOPE_VALUES.map((s) => [s, [] as string[]])) as Record<Scope, string[]>;
  for (const r of requirements) by_scope[effectiveScope(spec.scope, r.id)].push(r.id);

  const nextStep = (): string => {
    if (spec.status === "PUBLISHED") return "The specification is published. Architecture comes next.";
    if (gaps.dangling_references.length > 0) return "Fix the references to requirements that no longer exist.";
    if (spec.personas.length === 0) return "Establish who this is for before deciding what ships.";
    if (gaps.unplaced.length > 0) {
      return `Ask the user what ships first: ${gaps.unplaced.length} requirement(s) have no scope yet.`;
    }
    if (gaps.unconfirmed_scope.length > 0) return "Ask the user to confirm the scope calls.";
    if (gaps.mvp_without_criteria.length > 0) {
      return "Write acceptance criteria for the MVP requirements, so they can be checked later.";
    }
    if (spec.status !== "CONFIRMED") return "Read the specification back to the user and ask them to confirm it.";
    return `Everything is agreed — run: ${cmd("plan close")}`;
  };

  return {
    specification: spec,
    requirements: requirements.map((r) => ({
      id: r.id, title: r.title, scope: effectiveScope(spec.scope, r.id),
    })),
    by_scope,
    unplaced: gaps.unplaced,
    gaps,
    next_step: nextStep(),
  };
}

export function planStatus(options: PlanOptions): Result<PlanStatusData> {
  try {
    requireInitialized(options.root);
    return ok(summarise(options.root));
  } catch (e) {
    return errorPayload(MichiError.from(e));
  }
}

export const planExport = planStatus;

// ---------------------------------------------------------------------------
// close
// ---------------------------------------------------------------------------

export interface PlanCloseData {
  specification: ProductSpecification;
  mvp: string[];
  future: string[];
  out_of_scope: string[];
  artifacts: string[];
  stage: string;
}

export function planClose(options: PlanOptions): Result<PlanCloseData> {
  try {
    const { root, now } = options;
    requireInitialized(root);
    const requirements = requireRequirements(root);
    const timestamp = now();
    const spec = loadSpec(root);

    if (spec.status === "PUBLISHED") {
      throw new MichiError({
        class: "INVALID", code: "CONFLICT",
        message: "This specification has already been published.",
        next: `See where the project stands: ${cmd("status")}`,
      });
    }

    const gaps = gapsOf(spec, requirements);
    const blocking =
      gaps.dangling_references.length > 0 ||
      gaps.unplaced.length > 0 ||
      gaps.unconfirmed_scope.length > 0 ||
      gaps.mvp_without_criteria.length > 0;

    if (blocking) {
      throw new MichiError({
        class: "BLOCKED", code: "CONFLICT",
        message: "The specification is not finished yet. Nothing was written.",
        detail: gaps as unknown as Record<string, unknown>,
        next: `See what is outstanding: ${cmd("plan status")}`,
      });
    }

    if (spec.status !== "CONFIRMED") {
      throw new MichiError({
        class: "BLOCKED", code: "CONFLICT",
        message: "The user has not confirmed the specification yet. Nothing was written.",
        next: "Read it back to them, then record their confirmation.",
      });
    }

    const scopeOf = (scope: Scope): string[] =>
      requirements.filter((r) => effectiveScope(spec.scope, r.id) === scope).map((r) => r.id);

    const mvp = scopeOf("MVP");
    const future = scopeOf("FUTURE");
    const outOfScope = scopeOf("OUT_OF_SCOPE");

    const brain = brainDir(root);
    writeText(join(brain, PRD_FILE), renderPrd(root, spec, requirements, timestamp));

    const published: ProductSpecification = { ...spec, status: "PUBLISHED" };
    saveSpec(root, published, timestamp);

    const statePath = join(brain, STATE_FILE);
    const state = readYaml(statePath, StateSchema);
    writeYaml(statePath, {
      ...state, stage: "ARCHITECTURE", stage_entered_at: timestamp, updated_at: timestamp,
    });

    return ok({
      specification: published,
      mvp, future, out_of_scope: outOfScope,
      artifacts: ["requirements/PRD.md"],
      stage: "ARCHITECTURE",
    });
  } catch (e) {
    return errorPayload(MichiError.from(e));
  }
}

// ---------------------------------------------------------------------------
// The PRD
// ---------------------------------------------------------------------------

const IDENTITY_FILE = join("project", "identity.md");

/**
 * Generated, never hand-edited: the specification and the requirements are the
 * source of truth, and this is a projection of them for a person to read
 * (§41's rule about compiled artifacts).
 */
function renderPrd(
  root: string,
  spec: ProductSpecification,
  requirements: Requirement[],
  now: string,
): string {
  const identityPath = join(brainDir(root), IDENTITY_FILE);
  const identity = existsSync(identityPath) ? readFileSync(identityPath, "utf8") : "";
  const problem = /## The problem\s*\n\s*\n([^\n]+)/.exec(identity)?.[1]?.trim();
  const goal = /## What it should do about it\s*\n\s*\n([^\n]+)/.exec(identity)?.[1]?.trim();

  const scoped = (scope: Scope) =>
    requirements.filter((r) => effectiveScope(spec.scope, r.id) === scope);
  const reasonFor = (id: string) =>
    spec.scope.find((a: ScopeAssignment) => a.requirement === id)?.reason ?? "";

  const lines: string[] = [
    "# Product requirements",
    "",
    "_Generated by MICHI from the project's confirmed requirements and its product",
    "specification. Do not edit this file by hand — edit the specification and",
    `regenerate._`,
    "",
    `Confirmed by ${spec.confirmed_by} · written ${now.slice(0, 10)}`,
    "",
    "## The problem",
    "",
    problem ?? "Not recorded.",
    "",
    "## What this should do about it",
    "",
    goal ?? "Not recorded.",
    "",
    "## Who it is for",
    "",
  ];

  if (spec.personas.length === 0) lines.push("Not recorded.", "");
  for (const persona of spec.personas) {
    lines.push(`### ${persona.name}`, "", persona.description, "");
    if (persona.goals.length > 0) {
      lines.push("What they are trying to do:", "");
      for (const goalText of persona.goals) lines.push(`- ${goalText}`);
      lines.push("");
    }
  }

  if (spec.use_cases.length > 0) {
    lines.push("## How it gets used", "");
    for (const useCase of spec.use_cases) {
      const who = spec.personas.find((p) => p.id === useCase.persona)?.name ?? useCase.persona;
      lines.push(`### ${useCase.id} — ${useCase.title}`, "",
        `**Who:** ${who}`, `**When:** ${useCase.trigger}`, "");
      for (const step of useCase.steps) lines.push(`1. ${step}`);
      lines.push("", `Covers: ${useCase.requirements.join(", ")}`, "");
    }
  }

  const section = (heading: string, blurb: string, scope: Scope) => {
    const items = scoped(scope);
    lines.push(`## ${heading}`, "", blurb, "");
    if (items.length === 0) {
      lines.push("Nothing.", "");
      return;
    }
    for (const r of items) {
      lines.push(`### ${r.id} — ${r.title}`, "", r.description, "");
      const reason = reasonFor(r.id);
      if (reason) lines.push(`_Why here: ${reason}_`, "");
      const criteria = spec.criteria.filter((c) => c.requirement === r.id);
      if (criteria.length > 0) {
        lines.push("How we will know it works:", "");
        for (const c of criteria) {
          if (c.kind === "GWT") {
            lines.push(`- **${c.id}** — Given ${c.given.join(" and ")}, when ${c.when}, ` +
              `then ${c.then.join(" and ")}`);
          } else {
            lines.push(`- **${c.id}** — ${c.text}`);
          }
        }
        lines.push("");
      }
    }
  };

  section("In the first version", "This is what gets built now.", "MVP");
  section("Later", "Agreed to matter, deliberately not first. Not forgotten.", "FUTURE");

  const dropped = scoped("OUT_OF_SCOPE");
  if (dropped.length > 0 || spec.out_of_scope.length > 0) {
    lines.push("## Not part of this product", "",
      "Decided against, so nobody builds them by accident.", "");
    for (const r of dropped) lines.push(`- ${r.id} — ${r.title}: ${reasonFor(r.id)}`);
    for (const item of spec.out_of_scope) lines.push(`- ${item.title}: ${item.reason}`);
    lines.push("");
  }

  lines.push("---", "",
    `${scoped("MVP").length} requirement(s) in the first version · ` +
    `${scoped("FUTURE").length} later · ` +
    `${dropped.length + spec.out_of_scope.length} ruled out`, "");
  return lines.join("\n");
}
