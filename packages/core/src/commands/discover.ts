import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { z } from "zod";
import { MichiError, errorPayload } from "../errors.js";
import type { Result } from "../result.js";
import { ok } from "../result.js";
import { STATE_FILE, brainDir, readYaml, writeText, writeYaml } from "../fs/brain.js";
import { StateSchema } from "../schemas/state.js";
import {
  ConfidenceSchema, INTENT_FIELDS, RequirementSchema, RequirementsRegistrySchema,
  SessionSchema, isActive, newRequirementsRegistry, newSession, questionId,
  requirementId, titleKey,
} from "../schemas/discovery.js";
import type {
  DiscoverySession, Intent, IntentFieldName, Requirement, RequirementsRegistry,
  SessionState,
} from "../schemas/discovery.js";
import { requireInitialized } from "./scan.js";
import { cmd } from "../identity.js";

const SESSIONS = "sessions";
const SESSION_PATTERN = /^SESSION-(\d{3,})\.yaml$/;

export interface DiscoverOptions {
  root: string;
  now: () => string;
}

export interface AnswerOptions extends DiscoverOptions {
  file: string;
}

// ---------------------------------------------------------------------------
// The update document
// ---------------------------------------------------------------------------

const intentFieldInput = z.object({
  value: z.unknown(),
  confidence: ConfidenceSchema,
});

const UpdateSchema = z
  .object({
    intent: z.record(z.string(), intentFieldInput).optional(),
    answers: z
      .array(z.object({
        key: z.string().min(1),
        value: z.unknown(),
        confidence: ConfidenceSchema,
        question: z.string().min(1),
      }))
      .optional(),
    questions: z.array(z.object({ text: z.string().min(1), why: z.string().min(1) })).optional(),
    resolve_questions: z.array(z.string().min(1)).optional(),
    requirements: z
      .array(z.object({
        title: z.string().min(1),
        description: z.string().min(1),
        type: z.enum(["functional", "non_functional", "constraint"]),
        priority: z.enum(["high", "medium", "low"]),
        origin_confidence: ConfidenceSchema,
        acceptance_criteria: z.array(z.string().min(1)).min(1),
        /** OQ-007: required when this replaces an active requirement. */
        supersedes: z.string().regex(/^REQ-\d{3,}$/).optional(),
      }))
      .optional(),
    confirm: z
      .object({ requirements: z.array(z.string().min(1)).default([]), by: z.string().min(1).optional() })
      .optional(),
    reject: z
      .object({
        requirements: z.array(z.string().min(1)).default([]),
        by: z.string().min(1).optional(),
        reason: z.string().min(1).optional(),
      })
      .optional(),
    confirm_intent: z.object({ by: z.string().min(1).optional() }).optional(),
  })
  .strict()
  .superRefine((u, ctx) => {
    // P2, mechanically: there is no path to a confirmation that does not name
    // the human who gave it.
    if (u.confirm && u.confirm.requirements.length > 0 && !u.confirm.by) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["confirm", "by"],
        message: "confirm requires `by` — MICHI may not confirm a requirement on the user's behalf",
      });
    }
    if (u.confirm_intent && !u.confirm_intent.by) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["confirm_intent", "by"],
        message: "confirm_intent requires `by` — only a human can confirm intent",
      });
    }
    if (u.intent) {
      for (const key of Object.keys(u.intent)) {
        if (!(INTENT_FIELDS as readonly string[]).includes(key)) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            path: ["intent", key],
            message: `unknown intent field "${key}"; expected one of ${INTENT_FIELDS.join(", ")}`,
          });
        }
      }
    }
  });

export type DiscoveryUpdate = z.infer<typeof UpdateSchema>;

// ---------------------------------------------------------------------------
// The requirements registry — project-level, per OQ-007
// ---------------------------------------------------------------------------

const REQUIREMENTS = join("requirements", "requirements.yaml");

function registryPath(root: string): string {
  return join(brainDir(root), REQUIREMENTS);
}

function loadRequirements(root: string, now: string): RequirementsRegistry {
  const file = registryPath(root);
  if (!existsSync(file)) return newRequirementsRegistry(now);
  return readYaml(file, RequirementsRegistrySchema);
}

function saveRequirements(root: string, registry: RequirementsRegistry, now: string): void {
  writeYaml(registryPath(root), RequirementsRegistrySchema.parse({ ...registry, updated_at: now }));
}

/**
 * Every requirement in force across the project: those already merged into the
 * registry, plus those this session has confirmed but not yet closed.
 */
function activeRequirements(
  registry: RequirementsRegistry,
  session: DiscoverySession,
): Requirement[] {
  return [...registry.requirements, ...session.requirements].filter(isActive);
}

// ---------------------------------------------------------------------------
// Session storage
// ---------------------------------------------------------------------------

function sessionsDir(root: string): string {
  return join(brainDir(root), SESSIONS);
}

function sessionFile(root: string, id: string): string {
  return join(sessionsDir(root), `${id}.yaml`);
}

function listSessionIds(root: string): string[] {
  const dir = sessionsDir(root);
  if (!existsSync(dir)) return [];
  return readdirSync(dir)
    .map((f) => SESSION_PATTERN.exec(f))
    .filter((m): m is RegExpExecArray => m !== null)
    .map((m) => `SESSION-${m[1]}`)
    .sort();
}

function loadSession(root: string, id: string): DiscoverySession {
  return readYaml(sessionFile(root, id), SessionSchema);
}

/** The one session that is not finished, if there is one. */
function findOpenSession(root: string): DiscoverySession | null {
  for (const id of listSessionIds(root).reverse()) {
    const session = loadSession(root, id);
    if (session.status !== "COMPLETED") return session;
  }
  return null;
}

/** Read-only: the open session if there is one, for other commands to report on. */
export function openSession(root: string): DiscoverySession | null {
  return findOpenSession(root);
}

function requireOpenSession(root: string): DiscoverySession {
  const session = findOpenSession(root);
  if (session) return session;
  throw new MichiError({
    class: "UNKNOWN",
    code: "NOT_FOUND",
    message: "There is no discovery session open.",
    next: `Run: ${cmd("discover start")}`,
  });
}

/**
 * The session's state is derived from its contents after every update, never
 * asserted by the caller — which is what stops an agent declaring itself
 * finished. `CONFIRMED` is the exception: it needs a human, so it cannot be
 * computed, only witnessed.
 */
export function computeStatus(session: DiscoverySession): SessionState {
  if (session.closed_at) return "COMPLETED";

  const requirements = session.requirements;
  const outstanding =
    session.open_questions.length > 0 || requirements.some((r) => r.status === "PROPOSED");
  const ready = requirements.some((r) => r.status === "CONFIRMED") && !outstanding;

  if (ready) return session.intent_confirmed_by ? "CONFIRMED" : "READY_FOR_CONFIRMATION";

  const touched =
    session.answers.length > 0 ||
    requirements.length > 0 ||
    session.open_questions.length > 0 ||
    Object.values(session.intent).some((f) => f.confidence !== "UNKNOWN");

  return touched ? "GATHERING" : "STARTED";
}

function persist(root: string, session: DiscoverySession, now: string): DiscoverySession {
  const next: DiscoverySession = { ...session, updated_at: now };
  next.status = computeStatus(next);
  writeYaml(sessionFile(root, next.session_id), SessionSchema.parse(next));
  return next;
}

// ---------------------------------------------------------------------------
// start
// ---------------------------------------------------------------------------

export interface StartData {
  session: DiscoverySession;
  resumed: boolean;
  /** Requirements already in force on the project (OQ-007: discovery is cumulative). */
  existing_requirements: number;
}

export function discoverStart(options: DiscoverOptions): Result<StartData> {
  try {
    const { root, now } = options;
    requireInitialized(root);

    const timestamp = now();
    const existing = loadRequirements(root, timestamp).requirements.filter(isActive).length;

    const open = findOpenSession(root);
    if (open) return ok({ session: open, resumed: true, existing_requirements: existing });

    const count = listSessionIds(root).length;
    const id = `SESSION-${String(count + 1).padStart(3, "0")}`;
    const session = newSession({ id, now: timestamp });
    writeYaml(sessionFile(root, id), session);
    return ok({ session, resumed: false, existing_requirements: existing });
  } catch (e) {
    return errorPayload(MichiError.from(e));
  }
}

// ---------------------------------------------------------------------------
// answer
// ---------------------------------------------------------------------------

export interface AnswerData {
  session: DiscoverySession;
  applied: {
    intent_fields: number;
    answers: number;
    questions_opened: number;
    questions_resolved: number;
    requirements_added: string[];
    requirements_confirmed: string[];
    requirements_rejected: string[];
    intent_confirmed: boolean;
  };
}

function readUpdate(file: string): DiscoveryUpdate {
  if (!existsSync(file)) {
    throw new MichiError({
      class: "UNKNOWN",
      code: "NOT_FOUND",
      message: `${file} does not exist.`,
      next: "Write the update file, then run the command again.",
    });
  }
  let raw: unknown;
  try {
    raw = JSON.parse(readFileSync(file, "utf8"));
  } catch (e) {
    throw new MichiError({
      class: "INVALID",
      code: "VALIDATION_ERROR",
      message: "The update file is not valid JSON.",
      detail: { file, reason: e instanceof Error ? e.message : String(e) },
    });
  }
  const parsed = UpdateSchema.safeParse(raw);
  if (!parsed.success) {
    const first = parsed.error.issues[0];
    throw new MichiError({
      class: "INVALID",
      code: "VALIDATION_ERROR",
      message: first ? `${first.path.join(".")}: ${first.message}` : "The update file is not valid.",
      detail: {
        file,
        issues: parsed.error.issues.map((i) => ({ path: i.path.join("."), message: i.message })),
      },
    });
  }
  return parsed.data;
}

function requirementOrFail(session: DiscoverySession, id: string): Requirement {
  const found = session.requirements.find((r) => r.id === id);
  if (found) return found;
  throw new MichiError({
    class: "UNKNOWN",
    code: "NOT_FOUND",
    message: `${id} is not a requirement in this session.`,
    detail: { known: session.requirements.map((r) => r.id) },
  });
}

export function discoverAnswer(options: AnswerOptions): Result<AnswerData> {
  try {
    const { root, now, file } = options;
    requireInitialized(root);
    const session = requireOpenSession(root);
    const update = readUpdate(file);
    const timestamp = now();

    const applied: AnswerData["applied"] = {
      intent_fields: 0,
      answers: 0,
      questions_opened: 0,
      questions_resolved: 0,
      requirements_added: [],
      requirements_confirmed: [],
      requirements_rejected: [],
      intent_confirmed: false,
    };

    const next: DiscoverySession = {
      ...session,
      intent: { ...session.intent },
      answers: [...session.answers],
      open_questions: [...session.open_questions],
      requirements: session.requirements.map((r) => ({ ...r })),
    };

    if (update.intent) {
      for (const [key, field] of Object.entries(update.intent)) {
        (next.intent as Intent)[key as IntentFieldName] = {
          value: (field.value ?? null) as never,
          confidence: field.confidence,
        };
        applied.intent_fields += 1;
      }
    }

    for (const answer of update.answers ?? []) {
      // A later answer to the same question supersedes the earlier one; the
      // session records current knowledge, not a transcript.
      const existing = next.answers.findIndex((a) => a.key === answer.key);
      const record = {
        key: answer.key,
        value: (answer.value ?? null) as never,
        confidence: answer.confidence,
        question: answer.question,
        recorded_at: timestamp,
      };
      if (existing >= 0) next.answers[existing] = record;
      else next.answers.push(record);
      applied.answers += 1;
    }

    for (const question of update.questions ?? []) {
      next.open_questions.push({
        id: questionId(next.next_question_number),
        text: question.text,
        why: question.why,
        asked_at: timestamp,
      });
      next.next_question_number += 1;
      applied.questions_opened += 1;
    }

    for (const id of update.resolve_questions ?? []) {
      const before = next.open_questions.length;
      next.open_questions = next.open_questions.filter((q) => q.id !== id);
      if (next.open_questions.length === before) {
        throw new MichiError({
          class: "UNKNOWN",
          code: "NOT_FOUND",
          message: `${id} is not an open question in this session.`,
          detail: { open: next.open_questions.map((q) => q.id) },
        });
      }
      applied.questions_resolved += 1;
    }

    const registry = loadRequirements(root, timestamp);
    let allocated = 0;

    for (const draft of update.requirements ?? []) {
      const active = activeRequirements(registry, next);

      if (draft.supersedes) {
        if (!active.some((r) => r.id === draft.supersedes)) {
          throw new MichiError({
            class: "UNKNOWN",
            code: "NOT_FOUND",
            message: `${draft.supersedes} is not an active requirement, so nothing can replace it.`,
            detail: { active: active.map((r) => r.id) },
          });
        }
      } else {
        // OQ-007: a restatement of something already agreed is refused rather
        // than quietly becoming a second, near-identical requirement.
        const clash = active.find((r) => titleKey(r.title) === titleKey(draft.title));
        if (clash) {
          throw new MichiError({
            class: "INVALID",
            code: "CONFLICT",
            message:
              `"${draft.title}" repeats ${clash.id}, which the user has already confirmed.`,
            detail: { existing: clash.id, existing_title: clash.title },
            next:
              `If this is meant to replace it, add "supersedes": "${clash.id}" to the ` +
              `requirement. Nothing is deleted either way.`,
          });
        }
      }

      const id = requirementId(registry.next_requirement_id + allocated);
      allocated += 1;
      next.requirements.push(
        RequirementSchema.parse({
          ...draft,
          supersedes: draft.supersedes ?? null,
          id,
          status: "PROPOSED",
          confirmed_by: null,
          confirmed_at: null,
          confirmed_in: null,
          superseded_by: null,
          rejected_reason: null,
          created_at: timestamp,
          updated_at: timestamp,
        }),
      );
      applied.requirements_added.push(id);
    }

    // The number is spent at proposal time, even if the proposal is rejected.
    if (allocated > 0) {
      saveRequirements(
        root,
        { ...registry, next_requirement_id: registry.next_requirement_id + allocated },
        timestamp,
      );
    }

    if (update.confirm) {
      const by = update.confirm.by as string;
      for (const id of update.confirm.requirements) {
        const requirement = requirementOrFail(next, id);
        requirement.status = "CONFIRMED";
        requirement.confirmed_by = by;
        requirement.confirmed_at = timestamp;
        requirement.confirmed_in = next.session_id;
        requirement.updated_at = timestamp;
        applied.requirements_confirmed.push(id);
      }
    }

    if (update.reject) {
      for (const id of update.reject.requirements) {
        const requirement = requirementOrFail(next, id);
        requirement.status = "REJECTED";
        requirement.rejected_reason = update.reject.reason ?? null;
        requirement.updated_at = timestamp;
        applied.requirements_rejected.push(id);
      }
    }

    if (update.confirm_intent) {
      next.intent_confirmed_by = update.confirm_intent.by as string;
      next.intent_confirmed_at = timestamp;
      applied.intent_confirmed = true;
    }

    return ok({ session: persist(root, next, timestamp), applied });
  } catch (e) {
    return errorPayload(MichiError.from(e));
  }
}

// ---------------------------------------------------------------------------
// status / export
// ---------------------------------------------------------------------------

export interface StatusData {
  session: DiscoverySession;
  known: string[];
  inferred: string[];
  assumed: string[];
  unknown: string[];
  open_questions: { id: string; text: string; why: string }[];
  requirements: { proposed: number; confirmed: number; rejected: number };
  next_step: string;
}

function summarise(session: DiscoverySession): StatusData {
  const buckets: Record<string, string[]> = { STATED: [], INFERRED: [], ASSUMED: [], UNKNOWN: [] };
  for (const field of INTENT_FIELDS) {
    buckets[session.intent[field].confidence]?.push(field);
  }
  const count = (status: Requirement["status"]) =>
    session.requirements.filter((r) => r.status === status).length;

  const nextStep = (): string => {
    if (session.status === "COMPLETED") return "Discovery is done.";
    if (session.open_questions.length > 0) return "Ask the user the open questions.";
    if (count("PROPOSED") > 0) return "Ask the user to confirm or reject the proposed requirements.";
    if (session.status === "READY_FOR_CONFIRMATION") {
      return "Restate the understanding and ask the user to confirm it.";
    }
    if (session.requirements.length === 0) return "Turn what the user said into draft requirements.";
    return "Keep clarifying what is still unknown.";
  };

  return {
    session,
    known: buckets.STATED ?? [],
    inferred: buckets.INFERRED ?? [],
    assumed: buckets.ASSUMED ?? [],
    unknown: buckets.UNKNOWN ?? [],
    open_questions: session.open_questions.map((q) => ({ id: q.id, text: q.text, why: q.why })),
    requirements: {
      proposed: count("PROPOSED"),
      confirmed: count("CONFIRMED"),
      rejected: count("REJECTED"),
    },
    next_step: nextStep(),
  };
}

export function discoverStatus(options: DiscoverOptions): Result<StatusData> {
  try {
    requireInitialized(options.root);
    return ok(summarise(requireOpenSession(options.root)));
  } catch (e) {
    return errorPayload(MichiError.from(e));
  }
}

export function discoverExport(options: DiscoverOptions): Result<StatusData> {
  try {
    requireInitialized(options.root);
    const session = findOpenSession(options.root) ?? lastSession(options.root);
    return ok(summarise(session));
  } catch (e) {
    return errorPayload(MichiError.from(e));
  }
}

function lastSession(root: string): DiscoverySession {
  const ids = listSessionIds(root);
  const last = ids[ids.length - 1];
  if (!last) {
    throw new MichiError({
      class: "UNKNOWN",
      code: "NOT_FOUND",
      message: "No discovery session exists yet.",
      next: `Run: ${cmd("discover start")}`,
    });
  }
  return loadSession(root, last);
}

// ---------------------------------------------------------------------------
// close
// ---------------------------------------------------------------------------

export interface CloseData {
  session: DiscoverySession;
  /** Confirmed in this session. */
  requirements_written: number;
  /** In force across the project once this session is merged in. */
  requirements_total: number;
  superseded: { old: string; by: string }[];
  artifacts: string[];
  stage: string;
}

export function discoverClose(options: DiscoverOptions): Result<CloseData> {
  try {
    const { root, now } = options;
    requireInitialized(root);
    const session = requireOpenSession(root);

    if (session.status !== "CONFIRMED") {
      throw new MichiError({
        class: "BLOCKED",
        code: "CONFLICT",
        message:
          `Discovery is not confirmed yet (it is ${session.status}). Nothing was written.`,
        detail: {
          status: session.status,
          open_questions: session.open_questions.length,
          proposed_requirements: session.requirements.filter((r) => r.status === "PROPOSED").length,
        },
        next: `See what is outstanding: ${cmd("discover status")}`,
      });
    }

    const timestamp = now();
    const confirmed = session.requirements.filter((r) => r.status === "CONFIRMED");
    const brain = brainDir(root);

    // OQ-007: merge into the project's requirement set, never replace it. A
    // requirement another session confirmed is not removed by closing this one.
    const registry = loadRequirements(root, timestamp);
    const merged: Requirement[] = [...registry.requirements, ...confirmed];

    const superseded: { old: string; by: string }[] = [];
    for (const requirement of confirmed) {
      if (!requirement.supersedes) continue;
      const replaced = merged.find((r) => r.id === requirement.supersedes);
      if (!replaced) {
        throw new MichiError({
          class: "INVALID",
          code: "CONFLICT",
          message:
            `${requirement.id} says it replaces ${requirement.supersedes}, which is not ` +
            `in this project's requirements. Nothing was written.`,
        });
      }
      replaced.status = "SUPERSEDED";
      replaced.superseded_by = requirement.id;
      replaced.updated_at = timestamp;
      superseded.push({ old: replaced.id, by: requirement.id });
    }

    saveRequirements(root, { ...registry, requirements: merged }, timestamp);
    writeText(join(brain, "project", "identity.md"), identityDocument(session, timestamp));

    const closed: DiscoverySession = { ...session, closed_at: timestamp, updated_at: timestamp };
    closed.status = computeStatus(closed);
    writeYaml(sessionFile(root, closed.session_id), SessionSchema.parse(closed));

    const statePath = join(brain, STATE_FILE);
    const state = readYaml(statePath, StateSchema);
    writeYaml(statePath, {
      ...state,
      stage: "SPECIFICATION",
      stage_entered_at: timestamp,
      // The count is of requirements still in force, not of everything ever
      // written: a superseded requirement is kept but no longer counted.
      counts: { ...state.counts, requirements: merged.filter(isActive).length },
      updated_at: timestamp,
    });

    return ok({
      session: closed,
      requirements_written: confirmed.length,
      requirements_total: merged.filter(isActive).length,
      superseded,
      artifacts: ["requirements/requirements.yaml", "project/identity.md"],
      stage: "SPECIFICATION",
    });
  } catch (e) {
    return errorPayload(MichiError.from(e));
  }
}

const show = (value: unknown): string =>
  Array.isArray(value) ? value.join(", ") : value === null ? "not recorded" : String(value);

/** Plain language, because the person who has to recognise their own idea in it cannot code (P11). */
function identityDocument(session: DiscoverySession, now: string): string {
  const { intent } = session;
  const lines = [
    "# What we are building",
    "",
    `Confirmed by ${session.intent_confirmed_by} on ${now.slice(0, 10)}.`,
    `Recorded from ${session.session_id}.`,
    "",
    "## The problem",
    "",
    show(intent.problem.value),
    "",
    "## What it should do about it",
    "",
    show(intent.goal.value),
    "",
    "## Who it is for",
    "",
    show(intent.users.value),
    "",
    "## What success looks like",
    "",
    show(intent.desired_outcome.value),
    "",
    "## Limits we know about",
    "",
    show(intent.constraints.value),
    "",
    "## What we are assuming",
    "",
    show(intent.assumptions.value),
    "",
    "---",
    "",
    "Each part above was either stated by you, worked out by MICHI, or assumed:",
    "",
  ];
  for (const field of INTENT_FIELDS) {
    lines.push(`- ${field}: ${intent[field].confidence}`);
  }
  lines.push("");
  return lines.join("\n");
}
