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
  timeout: 300000, // 5 minutes for large files with semantic analysis
});

// Add auth interceptor to attach Bearer token
api.interceptors.request.use(async (config) => {
  const { data: { session } } = await supabase.auth.getSession();

  if (session?.access_token) {
    config.headers.Authorization = `Bearer ${session.access_token}`;
  }

  return config;
});

// Handle 401 responses by redirecting to login
api.interceptors.response.use(
  (response) => response,
  async (error) => {
    if (error.response?.status === 401) {
      // Session expired or invalid - sign out
      await supabase.auth.signOut();
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

  // Add group configs as JSON
  const groupConfigs = config.groups.map(g => ({
    name: g.name,
    text_column: g.textColumn
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
      { name: config.groups[0]?.name || 'Group A', textColumn: config.groups[0]?.textColumn || 1 },
      { name: config.groups[1]?.name || 'Group B', textColumn: config.groups[1]?.textColumn || 1 }
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

export default api;
