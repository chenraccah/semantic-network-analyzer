import { useEffect, useRef, useMemo } from 'react';
import { Network } from 'vis-network';
import { DataSet } from 'vis-data';
import type { NetworkGraphProps, ComparisonNode, NetworkEdge } from '../types';
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
  groupAName,
  groupBName,
}: NetworkGraphProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const networkRef = useRef<Network | null>(null);

  // Dynamic key names based on group names
  const groupAKey = groupAName.toLowerCase().replace(/\s+/g, '_');
  const groupBKey = groupBName.toLowerCase().replace(/\s+/g, '_');

  // Filter nodes
  const filteredNodes = useMemo(() => {
    return filterNodes(
      nodes,
      filterState,
      `${groupAKey}_normalized`,
      `${groupBKey}_normalized`,
      `${groupAKey}_cluster`,
      `${groupBKey}_cluster`
    );
  }, [nodes, filterState, groupAKey, groupBKey]);

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
      const color = getNodeColor(
        node,
        visualizationState.colorMode,
        `${groupAKey}_cluster`,
        `${groupBKey}_cluster`
      );
      const size = getNodeSize(
        node,
        visualizationState.colorMode,
        `${groupAKey}_betweenness`,
        `${groupBKey}_betweenness`
      );
      const fontSize = getFontSize(node.avg_normalized, node.word.length);

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
          bold: true,
        },
        title: `<b>${node.word}</b><br/>
          ${groupAName}: ${(node as any)[`${groupAKey}_count`]} (${(node as any)[`${groupAKey}_normalized`]}%)<br/>
          ${groupBName}: ${(node as any)[`${groupBKey}_count`]} (${(node as any)[`${groupBKey}_normalized`]}%)<br/>
          Diff: ${node.difference > 0 ? '+' : ''}${node.difference}%`,
      };
    });
  }, [filteredNodes, visualizationState.colorMode, groupAName, groupBName, groupAKey, groupBKey]);

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
        smooth: { type: 'continuous', roundness: 0.2 },
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
        nodes: new DataSet(visNodes),
        edges: new DataSet(visEdges),
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
    if (visualizationState.colorMode === 'group_a_cluster') {
      return `${groupAName} Clusters`;
    }
    if (visualizationState.colorMode === 'group_b_cluster') {
      return `${groupBName} Clusters`;
    }
    return 'Emphasis Groups';
  };

  return (
    <div className="p-4">
      {/* Legend */}
      <div className="mb-4 flex flex-wrap items-center gap-4 text-sm">
        <span className="font-medium">🎨 {getColorModeLabel()}:</span>
        
        {visualizationState.colorMode === 'emphasis' ? (
          <>
            <div className="legend-item">
              <div className="legend-dot" style={{ backgroundColor: EMPHASIS_COLORS.group_a }} />
              <span>{groupAName}-emphasized</span>
            </div>
            <div className="legend-item">
              <div className="legend-dot" style={{ backgroundColor: EMPHASIS_COLORS.group_b }} />
              <span>{groupBName}-emphasized</span>
            </div>
            <div className="legend-item">
              <div className="legend-dot" style={{ backgroundColor: EMPHASIS_COLORS.balanced }} />
              <span>Balanced</span>
            </div>
          </>
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
      {(visualizationState.colorMode === 'group_a_cluster' || 
        visualizationState.colorMode === 'group_b_cluster') && (
        <div className="mb-4 p-2 bg-green-50 border border-green-200 rounded text-sm text-green-800">
          📏 Node Size: Based on {visualizationState.colorMode === 'group_a_cluster' ? groupAName : groupBName} Betweenness Centrality
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
