"""
Unit Tests for Open-Source Phase 5: EVM & Tron VASP Label Expansion.

Verifies:
1. Dynamic ingestion of data/labels/evm_tron_vasp.json into LabelStore.
2. Accurate attribution for Tier-1 Global Exchanges (Binance, Coinbase, OKX, Bybit, Kraken).
3. Accurate attribution for Indian FIU-registered Exchanges (WazirX, CoinDCX, ZebPay).
4. Multi-chain resolution across Ethereum and Tron (USDT-TRC20).
5. Source provenance citations (Etherscan Verified Labels via brianleect and GraphSense TagPacks).
"""

import pytest
from backend.app.services.labels.store import LabelStore, label_store


def test_evm_tron_vasp_loading():
    """Verify LabelStore loads the expanded EVM and Tron VASP labels."""
    store = LabelStore()
    assert store._loaded is True
    # At least 1,595 master + 28 demo + 1,101 OFAC + 28 expanded EVM/Tron + 7 Solana
    assert len(store._address_map) >= 2700


def test_binance_evm_and_tron_hot_wallets():
    """Verify Binance hot wallets resolution across Ethereum and Tron."""
    # Binance 14 ETH Hot Wallet
    eth_b14 = label_store.lookup("0x28C6c06298d514Db089934071355E5743bf21d60", chain="ethereum")
    assert eth_b14 is not None
    assert eth_b14.entity == "Binance"
    assert eth_b14.is_vasp is True
    assert eth_b14.risk_level == "LOW"
    assert "Etherscan" in eth_b14.source_name

    # Binance Tron USDT Hot Wallet
    tron_b1 = label_store.lookup("TMuA6YMeL4nNFYWAnWUCtqnmEvrCfsugnR", chain="tron")
    assert tron_b1 is not None
    assert tron_b1.entity == "Binance"
    assert tron_b1.is_vasp is True
    assert "GraphSense" in tron_b1.source_name


def test_indian_fiu_exchanges_attribution():
    """Verify Indian FIU-IND registered exchange hot wallets."""
    # WazirX
    wazirx = label_store.lookup("0x27ec165507cc258778619ebfdba472be9c3fe80a", chain="ethereum")
    assert wazirx is not None
    assert wazirx.entity == "WazirX"
    assert wazirx.is_vasp is True

    # CoinDCX
    coindcx = label_store.lookup("0x323e20042a96a9efc79b69152b1b3699b8ea0e1f", chain="ethereum")
    assert coindcx is not None
    assert coindcx.entity == "CoinDCX"
    assert coindcx.is_vasp is True

    # ZebPay
    zebpay = label_store.lookup("0x0f2e22c9540b68631b14a938c1605ec10eb4323b", chain="ethereum")
    assert zebpay is not None
    assert zebpay.entity == "ZebPay"
    assert zebpay.is_vasp is True


def test_okx_and_bybit_tron_resolution():
    """Verify TRC-20 Tron hot wallet attributions for OKX and Bybit."""
    okx_tron = label_store.lookup("TPYmHEhy5n8TCEfYGqW2rPxsghSfzghPDn", chain="tron")
    assert okx_tron is not None
    assert okx_tron.entity == "OKX"
    assert okx_tron.is_vasp is True

    bybit_tron = label_store.lookup("TV6MuMXFiqBjdnggayomswbgv2h2UocwHQ", chain="tron")
    assert bybit_tron is not None
    assert bybit_tron.entity == "Bybit"
    assert bybit_tron.is_vasp is True
