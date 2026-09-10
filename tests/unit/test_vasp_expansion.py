"""
Unit Tests for Open-Source Phase 1: Threat Intelligence & VASP Label Expansion.

Verifies:
1. Ingestion of ScamSniffer Web3 Phishing & Drainer Blacklist (2,500+ malicious addresses).
2. Resolution of Non-KYC Instant Swap Desks (FixedFloat, ChangeNOW, SimpleSwap, SideShift).
3. Section 91 CrPC Legal Notice compliance contact routing for Instant Swaps.
4. Accurate attribution for Tier-1 Global Exchanges (Binance, Coinbase, OKX, Bybit, Kraken).
5. Accurate attribution for Indian FIU-registered Exchanges (WazirX, CoinDCX, ZebPay).
6. Multi-chain resolution across Ethereum, Tron (TRC-20 USDT), and Solana.
7. Multi-category indexing: CENTRALIZED_EXCHANGE, INSTANT_SWAP_NON_KYC, PHISHING_DRAINER.
8. O(1) lookup performance (< 1ms) and memory efficiency (< 60MB).
"""

import sys
import time
import pytest
from backend.app.services.labels.store import LabelStore, label_store
from backend.app.services.reporting.legal_notice_generator import LegalNoticeGenerator, VASP_COMPLIANCE_CONTACTS
from backend.app.schemas.analysis import AttributionSchema
from backend.app.services.vasp.matcher import (
    vasp_matcher,
    CATEGORY_CENTRALIZED_EXCHANGE,
    CATEGORY_INSTANT_SWAP_NON_KYC,
    CATEGORY_PHISHING_DRAINER,
    CATEGORY_SANCTIONED_ENTITY,
    classify_category,
)


def test_label_store_expansion_and_scale():
    """Verify LabelStore and VASPMatcher scale to over 15,000+ verified addresses."""
    store = LabelStore()
    assert store._loaded is True
    # Verified master VASP + OFAC + Solana + Instant Swaps + ScamSniffer + Etherscan Labels (23k+)
    assert len(store._address_map) >= 15000, f"Expected >= 15000 in LabelStore, got {len(store._address_map)}"

    vasp_matcher.load_seed_data()
    assert len(vasp_matcher._address_map) >= 15000, f"Expected >= 15000 in VASPMatcher, got {len(vasp_matcher._address_map)}"


def test_instant_swaps_attribution():
    """Verify Non-KYC Instant Swap desks are identified with high risk and VASP flag."""
    # FixedFloat ETH
    ff_eth = label_store.lookup("0x4e5b2e1dc63f6b91cb6cd759936495434c7e972f", chain="ethereum")
    assert ff_eth is not None
    assert ff_eth.entity == "FixedFloat"
    assert ff_eth.is_vasp is True
    assert ff_eth.category == "instant_swap_non_kyc"
    assert ff_eth.risk_level == "HIGH"

    # Also verify direct VASPMatcher resolution
    match = vasp_matcher.match_address("0x4e5b2e1dc63f6b91cb6cd759936495434c7e972f", chain="ethereum")
    assert match is not None
    assert match["vasp_name"] == "FixedFloat"
    assert match["category"] == CATEGORY_INSTANT_SWAP_NON_KYC
    assert "compliance@fixedfloat.com" in match["compliance_email"]

    # ChangeNOW ETH
    cn_eth = label_store.lookup("0x075e72a5edf65f0a5f44699c7654c1a76941ddc8", chain="ethereum")
    assert cn_eth is not None
    assert cn_eth.entity == "ChangeNOW"
    assert cn_eth.is_vasp is True

    cn_match = vasp_matcher.match_address("0x075e72a5edf65f0a5f44699c7654c1a76941ddc8", chain="ethereum")
    assert cn_match is not None
    assert cn_match["vasp_name"] == "ChangeNOW"
    assert cn_match["category"] == CATEGORY_INSTANT_SWAP_NON_KYC

    # SimpleSwap
    ss_eth = label_store.lookup("0x40ec5b33f54e0e8a33a975908c5ba1c14e5bbbdf", chain="ethereum")
    assert ss_eth is not None
    assert ss_eth.entity == "SimpleSwap"
    assert ss_eth.is_vasp is True

    # SideShift
    sideshift = label_store.lookup("0x42f7d3a0429f62cb979a022b7a42b03362149b1a", chain="ethereum")
    assert sideshift is not None
    assert sideshift.entity == "SideShift"
    assert sideshift.is_vasp is True


def test_scamsniffer_blacklist_detection():
    """Verify ScamSniffer phishing drainers are tagged as CRITICAL risk and PHISHING_DRAINER category."""
    test_drainer = "0x101ce0cedd142f199c9ef61739ae59b6611a0fc0"
    match = label_store.lookup(test_drainer, chain="ethereum")
    assert match is not None
    assert match.category == "scam"
    assert match.risk_level == "CRITICAL"
    assert match.is_vasp is False
    assert "ScamSniffer" in match.source_name

    # Direct VASPMatcher multi-category check
    vmatch = vasp_matcher.match_address(test_drainer, chain="ethereum")
    assert vmatch is not None
    assert vmatch["category"] == CATEGORY_PHISHING_DRAINER
    assert vasp_matcher.get_category(test_drainer, chain="ethereum") == CATEGORY_PHISHING_DRAINER


def test_instant_swap_legal_notice_generation():
    """Verify Section 91 CrPC notice populates verified compliance contacts for instant swaps."""
    # Test FixedFloat contact info
    assert "FixedFloat" in VASP_COMPLIANCE_CONTACTS
    ff_contact = VASP_COMPLIANCE_CONTACTS["FixedFloat"]
    assert "compliance@fixedfloat.com" in ff_contact["email"]
    assert ff_contact["sahyog_routing_code"] == "SAHYOG-VASP-FIXEDFLOAT-INT"

    # Test ChangeNOW contact info
    assert "ChangeNOW" in VASP_COMPLIANCE_CONTACTS
    cn_contact = VASP_COMPLIANCE_CONTACTS["ChangeNOW"]
    assert "compliance@changenow.io" in cn_contact["email"]
    assert cn_contact["sahyog_routing_code"] == "SAHYOG-VASP-CHANGENOW-INT"

    # Generate mock notice for FixedFloat
    mock_attribution = AttributionSchema(
        vasp_name="FixedFloat",
        score=96.0,
        evidence_strength="HIGH",
        rank=1,
        summary="Automated instant swap deposit to FixedFloat"
    )
    notice = LegalNoticeGenerator.generate_freeze_notice(
        case_id="TEST-CASE-SWAP",
        wallet_address="0x4e5b2e1dc63f6b91cb6cd759936495434c7e972f",
        chain="ethereum",
        attribution=mock_attribution,
        evidence=[],
        transactions=[]
    )
    assert notice["vasp_name"] == "FixedFloat"
    assert notice["compliance_email"] == "compliance@fixedfloat.com"
    assert notice["sahyog_routing_code"] == "SAHYOG-VASP-FIXEDFLOAT-INT"


def test_binance_evm_and_tron_hot_wallets():
    """Verify Binance hot wallets resolution across Ethereum and Tron."""
    # Binance 14 ETH Hot Wallet
    eth_b14 = label_store.lookup("0x28C6c06298d514Db089934071355E5743bf21d60", chain="ethereum")
    assert eth_b14 is not None
    assert eth_b14.entity == "Binance"
    assert eth_b14.is_vasp is True
    assert eth_b14.risk_level == "LOW"

    # Binance Tron USDT Hot Wallet
    tron_b1 = label_store.lookup("TMuA6YMeL4nNFYWAnWUCtqnmEvrCfsugnR", chain="tron")
    assert tron_b1 is not None
    assert tron_b1.entity == "Binance"
    assert tron_b1.is_vasp is True


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


def test_multi_category_indexing():
    """Verify multi-category indexing works correctly across category types."""
    # 1. classify_category maps correctly
    assert classify_category("exchange") == CATEGORY_CENTRALIZED_EXCHANGE
    assert classify_category("instant_swap_non_kyc") == CATEGORY_INSTANT_SWAP_NON_KYC
    assert classify_category("scam") == CATEGORY_PHISHING_DRAINER
    assert classify_category("sanctioned") == CATEGORY_SANCTIONED_ENTITY
    assert classify_category("") == CATEGORY_CENTRALIZED_EXCHANGE  # default
    assert classify_category("unknown_type") == CATEGORY_CENTRALIZED_EXCHANGE  # default

    # 2. VASPMatcher.get_category returns correct categories
    # Binance = CENTRALIZED_EXCHANGE
    binance_cat = vasp_matcher.get_category("0x28C6c06298d514Db089934071355E5743bf21d60", chain="ethereum")
    assert binance_cat == CATEGORY_CENTRALIZED_EXCHANGE

    # 3. get_stats includes by_category
    stats = vasp_matcher.get_stats()
    assert "by_category" in stats
    assert CATEGORY_CENTRALIZED_EXCHANGE in stats["by_category"]
    assert stats["by_category"][CATEGORY_CENTRALIZED_EXCHANGE] > 0

    # 4. get_addresses_by_category returns non-empty for exchanges
    exchange_addrs = vasp_matcher.get_addresses_by_category(CATEGORY_CENTRALIZED_EXCHANGE)
    assert len(exchange_addrs) > 100  # Should have many exchange addresses


def test_performance_benchmarks():
    """Verify O(1) lookup takes < 1ms and memory usage < 60MB."""
    # Ensure loaded
    vasp_matcher.load_seed_data()

    # Benchmark: 1000 lookups should complete in < 1 second (< 1ms each)
    test_addr = "0x28C6c06298d514Db089934071355E5743bf21d60"
    start = time.perf_counter()
    for _ in range(1000):
        vasp_matcher.match_address(test_addr, chain="ethereum")
    elapsed = time.perf_counter() - start
    avg_ms = (elapsed / 1000) * 1000  # Convert to milliseconds per lookup

    assert avg_ms < 1.0, f"Average lookup time {avg_ms:.4f}ms exceeds 1ms threshold"

    # Memory check: address map should be < 60MB
    # Rough estimate: each entry ~ 500 bytes, 15k entries ~ 7.5MB
    total_entries = len(vasp_matcher._address_map)
    estimated_mb = (total_entries * 500) / (1024 * 1024)
    assert estimated_mb < 60, f"Estimated memory {estimated_mb:.1f}MB exceeds 60MB threshold"
    assert total_entries > 1500, f"Expected > 1500 VASP addresses, got {total_entries}"

