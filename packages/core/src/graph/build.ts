import { existsSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { brainDir, readJson, readYaml } from "../fs/brain.js";
import { RequirementsRegistrySchema } from "../schemas/discovery.js";
import { RegistrySchema } from "../schemas/decision.js";
import { SpecificationSchema, effectiveScope } from "../schemas/product.js";
import { ProjectMapSchema } from "../schemas/scan.js";
import { TaskSchema } from "../schemas/task.js";

/**
 * The project graph.
 *
 * Derived, never authored. `requirements.yaml`, `specification.yaml`,
 * `decisions/index.yaml` and the project map stay canonical; this is a view
 * over them, rebuilt on demand.
 *
 * It is deliberately **not persisted** in this phase. GRAPH_MODEL.md describes
 * `graph/nodes.json` and `graph/edges.json`, and those become worth having
 * once building the graph is expensive — structural parsing of a large
 * repository, which does not exist yet. Until then a stored copy is a
 * staleness bug waiting to happen, and rebuilding costs nothing.
 *
 * Node and edge types are limited to those with a canonical source today.
 * `COMPONENT`, `ENTITY`, `API`, `SYMBOL`, `TASK`, `MILESTONE`, `FEATURE`,
 * `DOMAIN` and `TEST` are in GRAPH_MODEL.md and are not built here: nothing
 * in `.michi/` produces them yet, and a node type with no source is a lie
 * about what the project knows.
 */

export const NODE_TYPES = [
  "REQUIREMENT", "DECISION", "USE_CASE", "ACCEPTANCE", "PERSONA", "TASK", "FILE",
] as const;
export type NodeType = (typeof NODE_TYPES)[number];

/**
 * Each edge type is backed by one field of canonical state, named below. An
 * edge with no field behind it would be an invention.
 */
export const EDGE_TYPES = [
  "GOVERNS",       // decision.affects_requirements   DECISION   → REQUIREMENT
  "VERIFIES",      // criterion.requirement           ACCEPTANCE → REQUIREMENT
  "SERVES",        // use_case.requirements           USE_CASE   → REQUIREMENT
  "PERFORMED_BY",  // use_case.persona                USE_CASE   → PERSONA
  "IMPLEMENTS",    // task.requirements               TASK       → REQUIREMENT
  "TOUCHED",       // task.files_touched              TASK       → FILE
  "SUPERSEDES",    // decision.supersedes / requirement.supersedes
] as const;
export type EdgeType = (typeof EDGE_TYPES)[number];

export interface GraphNode {
  id: string;
  type: NodeType;
  label: string;
  /** Where this node came from, so the derivation is auditable. */
  source: string;
  attrs: Record<string, string | number | boolean | null>;
}

export interface GraphEdge {
  from: string;
  to: string;
  type: EdgeType;
}

export interface ProjectGraph {
  nodes: GraphNode[];
  edges: GraphEdge[];
  /** References that named something this project does not have. */
  dropped: { from: string; to: string; type: EdgeType; reason: string }[];
}

function read<T>(root: string, relative: string, schema: Parameters<typeof readYaml<T>>[1]): T | null {
  const file = join(brainDir(root), relative);
  if (!existsSync(file)) return null;
  return readYaml(file, schema);
}

export function buildGraph(root: string): ProjectGraph {
  const nodes: GraphNode[] = [];
  const edges: GraphEdge[] = [];
  const dropped: ProjectGraph["dropped"] = [];

  const requirements = read(root, join("requirements", "requirements.yaml"), RequirementsRegistrySchema);
  const spec = read(root, join("requirements", "specification.yaml"), SpecificationSchema);
  const decisions = read(root, join("decisions", "index.yaml"), RegistrySchema);

  const mapFile = join(brainDir(root), "project", "map.json");
  const map = existsSync(mapFile) ? readJson(mapFile, ProjectMapSchema) : null;

  // --- requirements --------------------------------------------------------
  for (const r of requirements?.requirements ?? []) {
    nodes.push({
      id: r.id,
      type: "REQUIREMENT",
      label: r.title,
      source: "requirements/requirements.yaml",
      attrs: {
        status: r.status,
        priority: r.priority,
        kind: r.type,
        scope: spec ? effectiveScope(spec.scope, r.id) : "UNKNOWN",
        confirmed_in: r.confirmed_in,
      },
    });
  }

  // --- the specification's product artifacts -------------------------------
  for (const p of spec?.personas ?? []) {
    nodes.push({
      id: p.id, type: "PERSONA", label: p.name,
      source: "requirements/specification.yaml",
      attrs: { status: p.status },
    });
  }
  for (const u of spec?.use_cases ?? []) {
    nodes.push({
      id: u.id, type: "USE_CASE", label: u.title,
      source: "requirements/specification.yaml",
      attrs: { status: u.status, persona: u.persona },
    });
  }
  for (const c of spec?.criteria ?? []) {
    nodes.push({
      id: c.id, type: "ACCEPTANCE", label: c.kind === "GWT" ? `when ${c.when}` : String(c.text),
      source: "requirements/specification.yaml",
      attrs: { status: c.status, kind: c.kind, requirement: c.requirement },
    });
  }

  // --- decisions -----------------------------------------------------------
  for (const d of decisions?.decisions ?? []) {
    nodes.push({
      id: d.id, type: "DECISION", label: d.title,
      source: "decisions/index.yaml",
      attrs: {
        status: d.status,
        category: d.category,
        adr: d.adr,
        needs_review: d.needs_review ?? false,
        choice: d.options.find((o) => o.key === d.selected_option)?.label ?? null,
        // Why, not just what. An instruction carrying the choice without the
        // reasoning tells an agent what to build and nothing about the
        // constraint it was built to satisfy.
        rationale: d.rationale,
      },
    });
  }

  // --- tasks ---------------------------------------------------------------
  const tasksDir = join(brainDir(root), "tasks", "active");
  const tasks = existsSync(tasksDir)
    ? readdirSync(tasksDir)
        .filter((f) => /^TASK-\d{3,}\.yaml$/.test(f))
        .sort()
        .map((f) => readYaml(join(tasksDir, f), TaskSchema))
    : [];

  for (const t of tasks) {
    nodes.push({
      id: t.task_id, type: "TASK", label: t.title,
      source: `tasks/active/${t.task_id}.yaml`,
      attrs: {
        status: t.status,
        attempt: t.attempt,
        verification: t.verification.status,
      },
    });
  }

  // --- files ---------------------------------------------------------------
  // Two sources: what the scanner found, and what a task reported touching.
  //
  // A reported file is a **claim** about what a task did, not evidence that
  // the file implements the requirement. So there is no FILE → REQUIREMENT
  // edge anywhere: the task says what it implements and what it touched, and
  // any connection between the two is derived through the task. Touching a
  // file does not make it the implementation.
  const fileNode = (id: string, source: string, extra: Record<string, string | number | boolean | null>) => {
    if (nodes.some((node) => node.id === id)) return;
    nodes.push({
      id, type: "FILE", label: id, source,
      attrs: {
        kind: id.includes(".") ? (id.split(".").pop() ?? "") : "",
        exists: existsSync(join(root, id)),
        ...extra,
      },
    });
  };

  for (const file of [...(map?.structure.config_files ?? []), ...(map?.structure.entry_points ?? [])]) {
    fileNode(file, "project/map.json", { reported_by: null, verified: false });
  }
  for (const t of tasks) {
    for (const file of t.files_touched) {
      fileNode(file, `tasks/active/${t.task_id}.yaml`, {
        reported_by: t.task_id,
        // Phase 7's job. Until then, reported is all MICHI can honestly say.
        verified: t.verification.status === "PASSED",
      });
    }
  }

  const known = new Set(nodes.map((node) => node.id));
  const link = (from: string, to: string, type: EdgeType, why: string): void => {
    if (!known.has(from) || !known.has(to)) {
      dropped.push({ from, to, type, reason: `${known.has(from) ? to : from} is not in this project (${why})` });
      return;
    }
    edges.push({ from, to, type });
  };

  for (const d of decisions?.decisions ?? []) {
    for (const requirement of d.affects_requirements) {
      link(d.id, requirement, "GOVERNS", "decision.affects_requirements");
    }
    if (d.supersedes) link(d.id, d.supersedes, "SUPERSEDES", "decision.supersedes");
  }
  for (const c of spec?.criteria ?? []) {
    link(c.id, c.requirement, "VERIFIES", "criterion.requirement");
  }
  for (const u of spec?.use_cases ?? []) {
    for (const requirement of u.requirements) link(u.id, requirement, "SERVES", "use_case.requirements");
    link(u.id, u.persona, "PERFORMED_BY", "use_case.persona");
  }
  for (const r of requirements?.requirements ?? []) {
    if (r.supersedes) link(r.id, r.supersedes, "SUPERSEDES", "requirement.supersedes");
  }
  for (const t of tasks) {
    for (const requirement of t.requirements) {
      link(t.task_id, requirement, "IMPLEMENTS", "task.requirements");
    }
    for (const file of t.files_touched) {
      link(t.task_id, file, "TOUCHED", "task.files_touched");
    }
  }

  // Sorted so a rebuild is byte-identical and a diff is reviewable.
  nodes.sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
  edges.sort((a, b) => {
    const ka = `${a.from}|${a.type}|${a.to}`;
    const kb = `${b.from}|${b.type}|${b.to}`;
    return ka < kb ? -1 : ka > kb ? 1 : 0;
  });
  dropped.sort((a, b) => (`${a.from}|${a.to}` < `${b.from}|${b.to}` ? -1 : 1));

  return { nodes, edges, dropped };
}
