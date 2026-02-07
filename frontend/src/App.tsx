import { useState, useCallback, useEffect, useMemo, useRef } from 'react';
import { ChevronDown, ChevronUp, Upload, Network, FileUp, Settings, Sparkles, BarChart3, CheckCircle2 } from 'lucide-react';
import { FileUpload } from './components/FileUpload';
import { ConfigPanel } from './components/ConfigPanel';
import { NetworkGraph } from './components/NetworkGraph';
import type { NetworkGraphHandle } from './components/NetworkGraph';
import { DataTable } from './components/DataTable';
import { ControlPanel } from './components/ControlPanel';
import { ChatPanel } from './components/ChatPanel';
import { AuthForm } from './components/AuthForm';
import { LandingPage } from './components/LandingPage';
import { UsageBanner } from './components/UsageBanner';
import { UpgradeModal } from './components/UpgradeModal';
import { BillingPage } from './components/BillingPage';
import { AnalysisHistory, SaveAnalysisDialog } from './components/AnalysisHistory';
import { MetricsPanel } from './components/MetricsPanel';
import { ContextMenu } from './components/ContextMenu';
import { NodeComparisonPanel } from './components/NodeComparisonPanel';
import { useAuth } from './contexts/AuthContext';
import { useSubscription } from './contexts/SubscriptionContext';
import { useToast } from './contexts/ToastContext';
import { analyzeMultiGroup, saveAnalysis, exportAnalysis } from './utils/api';
import { exportToCSV, downloadCSV } from './utils/network';
import { computeEgoNetwork, computeShortestPath, getNeighbors } from './utils/graphAlgorithms';
import type {
  AnalysisResult,
  AnalysisConfig,
  FilterState,
  VisualizationState,
  GroupConfig,
  ComparisonNode,
  NetworkEdge
} from './types';

const DEFAULT_CONFIG: AnalysisConfig = {
  groups: [
    { name: 'Group 1', textColumn: 1, minScoreThreshold: 2.0 }
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

const MAX_GROUPS_ABSOLUTE = 5;

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
  nodeSizeMetric: 'avg_normalized',
  nodeColorMetric: 'emphasis',
  edgeTypeFilter: 'all',
  showClusterHulls: false,
  nodeSpread: 1.0,
  labelScale: 1.0,
};

function App() {
  const { user, loading, signOut } = useAuth();
  const {
    showUpgradeModal,
    closeUpgradeModal,
    getMaxGroups,
    canExport,
    canSaveAnalyses,
    openUpgradeModal,
    refreshProfile,
    loading: subscriptionLoading
  } = useSubscription();
  const { addToast } = useToast();

  // File state
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
  const [configCollapsed, setConfigCollapsed] = useState(false);
  const [showLanding, setShowLanding] = useState(true);
  const [showAuthForm, setShowAuthForm] = useState(false);
  const [showBillingPage, setShowBillingPage] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  const [showSaveDialog, setShowSaveDialog] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  // Highlighted node for cross-component selection
  const [highlightedNode, setHighlightedNode] = useState<string | null>(null);

  // Focused cluster for subgraph extraction
  const [focusedCluster, setFocusedCluster] = useState<{ groupKey: string; cluster: number } | null>(null);

  // Phase 4: Ego-network state
  const [egoNode, setEgoNode] = useState<string | null>(null);
  const [egoHops, setEgoHops] = useState(1);

  // Phase 4: Shortest path state
  const [pathNodes, setPathNodes] = useState<string[]>([]);
  const [pathSource, setPathSource] = useState<string | null>(null);

  // Phase 4: Multi-select state
  const [selectedNodes, setSelectedNodes] = useState<Set<string>>(new Set());

  // Phase 4: Context menu state
  const [contextMenu, setContextMenu] = useState<{ word: string; x: number; y: number } | null>(null);

  // NetworkGraph ref for export
  const graphRef = useRef<NetworkGraphHandle>(null);

  // Handle checkout success/cancelled from URL params
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const checkout = params.get('checkout');

    if (checkout === 'success') {
      addToast('Payment successful! Your subscription has been activated.', 'success', 5000);
      refreshProfile();
      window.history.replaceState({}, '', window.location.pathname);
    } else if (checkout === 'cancelled') {
      addToast('Checkout was cancelled. You can try again anytime.', 'info');
      window.history.replaceState({}, '', window.location.pathname);
    }
  }, [refreshProfile, addToast]);

  const effectiveMaxGroups = Math.min(getMaxGroups(), MAX_GROUPS_ABSOLUTE);

  const handleAddGroup = useCallback(() => {
    if (config.groups.length >= effectiveMaxGroups) {
      openUpgradeModal(`Your plan allows up to ${effectiveMaxGroups} group(s). Upgrade to analyze more groups.`);
      return;
    }
    const newGroupNum = config.groups.length + 1;
    setConfig(prev => ({
      ...prev,
      groups: [...prev.groups, { name: `Group ${newGroupNum}`, textColumn: 1, minScoreThreshold: prev.minScoreThreshold }]
    }));
    setFiles(prev => [...prev, null]);
  }, [config.groups.length, effectiveMaxGroups, openUpgradeModal]);

  const handleRemoveGroup = useCallback((index: number) => {
    if (config.groups.length <= 1) return;
    setConfig(prev => ({
      ...prev,
      groups: prev.groups.filter((_, i) => i !== index)
    }));
    setFiles(prev => prev.filter((_, i) => i !== index));
  }, [config.groups.length]);

  const handleGroupConfigChange = useCallback((index: number, changes: Partial<GroupConfig>) => {
    setConfig(prev => ({
      ...prev,
      groups: prev.groups.map((g, i) => i === index ? { ...g, ...changes } : g)
    }));
  }, []);

  const handleFileSelect = useCallback((index: number, file: File) => {
    setFiles(prev => {
      const newFiles = [...prev];
      newFiles[index] = file;
      return newFiles;
    });
  }, []);

  const handleAnalyze = useCallback(async () => {
    const validFiles = files.filter((f): f is File => f !== null);
    if (validFiles.length !== config.groups.length) {
      setError('Please select a file for each group');
      return;
    }

    setIsAnalyzing(true);
    setError(null);
    setElapsedTime(0);
    setAnalysisStage('Reading files...');
    setFocusedCluster(null);
    setHighlightedNode(null);
    setEgoNode(null);
    setPathNodes([]);
    setPathSource(null);
    setSelectedNodes(new Set());

    const startTime = Date.now();
    const timerInterval = setInterval(() => {
      const elapsed = Math.floor((Date.now() - startTime) / 1000);
      setElapsedTime(elapsed);

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
      setConfigCollapsed(true);
      setFilterState(DEFAULT_FILTER_STATE);
      await refreshProfile();
    } catch (err: any) {
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
  }, [files, config, openUpgradeModal, refreshProfile]);

  const handleFilterChange = useCallback((changes: Partial<FilterState>) => {
    setFilterState(prev => ({ ...prev, ...changes }));

    if (changes.filterType) {
      if (changes.filterType.endsWith('_cluster')) {
        // Auto-switch to clustered layout and matching color mode
        setVizState(prev => ({ ...prev, colorMode: changes.filterType as string, layout: 'clustered' }));
      } else {
        // Switch back to force layout and emphasis color mode
        setVizState(prev => ({ ...prev, colorMode: 'emphasis', layout: 'force' }));
      }
    }
  }, []);

  const handleClearHidden = useCallback(() => {
    setFilterState(prev => ({ ...prev, hiddenWords: new Set() }));
  }, []);

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

  // Handle export with format support
  const handleExport = useCallback(async (format: string = 'csv') => {
    if (!analysisResult) return;

    // Handle graph image export
    if (format === 'png' || format === 'svg') {
      graphRef.current?.exportImage(format as 'png' | 'svg');
      addToast(`${format.toUpperCase()} exported`, 'success');
      return;
    }

    if (!canExport()) {
      openUpgradeModal('Export is a Pro feature. Upgrade to export your analysis data.');
      return;
    }

    if (format === 'csv') {
      const data = analysisResult.analysis_data || analysisResult.comparison_data || [];
      const csv = exportToCSV(
        data,
        analysisResult.group_names,
        analysisResult.group_keys,
        filterState.hiddenWords
      );
      downloadCSV(csv, 'semantic_network_analysis.csv');
      addToast('CSV exported successfully', 'success');
    } else {
      try {
        const data = analysisResult.analysis_data || analysisResult.comparison_data || [];
        const blob = await exportAnalysis(format, data, analysisResult.edges, analysisResult.stats, analysisResult.group_names, analysisResult.group_keys);
        const ext = format === 'excel' ? 'xlsx' : format;
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `semantic_network_analysis.${ext}`;
        a.click();
        window.URL.revokeObjectURL(url);
        addToast(`${format.toUpperCase()} exported successfully`, 'success');
      } catch (err: any) {
        addToast(err.message || 'Export failed', 'error');
      }
    }
  }, [analysisResult, filterState.hiddenWords, canExport, openUpgradeModal, addToast]);

  const handleSaveClick = useCallback(() => {
    if (!analysisResult) return;
    if (!canSaveAnalyses()) {
      openUpgradeModal('Saving analyses is a Pro feature. Upgrade to save your work.');
      return;
    }
    setShowSaveDialog(true);
  }, [analysisResult, canSaveAnalyses, openUpgradeModal]);

  const handleSaveAnalysis = useCallback(async (name: string) => {
    if (!analysisResult) return;

    setIsSaving(true);
    try {
      await saveAnalysis(name, config, analysisResult);
      setShowSaveDialog(false);
      addToast(`Analysis "${name}" saved successfully!`, 'success');
    } catch (err: any) {
      console.error('Error saving analysis:', err);
      addToast(err.response?.data?.detail || 'Failed to save analysis', 'error');
    } finally {
      setIsSaving(false);
    }
  }, [analysisResult, config, addToast]);

  const handleLoadAnalysis = useCallback((savedConfig: any, savedResults: any) => {
    setConfig(savedConfig);
    setFiles(savedConfig.groups.map(() => null));
    setAnalysisResult(savedResults);
    setConfigCollapsed(true);
    setShowLanding(false);
    setFilterState(DEFAULT_FILTER_STATE);
    setFocusedCluster(null);
    setHighlightedNode(null);
    setEgoNode(null);
    setPathNodes([]);
    setPathSource(null);
    setSelectedNodes(new Set());
    addToast('Analysis loaded successfully!', 'success');
  }, [addToast]);

  // Handle node click from graph or table
  const handleNodeClick = useCallback((word: string) => {
    setHighlightedNode(prev => prev === word ? null : word);
  }, []);

  // Handle cluster focus
  const handleFocusCluster = useCallback((groupKey: string, cluster: number) => {
    setFocusedCluster({ groupKey, cluster });
  }, []);

  const handleClearFocus = useCallback(() => {
    setFocusedCluster(null);
  }, []);

  // Phase 4: Ego-network
  const handleEgoNodeChange = useCallback((word: string | null) => {
    setEgoNode(word);
  }, []);

  const handleEgoHopsChange = useCallback((hops: number) => {
    setEgoHops(hops);
  }, []);

  const handleClearEgo = useCallback(() => {
    setEgoNode(null);
  }, []);

  // Phase 4: Context menu handlers
  const handleNodeRightClick = useCallback((word: string, x: number, y: number) => {
    setContextMenu({ word, x, y });
  }, []);

  const handleShowNeighbors = useCallback((word: string) => {
    if (!analysisResult) return;
    const edges = analysisResult.edges;
    const neighbors = getNeighbors(word, edges);
    addToast(`${word} has ${neighbors.length} neighbors: ${neighbors.slice(0, 5).join(', ')}${neighbors.length > 5 ? '...' : ''}`, 'info', 5000);
  }, [analysisResult, addToast]);

  const handleFindPathFrom = useCallback((word: string) => {
    setPathSource(word);
    setPathNodes([]);
    addToast(`Path source set to "${word}". Right-click a target node to find path.`, 'info');
  }, [addToast]);

  const handleFindPathTo = useCallback((word: string) => {
    if (!pathSource || !analysisResult) return;
    const path = computeShortestPath(pathSource, word, analysisResult.edges);
    if (path) {
      setPathNodes(path);
      addToast(`Path found: ${path.join(' → ')} (${path.length - 1} hops)`, 'success', 5000);
    } else {
      addToast(`No path found between "${pathSource}" and "${word}"`, 'error');
    }
    setPathSource(null);
  }, [pathSource, analysisResult, addToast]);

  const handleContextFocusCluster = useCallback((word: string) => {
    if (!analysisResult) return;
    const data = analysisResult.analysis_data || analysisResult.comparison_data || [];
    const node = data.find(n => n.word === word);
    if (node && analysisResult.group_keys.length > 0) {
      const gk = analysisResult.group_keys[0];
      const cluster = (node as any)[`${gk}_cluster`];
      if (cluster !== undefined && cluster >= 0) {
        setFocusedCluster({ groupKey: gk, cluster });
      }
    }
  }, [analysisResult]);

  // Get analysis data with memoization
  const analysisData = useMemo(() => {
    if (!analysisResult) return [];
    return analysisResult.analysis_data || analysisResult.comparison_data || [];
  }, [analysisResult]);

  // Filter data by focused cluster
  const clusterFilteredData = useMemo((): ComparisonNode[] => {
    if (!focusedCluster) return analysisData;
    return analysisData.filter(node => {
      const clusterKey = `${focusedCluster.groupKey}_cluster`;
      return (node as any)[clusterKey] === focusedCluster.cluster;
    });
  }, [analysisData, focusedCluster]);

  // Apply ego-network filter (for both table and graph base data)
  const filteredData = useMemo((): ComparisonNode[] => {
    let data = clusterFilteredData;
    if (egoNode && analysisResult) {
      const ego = computeEgoNetwork(egoNode, data, analysisResult.edges, egoHops);
      data = ego.nodes;
    }
    return data;
  }, [clusterFilteredData, egoNode, egoHops, analysisResult]);

  // Data for the graph — excludes hidden words
  const graphData = useMemo((): ComparisonNode[] => {
    if (filterState.hiddenWords.size === 0) return filteredData;
    return filteredData.filter(n => !filterState.hiddenWords.has(n.word));
  }, [filteredData, filterState.hiddenWords]);

  // Data for the table — includes all words (hidden ones shown with indicator)
  const tableData = useMemo((): ComparisonNode[] => {
    return filteredData;
  }, [filteredData]);

  const displayEdges = useMemo((): NetworkEdge[] => {
    if (!analysisResult) return [];
    const edges = analysisResult.edges;
    const nodeWords = new Set(graphData.map(n => n.word));
    return edges.filter(e => nodeWords.has(e.from) && nodeWords.has(e.to));
  }, [analysisResult, graphData]);

  const getSharedWordsCount = () => {
    if (!analysisResult) return 0;
    return analysisResult.stats.words_in_all ?? analysisResult.stats.words_in_both ?? 0;
  };

  // Loading state
  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex items-center justify-center">
        <div className="text-gray-500 dark:text-gray-400">Loading...</div>
      </div>
    );
  }

  // Not logged in - show landing page or auth form
  if (!user) {
    if (showAuthForm) {
      return <AuthForm onBack={() => setShowAuthForm(false)} />;
    }
    return (
      <LandingPage
        onGetStarted={() => setShowAuthForm(true)}
        onSignIn={() => setShowAuthForm(true)}
      />
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      {/* Header */}
      <header className="bg-gradient-to-r from-primary-500 to-purple-600 text-white py-6 px-4">
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row justify-between items-start gap-4">
          <button
            onClick={() => setShowLanding(true)}
            className="flex items-center gap-3 hover:opacity-90 transition-opacity"
          >
            <Network className="w-10 h-10 text-white" />
            <div className="text-left">
              <h1 className="text-2xl font-bold">SNA</h1>
              <p className="text-sm text-primary-100">Semantic Network Analyzer</p>
            </div>
          </button>
          <div className="flex flex-wrap items-center gap-4">
            <UsageBanner />
            <span className="text-sm text-primary-100">{user.email}</span>
            <button
              onClick={() => {
                if (subscriptionLoading) return;
                if (canSaveAnalyses()) {
                  setShowHistory(true);
                } else {
                  openUpgradeModal('Saving and viewing analysis history is a Pro feature. Upgrade to save your analyses.');
                }
              }}
              disabled={subscriptionLoading}
              className={`px-4 py-2 bg-white/10 hover:bg-white/20 rounded-lg text-sm font-medium transition-colors ${subscriptionLoading ? 'opacity-50' : ''}`}
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

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 py-6 space-y-6">
        {/* Landing Page - Post Login */}
        {showLanding && (
          <div className="py-12">
            {/* Welcome Section */}
            <div className="text-center max-w-3xl mx-auto mb-12">
              <div className="inline-flex items-center justify-center w-20 h-20 rounded-2xl bg-gradient-to-br from-primary-500 to-purple-600 mb-6 shadow-lg">
                <Network className="w-10 h-10 text-white" />
              </div>
              <h2 className="text-4xl font-bold text-gray-900 dark:text-gray-100 mb-4">
                Ready to Analyze Your Data
              </h2>
              <p className="text-lg text-gray-500 dark:text-gray-400">
                Transform your text data into interactive semantic networks and discover hidden patterns.
              </p>
            </div>

            {/* Quick Start Steps */}
            <div className="grid md:grid-cols-4 gap-6 mb-12">
              {[
                { icon: FileUp, title: 'Upload Files', desc: 'CSV or Excel with text data' },
                { icon: Settings, title: 'Configure', desc: 'Set thresholds and options' },
                { icon: Sparkles, title: 'Analyze', desc: 'Build semantic networks' },
                { icon: BarChart3, title: 'Explore', desc: 'Visualize and export' }
              ].map((step, i) => (
                <div key={i} className="relative">
                  {i < 3 && (
                    <div className="hidden md:block absolute top-8 left-full w-full h-0.5 bg-gradient-to-r from-primary-200 to-transparent dark:from-primary-800 -translate-x-8 z-0" />
                  )}
                  <div className="relative z-10 bg-white dark:bg-gray-800 rounded-xl p-6 shadow-sm border border-gray-100 dark:border-gray-700 text-center">
                    <div className="inline-flex items-center justify-center w-12 h-12 rounded-xl bg-primary-50 dark:bg-primary-900/30 text-primary-500 mb-4">
                      <step.icon className="w-6 h-6" />
                    </div>
                    <div className="text-xs font-bold text-primary-500 mb-1">STEP {i + 1}</div>
                    <h3 className="font-semibold text-gray-900 dark:text-gray-100">{step.title}</h3>
                    <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">{step.desc}</p>
                  </div>
                </div>
              ))}
            </div>

            {/* Feature Cards */}
            <div className="grid md:grid-cols-3 gap-6 mb-12">
              <div className="bg-gradient-to-br from-blue-500 to-cyan-500 rounded-2xl p-6 text-white">
                <h3 className="text-lg font-semibold mb-2">Multi-Group Comparison</h3>
                <p className="text-white/90 text-sm">
                  Compare semantic patterns across up to {effectiveMaxGroups} different groups or time periods.
                </p>
              </div>
              <div className="bg-gradient-to-br from-purple-500 to-pink-500 rounded-2xl p-6 text-white">
                <h3 className="text-lg font-semibold mb-2">Advanced Clustering</h3>
                <p className="text-white/90 text-sm">
                  Discover communities using Louvain algorithm with customizable resolution.
                </p>
              </div>
              <div className="bg-gradient-to-br from-orange-500 to-red-500 rounded-2xl p-6 text-white">
                <h3 className="text-lg font-semibold mb-2">AI-Powered Insights</h3>
                <p className="text-white/90 text-sm">
                  Enable semantic analysis to find conceptually similar terms beyond co-occurrence.
                </p>
              </div>
            </div>

            {/* CTA */}
            <div className="text-center flex flex-wrap justify-center gap-4">
              {analysisResult && (
                <button
                  onClick={() => setShowLanding(false)}
                  className="inline-flex items-center gap-3 px-10 py-4 bg-gradient-to-r from-primary-500 to-purple-600 text-white rounded-xl font-semibold text-lg hover:from-primary-600 hover:to-purple-700 transition-all shadow-lg shadow-primary-500/25"
                >
                  <BarChart3 className="w-5 h-5" />
                  Continue Current Analysis
                </button>
              )}
              <button
                onClick={() => {
                  setShowLanding(false);
                  if (analysisResult) {
                    setAnalysisResult(null);
                  }
                }}
                className={`inline-flex items-center gap-3 px-10 py-4 rounded-xl font-semibold text-lg transition-all ${
                  analysisResult
                    ? 'border-2 border-gray-200 dark:border-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800'
                    : 'bg-gradient-to-r from-primary-500 to-purple-600 text-white hover:from-primary-600 hover:to-purple-700 shadow-lg shadow-primary-500/25'
                }`}
              >
                <FileUp className="w-5 h-5" />
                {analysisResult ? 'Start New Analysis' : 'Start New Analysis'}
              </button>
              {canSaveAnalyses() && (
                <button
                  onClick={() => setShowHistory(true)}
                  className="inline-flex items-center gap-2 px-6 py-4 border-2 border-gray-200 dark:border-gray-700 text-gray-700 dark:text-gray-300 rounded-xl font-semibold hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
                >
                  Load Previous Analysis
                </button>
              )}
            </div>

            {/* Tips */}
            <div className="mt-12 bg-gray-50 dark:bg-gray-800/50 rounded-2xl p-6">
              <h3 className="font-semibold text-gray-900 dark:text-gray-100 mb-4 flex items-center gap-2">
                <CheckCircle2 className="w-5 h-5 text-green-500" />
                Quick Tips for Best Results
              </h3>
              <div className="grid md:grid-cols-2 gap-4 text-sm">
                <div className="flex items-start gap-3">
                  <div className="w-6 h-6 rounded-full bg-green-100 dark:bg-green-900/30 text-green-600 dark:text-green-400 flex items-center justify-center flex-shrink-0 mt-0.5">1</div>
                  <p className="text-gray-600 dark:text-gray-400">
                    <strong className="text-gray-900 dark:text-gray-200">Clean your data first.</strong> Remove irrelevant columns and ensure text is in a single column.
                  </p>
                </div>
                <div className="flex items-start gap-3">
                  <div className="w-6 h-6 rounded-full bg-green-100 dark:bg-green-900/30 text-green-600 dark:text-green-400 flex items-center justify-center flex-shrink-0 mt-0.5">2</div>
                  <p className="text-gray-600 dark:text-gray-400">
                    <strong className="text-gray-900 dark:text-gray-200">Use word mappings.</strong> Consolidate variations like "AI" and "artificial intelligence".
                  </p>
                </div>
                <div className="flex items-start gap-3">
                  <div className="w-6 h-6 rounded-full bg-green-100 dark:bg-green-900/30 text-green-600 dark:text-green-400 flex items-center justify-center flex-shrink-0 mt-0.5">3</div>
                  <p className="text-gray-600 dark:text-gray-400">
                    <strong className="text-gray-900 dark:text-gray-200">Adjust the min score threshold.</strong> Higher values show only stronger connections.
                  </p>
                </div>
                <div className="flex items-start gap-3">
                  <div className="w-6 h-6 rounded-full bg-green-100 dark:bg-green-900/30 text-green-600 dark:text-green-400 flex items-center justify-center flex-shrink-0 mt-0.5">4</div>
                  <p className="text-gray-600 dark:text-gray-400">
                    <strong className="text-gray-900 dark:text-gray-200">Enable semantic analysis</strong> for richer connections (may take longer for large files).
                  </p>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Upload & Configure Section — shown after landing dismissed, no results yet */}
        {!showLanding && !analysisResult && (
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow">
            <div className="px-6 py-4 border-b dark:border-gray-700">
              <h2 className="text-xl font-semibold text-gray-900 dark:text-gray-100">Upload & Configure</h2>
            </div>
            <div className="px-6 pb-6 space-y-6">
              {/* File Upload Section */}
              <div className="pt-4">
                <div className="flex justify-between items-center mb-4">
                  <div>
                    <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">Upload Files</h3>
                    <p className="text-sm text-gray-500 dark:text-gray-400">
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
                        ? 'bg-gray-300 dark:bg-gray-600 text-gray-500 dark:text-gray-400'
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

              <ConfigPanel
                config={config}
                onChange={setConfig}
                onGroupConfigChange={handleGroupConfigChange}
              />

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
                  {isAnalyzing ? 'Analyzing...' : 'Run Analysis'}
                </button>
              </div>

              {error && (
                <div className="bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-300 px-4 py-3 rounded">
                  {error}
                </div>
              )}
            </div>
          </div>
        )}

        {/* Config Section — collapsible, shown when results exist */}
        {analysisResult && !showLanding && (
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow">
            <button
              onClick={() => setConfigCollapsed(!configCollapsed)}
              className="w-full px-6 py-4 flex items-center justify-between hover:bg-gray-50 dark:hover:bg-gray-700/50"
            >
              <h2 className="text-xl font-semibold text-gray-900 dark:text-gray-100">Configuration</h2>
              {configCollapsed ? <ChevronDown className="w-5 h-5 text-gray-500" /> : <ChevronUp className="w-5 h-5 text-gray-500" />}
            </button>

            {!configCollapsed && (
              <div className="px-6 pb-6 space-y-6 border-t dark:border-gray-700 pt-4">
                <ConfigPanel
                  config={config}
                  onChange={setConfig}
                  onGroupConfigChange={handleGroupConfigChange}
                />

                <div className="flex flex-col items-center gap-4">
                  <div className="flex items-center gap-4">
                    <button
                      onClick={handleAnalyze}
                      disabled={files.every(f => f === null) || isAnalyzing}
                      className={`px-8 py-3 rounded-lg font-semibold text-white ${
                        files.every(f => f === null) || isAnalyzing
                          ? 'bg-gray-400 cursor-not-allowed'
                          : 'bg-green-500 hover:bg-green-600'
                      }`}
                    >
                      {isAnalyzing ? 'Analyzing...' : 'Re-Analyze'}
                    </button>
                    <button
                      onClick={() => {
                        setAnalysisResult(null);
                        setShowLanding(false);
                      }}
                      className="flex items-center gap-2 px-6 py-3 border border-gray-300 dark:border-gray-600 rounded-lg font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
                    >
                      <Upload className="w-4 h-4" />
                      Re-Upload Files
                    </button>
                  </div>
                </div>

                {error && (
                  <div className="bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-300 px-4 py-3 rounded">
                    {error}
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* Progress Bar — shown when analyzing */}
        {isAnalyzing && (
          <div className="w-full max-w-md mx-auto bg-white dark:bg-gray-800 rounded-lg shadow p-4">
            <div className="flex justify-between items-center mb-2">
              <span className="text-sm font-medium text-gray-700 dark:text-gray-300">{analysisStage}</span>
              <span className="text-sm text-gray-500 dark:text-gray-400">{elapsedTime}s</span>
            </div>
            <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2">
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

        {/* Results Section */}
        {analysisResult && !isAnalyzing && !showLanding && (
          <div className="space-y-6">
            {/* Stats Summary */}
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="text-center">
                  <div className="text-3xl font-bold text-primary-600 dark:text-primary-400">
                    {analysisResult.stats.total_words}
                  </div>
                  <div className="text-sm text-gray-500 dark:text-gray-400">Total Words</div>
                </div>
                <div className="text-center">
                  <div className="text-3xl font-bold text-primary-600 dark:text-primary-400">
                    {getSharedWordsCount()}
                  </div>
                  <div className="text-sm text-gray-500 dark:text-gray-400">
                    {analysisResult.num_groups > 1 ? 'In All Groups' : 'Unique'}
                  </div>
                </div>
                <div className="text-center">
                  <div className="text-3xl font-bold text-primary-600 dark:text-primary-400">
                    {analysisResult.stats.total_edges}
                  </div>
                  <div className="text-sm text-gray-500 dark:text-gray-400">Edges</div>
                </div>
                <div className="text-center">
                  <div className="text-3xl font-bold text-primary-600 dark:text-primary-400">
                    {graphData.length}
                  </div>
                  <div className="text-sm text-gray-500 dark:text-gray-400">Visible</div>
                </div>
              </div>
            </div>

            {/* Network Metrics Panel */}
            <MetricsPanel
              stats={analysisResult.stats}
              groupNames={analysisResult.group_names}
              groupKeys={analysisResult.group_keys}
            />

            {/* Control Panel */}
            <ControlPanel
              filterState={filterState}
              visualizationState={vizState}
              groupNames={analysisResult.group_names}
              groupKeys={analysisResult.group_keys}
              onFilterChange={handleFilterChange}
              onVisualizationChange={(changes) => setVizState(prev => ({ ...prev, ...changes }))}
              onExport={handleExport}
              onSave={handleSaveClick}
              focusedCluster={focusedCluster}
              onClearFocus={handleClearFocus}
              nodes={analysisData}
              egoNode={egoNode}
              egoHops={egoHops}
              onEgoNodeChange={handleEgoNodeChange}
              onEgoHopsChange={handleEgoHopsChange}
              onClearEgo={handleClearEgo}
            />

            {/* Node Comparison Panel */}
            <NodeComparisonPanel
              selectedNodes={selectedNodes}
              nodes={analysisData}
              groupNames={analysisResult.group_names}
              groupKeys={analysisResult.group_keys}
              onRemoveNode={(word) => setSelectedNodes(prev => { const s = new Set(prev); s.delete(word); return s; })}
              onClear={() => setSelectedNodes(new Set())}
            />

            {/* Network Visualization */}
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow">
              <NetworkGraph
                ref={graphRef}
                nodes={graphData}
                edges={displayEdges}
                filterState={filterState}
                visualizationState={vizState}
                groupNames={analysisResult.group_names}
                groupKeys={analysisResult.group_keys}
                highlightedNode={highlightedNode}
                onNodeClick={handleNodeClick}
                onNodeRightClick={handleNodeRightClick}
                focusedCluster={focusedCluster}
                pathNodes={pathNodes}
                egoCenter={egoNode}
                selectedNodes={selectedNodes}
              />
            </div>

            {/* Data Table */}
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow">
              <DataTable
                data={tableData}
                filterState={filterState}
                groupNames={analysisResult.group_names}
                groupKeys={analysisResult.group_keys}
                onToggleVisibility={handleToggleVisibility}
                onSearch={(query) => handleFilterChange({ searchQuery: query })}
                highlightedNode={highlightedNode}
                onNodeClick={handleNodeClick}
                onFocusCluster={handleFocusCluster}
                onClearHidden={handleClearHidden}
              />
            </div>

            {/* Chat Panel */}
            <ChatPanel
              analysisData={graphData}
              stats={analysisResult.stats}
              groupNames={analysisResult.group_names}
              groupKeys={analysisResult.group_keys}
            />
          </div>
        )}
      </main>

      {/* Context Menu */}
      {contextMenu && (
        <ContextMenu
          x={contextMenu.x}
          y={contextMenu.y}
          word={contextMenu.word}
          onClose={() => setContextMenu(null)}
          onShowNeighbors={handleShowNeighbors}
          onFindPathFrom={handleFindPathFrom}
          onFindPathTo={handleFindPathTo}
          onFocusCluster={handleContextFocusCluster}
          onHideNode={handleToggleVisibility}
          pathSource={pathSource}
        />
      )}

      {showUpgradeModal && (
        <UpgradeModal onClose={closeUpgradeModal} />
      )}

      {showBillingPage && (
        <BillingPage onClose={() => setShowBillingPage(false)} />
      )}

      {showHistory && (
        <AnalysisHistory
          onLoad={handleLoadAnalysis}
          onClose={() => setShowHistory(false)}
        />
      )}

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
