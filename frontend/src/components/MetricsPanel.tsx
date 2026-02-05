import { useState } from 'react';
import { ChevronDown, ChevronUp, Info } from 'lucide-react';
import type { NetworkStats } from '../types';

interface MetricsPanelProps {
  stats: NetworkStats;
  groupNames?: string[];
  groupKeys?: string[];
}

interface MetricDef {
  key: string;
  label: string;
  tooltip: string;
  format: (v: number | undefined) => string;
}

const METRICS: MetricDef[] = [
  {
    key: 'density',
    label: 'Density',
    tooltip: 'Ratio of actual edges to possible edges. Higher = more interconnected.',
    format: (v) => v !== undefined ? v.toFixed(4) : '-',
  },
  {
    key: 'diameter',
    label: 'Diameter',
    tooltip: 'Longest shortest path in the largest connected component.',
    format: (v) => v !== undefined ? String(v) : '-',
  },
  {
    key: 'avg_path_length',
    label: 'Avg Path Length',
    tooltip: 'Average shortest path between all pairs of reachable nodes.',
    format: (v) => v !== undefined ? v.toFixed(3) : '-',
  },
  {
    key: 'modularity',
    label: 'Modularity',
    tooltip: 'Quality of cluster partition. Values near 1 indicate strong community structure.',
    format: (v) => v !== undefined ? v.toFixed(4) : '-',
  },
  {
    key: 'clustering_coefficient',
    label: 'Clustering Coeff',
    tooltip: 'Average probability that two neighbors of a node are also connected.',
    format: (v) => v !== undefined ? v.toFixed(4) : '-',
  },
];

const STRUCTURAL_METRICS: MetricDef[] = [
  {
    key: 'num_bridges',
    label: 'Bridges',
    tooltip: 'Edges whose removal disconnects parts of the graph.',
    format: (v) => v !== undefined ? String(v) : '-',
  },
  {
    key: 'num_articulation_points',
    label: 'Articulation Points',
    tooltip: 'Nodes whose removal disconnects the graph — critical connectors.',
    format: (v) => v !== undefined ? String(v) : '-',
  },
  {
    key: 'assortativity',
    label: 'Assortativity',
    tooltip: 'Tendency of nodes to connect to similar-degree nodes. Positive = assortative.',
    format: (v) => v !== undefined ? v.toFixed(4) : '-',
  },
];

function MetricTooltip({ text }: { text: string }) {
  const [show, setShow] = useState(false);
  return (
    <span className="relative inline-block">
      <Info
        className="w-3.5 h-3.5 text-gray-400 dark:text-gray-500 cursor-help"
        onMouseEnter={() => setShow(true)}
        onMouseLeave={() => setShow(false)}
      />
      {show && (
        <span className="absolute z-50 bottom-full left-1/2 -translate-x-1/2 mb-2 w-56 px-3 py-2 text-xs text-white bg-gray-800 dark:bg-gray-700 rounded-lg shadow-lg">
          {text}
          <span className="absolute top-full left-1/2 -translate-x-1/2 border-4 border-transparent border-t-gray-800 dark:border-t-gray-700" />
        </span>
      )}
    </span>
  );
}

export function MetricsPanel({ stats, groupNames, groupKeys }: MetricsPanelProps) {
  const [expanded, setExpanded] = useState(false);

  const hasAdvancedMetrics = stats.density !== undefined || stats.diameter !== undefined;
  if (!hasAdvancedMetrics) return null;

  const hasPerGroup = groupKeys && groupKeys.length > 1 && groupNames && groupNames.length > 1;

  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg shadow">
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full px-6 py-3 flex items-center justify-between hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors"
      >
        <span className="font-medium text-gray-900 dark:text-gray-100">Network Metrics</span>
        {expanded ? (
          <ChevronUp className="w-4 h-4 text-gray-500" />
        ) : (
          <ChevronDown className="w-4 h-4 text-gray-500" />
        )}
      </button>
      {expanded && (
        <div className="px-6 pb-4 border-t border-gray-100 dark:border-gray-700">
          {/* Global metrics */}
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-4 pt-4">
            {METRICS.map(m => {
              const val = (stats as any)[m.key];
              return (
                <div key={m.key} className="text-center">
                  <div className="flex items-center justify-center gap-1 mb-1">
                    <span className="text-xs font-medium text-gray-500 dark:text-gray-400">{m.label}</span>
                    <MetricTooltip text={m.tooltip} />
                  </div>
                  <div className="text-lg font-bold text-primary-600 dark:text-primary-400">
                    {m.format(val)}
                  </div>
                </div>
              );
            })}
          </div>

          {/* Structural metrics */}
          {(groupKeys && groupKeys.length > 0) && (
            <div className="mt-4 pt-4 border-t border-gray-100 dark:border-gray-700">
              <h4 className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase mb-3">Structural</h4>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
                {STRUCTURAL_METRICS.map(m => {
                  const key = `${groupKeys![0]}_${m.key}`;
                  const val = (stats as any)[key];
                  return (
                    <div key={m.key} className="text-center">
                      <div className="flex items-center justify-center gap-1 mb-1">
                        <span className="text-xs font-medium text-gray-500 dark:text-gray-400">{m.label}</span>
                        <MetricTooltip text={m.tooltip} />
                      </div>
                      <div className="text-lg font-bold text-primary-600 dark:text-primary-400">
                        {m.format(val)}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Per-group comparison table */}
          {hasPerGroup && (
            <div className="mt-4 pt-4 border-t border-gray-100 dark:border-gray-700">
              <h4 className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase mb-3">Per-Group Comparison</h4>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-gray-200 dark:border-gray-700">
                      <th className="text-left py-1.5 px-2 text-gray-500 dark:text-gray-400 font-medium">Metric</th>
                      {groupNames!.map((name, i) => (
                        <th key={groupKeys![i]} className="text-center py-1.5 px-2 text-gray-700 dark:text-gray-200 font-medium">{name}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {[...METRICS, ...STRUCTURAL_METRICS].map(m => (
                      <tr key={m.key} className="border-b border-gray-50 dark:border-gray-700/50">
                        <td className="py-1.5 px-2 text-gray-500 dark:text-gray-400">
                          <div className="flex items-center gap-1">
                            {m.label}
                            <MetricTooltip text={m.tooltip} />
                          </div>
                        </td>
                        {groupKeys!.map(key => {
                          const val = (stats as any)[`${key}_${m.key}`];
                          return (
                            <td key={key} className="text-center py-1.5 px-2 text-gray-900 dark:text-gray-200 font-medium">
                              {m.format(val)}
                            </td>
                          );
                        })}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
