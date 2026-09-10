"""
Unit Tests for Case 3: Active Cross-Chain Bridge Continuity.

Verifies:
1. Bridge detection for Wormhole Portal, Stargate Finance, Across Protocol.
2. Bridge protocol identification from contract addresses.
3. BridgeInfo metadata extraction (destination chain, protocol name).
4. Celer cBridge and Synapse bridge detection.
5. Non-bridge addresses correctly return None.
6. NormalizedTransaction inspection with bridge metadata.
7. analyze_tx() compliance output format.
8. Wormhole recipient address decoding (EVM + Solana).
"""

import pytest
from datetime import datetime, timezone

from backend.app.services.bridge.detector import (
    BridgeDetector,
    BridgeInfo,
    bridge_detector,
    WORMHOLE_CONTRACTS,
    STARGATE_CONTRACTS,
    ACROSS_CONTRACTS,
    CELER_CONTRACTS,
    SYNAPSE_CONTRACTS,
    WORMHOLE_CHAIN_IDS,
    LAYERZERO_CHAIN_IDS,
    ACROSS_CHAIN_IDS,
)
from backend.app.schemas.analysis import NormalizedTransaction


@pytest.fixture
def detector():
    return BridgeDetector()


# ---------------------------------------------------------------------------
# Bridge Contract Detection
# ---------------------------------------------------------------------------


def test_wormhole_bridge_detection(detector):
    """Verify Wormhole Token Bridge contracts are detected."""
    # Ethereum Wormhole Token Bridge
    wormhole_eth = "0x3ee18b2214aff97000d974cf647e7c347e8fa585"
    assert detector.is_bridge_contract(wormhole_eth) is True
    assert detector.get_bridge_protocol(wormhole_eth) == "Wormhole"


def test_stargate_bridge_detection(detector):
    """Verify Stargate Finance Router contracts are detected."""
    stargate_eth = "0x8731d54e9d02c215207d57053ef090b40e241071"
    assert detector.is_bridge_contract(stargate_eth) is True
    assert detector.get_bridge_protocol(stargate_eth) == "Stargate"


def test_across_bridge_detection(detector):
    """Verify Across Protocol SpokePool contracts are detected."""
    across_eth = "0x5c7bcd6e7de5423a257d81b442095a1a6ced35c5"
    assert detector.is_bridge_contract(across_eth) is True
    assert detector.get_bridge_protocol(across_eth) == "Across"


def test_celer_bridge_detection(detector):
    """Verify Celer cBridge contracts are detected."""
    celer_eth = "0x5427fefa711eff98f60deb0bcbb107a8262b7c26"
    assert detector.is_bridge_contract(celer_eth) is True
    assert detector.get_bridge_protocol(celer_eth) == "Celer cBridge"


def test_synapse_bridge_detection(detector):
    """Verify Synapse Bridge contracts are detected."""
    synapse_eth = "0x2796317b0ff8538f253012862c06787adfb8ceb6"
    assert detector.is_bridge_contract(synapse_eth) is True
    assert detector.get_bridge_protocol(synapse_eth) == "Synapse"


def test_non_bridge_address(detector):
    """Verify non-bridge addresses return False/None."""
    random_addr = "0x1234567890abcdef1234567890abcdef12345678"
    assert detector.is_bridge_contract(random_addr) is False
    assert detector.get_bridge_protocol(random_addr) is None


def test_empty_address(detector):
    """Verify empty/None addresses don't crash."""
    assert detector.is_bridge_contract("") is False
    assert detector.is_bridge_contract(None) is False
    assert detector.get_bridge_protocol("") is None
    assert detector.get_bridge_protocol(None) is None


# ---------------------------------------------------------------------------
# Transaction Inspection
# ---------------------------------------------------------------------------


def test_inspect_bridge_transaction(detector):
    """Verify inspect() identifies bridge transactions and extracts metadata."""
    tx = NormalizedTransaction(
        tx_hash="0xbridge_tx_hash",
        chain="ethereum",
        block_number=18000000,
        timestamp=datetime(2025, 6, 15, tzinfo=timezone.utc),
        from_address="0xsender",
        to_address="0x3ee18b2214aff97000d974cf647e7c347e8fa585",  # Wormhole
        asset_type="ETH",
        token_symbol="ETH",
        amount=5.0,
    )

    result = detector.inspect(tx, current_chain="ethereum")
    assert result is not None
    assert result.is_bridge is True
    assert result.protocol == "Wormhole"
    assert result.source_chain == "ethereum"
    assert result.destination_chain is not None
    assert result.amount == 5.0


def test_inspect_non_bridge_transaction(detector):
    """Verify inspect() returns None for non-bridge transactions."""
    tx = NormalizedTransaction(
        tx_hash="0xnormal_tx_hash",
        chain="ethereum",
        block_number=18000000,
        timestamp=datetime(2025, 6, 15, tzinfo=timezone.utc),
        from_address="0xsender",
        to_address="0x1234567890abcdef1234567890abcdef12345678",
        asset_type="ETH",
        token_symbol="ETH",
        amount=1.0,
    )

    result = detector.inspect(tx)
    assert result is None


def test_inspect_with_explicit_bridge_metadata(detector):
    """Verify inspect() handles transactions with pre-populated bridge metadata."""
    tx = NormalizedTransaction(
        tx_hash="0xpre_bridge_tx",
        chain="ethereum",
        block_number=18000000,
        timestamp=datetime(2025, 6, 15, tzinfo=timezone.utc),
        from_address="0xsender",
        to_address="0x3ee18b2214aff97000d974cf647e7c347e8fa585",
        asset_type="ETH",
        token_symbol="ETH",
        amount=3.0,
        is_bridge=True,
        bridge_protocol="Wormhole",
        destination_chain="solana",
        destination_address="5tzFkiKscMRHK5ZXWBZXZUXJwomD5pmQV82QEGxmqVCe",
    )

    result = detector.inspect(tx)
    assert result is not None
    assert result.is_bridge is True
    assert result.protocol == "Wormhole"
    assert result.destination_chain == "solana"
    assert result.destination_address == "5tzFkiKscMRHK5ZXWBZXZUXJwomD5pmQV82QEGxmqVCe"


# ---------------------------------------------------------------------------
# analyze_tx() compliance format
# ---------------------------------------------------------------------------


def test_analyze_tx_bridge(detector):
    """Verify analyze_tx returns standardized bridge result dict."""
    tx = NormalizedTransaction(
        tx_hash="0xbridge_analysis",
        chain="ethereum",
        block_number=18000000,
        timestamp=datetime(2025, 6, 15, tzinfo=timezone.utc),
        from_address="0xsender",
        to_address="0x8731d54e9d02c215207d57053ef090b40e241071",  # Stargate
        asset_type="ETH",
        token_symbol="ETH",
        amount=2.0,
    )

    result = detector.analyze_tx(tx)
    assert result["is_bridge"] is True
    assert result["protocol"] == "Stargate"
    assert result["dest_chain"] is not None
    assert "bridge_contract" in result


def test_analyze_tx_non_bridge(detector):
    """Verify analyze_tx returns non-bridge result for normal transactions."""
    tx = NormalizedTransaction(
        tx_hash="0xnormal_analysis",
        chain="ethereum",
        block_number=18000000,
        timestamp=datetime(2025, 6, 15, tzinfo=timezone.utc),
        from_address="0xsender",
        to_address="0xreceiver",
        asset_type="ETH",
        token_symbol="ETH",
        amount=1.0,
    )

    result = detector.analyze_tx(tx)
    assert result["is_bridge"] is False
    assert result["protocol"] is None
    assert result["dest_chain"] is None


# ---------------------------------------------------------------------------
# Wormhole Recipient Decoding
# ---------------------------------------------------------------------------


def test_wormhole_evm_recipient_decode(detector):
    """Verify Wormhole recipient decoding for EVM chains (last 20 bytes)."""
    # 32-byte hex with EVM address in last 20 bytes
    recipient_hex = "0x000000000000000000000000d8da6bf26964af9d7ee9572d2f3c1a8f7a8ca6f2"
    decoded = detector.decode_wormhole_recipient(recipient_hex, "ethereum")
    assert decoded.startswith("0x")
    assert len(decoded) == 42  # 0x + 40 hex chars


def test_wormhole_solana_recipient_decode(detector):
    """Verify Wormhole recipient decoding for Solana (Base58 of full 32 bytes)."""
    # 32-byte zero-padded hex -> should decode to Base58
    recipient_hex = "0x" + "01" * 32  # 32 bytes all 0x01
    decoded = detector.decode_wormhole_recipient(recipient_hex, "solana")
    assert len(decoded) > 30  # Solana addresses are typically 32-44 chars


# ---------------------------------------------------------------------------
# Chain ID Lookups
# ---------------------------------------------------------------------------


def test_wormhole_chain_id_lookups():
    """Verify Wormhole chain ID to chain name mapping."""
    assert WORMHOLE_CHAIN_IDS[1] == "solana"
    assert WORMHOLE_CHAIN_IDS[2] == "ethereum"
    assert WORMHOLE_CHAIN_IDS[4] == "bsc"
    assert WORMHOLE_CHAIN_IDS[5] == "polygon"


def test_layerzero_chain_id_lookups():
    """Verify LayerZero chain ID to chain name mapping."""
    assert LAYERZERO_CHAIN_IDS[101] == "ethereum"
    assert LAYERZERO_CHAIN_IDS[109] == "polygon"
    assert LAYERZERO_CHAIN_IDS[110] == "arbitrum"


def test_across_chain_id_lookups():
    """Verify Across chain ID to chain name mapping."""
    assert ACROSS_CHAIN_IDS[1] == "ethereum"
    assert ACROSS_CHAIN_IDS[137] == "polygon"
    assert ACROSS_CHAIN_IDS[42161] == "arbitrum"


# ---------------------------------------------------------------------------
# Global Singleton
# ---------------------------------------------------------------------------


def test_global_singleton():
    """Verify bridge_detector is a global singleton with loaded registries."""
    assert bridge_detector is not None
    assert isinstance(bridge_detector, BridgeDetector)
    # Should detect known bridge contracts
    assert bridge_detector.is_bridge_contract(
        "0x3ee18b2214aff97000d974cf647e7c347e8fa585"
    )


def test_bridge_registry_coverage():
    """Verify bridge registries have sufficient coverage."""
    total_contracts = (
        len(WORMHOLE_CONTRACTS) +
        len(STARGATE_CONTRACTS) +
        len(ACROSS_CONTRACTS) +
        len(CELER_CONTRACTS) +
        len(SYNAPSE_CONTRACTS)
    )
    assert total_contracts >= 20, f"Expected >= 20 bridge contracts, got {total_contracts}"
