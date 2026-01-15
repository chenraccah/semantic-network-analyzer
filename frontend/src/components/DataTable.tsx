import { useState, useMemo } from 'react';
import { Search, ArrowUpDown } from 'lucide-react';
import type { DataTableProps, ComparisonNode } from '../types';

type SortField = keyof ComparisonNode | string;
type SortDirection = 'asc' | 'desc';

export function DataTable({
  data,
  filterState,
  groupAName,
  groupBName,
  onToggleVisibility,
  onSearch,
}: DataTableProps) {
  const [sortField, setSortField] = useState<SortField>('avg_normalized');
  const [sortDirection, setSortDirection] = useState<SortDirection>('desc');

  const groupAKey = groupAName.toLowerCase().replace(/\s+/g, '_');
  const groupBKey = groupBName.toLowerCase().replace(/\s+/g, '_');

  // Sort and filter data
  const displayData = useMemo(() => {
    let filtered = [...data];

    // Filter by search
    if (filterState.searchQuery) {
      filtered = filtered.filter(node =>
        node.word.toLowerCase().includes(filterState.searchQuery.toLowerCase())
      );
    }

    // Sort
    filtered.sort((a, b) => {
      const aVal = (a as any)[sortField];
      const bVal = (b as any)[sortField];

      if (typeof aVal === 'number' && typeof bVal === 'number') {
        return sortDirection === 'asc' ? aVal - bVal : bVal - aVal;
      }
      
      const aStr = String(aVal);
      const bStr = String(bVal);
      return sortDirection === 'asc' 
        ? aStr.localeCompare(bStr) 
        : bStr.localeCompare(aStr);
    });

    return filtered;
  }, [data, filterState.searchQuery, sortField, sortDirection]);

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDirection(d => d === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDirection('desc');
    }
  };

  const getEmphasisClass = (diff: number) => {
    if (Math.abs(diff) < 10) return 'text-balanced';
    return diff > 0 ? 'text-parent' : 'text-teacher';
  };

  const getEmphasisLabel = (diff: number) => {
    if (Math.abs(diff) < 10) return 'Balanced';
    return diff > 0 ? groupAName : groupBName;
  };

  const renderClusterBadge = (cluster: number) => {
    if (cluster < 0) return <span className="text-gray-400">-</span>;
    return <span className={`cluster-badge cluster-${cluster}`}>{cluster}</span>;
  };

  const SortHeader = ({ field, label }: { field: SortField; label: string }) => (
    <th onClick={() => handleSort(field)} className="cursor-pointer whitespace-nowrap">
      <div className="flex items-center gap-1">
        {label}
        <ArrowUpDown className="w-3 h-3 opacity-50" />
      </div>
    </th>
  );

  return (
    <div className="p-4">
      <h3 className="text-lg font-semibold mb-4">📋 Data Table</h3>

      {/* Search box */}
      <div className="mb-4 relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
        <input
          type="text"
          placeholder="Search for words..."
          value={filterState.searchQuery}
          onChange={(e) => onSearch(e.target.value)}
          className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-primary-500 focus:border-primary-500"
        />
      </div>

      {/* Table */}
      <div className="overflow-x-auto max-h-[500px]">
        <table className="data-table">
          <thead className="sticky top-0">
            <tr>
              <th className="w-20">Show/Hide</th>
              <SortHeader field="word" label="Word" />
              <SortHeader field={`${groupAKey}_count`} label={`${groupAName} Cnt`} />
              <SortHeader field={`${groupBKey}_count`} label={`${groupBName} Cnt`} />
              <SortHeader field={`${groupAKey}_normalized`} label={`${groupAName} %`} />
              <SortHeader field={`${groupBKey}_normalized`} label={`${groupBName} %`} />
              <SortHeader field="difference" label="Diff" />
              <SortHeader field="avg_normalized" label="Avg" />
              <th>Emphasis</th>
              <SortHeader field={`${groupAKey}_cluster`} label={`${groupAName} Cl`} />
              <SortHeader field={`${groupBKey}_cluster`} label={`${groupBName} Cl`} />
              <SortHeader field={`${groupAKey}_betweenness`} label={`${groupAName} Bet`} />
              <SortHeader field={`${groupBKey}_betweenness`} label={`${groupBName} Bet`} />
            </tr>
          </thead>
          <tbody>
            {displayData.map(node => {
              const isHidden = filterState.hiddenWords.has(node.word);
              
              return (
                <tr key={node.word} className={isHidden ? 'row-hidden' : ''}>
                  <td className="text-center">
                    <button
                      onClick={() => onToggleVisibility(node.word)}
                      className={`visibility-toggle ${isHidden ? 'hidden' : 'visible'}`}
                    >
                      {isHidden ? 'Show' : 'Hide'}
                    </button>
                  </td>
                  <td className="font-medium">{node.word}</td>
                  <td>{(node as any)[`${groupAKey}_count`]}</td>
                  <td>{(node as any)[`${groupBKey}_count`]}</td>
                  <td>{(node as any)[`${groupAKey}_normalized`]}%</td>
                  <td>{(node as any)[`${groupBKey}_normalized`]}%</td>
                  <td className={`font-semibold ${getEmphasisClass(node.difference)}`}>
                    {node.difference > 0 ? '+' : ''}{node.difference}%
                  </td>
                  <td>{node.avg_normalized}%</td>
                  <td className={getEmphasisClass(node.difference)}>
                    {getEmphasisLabel(node.difference)}
                  </td>
                  <td>{renderClusterBadge((node as any)[`${groupAKey}_cluster`])}</td>
                  <td>{renderClusterBadge((node as any)[`${groupBKey}_cluster`])}</td>
                  <td>{(node as any)[`${groupAKey}_betweenness`]?.toFixed(3) ?? '-'}</td>
                  <td>{(node as any)[`${groupBKey}_betweenness`]?.toFixed(3) ?? '-'}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Summary */}
      <div className="mt-4 text-sm text-gray-500">
        Showing {displayData.length} of {data.length} words
        {filterState.hiddenWords.size > 0 && (
          <span> • {filterState.hiddenWords.size} hidden</span>
        )}
      </div>
    </div>
  );
}
