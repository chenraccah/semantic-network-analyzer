import { useState, useMemo } from 'react';
import { Search, ArrowUpDown } from 'lucide-react';
import type { DataTableProps, ComparisonNode } from '../types';

type SortField = keyof ComparisonNode | string;
type SortDirection = 'asc' | 'desc';

export function DataTable({
  data,
  filterState,
  groupNames,
  groupKeys,
  onToggleVisibility,
  onSearch,
}: DataTableProps) {
  const [sortField, setSortField] = useState<SortField>('avg_normalized');
  const [sortDirection, setSortDirection] = useState<SortDirection>('desc');

  const numGroups = groupNames.length;

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
    if (numGroups !== 2) return '-';
    if (Math.abs(diff) < 10) return 'Balanced';
    return diff > 0 ? groupNames[0] : groupNames[1];
  };

  const renderClusterBadge = (cluster: number | undefined) => {
    if (cluster === undefined || cluster < 0) return <span className="text-gray-400">-</span>;
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
              {/* Dynamic group columns */}
              {groupNames.map((name, i) => (
                <SortHeader key={`${groupKeys[i]}_count`} field={`${groupKeys[i]}_count`} label={`${name} Cnt`} />
              ))}
              {groupNames.map((name, i) => (
                <SortHeader key={`${groupKeys[i]}_normalized`} field={`${groupKeys[i]}_normalized`} label={`${name} %`} />
              ))}
              {/* Difference only for 2 groups */}
              {numGroups === 2 && (
                <>
                  <SortHeader field="difference" label="Diff" />
                  <th>Emphasis</th>
                </>
              )}
              <SortHeader field="avg_normalized" label="Avg" />
              {numGroups > 1 && (
                <SortHeader field="group_count" label="# Groups" />
              )}
              {/* Cluster columns */}
              {groupNames.map((name, i) => (
                <SortHeader key={`${groupKeys[i]}_cluster`} field={`${groupKeys[i]}_cluster`} label={`${name} Cl`} />
              ))}
              {/* Betweenness columns */}
              {groupNames.map((name, i) => (
                <SortHeader key={`${groupKeys[i]}_betweenness`} field={`${groupKeys[i]}_betweenness`} label={`${name} Bet`} />
              ))}
            </tr>
          </thead>
          <tbody>
            {displayData.map(node => {
              const isHidden = filterState.hiddenWords.has(node.word);
              const diff = (node as any).difference ?? 0;

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
                  {/* Dynamic group count columns */}
                  {groupKeys.map(key => (
                    <td key={`${key}_count`}>{(node as any)[`${key}_count`] ?? 0}</td>
                  ))}
                  {/* Dynamic group normalized columns */}
                  {groupKeys.map(key => (
                    <td key={`${key}_normalized`}>{(node as any)[`${key}_normalized`] ?? 0}%</td>
                  ))}
                  {/* Difference only for 2 groups */}
                  {numGroups === 2 && (
                    <>
                      <td className={`font-semibold ${getEmphasisClass(diff)}`}>
                        {diff > 0 ? '+' : ''}{diff}%
                      </td>
                      <td className={getEmphasisClass(diff)}>
                        {getEmphasisLabel(diff)}
                      </td>
                    </>
                  )}
                  <td>{node.avg_normalized}%</td>
                  {numGroups > 1 && (
                    <td>{(node as any).group_count ?? '-'}</td>
                  )}
                  {/* Dynamic cluster columns */}
                  {groupKeys.map(key => (
                    <td key={`${key}_cluster`}>{renderClusterBadge((node as any)[`${key}_cluster`])}</td>
                  ))}
                  {/* Dynamic betweenness columns */}
                  {groupKeys.map(key => (
                    <td key={`${key}_betweenness`}>{(node as any)[`${key}_betweenness`]?.toFixed(3) ?? '-'}</td>
                  ))}
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
