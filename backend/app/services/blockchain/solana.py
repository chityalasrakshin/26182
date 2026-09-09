"""
Solana blockchain provider using Solana JSON-RPC API.

Fetches native SOL transfers (System Program) and SPL token movements (Token & Token-2022)
and normalizes them into account-model NormalizedTransaction records compatible with
the rest of the CryptoTrace graph traversal and attribution pipeline.
"""

import asyncio
import logging
from datetime import datetime, timezone
from typing import List, Dict, Any, Optional

import httpx

from backend.app.core.config import settings
from backend.app.core.address_validator import is_valid_sol_address
from backend.app.schemas.analysis import NormalizedTransaction
from backend.app.services.blockchain.base import BlockchainProvider
from backend.app.services.blockchain.cache import blockchain_cache

logger = logging.getLogger(__name__)

# Standard Solana Program IDs
SYSTEM_PROGRAM_ID = "11111111111111111111111111111111"
TOKEN_PROGRAM_ID = "TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA"
TOKEN_2022_PROGRAM_ID = "TokenzQdBNbLqP5VEhdkAS6EPFLC1PHnBqCXEpPxuEb"

# Well-known SPL token mints with symbols and decimals
KNOWN_SPL_TOKENS: Dict[str, Dict[str, Any]] = {
    "Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB": {"symbol": "USDT", "decimals": 6},
    "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v": {"symbol": "USDC", "decimals": 6},
    "So11111111111111111111111111111111111111112": {"symbol": "WSOL", "decimals": 9},
    "7vfCXTUXx5WJV5JADk17DUJ4ksgau7utNKj4b963voxs": {"symbol": "ETH", "decimals": 8},
    "3NZ9JMVBmGAqocybic2c7LQCJScmgsAZ6vQqTDzcqmJh": {"symbol": "WBTC", "decimals": 8},
    "mSoLzYCxHdYgdzU16g5QSh3i5K3z3KZK7ytfqcJm7So": {"symbol": "mSOL", "decimals": 9},
    "bSo13r4TkiE4KumL71LsHTPpL2euBYLFx6h9HP3piy1": {"symbol": "bSOL", "decimals": 9},
    "J1toso1uCk3RLmjorhTtrVwY9HJ7X8V9yYac6Y7kGCPn": {"symbol": "JitoSOL", "decimals": 9},
}


class SolanaProvider(BlockchainProvider):
    """
    Production-grade Solana RPC provider supporting native SOL and SPL token transfers.
    Interfaces with standard Solana JSON-RPC methods:
    - getSignaturesForAddress
    - getParsedTransaction / getTransaction
    """

    @property
    def chain(self) -> str:
        return "solana"

    def __init__(
        self,
        rpc_url: Optional[str] = None,
        timeout: Optional[float] = None,
        rate_limit_delay: float = 0.25,
        max_retries: int = 3,
    ):
        self.rpc_url = rpc_url or settings.SOLANA_RPC_URL
        self.timeout = timeout or settings.SOLANA_REQUEST_TIMEOUT_SECONDS
        self.rate_limit_delay = rate_limit_delay
        self.max_retries = max_retries
        self._lock = asyncio.Lock()
        self._last_request_time = 0.0

    async def _throttle(self):
        """Throttle requests to respect RPC endpoint rate limits."""
        async with self._lock:
            loop = asyncio.get_running_loop()
            now = loop.time()
            elapsed = now - self._last_request_time
            if elapsed < self.rate_limit_delay:
                await asyncio.sleep(self.rate_limit_delay - elapsed)
            self._last_request_time = loop.time()

    async def _rpc_call(self, method: str, params: list) -> Any:
        """
        Executes a Solana JSON-RPC call with retry logic and exponential backoff.
        """
        payload = {
            "jsonrpc": "2.0",
            "id": 1,
            "method": method,
            "params": params,
        }
        headers = {"Content-Type": "application/json"}

        for attempt in range(1, self.max_retries + 1):
            await self._throttle()
            try:
                async with httpx.AsyncClient(timeout=self.timeout) as client:
                    response = await client.post(self.rpc_url, json=payload, headers=headers)
                    if response.status_code == 429 or response.status_code >= 500:
                        wait_sec = 1.0 * (2 ** (attempt - 1))
                        logger.warning(
                            f"Solana RPC HTTP {response.status_code} on attempt {attempt}/{self.max_retries}. "
                            f"Retrying in {wait_sec}s..."
                        )
                        await asyncio.sleep(wait_sec)
                        continue

                    response.raise_for_status()
                    data = response.json()

                    if "error" in data:
                        err = data["error"]
                        code = err.get("code") if isinstance(err, dict) else None
                        if code == -32005:  # Rate limited
                            wait_sec = 1.5 * (2 ** (attempt - 1))
                            logger.warning(f"Solana RPC rate limit (-32005). Retrying in {wait_sec}s...")
                            await asyncio.sleep(wait_sec)
                            continue
                        logger.error(f"Solana RPC error response: {err}")
                        return None

                    return data.get("result")
            except (httpx.TimeoutException, httpx.NetworkError) as e:
                wait_sec = 1.0 * (2 ** (attempt - 1))
                logger.warning(f"Solana RPC network error on attempt {attempt}/{self.max_retries}: {e}")
                if attempt < self.max_retries:
                    await asyncio.sleep(wait_sec)
            except Exception as e:
                logger.error(f"Solana RPC unexpected exception: {e}")
                return None

        logger.error(f"Solana RPC call {method} failed after {self.max_retries} attempts.")
        return None

    def _extract_account_key(self, account: Any) -> str:
        """Extracts base58 address string from parsed account item."""
        if isinstance(account, dict):
            return account.get("pubkey", "")
        return str(account)

    def _build_token_owner_map(self, meta: Dict[str, Any], account_keys: List[str]) -> Dict[str, Dict[str, Any]]:
        """
        Builds mapping from account index / address to owner wallet and mint from token balances.
        """
        owner_map: Dict[str, Dict[str, Any]] = {}
        for tb_list in [meta.get("preTokenBalances", []), meta.get("postTokenBalances", [])]:
            for item in (tb_list or []):
                acc_idx = item.get("accountIndex")
                owner = item.get("owner", "")
                mint = item.get("mint", "")
                if acc_idx is not None and 0 <= acc_idx < len(account_keys):
                    ata_addr = account_keys[acc_idx]
                    owner_map[ata_addr] = {"owner": owner, "mint": mint}
                    owner_map[str(acc_idx)] = {"owner": owner, "mint": mint}
        return owner_map

    def _parse_native_transfers_from_tx(
        self,
        tx_data: Dict[str, Any],
        target_address: str,
    ) -> List[NormalizedTransaction]:
        """Parses native SOL transfers from a getParsedTransaction result."""
        if not tx_data:
            return []

        transaction = tx_data.get("transaction", {})
        signatures = transaction.get("signatures", [])
        tx_sig = signatures[0] if signatures else ""
        meta = tx_data.get("meta", {})
        is_error = meta.get("err") is not None
        slot = tx_data.get("slot", 0)
        block_time = tx_data.get("blockTime")
        dt = (
            datetime.fromtimestamp(block_time, tz=timezone.utc)
            if block_time
            else datetime.now(timezone.utc)
        )

        message = transaction.get("message", {})
        raw_account_keys = message.get("accountKeys", [])
        account_keys = [self._extract_account_key(a) for a in raw_account_keys]

        parsed_txs: List[NormalizedTransaction] = []

        # Collect instructions (outer + inner)
        all_instructions = list(message.get("instructions", []))
        for inner in meta.get("innerInstructions", []) or []:
            all_instructions.extend(inner.get("instructions", []))

        # 1. Parse structured System Program transfers
        found_structured_transfer = False
        for ix in all_instructions:
            if not isinstance(ix, dict):
                continue
            prog = ix.get("program")
            prog_id = ix.get("programId")
            if prog == "system" or prog_id == SYSTEM_PROGRAM_ID:
                parsed = ix.get("parsed")
                if isinstance(parsed, dict) and parsed.get("type") == "transfer":
                    info = parsed.get("info", {})
                    source = info.get("source", "")
                    destination = info.get("destination", "")
                    lamports = int(info.get("lamports", 0))
                    amount_sol = lamports / 1e9

                    if source and destination and (source == target_address or destination == target_address or not target_address):
                        found_structured_transfer = True
                        parsed_txs.append(
                            NormalizedTransaction(
                                tx_hash=tx_sig,
                                chain="solana",
                                block_number=slot,
                                timestamp=dt,
                                from_address=source,
                                to_address=destination,
                                asset_type="SOL",
                                token_symbol="SOL",
                                token_decimals=9,
                                amount=amount_sol,
                                is_error=is_error,
                                source_api="solana_rpc",
                            )
                        )

        # 2. Net SOL balance differential fallback if not captured in parsed instruction
        if not found_structured_transfer and meta and target_address in account_keys:
            try:
                target_idx = account_keys.index(target_address)
                pre_balances = meta.get("preBalances", [])
                post_balances = meta.get("postBalances", [])
                if (
                    len(pre_balances) > target_idx
                    and len(post_balances) > target_idx
                ):
                    diff = post_balances[target_idx] - pre_balances[target_idx]
                    fee = meta.get("fee", 0) if target_idx == 0 else 0
                    net_diff = diff + fee

                    if abs(net_diff) >= 1000:  # Ignore trivial sub-lamport dust/fees
                        if net_diff < 0:
                            # Outgoing transfer: find recipient with positive balance delta
                            recipient = ""
                            max_pos_delta = 0
                            for idx, key in enumerate(account_keys):
                                if idx != target_idx and idx < len(post_balances) and idx < len(pre_balances):
                                    delta = post_balances[idx] - pre_balances[idx]
                                    if delta > max_pos_delta:
                                        max_pos_delta = delta
                                        recipient = key
                            if recipient:
                                parsed_txs.append(
                                    NormalizedTransaction(
                                        tx_hash=tx_sig,
                                        chain="solana",
                                        block_number=slot,
                                        timestamp=dt,
                                        from_address=target_address,
                                        to_address=recipient,
                                        asset_type="SOL",
                                        token_symbol="SOL",
                                        token_decimals=9,
                                        amount=abs(net_diff) / 1e9,
                                        is_error=is_error,
                                        source_api="solana_rpc",
                                    )
                                )
                        elif net_diff > 0:
                            # Incoming transfer: sender is fee payer or key 0
                            sender = account_keys[0] if account_keys and account_keys[0] != target_address else "unknown"
                            parsed_txs.append(
                                NormalizedTransaction(
                                    tx_hash=tx_sig,
                                    chain="solana",
                                    block_number=slot,
                                    timestamp=dt,
                                    from_address=sender,
                                    to_address=target_address,
                                    asset_type="SOL",
                                    token_symbol="SOL",
                                    token_decimals=9,
                                    amount=net_diff / 1e9,
                                    is_error=is_error,
                                    source_api="solana_rpc",
                                )
                            )
            except Exception as e:
                logger.debug(f"Could not compute balance delta fallback for {target_address}: {e}")

        return parsed_txs

    def _parse_token_transfers_from_tx(
        self,
        tx_data: Dict[str, Any],
        target_address: str,
    ) -> List[NormalizedTransaction]:
        """Parses SPL token transfers from a getParsedTransaction result."""
        if not tx_data:
            return []

        transaction = tx_data.get("transaction", {})
        signatures = transaction.get("signatures", [])
        tx_sig = signatures[0] if signatures else ""
        meta = tx_data.get("meta", {})
        is_error = meta.get("err") is not None
        slot = tx_data.get("slot", 0)
        block_time = tx_data.get("blockTime")
        dt = (
            datetime.fromtimestamp(block_time, tz=timezone.utc)
            if block_time
            else datetime.now(timezone.utc)
        )

        message = transaction.get("message", {})
        raw_account_keys = message.get("accountKeys", [])
        account_keys = [self._extract_account_key(a) for a in raw_account_keys]
        token_owner_map = self._build_token_owner_map(meta, account_keys)

        parsed_txs: List[NormalizedTransaction] = []

        all_instructions = list(message.get("instructions", []))
        for inner in meta.get("innerInstructions", []) or []:
            all_instructions.extend(inner.get("instructions", []))

        for ix in all_instructions:
            if not isinstance(ix, dict):
                continue
            prog = ix.get("program")
            prog_id = ix.get("programId")

            if prog in ("spl-token", "spl-token-2022") or prog_id in (TOKEN_PROGRAM_ID, TOKEN_2022_PROGRAM_ID):
                parsed = ix.get("parsed")
                if not isinstance(parsed, dict):
                    continue
                ix_type = parsed.get("type")
                info = parsed.get("info", {})

                if ix_type in ("transfer", "transferChecked") and info:
                    source_ata = info.get("source", "")
                    dest_ata = info.get("destination", "")
                    authority = info.get("authority", "")

                    # Resolve wallet owner if source/destination are token accounts
                    from_wallet = authority or token_owner_map.get(source_ata, {}).get("owner", source_ata)
                    to_wallet = token_owner_map.get(dest_ata, {}).get("owner", dest_ata)

                    # Determine mint and amount
                    mint = (
                        info.get("mint")
                        or token_owner_map.get(source_ata, {}).get("mint")
                        or token_owner_map.get(dest_ata, {}).get("mint")
                        or "unknown"
                    )

                    token_meta = KNOWN_SPL_TOKENS.get(mint, {"symbol": "SPL", "decimals": 6})
                    symbol = token_meta["symbol"]
                    decimals = token_meta["decimals"]

                    amount_val = 0.0
                    token_amount = info.get("tokenAmount")
                    if isinstance(token_amount, dict):
                        ui_amt = token_amount.get("uiAmount")
                        if ui_amt is not None:
                            amount_val = float(ui_amt)
                        else:
                            raw_amt = int(token_amount.get("amount", 0))
                            decimals = int(token_amount.get("decimals", decimals))
                            amount_val = raw_amt / (10 ** decimals)
                    elif "amount" in info:
                        raw_amt = int(info.get("amount", 0))
                        amount_val = raw_amt / (10 ** decimals)

                    # Filter for target address relevance if supplied
                    if not target_address or from_wallet == target_address or to_wallet == target_address or source_ata == target_address or dest_ata == target_address:
                        parsed_txs.append(
                            NormalizedTransaction(
                                tx_hash=tx_sig,
                                chain="solana",
                                block_number=slot,
                                timestamp=dt,
                                from_address=from_wallet,
                                to_address=to_wallet,
                                asset_type="SPL",
                                token_address=mint,
                                token_symbol=symbol,
                                token_decimals=decimals,
                                amount=amount_val,
                                is_error=is_error,
                                source_api="solana_rpc",
                            )
                        )

        return parsed_txs

    async def get_native_transactions(
        self,
        address: str,
        page: int = 1,
        offset: int = 50,
    ) -> List[NormalizedTransaction]:
        """
        Fetches native SOL transfers for the given address via Solana JSON-RPC.
        """
        if not is_valid_sol_address(address):
            return []

        cache_key = blockchain_cache.build_cache_key(self.chain, address, "native", page=page, offset=offset)
        cached = await blockchain_cache.get_transactions(cache_key)
        if cached is not None:
            return cached

        # Fetch recent transaction signatures
        limit = min(offset, 50)
        sig_result = await self._rpc_call("getSignaturesForAddress", [address, {"limit": limit}])
        if not sig_result or not isinstance(sig_result, list):
            await blockchain_cache.set_transactions(cache_key, [], ttl=600)
            return []

        all_native_txs: List[NormalizedTransaction] = []
        for item in sig_result:
            tx_sig = item.get("signature")
            if not tx_sig:
                continue

            parsed_tx = await self._rpc_call(
                "getParsedTransaction",
                [tx_sig, {"encoding": "jsonParsed", "maxSupportedTransactionVersion": 0}],
            )
            if parsed_tx:
                parsed_native = self._parse_native_transfers_from_tx(parsed_tx, target_address=address)
                all_native_txs.extend(parsed_native)

        await blockchain_cache.set_transactions(cache_key, all_native_txs, ttl=1800)
        return all_native_txs

    async def get_token_transfers(
        self,
        address: str,
        page: int = 1,
        offset: int = 50,
    ) -> List[NormalizedTransaction]:
        """
        Fetches SPL token transfers (USDT, USDC, etc.) for the given address via Solana JSON-RPC.
        """
        if not is_valid_sol_address(address):
            return []

        cache_key = blockchain_cache.build_cache_key(self.chain, address, "token", page=page, offset=offset)
        cached = await blockchain_cache.get_transactions(cache_key)
        if cached is not None:
            return cached

        limit = min(offset, 50)
        sig_result = await self._rpc_call("getSignaturesForAddress", [address, {"limit": limit}])
        if not sig_result or not isinstance(sig_result, list):
            await blockchain_cache.set_transactions(cache_key, [], ttl=600)
            return []

        all_token_txs: List[NormalizedTransaction] = []
        for item in sig_result:
            tx_sig = item.get("signature")
            if not tx_sig:
                continue

            parsed_tx = await self._rpc_call(
                "getParsedTransaction",
                [tx_sig, {"encoding": "jsonParsed", "maxSupportedTransactionVersion": 0}],
            )
            if parsed_tx:
                parsed_tokens = self._parse_token_transfers_from_tx(parsed_tx, target_address=address)
                all_token_txs.extend(parsed_tokens)

        await blockchain_cache.set_transactions(cache_key, all_token_txs, ttl=1800)
        return all_token_txs

    async def get_address_activity(
        self,
        address: str,
        max_tx: int = 50,
    ) -> List[NormalizedTransaction]:
        """
        Combines chronological native SOL and SPL token activity for the address.
        """
        if not is_valid_sol_address(address):
            return []

        cache_key = blockchain_cache.build_cache_key(self.chain, address, "activity", max_tx=max_tx)
        cached = await blockchain_cache.get_transactions(cache_key)
        if cached is not None:
            return cached

        limit = min(max_tx, 50)
        sig_result = await self._rpc_call("getSignaturesForAddress", [address, {"limit": limit}])
        if not sig_result or not isinstance(sig_result, list):
            return []

        combined: List[NormalizedTransaction] = []
        for item in sig_result:
            tx_sig = item.get("signature")
            if not tx_sig:
                continue

            parsed_tx = await self._rpc_call(
                "getParsedTransaction",
                [tx_sig, {"encoding": "jsonParsed", "maxSupportedTransactionVersion": 0}],
            )
            if parsed_tx:
                native_txs = self._parse_native_transfers_from_tx(parsed_tx, target_address=address)
                token_txs = self._parse_token_transfers_from_tx(parsed_tx, target_address=address)
                combined.extend(native_txs)
                combined.extend(token_txs)

        # Sort combined chronologically (descending)
        combined.sort(key=lambda x: x.timestamp, reverse=True)
        result = combined[:max_tx]
        await blockchain_cache.set_transactions(cache_key, result, ttl=1800)
        return result

    async def get_outgoing_txs(
        self,
        address: str,
        max_tx: int = 50,
    ) -> List[NormalizedTransaction]:
        """
        Directional filter for transfers originating from the target Solana address.
        Preserves exact Base58 case matching.
        """
        cache_key = blockchain_cache.build_cache_key(self.chain, address, "outgoing", max_tx=max_tx)
        cached = await blockchain_cache.get_transactions(cache_key)
        if cached is not None:
            return cached

        activity = await self.get_address_activity(address, max_tx=max_tx * 2)
        addr_clean = address.strip()
        outgoing = [tx for tx in activity if tx.from_address == addr_clean][:max_tx]
        await blockchain_cache.set_transactions(cache_key, outgoing, ttl=1800)
        return outgoing

    async def get_incoming_txs(
        self,
        address: str,
        max_tx: int = 50,
    ) -> List[NormalizedTransaction]:
        """
        Directional filter for transfers received by the target Solana address.
        Preserves exact Base58 case matching.
        """
        cache_key = blockchain_cache.build_cache_key(self.chain, address, "incoming", max_tx=max_tx)
        cached = await blockchain_cache.get_transactions(cache_key)
        if cached is not None:
            return cached

        activity = await self.get_address_activity(address, max_tx=max_tx * 2)
        addr_clean = address.strip()
        incoming = [tx for tx in activity if tx.to_address == addr_clean][:max_tx]
        await blockchain_cache.set_transactions(cache_key, incoming, ttl=1800)
        return incoming
