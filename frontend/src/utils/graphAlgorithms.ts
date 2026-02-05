/**
 * Client-side graph algorithms for interactive analysis
 */

import type { ComparisonNode, NetworkEdge } from '../types';

/**
 * Client-side BFS ego network extraction
 */
export function computeEgoNetwork(
  center: string,
  nodes: ComparisonNode[],
  edges: NetworkEdge[],
  hops: number
): { nodes: ComparisonNode[]; edges: NetworkEdge[] } {
  // Build adjacency list
  const adj = new Map<string, Set<string>>();
  const nodeMap = new Map<string, ComparisonNode>();
  nodes.forEach(n => {
    adj.set(n.word, new Set());
    nodeMap.set(n.word, n);
  });
  edges.forEach(e => {
    adj.get(e.from)?.add(e.to);
    adj.get(e.to)?.add(e.from);
  });

  if (!adj.has(center)) {
    return { nodes: [], edges: [] };
  }

  // BFS from center
  const visited = new Set<string>([center]);
  let currentLayer = new Set<string>([center]);

  for (let i = 0; i < hops; i++) {
    const nextLayer = new Set<string>();
    for (const node of currentLayer) {
      for (const neighbor of adj.get(node) || []) {
        if (!visited.has(neighbor)) {
          visited.add(neighbor);
          nextLayer.add(neighbor);
        }
      }
    }
    currentLayer = nextLayer;
  }

  const egoNodes = nodes.filter(n => visited.has(n.word));
  const egoEdges = edges.filter(e => visited.has(e.from) && visited.has(e.to));

  return { nodes: egoNodes, edges: egoEdges };
}

/**
 * Client-side Dijkstra shortest path
 */
export function computeShortestPath(
  source: string,
  target: string,
  edges: NetworkEdge[]
): string[] | null {
  // Build adjacency with weights
  const adj = new Map<string, Map<string, number>>();
  const allNodes = new Set<string>();

  edges.forEach(e => {
    allNodes.add(e.from);
    allNodes.add(e.to);
    if (!adj.has(e.from)) adj.set(e.from, new Map());
    if (!adj.has(e.to)) adj.set(e.to, new Map());
    // Invert weight: higher co-occurrence = shorter path
    const dist = 1.0 / Math.max(e.weight, 1);
    adj.get(e.from)!.set(e.to, dist);
    adj.get(e.to)!.set(e.from, dist);
  });

  if (!allNodes.has(source) || !allNodes.has(target)) return null;

  // Dijkstra
  const dist = new Map<string, number>();
  const prev = new Map<string, string | null>();
  const visited = new Set<string>();

  allNodes.forEach(n => {
    dist.set(n, Infinity);
    prev.set(n, null);
  });
  dist.set(source, 0);

  while (true) {
    // Find unvisited node with smallest distance
    let minNode: string | null = null;
    let minDist = Infinity;
    for (const n of allNodes) {
      if (!visited.has(n) && (dist.get(n) ?? Infinity) < minDist) {
        minDist = dist.get(n)!;
        minNode = n;
      }
    }

    if (minNode === null || minNode === target) break;
    visited.add(minNode);

    for (const [neighbor, weight] of adj.get(minNode) || []) {
      if (visited.has(neighbor)) continue;
      const alt = minDist + weight;
      if (alt < (dist.get(neighbor) ?? Infinity)) {
        dist.set(neighbor, alt);
        prev.set(neighbor, minNode);
      }
    }
  }

  // Reconstruct path
  if (dist.get(target) === Infinity) return null;

  const path: string[] = [];
  let current: string | null = target;
  while (current) {
    path.unshift(current);
    current = prev.get(current) ?? null;
  }

  return path.length > 1 ? path : null;
}

/**
 * Get immediate neighbors of a node
 */
export function getNeighbors(word: string, edges: NetworkEdge[]): string[] {
  const neighbors = new Set<string>();
  edges.forEach(e => {
    if (e.from === word) neighbors.add(e.to);
    if (e.to === word) neighbors.add(e.from);
  });
  return [...neighbors];
}
