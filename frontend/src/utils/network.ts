/**
 * Utility functions for network visualization
 */

import type { ComparisonNode, FilterState, ColorMode } from '../types';

// Cluster colors
export const CLUSTER_COLORS = [
  '#e74c3c',
  '#3498db',
  '#2ecc71',
  '#f39c12',
  '#9b59b6',
  '#1abc9c',
  '#34495e',
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
 * Get node color based on color mode
 */
export function getNodeColor(
  node: ComparisonNode,
  colorMode: ColorMode,
  _groupKeys: string[] = []
): string {
  // Check if it's a cluster mode (ends with _cluster)
  if (colorMode.endsWith('_cluster')) {
    const clusterKey = colorMode;  // e.g., "group_1_cluster"
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
 * Get node size based on mode
 */
export function getNodeSize(
  node: ComparisonNode,
  colorMode: ColorMode,
  _groupKeys: string[] = []
): number {
  const MIN_SIZE = 30;
  const MAX_SIZE = 80;

  let value: number;

  // Check if it's a cluster mode
  if (colorMode.endsWith('_cluster')) {
    // Extract the group key from color mode (e.g., "group_1_cluster" -> "group_1")
    const groupKey = colorMode.replace('_cluster', '');
    const betweennessKey = `${groupKey}_betweenness`;
    value = (node as any)[betweennessKey] ?? 0;
    return Math.max(MIN_SIZE, MIN_SIZE + value * (MAX_SIZE - MIN_SIZE));
  }

  // Default: use average normalized score
  value = node.avg_normalized / 100;
  return Math.max(MIN_SIZE, MIN_SIZE + value * (MAX_SIZE - MIN_SIZE));
}

/**
 * Get font size for node label
 */
export function getFontSize(avgNormalized: number, wordLength: number): number {
  const baseSize = Math.max(14, 12 + (avgNormalized / 100) * 12);
  return Math.min(baseSize, 300 / wordLength);
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
      // Find max normalized among other groups
      const otherMaxNorm = Math.max(
        ...groupKeys
          .filter(k => k !== filterType)
          .map(k => (node as any)[`${k}_normalized`] ?? 0)
      );
      // Only include if this group is emphasized (higher than others by 10%)
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
      `${groupNames[i]}_Eigenvector`
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
        (node as any)[`${key}_eigenvector`] ?? 0
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
