import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { MichiError, errorPayload } from "../errors.js";
import type { Result } from "../result.js";
import { ok } from "../result.js";
import { brainDir, readJson, readYaml } from "../fs/brain.js";
import { hashOf } from "../fs/canonical.js";
import { RegistrySchema } from "../schemas/decision.js";
import { SpecificationSchema } from "../schemas/product.js";
import { ProjectMapSchema } from "../schemas/scan.js";
import { ConfigSchema } from "../schemas/config.js";
import { ContextRequestSchema } from "../schemas/context.js";
import type { ContextItem, ContextPacket, ContextRequest, ContextTier } from "../schemas/context.js";
import { parseOrInvalid } from "../schemas/parse.js";
import { buildGraph } from "../graph/build.js";
import type { GraphNode } from "../graph/build.js";
import { withinHops } from "../graph/query.js";
import { requireInitialized } from "./scan.js";
import { cmd } from "../identity.js";

/**
 * The context engine.
 *
 * Answers one question deterministically: *what does an agent actually need to
 * know to work on this?* Relevance comes from explicit graph relationships, not
 * from similarity — there is no model here, and nothing to tune.
 *
 * Every inclusion carries a reason a person can check. That is not decoration:
 * when an agent later does something strange, the packet is the first place to
 * look, and "why was this in scope?" has to be answerable.
 */

export interface ResolveOptions {
  root: string;
  now: () => string;
  request: unknown;
}

const TIER_ORDER: Record<ContextTier, number> = {
  MUST_INCLUDE: 0, PREFERRED: 1, OPTIONAL: 2, EXCLUDED: 3,
};

/** chars/4, per OQ-005. Always an estimate, never presented as exact. */
export function estimateTokens(text: string): number {
  return Math.ceil(text.length / 4);
}

function readOptional<T>(root: string, relative: string, schema: Parameters<typeof readYaml<T>>[1]): T | null {
  const file = join(brainDir(root), relative);
  return existsSync(file) ? readYaml(file, schema) : null;
}

function constraintsOf(root: string): string[] {
  const file = join(brainDir(root), "project", "identity.md");
  if (!existsSync(file)) return [];
  const section = /## Limits we know about\s*\n\s*\n([^\n]+)/.exec(readFileSync(file, "utf8"))?.[1]?.trim();
  if (!section || section === "not recorded") return [];
  return section.split(",").map((s) => s.trim()).filter((s) => s.length > 0);
}

/** What an item contributes to the packet, and therefore what it costs. */
function renderNode(node: GraphNode): string {
  const attrs = Object.entries(node.attrs)
    .filter(([, v]) => v !== null && v !== "" && v !== false)
    .map(([k, v]) => `${k}: ${String(v)}`)
    .join(" · ");
  return `${node.id} (${node.type}) ${node.label}${attrs ? `\n  ${attrs}` : ""}`;
}

export function resolveContext(options: ResolveOptions): Result<ContextPacket> {
  try {
    const { root, now } = options;
    requireInitialized(root);
    const request: ContextRequest = parseOrInvalid(
      ContextRequestSchema, options.request, "that context request",
    );

    const graph = buildGraph(root);
    const focus = graph.nodes.find((n) => n.id === request.focus.id);
    if (!focus) {
      throw new MichiError({
        class: "UNKNOWN", code: "NOT_FOUND",
        message: `${request.focus.id} is not a requirement in force on this project.`,
        detail: {
          known: graph.nodes.filter((n) => n.type === "REQUIREMENT").map((n) => n.id),
        },
        next: `See what exists: ${cmd("plan status")}`,
      });
    }

    const spec = readOptional(root, join("requirements", "specification.yaml"), SpecificationSchema);
    const decisions = readOptional(root, join("decisions", "index.yaml"), RegistrySchema);
    const config = readOptional(root, "config.yaml", ConfigSchema);
    const mapFile = join(brainDir(root), "project", "map.json");
    const map = existsSync(mapFile) ? readJson(mapFile, ProjectMapSchema) : null;

    // --- selection, straight off the graph --------------------------------
    const reach = withinHops(graph, focus.id, 2);
    const excluded: { id: string; reason: string }[] = [];
    const candidates = new Map<string, { tier: ContextTier; reason: string; rank: number }>();

    const consider = (id: string, tier: ContextTier, reason: string, rank: number): void => {
      const existing = candidates.get(id);
      if (existing && TIER_ORDER[existing.tier] <= TIER_ORDER[tier]) return;
      candidates.set(id, { tier, reason, rank });
    };

    consider(focus.id, "MUST_INCLUDE", "direct target", 1000);

    for (const edge of graph.edges) {
      const other = edge.from === focus.id ? edge.to : edge.to === focus.id ? edge.from : null;
      if (other === null) continue;
      const node = graph.nodes.find((n) => n.id === other);
      if (!node) continue;

      if (edge.type === "GOVERNS" && node.attrs.status === "LOCKED") {
        consider(node.id, "MUST_INCLUDE", `governs ${focus.id}`, 900);
      } else if (edge.type === "GOVERNS") {
        excluded.push({ id: node.id, reason: `governs ${focus.id} but is ${String(node.attrs.status).toLowerCase()}` });
      } else if (edge.type === "VERIFIES" && node.attrs.status !== "REMOVED") {
        consider(node.id, "MUST_INCLUDE", `verifies ${focus.id}`, 880);
      } else if (edge.type === "VERIFIES") {
        excluded.push({ id: node.id, reason: `verifies ${focus.id} but was removed from the specification` });
      } else if (edge.type === "SERVES" && node.attrs.status !== "REMOVED") {
        consider(node.id, "PREFERRED", `describes how ${focus.id} gets used`, 700);
      } else if (edge.type === "SERVES") {
        excluded.push({ id: node.id, reason: `uses ${focus.id} but was removed from the specification` });
      }
    }

    // Two hops: the people in those use cases, and the requirements they share.
    for (const useCase of [...candidates.keys()].filter((id) => id.startsWith("UC-"))) {
      for (const edge of graph.edges) {
        if (edge.from !== useCase) continue;
        const node = graph.nodes.find((n) => n.id === edge.to);
        if (!node || node.attrs.status === "REMOVED") continue;
        if (edge.type === "PERFORMED_BY") {
          consider(node.id, "PREFERRED", `the person in ${useCase}`, 650);
        } else if (edge.type === "SERVES" && node.id !== focus.id) {
          consider(node.id, "OPTIONAL", `shares ${useCase} with ${focus.id}`, 400);
        }
      }
    }

    // The ADR of every decision that must be included: the reasoning, not just
    // the choice. GRAPH_MODEL keeps ADRs out of the graph, so they are drawn
    // from the decision record rather than traversed to.
    const adrItems: ContextItem[] = [];
    for (const [id, pick] of candidates) {
      if (pick.tier !== "MUST_INCLUDE" || !id.startsWith("D")) continue;
      const decision = decisions?.decisions.find((d) => d.id === id);
      if (!decision?.adr || !decision.adr_file) continue;
      const adrPath = join(brainDir(root), "decisions", decision.adr_file);
      if (!existsSync(adrPath)) continue;
      const content = readFileSync(adrPath, "utf8").trim();
      adrItems.push({
        id: decision.adr, type: "ADR", tier: "MUST_INCLUDE",
        reason: `documents ${decision.id}`, rank: 870,
        estimated_tokens: estimateTokens(content), content,
      });
    }

    for (const id of request.include) {
      if (candidates.has(id)) continue;
      if (!graph.nodes.some((n) => n.id === id)) {
        throw new MichiError({
          class: "UNKNOWN", code: "NOT_FOUND",
          message: `The request asks for ${id}, which is not in this project.`,
        });
      }
      consider(id, "PREFERRED", "asked for by the request", 600);
    }

    for (const id of request.exclude) {
      if (candidates.delete(id)) excluded.push({ id, reason: "withheld by the request" });
    }

    // Everything the graph knows and this packet is not carrying.
    for (const node of graph.nodes) {
      if (candidates.has(node.id) || excluded.some((x) => x.id === node.id)) continue;
      if (node.type === "FILE") continue;   // project-level context, not graph-selected
      excluded.push({
        id: node.id,
        reason: reach.has(node.id) ? `reachable but not relevant to ${focus.id}` : `not connected to ${focus.id}`,
      });
    }

    // --- items, ranked ----------------------------------------------------
    let items: ContextItem[] = [...candidates.entries()].map(([id, pick]) => {
      const node = graph.nodes.find((n) => n.id === id) as GraphNode;
      const content = renderNode(node);
      const decision = decisions?.decisions.find((d) => d.id === id);
      return {
        id, type: node.type, tier: pick.tier, reason: pick.reason, rank: pick.rank,
        estimated_tokens: estimateTokens(content), content,
        ...(decision
          ? { needs_review: decision.needs_review, review_reason: decision.review_reason }
          : {}),
      };
    });
    items = [...items, ...adrItems];

    const sortItems = (list: ContextItem[]) =>
      [...list].sort((a, b) =>
        TIER_ORDER[a.tier] - TIER_ORDER[b.tier] ||
        b.rank - a.rank ||
        (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
    items = sortItems(items);

    // --- budget -----------------------------------------------------------
    const budget = request.budget_tokens ?? null;
    const droppedForBudget: string[] = [];

    if (budget !== null) {
      const required = items.filter((i) => i.tier === "MUST_INCLUDE");
      const requiredCost = required.reduce((sum, i) => sum + i.estimated_tokens, 0);
      if (requiredCost > budget) {
        // Never truncate what the target cannot do without. A focus whose
        // required context will not fit is a scoping problem, not a budget one.
        throw new MichiError({
          class: "BLOCKED", code: "BLOCKED",
          message:
            `The context ${focus.id} cannot do without is too large for the budget ` +
            `(~${requiredCost} estimated tokens against ${budget}). Nothing was truncated.`,
          detail: {
            focus: focus.id, budget_tokens: budget, required_tokens: requiredCost,
            required: required.map((i) => i.id), estimation_method: "chars/4",
          },
          next: "Raise the budget, or split the work into smaller requirements.",
        });
      }

      const kept: ContextItem[] = [...required];
      let spent = requiredCost;
      for (const item of items.filter((i) => i.tier !== "MUST_INCLUDE")) {
        if (spent + item.estimated_tokens <= budget) {
          kept.push(item);
          spent += item.estimated_tokens;
        } else {
          droppedForBudget.push(item.id);
          excluded.push({ id: item.id, reason: "budget" });
        }
      }
      items = sortItems(kept);
    }

    // --- the revisions that moved this target, and nothing else -----------
    const revisions = (spec?.revisions ?? [])
      .filter((r) => r.changes.some((c) => c.includes(focus.id)))
      .map((r) => ({ id: r.id, reason: r.reason, changes: r.changes }));

    const warnings: string[] = [];
    for (const item of items) {
      if (item.needs_review) {
        warnings.push(
          `${item.id} is locked but needs review: ${item.review_reason ?? "the specification changed after it was agreed"}`,
        );
      }
    }

    // --- hashes -----------------------------------------------------------
    const inputHash = hashOf({ focus: request.focus, include: request.include, exclude: request.exclude });
    const stateHash = hashOf(
      items.map((i) => ({ id: i.id, content: i.content })).sort((a, b) => (a.id < b.id ? -1 : 1)),
    );
    const content = {
      focus: request.focus,
      items: items.map((i) => ({ id: i.id, tier: i.tier, reason: i.reason, content: i.content })),
      excluded: [...excluded].sort((a, b) => (a.id < b.id ? -1 : 1)),
      revisions,
      budget_tokens: budget,
    };
    const contextHash = hashOf(content);

    const packet: ContextPacket = {
      // Named from its content rather than a counter: the same state and the
      // same request must produce the same packet, and a counter would not.
      packet_id: `CTX-${contextHash.replace("sha256:", "").slice(0, 8)}`,
      generated_at: now(),
      focus: request.focus,
      project: {
        name: config?.project.name ?? "this project",
        constraints: constraintsOf(root),
        detected: {
          project_type: (map?.detections.project_type.value as string | null) ?? null,
          package_manager: (map?.detections.package_manager.value as string | null) ?? null,
          test_framework: (map?.detections.test_framework.value as string | null) ?? null,
        },
      },
      items,
      excluded: [...excluded].sort((a, b) => (a.id < b.id ? -1 : 1)),
      dropped_for_budget: droppedForBudget.sort(),
      revisions,
      warnings,
      budget_tokens: budget,
      estimated_tokens: items.reduce((sum, i) => sum + i.estimated_tokens, 0),
      estimation_method: "chars/4",
      input_hash: inputHash,
      state_hash: stateHash,
      context_hash: contextHash,
    };

    return ok(packet);
  } catch (e) {
    return errorPayload(MichiError.from(e));
  }
}
