/**
 * Utility functions for network visualization
 */

import type { ComparisonNode, FilterState, ColorMode, NodeSizeMetric, NodeColorMetric, EdgeTypeFilter, NetworkEdge } from '../types';

// Cluster colors (20 distinct colors for up to 20 clusters)
export const CLUSTER_COLORS = [
  '#e74c3c',  // Red
  '#3498db',  // Blue
  '#2ecc71',  // Green
  '#f39c12',  // Orange
  '#9b59b6',  // Purple
  '#1abc9c',  // Teal
  '#34495e',  // Dark Gray
  '#e91e63',  // Pink
  '#00bcd4',  // Cyan
  '#8bc34a',  // Light Green
  '#ff5722',  // Deep Orange
  '#673ab7',  // Deep Purple
  '#009688',  // Teal Dark
  '#ffc107',  // Amber
  '#795548',  // Brown
  '#607d8b',  // Blue Gray
  '#cddc39',  // Lime
  '#03a9f4',  // Light Blue
  '#ff9800',  // Orange
  '#4caf50',  // Green
];

// Emphasis colors
export const EMPHASIS_COLORS = {
  group_a: '#dc143c',
  group_b: '#00b894',
  balanced: '#ff8c00',
};

/**
 * Get emphasis type based on difference score
 */
export function getEmphasisType(difference: number | undefined): 'group_a' | 'group_b' | 'balanced' {
  if (difference === undefined || Math.abs(difference) < 10) return 'balanced';
  return difference > 0 ? 'group_a' : 'group_b';
}

/**
 * Blue → Red sequential gradient for metric visualization
 */
export function getMetricGradientColor(value: number, min: number, max: number): string {
  const range = max - min;
  const t = range > 0 ? (value - min) / range : 0;
  // Blue (low) → Yellow (mid) → Red (high)
  const r = Math.round(t < 0.5 ? t * 2 * 255 : 255);
  const g = Math.round(t < 0.5 ? t * 2 * 200 : (1 - t) * 2 * 200);
  const b = Math.round(t < 0.5 ? 255 - t * 2 * 255 : 0);
  return `rgb(${r},${g},${b})`;
}

/**
 * Get node color based on color mode and color metric
 */
export function getNodeColor(
  node: ComparisonNode,
  colorMode: ColorMode,
  _groupKeys: string[] = [],
  nodeColorMetric?: NodeColorMetric,
  allNodes?: ComparisonNode[]
): string {
  // Handle gradient color metrics
  if (nodeColorMetric && nodeColorMetric !== 'emphasis' && nodeColorMetric !== 'cluster') {
    if (nodeColorMetric.endsWith('_gradient') && allNodes) {
      const metricKey = nodeColorMetric.replace('_gradient', '');
      const firstGroupKey = _groupKeys[0] || '';
      const fullKey = `${firstGroupKey}_${metricKey}`;

      const values = allNodes.map(n => Number((n as any)[fullKey]) || 0);
      const min = Math.min(...values);
      const max = Math.max(...values);
      const val = Number((node as any)[fullKey]) || 0;
      return getMetricGradientColor(val, min, max);
    }
  }

  // Check if it's a cluster mode (ends with _cluster)
  if (colorMode.endsWith('_cluster')) {
    const clusterKey = colorMode;
    const cluster = (node as any)[clusterKey] ?? -1;
    return cluster >= 0 && cluster < CLUSTER_COLORS.length
      ? CLUSTER_COLORS[cluster]
      : '#ccc';
  }

  // Emphasis mode - use difference if available
  const diff = (node as any).difference;
  const emphasis = getEmphasisType(diff);
  return EMPHASIS_COLORS[emphasis];
}

/**
 * Get node size based on mode and size metric
 */
export function getNodeSize(
  node: ComparisonNode,
  colorMode: ColorMode,
  _groupKeys: string[] = [],
  sizeMetric?: NodeSizeMetric
): number {
  const MIN_SIZE = 30;
  const MAX_SIZE = 80;

  if (sizeMetric && sizeMetric !== 'avg_normalized') {
    // Per-group normalized score (e.g. "group_a_normalized")
    if (sizeMetric.endsWith('_normalized')) {
      const value = (Number((node as any)[sizeMetric]) || 0) / 100;
      return Math.max(MIN_SIZE, MIN_SIZE + value * (MAX_SIZE - MIN_SIZE));
    }

    const firstGroupKey = _groupKeys[0] || '';
    const fullKey = `${firstGroupKey}_${sizeMetric}`;
    const value = Number((node as any)[fullKey]) || 0;

    // kcore is integer, normalize differently
    if (sizeMetric === 'kcore') {
      return Math.max(MIN_SIZE, MIN_SIZE + Math.min(value / 10, 1) * (MAX_SIZE - MIN_SIZE));
    }
    return Math.max(MIN_SIZE, MIN_SIZE + value * (MAX_SIZE - MIN_SIZE));
  }

  // Check if it's a cluster mode
  if (colorMode.endsWith('_cluster')) {
    const groupKey = colorMode.replace('_cluster', '');
    const betweennessKey = `${groupKey}_betweenness`;
    const value = (node as any)[betweennessKey] ?? 0;
    return Math.max(MIN_SIZE, MIN_SIZE + value * (MAX_SIZE - MIN_SIZE));
  }

  // Default: use average normalized score
  const value = node.avg_normalized / 100;
  return Math.max(MIN_SIZE, MIN_SIZE + value * (MAX_SIZE - MIN_SIZE));
}

/**
 * Get font size for node label
 */
export function getFontSize(avgNormalized: number, wordLength: number, labelScale: number = 1.0): number {
  const baseSize = Math.max(14, 12 + (avgNormalized / 100) * 12);
  return Math.min(baseSize, 300 / wordLength) * labelScale;
}

/**
 * Filter edges by type
 */
export function filterEdgesByType(edges: NetworkEdge[], edgeTypeFilter: EdgeTypeFilter): NetworkEdge[] {
  if (edgeTypeFilter === 'all') return edges;
  if (edgeTypeFilter === 'semantic') return edges.filter(e => e.edge_type === 'semantic');
  if (edgeTypeFilter === 'cooccurrence') return edges.filter(e => e.edge_type !== 'semantic');
  return edges;
}

/**
 * Filter nodes based on filter state
 */
export function filterNodes(
  nodes: ComparisonNode[],
  filterState: FilterState,
  groupKeys: string[] = []
): ComparisonNode[] {
  return nodes.filter(node => {
    // Check hidden
    if (filterState.hiddenWords.has(node.word)) return false;

    // Check min score
    if (node.avg_normalized < filterState.minScore) return false;

    const filterType = filterState.filterType;

    // Handle cluster filters (e.g., "group_1_cluster")
    if (filterType.endsWith('_cluster')) {
      const groupKey = filterType.replace('_cluster', '');
      const clusterKey = filterType;
      const normalizedKey = `${groupKey}_normalized`;
      const cluster = (node as any)[clusterKey];
      const normalized = (node as any)[normalizedKey];
      if (cluster < 0) return false;
      if (normalized < 2) return false;
      if (filterState.clusterNumber !== 'all' && cluster !== filterState.clusterNumber) return false;
    }
    // Handle group emphasis filters (matches a group key like "group_1")
    else if (groupKeys.includes(filterType)) {
      const normalizedKey = `${filterType}_normalized`;
      const thisNorm = (node as any)[normalizedKey] ?? 0;
      const otherMaxNorm = Math.max(
        ...groupKeys
          .filter(k => k !== filterType)
          .map(k => (node as any)[`${k}_normalized`] ?? 0)
      );
      if (thisNorm - otherMaxNorm <= 10) return false;
    }
    // Handle balanced filter
    else if (filterType === 'balanced') {
      const diff = (node as any).difference;
      if (diff !== undefined && Math.abs(diff) > 10) return false;
    }
    // Handle in_all filter
    else if (filterType === 'in_all') {
      const inAll = (node as any).in_all ?? (node as any).in_both;
      if (!inAll) return false;
    }

    // Check search query
    if (filterState.searchQuery) {
      if (!node.word.toLowerCase().includes(filterState.searchQuery.toLowerCase())) {
        return false;
      }
    }

    return true;
  });
}

/**
 * Export data to CSV
 */
export function exportToCSV(
  data: ComparisonNode[],
  groupNames: string[],
  groupKeys: string[],
  hiddenWords: Set<string>
): string {
  // Build dynamic headers
  const headers = ['Word'];

  // Add count columns for each group
  groupKeys.forEach((_key, i) => {
    headers.push(`${groupNames[i]}_Count`);
  });

  // Add score columns for each group
  groupKeys.forEach((_key, i) => {
    headers.push(`${groupNames[i]}_Score`);
  });

  // Add diff if 2 groups
  if (groupNames.length === 2) {
    headers.push('Diff', 'Emphasis');
  }

  headers.push('Avg');

  if (groupNames.length > 1) {
    headers.push('Groups');
  }

  // Add cluster columns
  groupKeys.forEach((_key, i) => {
    headers.push(`${groupNames[i]}_Cluster`);
  });

  // Add metric columns for each group
  groupKeys.forEach((_key, i) => {
    headers.push(
      `${groupNames[i]}_Degree`,
      `${groupNames[i]}_Strength`,
      `${groupNames[i]}_Betweenness`,
      `${groupNames[i]}_Closeness`,
      `${groupNames[i]}_Eigenvector`,
      `${groupNames[i]}_PageRank`,
      `${groupNames[i]}_Harmonic`,
      `${groupNames[i]}_KCore`,
      `${groupNames[i]}_Constraint`
    );
  });

  headers.push('Visible');

  const rows = data.map(node => {
    const values: (string | number)[] = [node.word];

    // Add counts
    groupKeys.forEach(key => {
      values.push((node as any)[`${key}_count`] ?? 0);
    });

    // Add scores
    groupKeys.forEach(key => {
      values.push((node as any)[`${key}_normalized`] ?? 0);
    });

    // Add diff if 2 groups
    if (groupNames.length === 2) {
      const diff = (node as any).difference ?? 0;
      const emphasis = Math.abs(diff) < 10 ? 'Balanced' :
        (diff > 0 ? groupNames[0] : groupNames[1]);
      values.push(diff, emphasis);
    }

    values.push(node.avg_normalized);

    if (groupNames.length > 1) {
      values.push((node as any).group_count ?? '-');
    }

    // Add clusters
    groupKeys.forEach(key => {
      const cluster = (node as any)[`${key}_cluster`];
      values.push(cluster >= 0 ? cluster : '');
    });

    // Add metrics
    groupKeys.forEach(key => {
      values.push(
        (node as any)[`${key}_degree`] ?? 0,
        (node as any)[`${key}_strength`] ?? 0,
        (node as any)[`${key}_betweenness`] ?? 0,
        (node as any)[`${key}_closeness`] ?? 0,
        (node as any)[`${key}_eigenvector`] ?? 0,
        (node as any)[`${key}_pagerank`] ?? 0,
        (node as any)[`${key}_harmonic`] ?? 0,
        (node as any)[`${key}_kcore`] ?? 0,
        (node as any)[`${key}_constraint`] ?? 0
      );
    });

    values.push(hiddenWords.has(node.word) ? 'No' : 'Yes');

    return values.join(',');
  });

  return [headers.join(','), ...rows].join('\n');
}

/**
 * Download CSV file
 */
export function downloadCSV(content: string, filename: string): void {
  const blob = new Blob([content], { type: 'text/csv' });
  const url = window.URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  window.URL.revokeObjectURL(url);
}
