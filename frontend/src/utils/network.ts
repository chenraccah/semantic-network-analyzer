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
export function getEmphasisType(difference: number): 'group_a' | 'group_b' | 'balanced' {
  if (Math.abs(difference) < 10) return 'balanced';
  return difference > 0 ? 'group_a' : 'group_b';
}

/**
 * Get node color based on color mode
 */
export function getNodeColor(
  node: ComparisonNode,
  colorMode: ColorMode,
  groupAClusterKey: string = 'group_a_cluster',
  groupBClusterKey: string = 'group_b_cluster'
): string {
  if (colorMode === 'group_a_cluster') {
    const cluster = (node as any)[groupAClusterKey] ?? -1;
    return cluster >= 0 && cluster < CLUSTER_COLORS.length 
      ? CLUSTER_COLORS[cluster] 
      : '#ccc';
  }
  
  if (colorMode === 'group_b_cluster') {
    const cluster = (node as any)[groupBClusterKey] ?? -1;
    return cluster >= 0 && cluster < CLUSTER_COLORS.length 
      ? CLUSTER_COLORS[cluster] 
      : '#ccc';
  }
  
  // Emphasis mode
  const emphasis = getEmphasisType(node.difference);
  return EMPHASIS_COLORS[emphasis];
}

/**
 * Get node size based on mode
 */
export function getNodeSize(
  node: ComparisonNode,
  colorMode: ColorMode,
  groupABetweennessKey: string = 'group_a_betweenness',
  groupBBetweennessKey: string = 'group_b_betweenness'
): number {
  const MIN_SIZE = 30;
  const MAX_SIZE = 80;
  
  let value: number;
  
  if (colorMode === 'group_a_cluster') {
    value = (node as any)[groupABetweennessKey] ?? 0;
    return Math.max(MIN_SIZE, MIN_SIZE + value * (MAX_SIZE - MIN_SIZE));
  }
  
  if (colorMode === 'group_b_cluster') {
    value = (node as any)[groupBBetweennessKey] ?? 0;
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
  groupANormalizedKey: string = 'group_a_normalized',
  groupBNormalizedKey: string = 'group_b_normalized',
  groupAClusterKey: string = 'group_a_cluster',
  groupBClusterKey: string = 'group_b_cluster'
): ComparisonNode[] {
  return nodes.filter(node => {
    // Check hidden
    if (filterState.hiddenWords.has(node.word)) return false;
    
    // Check min score
    if (node.avg_normalized < filterState.minScore) return false;
    
    // Check perspective filter
    switch (filterState.filterType) {
      case 'group_a':
        if (node.difference <= 10) return false;
        break;
      case 'group_b':
        if (node.difference >= -10) return false;
        break;
      case 'balanced':
        if (Math.abs(node.difference) > 10) return false;
        break;
      case 'both':
        if (!node.in_both) return false;
        break;
      case 'group_a_cluster': {
        const cluster = (node as any)[groupAClusterKey];
        const normalized = (node as any)[groupANormalizedKey];
        if (cluster < 0) return false;
        if (normalized < 2) return false;
        if (filterState.clusterNumber !== 'all' && cluster !== filterState.clusterNumber) return false;
        break;
      }
      case 'group_b_cluster': {
        const cluster = (node as any)[groupBClusterKey];
        const normalized = (node as any)[groupBNormalizedKey];
        if (cluster < 0) return false;
        if (normalized < 2) return false;
        if (filterState.clusterNumber !== 'all' && cluster !== filterState.clusterNumber) return false;
        break;
      }
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
  groupAName: string,
  groupBName: string,
  hiddenWords: Set<string>
): string {
  const headers = [
    'Word',
    `${groupAName}_Count`,
    `${groupBName}_Count`,
    `${groupAName}_Score`,
    `${groupBName}_Score`,
    'Diff',
    'Avg',
    'Emphasis',
    `${groupAName}_Cluster`,
    `${groupBName}_Cluster`,
    `${groupAName}_Degree`,
    `${groupAName}_Strength`,
    `${groupAName}_Betweenness`,
    `${groupAName}_Closeness`,
    `${groupAName}_Eigenvector`,
    `${groupBName}_Degree`,
    `${groupBName}_Strength`,
    `${groupBName}_Betweenness`,
    `${groupBName}_Closeness`,
    `${groupBName}_Eigenvector`,
    'Visible'
  ];
  
  const rows = data.map(node => {
    const emphasis = Math.abs(node.difference) < 10 ? 'Balanced' : 
      (node.difference > 0 ? groupAName : groupBName);
    
    return [
      node.word,
      node.group_a_count,
      node.group_b_count,
      node.group_a_normalized,
      node.group_b_normalized,
      node.difference,
      node.avg_normalized,
      emphasis,
      node.group_a_cluster >= 0 ? node.group_a_cluster : '',
      node.group_b_cluster >= 0 ? node.group_b_cluster : '',
      node.group_a_degree,
      node.group_a_strength,
      node.group_a_betweenness,
      node.group_a_closeness,
      node.group_a_eigenvector,
      node.group_b_degree,
      node.group_b_strength,
      node.group_b_betweenness,
      node.group_b_closeness,
      node.group_b_eigenvector,
      hiddenWords.has(node.word) ? 'No' : 'Yes'
    ].join(',');
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
