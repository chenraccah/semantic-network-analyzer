import { X } from 'lucide-react';
import type { ComparisonNode } from '../types';

interface NodeComparisonPanelProps {
  selectedNodes: Set<string>;
  nodes: ComparisonNode[];
  groupNames: string[];
  groupKeys: string[];
  onRemoveNode: (word: string) => void;
  onClear: () => void;
}

const METRICS = [
  { key: 'count', label: 'Count' },
  { key: 'normalized', label: 'Score %' },
  { key: 'cluster', label: 'Cluster' },
  { key: 'degree', label: 'Degree' },
  { key: 'strength', label: 'Strength' },
  { key: 'betweenness', label: 'Betweenness' },
  { key: 'closeness', label: 'Closeness' },
  { key: 'eigenvector', label: 'Eigenvector' },
  { key: 'pagerank', label: 'PageRank' },
  { key: 'harmonic', label: 'Harmonic' },
  { key: 'kcore', label: 'K-Core' },
  { key: 'constraint', label: 'Constraint' },
];

export function NodeComparisonPanel({
  selectedNodes,
  nodes,
  groupNames,
  groupKeys,
  onRemoveNode,
  onClear,
}: NodeComparisonPanelProps) {
  if (selectedNodes.size === 0) return null;

  const selectedData = nodes.filter(n => selectedNodes.has(n.word));

  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-4">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100">
          Node Comparison ({selectedNodes.size} selected)
        </h3>
        <button
          onClick={onClear}
          className="text-xs text-gray-500 hover:text-red-500 dark:text-gray-400 dark:hover:text-red-400"
        >
          Clear All
        </button>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-xs">
          <thead>
            <tr className="border-b border-gray-200 dark:border-gray-700">
              <th className="text-left py-1.5 px-2 text-gray-500 dark:text-gray-400 font-medium">Metric</th>
              {selectedData.map(node => (
                <th key={node.word} className="text-left py-1.5 px-2">
                  <span className="flex items-center gap-1 text-gray-900 dark:text-gray-100 font-medium">
                    {node.word}
                    <button
                      onClick={() => onRemoveNode(node.word)}
                      className="text-gray-400 hover:text-red-500"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  </span>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            <tr className="border-b border-gray-100 dark:border-gray-700">
              <td className="py-1.5 px-2 text-gray-500 dark:text-gray-400">Avg Score</td>
              {selectedData.map(node => (
                <td key={node.word} className="py-1.5 px-2 text-gray-900 dark:text-gray-200">
                  {node.avg_normalized}%
                </td>
              ))}
            </tr>
            {groupKeys.map((key, gi) => (
              METRICS.map(metric => (
                <tr key={`${key}_${metric.key}`} className="border-b border-gray-50 dark:border-gray-700/50">
                  <td className="py-1 px-2 text-gray-500 dark:text-gray-400">
                    {groupNames.length > 1 ? `${groupNames[gi]} ` : ''}{metric.label}
                  </td>
                  {selectedData.map(node => {
                    const val = (node as any)[`${key}_${metric.key}`];
                    return (
                      <td key={node.word} className="py-1 px-2 text-gray-900 dark:text-gray-200">
                        {val !== undefined ? (typeof val === 'number' ? (Number.isInteger(val) ? val : val.toFixed(3)) : val) : '-'}
                      </td>
                    );
                  })}
                </tr>
              ))
            )).flat()}
          </tbody>
        </table>
      </div>

      <p className="mt-2 text-xs text-gray-400 dark:text-gray-500">
        Shift+click nodes in the graph to add to comparison
      </p>
    </div>
  );
}
