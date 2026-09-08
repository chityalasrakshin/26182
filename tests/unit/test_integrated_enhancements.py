"""
Comprehensive test suite for all integrated enhancements.

Tests:
1. Bitcoin address validation and provider transaction normalization
2. Multi-EVM chain address detection and factory routing
3. FIFO taint calculation logic on sample transactions
4. 11-signal risk engine evaluation with peel chain and mixer detection
5. ReportLab PDF generation and byte buffer validation
6. FIU-IND legal notice dispatch formatting
7. Historical price service caching logic
"""

import pytest
import asyncio
from datetime import datetime, timezone, timedelta
from unittest.mock import AsyncMock, patch, MagicMock

import networkx as nx


# ==============================================================================
# 1. Bitcoin Address Validation Tests
# ==============================================================================

class TestBitcoinAddressValidation:
    """Test Bitcoin address detection (Legacy, P2SH, Bech32)."""

    def test_valid_btc_legacy_address(self):
        from backend.app.core.address_validator import is_valid_btc_address
        assert is_valid_btc_address("1A1zP1eP5QGefi2DMPTfTL5SLmv7DivfNa") is True

    def test_valid_btc_p2sh_address(self):
        from backend.app.core.address_validator import is_valid_btc_address
        assert is_valid_btc_address("3J98t1WpEZ73CNmQviecrnyiWrnqRhWNLy") is True

    def test_valid_btc_bech32_address(self):
        from backend.app.core.address_validator import is_valid_btc_address
        assert is_valid_btc_address("bc1qw508d6qejxtdg4y5r3zarvary0c5xw7kv8f3t4") is True

    def test_invalid_btc_address(self):
        from backend.app.core.address_validator import is_valid_btc_address
        assert is_valid_btc_address("0x742d35Cc6634C0532925a3b844Bc9e7595f2bD28") is False
        assert is_valid_btc_address("") is False
        assert is_valid_btc_address(None) is False

    def test_detect_blockchain_btc(self):
        from backend.app.core.address_validator import detect_blockchain
        assert detect_blockchain("1A1zP1eP5QGefi2DMPTfTL5SLmv7DivfNa") == "bitcoin"
        assert detect_blockchain("3J98t1WpEZ73CNmQviecrnyiWrnqRhWNLy") == "bitcoin"
        assert detect_blockchain("bc1qw508d6qejxtdg4y5r3zarvary0c5xw7kv8f3t4") == "bitcoin"

    def test_detect_blockchain_eth(self):
        from backend.app.core.address_validator import detect_blockchain
        assert detect_blockchain("0x742d35Cc6634C0532925a3b844Bc9e7595f2bD28") == "ethereum"

    def test_detect_blockchain_tron(self):
        from backend.app.core.address_validator import detect_blockchain
        assert detect_blockchain("TMuA6YMeL4nNFYWAnWUCtqnmEvrCfsugnR") == "tron"

    def test_is_valid_crypto_address_btc(self):
        from backend.app.core.address_validator import is_valid_crypto_address
        assert is_valid_crypto_address("1A1zP1eP5QGefi2DMPTfTL5SLmv7DivfNa") is True
        assert is_valid_crypto_address("bc1qw508d6qejxtdg4y5r3zarvary0c5xw7kv8f3t4") is True

    def test_get_btc_address_type(self):
        from backend.app.core.address_validator import get_btc_address_type
        assert get_btc_address_type("1A1zP1eP5QGefi2DMPTfTL5SLmv7DivfNa") == "legacy"
        assert get_btc_address_type("3J98t1WpEZ73CNmQviecrnyiWrnqRhWNLy") == "p2sh"
        assert get_btc_address_type("bc1qw508d6qejxtdg4y5r3zarvary0c5xw7kv8f3t4") == "bech32"
        assert get_btc_address_type("0xabc") is None

    def test_normalize_btc_bech32(self):
        from backend.app.core.address_validator import normalize_address
        addr = "bc1qw508d6qejxtdg4y5r3zarvary0c5xw7kv8f3t4"
        assert normalize_address(addr) == addr.lower()

    def test_detect_evm_chain(self):
        from backend.app.core.address_validator import detect_evm_chain
        assert detect_evm_chain("polygon") == "137"
        assert detect_evm_chain("bsc") == "56"
        assert detect_evm_chain("arbitrum") == "42161"
        assert detect_evm_chain("ethereum") == "1"
        assert detect_evm_chain("unknown") is None


# ==============================================================================
# 2. Blockchain Provider Factory Tests
# ==============================================================================

class TestBlockchainProviderFactory:
    """Test multi-chain provider factory routing."""

    def test_factory_returns_bitcoin_provider_by_name(self):
        from backend.app.services.blockchain.factory import BlockchainProviderFactory
        from backend.app.services.blockchain.bitcoin import BitcoinProvider
        provider = BlockchainProviderFactory.get_provider("bitcoin")
        assert isinstance(provider, BitcoinProvider)

    def test_factory_returns_bitcoin_provider_by_address(self):
        from backend.app.services.blockchain.factory import BlockchainProviderFactory
        from backend.app.services.blockchain.bitcoin import BitcoinProvider
        provider = BlockchainProviderFactory.get_provider("1A1zP1eP5QGefi2DMPTfTL5SLmv7DivfNa")
        assert isinstance(provider, BitcoinProvider)

    def test_factory_returns_tron_provider(self):
        from backend.app.services.blockchain.factory import BlockchainProviderFactory
        from backend.app.services.blockchain.tron import TronProvider
        provider = BlockchainProviderFactory.get_provider("tron")
        assert isinstance(provider, TronProvider)

    def test_factory_returns_etherscan_provider_for_polygon(self):
        from backend.app.services.blockchain.factory import BlockchainProviderFactory
        from backend.app.services.blockchain.etherscan import EtherscanProvider
        provider = BlockchainProviderFactory.get_provider("polygon")
        assert isinstance(provider, EtherscanProvider)
        assert provider.chain_id == "137"

    def test_factory_returns_etherscan_provider_for_bsc(self):
        from backend.app.services.blockchain.factory import BlockchainProviderFactory
        from backend.app.services.blockchain.etherscan import EtherscanProvider
        provider = BlockchainProviderFactory.get_provider("bsc")
        assert isinstance(provider, EtherscanProvider)
        assert provider.chain_id == "56"

    def test_factory_returns_etherscan_default(self):
        from backend.app.services.blockchain.factory import BlockchainProviderFactory
        from backend.app.services.blockchain.etherscan import EtherscanProvider
        provider = BlockchainProviderFactory.get_provider("ethereum")
        assert isinstance(provider, EtherscanProvider)

    def test_factory_supported_chains(self):
        from backend.app.services.blockchain.factory import BlockchainProviderFactory
        chains = BlockchainProviderFactory.get_supported_chains()
        assert "bitcoin" in chains
        assert "ethereum" in chains
        assert "polygon" in chains
        assert "bsc" in chains


# ==============================================================================
# 3. FIFO Taint Calculation Tests
# ==============================================================================

class TestFIFOTaintEngine:
    """Test FIFO taint tracking algorithm."""

    def test_basic_taint_propagation(self):
        from backend.app.services.attribution.fifo_taint import FIFOTaintEngine

        engine = FIFOTaintEngine()

        transactions = [
            {
                "from_address": "suspect_wallet",
                "to_address": "intermediary_1",
                "amount": 10.0,
                "tx_hash": "tx1",
                "timestamp": "2024-01-01T10:00:00Z",
                "token_symbol": "ETH",
            },
            {
                "from_address": "intermediary_1",
                "to_address": "exchange_deposit",
                "amount": 8.0,
                "tx_hash": "tx2",
                "timestamp": "2024-01-01T11:00:00Z",
                "token_symbol": "ETH",
            },
        ]

        annotations, summary = engine.compute_taint(
            transactions, ["suspect_wallet"]
        )

        assert len(annotations) == 2
        assert summary.total_transactions == 2
        assert summary.total_traceable > 0
        assert summary.overall_taint_ratio > 0

        # First tx: suspect sends 10 ETH → fully traceable
        assert annotations[0].traceable_amount == 10.0
        assert annotations[0].unclassified_amount == 0.0

        # Second tx: intermediary sends 8 out of 10 tainted → 8 traceable
        assert annotations[1].traceable_amount == 8.0
        assert annotations[1].unclassified_amount == 0.0

    def test_mixed_funds_taint(self):
        from backend.app.services.attribution.fifo_taint import FIFOTaintEngine

        engine = FIFOTaintEngine()

        transactions = [
            {
                "from_address": "suspect",
                "to_address": "mixer",
                "amount": 5.0,
                "tx_hash": "tx1",
                "timestamp": "2024-01-01T10:00:00Z",
                "token_symbol": "ETH",
            },
            {
                "from_address": "clean_source",
                "to_address": "mixer",
                "amount": 15.0,
                "tx_hash": "tx2",
                "timestamp": "2024-01-01T11:00:00Z",
                "token_symbol": "ETH",
            },
            {
                "from_address": "mixer",
                "to_address": "destination",
                "amount": 20.0,
                "tx_hash": "tx3",
                "timestamp": "2024-01-01T12:00:00Z",
                "token_symbol": "ETH",
            },
        ]

        annotations, summary = engine.compute_taint(
            transactions, ["suspect"]
        )

        assert len(annotations) == 3
        # The mixer received 5 tainted (from suspect). When mixer sends 20,
        # only 5 is traceable (FIFO conservative)
        assert annotations[2].traceable_amount == 5.0
        assert annotations[2].unclassified_amount == 15.0
        assert annotations[2].taint_ratio == pytest.approx(0.25, abs=0.01)

    def test_empty_transactions(self):
        from backend.app.services.attribution.fifo_taint import FIFOTaintEngine

        engine = FIFOTaintEngine()
        annotations, summary = engine.compute_taint([], ["suspect"])
        assert len(annotations) == 0
        assert summary.total_transactions == 0

    def test_convenience_function(self):
        from backend.app.services.attribution.fifo_taint import compute_fifo_taint

        txs = [
            {
                "from_address": "suspect",
                "to_address": "dest",
                "amount": 1.0,
                "tx_hash": "tx1",
                "timestamp": "2024-01-01T10:00:00Z",
            },
        ]
        annotations, summary = compute_fifo_taint(txs, ["suspect"])
        assert len(annotations) == 1
        assert summary.total_traceable == 1.0


# ==============================================================================
# 4. 11-Signal Risk Engine Tests
# ==============================================================================

class TestRiskClassifier:
    """Test the explainable 11-signal risk engine."""

    def _build_test_graph(
        self,
        nodes_count=10,
        edges_count=15,
        max_hop=3,
        include_mixer=False,
    ) -> nx.MultiDiGraph:
        """Helper to build a test graph."""
        G = nx.MultiDiGraph()
        root = "0xroot"
        G.add_node(root, hop=0, role="INPUT_WALLET")

        now = datetime.now(tz=timezone.utc)
        for i in range(1, nodes_count):
            hop = min(i, max_hop)
            G.add_node(f"0xnode_{i}", hop=hop, role=f"INTERMEDIARY_HOP_{hop}")

        for i in range(edges_count):
            src = f"0xnode_{i % nodes_count}" if i > 0 else root
            dst = f"0xnode_{(i + 1) % nodes_count}"
            G.add_edge(
                src, dst,
                tx_hash=f"0xtx_{i}",
                amount=round(1.0 + i * 0.5, 2),
                timestamp=now - timedelta(minutes=i * 5),
                hop=min(i, max_hop),
            )

        if include_mixer:
            mixer = "0xd90e2f925da726b50c4ed8d0fb90ad053324f31b"
            G.add_node(mixer, hop=2, role="INTERMEDIARY_HOP_2")
            G.add_edge(
                root, mixer,
                tx_hash="0xtx_mixer",
                amount=5.0,
                timestamp=now - timedelta(minutes=1),
                hop=1,
            )

        return G

    def test_low_risk_simple_graph(self):
        from backend.app.services.risk.classifier import RiskClassifier

        G = nx.MultiDiGraph()
        G.add_node("root", hop=0, role="INPUT_WALLET")
        G.add_node("dest", hop=1, role="KNOWN_VASP")

        now = datetime.now(tz=timezone.utc)
        G.add_edge("root", "dest", tx_hash="tx1", amount=1.0, timestamp=now, hop=1)

        result = RiskClassifier.evaluate_risk(G, "root")
        assert result.risk_level == "LOW"
        assert result.score <= 25

    def test_high_risk_complex_graph(self):
        from backend.app.services.risk.classifier import RiskClassifier

        G = self._build_test_graph(nodes_count=12, edges_count=25, max_hop=3)
        result = RiskClassifier.evaluate_risk(G, "0xroot")
        assert result.score > 0
        assert len(result.indicators) >= 1

    def test_mixer_detection(self):
        from backend.app.services.risk.classifier import RiskClassifier

        G = self._build_test_graph(include_mixer=True)
        result = RiskClassifier.evaluate_risk(G, "0xroot")

        # Should detect KNOWN_MIXER_INTERACTION
        mixer_indicators = [i for i in result.indicators if "mixer" in i.lower() or "Mixer" in i]
        assert len(mixer_indicators) >= 1

    def test_score_bounded_0_100(self):
        from backend.app.services.risk.classifier import RiskClassifier

        # Very complex graph
        G = self._build_test_graph(nodes_count=20, edges_count=50, max_hop=3, include_mixer=True)
        result = RiskClassifier.evaluate_risk(G, "0xroot")
        assert 0 <= result.score <= 100

    def test_risk_level_mapping(self):
        from backend.app.services.risk.classifier import RiskClassifier

        G = nx.MultiDiGraph()
        G.add_node("root", hop=0)
        result = RiskClassifier.evaluate_risk(G, "root")
        assert result.risk_level in ("LOW", "MEDIUM", "HIGH", "CRITICAL")

    def test_entity_signals(self):
        from backend.app.services.risk.classifier import RiskClassifier

        G = nx.MultiDiGraph()
        G.add_node("root", hop=0)
        G.add_node("sanctioned", hop=1)
        now = datetime.now(tz=timezone.utc)
        G.add_edge("root", "sanctioned", tx_hash="tx1", amount=10.0, timestamp=now, hop=1)

        result = RiskClassifier.evaluate_risk(
            G, "root", known_entities={"sanctioned": "SANCTIONED"}
        )
        assert result.score > 0
        sanctioned_hit = any("SANCTIONED" in i.upper() for i in result.indicators)
        assert sanctioned_hit


# ==============================================================================
# 5. PDF Generation Tests
# ==============================================================================

class TestPDFGenerator:
    """Test ReportLab PDF dossier generation."""

    def test_pdf_generation_produces_bytes(self):
        try:
            from backend.app.services.reporting.pdf_generator import PDFDossierGenerator
        except ImportError:
            pytest.skip("ReportLab not installed")

        generator = PDFDossierGenerator()
        pdf_bytes = generator.generate(
            case_id="test-case-12345678",
            wallet_address="0x742d35Cc6634C0532925a3b844Bc9e7595f2bD28",
            chain="Ethereum Mainnet",
            attributions=[
                {"rank": 1, "vasp_name": "Binance", "score": 87.5,
                 "evidence_strength": "High", "summary": "Direct deposit observed"},
            ],
            evidence=[
                {"evidence_type": "DIRECT_DEPOSIT", "strength": "HIGH",
                 "hop_distance": 1, "source_address": "0xabc",
                 "target_address": "0xdef", "tx_hash": "0xtx1",
                 "explanation": "Direct transfer to VASP"},
            ],
            risk_assessment={
                "risk_level": "HIGH",
                "score": 72.0,
                "explanation": "High risk indicators observed.",
                "indicators": ["Multi-hop layering detected"],
            },
            transactions=[],
            summary_stats={
                "total_edges": 15,
                "total_nodes": 8,
                "vasp_nodes_found": 2,
                "max_hop_reached": 3,
            },
        )

        assert isinstance(pdf_bytes, bytes)
        assert len(pdf_bytes) > 1000  # Minimum viable PDF size
        assert pdf_bytes[:5] == b"%PDF-"  # Valid PDF header

    def test_pdf_with_empty_data(self):
        try:
            from backend.app.services.reporting.pdf_generator import PDFDossierGenerator
        except ImportError:
            pytest.skip("ReportLab not installed")

        generator = PDFDossierGenerator()
        pdf_bytes = generator.generate(
            case_id="empty-test-00000000",
            wallet_address="0x0000000000000000000000000000000000000000",
        )

        assert isinstance(pdf_bytes, bytes)
        assert pdf_bytes[:5] == b"%PDF-"


# ==============================================================================
# 6. FIU-IND Legal Notice Tests
# ==============================================================================

class TestFIUINDLegalNotice:
    """Test enriched FIU-IND compliance contacts and legal notice generation."""

    def test_vasp_contacts_include_fiu_ind(self):
        from backend.app.services.reporting.legal_notice_generator import VASP_COMPLIANCE_CONTACTS

        for vasp in ["WazirX", "CoinDCX", "ZebPay", "Mudrex"]:
            assert vasp in VASP_COMPLIANCE_CONTACTS
            contact = VASP_COMPLIANCE_CONTACTS[vasp]
            assert "fiu_ind_registration" in contact
            assert "sahyog_routing_code" in contact
            assert "nodal_officer" in contact
            assert "designated_lea_email" in contact
            assert contact["fiu_ind_registration"].startswith("FIU-IND/VDA/")

    def test_freeze_notice_includes_bns_bnss_references(self):
        from backend.app.services.reporting.legal_notice_generator import LegalNoticeGenerator
        from backend.app.schemas.analysis import AttributionSchema, NormalizedTransaction

        attr = AttributionSchema(
            vasp_name="WazirX",
            score=85.0,
            evidence_strength="High",
            rank=1,
            summary="Direct deposit observed",
        )

        tx = NormalizedTransaction(
            tx_hash="0xtx123",
            chain="ethereum",
            block_number=12345,
            timestamp=datetime(2024, 1, 1, tzinfo=timezone.utc),
            from_address="0xsuspect",
            to_address="0xwazirx",
            asset_type="ETH",
            amount=1.0,
        )

        result = LegalNoticeGenerator.generate_freeze_notice(
            case_id="test-case",
            wallet_address="0xsuspect",
            chain="ethereum",
            attribution=attr,
            evidence=[],
            transactions=[tx],
        )

        assert "BNS" in result["notice_markdown"]
        assert "BNSS" in result["notice_markdown"]
        assert "318(4)" in result["notice_markdown"]
        assert "Section 66D" in result["notice_markdown"]
        assert "PMLA" in result["notice_markdown"]
        assert "FIU-IND" in result["notice_markdown"]
        assert "Sahyog" in result["notice_markdown"]

        # Check enriched return payload
        assert "fiu_ind_registration" in result
        assert "sahyog_routing_code" in result
        assert "nodal_officer" in result
        assert "statutory_references" in result
        assert len(result["statutory_references"]) >= 4


# ==============================================================================
# 7. Price Service Tests
# ==============================================================================

class TestPriceService:
    """Test historical crypto-to-fiat price valuation service."""

    def test_stablecoin_price(self):
        from backend.app.services.valuation.price_service import PriceService

        service = PriceService()
        loop = asyncio.new_event_loop()
        try:
            result = loop.run_until_complete(
                service.get_price_at_timestamp("USDT", datetime.now(tz=timezone.utc))
            )
            assert result["usd"] == 1.0
            assert result["inr"] == 83.0
        finally:
            loop.close()

    def test_unknown_symbol_returns_zeros(self):
        from backend.app.services.valuation.price_service import PriceService

        service = PriceService()
        loop = asyncio.new_event_loop()
        try:
            result = loop.run_until_complete(
                service.get_price_at_timestamp("UNKNOWN_TOKEN_XYZ", datetime.now(tz=timezone.utc))
            )
            assert result["usd"] == 0.0
            assert result["inr"] == 0.0
        finally:
            loop.close()

    def test_valuation_calculation(self):
        from backend.app.services.valuation.price_service import PriceService

        service = PriceService()
        loop = asyncio.new_event_loop()
        try:
            result = loop.run_until_complete(
                service.valuate_transaction(100.0, "USDT", datetime.now(tz=timezone.utc))
            )
            assert result["amount_usd"] == 100.0
            assert result["amount_inr"] == 8300.0
        finally:
            loop.close()

    def test_cache_stats(self):
        from backend.app.services.valuation.price_service import PriceService

        service = PriceService()
        stats = service.get_cache_stats()
        assert "cached_price_points" in stats
        assert stats["cached_price_points"] >= 0

    def test_singleton(self):
        from backend.app.services.valuation.price_service import get_price_service

        s1 = get_price_service()
        s2 = get_price_service()
        assert s1 is s2


# ==============================================================================
# 8. Bitcoin Provider Unit Tests
# ==============================================================================

class TestBitcoinProvider:
    """Test Bitcoin provider transaction normalization."""

    def test_parse_btc_transaction(self):
        from backend.app.services.blockchain.bitcoin import BitcoinProvider

        provider = BitcoinProvider()

        raw_tx = {
            "txid": "abc123def456",
            "vin": [
                {"prevout": {"scriptpubkey_address": "1SenderAddress1234567890123456", "value": 100000}}
            ],
            "vout": [
                {"scriptpubkey_address": "1RecipientAddr1234567890123456", "value": 50000},
                {"scriptpubkey_address": "1SenderAddress1234567890123456", "value": 49000},
            ],
            "status": {"confirmed": True, "block_height": 800000, "block_time": 1704067200},
        }

        txs = provider._parse_btc_transaction(raw_tx, "1SenderAddress1234567890123456")
        assert len(txs) == 1
        assert txs[0].chain == "bitcoin"
        assert txs[0].asset_type == "BTC"
        assert txs[0].amount == 50000 / 1e8

    def test_token_transfers_empty(self):
        from backend.app.services.blockchain.bitcoin import BitcoinProvider

        provider = BitcoinProvider()
        loop = asyncio.new_event_loop()
        try:
            result = loop.run_until_complete(
                provider.get_token_transfers("1A1zP1eP5QGefi2DMPTfTL5SLmv7DivfNa")
            )
            assert result == []
        finally:
            loop.close()


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
