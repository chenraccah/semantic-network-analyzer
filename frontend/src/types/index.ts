/**
 * Type definitions for the Semantic Network Analyzer
 */

// ============= API Types =============

export interface WordNode {
  word: string;
  count: number;
  normalized: number;
  cluster: number;
  degree: number;
  strength: number;
  betweenness: number;
  closeness: number;
  eigenvector: number;
}

export interface ComparisonNode {
  word: string;
  group_a_count: number;
  group_b_count: number;
  group_a_normalized: number;
  group_b_normalized: number;
  difference: number;
  avg_normalized: number;
  in_both: boolean;
  group_a_cluster: number;
  group_b_cluster: number;
  group_a_degree: number;
  group_a_strength: number;
  group_a_betweenness: number;
  group_a_closeness: number;
  group_a_eigenvector: number;
  group_b_degree: number;
  group_b_strength: number;
  group_b_betweenness: number;
  group_b_closeness: number;
  group_b_eigenvector: number;
}

export interface NetworkEdge {
  from: string;
  to: string;
  weight: number;
}

export interface WordPair {
  word_1: string;
  word_2: string;
  group_a_connections: number;
  group_b_connections: number;
  total_connections: number;
  group_a_normalized: number;
  group_b_normalized: number;
  total_normalized: number;
  difference: number;
}

export interface NetworkStats {
  total_words: number;
  words_in_both: number;
  group_a_only: number;
  group_b_only: number;
  total_edges: number;
  group_a_clusters: number;
  group_b_clusters: number;
}

export interface AnalysisResult {
  success: boolean;
  comparison_data: ComparisonNode[];
  edges: NetworkEdge[];
  stats: NetworkStats;
  group_a_name: string;
  group_b_name: string;
  num_texts_a: number;
  num_texts_b: number;
}

export interface WordPairResult {
  success: boolean;
  word_pairs: WordPair[];
  total_pairs: number;
}

export interface FilePreview {
  success: boolean;
  filename: string;
  num_rows: number;
  num_columns: number;
  columns: string[];
  preview: Record<string, any>[];
  text_column_preview: string[];
}

// ============= Configuration Types =============

export interface WordMapping {
  source: string;
  target: string;
}

export interface AnalysisConfig {
  groupAName: string;
  groupBName: string;
  textColumn: number;
  minFrequency: number;
  minScoreThreshold: number;
  clusterMethod: 'louvain' | 'spectral';
  wordMappings: Record<string, string>;
  deleteWords: string[];
  unifyPlurals: boolean;
}

// ============= UI State Types =============

export type LayoutType = 'force' | 'clustered';

export type FilterType = 
  | 'all' 
  | 'group_a' 
  | 'group_b' 
  | 'balanced' 
  | 'both' 
  | 'group_a_cluster' 
  | 'group_b_cluster';

export type ColorMode = 'emphasis' | 'group_a_cluster' | 'group_b_cluster';

export interface FilterState {
  filterType: FilterType;
  clusterNumber: number | 'all';
  minScore: number;
  minEdgeWeight: number;
  searchQuery: string;
  hiddenWords: Set<string>;
}

export interface VisualizationState {
  layout: LayoutType;
  colorMode: ColorMode;
}

// ============= Component Props Types =============

export interface FileUploadProps {
  label: string;
  onFileSelect: (file: File) => void;
  selectedFile?: File;
  accept?: string;
}

export interface NetworkGraphProps {
  nodes: ComparisonNode[];
  edges: NetworkEdge[];
  filterState: FilterState;
  visualizationState: VisualizationState;
  groupAName: string;
  groupBName: string;
  onNodeClick?: (word: string) => void;
}

export interface DataTableProps {
  data: ComparisonNode[];
  filterState: FilterState;
  groupAName: string;
  groupBName: string;
  onToggleVisibility: (word: string) => void;
  onSearch: (query: string) => void;
}

export interface ControlPanelProps {
  filterState: FilterState;
  visualizationState: VisualizationState;
  groupAName: string;
  groupBName: string;
  onFilterChange: (filter: Partial<FilterState>) => void;
  onVisualizationChange: (viz: Partial<VisualizationState>) => void;
  onApply: () => void;
  onExport: () => void;
}
