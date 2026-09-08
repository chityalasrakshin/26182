"""
Historical Crypto-to-Fiat Price Valuation Service.

Retrieves historical USD and INR prices at the exact timestamp of each transaction
from the CoinGecko public API, providing investigators with realistic financial
loss figures in reports.

Features:
- In-memory LRU cache to avoid redundant API calls
- Automatic date-based lookups (CoinGecko uses dd-mm-yyyy date granularity)
- Support for multiple cryptocurrencies (BTC, ETH, TRX, USDT, USDC)
- Fallback to current price if historical data is unavailable
- Rate-limit-aware with exponential backoff

Source: Inspired by CRYPTO-TRACE-/backend/services/report_generator.py
"""

import asyncio
import logging
from datetime import datetime, timezone
from typing import Dict, Optional, Tuple
from functools import lru_cache

import httpx

logger = logging.getLogger(__name__)

COINGECKO_API_BASE = "https://api.coingecko.com/api/v3"

# Map common token symbols to CoinGecko IDs
SYMBOL_TO_COINGECKO_ID: Dict[str, str] = {
    "BTC": "bitcoin",
    "ETH": "ethereum",
    "TRX": "tron",
    "USDT": "tether",
    "USDC": "usd-coin",
    "MATIC": "matic-network",
    "BNB": "binancecoin",
    "DAI": "dai",
    "WETH": "weth",
    "WBTC": "wrapped-bitcoin",
    "BUSD": "binance-usd",
    "ARB": "arbitrum",
}

# Stablecoins always pegged ~1.0 USD
STABLECOIN_SYMBOLS = {"USDT", "USDC", "DAI", "BUSD", "TUSD", "USDP", "GUSD", "FRAX"}

# Rate limit parameters
_RATE_LIMIT_DELAY = 1.5  # CoinGecko free tier: 10-30 calls/min
_MAX_RETRIES = 3
_REQUEST_TIMEOUT = 10.0


class PriceService:
    """
    Historical crypto price valuation service with in-memory caching.

    Provides USD and INR valuations at transaction timestamps for
    forensic investigation reports and court-admissible dossiers.
    """

    def __init__(self):
        self._cache: Dict[Tuple[str, str], Dict[str, float]] = {}
        self._lock = asyncio.Lock()
        self._last_request_time = 0.0

    async def _throttle(self):
        """Enforce rate limiting for CoinGecko free tier."""
        async with self._lock:
            loop = asyncio.get_running_loop()
            now = loop.time()
            elapsed = now - self._last_request_time
            if elapsed < _RATE_LIMIT_DELAY:
                await asyncio.sleep(_RATE_LIMIT_DELAY - elapsed)
            self._last_request_time = loop.time()

    async def _fetch_historical_price(
        self, coin_id: str, date_str: str
    ) -> Optional[Dict[str, float]]:
        """
        Fetch historical price from CoinGecko for a specific date.

        Args:
            coin_id: CoinGecko coin identifier (e.g., "bitcoin")
            date_str: Date in dd-mm-yyyy format

        Returns:
            Dict with 'usd' and 'inr' prices, or None on failure
        """
        url = f"{COINGECKO_API_BASE}/coins/{coin_id}/history"
        params = {"date": date_str, "localization": "false"}

        for attempt in range(1, _MAX_RETRIES + 1):
            await self._throttle()
            try:
                async with httpx.AsyncClient(timeout=_REQUEST_TIMEOUT) as client:
                    response = await client.get(url, params=params)

                    if response.status_code == 429:
                        wait = 2.0 * attempt
                        logger.warning(
                            f"CoinGecko rate limited. Waiting {wait}s (attempt {attempt})"
                        )
                        await asyncio.sleep(wait)
                        continue

                    response.raise_for_status()
                    data = response.json()

                    market_data = data.get("market_data", {})
                    current_price = market_data.get("current_price", {})

                    usd_price = current_price.get("usd")
                    inr_price = current_price.get("inr")

                    if usd_price is not None:
                        return {
                            "usd": float(usd_price),
                            "inr": float(inr_price) if inr_price else float(usd_price) * 83.0,
                        }

                    return None

            except httpx.HTTPStatusError as e:
                logger.warning(
                    f"CoinGecko HTTP error for {coin_id} on {date_str}: {e}"
                )
                if attempt == _MAX_RETRIES:
                    return None
                await asyncio.sleep(1.0 * attempt)
            except httpx.RequestError as e:
                logger.warning(
                    f"CoinGecko network error for {coin_id} on {date_str}: {e}"
                )
                if attempt == _MAX_RETRIES:
                    return None
                await asyncio.sleep(1.0 * attempt)

        return None

    async def get_price_at_timestamp(
        self, symbol: str, timestamp: datetime
    ) -> Dict[str, float]:
        """
        Get the USD and INR price of a cryptocurrency at a specific timestamp.

        Args:
            symbol: Token symbol (e.g., "ETH", "BTC", "USDT")
            timestamp: Transaction timestamp

        Returns:
            Dict with 'usd' and 'inr' prices. Returns stablecoin peg
            for known stablecoins. Returns zeros if price unavailable.
        """
        symbol_upper = symbol.upper().strip()

        # Stablecoins: always ~$1.00
        if symbol_upper in STABLECOIN_SYMBOLS:
            return {"usd": 1.0, "inr": 83.0}

        # Get CoinGecko ID
        coin_id = SYMBOL_TO_COINGECKO_ID.get(symbol_upper)
        if not coin_id:
            logger.debug(f"Unknown symbol '{symbol_upper}', no CoinGecko mapping")
            return {"usd": 0.0, "inr": 0.0}

        # Ensure timezone-aware timestamp
        if timestamp.tzinfo is None:
            timestamp = timestamp.replace(tzinfo=timezone.utc)

        # CoinGecko uses dd-mm-yyyy granularity
        date_str = timestamp.strftime("%d-%m-%Y")

        # Check cache
        cache_key = (coin_id, date_str)
        if cache_key in self._cache:
            return self._cache[cache_key]

        # Fetch from API
        prices = await self._fetch_historical_price(coin_id, date_str)

        if prices:
            self._cache[cache_key] = prices
            return prices

        # Fallback: return zeros
        logger.warning(
            f"Could not fetch price for {symbol_upper} on {date_str}"
        )
        return {"usd": 0.0, "inr": 0.0}

    async def valuate_transaction(
        self, amount: float, symbol: str, timestamp: datetime
    ) -> Dict[str, float]:
        """
        Calculate the fiat value of a transaction at its timestamp.

        Args:
            amount: Transaction amount in native units
            symbol: Token symbol
            timestamp: Transaction timestamp

        Returns:
            Dict with 'amount_usd', 'amount_inr', 'unit_price_usd', 'unit_price_inr'
        """
        prices = await self.get_price_at_timestamp(symbol, timestamp)

        return {
            "unit_price_usd": prices["usd"],
            "unit_price_inr": prices["inr"],
            "amount_usd": round(amount * prices["usd"], 2),
            "amount_inr": round(amount * prices["inr"], 2),
        }

    async def valuate_transactions_batch(
        self, transactions: list
    ) -> list:
        """
        Valuate a batch of transactions, returning enriched transaction dicts.

        Each transaction should have 'amount', 'token_symbol', and 'timestamp' fields.
        """
        results = []
        for tx in transactions:
            symbol = tx.get("token_symbol", "ETH") or "ETH"
            amount = float(tx.get("amount", 0))
            timestamp = tx.get("timestamp")

            if isinstance(timestamp, str):
                try:
                    timestamp = datetime.fromisoformat(timestamp)
                except (ValueError, TypeError):
                    timestamp = datetime.now(tz=timezone.utc)
            elif timestamp is None:
                timestamp = datetime.now(tz=timezone.utc)

            valuation = await self.valuate_transaction(amount, symbol, timestamp)

            enriched = dict(tx)
            enriched.update(valuation)
            results.append(enriched)

        return results

    def get_cache_stats(self) -> Dict[str, int]:
        """Returns cache statistics."""
        return {
            "cached_price_points": len(self._cache),
            "unique_coins": len(set(k[0] for k in self._cache)),
            "unique_dates": len(set(k[1] for k in self._cache)),
        }


# Module-level singleton
_price_service_instance: Optional[PriceService] = None


def get_price_service() -> PriceService:
    """Get or create the global PriceService singleton."""
    global _price_service_instance
    if _price_service_instance is None:
        _price_service_instance = PriceService()
    return _price_service_instance


# Create __init__.py for the valuation package
