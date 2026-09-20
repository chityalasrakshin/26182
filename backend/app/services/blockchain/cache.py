"""
Blockchain Rate-Limit-Aware Caching & Request Throttling Layer.

Provides dual-engine caching:
1. Redis backend (redis.asyncio) if available.
2. In-memory TTL cache fallback if Redis is offline or not installed.

Also provides per-provider token-bucket / throttle rate limiting to avoid
hitting free-tier blockchain explorer API quotas.
"""

import time
import json
import logging
import asyncio
from typing import Dict, Any, Optional, List, Callable
from functools import wraps

from backend.app.core.config import settings
from backend.app.schemas.analysis import NormalizedTransaction

logger = logging.getLogger(__name__)

try:
    import redis.asyncio as aioredis
    REDIS_AVAILABLE = True
except ImportError:
    REDIS_AVAILABLE = False
    logger.info("redis python package not available; using in-memory cache exclusively.")


class InMemoryTTLCache:
    """Thread-safe and async-safe in-memory cache with expiration timestamps."""

    def __init__(self, default_ttl: int = 3600):
        self._cache: Dict[str, Any] = {}
        self._expiry: Dict[str, float] = {}
        self.default_ttl = default_ttl
        self._lock = asyncio.Lock()

    async def get(self, key: str) -> Optional[Any]:
        async with self._lock:
            if key not in self._cache:
                return None
            if time.time() > self._expiry.get(key, 0):
                self._cache.pop(key, None)
                self._expiry.pop(key, None)
                return None
            return self._cache[key]

    async def set(self, key: str, value: Any, ttl: Optional[int] = None):
        async with self._lock:
            self._cache[key] = value
            self._expiry[key] = time.time() + (ttl or self.default_ttl)

    async def clear(self):
        async with self._lock:
            self._cache.clear()
            self._expiry.clear()

    def size(self) -> int:
        return len(self._cache)


class RateLimiter:
    """
    Per-provider request throttling to respect API rate limits.
    Prevents 429 HTTP errors on free-tier APIs (e.g. 5 req/sec on Etherscan).
    """

    def __init__(self, default_delay: float = 0.25):
        self.default_delay = default_delay
        self._last_call: Dict[str, float] = {}
        self._locks: Dict[str, asyncio.Lock] = {}

    def _get_lock(self, key: str) -> asyncio.Lock:
        if key not in self._locks:
            self._locks[key] = asyncio.Lock()
        return self._locks[key]

    async def throttle(self, provider_name: str, delay: Optional[float] = None):
        lock = self._get_lock(provider_name)
        async with lock:
            required_delay = delay if delay is not None else self.default_delay
            last = self._last_call.get(provider_name, 0.0)
            now = time.time()
            elapsed = now - last
            if elapsed < required_delay:
                wait_time = required_delay - elapsed
                await asyncio.sleep(wait_time)
            self._last_call[provider_name] = time.time()


class BlockchainCache:
    """
    Unified caching interface supporting Redis with automatic in-memory and disk fallback.
    Caches normalized blockchain activity and serialized transaction records.
    Provides offline demo pre-warming to protect live evaluation from rate limits.
    """

    def __init__(self, redis_url: Optional[str] = None, disk_cache_dir: Optional[Any] = None):
        from pathlib import Path
        from backend.app.core.config import BASE_DIR
        self.redis_url = redis_url or settings.REDIS_URL
        self._redis = None
        self._in_memory = InMemoryTTLCache(default_ttl=86400)
        self._rate_limiter = RateLimiter(default_delay=settings.RATE_LIMIT_DELAY_SECONDS)
        self._connected = False
        self._tried_connect = False
        self._disk_cache_dir = Path(disk_cache_dir) if disk_cache_dir else (BASE_DIR / "data" / "cache" / "transactions")
        self._prewarmed_addresses: Set[str] = set()

    async def _ensure_connection(self):
        if self._tried_connect:
            return
        self._tried_connect = True

        if not REDIS_AVAILABLE:
            logger.info("Using in-memory blockchain cache (redis library not loaded).")
            return

        try:
            client = aioredis.from_url(
                self.redis_url,
                encoding="utf-8",
                decode_responses=True,
                socket_connect_timeout=1.5
            )
            await client.ping()
            self._redis = client
            self._connected = True
            logger.info(f"Connected to Redis cache at {self.redis_url}")
        except Exception as e:
            logger.info(f"Redis cache unavailable at {self.redis_url} ({e}); falling back to in-memory TTL cache.")
            self._connected = False

    @property
    def rate_limiter(self) -> RateLimiter:
        return self._rate_limiter

    @staticmethod
    def build_cache_key(chain: str, address: str, method: str, **kwargs) -> str:
        chain_lower = chain.strip().lower()
        addr = address.strip() if chain_lower == "solana" else address.strip().lower()
        parts = [f"chain:{chain_lower}", f"addr:{addr}", f"op:{method}"]
        for k in sorted(kwargs.keys()):
            v = kwargs[k]
            if v is not None:
                parts.append(f"{k}:{v}")
        return ":".join(parts)

    async def get_transactions(self, key: str) -> Optional[List[NormalizedTransaction]]:
        await self._ensure_connection()
        raw_json = None
        if self._connected and self._redis:
            try:
                raw_json = await self._redis.get(key)
            except Exception as e:
                logger.warning(f"Redis GET failed for {key}: {e}")
                self._connected = False

        if raw_json is None:
            raw_json = await self._in_memory.get(key)

        # 3. Disk cache fallback for pre-warmed offline/benchmark transaction datasets
        if raw_json is None and self._disk_cache_dir and self._disk_cache_dir.exists():
            try:
                # Key format: chain:<chain>:addr:<addr>:op:<method>
                parts = dict(p.split(":", 1) for p in key.split(":") if ":" in p)
                chain_val = parts.get("chain", "").lower()
                addr_val = parts.get("addr", "").lower()
                if chain_val and addr_val:
                    pattern = f"{chain_val}_{addr_val}*.json"
                    matches = list(self._disk_cache_dir.glob(pattern))
                    if matches:
                        with open(matches[0], "r", encoding="utf-8") as f:
                            raw_disk_data = json.load(f)
                        if isinstance(raw_disk_data, list):
                            raw_json = raw_disk_data
                            # Cache in memory for subsequent instant accesses
                            await self._in_memory.set(key, raw_json)
            except Exception as disk_err:
                logger.debug(f"Disk cache read skipped for {key}: {disk_err}")

        if raw_json is not None:
            try:
                data = json.loads(raw_json) if isinstance(raw_json, str) else raw_json
                tx_list = []
                for item in data:
                    tx_list.append(NormalizedTransaction.model_validate(item))
                return tx_list
            except Exception as e:
                logger.error(f"Failed to deserialize cached transactions for {key}: {e}")

        return None

    async def set_transactions(
        self,
        key: str,
        txs: List[NormalizedTransaction],
        ttl: int = 86400
    ):
        await self._ensure_connection()
        try:
            serialized = json.dumps([tx.model_dump(mode="json") for tx in txs])
        except Exception as e:
            logger.error(f"Failed to serialize transactions for caching: {e}")
            return

        if self._connected and self._redis:
            try:
                await self._redis.set(key, serialized, ex=ttl)
            except Exception as e:
                logger.warning(f"Redis SET failed for {key}: {e}")
                self._connected = False

        await self._in_memory.set(key, serialized, ttl=ttl)

    def is_cached(self, chain: str, address: str) -> bool:
        """Checks if any operations for this address are currently stored in memory cache."""
        chain_clean = chain.strip().lower()
        addr_clean = address.strip() if chain_clean == "solana" else address.strip().lower()
        prefix = f"chain:{chain_clean}:addr:{addr_clean}"
        for key in list(self._in_memory._cache.keys()):
            if key.startswith(prefix):
                return True
        return False

    def is_cached_or_demo(self, chain: str, address: str) -> bool:
        return self.is_cached(chain, address)

    def get_stats(self) -> Dict[str, Any]:
        """Returns runtime diagnostic metrics for caching layer."""
        return {
            "redis_connected": self._connected,
            "in_memory_keys": self._in_memory.size(),
        }

    async def clear(self):
        await self._in_memory.clear()
        self._prewarmed_addresses.clear()
        if self._connected and self._redis:
            try:
                await self._redis.flushdb()
            except Exception as e:
                logger.warning(f"Redis FLUSH failed: {e}")


# Global singleton instance
blockchain_cache = BlockchainCache()


def cached_blockchain_call(ttl: int = 3600):
    """
    Decorator for BlockchainProvider methods to automatically check cache,
    apply rate limiting throttle on misses, and cache the resulting NormalizedTransactions.
    """
    def decorator(func: Callable):
        @wraps(func)
        async def wrapper(self, address: str, *args, **kwargs):
            chain_name = getattr(self, "chain", "ethereum")
            method_name = func.__name__

            key_params = {"args": str(args)} if args else {}
            key_params.update({k: str(v) for k, v in kwargs.items()})

            cache_key = blockchain_cache.build_cache_key(
                chain=chain_name,
                address=address,
                method=method_name,
                **key_params
            )

            # 1. Try cache hit
            cached = await blockchain_cache.get_transactions(cache_key)
            if cached is not None:
                logger.debug(f"[CACHE HIT] {cache_key} ({len(cached)} txs)")
                return cached

            # 2. Rate limiting throttle before external API hit
            await blockchain_cache.rate_limiter.throttle(chain_name)

            # 3. Fetch from provider
            logger.debug(f"[CACHE MISS] Executing {chain_name}::{method_name} for {address}")
            result = await func(self, address, *args, **kwargs)

            # 4. Store in cache
            if isinstance(result, list):
                await blockchain_cache.set_transactions(cache_key, result, ttl=ttl)

            return result
        return wrapper
    return decorator
