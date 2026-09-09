"""
Unit tests for Cross-Chain BridgeDetector (Phase 4).
"""

import pytest
from datetime import datetime, timezone
from backend.app.schemas.analysis import NormalizedTransaction
from backend.app.services.bridge.detector import bridge_detector, BridgeDetector


def test_bridge_contract_recognition():
    # Wormhole contracts
    wormhole_eth = "0x3ee18B2214AFF97000D974cf647E7C347E8fa585"
    wormhole_sol = "wormDTUJ6AWPNvk59vGQbDvGJmqbDTdgWgAqcLBCgUb"
    assert bridge_detector.is_bridge_contract(wormhole_eth) is True
    assert bridge_detector.get_bridge_protocol(wormhole_eth) == "Wormhole"
    assert bridge_detector.is_bridge_contract(wormhole_sol) is True
    assert bridge_detector.get_bridge_protocol(wormhole_sol) == "Wormhole"

    # Stargate contracts
    stargate_router = "0x8731d54E9D02c215207d57053eF090b40e241071"
    assert bridge_detector.is_bridge_contract(stargate_router) is True
    assert bridge_detector.get_bridge_protocol(stargate_router) == "Stargate"

    # Across contracts
    across_spoke = "0x5c7BCd6E7De5423a257D81B442095A1a6ced35C5"
    assert bridge_detector.is_bridge_contract(across_spoke) is True
    assert bridge_detector.get_bridge_protocol(across_spoke) == "Across"

    # Non-bridge address
    regular_addr = "0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045"
    assert bridge_detector.is_bridge_contract(regular_addr) is False
    assert bridge_detector.get_bridge_protocol(regular_addr) is None


def test_wormhole_recipient_decoding():
    detector = BridgeDetector()

    # 32-byte hex for a Solana public key: 9WzDXwBbmkg8ZTbNMqUxvQRAyrZzDsGYdLVL9zYtAWWM
    sol_addr = "9WzDXwBbmkg8ZTbNMqUxvQRAyrZzDsGYdLVL9zYtAWWM"
    from backend.app.core.address_validator import b58decode
    raw_bytes = b58decode(sol_addr)
    hex_payload = f"0x{raw_bytes.hex()}"

    decoded_sol = detector.decode_wormhole_recipient(hex_payload, target_chain="solana")
    assert decoded_sol == sol_addr

    # 32-byte hex for an EVM address: 0x28c6c06298d514db089934071355e5743bf21d60
    evm_addr = "0x28c6c06298d514db089934071355e5743bf21d60"
    raw_evm_bytes = bytes.fromhex(evm_addr[2:]).rjust(32, b"\x00")
    decoded_evm = detector.decode_wormhole_recipient(f"0x{raw_evm_bytes.hex()}", target_chain="ethereum")
    assert decoded_evm.lower() == evm_addr.lower()


def test_analyze_tx_validation_criteria():
    """
    Direct verification of Phase 4 validation criteria:
    bridge_detector.analyze_tx(tx) returns {"is_bridge": True, "protocol": "Wormhole", "dest_chain": "solana", "recipient": "..."}
    """
    wormhole_eth = "0x3ee18B2214AFF97000D974cf647E7C347E8fa585"
    sol_recipient = "9WzDXwBbmkg8ZTbNMqUxvQRAyrZzDsGYdLVL9zYtAWWM"

    tx = NormalizedTransaction(
        tx_hash="0x7f8a9b...",
        chain="ethereum",
        block_number=19000000,
        timestamp=datetime.now(timezone.utc),
        from_address="0x1234567890123456789012345678901234567890",
        to_address=wormhole_eth,
        asset_type="ERC20",
        token_symbol="USDT",
        amount=10000.0,
        is_bridge=True,
        bridge_protocol="Wormhole",
        destination_chain="solana",
        destination_address=sol_recipient,
    )

    result = bridge_detector.analyze_tx(tx)
    assert result["is_bridge"] is True
    assert result["protocol"] == "Wormhole"
    assert result["dest_chain"] == "solana"
    assert result["recipient"] == sol_recipient
    assert result["amount"] == 10000.0


def test_analyze_tx_non_bridge():
    tx = NormalizedTransaction(
        tx_hash="0xabcdef...",
        chain="ethereum",
        block_number=19000001,
        timestamp=datetime.now(timezone.utc),
        from_address="0x1111111111111111111111111111111111111111",
        to_address="0x2222222222222222222222222222222222222222",
        asset_type="ETH",
        amount=1.5,
    )

    result = bridge_detector.analyze_tx(tx)
    assert result["is_bridge"] is False
    assert result["protocol"] is None
    assert result["dest_chain"] is None
    assert result["recipient"] is None


def test_inspect_stargate_and_across():
    stargate_router = "0x8731d54E9D02c215207d57053eF090b40e241071"
    tx_stargate = NormalizedTransaction(
        tx_hash="0xsg123",
        chain="ethereum",
        block_number=19000002,
        timestamp=datetime.now(timezone.utc),
        from_address="0x3333333333333333333333333333333333333333",
        to_address=stargate_router,
        asset_type="ERC20",
        token_symbol="USDC",
        amount=500.0,
        destination_chain="polygon",
        destination_address="0x4444444444444444444444444444444444444444",
    )

    info = bridge_detector.inspect(tx_stargate)
    assert info is not None
    assert info.is_bridge is True
    assert info.protocol == "Stargate"
    assert info.destination_chain == "polygon"
    assert info.destination_address == "0x4444444444444444444444444444444444444444"
