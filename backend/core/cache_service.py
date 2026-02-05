"""
Cache service for analysis results.
Uses TTL-based in-memory cache keyed by file content hash + config.
"""

import hashlib
import json
from typing import Any, Optional

from cachetools import TTLCache

# In-memory cache: max 100 entries, 1 hour TTL
_cache: TTLCache = TTLCache(maxsize=100, ttl=3600)


def _make_key(file_hashes: list[str], config: dict) -> str:
    """Create a deterministic cache key from file hashes and config."""
    key_data = json.dumps({"files": sorted(file_hashes), "config": config}, sort_keys=True)
    return hashlib.sha256(key_data.encode()).hexdigest()


def hash_content(content: bytes) -> str:
    """Hash file content for cache key generation."""
    return hashlib.sha256(content).hexdigest()


def get_cached(file_hashes: list[str], config: dict) -> Optional[Any]:
    """Look up a cached result. Returns None on miss."""
    key = _make_key(file_hashes, config)
    return _cache.get(key)


def set_cached(file_hashes: list[str], config: dict, result: Any) -> None:
    """Store a result in the cache."""
    key = _make_key(file_hashes, config)
    _cache[key] = result
