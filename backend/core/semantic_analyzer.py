"""
Semantic analysis module using Sentence-Transformers for word embeddings.
"""

from typing import List, Dict, Tuple, Optional, Set
import numpy as np
from functools import lru_cache

from .config import settings


class SemanticAnalyzer:
    """
    Analyzes semantic similarity between words using sentence-transformers embeddings.
    Uses singleton pattern to load model only once.
    """

    _instance = None
    _model = None

    def __new__(cls):
        if cls._instance is None:
            cls._instance = super().__new__(cls)
        return cls._instance

    def __init__(self):
        if SemanticAnalyzer._model is None:
            self._load_model()

    def _load_model(self):
        """Load the sentence-transformers model."""
        import os
        from sentence_transformers import SentenceTransformer

        print(f"Loading embedding model: {settings.EMBEDDING_MODEL}")

        # Try to load from local cache first (faster, no network)
        cache_dir = os.path.expanduser("~/.cache/torch/sentence_transformers")
        model_path = os.path.join(cache_dir, f"sentence-transformers_{settings.EMBEDDING_MODEL}")

        try:
            if os.path.exists(model_path):
                print("Loading model from local cache...")
                SemanticAnalyzer._model = SentenceTransformer(model_path)
            else:
                print("Downloading model (first time only)...")
                SemanticAnalyzer._model = SentenceTransformer(settings.EMBEDDING_MODEL)
        except Exception as e:
            print(f"Cache load failed, downloading: {e}")
            SemanticAnalyzer._model = SentenceTransformer(settings.EMBEDDING_MODEL)

        print("Embedding model loaded successfully")

    @property
    def model(self):
        """Get the loaded model."""
        if SemanticAnalyzer._model is None:
            self._load_model()
        return SemanticAnalyzer._model

    def get_embeddings(self, words: List[str], batch_size: Optional[int] = None) -> np.ndarray:
        """
        Get embeddings for a list of words.

        Args:
            words: List of words to embed
            batch_size: Batch size for encoding (default from settings)

        Returns:
            NumPy array of embeddings (n_words x embedding_dim)
        """
        if not words:
            return np.array([])

        batch_size = batch_size or settings.EMBEDDING_BATCH_SIZE

        embeddings = self.model.encode(
            words,
            batch_size=batch_size,
            show_progress_bar=False,
            convert_to_numpy=True,
            normalize_embeddings=True  # For faster cosine similarity
        )

        return embeddings

    def calculate_similarity_matrix(self, words: List[str]) -> Tuple[np.ndarray, List[str]]:
        """
        Calculate pairwise cosine similarity matrix for words.

        Args:
            words: List of words

        Returns:
            Tuple of (similarity matrix, word list)
        """
        if not words:
            return np.array([[]]), []

        embeddings = self.get_embeddings(words)

        # Since embeddings are normalized, cosine similarity = dot product
        similarity_matrix = np.dot(embeddings, embeddings.T)

        return similarity_matrix, words

    def get_semantic_edges(
        self,
        words: List[str],
        threshold: Optional[float] = None
    ) -> List[Dict]:
        """
        Get edges based on semantic similarity between words.

        Args:
            words: List of words to analyze
            threshold: Minimum similarity to create an edge (0-1)

        Returns:
            List of edge dictionaries with 'from', 'to', 'similarity'
        """
        if not words or len(words) < 2:
            return []

        threshold = threshold or settings.SIMILARITY_THRESHOLD
        similarity_matrix, word_list = self.calculate_similarity_matrix(words)

        edges = []
        n = len(word_list)

        # Only iterate upper triangle (avoid duplicates and self-loops)
        for i in range(n):
            for j in range(i + 1, n):
                sim = similarity_matrix[i, j]
                if sim >= threshold:
                    edges.append({
                        'from': word_list[i],
                        'to': word_list[j],
                        'similarity': round(float(sim), 4),
                        'type': 'semantic'
                    })

        return edges

    def find_semantic_clusters(
        self,
        words: List[str],
        threshold: Optional[float] = None,
        min_cluster_size: int = 2
    ) -> Dict[str, List[str]]:
        """
        Find clusters of semantically similar words using agglomerative approach.

        Args:
            words: List of words to cluster
            threshold: Similarity threshold for clustering
            min_cluster_size: Minimum words per cluster

        Returns:
            Dictionary mapping cluster label to list of words
        """
        if not words or len(words) < 2:
            return {}

        threshold = threshold or settings.SIMILARITY_THRESHOLD

        from sklearn.cluster import AgglomerativeClustering

        embeddings = self.get_embeddings(words)

        # Use agglomerative clustering with cosine affinity
        clustering = AgglomerativeClustering(
            n_clusters=None,
            distance_threshold=1 - threshold,  # Convert similarity to distance
            metric='cosine',
            linkage='average'
        )

        labels = clustering.fit_predict(embeddings)

        # Group words by cluster
        clusters = {}
        for word, label in zip(words, labels):
            label_str = f"cluster_{label}"
            if label_str not in clusters:
                clusters[label_str] = []
            clusters[label_str].append(word)

        # Filter by minimum size
        clusters = {k: v for k, v in clusters.items() if len(v) >= min_cluster_size}

        return clusters

    def get_similar_words(
        self,
        target_word: str,
        candidate_words: List[str],
        threshold: Optional[float] = None,
        top_k: Optional[int] = None
    ) -> List[Tuple[str, float]]:
        """
        Find words similar to a target word.

        Args:
            target_word: Word to find similar words for
            candidate_words: Pool of candidate words
            threshold: Minimum similarity
            top_k: Return only top k results

        Returns:
            List of (word, similarity) tuples sorted by similarity
        """
        if not candidate_words:
            return []

        threshold = threshold or settings.SIMILARITY_THRESHOLD

        # Get embeddings
        all_words = [target_word] + candidate_words
        embeddings = self.get_embeddings(all_words)

        target_embedding = embeddings[0:1]
        candidate_embeddings = embeddings[1:]

        # Calculate similarities
        similarities = np.dot(candidate_embeddings, target_embedding.T).flatten()

        # Filter and sort
        results = []
        for word, sim in zip(candidate_words, similarities):
            if sim >= threshold and word != target_word:
                results.append((word, round(float(sim), 4)))

        results.sort(key=lambda x: x[1], reverse=True)

        if top_k:
            results = results[:top_k]

        return results


# Global instance for reuse
_semantic_analyzer: Optional[SemanticAnalyzer] = None


def get_semantic_analyzer() -> SemanticAnalyzer:
    """Get or create the global SemanticAnalyzer instance."""
    global _semantic_analyzer
    if _semantic_analyzer is None:
        _semantic_analyzer = SemanticAnalyzer()
    return _semantic_analyzer


def preload_model():
    """Preload the embedding model at startup."""
    get_semantic_analyzer()
