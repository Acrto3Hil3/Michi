import type { EdgeType, GraphNode, NodeType, ProjectGraph } from "./build.js";

/** Small, explicit traversals. Not a query language (GRAPH_MODEL.md). */

export function node(graph: ProjectGraph, id: string): GraphNode | undefined {
  return graph.nodes.find((n) => n.id === id);
}

export function neighbors(
  graph: ProjectGraph,
  id: string,
  edgeTypes?: EdgeType[],
): GraphNode[] {
  const wanted = edgeTypes ? new Set(edgeTypes) : null;
  const ids = new Set<string>();
  for (const edge of graph.edges) {
    if (wanted && !wanted.has(edge.type)) continue;
    if (edge.from === id) ids.add(edge.to);
    if (edge.to === id) ids.add(edge.from);
  }
  return graph.nodes.filter((n) => ids.has(n.id));
}

/**
 * Breadth-first outward, returning each reachable node's hop distance.
 *
 * Distance is what the context engine ranks on, so it has to be the shortest
 * path and it has to be stable: the frontier is processed in sorted id order.
 */
export function withinHops(
  graph: ProjectGraph,
  id: string,
  hops: number,
  edgeTypes?: EdgeType[],
): Map<string, number> {
  const distance = new Map<string, number>([[id, 0]]);
  let frontier = [id];
  for (let hop = 1; hop <= hops; hop += 1) {
    const next: string[] = [];
    for (const current of [...frontier].sort()) {
      for (const n of neighbors(graph, current, edgeTypes)) {
        if (distance.has(n.id)) continue;
        distance.set(n.id, hop);
        next.push(n.id);
      }
    }
    if (next.length === 0) break;
    frontier = next;
  }
  return distance;
}

/** Nodes of a type with no edge of the given type touching them. */
export function orphans(graph: ProjectGraph, type: NodeType, edgeType: EdgeType): string[] {
  const touched = new Set<string>();
  for (const edge of graph.edges) {
    if (edge.type !== edgeType) continue;
    touched.add(edge.from);
    touched.add(edge.to);
  }
  return graph.nodes
    .filter((n) => n.type === type && !touched.has(n.id))
    .map((n) => n.id);
}

/** Requirements with no live acceptance criterion proving them. */
export function coverage(graph: ProjectGraph): string[] {
  const verified = new Set(
    graph.edges
      .filter((e) => e.type === "VERIFIES")
      .filter((e) => node(graph, e.from)?.attrs.status !== "REMOVED")
      .map((e) => e.to),
  );
  return graph.nodes
    .filter((n) => n.type === "REQUIREMENT" && !verified.has(n.id))
    .map((n) => n.id);
}
