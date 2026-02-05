"""
Multi-group analysis module for analyzing and comparing networks across 1-N groups.
"""

from typing import List, Dict, Tuple, Optional, Set
from collections import defaultdict
import re

from .text_processor import TextProcessor
from .network_builder import NetworkBuilder


class MultiGroupAnalyzer:
    """Analyzes and compares semantic networks across multiple groups."""

    @staticmethod
    def _normalize_key(name: str) -> str:
        """Normalize group name for use as dictionary key."""
        return re.sub(r'\s+', '_', name.lower())

    def __init__(
        self,
        group_names: List[str],
        stopwords: Optional[Set[str]] = None,
        delete_words: Optional[Set[str]] = None,
        word_mappings: Optional[Dict[str, str]] = None,
        min_word_length: int = 2,
        unify_plurals: bool = True
    ):
        """
        Initialize the multi-group analyzer.

        Args:
            group_names: List of group names
            stopwords: Set of stopwords to remove
            delete_words: Additional words to remove
            word_mappings: Dictionary mapping words to unified forms
            min_word_length: Minimum word length to keep
            unify_plurals: Whether to automatically unify plural forms
        """
        self.group_names = group_names
        self.group_keys = [self._normalize_key(name) for name in group_names]
        self.num_groups = len(group_names)

        # Create shared processor for consistency
        self.processor = TextProcessor(
            stopwords=stopwords,
            delete_words=delete_words,
            word_mappings=word_mappings,
            min_word_length=min_word_length,
            unify_plurals=unify_plurals
        )

        # Create network builders for each group
        self.builders: List[NetworkBuilder] = [
            NetworkBuilder(self.processor) for _ in range(self.num_groups)
        ]

        # Results storage
        self.analysis_data = []
        self.combined_edges = []

    def add_word_mappings(self, mappings: Dict[str, str]):
        """Add word mappings to the processor."""
        self.processor.add_mappings(mappings)

    def add_delete_words(self, words: List[str]):
        """Add words to delete list."""
        self.processor.add_delete_words(words)

    def analyze(
        self,
        texts_list: List[List[str]],
        min_frequency: int = 1,
        min_score_threshold: float = 2.0,
        per_group_thresholds: List[float] = None,
        cluster_method: str = 'louvain'
    ) -> Dict:
        """
        Analyze multiple groups of texts.

        Args:
            texts_list: List of text lists, one per group
            min_frequency: Minimum word frequency
            min_score_threshold: Global minimum normalized score (%) fallback
            per_group_thresholds: Per-group minimum scores; if provided, overrides global
            cluster_method: Clustering method

        Returns:
            Dictionary with analysis results
        """
        if len(texts_list) != self.num_groups:
            raise ValueError(f"Expected {self.num_groups} text lists, got {len(texts_list)}")

        # Build per-group thresholds list (fallback to global)
        thresholds = per_group_thresholds if per_group_thresholds and len(per_group_thresholds) == self.num_groups \
            else [min_score_threshold] * self.num_groups

        # Build networks for each group
        for i, texts in enumerate(texts_list):
            self.builders[i].build_network(texts, min_frequency=min_frequency)

        # Calculate metrics and clusters for each group
        all_metrics = []
        all_clusters = []
        all_advanced = []
        for builder in self.builders:
            metrics = builder.calculate_centrality_metrics()
            clusters = builder.detect_clusters(method=cluster_method)
            advanced = builder.calculate_advanced_metrics()
            all_metrics.append(metrics)
            all_clusters.append(clusters)
            all_advanced.append(advanced)

        # Get all words from all groups
        all_words = set()
        for builder in self.builders:
            all_words.update(builder.word_counts.keys())

        # Calculate max counts for normalization
        max_counts = []
        for builder in self.builders:
            max_count = max(builder.word_counts.values()) if builder.word_counts else 1
            max_counts.append(max_count)

        # Build analysis data
        self.analysis_data = []

        for word in all_words:
            # Get counts and normalized values for each group
            counts = []
            norms = []
            for i, builder in enumerate(self.builders):
                count = builder.word_counts.get(word, 0)
                norm = round((count / max_counts[i]) * 100, 2) if count > 0 else 0
                counts.append(count)
                norms.append(norm)

            # Check threshold - include if any group meets its threshold
            if all(norms[i] < thresholds[i] for i in range(self.num_groups)):
                continue

            # Build data row with dynamic keys
            row = {'word': word}

            # Add per-group data
            for i, key in enumerate(self.group_keys):
                row[f'{key}_count'] = counts[i]
                row[f'{key}_normalized'] = norms[i]
                row[f'{key}_cluster'] = all_clusters[i].get(word, -1)

                m = all_metrics[i].get(word, {})
                row[f'{key}_degree'] = m.get('degree', 0)
                row[f'{key}_strength'] = m.get('strength', 0)
                row[f'{key}_betweenness'] = round(m.get('betweenness', 0), 3)
                row[f'{key}_closeness'] = round(m.get('closeness', 0), 3)
                row[f'{key}_eigenvector'] = round(m.get('eigenvector', 0), 3)

                adv = all_advanced[i].get(word, {})
                row[f'{key}_pagerank'] = adv.get('pagerank', 0)
                row[f'{key}_harmonic'] = adv.get('harmonic', 0)
                row[f'{key}_kcore'] = adv.get('kcore', 0)
                row[f'{key}_constraint'] = adv.get('constraint', 0)

            # Add computed fields
            row['avg_normalized'] = round(sum(norms) / len(norms), 2)
            row['in_all'] = all(c > 0 for c in counts)
            row['group_count'] = sum(1 for c in counts if c > 0)

            # For 2 groups, add difference for backwards compatibility
            if self.num_groups == 2:
                row['difference'] = round(norms[0] - norms[1], 2)

            self.analysis_data.append(row)

        # Sort by average normalized
        self.analysis_data.sort(key=lambda x: x['avg_normalized'], reverse=True)

        # Combine edges from all networks
        combined_edges = defaultdict(int)
        for builder in self.builders:
            for (w1, w2), weight in builder.edges.items():
                combined_edges[(w1, w2)] += weight

        # Filter edges to only include words in analysis
        valid_words = set(item['word'] for item in self.analysis_data)
        self.combined_edges = [
            {'from': w1, 'to': w2, 'weight': weight}
            for (w1, w2), weight in combined_edges.items()
            if w1 in valid_words and w2 in valid_words
        ]

        # Build stats
        stats = {
            'total_words': len(self.analysis_data),
            'words_in_all': len([d for d in self.analysis_data if d['in_all']]),
            'total_edges': len(self.combined_edges),
        }

        # Per-group stats
        for i, key in enumerate(self.group_keys):
            stats[f'{key}_total'] = len([d for d in self.analysis_data if d[f'{key}_count'] > 0])
            stats[f'{key}_clusters'] = len(set(all_clusters[i].values()))

            # Per-group network stats
            group_stats = self.builders[i].get_network_stats()
            stats[f'{key}_density'] = group_stats.get('density', 0)
            stats[f'{key}_modularity'] = group_stats.get('modularity', 0)
            stats[f'{key}_clustering_coefficient'] = group_stats.get('clustering_coefficient', 0)
            stats[f'{key}_avg_path_length'] = group_stats.get('avg_path_length', 0)
            stats[f'{key}_diameter'] = group_stats.get('diameter', 0)

            # Per-group structural stats
            structural = self.builders[i].get_structural_stats()
            stats[f'{key}_num_bridges'] = structural.get('num_bridges', 0)
            stats[f'{key}_num_articulation_points'] = structural.get('num_articulation_points', 0)
            stats[f'{key}_assortativity'] = structural.get('assortativity', 0)
            stats[f'{key}_articulation_points'] = structural.get('articulation_points', [])

        return {
            'analysis_data': self.analysis_data,
            'edges': self.combined_edges,
            'stats': stats,
            'group_names': self.group_names,
            'group_keys': self.group_keys,
            'num_groups': self.num_groups
        }

    def get_single_group_result(self, group_index: int = 0) -> Dict:
        """
        Get results for a single group (no comparison).

        Args:
            group_index: Index of the group

        Returns:
            Dictionary with single group results
        """
        if group_index >= self.num_groups:
            raise ValueError(f"Group index {group_index} out of range")

        builder = self.builders[group_index]
        key = self.group_keys[group_index]
        name = self.group_names[group_index]

        metrics = builder.calculate_centrality_metrics()
        clusters = builder.detect_clusters()

        nodes = builder.get_nodes_data(metrics, clusters)
        edges = builder.get_edges_list()
        stats = builder.get_network_stats()

        return {
            'nodes': nodes,
            'edges': edges,
            'stats': stats,
            'group_name': name,
            'group_key': key
        }
