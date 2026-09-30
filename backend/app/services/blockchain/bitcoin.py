"""
Bitcoin blockchain provider using Blockstream.info public API.

Queries Blockstream for confirmed Bitcoin transactions and normalizes
UTXO-based inputs/outputs into account-model NormalizedTransaction records
compatible with the rest of the setu pipeline.

No API key required — Blockstream is a free public API.
"""

import asyncio
import logging
from datetime import datetime, timezone
from typing import List, Dict, Any, Optional

import httpx

from backend.app.services.blockchain.base import BlockchainProvider
from backend.app.schemas.analysis import NormalizedTransaction
from backend.app.schemas.heuristics import UTXOTransaction, UTXOInput, UTXOOutput

logger = logging.getLogger(__name__)

BLOCKSTREAM_API_URL = "https://blockstream.info/api"

# Rate limit: ~10 req/s recommended for Blockstream free tier
_DEFAULT_RATE_LIMIT_DELAY = 0.50
_DEFAULT_MAX_RETRIES = 3
_DEFAULT_TIMEOUT = 15.0


class BitcoinProvider(BlockchainProvider):
    """
    Production-ready Bitcoin data provider interfacing with Blockstream.info API.
    Normalizes UTXO-based Bitcoin transactions into account-model records.

    - Extracts sender from first input's prevout scriptpubkey_address
    - Extracts recipient from outputs (excluding change back to sender)
    - Handles pagination via Blockstream's `after_txid` cursor
    - Exponential backoff retry on transient failures
    """

    @property
    def chain(self) -> str:
        return "bitcoin"

    def __init__(self, rate_limit_delay: float = _DEFAULT_RATE_LIMIT_DELAY):
        self.base_url = BLOCKSTREAM_API_URL
        self.timeout = _DEFAULT_TIMEOUT
        self.max_retries = _DEFAULT_MAX_RETRIES
        self.rate_limit_delay = rate_limit_delay
        self._lock = asyncio.Lock()
        self._last_request_time = 0.0

    async def _throttle(self):
        """Respect Blockstream rate limits."""
        async with self._lock:
            loop = asyncio.get_running_loop()
            now = loop.time()
            elapsed = now - self._last_request_time
            if elapsed < self.rate_limit_delay:
                await asyncio.sleep(self.rate_limit_delay - elapsed)
            self._last_request_time = loop.time()

    async def _fetch_with_retry(self, url: str) -> Any:
        """HTTP GET with exponential backoff retry."""
        for attempt in range(1, self.max_retries + 1):
            await self._throttle()
            try:
                async with httpx.AsyncClient(timeout=self.timeout) as client:
                    response = await client.get(url)
                    response.raise_for_status()
                    return response.json()
            except httpx.HTTPStatusError as e:
                status = e.response.status_code
                if status == 429 or status >= 500:
                    wait_time = 1.5 * attempt
                    logger.warning(
                        f"Blockstream HTTP {status} on attempt {attempt}/{self.max_retries}. "
                        f"Backing off {wait_time}s"
                    )
                    await asyncio.sleep(wait_time)
                    continue
                logger.error(f"Blockstream HTTP error: {e}")
                if attempt == self.max_retries:
                    raise ConnectionError(f"Blockstream API returned HTTP {status}")
                await asyncio.sleep(1.0 * attempt)
            except httpx.RequestError as e:
                logger.error(f"Blockstream network error on attempt {attempt}: {e}")
                if attempt == self.max_retries:
                    raise ConnectionError(f"Failed to connect to Blockstream API: {e}")
                await asyncio.sleep(1.0 * attempt)

        return []

    def _extract_addresses_from_inputs(self, vin: List[Dict]) -> List[str]:
        """Extract unique sender addresses from transaction inputs."""
        addresses = []
        seen = set()
        for inp in vin:
            prevout = inp.get("prevout", {})
            addr = prevout.get("scriptpubkey_address", "")
            if addr and addr not in seen:
                addresses.append(addr)
                seen.add(addr)
        return addresses

    def _extract_addresses_from_outputs(
        self, vout: List[Dict], exclude_addresses: set
    ) -> List[Dict[str, Any]]:
        """Extract recipient addresses and amounts from transaction outputs."""
        recipients = []
        for out in vout:
            addr = out.get("scriptpubkey_address", "")
            value_sat = out.get("value", 0)
            if addr and addr not in exclude_addresses:
                recipients.append({"address": addr, "value_sat": value_sat})
        return recipients

    def _parse_btc_transaction(
        self, raw_tx: Dict[str, Any], queried_address: str
    ) -> List[NormalizedTransaction]:
        """
        Parse a single Blockstream transaction into one or more NormalizedTransaction records.

        Bitcoin UTXO transactions can have multiple inputs and outputs.
        We normalize by:
        1. Identifying the primary sender (first input address)
        2. Creating a NormalizedTransaction for each distinct output recipient
        """
        txid = raw_tx.get("txid", "")
        vin = raw_tx.get("vin", [])
        vout = raw_tx.get("vout", [])

        # Block timestamp
        status = raw_tx.get("status", {})
        block_time = status.get("block_time", 0)
        block_height = status.get("block_height", 0)
        confirmed = status.get("confirmed", False)

        if not confirmed or block_time == 0:
            return []

        dt = datetime.fromtimestamp(block_time, tz=timezone.utc)

        # Extract sender addresses
        input_addresses = self._extract_addresses_from_inputs(vin)
        if not input_addresses:
            return []

        primary_sender = input_addresses[0]
        sender_set = set(input_addresses)

        # Extract recipient outputs (exclude change back to any input address)
        recipients = self._extract_addresses_from_outputs(vout, sender_set)

        if not recipients:
            # If all outputs go back to sender (self-transfer/consolidation),
            # pick the first output that isn't the queried address
            for out in vout:
                addr = out.get("scriptpubkey_address", "")
                value_sat = out.get("value", 0)
                if addr and addr != queried_address:
                    recipients.append({"address": addr, "value_sat": value_sat})
                    break

        if not recipients:
            return []

        transactions = []
        for recipient in recipients:
            amount_btc = recipient["value_sat"] / 1e8  # satoshi → BTC

            transactions.append(
                NormalizedTransaction(
                    tx_hash=txid,
                    chain="bitcoin",
                    block_number=block_height,
                    timestamp=dt,
                    from_address=primary_sender.lower(),
                    to_address=recipient["address"].lower(),
                    asset_type="BTC",
                    token_address=None,
                    token_symbol="BTC",
                    token_decimals=8,
                    amount=amount_btc,
                    gas_used=None,
                    is_error=False,
                )
            )

        return transactions

    async def _fetch_address_transactions(
        self, address: str, max_tx: int = 50
    ) -> List[Dict[str, Any]]:
        """
        Fetch transactions for a Bitcoin address with pagination.
        Blockstream returns 25 txs per page, paginated via `after_txid`.
        """
        all_txs: List[Dict[str, Any]] = []
        url = f"{self.base_url}/address/{address}/txs"

        while len(all_txs) < max_tx:
            data = await self._fetch_with_retry(url)

            if not isinstance(data, list) or len(data) == 0:
                break

            all_txs.extend(data)

            if len(data) < 25:
                # Last page
                break

            # Paginate using the last tx's txid
            last_txid = data[-1].get("txid", "")
            if not last_txid:
                break
            url = f"{self.base_url}/address/{address}/txs/chain/{last_txid}"

        return all_txs[:max_tx]

    async def get_native_transactions(
        self, address: str, page: int = 1, offset: int = 50
    ) -> List[NormalizedTransaction]:
        """
        Fetch native BTC transactions for the given address.
        Bitcoin doesn't have token transfers, so this returns all transactions.
        """
        raw_txs = await self._fetch_address_transactions(address, max_tx=offset)

        parsed: List[NormalizedTransaction] = []
        for raw_tx in raw_txs:
            normalized = self._parse_btc_transaction(raw_tx, address)
            parsed.extend(normalized)

        return parsed[:offset]

    async def get_token_transfers(
        self, address: str, page: int = 1, offset: int = 50
    ) -> List[NormalizedTransaction]:
        """
        Bitcoin does not have native token transfers (no ERC-20 equivalent).
        Returns empty list. BRC-20/Ordinals are out of scope.
        """
        return []

    async def get_address_activity(
        self, address: str, max_tx: int = 50
    ) -> List[NormalizedTransaction]:
        """
        Fetch combined BTC transaction activity for an address, sorted chronologically.
        """
        transactions = await self.get_native_transactions(address, offset=max_tx)

        # Deduplicate by (tx_hash, from_address, to_address)
        seen = set()
        unique_txs = []
        for tx in transactions:
            key = (tx.tx_hash, tx.from_address, tx.to_address)
            if key not in seen:
                seen.add(key)
                unique_txs.append(tx)

        # Sort descending by timestamp
        unique_txs.sort(key=lambda x: x.timestamp, reverse=True)
        return unique_txs[:max_tx]

    def parse_utxo_transaction(self, raw_tx: Dict[str, Any]) -> Optional[UTXOTransaction]:
        """
        Parses a raw Blockstream JSON transaction into a full UTXOTransaction object
        with all inputs and outputs preserved.
        """
        txid = raw_tx.get("txid", "")
        status = raw_tx.get("status", {})
        block_time = status.get("block_time", 0)
        block_height = status.get("block_height", 0)
        dt = datetime.fromtimestamp(block_time, tz=timezone.utc) if block_time else datetime.now(timezone.utc)

        inputs: List[UTXOInput] = []
        for inp in raw_tx.get("vin", []):
            prevout = inp.get("prevout", {}) or {}
            addr = prevout.get("scriptpubkey_address", "")
            val_sat = prevout.get("value", 0)
            if addr:
                inputs.append(
                    UTXOInput(
                        address=addr,
                        value_sat=val_sat,
                        amount_btc=val_sat / 1e8,
                        txid=inp.get("txid"),
                        vout=inp.get("vout")
                    )
                )

        outputs: List[UTXOOutput] = []
        for idx, out in enumerate(raw_tx.get("vout", [])):
            addr = out.get("scriptpubkey_address", "")
            val_sat = out.get("value", 0)
            if addr:
                outputs.append(
                    UTXOOutput(
                        address=addr,
                        value_sat=val_sat,
                        amount_btc=val_sat / 1e8,
                        index=idx
                    )
                )

        if not inputs and not outputs:
            return None

        tot_in = sum(i.amount_btc for i in inputs)
        tot_out = sum(o.amount_btc for o in outputs)
        fee = max(0.0, round(tot_in - tot_out, 8))

        return UTXOTransaction(
            tx_hash=txid,
            chain="bitcoin",
            block_height=block_height,
            timestamp=dt,
            inputs=inputs,
            outputs=outputs,
            total_input_btc=tot_in,
            total_output_btc=tot_out,
            fee_btc=fee
        )

    async def get_raw_transactions(
        self, address: str, max_tx: int = 50
    ) -> List[UTXOTransaction]:
        """
        Fetch and parse full multi-input/multi-output UTXO transactions for an address.
        """
        raw_txs = await self._fetch_address_transactions(address, max_tx=max_tx)
        utxo_txs: List[UTXOTransaction] = []
        for raw in raw_txs:
            parsed = self.parse_utxo_transaction(raw)
            if parsed:
                utxo_txs.append(parsed)
        return utxo_txs

