"""
Text processing module for cleaning and tokenizing text data.
"""

import re
from typing import List, Dict, Set, Optional
from collections import Counter
import nltk
from nltk.corpus import stopwords

# Download required NLTK data
try:
    nltk.data.find('corpora/stopwords')
except LookupError:
    nltk.download('stopwords', quiet=True)


class TextProcessor:
    """Processes text data for semantic network analysis."""
    
    # Default English stopwords
    DEFAULT_STOPWORDS = {
        'a', 'about', 'above', 'after', 'again', 'against', 'all', 'am', 'an', 'and',
        'any', 'are', 'as', 'at', 'be', 'because', 'been', 'before', 'being', 'below',
        'between', 'both', 'but', 'by', 'can', 'cannot', 'could', 'did', 'do', 'does',
        'doing', 'down', 'during', 'each', 'few', 'for', 'from', 'further', 'had',
        'has', 'have', 'having', 'he', 'her', 'here', 'hers', 'herself', 'him',
        'himself', 'his', 'how', 'i', 'if', 'in', 'into', 'is', 'it', 'its', 'itself',
        'just', 'me', 'might', 'more', 'most', 'must', 'my', 'myself', 'no', 'nor',
        'not', 'now', 'of', 'off', 'on', 'once', 'only', 'or', 'other', 'our', 'ours',
        'ourselves', 'out', 'over', 'own', 'same', 'she', 'should', 'so', 'some',
        'such', 'than', 'that', 'the', 'their', 'theirs', 'them', 'themselves', 'then',
        'there', 'these', 'they', 'this', 'those', 'through', 'to', 'too', 'under',
        'until', 'up', 'very', 'was', 'we', 'were', 'what', 'when', 'where', 'which',
        'while', 'who', 'whom', 'why', 'will', 'with', 'would', 'you', 'your', 'yours',
        'yourself', 'yourselves', 'also', 'etc'
    }
    
    def __init__(
        self,
        stopwords: Optional[Set[str]] = None,
        delete_words: Optional[Set[str]] = None,
        word_mappings: Optional[Dict[str, str]] = None,
        min_word_length: int = 2,
        unify_plurals: bool = True
    ):
        """
        Initialize the text processor.
        
        Args:
            stopwords: Set of stopwords to remove
            delete_words: Additional words to remove
            word_mappings: Dictionary mapping words to unified forms
            min_word_length: Minimum word length to keep
            unify_plurals: Whether to automatically unify plural forms
        """
        self.stopwords = stopwords or self.DEFAULT_STOPWORDS.copy()
        self.delete_words = delete_words or set()
        self.word_mappings = word_mappings or {}
        self.min_word_length = min_word_length
        self.unify_plurals = unify_plurals
    
    def clean_word(self, word: str) -> str:
        """Clean a single word."""
        word = word.lower().strip()
        word = re.sub(r'[^\w\s]', '', word)
        return word
    
    def get_singular(self, word: str) -> str:
        """
        Get the singular form of a word.
        Simple rule-based approach for common English plurals.
        """
        if not self.unify_plurals:
            return word
            
        # Common plural patterns
        if word.endswith('ies') and len(word) > 4:
            return word[:-3] + 'y'
        elif word.endswith('es') and len(word) > 3:
            base = word[:-2]
            if base.endswith(('s', 'x', 'z', 'ch', 'sh')):
                return base
            return word[:-1]  # Try just removing 's'
        elif word.endswith('s') and len(word) > 2 and not word.endswith('ss'):
            return word[:-1]
        return word
    
    def process_word(self, word: str) -> Optional[str]:
        """
        Process a single word through all transformations.

        Returns:
            Processed word or None if it should be filtered out
        """
        # Clean
        word = self.clean_word(word)

        # Check length
        if len(word) < self.min_word_length:
            return None

        # Check stopwords and delete words (pre-transformation)
        if word in self.stopwords or word in self.delete_words:
            return None

        # Apply mappings
        if word in self.word_mappings:
            word = self.word_mappings[word]

        # Unify plurals
        if self.unify_plurals:
            singular = self.get_singular(word)
            if singular != word and len(singular) >= self.min_word_length:
                word = singular

        # Check delete words again after transformations
        # (catches cases where user deletes the unified/mapped form)
        if word in self.delete_words:
            return None

        return word
    
    def process_text(self, text: str) -> List[str]:
        """
        Process a text string into a list of cleaned words.
        
        Args:
            text: Input text string
            
        Returns:
            List of processed words
        """
        if not text or not isinstance(text, str):
            return []
        
        words = []
        for token in text.split():
            processed = self.process_word(token)
            if processed:
                words.append(processed)
        
        return words
    
    def process_texts(self, texts: List[str]) -> Dict[str, any]:
        """
        Process multiple texts and return word statistics.
        
        Args:
            texts: List of text strings
            
        Returns:
            Dictionary with word counts and processed texts
        """
        all_words = []
        processed_texts = []
        
        for text in texts:
            words = self.process_text(text)
            all_words.extend(words)
            processed_texts.append(words)
        
        word_counts = Counter(all_words)
        
        return {
            'word_counts': dict(word_counts),
            'processed_texts': processed_texts,
            'total_words': len(all_words),
            'unique_words': len(word_counts)
        }
    
    def add_mapping(self, source: str, target: str):
        """Add a word mapping."""
        self.word_mappings[source.lower()] = target.lower()
    
    def add_mappings(self, mappings: Dict[str, str]):
        """Add multiple word mappings."""
        for source, target in mappings.items():
            self.add_mapping(source, target)
    
    def add_delete_word(self, word: str):
        """Add a word to the delete list."""
        self.delete_words.add(word.lower())
    
    def add_delete_words(self, words: List[str]):
        """Add multiple words to the delete list."""
        for word in words:
            self.add_delete_word(word)
