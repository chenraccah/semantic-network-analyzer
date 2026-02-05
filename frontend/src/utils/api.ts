/**
 * API service for communicating with the backend
 */

import axios from 'axios';
import { supabase } from './supabase';
import type {
  AnalysisResult,
  WordPairResult,
  FilePreview,
  AnalysisConfig
} from '../types';

const API_BASE_URL = '/api';

const api = axios.create({
  baseURL: API_BASE_URL,
  timeout: 600000, // 10 minutes for large files with semantic analysis
});

// Add auth interceptor to attach Bearer token
api.interceptors.request.use(async (config) => {
  const { data: { session } } = await supabase.auth.getSession();

  if (session?.access_token) {
    config.headers.Authorization = `Bearer ${session.access_token}`;
    console.log('[API] Request with token:', config.url, 'token starts with:', session.access_token.substring(0, 20));
  } else {
    console.log('[API] Request WITHOUT token:', config.url);
  }

  return config;
});

// Handle 401 responses - don't auto-signout for profile endpoints (they're called early)
api.interceptors.response.use(
  (response) => response,
  async (error) => {
    if (error.response?.status === 401) {
      const url = error.config?.url || '';
      // Don't sign out for profile/limits endpoints - these might fail during auth transition
      if (url.includes('/user/profile') || url.includes('/user/limits')) {
        // Just reject, don't sign out
        return Promise.reject(error);
      }
      // For other endpoints, sign out if session exists
      const { data: { session } } = await supabase.auth.getSession();
      if (session) {
        await supabase.auth.signOut();
      }
    }
    return Promise.reject(error);
  }
);

/**
 * Preview a file's contents
 */
export async function previewFile(
  file: File,
  textColumn: number = 1,
  numRows: number = 5
): Promise<FilePreview> {
  const formData = new FormData();
  formData.append('file', file);
  formData.append('text_column', String(textColumn));
  formData.append('num_rows', String(numRows));

  const response = await api.post<FilePreview>('/preview', formData);
  return response.data;
}

/**
 * Analyze multiple groups (1 to N)
 */
export async function analyzeMultiGroup(
  files: File[],
  config: AnalysisConfig
): Promise<AnalysisResult> {
  const formData = new FormData();

  // Add files with indexed keys
  files.forEach((file, index) => {
    formData.append(`file_${index}`, file);
  });

  // Add group configs as JSON (includes per-group min_score_threshold)
  const groupConfigs = config.groups.map(g => ({
    name: g.name,
    text_column: g.textColumn,
    min_score_threshold: g.minScoreThreshold ?? config.minScoreThreshold
  }));
  formData.append('group_configs', JSON.stringify(groupConfigs));

  // Add other config options
  formData.append('min_frequency', String(config.minFrequency));
  formData.append('min_score_threshold', String(config.minScoreThreshold));
  formData.append('cluster_method', config.clusterMethod);
  formData.append('word_mappings', JSON.stringify(config.wordMappings));
  formData.append('delete_words', JSON.stringify(config.deleteWords));
  formData.append('use_semantic', String(config.useSemantic));
  formData.append('semantic_threshold', String(config.semanticThreshold));
  formData.append('unify_plurals', String(config.unifyPlurals));

  const response = await api.post<AnalysisResult>('/analyze/multi', formData);
  return response.data;
}

/**
 * Analyze comparison between two groups (legacy)
 */
export async function analyzeComparison(
  fileA: File,
  fileB: File,
  config: AnalysisConfig
): Promise<AnalysisResult> {
  // Use the multi-group endpoint with 2 groups
  return analyzeMultiGroup([fileA, fileB], {
    ...config,
    groups: [
      { name: config.groups[0]?.name || 'Group A', textColumn: config.groups[0]?.textColumn || 1, minScoreThreshold: config.groups[0]?.minScoreThreshold ?? config.minScoreThreshold },
      { name: config.groups[1]?.name || 'Group B', textColumn: config.groups[1]?.textColumn || 1, minScoreThreshold: config.groups[1]?.minScoreThreshold ?? config.minScoreThreshold }
    ]
  });
}

/**
 * Get word pairs analysis
 */
export async function analyzeWordPairs(
  fileA: File,
  fileB: File,
  config: Pick<AnalysisConfig, 'groups' | 'wordMappings' | 'deleteWords'>
): Promise<WordPairResult> {
  const formData = new FormData();
  formData.append('file_a', fileA);
  formData.append('file_b', fileB);
  formData.append('group_a_name', config.groups[0]?.name || 'Group A');
  formData.append('group_b_name', config.groups[1]?.name || 'Group B');
  formData.append('text_column_a', String(config.groups[0]?.textColumn || 1));
  formData.append('text_column_b', String(config.groups[1]?.textColumn || 1));
  formData.append('word_mappings', JSON.stringify(config.wordMappings));
  formData.append('delete_words', JSON.stringify(config.deleteWords));

  const response = await api.post<WordPairResult>('/analyze/word-pairs', formData);
  return response.data;
}

/**
 * Get default stopwords
 */
export async function getStopwords(): Promise<string[]> {
  const response = await api.get<{ stopwords: string[] }>('/stopwords');
  return response.data.stopwords;
}

/**
 * Health check
 */
export async function healthCheck(): Promise<boolean> {
  try {
    const response = await axios.get('/health');
    return response.data.status === 'healthy';
  } catch {
    return false;
  }
}

/**
 * Chat response type
 */
export interface ChatResponse {
  success: boolean;
  response: string | null;
  error?: string;
  history: Array<{ role: string; content: string }>;
  tokens_used?: number;
  chat_remaining?: number | null;
  limit_exceeded?: boolean;
  tier?: string;
}

/**
 * Chat status response
 */
export interface ChatStatusResponse {
  available: boolean;
  model: string | null;
  tier?: string;
  chat_limit?: {
    allowed: boolean;
    remaining?: number | null;
    tier: string;
    message?: string;
    limit?: number;
    used?: number;
  };
}

/**
 * Check if chat service is available
 */
export async function checkChatStatus(): Promise<ChatStatusResponse> {
  const response = await api.get<ChatStatusResponse>('/chat/status');
  return response.data;
}

/**
 * Send a chat message about the analysis
 */
export async function chatAboutAnalysis(
  message: string,
  analysisData: any[],
  stats: any,
  groupNames: string[],
  groupKeys: string[],
  conversationHistory: Array<{ role: string; content: string }> = []
): Promise<ChatResponse> {
  const response = await api.post<ChatResponse>('/chat', {
    message,
    analysis_data: analysisData,
    stats,
    group_names: groupNames,
    group_keys: groupKeys,
    conversation_history: conversationHistory
  });
  return response.data;
}

/**
 * Checkout response type
 */
export interface CheckoutResponse {
  session_id: string;
  checkout_url: string;
}

/**
 * Portal response type
 */
export interface PortalResponse {
  portal_url: string;
}

/**
 * Create a Stripe checkout session for subscription upgrade
 */
export async function createCheckoutSession(
  tier: 'pro' | 'enterprise',
  successUrl: string,
  cancelUrl: string
): Promise<CheckoutResponse> {
  const response = await api.post<CheckoutResponse>('/billing/checkout', {
    tier,
    success_url: successUrl,
    cancel_url: cancelUrl
  });
  return response.data;
}

/**
 * Create a Stripe customer portal session
 */
export async function createPortalSession(): Promise<PortalResponse> {
  const response = await api.post<PortalResponse>('/billing/portal');
  return response.data;
}

// ============================================================
// SAVED ANALYSES API
// ============================================================

/**
 * Saved analysis summary (for list view)
 */
export interface SavedAnalysisSummary {
  id: string;
  name: string;
  created_at: string;
  expires_at: string | null;
}

/**
 * Full saved analysis with config and results
 */
export interface SavedAnalysis {
  id: string;
  name: string;
  config: any;
  results: any;
  created_at: string;
  expires_at: string | null;
}

/**
 * Save check response
 */
export interface SaveCheckResponse {
  allowed: boolean;
  tier: string;
  expires_days?: number;
  message?: string;
}

/**
 * Check if user can save analyses
 */
export async function checkSaveAccess(): Promise<SaveCheckResponse> {
  const response = await api.get<SaveCheckResponse>('/analyses/check');
  return response.data;
}

/**
 * Save an analysis
 */
export async function saveAnalysis(
  name: string,
  config: any,
  results: any
): Promise<{ success: boolean; id: string; expires_days: number }> {
  const response = await api.post('/analyses/save', { name, config, results });
  return response.data;
}

/**
 * Get all saved analyses
 */
export async function getSavedAnalyses(): Promise<{ analyses: SavedAnalysisSummary[]; count: number }> {
  const response = await api.get('/analyses');
  return response.data;
}

/**
 * Get a specific saved analysis
 */
export async function getSavedAnalysis(id: string): Promise<SavedAnalysis> {
  const response = await api.get(`/analyses/${id}`);
  return response.data;
}

/**
 * Delete a saved analysis
 */
export async function deleteSavedAnalysis(id: string): Promise<{ success: boolean }> {
  const response = await api.delete(`/analyses/${id}`);
  return response.data;
}

/**
 * Export analysis in various formats (server-side)
 */
export async function exportAnalysis(
  format: string,
  nodes: any[],
  edges: any[],
  stats: any,
  groupNames: string[],
  groupKeys: string[]
): Promise<Blob> {
  const response = await api.post('/export', {
    format,
    nodes,
    edges,
    stats,
    group_names: groupNames,
    group_keys: groupKeys,
  }, {
    responseType: 'blob',
  });
  return response.data;
}

/**
 * Compute shortest path between two nodes
 */
export async function getShortestPath(
  source: string,
  target: string,
  nodes: any[],
  edges: any[]
): Promise<{ success: boolean; path?: string[]; length?: number; hops?: number; error?: string }> {
  const response = await api.post('/shortest-path', { source, target, nodes, edges });
  return response.data;
}

/**
 * Get ego-network around a center node
 */
export async function getEgoNetwork(
  centerWord: string,
  hops: number,
  nodes: any[],
  edges: any[]
): Promise<{ success: boolean; ego_nodes: string[]; ego_edges: any[]; num_nodes: number; num_edges: number }> {
  const response = await api.post('/ego-network', { center_word: centerWord, hops, nodes, edges });
  return response.data;
}

export default api;
