import { useState, useCallback } from 'react';
import { FileUpload } from './components/FileUpload';
import { ConfigPanel } from './components/ConfigPanel';
import { NetworkGraph } from './components/NetworkGraph';
import { DataTable } from './components/DataTable';
import { ControlPanel } from './components/ControlPanel';
import { ChatPanel } from './components/ChatPanel';
import { analyzeMultiGroup } from './utils/api';
import { exportToCSV, downloadCSV } from './utils/network';
import type {
  AnalysisResult,
  AnalysisConfig,
  FilterState,
  VisualizationState,
  GroupConfig
} from './types';

const DEFAULT_CONFIG: AnalysisConfig = {
  groups: [
    { name: 'Group 1', textColumn: 1 }
  ],
  minFrequency: 1,
  minScoreThreshold: 2.0,
  clusterMethod: 'louvain',
  wordMappings: {},
  deleteWords: [],
  unifyPlurals: true,
  useSemantic: false,
  semanticThreshold: 0.5,
};

const MAX_GROUPS = 5;

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
  // File state - array of files matching groups
  const [files, setFiles] = useState<(File | null)[]>([null]);

  // Config state
  const [config, setConfig] = useState<AnalysisConfig>(DEFAULT_CONFIG);

  // Analysis state
  const [analysisResult, setAnalysisResult] = useState<AnalysisResult | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [elapsedTime, setElapsedTime] = useState(0);
  const [analysisStage, setAnalysisStage] = useState('');

  // UI state
  const [filterState, setFilterState] = useState<FilterState>(DEFAULT_FILTER_STATE);
  const [vizState, setVizState] = useState<VisualizationState>(DEFAULT_VIZ_STATE);
  const [activeTab, setActiveTab] = useState<'upload' | 'analysis'>('upload');

  // Add a new group
  const handleAddGroup = useCallback(() => {
    if (config.groups.length >= MAX_GROUPS) return;
    const newGroupNum = config.groups.length + 1;
    setConfig(prev => ({
      ...prev,
      groups: [...prev.groups, { name: `Group ${newGroupNum}`, textColumn: 1 }]
    }));
    setFiles(prev => [...prev, null]);
  }, [config.groups.length]);

  // Remove a group
  const handleRemoveGroup = useCallback((index: number) => {
    if (config.groups.length <= 1) return;
    setConfig(prev => ({
      ...prev,
      groups: prev.groups.filter((_, i) => i !== index)
    }));
    setFiles(prev => prev.filter((_, i) => i !== index));
  }, [config.groups.length]);

  // Update a specific group config
  const handleGroupConfigChange = useCallback((index: number, changes: Partial<GroupConfig>) => {
    setConfig(prev => ({
      ...prev,
      groups: prev.groups.map((g, i) => i === index ? { ...g, ...changes } : g)
    }));
  }, []);

  // Set file for a specific group
  const handleFileSelect = useCallback((index: number, file: File) => {
    setFiles(prev => {
      const newFiles = [...prev];
      newFiles[index] = file;
      return newFiles;
    });
  }, []);

  // Handle analysis
  const handleAnalyze = useCallback(async () => {
    // Check that all groups have files
    const validFiles = files.filter((f): f is File => f !== null);
    if (validFiles.length !== config.groups.length) {
      setError('Please select a file for each group');
      return;
    }

    setIsAnalyzing(true);
    setError(null);
    setElapsedTime(0);
    setAnalysisStage('Reading files...');

    // Start timer
    const startTime = Date.now();
    const timerInterval = setInterval(() => {
      const elapsed = Math.floor((Date.now() - startTime) / 1000);
      setElapsedTime(elapsed);

      // Update stage based on elapsed time
      if (elapsed < 2) {
        setAnalysisStage('Reading files...');
      } else if (elapsed < 5) {
        setAnalysisStage('Processing text...');
      } else if (elapsed < 15) {
        setAnalysisStage('Building co-occurrence network...');
      } else if (config.useSemantic && elapsed < 60) {
        setAnalysisStage('Computing semantic similarities...');
      } else if (elapsed < 120) {
        setAnalysisStage('Calculating metrics...');
      } else {
        setAnalysisStage('Almost done...');
      }
    }, 1000);

    try {
      const result = await analyzeMultiGroup(validFiles, config);
      setAnalysisResult(result);
      setActiveTab('analysis');
      setFilterState(DEFAULT_FILTER_STATE);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Analysis failed');
    } finally {
      clearInterval(timerInterval);
      setIsAnalyzing(false);
      setAnalysisStage('');
    }
  }, [files, config]);

  // Handle filter changes
  const handleFilterChange = useCallback((changes: Partial<FilterState>) => {
    setFilterState(prev => ({ ...prev, ...changes }));

    // Update color mode based on filter type
    if (changes.filterType) {
      if (changes.filterType.endsWith('_cluster')) {
        setVizState(prev => ({ ...prev, colorMode: changes.filterType as string }));
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

    const data = analysisResult.analysis_data || analysisResult.comparison_data || [];
    const csv = exportToCSV(
      data,
      analysisResult.group_names,
      analysisResult.group_keys,
      filterState.hiddenWords
    );

    downloadCSV(csv, 'semantic_network_analysis.csv');
  }, [analysisResult, filterState.hiddenWords]);

  // Get analysis data (handle both legacy and new format)
  const getAnalysisData = () => {
    if (!analysisResult) return [];
    return analysisResult.analysis_data || analysisResult.comparison_data || [];
  };

  // Get shared words count
  const getSharedWordsCount = () => {
    if (!analysisResult) return 0;
    return analysisResult.stats.words_in_all ?? analysisResult.stats.words_in_both ?? 0;
  };

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
              <div className="flex justify-between items-center mb-4">
                <h2 className="text-xl font-semibold">📂 Upload Files</h2>
                {config.groups.length < MAX_GROUPS && (
                  <button
                    onClick={handleAddGroup}
                    className="px-4 py-2 bg-primary-500 text-white rounded hover:bg-primary-600 text-sm"
                  >
                    + Add Group
                  </button>
                )}
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {config.groups.map((group, index) => (
                  <div key={index} className="relative">
                    {config.groups.length > 1 && (
                      <button
                        onClick={() => handleRemoveGroup(index)}
                        className="absolute -top-2 -right-2 w-6 h-6 bg-red-500 text-white rounded-full text-sm hover:bg-red-600 z-10"
                        title="Remove group"
                      >
                        ×
                      </button>
                    )}
                    <FileUpload
                      label={group.name}
                      onFileSelect={(file) => handleFileSelect(index, file)}
                      selectedFile={files[index] ?? undefined}
                    />
                  </div>
                ))}
              </div>
            </div>

            {/* Configuration Section */}
            <ConfigPanel
              config={config}
              onChange={setConfig}
              onGroupConfigChange={handleGroupConfigChange}
            />

            {/* Analyze Button */}
            <div className="flex flex-col items-center gap-4">
              <button
                onClick={handleAnalyze}
                disabled={files.some(f => f === null) || isAnalyzing}
                className={`px-8 py-3 rounded-lg font-semibold text-white ${
                  files.some(f => f === null) || isAnalyzing
                    ? 'bg-gray-400 cursor-not-allowed'
                    : 'bg-green-500 hover:bg-green-600'
                }`}
              >
                {isAnalyzing ? '🔄 Analyzing...' : '🚀 Run Analysis'}
              </button>

              {/* Progress Indicator */}
              {isAnalyzing && (
                <div className="w-full max-w-md bg-white rounded-lg shadow p-4">
                  <div className="flex justify-between items-center mb-2">
                    <span className="text-sm font-medium text-gray-700">{analysisStage}</span>
                    <span className="text-sm text-gray-500">{elapsedTime}s</span>
                  </div>
                  <div className="w-full bg-gray-200 rounded-full h-2">
                    <div
                      className="bg-primary-500 h-2 rounded-full transition-all duration-500 animate-pulse"
                      style={{ width: `${Math.min((elapsedTime / (config.useSemantic ? 60 : 30)) * 100, 95)}%` }}
                    />
                  </div>
                  <p className="text-xs text-gray-400 mt-2 text-center">
                    {config.useSemantic
                      ? 'Semantic analysis may take up to 2 minutes for large files'
                      : 'Analysis typically takes 10-30 seconds'}
                  </p>
                </div>
              )}
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
                    {getSharedWordsCount()}
                  </div>
                  <div className="text-sm text-gray-500">
                    {analysisResult.num_groups > 1 ? 'In All Groups' : 'Unique'}
                  </div>
                </div>
                <div className="text-center">
                  <div className="text-3xl font-bold text-primary-600">
                    {analysisResult.stats.total_edges}
                  </div>
                  <div className="text-sm text-gray-500">Edges</div>
                </div>
                <div className="text-center">
                  <div className="text-3xl font-bold text-primary-600">
                    {getAnalysisData().length - filterState.hiddenWords.size}
                  </div>
                  <div className="text-sm text-gray-500">Visible</div>
                </div>
              </div>
            </div>

            {/* Control Panel */}
            <ControlPanel
              filterState={filterState}
              visualizationState={vizState}
              groupNames={analysisResult.group_names}
              groupKeys={analysisResult.group_keys}
              onFilterChange={handleFilterChange}
              onVisualizationChange={(changes) => setVizState(prev => ({ ...prev, ...changes }))}
              onApply={() => {}}
              onExport={handleExport}
            />

            {/* Network Visualization */}
            <div className="bg-white rounded-lg shadow">
              <NetworkGraph
                nodes={getAnalysisData()}
                edges={analysisResult.edges}
                filterState={filterState}
                visualizationState={vizState}
                groupNames={analysisResult.group_names}
                groupKeys={analysisResult.group_keys}
              />
            </div>

            {/* Data Table */}
            <div className="bg-white rounded-lg shadow">
              <DataTable
                data={getAnalysisData()}
                filterState={filterState}
                groupNames={analysisResult.group_names}
                groupKeys={analysisResult.group_keys}
                onToggleVisibility={handleToggleVisibility}
                onSearch={(query) => handleFilterChange({ searchQuery: query })}
              />
            </div>

            {/* Chat Panel - floating button that opens chat */}
            <ChatPanel
              analysisData={getAnalysisData()}
              stats={analysisResult.stats}
              groupNames={analysisResult.group_names}
              groupKeys={analysisResult.group_keys}
            />
          </div>
        )}
      </main>
    </div>
  );
}

export default App;
