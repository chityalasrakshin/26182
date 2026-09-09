"""
Unit tests for Multi-Chain Graph Traversal & Orchestrator Integration (Phase 5).
Validates cross-chain bridging (Ethereum -> Wormhole -> Solana) and terminal VASP attribution.
"""

import pytest
from datetime import datetime, timezone
from unittest.mock import AsyncMock, patch, MagicMock

from backend.app.schemas.analysis import NormalizedTransaction
from backend.app.schemas.trace import TraceEvent
from backend.app.services.trace.orchestrator import TraceOrchestrator
from backend.app.services.graph.builder import TransactionGraphBuilder
from backend.app.services.blockchain.factory import BlockchainProviderFactory


@pytest.fixture
def anyio_backend():
    return "asyncio"


@pytest.mark.anyio
async def test_cross_chain_orchestrator_traversal():
    """
    Test Ethereum Seed -> Wormhole Token Bridge -> Binance Solana Hot Wallet (terminal VASP).
    """
    seed_eth = "0xd8da6bf26964af9d7eed9e03e53415d37aa96045"
    wormhole_eth = "0x3ee18b2214aff97000d974cf647e7c347e8fa585"
    binance_sol = "5tzFkiKscMRHK5ZXWBZXZUXJwomD5pmQV82QEGxmqVCe"

    # Mock tx from seed to Wormhole with Solana recipient
    bridge_tx = NormalizedTransaction(
        tx_hash="0xabc123bridge",
        chain="ethereum",
        block_number=18000000,
        timestamp=datetime.now(timezone.utc),
        from_address=seed_eth,
        to_address=wormhole_eth,
        asset_type="ERC20",
        token_symbol="USDC",
        amount=50000.0,
        is_bridge=True,
        bridge_protocol="Wormhole",
        destination_chain="solana",
        destination_address=binance_sol
    )

    events = []
    async def capture_event(e: TraceEvent):
        events.append(e)

    # Mock providers
    mock_eth_provider = MagicMock()
    mock_eth_provider.get_outgoing_txs = AsyncMock(return_value=[bridge_tx])
    mock_eth_provider.get_address_activity = AsyncMock(return_value=[bridge_tx])

    mock_sol_provider = MagicMock()
    mock_sol_provider.get_outgoing_txs = AsyncMock(return_value=[])
    mock_sol_provider.get_address_activity = AsyncMock(return_value=[])

    def get_provider_side_effect(chain: str):
        if chain.lower() == "solana":
            return mock_sol_provider
        return mock_eth_provider

    with patch.object(BlockchainProviderFactory, "get_provider", side_effect=get_provider_side_effect):
        orchestrator = TraceOrchestrator(
            seed_address=seed_eth,
            chain="ethereum",
            max_depth=3,
            event_callback=capture_event
        )

        result = await orchestrator.run_trace()

    # 1. Assert result status and VASP detection
    assert result["status"] == "COMPLETED"
    assert result["vasp_found"] is True
    assert len(result["matched_vasps"]) == 1

    matched = result["matched_vasps"][0]
    assert matched["address"] == binance_sol
    assert matched["entity"] == "Binance"
    assert matched["chain"] == "solana"
    assert matched["hop"] == 2

    # 2. Verify emitted events
    event_names = [e.event for e in events]
    assert "JOB_STARTED" in event_names
    assert "CROSS_CHAIN_HOP_DETECTED" in event_names
    assert "VASP_REACHED" in event_names
    assert "TRACE_COMPLETED" in event_names

    # Check CROSS_CHAIN_HOP_DETECTED payload
    cross_event = next(e for e in events if e.event == "CROSS_CHAIN_HOP_DETECTED")
    assert cross_event.data["bridge_protocol"] == "Wormhole"
    assert cross_event.data["from_chain"] == "ethereum"
    assert cross_event.data["to_chain"] == "solana"
    assert cross_event.data["recipient"] == binance_sol

    # 3. Verify Cytoscape Graph Data Export
    graph_data = orchestrator.export_cytoscape_data()
    assert len(graph_data.nodes) >= 3

    # Check node roles and chains
    bridge_node = next(n for n in graph_data.nodes if n.data.id == wormhole_eth)
    assert bridge_node.data.role == "BRIDGE_PROTOCOL"
    assert bridge_node.data.chain == "ethereum"

    sol_vasp_node = next(n for n in graph_data.nodes if n.data.id == binance_sol)
    assert sol_vasp_node.data.is_vasp is True
    assert sol_vasp_node.data.vasp_name == "Binance"
    assert sol_vasp_node.data.chain == "solana"

    # Check cross-chain edge
    cross_edge = next(e for e in graph_data.edges if e.data.is_cross_chain)
    assert cross_edge.data.source == wormhole_eth
    assert cross_edge.data.target == binance_sol
    assert cross_edge.data.bridge_protocol == "Wormhole"
    assert cross_edge.data.source_chain == "ethereum"
    assert cross_edge.data.target_chain == "solana"


@pytest.mark.anyio
async def test_multi_chain_3hop_traversal_to_solana_vasp():
    """
    Test 3-hop trace:
    Hop 0: Seed Ethereum Wallet
    Hop 1: Wormhole Bridge Contract
    Hop 2: Intermediate Solana Recipient (Unlabeled)
    Hop 3: Kraken Solana Hot Wallet (Terminal VASP)
    """
    seed_eth = "0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa"
    wormhole_eth = "0x3ee18b2214aff97000d974cf647e7c347e8fa585"
    interm_sol = "7xKXtg2CW87d97TXJSDpbD5jBkheTqA83TZRuJosgAsU"
    kraken_sol = "FWznbcNXWQuHTawe9RxvQ2LdJF24zVnSZTGpzZMnLnh8"

    tx1_bridge = NormalizedTransaction(
        tx_hash="0xbridge001",
        chain="ethereum",
        block_number=19000000,
        timestamp=datetime.now(timezone.utc),
        from_address=seed_eth,
        to_address=wormhole_eth,
        asset_type="ERC20",
        token_symbol="USDT",
        amount=10000.0,
        is_bridge=True,
        bridge_protocol="Wormhole",
        destination_chain="solana",
        destination_address=interm_sol
    )

    tx2_sol = NormalizedTransaction(
        tx_hash="sol_tx_002",
        chain="solana",
        block_number=250000000,
        timestamp=datetime.now(timezone.utc),
        from_address=interm_sol,
        to_address=kraken_sol,
        asset_type="SPL",
        token_symbol="USDT",
        amount=9990.0
    )

    mock_eth_provider = MagicMock()
    mock_eth_provider.get_outgoing_txs = AsyncMock(return_value=[tx1_bridge])
    mock_eth_provider.get_address_activity = AsyncMock(return_value=[tx1_bridge])

    mock_sol_provider = MagicMock()
    mock_sol_provider.get_outgoing_txs = AsyncMock(return_value=[tx2_sol])
    mock_sol_provider.get_address_activity = AsyncMock(return_value=[tx2_sol])

    def get_provider_side_effect(chain: str):
        if chain.lower() == "solana":
            return mock_sol_provider
        return mock_eth_provider

    with patch.object(BlockchainProviderFactory, "get_provider", side_effect=get_provider_side_effect):
        orchestrator = TraceOrchestrator(
            seed_address=seed_eth,
            chain="ethereum",
            max_depth=4
        )

        result = await orchestrator.run_trace()

    assert result["vasp_found"] is True
    assert len(result["matched_vasps"]) == 1

    matched = result["matched_vasps"][0]
    assert matched["address"] == kraken_sol
    assert matched["entity"] == "Kraken"
    assert matched["chain"] == "solana"
    assert matched["hop"] == 3


@pytest.mark.anyio
async def test_cross_chain_graph_builder():
    """
    Test TransactionGraphBuilder handles cross-chain bridge hopping.
    """
    seed_eth = "0x1111111111111111111111111111111111111111"
    wormhole_eth = "0x3ee18b2214aff97000d974cf647e7c347e8fa585"
    binance_sol = "9WzDXwBbmkg8ZTbNMqUxvQRAyrZzDsGYdLVL9zYtAWWM"

    bridge_tx = NormalizedTransaction(
        tx_hash="0xtxbuilder001",
        chain="ethereum",
        block_number=19500000,
        timestamp=datetime.now(timezone.utc),
        from_address=seed_eth,
        to_address=wormhole_eth,
        asset_type="ERC20",
        token_symbol="USDC",
        amount=25000.0,
        is_bridge=True,
        bridge_protocol="Wormhole",
        destination_chain="solana",
        destination_address=binance_sol
    )

    mock_eth_provider = MagicMock()
    mock_eth_provider.get_address_activity = AsyncMock(return_value=[bridge_tx])

    mock_sol_provider = MagicMock()
    mock_sol_provider.get_address_activity = AsyncMock(return_value=[])

    def get_provider_side_effect(chain: str):
        if chain.lower() == "solana":
            return mock_sol_provider
        return mock_eth_provider

    with patch.object(BlockchainProviderFactory, "get_provider", side_effect=get_provider_side_effect):
        builder = TransactionGraphBuilder(
            blockchain_provider=mock_eth_provider,
            max_hops=3
        )
        graph = await builder.build_graph_for_wallet(seed_eth, root_chain="ethereum")

    assert len(graph.nodes) >= 3
    assert binance_sol in graph.nodes
    assert wormhole_eth in graph.nodes

    cytoscape_data = builder.export_cytoscape_data(seed_eth)
    assert cytoscape_data.stats["cross_chain_edges"] >= 1
    assert cytoscape_data.stats["vasp_nodes_found"] >= 1


def test_cross_chain_markdown_and_pdf_reporting():
    """
    Test Phase 6 reporting: validates that Cross-Chain Movement & Asset Flight Analysis
    tables are rendered in both Markdown and PDF dossiers when cross-chain transactions exist.
    """
    from backend.app.services.reporting.generator import ReportGenerator
    from backend.app.services.reporting.pdf_generator import PDFDossierGenerator
    from backend.app.schemas.analysis import AttributionSchema, EvidenceSchema, RiskAssessmentSchema

    seed_eth = "0xd8da6bf26964af9d7eed9e03e53415d37aa96045"
    wormhole_eth = "0x3ee18b2214aff97000d974cf647e7c347e8fa585"
    binance_sol = "5tzFkiKscMRHK5ZXWBZXZUXJwomD5pmQV82QEGxmqVCe"

    cross_tx = NormalizedTransaction(
        tx_hash="0xbridgeflight001",
        chain="ethereum",
        block_number=19000000,
        timestamp=datetime.now(timezone.utc),
        from_address=seed_eth,
        to_address=wormhole_eth,
        asset_type="ERC20",
        token_symbol="USDC",
        amount=75000.0,
        is_bridge=True,
        bridge_protocol="Wormhole Portal",
        destination_chain="solana",
        destination_address=binance_sol,
        hop=1
    )

    report_schema = ReportGenerator.generate_report(
        case_id="case-cross-chain-001",
        wallet_address=seed_eth,
        attributions=[
            AttributionSchema(
                vasp_name="Binance",
                score=92.5,
                evidence_strength="High",
                rank=1,
                summary="Terminal Solana hot wallet cluster"
            )
        ],
        evidence=[
            EvidenceSchema(
                evidence_type="CrossChainBridge",
                strength="High",
                hop_distance=2,
                source_address=seed_eth,
                target_address=binance_sol,
                tx_hash="0xbridgeflight001",
                explanation="Cross-chain bridging detected from Ethereum to Solana"
            )
        ],
        risk_assessment=RiskAssessmentSchema(
            score=85.0,
            risk_level="HIGH",
            explanation="Cross-chain asset dispersion pattern detected",
            indicators=["Cross-chain bridge traversal", "Direct VASP deposit"]
        ),
        summary_stats={
            "total_nodes": 6,
            "total_edges": 5,
            "vasp_nodes_found": 1,
            "max_hop_reached": 2,
            "cross_chain_edges": 1
        },
        critical_txs=[cross_tx]
    )

    # 1. Verify Markdown generation
    md = ReportGenerator.format_as_markdown(report_schema)
    assert "CROSS-CHAIN MOVEMENT & ASSET FLIGHT ANALYSIS" in md
    assert "Wormhole Portal" in md
    assert "ETHEREUM" in md
    assert "SOLANA" in md
    assert "75,000.00 USDC" in md

    # 2. Verify PDF generation
    pdf_gen = PDFDossierGenerator()
    pdf_bytes = pdf_gen.generate(
        case_id="case-cross-chain-001",
        wallet_address=seed_eth,
        chain="Ethereum Mainnet",
        attributions=[{"vasp_name": "Binance", "score": 92.5, "evidence_strength": "High", "rank": 1}],
        evidence=[{"evidence_type": "CrossChainBridge", "strength": "High", "hop_distance": 2, "source_address": seed_eth, "target_address": binance_sol, "tx_hash": "0xbridgeflight001"}],
        risk_assessment={"risk_level": "HIGH", "score": 85.0, "explanation": "Cross-chain pattern", "indicators": ["Bridge"]},
        transactions=[cross_tx],
        summary_stats={"total_nodes": 6, "total_edges": 5, "vasp_nodes_found": 1, "max_hop_reached": 2}
    )

    assert isinstance(pdf_bytes, bytes)
    assert len(pdf_bytes) > 1000
    assert pdf_bytes.startswith(b"%PDF")

