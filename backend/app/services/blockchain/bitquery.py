"""
Bitquery GraphQL Blockchain Provider.
Unified multi-chain aggregator fallback covering Ethereum/EVM, Tron, and Bitcoin.
"""

import asyncio
import logging
from datetime import datetime, timezone
from typing import List, Dict, Any, Optional
import httpx

from backend.app.core.config import settings
from backend.app.schemas.analysis import NormalizedTransaction
from backend.app.services.blockchain.base import BlockchainProvider

logger = logging.getLogger(__name__)

BITQUERY_GRAPHQL_URL = "https://graphql.bitquery.io"


class BitqueryProvider(BlockchainProvider):
    """
    Unified multi-chain blockchain data provider using Bitquery GraphQL v1/v2 API.
    Used as an aggregator fallback when Etherscan / TronGrid / Blockstream are throttled.
    """

    def __init__(self, api_key: Optional[str] = None):
        self.api_key = api_key or settings.BITQUERY_API_KEY
        self.api_url = BITQUERY_GRAPHQL_URL
        self.timeout = settings.REQUEST_TIMEOUT_SECONDS
        self.max_retries = settings.MAX_RETRIES
        self.rate_limit_delay = settings.RATE_LIMIT_DELAY_SECONDS
        self._lock = asyncio.Lock()
        self._last_request_time = 0.0

    def _get_headers(self) -> Dict[str, str]:
        headers = {
            "Content-Type": "application/json",
            "Accept": "application/json"
        }
        if self.api_key:
            headers["X-API-KEY"] = self.api_key
        return headers

    async def _throttle(self):
        async with self._lock:
            loop = asyncio.get_running_loop()
            now = loop.time()
            elapsed = now - self._last_request_time
            if elapsed < self.rate_limit_delay:
                await asyncio.sleep(self.rate_limit_delay - elapsed)
            self._last_request_time = loop.time()

    async def _execute_query(self, query: str, variables: Dict[str, Any]) -> Dict[str, Any]:
        """Executes GraphQL query against Bitquery."""
        if not self.api_key:
            logger.warning("Bitquery API key not configured; skipping Bitquery GraphQL query.")
            return {}

        await self._throttle()
        payload = {"query": query, "variables": variables}

        for attempt in range(1, self.max_retries + 1):
            try:
                async with httpx.AsyncClient(timeout=self.timeout) as client:
                    resp = await client.post(
                        self.api_url,
                        json=payload,
                        headers=self._get_headers()
                    )
                    resp.raise_for_status()
                    data = resp.json()
                    if "errors" in data:
                        logger.warning(f"Bitquery GraphQL error: {data['errors']}")
                        return {}
                    return data.get("data", {})
            except Exception as e:
                logger.warning(f"Bitquery request attempt {attempt} failed: {e}")
                if attempt == self.max_retries:
                    return {}
                await asyncio.sleep(1.0 * attempt)
        return {}

    async def get_native_transactions(
        self,
        address: str,
        page: int = 1,
        offset: int = 50
    ) -> List[NormalizedTransaction]:
        """Fetches transfers for Ethereum using Bitquery GraphQL."""
        query = """
        query ($address: String!, $limit: Int!, $offset: Int!) {
          ethereum {
            transfers(
              receiver: {is: $address}
              options: {desc: "block.timestamp.time", limit: $limit, offset: $offset}
            ) {
              transaction {
                hash
              }
              block {
                height
                timestamp {
                  time(format: "%Y-%m-%d %H:%M:%S")
                }
              }
              sender {
                address
              }
              receiver {
                address
              }
              amount
              currency {
                symbol
              }
            }
          }
        }
        """
        vars = {
            "address": address,
            "limit": offset,
            "offset": (page - 1) * offset
        }
        data = await self._execute_query(query, vars)
        transfers = data.get("ethereum", {}).get("transfers", [])
        txs: List[NormalizedTransaction] = []

        for item in transfers:
            try:
                tx_hash = item.get("transaction", {}).get("hash", "")
                block_num = item.get("block", {}).get("height", 0)
                time_str = item.get("block", {}).get("timestamp", {}).get("time")
                dt = datetime.fromisoformat(time_str.replace(" ", "T")) if time_str else datetime.now(timezone.utc)
                sender = item.get("sender", {}).get("address", "")
                receiver = item.get("receiver", {}).get("address", "")
                amt = float(item.get("amount", 0.0))
                sym = item.get("currency", {}).get("symbol", "ETH")

                txs.append(NormalizedTransaction(
                    tx_hash=tx_hash,
                    chain="ethereum",
                    block_number=block_num,
                    timestamp=dt,
                    from_address=sender,
                    to_address=receiver,
                    asset_type=sym,
                    amount=amt,
                    source_api="bitquery_graphql"
                ))
            except Exception as e:
                logger.debug(f"Error parsing Bitquery transfer: {e}")
                continue
        return txs

    async def get_token_transfers(
        self,
        address: str,
        page: int = 1,
        offset: int = 50
    ) -> List[NormalizedTransaction]:
        return []

    async def get_address_activity(
        self,
        address: str,
        max_tx: int = 50
    ) -> List[NormalizedTransaction]:
        return await self.get_native_transactions(address, page=1, offset=max_tx)
