import { Download, RefreshCw } from 'lucide-react';
import type { ControlPanelProps, FilterType, LayoutType } from '../types';

export function ControlPanel({
  filterState,
  visualizationState,
  groupAName,
  groupBName,
  onFilterChange,
  onVisualizationChange,
  onApply,
  onExport,
}: ControlPanelProps) {
  return (
    <div className="bg-white rounded-lg shadow p-6">
      <h3 className="text-lg font-semibold mb-4">⚙️ Controls & Filters</h3>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {/* Layout */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Network Layout
          </label>
          <select
            value={visualizationState.layout}
            onChange={(e) => onVisualizationChange({ layout: e.target.value as LayoutType })}
            className="w-full px-3 py-2 border border-gray-300 rounded-md"
          >
            <option value="force">Force-Directed</option>
            <option value="clustered">Clustered</option>
          </select>
        </div>

        {/* Filter Type */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Filter by Perspective
          </label>
          <select
            value={filterState.filterType}
            onChange={(e) => onFilterChange({ filterType: e.target.value as FilterType })}
            className="w-full px-3 py-2 border border-gray-300 rounded-md"
          >
            <option value="all">Show All Words</option>
            <option value="group_a">{groupAName}-Emphasized</option>
            <option value="group_b">{groupBName}-Emphasized</option>
            <option value="balanced">Balanced</option>
            <option value="both">Words in Both</option>
            <option value="group_a_cluster">🔴 {groupAName} Cluster Group</option>
            <option value="group_b_cluster">🔵 {groupBName} Cluster Group</option>
          </select>
        </div>

        {/* Cluster Number (shown only for cluster filters) */}
        {(filterState.filterType === 'group_a_cluster' || 
          filterState.filterType === 'group_b_cluster') && (
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Cluster #
            </label>
            <select
              value={filterState.clusterNumber}
              onChange={(e) => onFilterChange({ 
                clusterNumber: e.target.value === 'all' ? 'all' : parseInt(e.target.value) 
              })}
              className="w-full px-3 py-2 border border-gray-300 rounded-md"
            >
              <option value="all">All Clusters</option>
              {[0, 1, 2, 3, 4, 5, 6].map(i => (
                <option key={i} value={i}>Cluster {i}</option>
              ))}
            </select>
          </div>
        )}

        {/* Min Score */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Min Score: {filterState.minScore}%
          </label>
          <input
            type="range"
            min="0"
            max="100"
            step="5"
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
          <label className="block text-sm font-medium text-gray-700 mb-1">
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
      </div>

      {/* Action Buttons */}
      <div className="mt-6 flex justify-end gap-4">
        <button
          onClick={onApply}
          className="flex items-center gap-2 px-4 py-2 bg-primary-500 text-white rounded-md hover:bg-primary-600"
        >
          <RefreshCw className="w-4 h-4" />
          Apply Filters
        </button>
        <button
          onClick={onExport}
          className="flex items-center gap-2 px-4 py-2 bg-green-500 text-white rounded-md hover:bg-green-600"
        >
          <Download className="w-4 h-4" />
          Export CSV
        </button>
      </div>
    </div>
  );
}
