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
    
    def detect_clusters(self, method: str = 'louvain', n_clusters: int = 5) -> Dict[str, int]:
        """
        Detect clusters/communities in the network.
        
        Args:
            method: Clustering method ('louvain', 'spectral', 'modularity')
            n_clusters: Number of clusters for spectral clustering
            
        Returns:
            Dictionary mapping nodes to cluster IDs
        """
        if not self.graph or len(self.graph.nodes()) == 0:
            return {}
        
        if method == 'louvain':
            try:
                partition = community_louvain.best_partition(self.graph, weight='weight')
                return partition
            except Exception:
                return {node: 0 for node in self.graph.nodes()}
        
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
                return {nodes[i]: int(labels[i]) for i in range(len(nodes))}
            except Exception:
                return {node: 0 for node in self.graph.nodes()}
        
        else:
            return {node: 0 for node in self.graph.nodes()}
    
    def get_network_stats(self) -> Dict[str, any]:
        """
        Get basic network statistics.
        
        Returns:
            Dictionary of network statistics
        """
        if not self.graph:
            return {}
        
        return {
            'num_nodes': self.graph.number_of_nodes(),
            'num_edges': self.graph.number_of_edges(),
            'density': nx.density(self.graph),
            'avg_degree': sum(dict(self.graph.degree()).values()) / self.graph.number_of_nodes() if self.graph.number_of_nodes() > 0 else 0,
            'num_components': nx.number_connected_components(self.graph)
        }
    
    def get_edges_list(self) -> List[Dict]:
        """
        Get list of edges with weights.
        
        Returns:
            List of edge dictionaries
        """
        edges = []
        for (word1, word2), weight in self.edges.items():
            edges.append({
                'from': word1,
                'to': word2,
                'weight': weight
            })
        return edges
    
    def get_nodes_data(self, metrics: Dict[str, Dict], clusters: Dict[str, int]) -> List[Dict]:
        """
        Get list of nodes with all data.
        
        Args:
            metrics: Centrality metrics dictionary
            clusters: Cluster assignments dictionary
            
        Returns:
            List of node dictionaries
        """
        max_count = max(self.word_counts.values()) if self.word_counts else 1
        
        nodes = []
        for word, count in self.word_counts.items():
            node_metrics = metrics.get(word, {})
            nodes.append({
                'word': word,
                'count': count,
                'normalized': round((count / max_count) * 100, 2),
                'cluster': clusters.get(word, -1),
                'degree': node_metrics.get('degree', 0),
                'strength': node_metrics.get('strength', 0),
                'betweenness': round(node_metrics.get('betweenness', 0), 3),
                'closeness': round(node_metrics.get('closeness', 0), 3),
                'eigenvector': round(node_metrics.get('eigenvector', 0), 3)
            })
        
        # Sort by normalized score
        nodes.sort(key=lambda x: x['normalized'], reverse=True)
        
        return nodes
