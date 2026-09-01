"""NeuroMove Bounded Analysis Result Cache.

Provides an LRU cache keyed by analysis parameters to prevent redundant MNE computations.
"""

from __future__ import annotations

import collections
import threading
from typing import Any


class AnalysisLRUCache:
    """Thread-safe bounded in-memory LRU cache."""

    def __init__(self, maxsize: int = 64) -> None:
        self.maxsize = maxsize
        self._cache: collections.OrderedDict[str, Any] = collections.OrderedDict()
        self._lock = threading.Lock()

    def get(self, key: str) -> Any | None:
        with self._lock:
            if key not in self._cache:
                return None
            self._cache.move_to_end(key)
            return self._cache[key]

    def set(self, key: str, value: Any) -> None:
        with self._lock:
            if key in self._cache:
                self._cache.move_to_end(key)
            self._cache[key] = value
            if len(self._cache) > self.maxsize:
                self._cache.popitem(last=False)

    def clear(self) -> None:
        with self._lock:
            self._cache.clear()

    def size(self) -> int:
        with self._lock:
            return len(self._cache)


analysis_cache = AnalysisLRUCache(maxsize=64)
