"""
Unit Tests for Open-Source Phase 6: Account-Based Deposit Clustering & NetworkX Graph Science.

Verifies:
1. Deposit-to-Exchange Forwarding Heuristic:
   - Positive detection of intermediate customer deposit proxies sweeping to Binance / WazirX hot wallets.
   - Forwarding ratio threshold filtering (< 0.80 rejected).
   - TRC-20 Tron USDT deposit proxy detection.
2. NetworkX Louvain Modularity Community Detection:
   - Graph partitioning into cohesive communities / syndicates.
   - Positive modularity score calculation (Q > 0).
   - Dominant entity and member attribution.
3. HeuristicsEngine Orchestration:
   - Populating communities and deposit forwarding results in analyze_graph.
4. FastAPI REST Endpoints:
   - POST /api/v1/heuristics/deposit-forwarding
   - POST /api/v1/heuristics/community-detection
"""

import pytest
import networkx as nx
from fastapi.testclient import TestClient

from backend.app.main import app
from backend.app.services.heuristics.account_clustering import (
    AccountDepositClusterer,
    account_deposit_clusterer
)
from backend.app.services.heuristics.engine import HeuristicsEngine
from backend.app.services.labels.store import label_store

client = TestClient(app)


def test_deposit_forwarding_ethereum_binance():
    """Verify intermediate wallet sweeping 98% to Binance hot wallet is flagged as deposit proxy."""
    suspect = "0x1111111111111111111111111111111111111111"
    deposit_proxy = "0x2222222222222222222222222222222222222222"
    binance_hw = "0x28C6c06298d514Db089934071355E5743bf21d60"  # Binance 14

    txs = [
        {"from_address": suspect, "to_address": deposit_proxy, "amount": 10.0, "tx_hash": "0xtx1"},
        {"from_address": deposit_proxy, "to_address": binance_hw, "amount": 9.8, "tx_hash": "0xtx2"}
    ]

    clusterer = AccountDepositClusterer(store=label_store)
    results = clusterer.detect_deposit_forwarding(txs, chain="ethereum")

    assert len(results) == 1
    res = results[0]
    assert res.intermediate_address == deposit_proxy
    assert res.destination_vasp == "Binance"
    assert res.destination_address == binance_hw.lower()
    assert res.inbound_amount == 10.0
    assert res.forwarded_amount == 9.8
    assert res.forwarding_ratio == 0.98
    assert res.confidence_score >= 0.95
    assert res.is_deposit_proxy is True
    assert "deposit proxy" in res.explanation


def test_deposit_forwarding_ratio_threshold_filtering():
    """Verify intermediate wallet forwarding less than threshold (< 80%) is not flagged."""
    suspect = "0x1111111111111111111111111111111111111111"
    intermediary = "0x3333333333333333333333333333333333333333"
    binance_hw = "0x28C6c06298d514Db089934071355E5743bf21d60"

    txs = [
        {"from_address": suspect, "to_address": intermediary, "amount": 10.0, "tx_hash": "0xtx1"},
        {"from_address": intermediary, "to_address": binance_hw, "amount": 5.0, "tx_hash": "0xtx2"}
    ]

    clusterer = AccountDepositClusterer(store=label_store)
    results = clusterer.detect_deposit_forwarding(txs, min_forwarding_ratio=0.80)
    assert len(results) == 0


def test_deposit_forwarding_tron_usdt():
    """Verify TRC-20 Tron USDT deposit proxy sweeping to Binance Tron hot wallet."""
    suspect = "TTestSuspectWallet1234567890123456"
    deposit_proxy = "TTestDepositProxy1234567890123456"
    binance_tron_hw = "TMuA6YMeL4nNFYWAnWUCtqnmEvrCfsugnR"

    txs = [
        {"from_address": suspect, "to_address": deposit_proxy, "amount": 50000.0, "tx_hash": "trtx1"},
        {"from_address": deposit_proxy, "to_address": binance_tron_hw, "amount": 49990.0, "tx_hash": "trtx2"}
    ]

    clusterer = AccountDepositClusterer(store=label_store)
    results = clusterer.detect_deposit_forwarding(txs, chain="tron")

    assert len(results) == 1
    assert results[0].destination_vasp == "Binance"
    assert results[0].destination_address == binance_tron_hw
    assert results[0].forwarding_ratio >= 0.99


def test_networkx_louvain_community_detection():
    """Verify NetworkX Louvain partitions distinct clusters and calculates modularity Q."""
    # Build a graph with 2 well-defined communities:
    # Community 1: A, B, C (densely connected syndicate)
    # Community 2: D, E, F (densely connected exchange cluster)
    # Weak bridge edge: C -> D
    txs = [
        # Syndicate 1
        {"from_address": "0xAAAA", "to_address": "0xBBBB", "amount": 10.0},
        {"from_address": "0xBBBB", "to_address": "0xCCCC", "amount": 10.0},
        {"from_address": "0xCCCC", "to_address": "0xAAAA", "amount": 10.0},
        # Exchange Cluster 2
        {"from_address": "0xDDDD", "to_address": "0xEEEE", "amount": 20.0},
        {"from_address": "0xEEEE", "to_address": "0xFFFF", "amount": 20.0},
        {"from_address": "0xFFFF", "to_address": "0xDDDD", "amount": 20.0},
        # Weak bridge
        {"from_address": "0xCCCC", "to_address": "0xDDDD", "amount": 1.0}
    ]

    clusterer = AccountDepositClusterer(store=label_store)
    communities, mod_score = clusterer.detect_communities(transactions=txs)

    assert len(communities) == 2
    assert mod_score > 0.3  # Strong modularity
    com_sizes = sorted([c.size for c in communities])
    assert com_sizes == [3, 3]


def test_heuristics_engine_analyze_graph_orchestration():
    """Verify HeuristicsEngine.analyze_graph incorporates Louvain communities and deposit sweeps."""
    G = nx.MultiDiGraph()
    suspect = "0x1111111111111111111111111111111111111111"
    deposit = "0x2222222222222222222222222222222222222222"
    binance = "0x28C6c06298d514Db089934071355E5743bf21d60"

    G.add_edge(suspect, deposit, amount=5.0, tx_hash="h1")
    G.add_edge(deposit, binance, amount=4.9, tx_hash="h2")

    engine = HeuristicsEngine()
    summary = engine.analyze_graph(G, root_wallet=suspect, chain="ethereum")

    assert len(summary.deposit_forwarding_detected) >= 1
    assert summary.deposit_forwarding_detected[0].destination_vasp == "Binance"
    assert len(summary.communities_detected) >= 1
    assert "deposit-address proxy sweep" in summary.summary
    assert "Louvain" in summary.summary


def test_api_deposit_forwarding_endpoint():
    """Verify POST /api/v1/heuristics/deposit-forwarding."""
    payload = {
        "transactions": [
            {
                "from_address": "0x1111111111111111111111111111111111111111",
                "to_address": "0x2222222222222222222222222222222222222222",
                "amount": 10.0,
                "tx_hash": "0x001"
            },
            {
                "from_address": "0x2222222222222222222222222222222222222222",
                "to_address": "0x28C6c06298d514Db089934071355E5743bf21d60",
                "amount": 9.9,
                "tx_hash": "0x002"
            }
        ],
        "chain": "ethereum",
        "min_forwarding_ratio": 0.80
    }

    res = client.post("/api/v1/heuristics/deposit-forwarding", json=payload)
    assert res.status_code == 200
    data = res.json()
    assert len(data) == 1
    assert data[0]["destination_vasp"] == "Binance"
    assert data[0]["forwarding_ratio"] == 0.99


def test_api_community_detection_endpoint():
    """Verify POST /api/v1/heuristics/community-detection."""
    payload = {
        "transactions": [
            {"from_address": "0x1000", "to_address": "0x2000", "amount": 15.0},
            {"from_address": "0x2000", "to_address": "0x3000", "amount": 15.0},
            {"from_address": "0x3000", "to_address": "0x1000", "amount": 15.0},
            {"from_address": "0x4000", "to_address": "0x5000", "amount": 25.0},
            {"from_address": "0x5000", "to_address": "0x6000", "amount": 25.0},
            {"from_address": "0x6000", "to_address": "0x4000", "amount": 25.0}
        ],
        "chain": "ethereum"
    }

    res = client.post("/api/v1/heuristics/community-detection", json=payload)
    assert res.status_code == 200
    data = res.json()
    assert data["total_communities"] == 2
    assert data["modularity_score"] > 0.0
    assert len(data["communities"]) == 2
