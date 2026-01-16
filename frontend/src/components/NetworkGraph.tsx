import { useEffect, useRef, useMemo } from 'react';
import { Network } from 'vis-network';
import { DataSet } from 'vis-data';
import type { NetworkGraphProps } from '../types';
import {
  filterNodes,
  getNodeColor,
  getNodeSize,
  getFontSize,
  CLUSTER_COLORS,
  EMPHASIS_COLORS
} from '../utils/network';

export function NetworkGraph({
  nodes,
  edges,
  filterState,
  visualizationState,
  groupNames,
  groupKeys,
}: NetworkGraphProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const networkRef = useRef<Network | null>(null);

  const numGroups = groupNames.length;

  // Filter nodes
  const filteredNodes = useMemo(() => {
    return filterNodes(nodes, filterState, groupKeys);
  }, [nodes, filterState, groupKeys]);

  // Filter edges
  const filteredEdges = useMemo(() => {
    const nodeIds = new Set(filteredNodes.map(n => n.word));
    return edges.filter(
      e => nodeIds.has(e.from) && nodeIds.has(e.to) && e.weight >= filterState.minEdgeWeight
    );
  }, [edges, filteredNodes, filterState.minEdgeWeight]);

  // Create vis.js nodes
  const visNodes = useMemo(() => {
    return filteredNodes.map(node => {
      const color = getNodeColor(node, visualizationState.colorMode, groupKeys);
      const size = getNodeSize(node, visualizationState.colorMode, groupKeys);
      const fontSize = getFontSize(node.avg_normalized, node.word.length);

      // Build tooltip with dynamic group info
      let tooltipHtml = `<b>${node.word}</b><br/>`;
      groupNames.forEach((name, i) => {
        const key = groupKeys[i];
        const count = (node as any)[`${key}_count`] ?? 0;
        const norm = (node as any)[`${key}_normalized`] ?? 0;
        tooltipHtml += `${name}: ${count} (${norm}%)<br/>`;
      });
      if (numGroups === 2) {
        const diff = (node as any).difference ?? 0;
        tooltipHtml += `Diff: ${diff > 0 ? '+' : ''}${diff}%`;
      }

      return {
        id: node.word,
        label: node.word,
        size,
        color: {
          background: color,
          border: '#666',
          highlight: { background: color, border: '#000' },
        },
        font: {
          size: fontSize,
          color: 'black',
          face: 'Arial',
        },
        title: tooltipHtml,
      };
    });
  }, [filteredNodes, visualizationState.colorMode, groupNames, groupKeys, numGroups]);

  // Create vis.js edges
  const visEdges = useMemo(() => {
    return filteredEdges.map(edge => ({
      from: edge.from,
      to: edge.to,
      value: edge.weight,
      color: { color: '#999', opacity: 0.15, highlight: '#666' },
      width: Math.max(1, Math.min(5, edge.weight / 10)),
      smooth: { type: 'continuous' as const, roundness: 0.2 },
    }));
  }, [filteredEdges]);

  // Initialize network
  useEffect(() => {
    if (!containerRef.current) return;

    const options = {
      nodes: {
        shape: 'dot',
        borderWidth: 2,
        borderWidthSelected: 3,
      },
      edges: {
        smooth: { enabled: true, type: 'continuous', roundness: 0.2 },
      },
      physics: visualizationState.layout === 'force' ? {
        enabled: true,
        stabilization: { iterations: 150, updateInterval: 25 },
        barnesHut: {
          gravitationalConstant: -5000,
          centralGravity: 0.05,
          springLength: 250,
          springConstant: 0.02,
          damping: 0.15,
          avoidOverlap: 1,
        },
      } : { enabled: false },
      interaction: {
        hover: true,
        dragNodes: true,
        dragView: true,
        zoomView: true,
        tooltipDelay: 100,
      },
    };

    // Create new network
    networkRef.current = new Network(
      containerRef.current,
      {
        nodes: new DataSet(visNodes as any),
        edges: new DataSet(visEdges as any),
      },
      options
    );

    // Stop physics after stabilization
    networkRef.current.on('stabilizationIterationsDone', () => {
      networkRef.current?.setOptions({ physics: false });
    });

    return () => {
      networkRef.current?.destroy();
      networkRef.current = null;
    };
  }, [visNodes, visEdges, visualizationState.layout]);

  // Get color mode label
  const getColorModeLabel = () => {
    if (visualizationState.colorMode.endsWith('_cluster')) {
      // Extract group name from color mode
      const groupKey = visualizationState.colorMode.replace('_cluster', '');
      const groupIndex = groupKeys.indexOf(groupKey);
      if (groupIndex >= 0) {
        return `${groupNames[groupIndex]} Clusters`;
      }
      return 'Clusters';
    }
    return 'Emphasis Groups';
  };

  // Get current group name for cluster mode
  const getClusterGroupName = () => {
    if (visualizationState.colorMode.endsWith('_cluster')) {
      const groupKey = visualizationState.colorMode.replace('_cluster', '');
      const groupIndex = groupKeys.indexOf(groupKey);
      if (groupIndex >= 0) {
        return groupNames[groupIndex];
      }
    }
    return '';
  };

  const isClusterMode = visualizationState.colorMode.endsWith('_cluster');

  return (
    <div className="p-4">
      {/* Legend */}
      <div className="mb-4 flex flex-wrap items-center gap-4 text-sm">
        <span className="font-medium">🎨 {getColorModeLabel()}:</span>

        {!isClusterMode ? (
          numGroups === 2 ? (
            <>
              <div className="legend-item">
                <div className="legend-dot" style={{ backgroundColor: EMPHASIS_COLORS.group_a }} />
                <span>{groupNames[0]}-emphasized</span>
              </div>
              <div className="legend-item">
                <div className="legend-dot" style={{ backgroundColor: EMPHASIS_COLORS.group_b }} />
                <span>{groupNames[1]}-emphasized</span>
              </div>
              <div className="legend-item">
                <div className="legend-dot" style={{ backgroundColor: EMPHASIS_COLORS.balanced }} />
                <span>Balanced</span>
              </div>
            </>
          ) : (
            <div className="legend-item">
              <div className="legend-dot" style={{ backgroundColor: EMPHASIS_COLORS.balanced }} />
              <span>All words</span>
            </div>
          )
        ) : (
          CLUSTER_COLORS.slice(0, 7).map((color, i) => (
            <div key={i} className="legend-item">
              <div className="legend-dot" style={{ backgroundColor: color }} />
              <span>Cluster {i}</span>
            </div>
          ))
        )}
      </div>

      {/* Size mode info for cluster views */}
      {isClusterMode && (
        <div className="mb-4 p-2 bg-green-50 border border-green-200 rounded text-sm text-green-800">
          📏 Node Size: Based on {getClusterGroupName()} Betweenness Centrality
        </div>
      )}

      {/* Filter status */}
      <div className="mb-4 p-2 bg-blue-50 border border-blue-200 rounded text-sm text-blue-800">
        Showing {filteredNodes.length} of {nodes.length} words • {filteredEdges.length} edges
      </div>

      {/* Network container */}
      <div ref={containerRef} className="network-container" />
    </div>
  );
}
