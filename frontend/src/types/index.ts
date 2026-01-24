/**
 * Type definitions for the Semantic Network Analyzer
 */

// ============= Auth Types =============

export interface User {
  id: string;
  email?: string;
  user_metadata?: Record<string, any>;
  created_at?: string;
}

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

// Dynamic comparison node - keys are generated based on group names
export interface ComparisonNode {
  word: string;
  avg_normalized: number;
  in_all?: boolean;      // For multi-group: word appears in all groups
  in_both?: boolean;     // For 2 groups: backwards compatibility
  group_count?: number;  // Number of groups this word appears in
  difference?: number;   // For 2 groups: normalized difference
  // Dynamic keys per group: {group_key}_count, {group_key}_normalized,
  // {group_key}_cluster, {group_key}_degree, {group_key}_strength,
  // {group_key}_betweenness, {group_key}_closeness, {group_key}_eigenvector
  [key: string]: string | number | boolean | undefined;
}

export interface NetworkEdge {
  from: string;
  to: string;
  weight: number;
  semantic_similarity?: number;
  edge_type?: 'semantic' | 'cooccurrence';
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

// Dynamic stats - keys are generated based on group names
export interface NetworkStats {
  total_words: number;
  words_in_all?: number;   // Words in all groups
  words_in_both?: number;  // For 2 groups: backwards compatibility
  total_edges: number;
  // Dynamic keys per group: {group_key}_total, {group_key}_clusters, {group_key}_only
  [key: string]: number | undefined;
}

export interface AnalysisResult {
  success: boolean;
  analysis_data: ComparisonNode[];  // Multi-group uses analysis_data
  comparison_data?: ComparisonNode[]; // Legacy 2-group uses comparison_data
  edges: NetworkEdge[];
  stats: NetworkStats;
  group_names: string[];
  group_keys: string[];
  num_groups: number;
  // Legacy 2-group fields for backwards compatibility
  group_a_name?: string;
  group_b_name?: string;
  num_texts_a?: number;
  num_texts_b?: number;
  // Dynamic num_texts per group: num_texts_{group_key}
  semantic_enabled?: boolean;
  semantic_edges_added?: number;
  processing_time?: number;
  [key: string]: any;
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

export interface GroupConfig {
  name: string;
  textColumn: number;
  file?: File;
}

export interface AnalysisConfig {
  groups: GroupConfig[];
  minFrequency: number;
  minScoreThreshold: number;
  clusterMethod: 'louvain' | 'spectral';
  wordMappings: Record<string, string>;
  deleteWords: string[];
  unifyPlurals: boolean;
  useSemantic: boolean;
  semanticThreshold: number;
}

// ============= UI State Types =============

export type LayoutType = 'force' | 'clustered';

// Filter types - dynamic group filters use group_key pattern
export type FilterType =
  | 'all'
  | 'balanced'
  | 'in_all'       // Words in all groups
  | string;        // Dynamic: '{group_key}' or '{group_key}_cluster'

// Color modes - dynamic group clusters use group_key pattern
export type ColorMode = 'emphasis' | string;  // Dynamic: '{group_key}_cluster'

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
  groupNames: string[];
  groupKeys: string[];
  onNodeClick?: (word: string) => void;
}

export interface DataTableProps {
  data: ComparisonNode[];
  filterState: FilterState;
  groupNames: string[];
  groupKeys: string[];
  onToggleVisibility: (word: string) => void;
  onSearch: (query: string) => void;
}

export interface ControlPanelProps {
  filterState: FilterState;
  visualizationState: VisualizationState;
  groupNames: string[];
  groupKeys: string[];
  onFilterChange: (filter: Partial<FilterState>) => void;
  onVisualizationChange: (viz: Partial<VisualizationState>) => void;
  onApply: () => void;
  onExport: () => void;
  onSave?: () => void;
}

// ============= Subscription Types =============

export type SubscriptionTier = 'free' | 'pro' | 'enterprise';

export interface TierLimits {
  max_groups: number;
  max_analyses_per_day: number | null;
  max_words: number | null;
  max_file_size_mb: number;
  semantic_enabled: boolean;
  chat_enabled: boolean;
  chat_messages_per_month: number | null;
  export_enabled: boolean;
  save_analyses_days: number;
  api_access: boolean;
}

export interface TierPricing {
  name: string;
  price: number;
  price_display: string;
  description: string;
}

export interface UsageStatus {
  allowed: boolean;
  remaining?: number | null;
  tier: SubscriptionTier;
  message?: string;
  limit?: number;
  used?: number;
}

export interface UserProfile {
  id: string;
  email: string;
  tier: SubscriptionTier;
  limits: TierLimits;
  usage: {
    analyses_today: number;
    chat_messages_month: number;
  };
  analysis_status: UsageStatus;
  chat_status: UsageStatus;
  stripe_customer_id?: string | null;
  stripe_subscription_id?: string | null;
}

export interface AllTierLimits {
  tiers: Record<SubscriptionTier, TierLimits>;
  pricing: Record<SubscriptionTier, TierPricing>;
}
