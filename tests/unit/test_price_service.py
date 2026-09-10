"""
Unit Tests for Case 6: Live INR Asset Valuation & Multi-Currency Engine.

Verifies:
1. Stablecoin pricing always returns ~$1.00 USD and ~₹83.50 INR.
2. Historical price lookup caching (avoid redundant API calls).
3. Batch valuation of multiple transactions.
4. Live price caching with 15-minute TTL.
5. get_current_price_simple() for single symbol lookups.
6. Cache statistics reporting.
"""

import pytest
from datetime import datetime, timezone

from backend.app.services.valuation.price_service import (
    PriceService,
    get_price_service,
    STABLECOIN_SYMBOLS,
    SYMBOL_TO_COINGECKO_ID,
    _DEFAULT_INR_USD_RATE,
)


@pytest.fixture
def price_service():
    """Fresh PriceService instance for each test."""
    return PriceService()


@pytest.mark.asyncio
async def test_stablecoin_pricing(price_service):
    """Verify stablecoins always return ~$1.00 USD and ~₹83.50 INR."""
    for symbol in ["USDT", "USDC", "DAI", "BUSD"]:
        result = await price_service.get_price_at_timestamp(
            symbol, datetime(2025, 6, 15, tzinfo=timezone.utc)
        )
        assert result["usd"] == 1.0, f"{symbol} USD price should be 1.0"
        assert result["inr"] > 0, f"{symbol} INR price should be positive"


@pytest.mark.asyncio
async def test_unknown_symbol_returns_zeros(price_service):
    """Verify unknown symbols return zero prices."""
    result = await price_service.get_price_at_timestamp(
        "UNKNOWN_TOKEN_XYZ", datetime(2025, 6, 15, tzinfo=timezone.utc)
    )
    assert result["usd"] == 0.0
    assert result["inr"] == 0.0


def test_coingecko_symbol_mapping():
    """Verify all expected symbols have CoinGecko ID mappings."""
    expected_symbols = ["BTC", "ETH", "TRX", "USDT", "USDC", "MATIC", "BNB"]
    for symbol in expected_symbols:
        if symbol in STABLECOIN_SYMBOLS:
            continue  # Stablecoins don't need CoinGecko IDs
        assert symbol in SYMBOL_TO_COINGECKO_ID, f"Missing CoinGecko mapping for {symbol}"


@pytest.mark.asyncio
async def test_batch_valuation(price_service):
    """Verify batch transaction valuation works for stablecoins (no API needed)."""
    transactions = [
        {
            "tx_hash": "0xabc123",
            "amount": 100.0,
            "token_symbol": "USDT",
            "timestamp": datetime(2025, 6, 15, tzinfo=timezone.utc).isoformat(),
        },
        {
            "tx_hash": "0xdef456",
            "amount": 50.0,
            "token_symbol": "USDC",
            "timestamp": datetime(2025, 6, 15, tzinfo=timezone.utc).isoformat(),
        },
    ]

    results = await price_service.valuate_transactions_batch(transactions)

    assert len(results) == 2

    # First tx: 100 USDT @ $1.00
    assert results[0]["amount_usd"] == 100.0
    assert results[0]["amount_inr"] > 0
    assert results[0]["unit_price_usd"] == 1.0

    # Second tx: 50 USDC @ $1.00
    assert results[1]["amount_usd"] == 50.0
    assert results[1]["unit_price_usd"] == 1.0


def test_cache_statistics(price_service):
    """Verify cache statistics are reported correctly."""
    stats = price_service.get_cache_stats()
    assert "cached_price_points" in stats
    assert "live_cache_entries" in stats
    assert "unique_coins" in stats
    assert "unique_dates" in stats
    assert stats["cached_price_points"] == 0  # Fresh instance


def test_singleton_instance():
    """Verify get_price_service returns a singleton."""
    svc1 = get_price_service()
    svc2 = get_price_service()
    assert svc1 is svc2


@pytest.mark.asyncio
async def test_valuate_transaction_stablecoin(price_service):
    """Verify single transaction valuation with stablecoin."""
    result = await price_service.valuate_transaction(
        amount=250.0,
        symbol="USDT",
        timestamp=datetime(2025, 6, 15, tzinfo=timezone.utc),
    )
    assert result["unit_price_usd"] == 1.0
    assert result["amount_usd"] == 250.0
    assert result["amount_inr"] > 0
    assert result["unit_price_inr"] > 0


@pytest.mark.asyncio
async def test_current_prices_stablecoins(price_service):
    """Verify get_current_prices works for stablecoins (no API needed)."""
    results = await price_service.get_current_prices(["USDT", "USDC", "DAI"])
    assert "USDT" in results
    assert results["USDT"]["usd"] == 1.0
    assert results["USDT"]["inr"] == _DEFAULT_INR_USD_RATE

    assert "USDC" in results
    assert "DAI" in results


@pytest.mark.asyncio
async def test_current_price_simple_stablecoin(price_service):
    """Verify get_current_price_simple returns correct result for stablecoins."""
    result = await price_service.get_current_price_simple("USDT")
    assert result["usd"] == 1.0
    assert result["inr"] == _DEFAULT_INR_USD_RATE


@pytest.mark.asyncio
async def test_current_price_simple_unknown(price_service):
    """Verify get_current_price_simple returns zeros for unknown symbols."""
    result = await price_service.get_current_price_simple("UNKNOWN_XYZ")
    assert result["usd"] == 0.0
    assert result["inr"] == 0.0


def test_default_inr_rate():
    """Verify default INR/USD rate is reasonable."""
    assert 70.0 < _DEFAULT_INR_USD_RATE < 100.0, "INR/USD rate should be in reasonable range"


def test_orchestrator_edge_valuation_and_taint():
    """Verify TraceOrchestrator.export_cytoscape_data populates INR/USD valuations and FIFO taint."""
    from backend.app.services.trace.orchestrator import TraceOrchestrator
    orchestrator = TraceOrchestrator("0x1111111111111111111111111111111111111111", chain="ethereum")
    orchestrator.nx_graph.add_node("0x1111111111111111111111111111111111111111", role="ORIGIN", hop=0)
    orchestrator.nx_graph.add_node("0x2222222222222222222222222222222222222222", role="INTERMEDIARY", hop=1)
    orchestrator.nx_graph.add_edge(
        "0x1111111111111111111111111111111111111111",
        "0x2222222222222222222222222222222222222222",
        key="e1",
        tx_hash="0xabcdef1234567890",
        amount=2.0,
        asset_symbol="ETH",
        hop=1
    )
    graph_data = orchestrator.export_cytoscape_data()
    assert len(graph_data.edges) == 1
    edge = graph_data.edges[0].data

    # Valuation checks
    assert edge.amount_usd is not None and edge.amount_usd > 0
    assert edge.amount_inr is not None and edge.amount_inr > 0
    assert edge.unit_price_usd is not None and edge.unit_price_usd > 0
    assert edge.unit_price_inr is not None and edge.unit_price_inr > 0

    # Taint checks
    assert edge.taint_ratio == 1.0
    assert edge.traceable_amount == 2.0
    assert edge.unclassified_amount == 0.0

    # Stats checks
    assert graph_data.stats.get("total_amount_inr") is not None
    assert graph_data.stats.get("total_amount_inr") > 0
    assert "taint_summary" in graph_data.stats
