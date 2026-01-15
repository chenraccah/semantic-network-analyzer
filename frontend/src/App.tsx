import { useState, useCallback } from 'react';
import { FileUpload } from './components/FileUpload';
import { ConfigPanel } from './components/ConfigPanel';
import { NetworkGraph } from './components/NetworkGraph';
import { DataTable } from './components/DataTable';
import { ControlPanel } from './components/ControlPanel';
import { analyzeComparison } from './utils/api';
import { exportToCSV, downloadCSV } from './utils/network';
import type { 
  AnalysisResult, 
  AnalysisConfig, 
  FilterState, 
  VisualizationState,
  ComparisonNode 
} from './types';

const DEFAULT_CONFIG: AnalysisConfig = {
  groupAName: 'Group A',
  groupBName: 'Group B',
  textColumn: 1,
  minFrequency: 1,
  minScoreThreshold: 2.0,
  clusterMethod: 'louvain',
  wordMappings: {},
  deleteWords: [],
  unifyPlurals: true,
};

const DEFAULT_FILTER_STATE: FilterState = {
  filterType: 'all',
  clusterNumber: 'all',
  minScore: 0,
  minEdgeWeight: 1,
  searchQuery: '',
  hiddenWords: new Set(),
};

const DEFAULT_VIZ_STATE: VisualizationState = {
  layout: 'force',
  colorMode: 'emphasis',
};

function App() {
  // File state
  const [fileA, setFileA] = useState<File | null>(null);
  const [fileB, setFileB] = useState<File | null>(null);
  
  // Config state
  const [config, setConfig] = useState<AnalysisConfig>(DEFAULT_CONFIG);
  
  // Analysis state
  const [analysisResult, setAnalysisResult] = useState<AnalysisResult | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  // UI state
  const [filterState, setFilterState] = useState<FilterState>(DEFAULT_FILTER_STATE);
  const [vizState, setVizState] = useState<VisualizationState>(DEFAULT_VIZ_STATE);
  const [activeTab, setActiveTab] = useState<'upload' | 'analysis'>('upload');

  // Handle analysis
  const handleAnalyze = useCallback(async () => {
    if (!fileA || !fileB) {
      setError('Please select both files');
      return;
    }

    setIsAnalyzing(true);
    setError(null);

    try {
      const result = await analyzeComparison(fileA, fileB, config);
      setAnalysisResult(result);
      setActiveTab('analysis');
      setFilterState(DEFAULT_FILTER_STATE);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Analysis failed');
    } finally {
      setIsAnalyzing(false);
    }
  }, [fileA, fileB, config]);

  // Handle filter changes
  const handleFilterChange = useCallback((changes: Partial<FilterState>) => {
    setFilterState(prev => ({ ...prev, ...changes }));
    
    // Update color mode based on filter type
    if (changes.filterType) {
      if (changes.filterType === 'group_a_cluster') {
        setVizState(prev => ({ ...prev, colorMode: 'group_a_cluster' }));
      } else if (changes.filterType === 'group_b_cluster') {
        setVizState(prev => ({ ...prev, colorMode: 'group_b_cluster' }));
      } else {
        setVizState(prev => ({ ...prev, colorMode: 'emphasis' }));
      }
    }
  }, []);

  // Handle word visibility toggle
  const handleToggleVisibility = useCallback((word: string) => {
    setFilterState(prev => {
      const newHidden = new Set(prev.hiddenWords);
      if (newHidden.has(word)) {
        newHidden.delete(word);
      } else {
        newHidden.add(word);
      }
      return { ...prev, hiddenWords: newHidden };
    });
  }, []);

  // Handle export
  const handleExport = useCallback(() => {
    if (!analysisResult) return;
    
    const csv = exportToCSV(
      analysisResult.comparison_data,
      analysisResult.group_a_name,
      analysisResult.group_b_name,
      filterState.hiddenWords
    );
    
    downloadCSV(csv, 'semantic_network_analysis.csv');
  }, [analysisResult, filterState.hiddenWords]);

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-gradient-to-r from-primary-500 to-purple-600 text-white py-6 px-4">
        <div className="max-w-7xl mx-auto">
          <h1 className="text-3xl font-bold">Semantic Network Analyzer</h1>
          <p className="mt-2 text-primary-100">
            Compare and visualize semantic patterns between groups
          </p>
        </div>
      </header>

      {/* Tab Navigation */}
      <div className="max-w-7xl mx-auto px-4 mt-6">
        <div className="flex space-x-4 border-b border-gray-200">
          <button
            onClick={() => setActiveTab('upload')}
            className={`px-4 py-2 font-medium ${
              activeTab === 'upload'
                ? 'text-primary-600 border-b-2 border-primary-600'
                : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            📁 Upload & Configure
          </button>
          <button
            onClick={() => setActiveTab('analysis')}
            disabled={!analysisResult}
            className={`px-4 py-2 font-medium ${
              activeTab === 'analysis'
                ? 'text-primary-600 border-b-2 border-primary-600'
                : 'text-gray-500 hover:text-gray-700'
            } ${!analysisResult ? 'opacity-50 cursor-not-allowed' : ''}`}
          >
            📊 Analysis
          </button>
        </div>
      </div>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 py-6">
        {activeTab === 'upload' && (
          <div className="space-y-6">
            {/* File Upload Section */}
            <div className="bg-white rounded-lg shadow p-6">
              <h2 className="text-xl font-semibold mb-4">📂 Upload Files</h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <FileUpload
                  label={config.groupAName}
                  onFileSelect={setFileA}
                  selectedFile={fileA ?? undefined}
                />
                <FileUpload
                  label={config.groupBName}
                  onFileSelect={setFileB}
                  selectedFile={fileB ?? undefined}
                />
              </div>
            </div>

            {/* Configuration Section */}
            <ConfigPanel
              config={config}
              onChange={setConfig}
            />

            {/* Analyze Button */}
            <div className="flex justify-center">
              <button
                onClick={handleAnalyze}
                disabled={!fileA || !fileB || isAnalyzing}
                className={`px-8 py-3 rounded-lg font-semibold text-white ${
                  !fileA || !fileB || isAnalyzing
                    ? 'bg-gray-400 cursor-not-allowed'
                    : 'bg-green-500 hover:bg-green-600'
                }`}
              >
                {isAnalyzing ? '🔄 Analyzing...' : '🚀 Run Analysis'}
              </button>
            </div>

            {/* Error Display */}
            {error && (
              <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded">
                {error}
              </div>
            )}
          </div>
        )}

        {activeTab === 'analysis' && analysisResult && (
          <div className="space-y-6">
            {/* Stats Summary */}
            <div className="bg-white rounded-lg shadow p-6">
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="text-center">
                  <div className="text-3xl font-bold text-primary-600">
                    {analysisResult.stats.total_words}
                  </div>
                  <div className="text-sm text-gray-500">Total Words</div>
                </div>
                <div className="text-center">
                  <div className="text-3xl font-bold text-primary-600">
                    {analysisResult.stats.words_in_both}
                  </div>
                  <div className="text-sm text-gray-500">In Both</div>
                </div>
                <div className="text-center">
                  <div className="text-3xl font-bold text-primary-600">
                    {analysisResult.stats.total_edges}
                  </div>
                  <div className="text-sm text-gray-500">Edges</div>
                </div>
                <div className="text-center">
                  <div className="text-3xl font-bold text-primary-600">
                    {analysisResult.comparison_data.length - filterState.hiddenWords.size}
                  </div>
                  <div className="text-sm text-gray-500">Visible</div>
                </div>
              </div>
            </div>

            {/* Control Panel */}
            <ControlPanel
              filterState={filterState}
              visualizationState={vizState}
              groupAName={analysisResult.group_a_name}
              groupBName={analysisResult.group_b_name}
              onFilterChange={handleFilterChange}
              onVisualizationChange={setVizState}
              onApply={() => {}}
              onExport={handleExport}
            />

            {/* Network Visualization */}
            <div className="bg-white rounded-lg shadow">
              <NetworkGraph
                nodes={analysisResult.comparison_data}
                edges={analysisResult.edges}
                filterState={filterState}
                visualizationState={vizState}
                groupAName={analysisResult.group_a_name}
                groupBName={analysisResult.group_b_name}
              />
            </div>

            {/* Data Table */}
            <div className="bg-white rounded-lg shadow">
              <DataTable
                data={analysisResult.comparison_data}
                filterState={filterState}
                groupAName={analysisResult.group_a_name}
                groupBName={analysisResult.group_b_name}
                onToggleVisibility={handleToggleVisibility}
                onSearch={(query) => handleFilterChange({ searchQuery: query })}
              />
            </div>
          </div>
        )}
      </main>
    </div>
  );
}

export default App;
