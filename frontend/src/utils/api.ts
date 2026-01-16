/**
 * API service for communicating with the backend
 */

import axios from 'axios';
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
 * Analyze comparison between two groups
 */
export async function analyzeComparison(
  fileA: File,
  fileB: File,
  config: AnalysisConfig
): Promise<AnalysisResult> {
  const formData = new FormData();
  formData.append('file_a', fileA);
  formData.append('file_b', fileB);
  formData.append('group_a_name', config.groupAName);
  formData.append('group_b_name', config.groupBName);
  formData.append('text_column_a', String(config.textColumnA));
  formData.append('text_column_b', String(config.textColumnB));
  formData.append('min_frequency', String(config.minFrequency));
  formData.append('min_score_threshold', String(config.minScoreThreshold));
  formData.append('cluster_method', config.clusterMethod);
  formData.append('word_mappings', JSON.stringify(config.wordMappings));
  formData.append('delete_words', JSON.stringify(config.deleteWords));
  formData.append('use_semantic', String(config.useSemantic));
  formData.append('semantic_threshold', String(config.semanticThreshold));

  const response = await api.post<AnalysisResult>('/analyze/compare', formData);
  return response.data;
}

/**
 * Get word pairs analysis
 */
export async function analyzeWordPairs(
  fileA: File,
  fileB: File,
  config: Pick<AnalysisConfig, 'groupAName' | 'groupBName' | 'textColumnA' | 'textColumnB' | 'wordMappings' | 'deleteWords'>
): Promise<WordPairResult> {
  const formData = new FormData();
  formData.append('file_a', fileA);
  formData.append('file_b', fileB);
  formData.append('group_a_name', config.groupAName);
  formData.append('group_b_name', config.groupBName);
  formData.append('text_column_a', String(config.textColumnA));
  formData.append('text_column_b', String(config.textColumnB));
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

export default api;
