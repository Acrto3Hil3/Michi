import { existsSync, readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { z } from "zod";
import { MichiError, errorPayload } from "../errors.js";
import type { Result } from "../result.js";
import { ok } from "../result.js";
import { STATE_FILE, brainDir, readYaml, writeYaml } from "../fs/brain.js";
import { StateSchema } from "../schemas/state.js";
import { RequirementsRegistrySchema, isActive } from "../schemas/discovery.js";
import type { Requirement } from "../schemas/discovery.js";
import { RegistrySchema } from "../schemas/decision.js";
import { SpecificationSchema, effectiveScope, isLive } from "../schemas/product.js";
import type { ProductSpecification } from "../schemas/product.js";
import { RoadmapSchema, TaskSchema, newRoadmap, readyFrom, taskId } from "../schemas/task.js";
import type { Roadmap, Task, TaskState } from "../schemas/task.js";
import { parseOrInvalid } from "../schemas/parse.js";
import { requireInitialized } from "./scan.js";
import { cmd } from "../identity.js";

/**
 * Implementation planning.
 *
 * Core cannot decide that a requirement needs three tasks rather than one —
 * that is judgement. What it can do is seed the obvious one-to-one mapping,
 * accept a plan the skill authored, and refuse a plan that cannot be executed
 * in any order.
 */

const ROADMAP = join("tasks", "roadmap.yaml");
const ACTIVE = join("tasks", "active");

export interface PlanTasksOptions {
  root: string;
  now: () => string;
  /** Seed one task per first-version requirement that has none. */
  fromRequirements?: boolean;
  /** A plan the skill authored. */
  file?: string;
}

interface Ground {
  spec: ProductSpecification;
  requirements: Requirement[];
  mvp: Requirement[];
  governing: Map<string, string[]>;
}

export function roadmapPath(root: string): string {
  return join(brainDir(root), ROADMAP);
}

export function loadRoadmap(root: string, now: string): Roadmap {
  const file = roadmapPath(root);
  return existsSync(file) ? readYaml(file, RoadmapSchema) : newRoadmap(now);
}

export function taskPath(root: string, id: string): string {
  return join(brainDir(root), ACTIVE, `${id}.yaml`);
}

export function loadTasks(root: string): Task[] {
  const dir = join(brainDir(root), ACTIVE);
  if (!existsSync(dir)) return [];
  return readdirSync(dir)
    .filter((f) => /^TASK-\d{3,}\.yaml$/.test(f))
    .sort()
    .map((f) => readYaml(join(dir, f), TaskSchema));
}

/** `PENDING`/`READY` is recomputed from the dependencies on every read. */
export function withDerivedReadiness(tasks: Task[]): Task[] {
  const statuses: Record<string, TaskState> = {};
  for (const t of tasks) statuses[t.task_id] = t.status;
  return tasks.map((t) =>
    t.status === "PENDING" || t.status === "READY"
      ? { ...t, status: readyFrom(t.dependencies, statuses) }
      : t);
}

function requireGround(root: string): Ground {
  const brain = brainDir(root);
  const state = readYaml(join(brain, STATE_FILE), StateSchema);
  const specPath = join(brain, "requirements", "specification.yaml");
  const spec = existsSync(specPath) ? readYaml(specPath, SpecificationSchema) : null;

  if (state.architecture_status !== "LOCKED" || !spec || spec.status !== "PUBLISHED") {
    throw new MichiError({
      class: "BLOCKED",
      code: "BLOCKED",
      message:
        "There is nothing to plan work from yet: this project has no agreed architecture.",
      detail: { architecture: state.architecture_status, specification: spec?.status ?? "none" },
      next: spec?.status === "PUBLISHED"
        ? `Settle how it gets built first — run: ${cmd("architecture status")}`
        : `Work out what the user wants and what ships first — run: ${cmd("discover start")}`,
    });
  }

  const requirementsPath = join(brain, "requirements", "requirements.yaml");
  const requirements = existsSync(requirementsPath)
    ? readYaml(requirementsPath, RequirementsRegistrySchema).requirements.filter(isActive)
    : [];

  const decisionsPath = join(brain, "decisions", "index.yaml");
  const decisions = existsSync(decisionsPath)
    ? readYaml(decisionsPath, RegistrySchema).decisions.filter((d) => d.status === "LOCKED")
    : [];

  const governing = new Map<string, string[]>();
  for (const r of requirements) {
    governing.set(r.id, decisions.filter((d) => d.affects_requirements.includes(r.id)).map((d) => d.id));
  }

  return {
    spec, requirements, governing,
    mvp: requirements.filter((r) => effectiveScope(spec.scope, r.id) === "MVP"),
  };
}

/** The criteria the specification holds for a requirement, as task criteria. */
function criteriaFor(spec: ProductSpecification, requirement: string) {
  return spec.criteria
    .filter((c) => c.requirement === requirement && isLive(c))
    .map((c) => ({
      id: c.id,
      text: c.kind === "GWT"
        ? `Given ${c.given.join(" and ")}, when ${c.when}, then ${c.then.join(" and ")}`
        : String(c.text),
    }));
}

const PlanSchema = z
  .object({
    milestone: z.string().min(1).optional(),
    tasks: z
      .array(z.object({
        title: z.string().min(1),
        description: z.string().min(1),
        requirements: z.array(z.string().min(1)).min(1),
        /** 1-based positions within this plan, so a plan is self-contained. */
        depends_on: z.array(z.number().int().positive()).default([]),
        acceptance_criteria: z
          .array(z.object({ id: z.string().min(1), text: z.string().min(1) }))
          .min(1),
        scope: z.object({
          in: z.array(z.string().min(1)).min(1),
          out: z.array(z.string().min(1)).default([]),
        }),
      }))
      .min(1),
  })
  .strict();

export interface PlanTasksData {
  created: string[];
  skipped: string[];
  milestone: string | null;
}

export function planTasks(options: PlanTasksOptions): Result<PlanTasksData> {
  try {
    const { root, now } = options;
    requireInitialized(root);
    const ground = requireGround(root);
    const timestamp = now();
    const roadmap = loadRoadmap(root, timestamp);
    const existing = loadTasks(root);

    const created: string[] = [];
    const skipped: string[] = [];
    let nextId = roadmap.next_task_id;
    const written: Task[] = [];

    const allocate = (): string => {
      const id = taskId(nextId);
      nextId += 1;
      return id;
    };

    if (options.file) {
      const raw = existsSync(options.file)
        ? JSON.parse(readFileSync(options.file, "utf8"))
        : (() => {
            throw new MichiError({
              class: "UNKNOWN", code: "NOT_FOUND",
              message: `${options.file} does not exist.`,
            });
          })();
      const plan = parseOrInvalid(PlanSchema, raw, "that task plan");

      // Allocate every id first, so `depends_on` positions can be resolved.
      const ids = plan.tasks.map(() => allocate());
      plan.tasks.forEach((draft, index) => {
        for (const requirement of draft.requirements) {
          const known = ground.requirements.find((r) => r.id === requirement);
          if (!known) {
            throw new MichiError({
              class: "UNKNOWN", code: "NOT_FOUND",
              message: `"${draft.title}" names ${requirement}, which is not a requirement in force.`,
              detail: { active: ground.requirements.map((r) => r.id) },
            });
          }
          if (!ground.mvp.some((r) => r.id === requirement)) {
            throw new MichiError({
              class: "INVALID", code: "CONFLICT",
              message:
                `"${draft.title}" names ${requirement}, which is not in the first version. ` +
                `Work is only planned for what ships now.`,
              detail: { requirement, scope: effectiveScope(ground.spec.scope, requirement) },
              next: "Move it into the first version with a revision, or leave it unplanned.",
            });
          }
        }
        const dependencies = draft.depends_on.map((position) => {
          const id = ids[position - 1];
          if (!id) {
            throw new MichiError({
              class: "INVALID", code: "VALIDATION_ERROR",
              message: `"${draft.title}" depends on position ${position}, which this plan does not have.`,
            });
          }
          return id;
        });

        written.push(parseOrInvalid(TaskSchema, {
          schema_version: ground.spec.schema_version,
          task_id: ids[index] as string,
          title: draft.title,
          description: draft.description,
          requirements: draft.requirements,
          decisions: [...new Set(draft.requirements.flatMap((r) => ground.governing.get(r) ?? []))].sort(),
          dependencies,
          acceptance_criteria: draft.acceptance_criteria,
          scope: draft.scope,
          status: "PENDING",
          attempt: 0,
          context: null,
          runs: [],
          files_touched: [],
          verification: { status: "PENDING", evidence: [] },
          blocked_reason: null,
          created_at: timestamp,
          updated_at: timestamp,
        }, "that task"));
        created.push(ids[index] as string);
      });
    } else {
      // The deterministic seed: one task per first-version requirement that
      // does not have one. A one-to-one mapping needs no judgement, and it is
      // a real starting plan rather than a placeholder.
      for (const requirement of ground.mvp) {
        if (existing.some((t) => t.requirements.includes(requirement.id))) {
          skipped.push(requirement.id);
          continue;
        }
        const id = allocate();
        written.push(parseOrInvalid(TaskSchema, {
          schema_version: ground.spec.schema_version,
          task_id: id,
          title: requirement.title,
          description: requirement.description,
          requirements: [requirement.id],
          decisions: ground.governing.get(requirement.id) ?? [],
          dependencies: [],
          acceptance_criteria: criteriaFor(ground.spec, requirement.id),
          scope: { in: [requirement.title], out: [] },
          status: "PENDING",
          attempt: 0,
          context: null,
          runs: [],
          files_touched: [],
          verification: { status: "PENDING", evidence: [] },
          blocked_reason: null,
          created_at: timestamp,
          updated_at: timestamp,
        }, "that task"));
        created.push(id);
      }
    }

    const statuses: Record<string, TaskState> = {};
    for (const t of [...existing, ...written]) statuses[t.task_id] = t.status;
    for (const t of written) {
      writeYaml(taskPath(root, t.task_id), TaskSchema.parse({
        ...t, status: readyFrom(t.dependencies, statuses),
      }));
    }

    writeYaml(roadmapPath(root), RoadmapSchema.parse({
      ...roadmap,
      next_task_id: nextId,
      milestone: roadmap.milestone,
      tasks: [...roadmap.tasks, ...created],
      updated_at: timestamp,
    }));

    if (created.length > 0) {
      const statePath = join(brainDir(root), STATE_FILE);
      const state = readYaml(statePath, StateSchema);
      writeYaml(statePath, {
        ...state,
        stage: state.stage === "DESIGN" || state.stage === "ARCHITECTURE" ? "PLANNING" : state.stage,
        stage_reason: "Work has been planned from the agreed architecture.",
        counts: { ...state.counts, tasks_total: roadmap.tasks.length + created.length },
        updated_at: timestamp,
      });
    }

    return ok({ created, skipped, milestone: roadmap.milestone });
  } catch (e) {
    return errorPayload(MichiError.from(e));
  }
}

export interface PlanValidateData {
  ok: boolean;
  problems: string[];
  tasks: number;
}

/**
 * Catches the plans that cannot be executed in any order, before anyone builds
 * against one.
 */
export function planValidate(options: { root: string; now: () => string }): Result<PlanValidateData> {
  try {
    const { root } = options;
    requireInitialized(root);
    const ground = requireGround(root);
    const tasks = withDerivedReadiness(loadTasks(root));
    const problems: string[] = [];
    const ids = new Set(tasks.map((t) => t.task_id));

    for (const requirement of ground.mvp) {
      if (!tasks.some((t) => t.requirements.includes(requirement.id))) {
        problems.push(`${requirement.id} is in the first version but no task builds it.`);
      }
    }

    for (const t of tasks) {
      for (const dependency of t.dependencies) {
        if (!ids.has(dependency)) {
          problems.push(`${t.task_id} depends on ${dependency}, which does not exist.`);
        }
      }
    }

    // Depth-first, three colours: a back edge is a cycle.
    const colour = new Map<string, 0 | 1 | 2>();
    const byId = new Map(tasks.map((t) => [t.task_id, t]));
    const walk = (id: string, path: string[]): void => {
      if (colour.get(id) === 2) return;
      if (colour.get(id) === 1) {
        problems.push(`There is a dependency cycle: ${[...path, id].join(" → ")}.`);
        return;
      }
      colour.set(id, 1);
      for (const dependency of (byId.get(id)?.dependencies ?? []).filter((d) => ids.has(d))) {
        walk(dependency, [...path, id]);
      }
      colour.set(id, 2);
    };
    for (const t of tasks) walk(t.task_id, []);

    return ok({ ok: problems.length === 0, problems: [...new Set(problems)].sort(), tasks: tasks.length });
  } catch (e) {
    return errorPayload(MichiError.from(e));
  }
}
