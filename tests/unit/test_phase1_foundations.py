"""
Unit tests for Phase 1 Data Foundations:
- Chain Adapters (directional transactions)
- LabelStore (OFAC, VASP master, demo labels)
- Graph Ingestion & ShortestPath Cypher query semantics
"""

import pytest
from datetime import datetime, timezone
from backend.app.schemas.analysis import NormalizedTransaction
from backend.app.services.blockchain.factory import BlockchainProviderFactory
from backend.app.services.blockchain.etherscan import EtherscanProvider
from backend.app.services.blockchain.tron import TronProvider
from backend.app.services.blockchain.bitcoin import BitcoinProvider
from backend.app.services.labels.store import LabelStore, AddressLabel


@pytest.fixture
def store():
    return LabelStore()


def test_label_store_initialization(store):
    """Test that LabelStore loads master VASP CSV, demo labels, and OFAC list."""
    assert len(store._address_map) > 1000
    assert store._loaded is True


def test_label_store_demo_labels(store):
    """Test lookup of curated benchmark labels in demo_labels.json."""
    # Binance Hot Wallet 14
    binance = store.lookup("0x28c6c06298d514db089934071355e5743bf21d60")
    assert binance is not None
    assert binance.entity == "Binance"
    assert binance.is_vasp is True
    assert binance.confidence == "HIGH"

    # Tornado Cash Router
    tornado = store.lookup("0xd90e2f925da726b50c4ed8d0fb90ad053324f31b")
    assert tornado is not None
    assert tornado.category == "mixer"
    assert tornado.risk_level == "CRITICAL"


def test_label_store_ofac_sanctions(store):
    """Test lookup of OFAC sanctions list entries."""
    lazarus = store.lookup("0x098b716b8aaf21512996dc57eb0615e2383e2f96")
    assert lazarus is not None
    assert lazarus.risk_level == "CRITICAL"
    assert "sanction" in lazarus.category.lower() or "scam" in lazarus.category.lower()


def test_blockchain_provider_factory_routing():
    """Test that factory routes to correct concrete provider per network and address."""
    eth_p = BlockchainProviderFactory.get_provider("ethereum")
    assert isinstance(eth_p, EtherscanProvider)

    tron_p = BlockchainProviderFactory.get_provider("tron")
    assert isinstance(tron_p, TronProvider)

    btc_p = BlockchainProviderFactory.get_provider("bitcoin")
    assert isinstance(btc_p, BitcoinProvider)

    # Auto-detection from address string
    auto_tron = BlockchainProviderFactory.get_provider("TMuA6YMeL4nNFYWAnWUCtqnmEvrCfsugnR")
    assert isinstance(auto_tron, TronProvider)

    auto_btc = BlockchainProviderFactory.get_provider("1A1zP1eP5QGefi2DMPTfTL5SLmv7DivfNa")
    assert isinstance(auto_btc, BitcoinProvider)


@pytest.mark.asyncio
async def test_chain_adapter_directional_txs():
    """Test that base ChainAdapter get_outgoing_txs and get_incoming_txs correctly filter activity."""
    provider = EtherscanProvider()
    test_addr = "0x1111111111111111111111111111111111111111"

    # Mock get_address_activity
    async def mock_activity(address, max_tx=50):
        return [
            NormalizedTransaction(
                tx_hash="0xabc1",
                chain="ethereum",
                block_number=100,
                timestamp=datetime.now(timezone.utc),
                from_address=test_addr,
                to_address="0x2222222222222222222222222222222222222222",
                asset_type="ETH",
                amount=5.0
            ),
            NormalizedTransaction(
                tx_hash="0xabc2",
                chain="ethereum",
                block_number=101,
                timestamp=datetime.now(timezone.utc),
                from_address="0x3333333333333333333333333333333333333333",
                to_address=test_addr,
                asset_type="ETH",
                amount=2.5
            )
        ]

    provider.get_address_activity = mock_activity

    outgoing = await provider.get_outgoing_txs(test_addr)
    assert len(outgoing) == 1
    assert outgoing[0].tx_hash == "0xabc1"

    incoming = await provider.get_incoming_txs(test_addr)
    assert len(incoming) == 1
    assert incoming[0].tx_hash == "0xabc2"
