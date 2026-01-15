"""
Comparison analysis module for comparing networks between groups.
"""

from typing import List, Dict, Tuple, Optional, Set
from collections import defaultdict

from .text_processor import TextProcessor
from .network_builder import NetworkBuilder


class ComparisonAnalyzer:
    """Analyzes and compares semantic networks between two groups."""
    
    def __init__(
        self,
        group_a_name: str = "Group A",
        group_b_name: str = "Group B",
        stopwords: Optional[Set[str]] = None,
        delete_words: Optional[Set[str]] = None,
        word_mappings: Optional[Dict[str, str]] = None,
        min_word_length: int = 2,
        unify_plurals: bool = True
    ):
        """
        Initialize the comparison analyzer.
        
        Args:
            group_a_name: Name for group A
            group_b_name: Name for group B
            stopwords: Set of stopwords to remove
            delete_words: Additional words to remove
            word_mappings: Dictionary mapping words to unified forms
            min_word_length: Minimum word length to keep
            unify_plurals: Whether to automatically unify plural forms
        """
        self.group_a_name = group_a_name
        self.group_b_name = group_b_name
        
        # Create shared processor for consistency
        self.processor = TextProcessor(
            stopwords=stopwords,
            delete_words=delete_words,
            word_mappings=word_mappings,
            min_word_length=min_word_length,
            unify_plurals=unify_plurals
        )
        
        # Create network builders with shared processor
        self.builder_a = NetworkBuilder(self.processor)
        self.builder_b = NetworkBuilder(self.processor)
        
        # Results storage
        self.comparison_data = []
        self.combined_edges = []
    
    def add_word_mappings(self, mappings: Dict[str, str]):
        """Add word mappings to the processor."""
        self.processor.add_mappings(mappings)
    
    def add_delete_words(self, words: List[str]):
        """Add words to delete list."""
        self.processor.add_delete_words(words)
    
    def analyze(
        self,
        texts_a: List[str],
        texts_b: List[str],
        min_frequency: int = 1,
        min_score_threshold: float = 2.0,
        cluster_method: str = 'louvain'
    ) -> Dict:
        """
        Analyze and compare two groups of texts.
        
        Args:
            texts_a: List of texts from group A
            texts_b: List of texts from group B
            min_frequency: Minimum word frequency
            min_score_threshold: Minimum normalized score (%) to include
            cluster_method: Clustering method
            
        Returns:
            Dictionary with comparison results
        """
        # Build networks
        self.builder_a.build_network(texts_a, min_frequency=min_frequency)
        self.builder_b.build_network(texts_b, min_frequency=min_frequency)
        
        # Calculate metrics
        metrics_a = self.builder_a.calculate_centrality_metrics()
        metrics_b = self.builder_b.calculate_centrality_metrics()
        
        # Detect clusters
        clusters_a = self.builder_a.detect_clusters(method=cluster_method)
        clusters_b = self.builder_b.detect_clusters(method=cluster_method)
        
        # Get all words from both groups
        all_words = set(self.builder_a.word_counts.keys()) | set(self.builder_b.word_counts.keys())
        
        # Calculate max counts for normalization
        max_a = max(self.builder_a.word_counts.values()) if self.builder_a.word_counts else 1
        max_b = max(self.builder_b.word_counts.values()) if self.builder_b.word_counts else 1
        
        # Build comparison data
        self.comparison_data = []
        
        for word in all_words:
            count_a = self.builder_a.word_counts.get(word, 0)
            count_b = self.builder_b.word_counts.get(word, 0)
            
            norm_a = round((count_a / max_a) * 100, 2) if count_a > 0 else 0
            norm_b = round((count_b / max_b) * 100, 2) if count_b > 0 else 0
            
            # Check threshold
            if norm_a < min_score_threshold and norm_b < min_score_threshold:
                continue
            
            # Get metrics
            m_a = metrics_a.get(word, {})
            m_b = metrics_b.get(word, {})
            
            self.comparison_data.append({
                'word': word,
                f'{self.group_a_name.lower()}_count': count_a,
                f'{self.group_b_name.lower()}_count': count_b,
                f'{self.group_a_name.lower()}_normalized': norm_a,
                f'{self.group_b_name.lower()}_normalized': norm_b,
                'difference': round(norm_a - norm_b, 2),
                'avg_normalized': round((norm_a + norm_b) / 2, 2),
                'in_both': count_a > 0 and count_b > 0,
                f'{self.group_a_name.lower()}_cluster': clusters_a.get(word, -1),
                f'{self.group_b_name.lower()}_cluster': clusters_b.get(word, -1),
                f'{self.group_a_name.lower()}_degree': m_a.get('degree', 0),
                f'{self.group_a_name.lower()}_strength': m_a.get('strength', 0),
                f'{self.group_a_name.lower()}_betweenness': round(m_a.get('betweenness', 0), 3),
                f'{self.group_a_name.lower()}_closeness': round(m_a.get('closeness', 0), 3),
                f'{self.group_a_name.lower()}_eigenvector': round(m_a.get('eigenvector', 0), 3),
                f'{self.group_b_name.lower()}_degree': m_b.get('degree', 0),
                f'{self.group_b_name.lower()}_strength': m_b.get('strength', 0),
                f'{self.group_b_name.lower()}_betweenness': round(m_b.get('betweenness', 0), 3),
                f'{self.group_b_name.lower()}_closeness': round(m_b.get('closeness', 0), 3),
                f'{self.group_b_name.lower()}_eigenvector': round(m_b.get('eigenvector', 0), 3),
            })
        
        # Sort by average normalized
        self.comparison_data.sort(key=lambda x: x['avg_normalized'], reverse=True)
        
        # Combine edges from both networks
        combined_edges = defaultdict(int)
        
        for (w1, w2), weight in self.builder_a.edges.items():
            combined_edges[(w1, w2)] += weight
        
        for (w1, w2), weight in self.builder_b.edges.items():
            combined_edges[(w1, w2)] += weight
        
        # Filter edges to only include words in comparison
        valid_words = set(item['word'] for item in self.comparison_data)
        
        self.combined_edges = [
            {'from': w1, 'to': w2, 'weight': weight}
            for (w1, w2), weight in combined_edges.items()
            if w1 in valid_words and w2 in valid_words
        ]
        
        return {
            'comparison_data': self.comparison_data,
            'edges': self.combined_edges,
            'stats': {
                'total_words': len(self.comparison_data),
                'words_in_both': len([d for d in self.comparison_data if d['in_both']]),
                f'{self.group_a_name.lower()}_only': len([d for d in self.comparison_data if d[f'{self.group_a_name.lower()}_count'] > 0 and d[f'{self.group_b_name.lower()}_count'] == 0]),
                f'{self.group_b_name.lower()}_only': len([d for d in self.comparison_data if d[f'{self.group_b_name.lower()}_count'] > 0 and d[f'{self.group_a_name.lower()}_count'] == 0]),
                'total_edges': len(self.combined_edges),
                f'{self.group_a_name.lower()}_clusters': len(set(clusters_a.values())),
                f'{self.group_b_name.lower()}_clusters': len(set(clusters_b.values())),
            },
            'group_a_name': self.group_a_name,
            'group_b_name': self.group_b_name
        }
    
    def get_word_pairs(
        self,
        texts_a: List[str],
        texts_b: List[str]
    ) -> List[Dict]:
        """
        Get word pair co-occurrences for both groups.
        
        Args:
            texts_a: Texts from group A
            texts_b: Texts from group B
            
        Returns:
            List of word pair data with connections per group
        """
        from itertools import combinations
        
        # Process texts and build edges for each group
        result_a = self.processor.process_texts(texts_a)
        result_b = self.processor.process_texts(texts_b)
        
        edges_a = defaultdict(int)
        edges_b = defaultdict(int)
        
        for words in result_a['processed_texts']:
            for pair in combinations(sorted(set(words)), 2):
                edges_a[pair] += 1
        
        for words in result_b['processed_texts']:
            for pair in combinations(sorted(set(words)), 2):
                edges_b[pair] += 1
        
        # Combine
        all_pairs = set(edges_a.keys()) | set(edges_b.keys())
        
        pairs_data = []
        for pair in all_pairs:
            conn_a = edges_a.get(pair, 0)
            conn_b = edges_b.get(pair, 0)
            total = conn_a + conn_b
            
            pairs_data.append({
                'word_1': pair[0],
                'word_2': pair[1],
                f'{self.group_a_name.lower()}_connections': conn_a,
                f'{self.group_b_name.lower()}_connections': conn_b,
                'total_connections': total
            })
        
        # Sort by total
        pairs_data.sort(key=lambda x: x['total_connections'], reverse=True)
        
        # Normalize
        max_a = max((p[f'{self.group_a_name.lower()}_connections'] for p in pairs_data), default=1)
        max_b = max((p[f'{self.group_b_name.lower()}_connections'] for p in pairs_data), default=1)
        max_total = max((p['total_connections'] for p in pairs_data), default=1)
        
        for p in pairs_data:
            p[f'{self.group_a_name.lower()}_normalized'] = round((p[f'{self.group_a_name.lower()}_connections'] / max_a) * 100, 2)
            p[f'{self.group_b_name.lower()}_normalized'] = round((p[f'{self.group_b_name.lower()}_connections'] / max_b) * 100, 2)
            p['total_normalized'] = round((p['total_connections'] / max_total) * 100, 2)
            p['difference'] = round(p[f'{self.group_a_name.lower()}_normalized'] - p[f'{self.group_b_name.lower()}_normalized'], 2)
        
        return pairs_data
