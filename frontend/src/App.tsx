import { useState, useCallback, useEffect } from 'react';
import { FileUpload } from './components/FileUpload';
import { ConfigPanel } from './components/ConfigPanel';
import { NetworkGraph } from './components/NetworkGraph';
import { DataTable } from './components/DataTable';
import { ControlPanel } from './components/ControlPanel';
import { ChatPanel } from './components/ChatPanel';
import { AuthForm } from './components/AuthForm';
import { UsageBanner } from './components/UsageBanner';
import { UpgradeModal } from './components/UpgradeModal';
import { BillingPage } from './components/BillingPage';
import { AnalysisHistory, SaveAnalysisDialog } from './components/AnalysisHistory';
import { useAuth } from './contexts/AuthContext';
import { useSubscription } from './contexts/SubscriptionContext';
import { analyzeMultiGroup, saveAnalysis, checkSaveAccess } from './utils/api';
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

const MAX_GROUPS_ABSOLUTE = 5; // Maximum groups allowed by the system

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
  const { user, loading, signOut } = useAuth();
  const {
    showUpgradeModal,
    closeUpgradeModal,
    getMaxGroups,
    canExport,
    openUpgradeModal,
    refreshProfile
  } = useSubscription();

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
  const [showBillingPage, setShowBillingPage] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  const [showSaveDialog, setShowSaveDialog] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [checkoutMessage, setCheckoutMessage] = useState<string | null>(null);

  // Handle checkout success/cancelled from URL params
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const checkout = params.get('checkout');

    if (checkout === 'success') {
      setCheckoutMessage('Payment successful! Your subscription has been activated.');
      refreshProfile();
      // Clean up URL
      window.history.replaceState({}, '', window.location.pathname);
    } else if (checkout === 'cancelled') {
      setCheckoutMessage('Checkout was cancelled. You can try again anytime.');
      window.history.replaceState({}, '', window.location.pathname);
    }
  }, [refreshProfile]);

  // Get the effective max groups based on subscription
  const effectiveMaxGroups = Math.min(getMaxGroups(), MAX_GROUPS_ABSOLUTE);

  // Add a new group
  const handleAddGroup = useCallback(() => {
    if (config.groups.length >= effectiveMaxGroups) {
      openUpgradeModal(`Your plan allows up to ${effectiveMaxGroups} group(s). Upgrade to analyze more groups.`);
      return;
    }
    const newGroupNum = config.groups.length + 1;
    setConfig(prev => ({
      ...prev,
      groups: [...prev.groups, { name: `Group ${newGroupNum}`, textColumn: 1 }]
    }));
    setFiles(prev => [...prev, null]);
  }, [config.groups.length, effectiveMaxGroups, openUpgradeModal]);

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
      // Refresh profile to update usage counts
      await refreshProfile();
    } catch (err: any) {
      // Handle limit exceeded errors
      if (err.response?.status === 403 && err.response?.data?.detail?.error === 'limit_exceeded') {
        const detail = err.response.data.detail;
        openUpgradeModal(detail.message || 'Limit exceeded. Upgrade for higher limits.');
        setError(detail.message || 'Limit exceeded');
      } else if (err.response?.status === 403 && err.response?.data?.detail?.error === 'feature_disabled') {
        const detail = err.response.data.detail;
        openUpgradeModal(detail.message || 'This feature requires an upgrade.');
        setError(detail.message || 'Feature not available');
      } else {
        setError(err instanceof Error ? err.message : 'Analysis failed');
      }
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

    // Check if user can export
    if (!canExport()) {
      openUpgradeModal('CSV export is a Pro feature. Upgrade to export your analysis data.');
      return;
    }

    const data = analysisResult.analysis_data || analysisResult.comparison_data || [];
    const csv = exportToCSV(
      data,
      analysisResult.group_names,
      analysisResult.group_keys,
      filterState.hiddenWords
    );

    downloadCSV(csv, 'semantic_network_analysis.csv');
  }, [analysisResult, filterState.hiddenWords, canExport, openUpgradeModal]);

  // Handle save analysis
  const handleSaveClick = useCallback(async () => {
    if (!analysisResult) return;

    // Check if user can save
    try {
      const saveCheck = await checkSaveAccess();
      if (!saveCheck.allowed) {
        openUpgradeModal(saveCheck.message || 'Saving analyses is a Pro feature.');
        return;
      }
      setShowSaveDialog(true);
    } catch (err) {
      console.error('Error checking save access:', err);
      openUpgradeModal('Saving analyses is a Pro feature.');
    }
  }, [analysisResult, openUpgradeModal]);

  const handleSaveAnalysis = useCallback(async (name: string) => {
    if (!analysisResult) return;

    setIsSaving(true);
    try {
      await saveAnalysis(name, config, analysisResult);
      setShowSaveDialog(false);
      setCheckoutMessage(`Analysis "${name}" saved successfully!`);
    } catch (err: any) {
      console.error('Error saving analysis:', err);
      setCheckoutMessage(err.response?.data?.detail || 'Failed to save analysis');
    } finally {
      setIsSaving(false);
    }
  }, [analysisResult, config]);

  // Handle loading a saved analysis
  const handleLoadAnalysis = useCallback((savedConfig: any, savedResults: any) => {
    // Restore config
    setConfig(savedConfig);

    // Restore files array to match groups
    setFiles(savedConfig.groups.map(() => null));

    // Restore results
    setAnalysisResult(savedResults);

    // Switch to analysis tab
    setActiveTab('analysis');

    // Reset filter state
    setFilterState(DEFAULT_FILTER_STATE);

    setCheckoutMessage('Analysis loaded successfully!');
  }, []);

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

  // Show loading state while checking auth
  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-gray-500">Loading...</div>
      </div>
    );
  }

  // Show auth form if not logged in
  if (!user) {
    return <AuthForm />;
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-gradient-to-r from-primary-500 to-purple-600 text-white py-6 px-4">
        <div className="max-w-7xl mx-auto flex justify-between items-start">
          <div>
            <h1 className="text-3xl font-bold">Semantic Network Analyzer</h1>
            <p className="mt-2 text-primary-100">
              Compare and visualize semantic patterns between groups
            </p>
          </div>
          <div className="flex items-center gap-4">
            <UsageBanner />
            <span className="text-sm text-primary-100">{user.email}</span>
            <button
              onClick={() => setShowHistory(true)}
              className="px-4 py-2 bg-white/10 hover:bg-white/20 rounded-lg text-sm font-medium transition-colors"
            >
              History
            </button>
            <button
              onClick={() => setShowBillingPage(true)}
              className="px-4 py-2 bg-white/10 hover:bg-white/20 rounded-lg text-sm font-medium transition-colors"
            >
              Billing
            </button>
            <button
              onClick={signOut}
              className="px-4 py-2 bg-white/10 hover:bg-white/20 rounded-lg text-sm font-medium transition-colors"
            >
              Sign Out
            </button>
          </div>
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
                <div>
                  <h2 className="text-xl font-semibold">Upload Files</h2>
                  <p className="text-sm text-gray-500">
                    {config.groups.length}/{effectiveMaxGroups} groups
                    {effectiveMaxGroups < MAX_GROUPS_ABSOLUTE && (
                      <button
                        onClick={() => openUpgradeModal('Upgrade to analyze more groups')}
                        className="ml-2 text-primary-500 hover:text-primary-600"
                      >
                        (upgrade for more)
                      </button>
                    )}
                  </p>
                </div>
                <button
                  onClick={handleAddGroup}
                  disabled={config.groups.length >= MAX_GROUPS_ABSOLUTE}
                  className={`px-4 py-2 rounded text-sm ${
                    config.groups.length >= effectiveMaxGroups
                      ? 'bg-gray-300 text-gray-500'
                      : 'bg-primary-500 text-white hover:bg-primary-600'
                  }`}
                >
                  + Add Group
                </button>
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
              onSave={handleSaveClick}
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

      {/* Upgrade Modal */}
      {showUpgradeModal && (
        <UpgradeModal onClose={closeUpgradeModal} />
      )}

      {/* Billing Page */}
      {showBillingPage && (
        <BillingPage onClose={() => setShowBillingPage(false)} />
      )}

      {/* Checkout Success/Cancelled Message */}
      {checkoutMessage && (
        <div className="fixed bottom-4 right-4 max-w-md bg-white rounded-lg shadow-lg border p-4 z-50">
          <div className="flex items-start gap-3">
            <div className="flex-1">
              <p className="text-sm text-gray-700">{checkoutMessage}</p>
            </div>
            <button
              onClick={() => setCheckoutMessage(null)}
              className="text-gray-400 hover:text-gray-600"
            >
              &times;
            </button>
          </div>
        </div>
      )}

      {/* Analysis History Modal */}
      {showHistory && (
        <AnalysisHistory
          onLoad={handleLoadAnalysis}
          onClose={() => setShowHistory(false)}
        />
      )}

      {/* Save Analysis Dialog */}
      {showSaveDialog && (
        <SaveAnalysisDialog
          onSave={handleSaveAnalysis}
          onClose={() => setShowSaveDialog(false)}
          saving={isSaving}
        />
      )}
    </div>
  );
}

export default App;
