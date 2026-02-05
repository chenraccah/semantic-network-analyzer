import { useState, useMemo } from 'react';
import { Download, Save, ChevronDown, X, Image } from 'lucide-react';
import type { ControlPanelProps, FilterType, LayoutType, NodeSizeMetric, NodeColorMetric, EdgeTypeFilter } from '../types';

export function ControlPanel({
  filterState,
  visualizationState,
  groupNames,
  groupKeys,
  onFilterChange,
  onVisualizationChange,
  onExport,
  onSave,
  focusedCluster,
  onClearFocus,
  nodes,
  egoNode,
  egoHops,
  onEgoNodeChange,
  onEgoHopsChange,
  onClearEgo,
}: ControlPanelProps) {
  const numGroups = groupNames.length;
  const [exportOpen, setExportOpen] = useState(false);
  const [egoSearch, setEgoSearch] = useState('');

  const isClusterFilter = filterState.filterType.endsWith('_cluster');

  // Derive actual cluster numbers from the data
  const clusterOptions = useMemo(() => {
    if (!isClusterFilter || !nodes) return [];
    const clusterKey = filterState.filterType; // e.g. "group_a_cluster"
    const clusterSet = new Set<number>();
    nodes.forEach(n => {
      const c = (n as any)[clusterKey];
      if (c !== undefined && c >= 0) clusterSet.add(c);
    });
    return [...clusterSet].sort((a, b) => a - b);
  }, [isClusterFilter, filterState.filterType, nodes]);

  const egoSuggestions = egoSearch.length > 0 && nodes
    ? nodes.filter(n => n.word.toLowerCase().includes(egoSearch.toLowerCase())).slice(0, 5)
    : [];

  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
      <h3 className="text-lg font-semibold mb-4 text-gray-900 dark:text-gray-100">Controls & Filters</h3>

      {/* Focused cluster chip */}
      {focusedCluster && onClearFocus && (
        <div className="mb-4 flex items-center gap-2">
          <span className="inline-flex items-center gap-1 px-3 py-1 bg-primary-100 dark:bg-primary-900/40 text-primary-700 dark:text-primary-300 rounded-full text-sm font-medium">
            Focused: Cluster {focusedCluster.cluster}
            <button onClick={onClearFocus} className="hover:text-primary-900 dark:hover:text-primary-100">
              <X className="w-3.5 h-3.5" />
            </button>
          </span>
        </div>
      )}

      {/* Ego-network chip + controls */}
      {onEgoNodeChange && (
        <div className="mb-4">
          {egoNode && onClearEgo && (
            <div className="mb-2 flex items-center gap-2">
              <span className="inline-flex items-center gap-1 px-3 py-1 bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-300 rounded-full text-sm font-medium">
                Ego: {egoNode} ({egoHops || 1} hops)
                <button onClick={onClearEgo} className="hover:text-blue-900 dark:hover:text-blue-100">
                  <X className="w-3.5 h-3.5" />
                </button>
              </span>
            </div>
          )}
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
            Ego-Network View
          </label>
          <div className="flex gap-3 items-end">
            <div className="relative flex-1">
              <input
                type="text"
                placeholder="Search node..."
                value={egoSearch}
                onChange={(e) => setEgoSearch(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 text-sm"
              />
              {egoSuggestions.length > 0 && (
                <div className="absolute z-10 top-full left-0 right-0 mt-1 bg-white dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-md shadow-lg max-h-40 overflow-y-auto">
                  {egoSuggestions.map(n => (
                    <button
                      key={n.word}
                      onClick={() => {
                        onEgoNodeChange(n.word);
                        setEgoSearch('');
                      }}
                      className="block w-full text-left px-3 py-1.5 text-sm text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-600"
                    >
                      {n.word} <span className="text-gray-400">({n.avg_normalized}%)</span>
                    </button>
                  ))}
                </div>
              )}
            </div>
            <div className="w-24">
              <label className="block text-xs text-gray-500 dark:text-gray-400 mb-1">Hops</label>
              <select
                value={egoHops || 1}
                onChange={(e) => onEgoHopsChange?.(parseInt(e.target.value))}
                className="w-full px-2 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 text-sm"
              >
                <option value={1}>1 hop</option>
                <option value={2}>2 hops</option>
                <option value={3}>3 hops</option>
              </select>
            </div>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {/* Layout */}
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
            Network Layout
          </label>
          <select
            value={visualizationState.layout}
            onChange={(e) => onVisualizationChange({ layout: e.target.value as LayoutType })}
            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
          >
            <option value="force">Force-Directed</option>
            <option value="clustered">Clustered</option>
            <option value="hierarchical">Hierarchical</option>
            <option value="circular">Circular</option>
            <option value="radial">Radial</option>
          </select>
        </div>

        {/* Node Size By */}
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
            Node Size By
          </label>
          <select
            value={visualizationState.nodeSizeMetric}
            onChange={(e) => onVisualizationChange({ nodeSizeMetric: e.target.value as NodeSizeMetric })}
            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
          >
            <option value="avg_normalized">Average Score</option>
            {groupNames.map((name, i) => (
              <option key={`${groupKeys[i]}_normalized`} value={`${groupKeys[i]}_normalized`}>
                {name} Score
              </option>
            ))}
            <option value="betweenness">Betweenness</option>
            <option value="closeness">Closeness</option>
            <option value="eigenvector">Eigenvector</option>
            <option value="degree">Degree</option>
            <option value="strength">Strength</option>
            <option value="pagerank">PageRank</option>
            <option value="harmonic">Harmonic</option>
            <option value="kcore">K-Core</option>
          </select>
        </div>

        {/* Node Color By */}
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
            Node Color By
          </label>
          <select
            value={visualizationState.nodeColorMetric}
            onChange={(e) => {
              const val = e.target.value as NodeColorMetric;
              onVisualizationChange({ nodeColorMetric: val });
              // Also update colorMode for cluster modes
              if (val === 'cluster' && groupKeys.length > 0) {
                onVisualizationChange({ nodeColorMetric: val, colorMode: `${groupKeys[0]}_cluster` });
              } else if (val === 'emphasis') {
                onVisualizationChange({ nodeColorMetric: val, colorMode: 'emphasis' });
              }
            }}
            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
          >
            <option value="emphasis">Emphasis (default)</option>
            <option value="cluster">Cluster</option>
            <option value="betweenness_gradient">Betweenness Gradient</option>
            <option value="pagerank_gradient">PageRank Gradient</option>
            <option value="kcore_gradient">K-Core Gradient</option>
          </select>
        </div>

        {/* Edge Type Filter */}
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
            Edge Type
          </label>
          <select
            value={visualizationState.edgeTypeFilter}
            onChange={(e) => onVisualizationChange({ edgeTypeFilter: e.target.value as EdgeTypeFilter })}
            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
          >
            <option value="all">All Edges</option>
            <option value="cooccurrence">Co-occurrence Only</option>
            <option value="semantic">Semantic Only</option>
          </select>
        </div>

        {/* Filter Type */}
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
            Filter by Perspective
          </label>
          <select
            value={filterState.filterType}
            onChange={(e) => onFilterChange({ filterType: e.target.value as FilterType })}
            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
          >
            <option value="all">Show All Words</option>
            {numGroups > 1 && (
              <>
                {groupNames.map((name, i) => (
                  <option key={`${groupKeys[i]}_emphasis`} value={groupKeys[i]}>
                    {name}-Emphasized
                  </option>
                ))}
                <option value="balanced">Balanced</option>
                <option value="in_all">Words in All Groups</option>
              </>
            )}
            {groupNames.map((name, i) => (
              <option key={`${groupKeys[i]}_cluster`} value={`${groupKeys[i]}_cluster`}>
                {name} Cluster Group
              </option>
            ))}
          </select>
        </div>

        {isClusterFilter && (
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Cluster #
            </label>
            <select
              value={filterState.clusterNumber}
              onChange={(e) => onFilterChange({
                clusterNumber: e.target.value === 'all' ? 'all' : parseInt(e.target.value)
              })}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
            >
              <option value="all">All Clusters</option>
              {clusterOptions.map(i => (
                <option key={i} value={i}>Cluster {i}</option>
              ))}
            </select>
          </div>
        )}

        {/* Min Score */}
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
            Min Score: {filterState.minScore}%
          </label>
          <input
            type="range"
            min="0"
            max="100"
            step="1"
            value={filterState.minScore}
            onChange={(e) => onFilterChange({ minScore: parseInt(e.target.value) })}
            className="w-full"
          />
          <div className="flex justify-between text-xs text-gray-400">
            <span>0%</span>
            <span>100%</span>
          </div>
        </div>

        {/* Min Edge Weight */}
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
            Min Edge Weight: {filterState.minEdgeWeight}
          </label>
          <input
            type="range"
            min="1"
            max="50"
            step="1"
            value={filterState.minEdgeWeight}
            onChange={(e) => onFilterChange({ minEdgeWeight: parseInt(e.target.value) })}
            className="w-full"
          />
          <div className="flex justify-between text-xs text-gray-400">
            <span>1</span>
            <span>50+</span>
          </div>
        </div>

        {/* Node Spread */}
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
            Node Spread: {visualizationState.nodeSpread.toFixed(1)}x
          </label>
          <input
            type="range"
            min="0.5"
            max="3.0"
            step="0.1"
            value={visualizationState.nodeSpread}
            onChange={(e) => onVisualizationChange({ nodeSpread: parseFloat(e.target.value) })}
            className="w-full"
          />
          <div className="flex justify-between text-xs text-gray-400">
            <span>Compact</span>
            <span>Spread</span>
          </div>
        </div>

        {/* Label Size */}
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
            Label Size: {(visualizationState.labelScale ?? 1.0).toFixed(1)}x
          </label>
          <input
            type="range"
            min="0.5"
            max="3.0"
            step="0.1"
            value={visualizationState.labelScale ?? 1.0}
            onChange={(e) => onVisualizationChange({ labelScale: parseFloat(e.target.value) })}
            className="w-full"
          />
          <div className="flex justify-between text-xs text-gray-400">
            <span>Small</span>
            <span>Large</span>
          </div>
        </div>
      </div>

      {/* Show Cluster Hulls Toggle */}
      <div className="mt-4 pt-4 border-t border-gray-200 dark:border-gray-700 flex items-center gap-4">
        <label className="flex items-center gap-2 cursor-pointer">
          <input
            type="checkbox"
            checked={visualizationState.showClusterHulls}
            onChange={(e) => onVisualizationChange({ showClusterHulls: e.target.checked })}
            className="rounded text-primary-500 focus:ring-primary-500"
          />
          <span className="text-sm text-gray-700 dark:text-gray-300">Show Cluster Hulls</span>
        </label>
      </div>

      {/* Action Buttons */}
      <div className="mt-6 flex flex-wrap justify-end gap-4">
        {/* Export dropdown */}
        <div className="relative">
          <button
            onClick={() => setExportOpen(!exportOpen)}
            className="flex items-center gap-2 px-4 py-2 bg-green-500 text-white rounded-md hover:bg-green-600"
          >
            <Download className="w-4 h-4" />
            Export
            <ChevronDown className="w-3 h-3" />
          </button>
          {exportOpen && (
            <div className="absolute right-0 mt-1 w-44 bg-white dark:bg-gray-700 rounded-lg shadow-lg border border-gray-200 dark:border-gray-600 z-20">
              {['csv', 'excel', 'json', 'graphml', 'gexf'].map(fmt => (
                <button
                  key={fmt}
                  onClick={() => { onExport(fmt); setExportOpen(false); }}
                  className="block w-full text-left px-4 py-2 text-sm text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-600 first:rounded-t-lg last:rounded-b-lg"
                >
                  {fmt === 'csv' ? 'CSV' : fmt === 'excel' ? 'Excel (.xlsx)' : fmt === 'graphml' ? 'GraphML' : fmt === 'gexf' ? 'GEXF' : 'JSON'}
                </button>
              ))}
              <div className="border-t border-gray-200 dark:border-gray-600" />
              <button
                onClick={() => { onExport('png'); setExportOpen(false); }}
                className="block w-full text-left px-4 py-2 text-sm text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-600 flex items-center gap-2"
              >
                <Image className="w-3.5 h-3.5" />
                Graph PNG
              </button>
              <button
                onClick={() => { onExport('svg'); setExportOpen(false); }}
                className="block w-full text-left px-4 py-2 text-sm text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-600 rounded-b-lg flex items-center gap-2"
              >
                <Image className="w-3.5 h-3.5" />
                Graph SVG
              </button>
            </div>
          )}
        </div>

        {onSave && (
          <button
            onClick={onSave}
            className="flex items-center gap-2 px-4 py-2 bg-purple-500 text-white rounded-md hover:bg-purple-600"
          >
            <Save className="w-4 h-4" />
            Save Analysis
          </button>
        )}
      </div>
    </div>
  );
}
