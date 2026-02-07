import { useEffect, useRef, useMemo, useState, useImperativeHandle, forwardRef } from 'react';
import { Network } from 'vis-network';
import { DataSet } from 'vis-data';
import { ChevronDown, ChevronUp } from 'lucide-react';
import type { NetworkGraphProps } from '../types';
import {
  filterNodes,
  getNodeColor,
  getNodeSize,
  getFontSize,
  filterEdgesByType,
  CLUSTER_COLORS,
  EMPHASIS_COLORS
} from '../utils/network';
import { computeClusteredLayout, computeCircularLayout, computeRadialLayout, computeHierarchicalPositions } from '../utils/layouts';
import { drawClusterHull } from '../utils/geometry';

export interface NetworkGraphHandle {
  exportImage: (format: 'png' | 'svg') => void;
}

export const NetworkGraph = forwardRef<NetworkGraphHandle, NetworkGraphProps>(function NetworkGraph({
  nodes,
  edges,
  filterState,
  visualizationState,
  groupNames,
  groupKeys,
  highlightedNode,
  onNodeClick,
  onNodeRightClick,
  focusedCluster,
  pathNodes,
  egoCenter,
  selectedNodes,
}, ref) {
  const containerRef = useRef<HTMLDivElement>(null);
  const networkRef = useRef<Network | null>(null);
  const [legendExpanded, setLegendExpanded] = useState(true);

  const numGroups = groupNames.length;
  const fontColor = '#000000';
  const edgeColor = '#999';

  const pathNodeSet = useMemo(() => new Set(pathNodes || []), [pathNodes]);

  const filteredNodes = useMemo(() => {
    return filterNodes(nodes, filterState, groupKeys);
  }, [nodes, filterState, groupKeys]);

  const filteredEdges = useMemo(() => {
    const nodeIds = new Set(filteredNodes.map(n => n.word));
    let filtered = edges.filter(
      e => nodeIds.has(e.from) && nodeIds.has(e.to) && e.weight >= filterState.minEdgeWeight
    );
    filtered = filterEdgesByType(filtered, visualizationState.edgeTypeFilter);
    return filtered;
  }, [edges, filteredNodes, filterState.minEdgeWeight, visualizationState.edgeTypeFilter]);

  // Determine active group key from filter (for cluster-based layouts)
  const activeGroupKey = useMemo(() => {
    const ft = filterState.filterType;
    if (ft.endsWith('_cluster')) return ft.replace('_cluster', '');
    return groupKeys[0] || '';
  }, [filterState.filterType, groupKeys]);

  // Pre-compute positions for non-physics layouts
  const precomputedPositions = useMemo(() => {
    const layout = visualizationState.layout;
    if (layout === 'clustered') return computeClusteredLayout(filteredNodes, groupKeys, activeGroupKey);
    if (layout === 'circular') return computeCircularLayout(filteredNodes, groupKeys);
    if (layout === 'radial') return computeRadialLayout(filteredNodes, groupKeys);
    if (layout === 'hierarchical') return computeHierarchicalPositions(filteredNodes, filteredEdges, groupKeys);
    return null;
  }, [visualizationState.layout, filteredNodes, filteredEdges, groupKeys, activeGroupKey]);

  const visNodes = useMemo(() => {
    return filteredNodes.map(node => {
      const color = getNodeColor(
        node,
        visualizationState.colorMode,
        groupKeys,
        visualizationState.nodeColorMetric,
        filteredNodes
      );
      const size = getNodeSize(node, visualizationState.colorMode, groupKeys, visualizationState.nodeSizeMetric);
      const fontSize = getFontSize(node.avg_normalized, node.word.length, visualizationState.labelScale ?? 1.0);

      let tooltipHtml = `<b>${node.word}</b><br/>`;
      groupNames.forEach((name, i) => {
        const key = groupKeys[i];
        const count = (node as any)[`${key}_count`] ?? 0;
        const norm = (node as any)[`${key}_normalized`] ?? 0;
        tooltipHtml += `${name}: ${count} (${norm}%)<br/>`;
      });
      if (numGroups === 2) {
        const diff = (node as any).difference ?? 0;
        tooltipHtml += `Diff: ${diff > 0 ? '+' : ''}${diff}%<br/>`;
      }
      // Add advanced metrics to tooltip
      const pk = groupKeys[0] || '';
      const pr = (node as any)[`${pk}_pagerank`];
      const kc = (node as any)[`${pk}_kcore`];
      if (pr !== undefined) tooltipHtml += `PageRank: ${pr}<br/>`;
      if (kc !== undefined) tooltipHtml += `K-Core: ${kc}`;

      const isHighlighted = highlightedNode === node.word;
      const isOnPath = pathNodeSet.has(node.word);
      const isEgoCenter = egoCenter === node.word;
      const isSelected = selectedNodes?.has(node.word);

      let borderColor = '#666';
      let borderWidth = 2;
      if (isHighlighted || isSelected) { borderColor = '#FFD700'; borderWidth = 4; }
      if (isOnPath) { borderColor = '#FFD700'; borderWidth = 3; }
      if (isEgoCenter) { borderColor = '#00BFFF'; borderWidth = 4; }

      const rawPos = precomputedPositions?.get(node.word);
      // Make slider 10x more influential with exponential scaling
      const rawSpread = visualizationState.nodeSpread ?? 1.0;
      const spread = Math.pow(rawSpread, 3.3);
      const pos = rawPos ? { x: rawPos.x * spread, y: rawPos.y * spread } : undefined;

      const finalSize = (isHighlighted || isEgoCenter) ? size * 1.5 : size;
      const finalFontSize = isHighlighted ? fontSize * 1.3 : fontSize;

      return {
        id: node.word,
        label: node.word,
        size: finalSize,
        color: {
          background: color,
          border: borderColor,
          highlight: { background: color, border: '#FFD700' },
        },
        borderWidth,
        font: {
          size: finalFontSize,
          color: fontColor,
          face: 'Arial',
          vadjust: -finalSize * 1.05,  // Center label on node
          multi: 'html',  // Enable word wrapping
          maxWdt: finalSize * 1.8,  // Max width before wrapping (allows overflow)
        },
        title: tooltipHtml,
        ...(pos ? { x: pos.x, y: pos.y } : {}),
      };
    });
  }, [filteredNodes, visualizationState, groupNames, groupKeys, numGroups, highlightedNode, fontColor, pathNodeSet, egoCenter, selectedNodes, precomputedPositions]);

  const visEdges = useMemo(() => {
    // Calculate max weight for Euclidean distance normalization
    const maxWeight = Math.max(...filteredEdges.map(e => e.weight), 1);

    return filteredEdges.map(edge => {
      const isSemantic = edge.edge_type === 'semantic';
      const isPathEdge = pathNodeSet.has(edge.from) && pathNodeSet.has(edge.to) && pathNodes &&
        pathNodes.indexOf(edge.from) !== -1 && pathNodes.indexOf(edge.to) !== -1 &&
        Math.abs(pathNodes.indexOf(edge.from) - pathNodes.indexOf(edge.to)) === 1;

      let tooltipText = `${edge.from} ↔ ${edge.to}\nWeight: ${edge.weight}`;
      if (edge.semantic_similarity !== undefined) {
        tooltipText += `\nSemantic: ${edge.semantic_similarity.toFixed(3)}`;
      }

      // Euclidean distance: higher weight = shorter distance (closer nodes)
      const normalizedWeight = edge.weight / maxWeight;
      const edgeLength = 50 + (1 - normalizedWeight) * 300;  // Range: 50-350

      return {
        from: edge.from,
        to: edge.to,
        value: edge.weight,
        length: edgeLength,  // Euclidean distance based on weight
        color: {
          color: isPathEdge ? '#FFD700' : edgeColor,
          opacity: isPathEdge ? 0.8 : 0.15,
          highlight: '#666',
        },
        width: isPathEdge ? 4 : Math.max(1, Math.min(5, edge.weight / 10)),
        smooth: { type: 'continuous' as const, roundness: 0.2 },
        dashes: isSemantic ? [5, 5] : false,
        title: tooltipText,
      };
    });
  }, [filteredEdges, edgeColor, pathNodeSet, pathNodes]);

  // Expose export function via ref
  useImperativeHandle(ref, () => ({
    exportImage(format: 'png' | 'svg') {
      if (!containerRef.current) return;
      const canvas = containerRef.current.querySelector('canvas');
      if (!canvas) return;

      if (format === 'png') {
        const dataUrl = canvas.toDataURL('image/png');
        const a = document.createElement('a');
        a.href = dataUrl;
        a.download = 'network_graph.png';
        a.click();
      } else {
        // SVG fallback using canvas data
        const dataUrl = canvas.toDataURL('image/png');
        const svgStr = `<svg xmlns="http://www.w3.org/2000/svg" width="${canvas.width}" height="${canvas.height}"><image href="${dataUrl}" width="${canvas.width}" height="${canvas.height}"/></svg>`;
        const blob = new Blob([svgStr], { type: 'image/svg+xml' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'network_graph.svg';
        a.click();
        URL.revokeObjectURL(url);
      }
    }
  }), []);

  useEffect(() => {
    if (!containerRef.current) return;

    const usePhysics = visualizationState.layout === 'force';

    const options: any = {
      nodes: {
        shape: 'dot',  // Fixed size circle
        borderWidth: 2,
        borderWidthSelected: 3,
      },
      edges: {
        smooth: { enabled: true, type: 'continuous', roundness: 0.2 },
      },
      interaction: {
        hover: true,
        dragNodes: true,
        dragView: true,
        zoomView: true,
        tooltipDelay: 100,
      },
    };

    if (visualizationState.layout === 'hierarchical') {
      // Use vis-network built-in hierarchical if no precomputed positions
      if (!precomputedPositions) {
        options.layout = {
          hierarchical: {
            direction: 'UD',
            sortMethod: 'hubsize',
            levelSeparation: 150,
            nodeSpacing: 100,
          },
        };
        options.physics = {
          enabled: true,
          hierarchicalRepulsion: {
            centralGravity: 0.0,
            springLength: 150,
            springConstant: 0.01,
            nodeDistance: 120,
          },
        };
      } else {
        options.physics = { enabled: false };
      }
    } else if (usePhysics) {
      // Make slider 10x more influential: 0.5→0.05, 1.0→1.0, 2.0→100
      const rawSpread = visualizationState.nodeSpread ?? 1.0;
      const spread = Math.pow(rawSpread, 3.3); // Exponential scaling for 10x effect
      options.physics = {
        enabled: true,
        stabilization: { iterations: 150, updateInterval: 25 },
        barnesHut: {
          gravitationalConstant: -8000 * spread,  // Stronger repulsion for more spread
          centralGravity: 0.02 / spread,          // Weaker central pull
          springLength: 200 * spread,             // Base spring length (per-edge length overrides)
          springConstant: 0.04,                   // Stronger springs for Euclidean positioning
          damping: 0.12,
          avoidOverlap: 1,
        },
      };
      // Use per-edge length for Euclidean distance
      options.edges = {
        ...options.edges,
        smooth: { enabled: true, type: 'continuous', roundness: 0.2 },
      };
    } else {
      options.physics = { enabled: false };
    }

    networkRef.current = new Network(
      containerRef.current,
      {
        nodes: new DataSet(visNodes as any),
        edges: new DataSet(visEdges as any),
      },
      options
    );

    networkRef.current.on('stabilizationIterationsDone', () => {
      networkRef.current?.setOptions({ physics: false });
    });

    if (onNodeClick) {
      networkRef.current.on('click', (params: any) => {
        if (params.nodes && params.nodes.length > 0) {
          onNodeClick(params.nodes[0]);
        }
      });
    }

    if (onNodeRightClick) {
      networkRef.current.on('oncontext', (params: any) => {
        params.event.preventDefault();
        const nodeId = networkRef.current?.getNodeAt(params.pointer.DOM);
        if (nodeId) {
          onNodeRightClick(nodeId as string, params.event.clientX, params.event.clientY);
        }
      });
    }

    // Draw cluster hulls after drawing
    if (visualizationState.showClusterHulls) {
      networkRef.current.on('afterDrawing', (ctx: CanvasRenderingContext2D) => {
        const clusterKey = groupKeys[0] ? `${groupKeys[0]}_cluster` : '';
        if (!clusterKey) return;

        const clusterPoints = new Map<number, { x: number; y: number }[]>();
        filteredNodes.forEach(node => {
          const cluster = (node as any)[clusterKey] ?? -1;
          if (cluster < 0) return;
          try {
            const pos = networkRef.current?.getPositions([node.word]);
            if (pos && pos[node.word]) {
              if (!clusterPoints.has(cluster)) clusterPoints.set(cluster, []);
              clusterPoints.get(cluster)!.push(pos[node.word]);
            }
          } catch { /* node might not exist */ }
        });

        clusterPoints.forEach((points, cluster) => {
          if (points.length >= 2) {
            const color = cluster < CLUSTER_COLORS.length ? CLUSTER_COLORS[cluster] : '#999';
            drawClusterHull(ctx, points, color);
          }
        });
      });
    }

    return () => {
      networkRef.current?.destroy();
      networkRef.current = null;
    };
  }, [visNodes, visEdges, visualizationState.layout, visualizationState.showClusterHulls, visualizationState.nodeSpread, onNodeClick, onNodeRightClick, precomputedPositions, groupKeys, filteredNodes]);

  // Focus on highlighted node
  useEffect(() => {
    if (!networkRef.current || !highlightedNode) return;
    try {
      networkRef.current.selectNodes([highlightedNode]);
      networkRef.current.focus(highlightedNode, {
        scale: 1.5,
        animation: { duration: 500, easingFunction: 'easeInOutQuad' }
      });
    } catch {
      // Node might not exist
    }
  }, [highlightedNode]);

  // Fit when focused cluster changes
  useEffect(() => {
    if (!networkRef.current || !focusedCluster) return;
    setTimeout(() => {
      networkRef.current?.fit({ animation: { duration: 500, easingFunction: 'easeInOutQuad' } });
    }, 100);
  }, [focusedCluster]);

  const getColorModeLabel = () => {
    const metric = visualizationState.nodeColorMetric;
    if (metric === 'betweenness_gradient') return 'Betweenness Gradient';
    if (metric === 'pagerank_gradient') return 'PageRank Gradient';
    if (metric === 'kcore_gradient') return 'K-Core Gradient';
    if (visualizationState.colorMode.endsWith('_cluster')) {
      const groupKey = visualizationState.colorMode.replace('_cluster', '');
      const groupIndex = groupKeys.indexOf(groupKey);
      if (groupIndex >= 0) return `${groupNames[groupIndex]} Clusters`;
      return 'Clusters';
    }
    return 'Emphasis Groups';
  };


  const isClusterMode = visualizationState.colorMode.endsWith('_cluster');
  const isGradientMode = visualizationState.nodeColorMetric.endsWith('_gradient');
  const hasSemantic = filteredEdges.some(e => e.edge_type === 'semantic');

  const getSizeLabel = () => {
    const m = visualizationState.nodeSizeMetric;
    const labels: Record<string, string> = {
      avg_normalized: 'Average normalized score',
      betweenness: 'Betweenness Centrality',
      closeness: 'Closeness Centrality',
      eigenvector: 'Eigenvector Centrality',
      degree: 'Degree',
      strength: 'Strength',
      pagerank: 'PageRank',
      harmonic: 'Harmonic Centrality',
      kcore: 'K-Core Number',
    };
    if (labels[m]) return labels[m];
    // Per-group score label
    if (m.endsWith('_normalized')) {
      const groupKey = m.replace('_normalized', '');
      const groupIndex = groupKeys.indexOf(groupKey);
      if (groupIndex >= 0) return `${groupNames[groupIndex]} Score`;
    }
    return m;
  };

  return (
    <div className="p-4">
      {/* Collapsible Legend */}
      <div className="mb-4">
        <button
          onClick={() => setLegendExpanded(!legendExpanded)}
          className="flex items-center gap-2 text-sm font-medium text-gray-700 dark:text-gray-300 hover:text-gray-900 dark:hover:text-gray-100"
        >
          <span>{getColorModeLabel()}</span>
          {legendExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
        </button>

        {legendExpanded && (
          <div className="mt-2 flex flex-wrap items-center gap-4 text-sm">
            {isGradientMode ? (
              <div className="flex items-center gap-2">
                <div className="w-24 h-3 rounded" style={{ background: 'linear-gradient(to right, rgb(0,0,255), rgb(255,200,0), rgb(255,0,0))' }} />
                <span className="text-gray-600 dark:text-gray-400 text-xs">Low → High</span>
              </div>
            ) : !isClusterMode ? (
              numGroups === 2 ? (
                <>
                  <div className="legend-item">
                    <div className="legend-dot" style={{ backgroundColor: EMPHASIS_COLORS.group_a }} />
                    <span className="text-gray-700 dark:text-gray-300">{groupNames[0]}-emphasized</span>
                  </div>
                  <div className="legend-item">
                    <div className="legend-dot" style={{ backgroundColor: EMPHASIS_COLORS.group_b }} />
                    <span className="text-gray-700 dark:text-gray-300">{groupNames[1]}-emphasized</span>
                  </div>
                  <div className="legend-item">
                    <div className="legend-dot" style={{ backgroundColor: EMPHASIS_COLORS.balanced }} />
                    <span className="text-gray-700 dark:text-gray-300">Balanced</span>
                  </div>
                </>
              ) : (
                <div className="legend-item">
                  <div className="legend-dot" style={{ backgroundColor: EMPHASIS_COLORS.balanced }} />
                  <span className="text-gray-700 dark:text-gray-300">All words</span>
                </div>
              )
            ) : (
              (() => {
                // Only show clusters that are actually present in the current graph
                const clusterKey = visualizationState.colorMode; // e.g. 'group_a_cluster'
                const visibleClusters = new Set<number>();
                filteredNodes.forEach(n => {
                  const c = (n as any)[clusterKey];
                  if (c !== undefined && c >= 0 && c < CLUSTER_COLORS.length) visibleClusters.add(c);
                });
                const sorted = [...visibleClusters].sort((a, b) => a - b);
                return sorted.map(i => (
                  <div key={i} className="legend-item">
                    <div className="legend-dot" style={{ backgroundColor: CLUSTER_COLORS[i] }} />
                    <span className="text-gray-700 dark:text-gray-300">Cluster {i}</span>
                  </div>
                ));
              })()
            )}

            <div className="w-full border-t border-gray-200 dark:border-gray-700 pt-2 mt-1 flex flex-wrap gap-4 text-xs text-gray-500 dark:text-gray-400">
              <span>Node size = {getSizeLabel()}</span>
              <span>Edge thickness = Co-occurrence weight</span>
              {hasSemantic && (
                <span className="flex items-center gap-1">
                  <span className="inline-block w-6 border-t-2 border-dashed border-gray-400" />
                  Semantic edge
                </span>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Path info */}
      {pathNodes && pathNodes.length > 0 && (
        <div className="mb-2 p-2 bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded text-sm text-yellow-800 dark:text-yellow-300">
          Shortest path: {pathNodes.join(' → ')} ({pathNodes.length - 1} hops)
        </div>
      )}

      {/* Filter status */}
      <div className="mb-4 p-2 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded text-sm text-blue-800 dark:text-blue-300">
        Showing {filteredNodes.length} of {nodes.length} words &bull; {filteredEdges.length} edges
        {focusedCluster && (
          <span className="ml-2 font-medium">(Cluster {focusedCluster.cluster} focused)</span>
        )}
        {egoCenter && (
          <span className="ml-2 font-medium">(Ego: {egoCenter})</span>
        )}
      </div>

      <div ref={containerRef} className="network-container" />
    </div>
  );
});
