/**
 * Layout computation utilities for network graph
 */

import type { ComparisonNode, NetworkEdge } from '../types';

interface Position {
  x: number;
  y: number;
}

/**
 * Compute clustered layout — groups nodes by cluster on a circle,
 * spreads nodes within each cluster in a smaller circle
 */
export function computeClusteredLayout(
  nodes: ComparisonNode[],
  groupKeys: string[],
  activeGroupKey?: string
): Map<string, Position> {
  const positions = new Map<string, Position>();
  // Use the active group key if provided, otherwise fall back to first group
  const gk = activeGroupKey || groupKeys[0] || '';
  const clusterKey = gk ? `${gk}_cluster` : '';

  // Group nodes by cluster
  const clusters = new Map<number, ComparisonNode[]>();
  nodes.forEach(node => {
    const cluster = clusterKey ? ((node as any)[clusterKey] ?? 0) : 0;
    if (!clusters.has(cluster)) clusters.set(cluster, []);
    clusters.get(cluster)!.push(node);
  });

  const clusterIds = [...clusters.keys()].sort();
  const numClusters = clusterIds.length;
  const outerRadius = Math.max(600, numClusters * 200);

  clusterIds.forEach((clusterId, ci) => {
    const clusterNodes = clusters.get(clusterId)!;
    // Position cluster center on the outer circle
    const clusterAngle = (2 * Math.PI * ci) / numClusters - Math.PI / 2;
    const cx = Math.cos(clusterAngle) * outerRadius;
    const cy = Math.sin(clusterAngle) * outerRadius;

    // Spread nodes within cluster in a smaller circle
    const innerRadius = Math.max(80, clusterNodes.length * 25);
    clusterNodes.forEach((node, ni) => {
      const nodeAngle = (2 * Math.PI * ni) / clusterNodes.length;
      positions.set(node.word, {
        x: cx + Math.cos(nodeAngle) * innerRadius,
        y: cy + Math.sin(nodeAngle) * innerRadius,
      });
    });
  });

  return positions;
}

/**
 * Compute circular layout grouped by cluster
 */
export function computeCircularLayout(
  nodes: ComparisonNode[],
  groupKeys: string[]
): Map<string, Position> {
  const positions = new Map<string, Position>();
  const clusterKey = groupKeys[0] ? `${groupKeys[0]}_cluster` : '';

  // Group nodes by cluster
  const clusters = new Map<number, ComparisonNode[]>();
  nodes.forEach(node => {
    const cluster = clusterKey ? ((node as any)[clusterKey] ?? 0) : 0;
    if (!clusters.has(cluster)) clusters.set(cluster, []);
    clusters.get(cluster)!.push(node);
  });

  const clusterIds = [...clusters.keys()].sort();
  const totalNodes = nodes.length;
  let currentAngle = 0;
  const radius = Math.max(300, totalNodes * 8);

  clusterIds.forEach(clusterId => {
    const clusterNodes = clusters.get(clusterId)!;
    const anglePerNode = (2 * Math.PI) / totalNodes;

    clusterNodes.forEach(node => {
      positions.set(node.word, {
        x: Math.cos(currentAngle) * radius,
        y: Math.sin(currentAngle) * radius,
      });
      currentAngle += anglePerNode;
    });
  });

  return positions;
}

/**
 * Compute radial layout — concentric circles by centrality metric
 */
export function computeRadialLayout(
  nodes: ComparisonNode[],
  groupKeys: string[],
  metric: string = 'betweenness'
): Map<string, Position> {
  const positions = new Map<string, Position>();
  const metricKey = groupKeys[0] ? `${groupKeys[0]}_${metric}` : '';

  // Sort by metric descending (highest centrality at center)
  const sorted = [...nodes].sort((a, b) => {
    const aVal = metricKey ? ((a as any)[metricKey] ?? 0) : a.avg_normalized;
    const bVal = metricKey ? ((b as any)[metricKey] ?? 0) : b.avg_normalized;
    return bVal - aVal;
  });

  // Assign concentric rings
  const numRings = Math.max(3, Math.ceil(Math.sqrt(sorted.length)));
  const nodesPerRing = Math.ceil(sorted.length / numRings);
  const ringSpacing = 150;

  let nodeIdx = 0;
  for (let ring = 0; ring < numRings && nodeIdx < sorted.length; ring++) {
    const radius = ring === 0 ? 0 : ring * ringSpacing;
    const ringNodeCount = ring === 0 ? 1 : Math.min(nodesPerRing, sorted.length - nodeIdx);
    const angleStep = (2 * Math.PI) / ringNodeCount;

    for (let i = 0; i < ringNodeCount && nodeIdx < sorted.length; i++) {
      const angle = i * angleStep;
      positions.set(sorted[nodeIdx].word, {
        x: Math.cos(angle) * radius,
        y: Math.sin(angle) * radius,
      });
      nodeIdx++;
    }
  }

  return positions;
}

/**
 * Compute hierarchical positions using a tree structure from highest centrality root
 */
export function computeHierarchicalPositions(
  nodes: ComparisonNode[],
  edges: NetworkEdge[],
  groupKeys: string[]
): Map<string, Position> {
  const positions = new Map<string, Position>();
  if (nodes.length === 0) return positions;

  const metricKey = groupKeys[0] ? `${groupKeys[0]}_betweenness` : '';

  // Build adjacency
  const adj = new Map<string, Set<string>>();
  nodes.forEach(n => adj.set(n.word, new Set()));
  edges.forEach(e => {
    adj.get(e.from)?.add(e.to);
    adj.get(e.to)?.add(e.from);
  });

  // Find root (highest centrality)
  const sorted = [...nodes].sort((a, b) => {
    const aVal = metricKey ? ((a as any)[metricKey] ?? 0) : a.avg_normalized;
    const bVal = metricKey ? ((b as any)[metricKey] ?? 0) : b.avg_normalized;
    return bVal - aVal;
  });
  const root = sorted[0].word;

  // BFS to assign levels
  const levels = new Map<string, number>();
  const queue = [root];
  levels.set(root, 0);
  while (queue.length > 0) {
    const current = queue.shift()!;
    const level = levels.get(current)!;
    for (const neighbor of adj.get(current) || []) {
      if (!levels.has(neighbor)) {
        levels.set(neighbor, level + 1);
        queue.push(neighbor);
      }
    }
  }

  // Handle disconnected nodes
  nodes.forEach(n => {
    if (!levels.has(n.word)) {
      levels.set(n.word, 10);
    }
  });

  // Group by level
  const levelGroups = new Map<number, string[]>();
  levels.forEach((level, word) => {
    if (!levelGroups.has(level)) levelGroups.set(level, []);
    levelGroups.get(level)!.push(word);
  });

  const levelSpacing = 150;
  levelGroups.forEach((words, level) => {
    const nodeSpacing = 100;
    const totalWidth = (words.length - 1) * nodeSpacing;
    words.forEach((word, i) => {
      positions.set(word, {
        x: -totalWidth / 2 + i * nodeSpacing,
        y: level * levelSpacing,
      });
    });
  });

  return positions;
}
