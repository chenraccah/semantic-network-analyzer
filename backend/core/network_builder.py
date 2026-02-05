"""
Network building module for creating semantic co-occurrence networks.
"""

from typing import List, Dict, Tuple, Set, Optional
from collections import defaultdict
from itertools import combinations
import networkx as nx
import numpy as np
from scipy import sparse
from sklearn.cluster import SpectralClustering
import community as community_louvain

from .text_processor import TextProcessor


class NetworkBuilder:
    """Builds and analyzes semantic co-occurrence networks."""
    
    def __init__(self, text_processor: Optional[TextProcessor] = None):
        """
        Initialize the network builder.
        
        Args:
            text_processor: TextProcessor instance for processing text
        """
        self.processor = text_processor or TextProcessor()
        self.graph = None
        self.word_counts = {}
        self.edges = {}
    
    def build_network(
        self,
        texts: List[str],
        min_frequency: int = 1,
        min_edge_weight: int = 1
    ) -> nx.Graph:
        """
        Build a co-occurrence network from texts.
        
        Args:
            texts: List of text strings
            min_frequency: Minimum word frequency to include
            min_edge_weight: Minimum edge weight to include
            
        Returns:
            NetworkX graph of word co-occurrences
        """
        # Process texts
        result = self.processor.process_texts(texts)
        processed_texts = result['processed_texts']
        word_counts = result['word_counts']
        
        # Filter by frequency
        self.word_counts = {
            word: count 
            for word, count in word_counts.items() 
            if count >= min_frequency
        }
        
        valid_words = set(self.word_counts.keys())
        
        # Build edges
        edge_weights = defaultdict(int)
        
        for words in processed_texts:
            # Get unique valid words in this text
            text_words = set(w for w in words if w in valid_words)
            
            # Create pairs
            for pair in combinations(sorted(text_words), 2):
                edge_weights[pair] += 1
        
        # Filter edges by weight
        self.edges = {
            pair: weight 
            for pair, weight in edge_weights.items() 
            if weight >= min_edge_weight
        }
        
        # Build graph
        self.graph = nx.Graph()
        
        # Add nodes
        for word, count in self.word_counts.items():
            self.graph.add_node(word, count=count)
        
        # Add edges
        for (word1, word2), weight in self.edges.items():
            if word1 in self.word_counts and word2 in self.word_counts:
                self.graph.add_edge(word1, word2, weight=weight)
        
        return self.graph
    
    def calculate_centrality_metrics(self) -> Dict[str, Dict[str, float]]:
        """
        Calculate various centrality metrics for all nodes.
        
        Returns:
            Dictionary of centrality metrics per node
        """
        if not self.graph:
            raise ValueError("Network not built. Call build_network first.")
        
        metrics = {}
        
        # Degree centrality
        degree = dict(self.graph.degree())
        
        # Weighted degree (strength)
        strength = dict(self.graph.degree(weight='weight'))
        
        # Betweenness centrality
        betweenness = nx.betweenness_centrality(self.graph, weight='weight')
        
        # Closeness centrality
        closeness = nx.closeness_centrality(self.graph)
        
        # Eigenvector centrality
        try:
            eigenvector = nx.eigenvector_centrality(self.graph, weight='weight', max_iter=1000)
        except nx.PowerIterationFailedConvergence:
            eigenvector = {node: 0.0 for node in self.graph.nodes()}
        
        # Normalize metrics
        max_degree = max(degree.values()) if degree else 1
        max_strength = max(strength.values()) if strength else 1
        max_betweenness = max(betweenness.values()) if betweenness else 1
        max_eigenvector = max(eigenvector.values()) if eigenvector else 1

        for node in self.graph.nodes():
            metrics[node] = {
                'degree': degree.get(node, 0),
                'strength': strength.get(node, 0),
                'betweenness': betweenness.get(node, 0) / max_betweenness if max_betweenness > 0 else 0,
                'closeness': closeness.get(node, 0),
                'eigenvector': eigenvector.get(node, 0) / max_eigenvector if max_eigenvector > 0 else 0
            }

        return metrics

    def calculate_advanced_metrics(self) -> Dict[str, Dict[str, float]]:
        """
        Calculate advanced metrics: PageRank, harmonic centrality, k-core, constraint.

        Returns:
            Dictionary of advanced metrics per node
        """
        if not self.graph or len(self.graph.nodes()) == 0:
            return {}

        metrics = {}

        # PageRank
        try:
            pagerank = nx.pagerank(self.graph, weight='weight')
        except Exception:
            pagerank = {node: 0.0 for node in self.graph.nodes()}

        # Harmonic centrality
        try:
            harmonic = nx.harmonic_centrality(self.graph)
        except Exception:
            harmonic = {node: 0.0 for node in self.graph.nodes()}

        # K-core number
        try:
            kcore = nx.core_number(self.graph)
        except Exception:
            kcore = {node: 0 for node in self.graph.nodes()}

        # Constraint (structural holes)
        try:
            constraint = nx.constraint(self.graph, weight='weight')
        except Exception:
            constraint = {node: 0.0 for node in self.graph.nodes()}

        # Normalize
        max_pagerank = max(pagerank.values()) if pagerank else 1
        max_harmonic = max(harmonic.values()) if harmonic else 1

        for node in self.graph.nodes():
            c = constraint.get(node)
            metrics[node] = {
                'pagerank': round(pagerank.get(node, 0) / max_pagerank if max_pagerank > 0 else 0, 4),
                'harmonic': round(harmonic.get(node, 0) / max_harmonic if max_harmonic > 0 else 0, 4),
                'kcore': kcore.get(node, 0),
                'constraint': round(c if c is not None and not (isinstance(c, float) and c != c) else 0.0, 4),
            }

        return metrics

    def get_structural_stats(self) -> Dict[str, any]:
        """
        Get structural graph statistics: bridges, articulation points, assortativity.

        Returns:
            Dictionary of structural stats
        """
        if not self.graph or len(self.graph.nodes()) == 0:
            return {}

        stats = {}

        # Bridges
        try:
            bridges = list(nx.bridges(self.graph))
            stats['bridges'] = [[w1, w2] for w1, w2 in bridges]
            stats['num_bridges'] = len(bridges)
        except Exception:
            stats['bridges'] = []
            stats['num_bridges'] = 0

        # Articulation points
        try:
            ap = list(nx.articulation_points(self.graph))
            stats['articulation_points'] = ap
            stats['num_articulation_points'] = len(ap)
        except Exception:
            stats['articulation_points'] = []
            stats['num_articulation_points'] = 0

        # Assortativity
        try:
            stats['assortativity'] = round(nx.degree_assortativity_coefficient(self.graph), 6)
        except Exception:
            stats['assortativity'] = 0.0

        return stats
    
    def detect_clusters(self, method: str = 'louvain', n_clusters: int = 5, resolution: float = 1.0) -> Dict[str, int]:
        """
        Detect clusters/communities in the network.

        Args:
            method: Clustering method ('louvain', 'spectral')
            n_clusters: Number of clusters for spectral clustering
            resolution: Resolution parameter for Louvain (higher = more clusters)

        Returns:
            Dictionary mapping nodes to cluster IDs
        """
        if not self.graph or len(self.graph.nodes()) == 0:
            return {}

        # Need at least one edge for meaningful clustering
        if len(self.graph.edges()) == 0:
            # All nodes in separate clusters if no edges
            return {node: i for i, node in enumerate(self.graph.nodes())}

        if method == 'louvain':
            try:
                # Use fixed random_state for reproducibility
                partition = community_louvain.best_partition(
                    self.graph,
                    weight='weight',
                    resolution=resolution,
                    random_state=42
                )
                self.last_partition = partition

                # Log cluster info
                num_clusters = len(set(partition.values()))
                print(f"[LOUVAIN] Graph: {self.graph.number_of_nodes()} nodes, {self.graph.number_of_edges()} edges -> {num_clusters} clusters")

                return partition
            except Exception as e:
                print(f"[LOUVAIN ERROR] {e}")
                partition = {node: 0 for node in self.graph.nodes()}
                self.last_partition = partition
                return partition

        elif method == 'spectral':
            try:
                adj_matrix = nx.adjacency_matrix(self.graph, weight='weight')
                n_clusters = min(n_clusters, len(self.graph.nodes()))

                clustering = SpectralClustering(
                    n_clusters=n_clusters,
                    affinity='precomputed',
                    random_state=42
                )
                labels = clustering.fit_predict(adj_matrix.toarray())

                nodes = list(self.graph.nodes())
                partition = {nodes[i]: int(labels[i]) for i in range(len(nodes))}
                self.last_partition = partition
                return partition
            except Exception:
                partition = {node: 0 for node in self.graph.nodes()}
                self.last_partition = partition
                return partition

        else:
            partition = {node: 0 for node in self.graph.nodes()}
            self.last_partition = partition
            return partition
    
    def get_network_stats(self) -> Dict[str, any]:
        """
        Get network statistics including advanced metrics.

        Returns:
            Dictionary of network statistics
        """
        if not self.graph:
            return {}

        stats = {
            'num_nodes': self.graph.number_of_nodes(),
            'num_edges': self.graph.number_of_edges(),
            'density': round(nx.density(self.graph), 6),
            'avg_degree': sum(dict(self.graph.degree()).values()) / self.graph.number_of_nodes() if self.graph.number_of_nodes() > 0 else 0,
            'num_components': nx.number_connected_components(self.graph),
        }

        # Advanced metrics
        try:
            stats['clustering_coefficient'] = round(nx.average_clustering(self.graph, weight='weight'), 6)
        except Exception:
            stats['clustering_coefficient'] = 0.0

        # Diameter and avg path length on largest component
        if self.graph.number_of_nodes() > 0:
            try:
                largest_cc = max(nx.connected_components(self.graph), key=len)
                subgraph = self.graph.subgraph(largest_cc)
                if len(subgraph) > 1:
                    stats['diameter'] = nx.diameter(subgraph)
                    stats['avg_path_length'] = round(nx.average_shortest_path_length(subgraph), 6)
                else:
                    stats['diameter'] = 0
                    stats['avg_path_length'] = 0.0
            except Exception:
                stats['diameter'] = 0
                stats['avg_path_length'] = 0.0

        # Modularity from stored partition
        partition = getattr(self, 'last_partition', None)
        if partition and len(partition) > 0:
            try:
                communities = {}
                for node, comm in partition.items():
                    communities.setdefault(comm, set()).add(node)
                community_list = list(communities.values())
                stats['modularity'] = round(nx.community.modularity(self.graph, community_list), 6)
            except Exception:
                stats['modularity'] = 0.0

        return stats
    
    def get_nodes_data(self, metrics: Dict[str, Dict], clusters: Dict[str, int], advanced_metrics: Optional[Dict[str, Dict]] = None) -> List[Dict]:
        """
        Get list of nodes with all data.

        Args:
            metrics: Centrality metrics dictionary
            clusters: Cluster assignments dictionary
            advanced_metrics: Optional advanced metrics (pagerank, harmonic, kcore, constraint)

        Returns:
            List of node dictionaries
        """
        max_count = max(self.word_counts.values()) if self.word_counts else 1

        nodes = []
        for word, count in self.word_counts.items():
            node_metrics = metrics.get(word, {})
            node_data = {
                'word': word,
                'count': count,
                'normalized': round((count / max_count) * 100, 2),
                'cluster': clusters.get(word, -1),
                'degree': node_metrics.get('degree', 0),
                'strength': node_metrics.get('strength', 0),
                'betweenness': round(node_metrics.get('betweenness', 0), 3),
                'closeness': round(node_metrics.get('closeness', 0), 3),
                'eigenvector': round(node_metrics.get('eigenvector', 0), 3)
            }

            if advanced_metrics:
                adv = advanced_metrics.get(word, {})
                node_data['pagerank'] = adv.get('pagerank', 0)
                node_data['harmonic'] = adv.get('harmonic', 0)
                node_data['kcore'] = adv.get('kcore', 0)
                node_data['constraint'] = adv.get('constraint', 0)

            nodes.append(node_data)

        # Sort by normalized score
        nodes.sort(key=lambda x: x['normalized'], reverse=True)

        return nodes

    def add_semantic_edges(
        self,
        semantic_analyzer,
        threshold: float = 0.5,
        weight_multiplier: float = 10.0
    ) -> int:
        """
        Add semantic similarity edges to the network.

        Args:
            semantic_analyzer: SemanticAnalyzer instance
            threshold: Minimum similarity to create an edge (0-1)
            weight_multiplier: Multiplier to convert similarity to edge weight

        Returns:
            Number of semantic edges added
        """
        if not self.graph or len(self.graph.nodes()) < 2:
            return 0

        words = list(self.graph.nodes())
        semantic_edges = semantic_analyzer.get_semantic_edges(words, threshold)

        added = 0
        for edge in semantic_edges:
            word1, word2 = edge['from'], edge['to']
            similarity = edge['similarity']
            weight = int(similarity * weight_multiplier)

            if self.graph.has_edge(word1, word2):
                # Merge with existing co-occurrence edge
                current_weight = self.graph[word1][word2].get('weight', 0)
                self.graph[word1][word2]['weight'] = current_weight + weight
                self.graph[word1][word2]['semantic_similarity'] = similarity
            else:
                # Add new semantic-only edge
                self.graph.add_edge(
                    word1, word2,
                    weight=weight,
                    semantic_similarity=similarity,
                    edge_type='semantic'
                )
                # Also track in edges dict
                pair = tuple(sorted([word1, word2]))
                self.edges[pair] = self.edges.get(pair, 0) + weight
                added += 1

        return added

    def get_edges_list(self, include_semantic: bool = True) -> List[Dict]:
        """
        Get list of edges with weights.

        Args:
            include_semantic: Whether to include semantic similarity info

        Returns:
            List of edge dictionaries
        """
        edges = []
        for (word1, word2), weight in self.edges.items():
            edge_data = {
                'from': word1,
                'to': word2,
                'weight': weight
            }

            # Add semantic info if available
            if include_semantic and self.graph and self.graph.has_edge(word1, word2):
                edge_attrs = self.graph[word1][word2]
                if 'semantic_similarity' in edge_attrs:
                    edge_data['semantic_similarity'] = edge_attrs['semantic_similarity']
                if 'edge_type' in edge_attrs:
                    edge_data['edge_type'] = edge_attrs['edge_type']

            edges.append(edge_data)
        return edges
