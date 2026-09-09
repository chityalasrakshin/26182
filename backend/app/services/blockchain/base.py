from abc import ABC, abstractmethod
from typing import List
from backend.app.schemas.analysis import NormalizedTransaction
from backend.app.services.blockchain.cache import blockchain_cache


class BlockchainProvider(ABC):
    """
    Abstract Base Class defining the contract for multi-chain data providers
    (Ethereum/EVM, Tron, Bitcoin).
    All concrete blockchain providers must implement these methods without 
    fabricating or guessing transaction data.
    """

    @property
    def chain(self) -> str:
        """Name of the chain handled by this provider."""
        return "ethereum"

    @abstractmethod
    async def get_native_transactions(
        self, 
        address: str, 
        page: int = 1, 
        offset: int = 50
    ) -> List[NormalizedTransaction]:
        """Fetch native currency transactions for the given address."""
        pass

    @abstractmethod
    async def get_token_transfers(
        self, 
        address: str, 
        page: int = 1, 
        offset: int = 50
    ) -> List[NormalizedTransaction]:
        """Fetch token transfers (ERC-20, TRC-20) for the given address."""
        pass

    @abstractmethod
    async def get_address_activity(
        self, 
        address: str, 
        max_tx: int = 50
    ) -> List[NormalizedTransaction]:
        """
        Fetch combined native and token transfer activity for an address,
        sorted chronologically.
        """
        pass

    async def get_outgoing_txs(
        self, 
        address: str, 
        max_tx: int = 50
    ) -> List[NormalizedTransaction]:
        """
        Fetch directional transactions where the given address is the sender.
        Checks cache first before falling back to explorer API.
        """
        cache_key = blockchain_cache.build_cache_key(self.chain, address, "outgoing", max_tx=max_tx)
        cached = await blockchain_cache.get_transactions(cache_key)
        if cached is not None:
            return cached

        activity = await self.get_address_activity(address, max_tx=max_tx * 2)
        addr_norm = address.strip().lower()
        outgoing = [tx for tx in activity if tx.from_address.lower() == addr_norm][:max_tx]
        await blockchain_cache.set_transactions(cache_key, outgoing, ttl=1800)
        return outgoing

    async def get_incoming_txs(
        self, 
        address: str, 
        max_tx: int = 50
    ) -> List[NormalizedTransaction]:
        """
        Fetch directional transactions where the given address is the recipient.
        Checks cache first before falling back to explorer API.
        """
        cache_key = blockchain_cache.build_cache_key(self.chain, address, "incoming", max_tx=max_tx)
        cached = await blockchain_cache.get_transactions(cache_key)
        if cached is not None:
            return cached

        activity = await self.get_address_activity(address, max_tx=max_tx * 2)
        addr_norm = address.strip().lower()
        incoming = [tx for tx in activity if tx.to_address.lower() == addr_norm][:max_tx]
        await blockchain_cache.set_transactions(cache_key, incoming, ttl=1800)
        return incoming


# ChainAdapter alias for BUILD-PLAN.md contract naming alignment
ChainAdapter = BlockchainProvider
