"""
In-memory async cache with TTL (per process).
Cache-ready abstraction — easy to swap for Redis later.
"""
import asyncio
import time
from typing import Any, Callable, Awaitable, Optional


class TTLCache:
    def __init__(self, default_ttl: int = 60):
        self._store: dict[str, tuple[float, Any]] = {}
        self._locks: dict[str, asyncio.Lock] = {}
        self._default_ttl = default_ttl

    def _get(self, key: str) -> Optional[Any]:
        item = self._store.get(key)
        if item is None:
            return None
        expires_at, value = item
        if expires_at < time.time():
            self._store.pop(key, None)
            return None
        return value

    async def get_or_set(
        self,
        key: str,
        loader: Callable[[], Awaitable[Any]],
        ttl: Optional[int] = None,
    ) -> Any:
        cached = self._get(key)
        if cached is not None:
            return cached

        lock = self._locks.setdefault(key, asyncio.Lock())
        async with lock:
            # double-check after acquiring lock
            cached = self._get(key)
            if cached is not None:
                return cached

            value = await loader()
            ttl_s = ttl if ttl is not None else self._default_ttl
            self._store[key] = (time.time() + ttl_s, value)
            return value

    def invalidate(self, key: str) -> None:
        self._store.pop(key, None)

    def clear_prefix(self, prefix: str) -> int:
        keys = [k for k in self._store if k.startswith(prefix)]
        for k in keys:
            self._store.pop(k, None)
        return len(keys)

    def clear(self) -> None:
        self._store.clear()


# Module singleton — content cache for corporate reads
content_cache = TTLCache(default_ttl=60)
