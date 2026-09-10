"""
Unit Tests for Case 2: Visual FIFO Taint Tracking Integration.

Verifies:
1. FIFO taint computation on multi-hop transaction graph.
2. Edge annotations with traceable_amount, unclassified_amount, taint_ratio.
3. TaintSummary aggregate metrics (total volume, total traceable, overall ratio).
4. Taint propagation across multiple hops from suspect wallet.
5. Clean funds are properly classified as unclassified.
6. Taint schema serialization for API responses.
7. Integration with GraphEdgeData taint fields.
"""

import pytest
from datetime import datetime, timezone

from backend.app.services.attribution.fifo_taint import (
    FIFOTaintEngine,
    TaintAnnotation,
    TaintSummary,
    compute_fifo_taint,
)
from backend.app.schemas.analysis import (
    TaintSummarySchema,
    TaintAnnotationSchema,
    GraphEdgeData,
)


# ---------------------------------------------------------------------------
# Test Fixtures: Sample transaction graphs
# ---------------------------------------------------------------------------

@pytest.fixture
def suspect_wallet():
    return "0xdead000000000000000000000000000000000001"


@pytest.fixture
def intermediary_wallet():
    return "0xbabe000000000000000000000000000000000002"


@pytest.fixture
def exchange_wallet():
    return "0xcafe000000000000000000000000000000000003"


@pytest.fixture
def clean_wallet():
    return "0xfeed000000000000000000000000000000000004"


@pytest.fixture
def sample_transactions(suspect_wallet, intermediary_wallet, exchange_wallet, clean_wallet):
    """
    Multi-hop transaction graph:
    1. Suspect -> Intermediary: 10 ETH (fully tainted)
    2. Clean -> Intermediary: 5 ETH (clean inflow, co-mingling)
    3. Intermediary -> Exchange: 8 ETH (partially tainted via FIFO)
    """
    return [
        {
            "tx_hash": "0xtx_suspect_to_intermediary",
            "from_address": suspect_wallet,
            "to_address": intermediary_wallet,
            "amount": 10.0,
            "token_symbol": "ETH",
            "timestamp": "2025-06-15T10:00:00",
            "hop": 1,
            "chain": "ethereum",
        },
        {
            "tx_hash": "0xtx_clean_to_intermediary",
            "from_address": clean_wallet,
            "to_address": intermediary_wallet,
            "amount": 5.0,
            "token_symbol": "ETH",
            "timestamp": "2025-06-15T11:00:00",
            "hop": 1,
            "chain": "ethereum",
        },
        {
            "tx_hash": "0xtx_intermediary_to_exchange",
            "from_address": intermediary_wallet,
            "to_address": exchange_wallet,
            "amount": 8.0,
            "token_symbol": "ETH",
            "timestamp": "2025-06-15T12:00:00",
            "hop": 2,
            "chain": "ethereum",
        },
    ]


# ---------------------------------------------------------------------------
# Tests
# ---------------------------------------------------------------------------


def test_fifo_taint_basic_propagation(sample_transactions, suspect_wallet):
    """Verify taint propagates from suspect wallet through intermediary."""
    engine = FIFOTaintEngine()
    annotations, summary = engine.compute_taint(
        transactions=sample_transactions,
        suspect_wallets=[suspect_wallet],
    )

    assert len(annotations) == 3
    assert summary.total_transactions == 3
    assert summary.suspect_wallets_count == 1
    assert summary.total_volume > 0


def test_fifo_taint_suspect_outflow_fully_tainted(sample_transactions, suspect_wallet):
    """Verify that funds sent directly from suspect wallet are 100% traceable."""
    engine = FIFOTaintEngine()
    annotations, _ = engine.compute_taint(
        transactions=sample_transactions,
        suspect_wallets=[suspect_wallet],
    )

    # First tx: suspect -> intermediary (10 ETH, should be fully tainted)
    tx1 = annotations[0]
    assert tx1.from_address == suspect_wallet.lower()
    assert tx1.traceable_amount == 10.0
    assert tx1.unclassified_amount == 0.0
    assert tx1.taint_ratio == 1.0


def test_fifo_taint_co_mingled_funds(sample_transactions, suspect_wallet, intermediary_wallet, exchange_wallet):
    """Verify FIFO correctly handles co-mingled funds at intermediary."""
    engine = FIFOTaintEngine()
    annotations, _ = engine.compute_taint(
        transactions=sample_transactions,
        suspect_wallets=[suspect_wallet],
    )

    # Third tx: intermediary -> exchange (8 ETH)
    # Intermediary received 10 tainted + 5 clean = 15 total
    # FIFO: first 10 ETH are tainted, so 8 ETH of 8 ETH sent should be tainted
    tx3 = annotations[2]
    assert tx3.from_address == intermediary_wallet.lower()
    assert tx3.to_address == exchange_wallet.lower()
    assert tx3.amount == 8.0
    assert tx3.traceable_amount == 8.0  # Entire 8 ETH from tainted portion
    assert tx3.taint_ratio == 1.0


def test_fifo_taint_summary_metrics(sample_transactions, suspect_wallet):
    """Verify TaintSummary aggregate metrics are correct."""
    _, summary = compute_fifo_taint(
        transactions=sample_transactions,
        suspect_wallets=[suspect_wallet],
    )

    assert summary.total_transactions == 3
    assert summary.total_volume == 23.0  # 10 + 5 + 8
    assert summary.total_traceable > 0
    assert 0.0 <= summary.overall_taint_ratio <= 1.0
    assert summary.tainted_addresses_count > 0


def test_fifo_taint_address_balance_tracking(suspect_wallet, intermediary_wallet):
    """Verify address-level taint balance tracking."""
    txs = [
        {
            "tx_hash": "0xtx1",
            "from_address": suspect_wallet,
            "to_address": intermediary_wallet,
            "amount": 5.0,
            "token_symbol": "ETH",
            "timestamp": "2025-06-15T10:00:00",
        },
    ]

    engine = FIFOTaintEngine()
    engine.compute_taint(txs, [suspect_wallet])

    # Intermediary should have tainted balance
    intermediary_bal = engine.get_address_taint_balance(intermediary_wallet)
    assert intermediary_bal == 5.0

    # Suspect should have 0 after spending
    suspect_bal = engine.get_address_taint_balance(suspect_wallet)
    assert suspect_bal == 0.0


def test_fifo_taint_all_tainted_balances(suspect_wallet, intermediary_wallet, exchange_wallet):
    """Verify get_all_tainted_balances returns correct non-zero balances."""
    txs = [
        {
            "tx_hash": "0xtx1",
            "from_address": suspect_wallet,
            "to_address": intermediary_wallet,
            "amount": 10.0,
            "token_symbol": "ETH",
            "timestamp": "2025-06-15T10:00:00",
        },
        {
            "tx_hash": "0xtx2",
            "from_address": intermediary_wallet,
            "to_address": exchange_wallet,
            "amount": 3.0,
            "token_symbol": "ETH",
            "timestamp": "2025-06-15T11:00:00",
        },
    ]

    engine = FIFOTaintEngine()
    engine.compute_taint(txs, [suspect_wallet])

    balances = engine.get_all_tainted_balances()
    assert intermediary_wallet.lower() in balances
    assert exchange_wallet.lower() in balances
    assert balances[intermediary_wallet.lower()] == 7.0  # 10 - 3
    assert balances[exchange_wallet.lower()] == 3.0


def test_taint_summary_schema_serialization():
    """Verify TaintSummarySchema can be serialized for API responses."""
    schema = TaintSummarySchema(
        total_transactions=10,
        total_volume=100.0,
        total_traceable=75.0,
        total_unclassified=25.0,
        overall_taint_ratio=0.75,
        suspect_wallets_count=1,
        tainted_addresses_count=5,
        tainted_addresses=["0xabc", "0xdef"],
        total_traceable_usd=150000.0,
        total_traceable_inr=12450000.0,
    )
    data = schema.model_dump()
    assert data["total_traceable"] == 75.0
    assert data["overall_taint_ratio"] == 0.75
    assert data["total_traceable_inr"] == 12450000.0
    assert len(data["tainted_addresses"]) == 2


def test_taint_annotation_schema():
    """Verify TaintAnnotationSchema for individual edge annotations."""
    schema = TaintAnnotationSchema(
        tx_hash="0xabc123",
        from_address="0xsender",
        to_address="0xreceiver",
        amount=10.0,
        asset="ETH",
        traceable_amount=8.5,
        unclassified_amount=1.5,
        taint_ratio=0.85,
        hop=2,
        chain="ethereum",
    )
    data = schema.model_dump()
    assert data["traceable_amount"] == 8.5
    assert data["taint_ratio"] == 0.85


def test_graph_edge_data_taint_fields():
    """Verify GraphEdgeData includes taint and valuation fields."""
    edge = GraphEdgeData(
        id="e1",
        source="n1",
        target="n2",
        tx_hash="0xabc",
        asset_symbol="ETH",
        amount=10.0,
        timestamp=datetime(2025, 6, 15, tzinfo=timezone.utc),
        hop=1,
        traceable_amount=8.0,
        unclassified_amount=2.0,
        taint_ratio=0.8,
        amount_usd=25000.0,
        amount_inr=2075000.0,
    )
    assert edge.traceable_amount == 8.0
    assert edge.taint_ratio == 0.8
    assert edge.amount_usd == 25000.0
    assert edge.amount_inr == 2075000.0


def test_convenience_function():
    """Verify compute_fifo_taint convenience function works."""
    txs = [
        {
            "tx_hash": "0xtx1",
            "from_address": "0xsuspect",
            "to_address": "0xdest",
            "amount": 5.0,
            "token_symbol": "ETH",
            "timestamp": "2025-06-15T10:00:00",
        },
    ]
    annotations, summary = compute_fifo_taint(txs, ["0xsuspect"])
    assert len(annotations) == 1
    assert summary.total_transactions == 1
    assert annotations[0].traceable_amount == 5.0
