import { useState, useMemo, useRef, useEffect, useCallback } from 'react';
import { FixedSizeList as List } from 'react-window';
import { Search, ArrowUpDown, Focus } from 'lucide-react';
import type { DataTableProps, ComparisonNode } from '../types';

type SortField = keyof ComparisonNode | string;
type SortDirection = 'asc' | 'desc';

const ROW_HEIGHT = 40;
const MAX_VISIBLE_ROWS = 12;
const HIDE_COL_W = 60;
const WORD_COL_W = 140;
const NUM_COL_W = 100;
const DIFF_COL_W = 84;

export function DataTable({
  data,
  filterState,
  groupNames,
  groupKeys,
  onToggleVisibility,
  onSearch,
  highlightedNode,
  onNodeClick,
  onFocusCluster,
  onClearHidden,
}: DataTableProps) {
  const [sortField, setSortField] = useState<SortField>('avg_normalized');
  const [sortDirection, setSortDirection] = useState<SortDirection>('desc');
  const listRef = useRef<List>(null);
  const headerRef = useRef<HTMLDivElement>(null);
  const bodyRef = useRef<HTMLDivElement>(null);

  const numGroups = groupNames.length;

  // Scroll highlighted row into view
  useEffect(() => {
    if (highlightedNode && listRef.current) {
      const index = displayData.findIndex(n => n.word === highlightedNode);
      if (index >= 0) {
        listRef.current.scrollToItem(index, 'smart');
      }
    }
  }, [highlightedNode]);

  // Sync horizontal scroll between header and body
  const handleBodyScroll = useCallback((e: Event) => {
    const target = e.target as HTMLDivElement;
    if (headerRef.current) {
      headerRef.current.scrollLeft = target.scrollLeft;
    }
  }, []);

  useEffect(() => {
    const body = bodyRef.current;
    if (!body) return;
    body.addEventListener('scroll', handleBodyScroll);
    return () => body.removeEventListener('scroll', handleBodyScroll);
  }, [handleBodyScroll]);

  const displayData = useMemo(() => {
    let filtered = [...data];

    if (filterState.searchQuery) {
      filtered = filtered.filter(node =>
        node.word.toLowerCase().includes(filterState.searchQuery.toLowerCase())
      );
    }

    filtered.sort((a, b) => {
      const aVal = (a as any)[sortField];
      const bVal = (b as any)[sortField];

      if (typeof aVal === 'number' && typeof bVal === 'number') {
        return sortDirection === 'asc' ? aVal - bVal : bVal - aVal;
      }

      const aStr = String(aVal ?? '');
      const bStr = String(bVal ?? '');
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

  const renderClusterBadge = (cluster: number | undefined, groupKey?: string) => {
    if (cluster === undefined || cluster < 0) return <span className="text-gray-400">-</span>;
    return (
      <span className="inline-flex items-center gap-1">
        <span className={`cluster-badge cluster-${cluster}`}>{cluster}</span>
        {onFocusCluster && groupKey && (
          <button
            onClick={(e) => { e.stopPropagation(); onFocusCluster(groupKey, cluster); }}
            className="opacity-0 group-hover:opacity-100 transition-opacity text-gray-400 hover:text-primary-500"
            title="Focus on this cluster"
          >
            <Focus className="w-3 h-3" />
          </button>
        )}
      </span>
    );
  };

  // Build column definitions dynamically to guarantee header/body alignment
  type ColDef = {
    key: string;
    label: string;
    width: number;
    sortField: string;
    render: (node: ComparisonNode) => React.ReactNode;
  };

  const columns = useMemo((): ColDef[] => {
    const cols: ColDef[] = [];

    // Per-group count columns
    groupKeys.forEach((key, i) => {
      cols.push({
        key: `${key}_count`,
        label: `${groupNames[i]} Cnt`,
        width: NUM_COL_W,
        sortField: `${key}_count`,
        render: (node) => <>{(node as any)[`${key}_count`] ?? 0}</>,
      });
    });

    // Per-group normalized columns
    groupKeys.forEach((key, i) => {
      cols.push({
        key: `${key}_normalized`,
        label: `${groupNames[i]} %`,
        width: NUM_COL_W,
        sortField: `${key}_normalized`,
        render: (node) => <>{(node as any)[`${key}_normalized`] ?? 0}%</>,
      });
    });

    // Diff + Emphasis (2 groups only)
    if (numGroups === 2) {
      cols.push({
        key: 'difference',
        label: 'Diff',
        width: DIFF_COL_W,
        sortField: 'difference',
        render: (node) => {
          const diff = (node as any).difference ?? 0;
          return <span className={`font-semibold ${getEmphasisClass(diff)}`}>{diff > 0 ? '+' : ''}{diff}%</span>;
        },
      });
      cols.push({
        key: 'emphasis',
        label: 'Emphasis',
        width: NUM_COL_W,
        sortField: 'difference',
        render: (node) => {
          const diff = (node as any).difference ?? 0;
          return <span className={getEmphasisClass(diff)}>{getEmphasisLabel(diff)}</span>;
        },
      });
    }

    // Avg
    cols.push({
      key: 'avg_normalized',
      label: 'Avg',
      width: NUM_COL_W,
      sortField: 'avg_normalized',
      render: (node) => <>{node.avg_normalized}%</>,
    });

    // Group count (multi-group)
    if (numGroups > 1) {
      cols.push({
        key: 'group_count',
        label: '# Groups',
        width: NUM_COL_W,
        sortField: 'group_count',
        render: (node) => <>{(node as any).group_count ?? '-'}</>,
      });
    }

    // Per-group cluster columns
    groupKeys.forEach((key, i) => {
      cols.push({
        key: `${key}_cluster`,
        label: `${groupNames[i]} Cl`,
        width: NUM_COL_W,
        sortField: `${key}_cluster`,
        render: (node) => renderClusterBadge((node as any)[`${key}_cluster`], key),
      });
    });

    // Per-group degree
    groupKeys.forEach((key, i) => {
      cols.push({
        key: `${key}_degree`,
        label: `${groupNames[i]} Deg`,
        width: NUM_COL_W,
        sortField: `${key}_degree`,
        render: (node) => <>{(node as any)[`${key}_degree`] ?? '-'}</>,
      });
    });

    // Per-group strength
    groupKeys.forEach((key, i) => {
      cols.push({
        key: `${key}_strength`,
        label: `${groupNames[i]} Str`,
        width: NUM_COL_W,
        sortField: `${key}_strength`,
        render: (node) => <>{(node as any)[`${key}_strength`] ?? '-'}</>,
      });
    });

    // Per-group betweenness
    groupKeys.forEach((key, i) => {
      cols.push({
        key: `${key}_betweenness`,
        label: `${groupNames[i]} Bet`,
        width: NUM_COL_W,
        sortField: `${key}_betweenness`,
        render: (node) => <>{(node as any)[`${key}_betweenness`]?.toFixed(3) ?? '-'}</>,
      });
    });

    // Per-group closeness
    groupKeys.forEach((key, i) => {
      cols.push({
        key: `${key}_closeness`,
        label: `${groupNames[i]} Cls`,
        width: NUM_COL_W,
        sortField: `${key}_closeness`,
        render: (node) => <>{(node as any)[`${key}_closeness`]?.toFixed(3) ?? '-'}</>,
      });
    });

    // Per-group eigenvector
    groupKeys.forEach((key, i) => {
      cols.push({
        key: `${key}_eigenvector`,
        label: `${groupNames[i]} Eig`,
        width: NUM_COL_W,
        sortField: `${key}_eigenvector`,
        render: (node) => <>{(node as any)[`${key}_eigenvector`]?.toFixed(3) ?? '-'}</>,
      });
    });

    // Per-group pagerank
    groupKeys.forEach((key, i) => {
      cols.push({
        key: `${key}_pagerank`,
        label: `${groupNames[i]} PR`,
        width: NUM_COL_W,
        sortField: `${key}_pagerank`,
        render: (node) => <>{(node as any)[`${key}_pagerank`]?.toFixed(3) ?? '-'}</>,
      });
    });

    // Per-group harmonic
    groupKeys.forEach((key, i) => {
      cols.push({
        key: `${key}_harmonic`,
        label: `${groupNames[i]} Hrm`,
        width: NUM_COL_W,
        sortField: `${key}_harmonic`,
        render: (node) => <>{(node as any)[`${key}_harmonic`]?.toFixed(3) ?? '-'}</>,
      });
    });

    // Per-group kcore
    groupKeys.forEach((key, i) => {
      cols.push({
        key: `${key}_kcore`,
        label: `${groupNames[i]} KC`,
        width: NUM_COL_W,
        sortField: `${key}_kcore`,
        render: (node) => <>{(node as any)[`${key}_kcore`] ?? '-'}</>,
      });
    });

    // Per-group constraint
    groupKeys.forEach((key, i) => {
      cols.push({
        key: `${key}_constraint`,
        label: `${groupNames[i]} Con`,
        width: NUM_COL_W,
        sortField: `${key}_constraint`,
        render: (node) => <>{(node as any)[`${key}_constraint`]?.toFixed(3) ?? '-'}</>,
      });
    });

    return cols;
  }, [groupKeys, groupNames, numGroups, onFocusCluster]);

  // Total width for inner scroll container
  const totalWidth = HIDE_COL_W + WORD_COL_W + columns.reduce((sum, c) => sum + c.width, 0);

  const listHeight = Math.min(displayData.length, MAX_VISIBLE_ROWS) * ROW_HEIGHT;

  const Row = useCallback(({ index, style }: { index: number; style: React.CSSProperties }) => {
    const node = displayData[index];
    const isHighlighted = highlightedNode === node.word;
    const isHidden = filterState.hiddenWords.has(node.word);

    return (
      <div
        style={{ ...style, width: totalWidth }}
        className={`flex items-center group border-b border-gray-100 dark:border-gray-700 ${isHighlighted ? 'ring-2 ring-yellow-400 bg-yellow-50 dark:bg-yellow-900/20' : 'hover:bg-gray-50 dark:hover:bg-gray-700/50'} ${isHidden ? 'opacity-50' : ''}`}
      >
        {/* Hide/Show toggle */}
        <div style={{ width: HIDE_COL_W, minWidth: HIDE_COL_W }} className="flex-shrink-0 text-center px-2">
          <button
            onClick={() => onToggleVisibility(node.word)}
            className={`visibility-toggle ${isHidden ? 'hidden' : 'visible'}`}
          >
            {isHidden ? 'Show' : 'Hide'}
          </button>
        </div>
        {/* Word */}
        <div
          style={{ width: WORD_COL_W, minWidth: WORD_COL_W }}
          className={`flex-shrink-0 px-3 font-medium truncate text-gray-900 dark:text-gray-100 ${isHidden ? 'line-through' : ''} ${onNodeClick ? 'cursor-pointer hover:text-primary-600 dark:hover:text-primary-400' : ''}`}
          onClick={() => onNodeClick?.(node.word)}
          title={node.word}
        >
          {node.word}
        </div>
        {/* Dynamic columns */}
        {columns.map(col => (
          <div
            key={col.key}
            style={{ width: col.width, minWidth: col.width }}
            className="flex-shrink-0 px-2 text-sm text-gray-900 dark:text-gray-200"
          >
            {col.render(node)}
          </div>
        ))}
      </div>
    );
  }, [displayData, highlightedNode, columns, totalWidth, onToggleVisibility, onNodeClick, filterState.hiddenWords]);

  return (
    <div className="p-4">
      <h3 className="text-lg font-semibold mb-4 text-gray-900 dark:text-gray-100">Data Table</h3>

      <div className="mb-4 relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
        <input
          type="text"
          placeholder="Search for words..."
          value={filterState.searchQuery}
          onChange={(e) => onSearch(e.target.value)}
          className="w-full pl-10 pr-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:ring-primary-500 focus:border-primary-500"
        />
      </div>

      {/* Scroll container */}
      <div className="relative">
        {/* Header — hidden overflow, synced via JS */}
        <div ref={headerRef} className="overflow-hidden">
          <div className="flex items-center py-2 border-b-2 border-gray-200 dark:border-gray-600 bg-gray-50 dark:bg-gray-700/50" style={{ width: totalWidth }}>
            <div style={{ width: HIDE_COL_W, minWidth: HIDE_COL_W }} className="flex-shrink-0 px-2 text-xs font-semibold text-gray-600 dark:text-gray-300 uppercase tracking-wide">Hide</div>
            <div
              onClick={() => handleSort('word')}
              style={{ width: WORD_COL_W, minWidth: WORD_COL_W }}
              className="flex-shrink-0 px-3 cursor-pointer whitespace-nowrap text-xs font-semibold text-gray-600 dark:text-gray-300 uppercase tracking-wide"
            >
              <div className="flex items-center gap-1">
                Word
                <ArrowUpDown className="w-3 h-3 opacity-50" />
              </div>
            </div>
            {columns.map(col => (
              <div
                key={col.key}
                onClick={() => handleSort(col.sortField)}
                style={{ width: col.width, minWidth: col.width }}
                className="flex-shrink-0 px-2 cursor-pointer whitespace-nowrap text-xs font-semibold text-gray-600 dark:text-gray-300 uppercase tracking-wide"
              >
                <div className="flex items-center gap-1">
                  {col.label}
                  <ArrowUpDown className="w-3 h-3 opacity-50" />
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Body — horizontal scroll */}
        <div ref={bodyRef} className="overflow-x-auto">
          {displayData.length > 0 ? (
            <List
              ref={listRef}
              height={listHeight || ROW_HEIGHT}
              itemCount={displayData.length}
              itemSize={ROW_HEIGHT}
              width={totalWidth}
              overscanCount={5}
            >
              {Row}
            </List>
          ) : (
            <div className="py-8 text-center text-gray-500 dark:text-gray-400">
              No matching words found
            </div>
          )}
        </div>
      </div>

      <div className="mt-4 flex items-center justify-between text-sm text-gray-500 dark:text-gray-400">
        <span>
          Showing {displayData.length} of {data.length} words
          {filterState.hiddenWords.size > 0 && (
            <span> &bull; {filterState.hiddenWords.size} hidden</span>
          )}
        </span>
        {filterState.hiddenWords.size > 0 && onClearHidden && (
          <button
            onClick={onClearHidden}
            className="px-3 py-1 text-xs bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded hover:bg-gray-300 dark:hover:bg-gray-600"
          >
            Clear Hidden ({filterState.hiddenWords.size})
          </button>
        )}
      </div>
    </div>
  );
}
