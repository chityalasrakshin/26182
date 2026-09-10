"""
Unit and Integration Tests for Phase 3: Clustering Heuristics & Risk Scoring.

Verifies:
1. Bitcoin Common-Input-Ownership Heuristic (CIOH) & Disjoint-Set Union.
2. Sweep-Transaction Detection (UTXO and NetworkX Graph).
3. Peeling-Chain Detection (Asymmetric splits, change tracking, multi-hop chains).
4. Feature Engineering Refinements (Extended feature vector with heuristics).
5. Explainable Multi-Signal Risk Scorer Refinement (Anti-double-counting caps).
6. FastAPI /api/v1/heuristics REST Endpoints.
"""

import pytest
from datetime import datetime, timezone, timedelta
import networkx as nx
from fastapi.testclient import TestClient

from backend.app.main import app
from backend.app.schemas.heuristics import (
    UTXOTransaction,
    UTXOInput,
    UTXOOutput
)
from backend.app.services.heuristics.common_input import (
    DisjointSetUnion,
    CommonInputClusteringEngine
)
from backend.app.services.heuristics.sweep_detector import SweepDetector
from backend.app.services.heuristics.peel_detector import PeelChainDetector
from backend.app.services.heuristics.engine import HeuristicsEngine
from backend.app.services.risk.classifier import RiskClassifier, CATEGORY_CAPS
from backend.app.ml.features import (
    FEATURE_NAMES,
    HEURISTIC_FEATURE_NAMES,
    EXTENDED_FEATURE_NAMES,
    extract_enhanced_features,
    extended_feature_dict_to_vector
)


# ==============================================================================
# 1. Tests for Common-Input-Ownership Heuristic (CIOH)
# ==============================================================================

def test_disjoint_set_union_basic():
    """Verify DSU find, union, rank, and membership tracking."""
    dsu = DisjointSetUnion()
    dsu.union("addr_a", "addr_b")
    dsu.union("addr_b", "addr_c")

    assert dsu.find("addr_a") == dsu.find("addr_c")
    assert dsu.get_set("addr_a") == {"addr_a", "addr_b", "addr_c"}

    dsu.union("addr_d", "addr_e")
    assert dsu.find("addr_d") != dsu.find("addr_a")


def test_common_input_clustering_transitive():
    """Test multi-input transactions merge co-spending addresses transitively."""
    engine = CommonInputClusteringEngine()
    t0 = datetime(2026, 1, 1, 12, 0, 0, tzinfo=timezone.utc)

    # Tx1: addr_1 and addr_2 co-spend
    tx1 = UTXOTransaction(
        tx_hash="tx_cioh_1",
        timestamp=t0,
        inputs=[
            UTXOInput(address="1AddrAAA", amount_btc=1.0),
            UTXOInput(address="1AddrBBB", amount_btc=2.0)
        ],
        outputs=[
            UTXOOutput(address="1Recipient1", amount_btc=2.99)
        ]
    )
    engine.add_transaction(tx1)

    # Tx2: addr_2 and addr_3 co-spend
    tx2 = UTXOTransaction(
        tx_hash="tx_cioh_2",
        timestamp=t0 + timedelta(hours=1),
        inputs=[
            UTXOInput(address="1AddrBBB", amount_btc=0.5),
            UTXOInput(address="1AddrCCC", amount_btc=1.5)
        ],
        outputs=[
            UTXOOutput(address="1Recipient2", amount_btc=1.99)
        ]
    )
    engine.add_transaction(tx2)

    # Should all be in the same cluster now (transitive closure)
    cl_a = engine.get_cluster("1addraaa")
    cl_b = engine.get_cluster("1addrbbb")
    cl_c = engine.get_cluster("1addrccc")

    assert cl_a is not None
    assert cl_b is not None
    assert cl_c is not None
    assert cl_a.cluster_id == cl_b.cluster_id == cl_c.cluster_id
    assert cl_a.cluster_size == 3
    assert set(cl_a.members) == {"1addraaa", "1addrbbb", "1addrccc"}
    assert cl_a.tx_count == 2
    assert cl_a.total_volume_btc == 5.0  # 3.0 + 2.0


def test_single_input_not_merged():
    """Single-input transactions must NOT merge unrelated addresses."""
    engine = CommonInputClusteringEngine()
    t0 = datetime(2026, 1, 1, 12, 0, 0, tzinfo=timezone.utc)

    tx_single1 = UTXOTransaction(
        tx_hash="tx_single_1",
        timestamp=t0,
        inputs=[UTXOInput(address="1SoloA", amount_btc=1.0)],
        outputs=[UTXOOutput(address="1DestX", amount_btc=0.99)]
    )
    tx_single2 = UTXOTransaction(
        tx_hash="tx_single_2",
        timestamp=t0,
        inputs=[UTXOInput(address="1SoloB", amount_btc=2.0)],
        outputs=[UTXOOutput(address="1DestX", amount_btc=1.99)]
    )
    engine.add_transaction(tx_single1)
    engine.add_transaction(tx_single2)

    cl_a = engine.get_cluster("1soloa")
    cl_b = engine.get_cluster("1solob")
    assert cl_a is not None and cl_a.cluster_size == 1
    assert cl_b is not None and cl_b.cluster_size == 1
    assert cl_a.cluster_id != cl_b.cluster_id


def test_coinjoin_filtering():
    """Verify collaborative CoinJoin transactions are filtered out to prevent cluster poisoning."""
    engine = CommonInputClusteringEngine(filter_coinjoin=True)
    t0 = datetime(2026, 1, 1, 12, 0, 0, tzinfo=timezone.utc)

    # Synthetic CoinJoin: 3 inputs, 3 identical outputs of 0.1 BTC each
    coinjoin_tx = UTXOTransaction(
        tx_hash="tx_coinjoin_1",
        timestamp=t0,
        inputs=[
            UTXOInput(address="1User1", amount_btc=0.15),
            UTXOInput(address="1User2", amount_btc=0.12),
            UTXOInput(address="1User3", amount_btc=0.11),
        ],
        outputs=[
            UTXOOutput(address="1MixOut1", value_sat=10000000, amount_btc=0.1),
            UTXOOutput(address="1MixOut2", value_sat=10000000, amount_btc=0.1),
            UTXOOutput(address="1MixOut3", value_sat=10000000, amount_btc=0.1),
            UTXOOutput(address="1Change1", value_sat=5000000, amount_btc=0.05),
        ]
    )

    assert engine.is_coinjoin(coinjoin_tx) is True
    res = engine.add_transaction(coinjoin_tx)
    assert res is None  # Skipped!


# ==============================================================================
# 2. Tests for Sweep-Transaction Detection
# ==============================================================================

def test_utxo_pure_sweep_detection():
    """Detect UTXO consolidation transaction with many inputs and 1 output."""
    detector = SweepDetector(min_inputs=3)
    t0 = datetime(2026, 1, 1, 12, 0, 0, tzinfo=timezone.utc)

    sweep_tx = UTXOTransaction(
        tx_hash="tx_sweep_1",
        timestamp=t0,
        inputs=[
            UTXOInput(address=f"1Deposit{i}", amount_btc=0.5)
            for i in range(5)
        ],  # 5 * 0.5 = 2.5 BTC
        outputs=[
            UTXOOutput(address="1HotWalletTreasury", amount_btc=2.49)
        ]
    )

    result = detector.analyze_utxo_transaction(sweep_tx)
    assert result is not None
    assert result.is_sweep is True
    assert result.sweep_target_address == "1hotwallettreasury"
    assert result.input_count == 5
    assert result.output_count == 1
    assert result.consolidated_amount == 2.49
    assert result.consolidation_ratio >= 0.99
    assert result.confidence_score >= 0.90


def test_utxo_sweep_with_change():
    """Detect UTXO consolidation with 1 dominant output (>= 85%) and 1 small change output."""
    detector = SweepDetector(min_inputs=3, min_consolidation_ratio=0.85)
    t0 = datetime(2026, 1, 1, 12, 0, 0, tzinfo=timezone.utc)

    sweep_tx = UTXOTransaction(
        tx_hash="tx_sweep_2",
        timestamp=t0,
        inputs=[
            UTXOInput(address=f"1Source{i}", amount_btc=1.0)
            for i in range(4)
        ],  # 4.0 BTC
        outputs=[
            UTXOOutput(address="1ConsolidationTarget", amount_btc=3.75),  # 93.75%
            UTXOOutput(address="1TinyChange", amount_btc=0.24)
        ]
    )

    result = detector.analyze_utxo_transaction(sweep_tx)
    assert result is not None
    assert result.is_sweep is True
    assert result.sweep_target_address == "1consolidationtarget"
    assert result.consolidation_ratio >= 0.90


def test_sweep_negative_cases():
    """Verify standard 1-in-2-out payments or 1-to-many fan-outs are NOT classified as sweeps."""
    detector = SweepDetector(min_inputs=3)
    t0 = datetime(2026, 1, 1, 12, 0, 0, tzinfo=timezone.utc)

    # Standard 1-in 2-out
    normal_tx = UTXOTransaction(
        tx_hash="tx_normal",
        timestamp=t0,
        inputs=[UTXOInput(address="1Alice", amount_btc=1.0)],
        outputs=[
            UTXOOutput(address="1Bob", amount_btc=0.3),
            UTXOOutput(address="1AliceChange", amount_btc=0.69)
        ]
    )
    assert detector.analyze_utxo_transaction(normal_tx) is None

    # Fan-out smurfing (1 in, 5 out)
    fan_out_tx = UTXOTransaction(
        tx_hash="tx_fan_out",
        timestamp=t0,
        inputs=[UTXOInput(address="1Sender", amount_btc=5.0)],
        outputs=[
            UTXOOutput(address=f"1Receiver{i}", amount_btc=0.99)
            for i in range(5)
        ]
    )
    assert detector.analyze_utxo_transaction(fan_out_tx) is None


def test_graph_sweep_detection():
    """Detect fan-in aggregation node in a NetworkX graph."""
    detector = SweepDetector()
    g = nx.MultiDiGraph()
    target = "0xcollector_wallet"
    t0 = datetime.now(timezone.utc)

    # 4 distinct source nodes send funds to target
    for i in range(4):
        src = f"0xvictim_{i}"
        g.add_node(src, hop=1)
        g.add_edge(src, target, key=f"e_{i}", amount=2.5, timestamp=t0, tx_hash=f"0xhash_{i}")
    g.add_node(target, hop=2)

    sweeps = detector.analyze_graph(g, min_in_degree=3)
    assert len(sweeps) == 1
    assert sweeps[0].sweep_target_address == target
    assert sweeps[0].input_count == 4
    assert sweeps[0].consolidated_amount == 10.0


# ==============================================================================
# 3. Tests for Peeling-Chain Detection
# ==============================================================================

def test_utxo_peel_chain_detection():
    """Test multi-hop sequential peeling chain detection with asymmetric splits."""
    detector = PeelChainDetector(min_chain_length=3, max_peel_ratio=0.35)
    t0 = datetime(2026, 1, 1, 12, 0, 0, tzinfo=timezone.utc)

    # Step 1: 10 BTC -> 1 BTC peel (10%) to Merchant1, 8.99 BTC change to ChangeAddr1
    tx1 = UTXOTransaction(
        tx_hash="tx_peel_hop1",
        timestamp=t0,
        inputs=[UTXOInput(address="1OriginWhale", amount_btc=10.0)],
        outputs=[
            UTXOOutput(address="1Merchant1", amount_btc=1.0),
            UTXOOutput(address="1ChangeAddr1", amount_btc=8.99)
        ]
    )

    # Step 2: 8.99 BTC -> 1 BTC peel (11%) to Merchant2, 7.98 BTC change to ChangeAddr2
    tx2 = UTXOTransaction(
        tx_hash="tx_peel_hop2",
        timestamp=t0 + timedelta(minutes=15),
        inputs=[UTXOInput(address="1ChangeAddr1", amount_btc=8.99)],
        outputs=[
            UTXOOutput(address="1Merchant2", amount_btc=1.0),
            UTXOOutput(address="1ChangeAddr2", amount_btc=7.98)
        ]
    )

    # Step 3: 7.98 BTC -> 1 BTC peel (12.5%) to Merchant3, 6.97 BTC change to ChangeAddr3
    tx3 = UTXOTransaction(
        tx_hash="tx_peel_hop3",
        timestamp=t0 + timedelta(minutes=30),
        inputs=[UTXOInput(address="1ChangeAddr2", amount_btc=7.98)],
        outputs=[
            UTXOOutput(address="1Merchant3", amount_btc=1.0),
            UTXOOutput(address="1ChangeAddr3", amount_btc=6.97)
        ]
    )

    chains = detector.detect_utxo_peel_chains([tx1, tx2, tx3])
    assert len(chains) == 1
    chain = chains[0]

    assert chain.is_peeling_chain is True
    assert chain.chain_length == 3
    assert chain.start_address == "1originwhale"
    assert chain.total_peeled_amount == 3.0
    assert chain.remaining_change_amount == 6.97
    assert chain.peeled_destinations == ["1merchant1", "1merchant2", "1merchant3"]
    assert chain.change_path == ["1changeaddr1", "1changeaddr2", "1changeaddr3"]
    assert chain.confidence_score >= 0.80


def test_peel_chain_negative_symmetric_split():
    """50/50 splits should NOT be recognized as peeling chains."""
    detector = PeelChainDetector(min_chain_length=2, max_peel_ratio=0.35)
    t0 = datetime(2026, 1, 1, 12, 0, 0, tzinfo=timezone.utc)

    # 5.0 BTC split into 2.5 and 2.5 (ratio = 0.50 > 0.35)
    tx = UTXOTransaction(
        tx_hash="tx_symm",
        timestamp=t0,
        inputs=[UTXOInput(address="1AddrA", amount_btc=5.0)],
        outputs=[
            UTXOOutput(address="1AddrB", amount_btc=2.5),
            UTXOOutput(address="1AddrC", amount_btc=2.5)
        ]
    )
    assert detector.detect_utxo_peel_chains([tx]) == []


def test_graph_peel_chain_detection():
    """Detect peeling chain in NetworkX graph."""
    detector = PeelChainDetector(min_chain_length=2, max_peel_ratio=0.35)
    g = nx.MultiDiGraph()
    t0 = datetime.now(timezone.utc)

    # Node A -> B (peel 0.5) and C (change 4.5)
    g.add_edge("A", "B", amount=0.5, timestamp=t0, tx_hash="tx_ab")
    g.add_edge("A", "C", amount=4.5, timestamp=t0, tx_hash="tx_ac")

    # Node C -> D (peel 0.5) and E (change 4.0)
    g.add_edge("C", "D", amount=0.5, timestamp=t0, tx_hash="tx_cd")
    g.add_edge("C", "E", amount=4.0, timestamp=t0, tx_hash="tx_ce")

    chains = detector.detect_graph_peel_chains(g, root_wallet="A")
    assert len(chains) == 1
    assert chains[0].chain_length == 2
    assert chains[0].start_address == "A"
    assert chains[0].peeled_destinations == ["B", "D"]
    assert chains[0].change_path == ["C", "E"]


# ==============================================================================
# 4. Tests for Feature Engineering Refinement
# ==============================================================================

def test_feature_names_and_vector_lengths():
    """Verify feature vector consistency and backward compatibility."""
    assert len(FEATURE_NAMES) == 22
    assert len(HEURISTIC_FEATURE_NAMES) == 9
    assert len(EXTENDED_FEATURE_NAMES) == 31

    g = nx.MultiDiGraph()
    g.add_node("0xroot", hop=0)
    g.add_node("0xvasp", hop=1)
    g.add_edge("0xroot", "0xvasp", amount=10.0, timestamp=datetime.now(timezone.utc))

    candidate_nodes = [{"node": "0xvasp", "data": {"hop": 1, "confidence_score": 95.0}}]
    feats = extract_enhanced_features(g, "0xroot", "Binance", candidate_nodes)

    assert "has_sweep_pattern" in feats
    assert "has_peel_chain" in feats
    assert "is_clustered_entity" in feats
    assert "cluster_member_count" in feats

    vec = extended_feature_dict_to_vector(feats)
    assert len(vec) == 31
    assert all(isinstance(v, float) for v in vec)


# ==============================================================================
# 5. Tests for Risk Scorer Refinements & Anti-Double-Counting
# ==============================================================================

def test_risk_scorer_sweep_and_peel_signals():
    """Verify SWEEP_CONSOLIDATION and PEEL_CHAIN fire and generate explainable audit trails."""
    g = nx.MultiDiGraph()
    root = "0xsuspect"
    g.add_node(root, hop=0, role="INPUT_WALLET")

    # Construct peeling chain from root
    t0 = datetime.now(timezone.utc)
    g.add_edge(root, "0xpeel_out1", amount=0.2, timestamp=t0, tx_hash="tx_p1")
    g.add_edge(root, "0xchange1", amount=2.0, timestamp=t0, tx_hash="tx_c1")
    g.add_edge("0xchange1", "0xpeel_out2", amount=0.2, timestamp=t0, tx_hash="tx_p2")
    g.add_edge("0xchange1", "0xchange2", amount=1.8, timestamp=t0, tx_hash="tx_c2")

    # Construct sweep consolidation into 0xcollector
    collector = "0xcollector"
    for i in range(4):
        src = f"0xsweep_src_{i}"
        g.add_edge(src, collector, amount=1.0, timestamp=t0, tx_hash=f"tx_s_{i}")

    cluster_info = {"cluster_id": root, "cluster_size": 4, "members": [root, "0xco1", "0xco2", "0xco3"]}

    assessment = RiskClassifier.evaluate_risk(g, root, cluster_info=cluster_info)

    # Check indicators
    indicators_str = " ".join(assessment.indicators)
    assert "Peel chain" in indicators_str
    assert "Sweep transaction" in indicators_str
    assert "Common-input" in indicators_str

    # Check score bounds [0-100]
    assert 0.0 <= assessment.score <= 100.0


def test_risk_scorer_dispersion_layer_cap():
    """
    Verify anti-double-counting: Multiple dispersion signals (PEEL_CHAIN + HIGH_FAN_OUT +
    HIGH_FAN_IN + SWEEP_CONSOLIDATION + COMMON_INPUT_CLUSTER) must NEVER exceed DISPERSION_LAYER cap (25).
    """
    g = nx.MultiDiGraph()
    root = "0xsuper_spammer"
    g.add_node(root, hop=0)

    # Spread timestamps across 10 days with non-round amounts to isolate dispersion layer
    t0 = datetime.now(timezone.utc)
    for i in range(6):
        g.add_edge(root, f"0xout_{i}", amount=1.2345 + i * 0.111, timestamp=t0 + timedelta(days=i), tx_hash=f"tx_out_{i}")

    agg = "0xaggregator"
    for i in range(6):
        g.add_edge(f"0xin_{i}", agg, amount=2.3456 + i * 0.111, timestamp=t0 + timedelta(days=i + 10), tx_hash=f"tx_in_{i}")

    cluster_info = {"cluster_id": root, "cluster_size": 10}

    assessment = RiskClassifier.evaluate_risk(g, root, cluster_info=cluster_info)

    # Raw points for all dispersion signals:
    # HIGH_FAN_OUT (12) + HIGH_FAN_IN (12) + SWEEP (15) + COMMON_INPUT (12) = 51 raw points!
    # But DISPERSION_LAYER cap is 25!
    # Verify dispersion signals sum to exactly the category cap (25) and subsequent signals are capped at 0pts
    dispersion_pts = 0
    for ind in assessment.indicators:
        if any(term in ind for term in ["High fan-out", "High fan-in", "Sweep transaction", "Common-input", "Peel chain"]):
            if "[+" in ind and "pts]" in ind:
                pt_str = ind.split("[+")[1].split("pts]")[0]
                if pt_str.isdigit():
                    dispersion_pts += int(pt_str)

    assert dispersion_pts == 25
    assert any("layer capped" in ind for ind in assessment.indicators)


# ==============================================================================
# 6. Tests for FastAPI Heuristic Endpoints
# ==============================================================================

@pytest.fixture
def client():
    return TestClient(app)


def test_api_cluster_common_input_and_query(client):
    """Test POST /api/v1/heuristics/clustering/common-input and GET /cluster/{address}."""
    t0 = datetime.now(timezone.utc).isoformat()
    payload = [
        {
            "tx_hash": "tx_api_cioh_1",
            "chain": "bitcoin",
            "timestamp": t0,
            "inputs": [
                {"address": "bc1qtestaaa", "amount_btc": 1.0},
                {"address": "bc1qtestbbb", "amount_btc": 1.5}
            ],
            "outputs": [
                {"address": "bc1qdest", "amount_btc": 2.49}
            ]
        }
    ]

    response = client.post("/api/v1/heuristics/clustering/common-input", json=payload)
    assert response.status_code == 200
    data = response.json()
    assert data["transactions_processed"] == 1
    assert data["multi_input_clustering_events"] >= 1

    # Query cluster endpoint
    q_resp = client.get("/api/v1/heuristics/cluster/bc1qtestaaa")
    assert q_resp.status_code == 200
    q_data = q_resp.json()
    assert q_data["is_clustered"] is True
    assert q_data["cluster"]["cluster_size"] >= 2
    assert "bc1qtestbbb" in q_data["cluster"]["members"]


def test_api_sweep_detection_endpoint(client):
    """Test POST /api/v1/heuristics/sweep-detection."""
    t0 = datetime.now(timezone.utc).isoformat()
    payload = [
        {
            "tx_hash": "tx_api_sweep",
            "chain": "bitcoin",
            "timestamp": t0,
            "inputs": [
                {"address": f"bc1qdeposit_{i}", "amount_btc": 0.5}
                for i in range(4)
            ],
            "outputs": [
                {"address": "bc1qcentral_hot_wallet", "amount_btc": 1.99}
            ]
        }
    ]

    resp = client.post("/api/v1/heuristics/sweep-detection", json=payload)
    assert resp.status_code == 200
    sweeps = resp.json()
    assert len(sweeps) == 1
    assert sweeps[0]["sweep_target_address"] == "bc1qcentral_hot_wallet"
    assert sweeps[0]["input_count"] == 4


def test_api_peel_chain_endpoint(client):
    """Test POST /api/v1/heuristics/peel-chain."""
    t0 = datetime(2026, 1, 1, 10, 0, 0, tzinfo=timezone.utc)
    t1 = t0 + timedelta(minutes=10)

    payload = [
        {
            "tx_hash": "tx_api_peel_1",
            "chain": "bitcoin",
            "timestamp": t0.isoformat(),
            "inputs": [{"address": "bc1qwhale", "amount_btc": 10.0}],
            "outputs": [
                {"address": "bc1qmerchant1", "amount_btc": 1.0},
                {"address": "bc1qchange1", "amount_btc": 8.99}
            ]
        },
        {
            "tx_hash": "tx_api_peel_2",
            "chain": "bitcoin",
            "timestamp": t1.isoformat(),
            "inputs": [{"address": "bc1qchange1", "amount_btc": 8.99}],
            "outputs": [
                {"address": "bc1qmerchant2", "amount_btc": 1.0},
                {"address": "bc1qchange2", "amount_btc": 7.98}
            ]
        }
    ]

    resp = client.post("/api/v1/heuristics/peel-chain?min_length=2", json=payload)
    assert resp.status_code == 200
    chains = resp.json()
    assert len(chains) == 1
    assert chains[0]["chain_length"] == 2
    assert chains[0]["total_peeled_amount"] == 2.0


def test_api_composite_heuristic_analyze(client):
    """Test POST /api/v1/heuristics/analyze."""
    t0 = datetime.now(timezone.utc).isoformat()
    req = {
        "raw_transactions": [
            {
                "tx_hash": "tx_composite_1",
                "chain": "bitcoin",
                "timestamp": t0,
                "inputs": [
                    {"address": "bc1qco_a", "amount_btc": 1.0},
                    {"address": "bc1qco_b", "amount_btc": 1.0}
                ],
                "outputs": [
                    {"address": "bc1qtarget", "amount_btc": 1.99}
                ]
            }
        ],
        "address": "bc1qco_a"
    }

    resp = client.post("/api/v1/heuristics/analyze", json=req)
    assert resp.status_code == 200
    summary = resp.json()
    assert summary["cluster"] is not None
    assert summary["cluster"]["cluster_size"] >= 2
    assert summary["metrics"]["is_clustered"] is True


# ==============================================================================
# 7. Tests for Elliptic++ & FATF Risk Alignment and Layer Capping
# ==============================================================================

def test_risk_scorer_velocity_layer_cap():
    """
    Verify VELOCITY_LAYER cap (25):
    RAPID_FORWARDING (20) + SUSPICIOUS_VELOCITY (10) = 30 raw, strictly capped to 25.
    """
    g = nx.MultiDiGraph()
    root = "0xvelocity_test"
    g.add_node(root, hop=0)

    t0 = datetime.now(timezone.utc)
    # Intermediary forwarding in 5 mins -> triggers RAPID_FORWARDING (20 pts)
    g.add_node("0xinter_hop1", hop=1)
    g.add_edge(root, "0xinter_hop1", tx_hash="tx_v1", amount=1.23, timestamp=t0)
    g.add_edge("0xinter_hop1", "0xdest_v1", tx_hash="tx_v2", amount=1.23, timestamp=t0 + timedelta(minutes=5))

    # 6+ edges in < 2 hours -> triggers SUSPICIOUS_VELOCITY (10 pts raw)
    for i in range(5):
        g.add_edge(root, f"0xdest_other_{i}", tx_hash=f"tx_other_{i}", amount=1.234 + i, timestamp=t0 + timedelta(minutes=10 + i * 5))

    assessment = RiskClassifier.evaluate_risk(g, root)

    velocity_pts = 0
    for ind in assessment.indicators:
        if any(term in ind for term in ["Rapid pass-through", "Suspicious velocity"]):
            if "[+" in ind and "pts]" in ind:
                pt_str = ind.split("[+")[1].split("pts]")[0]
                if pt_str.isdigit():
                    velocity_pts += int(pt_str)

    assert velocity_pts == CATEGORY_CAPS["VELOCITY_LAYER"]  # Exactly 25


def test_risk_scorer_recurrence_layer_cap():
    """
    Verify RECURRENCE_LAYER cap (10):
    REPEATED_DESTINATION (8) + ROUND_AMOUNT_PATTERN (5) = 13 raw, strictly capped to 10.
    """
    g = nx.MultiDiGraph()
    root = "0xrecurrence_test"
    target = "0xrepeat_target"
    g.add_node(root, hop=0)
    g.add_node(target, hop=1)

    t0 = datetime.now(timezone.utc)
    # Add 4 transfers with round amounts to the same destination over 4 days
    for i in range(4):
        g.add_edge(root, target, tx_hash=f"tx_rec_{i}", amount=10.0, timestamp=t0 + timedelta(days=i))

    assessment = RiskClassifier.evaluate_risk(g, root)

    recurrence_pts = 0
    for ind in assessment.indicators:
        if any(term in ind for term in ["Repeated destination", "Round amount"]):
            if "[+" in ind and "pts]" in ind:
                pt_str = ind.split("[+")[1].split("pts]")[0]
                if pt_str.isdigit():
                    recurrence_pts += int(pt_str)

    assert recurrence_pts == CATEGORY_CAPS["RECURRENCE_LAYER"]  # Exactly 10


def test_risk_scorer_entity_risk_layer_cap():
    """
    Verify ENTITY_RISK_LAYER cap (50):
    SANCTIONED (45) + MIXER (30) + SCAM (35) = 110 raw, capped to 50.
    """
    g = nx.MultiDiGraph()
    root = "0xentity_test"
    g.add_node(root, hop=0)
    g.add_node("0xsanc", hop=1)
    g.add_node("0xmix", hop=1)
    g.add_node("0xscam", hop=1)

    t0 = datetime.now(timezone.utc)
    g.add_edge(root, "0xsanc", tx_hash="tx_s1", amount=1.1, timestamp=t0 + timedelta(days=1))
    g.add_edge(root, "0xmix", tx_hash="tx_m1", amount=1.2, timestamp=t0 + timedelta(days=2))
    g.add_edge(root, "0xscam", tx_hash="tx_sc1", amount=1.3, timestamp=t0 + timedelta(days=3))

    known = {
        "0xsanc": "SANCTIONED",
        "0xmix": "MIXER",
        "0xscam": "SCAM"
    }
    assessment = RiskClassifier.evaluate_risk(g, root, known_entities=known)

    entity_pts = 0
    for ind in assessment.indicators:
        if any(term in ind for term in ["SANCTIONED", "Mixer", "scam"]):
            if "[+" in ind and "pts]" in ind:
                pt_str = ind.split("[+")[1].split("pts]")[0]
                if pt_str.isdigit():
                    entity_pts += int(pt_str)

    assert entity_pts == CATEGORY_CAPS["ENTITY_RISK_LAYER"]  # 50
    assert any("layer capped" in ind for ind in assessment.indicators)


def test_risk_scorer_ofac_label_store_integration():
    """
    Verify that an address present in LabelStore (OFAC SDN) is automatically detected
    without requiring manual known_entities injection.
    """
    g = nx.MultiDiGraph()
    root = "0xinvestigation_target"
    # Hydra Market OFAC SDN address (verified present in ofac_sdn.json / LabelStore baseline)
    ofac_addr = "149vaAYqWbZsQjMsGGCtVafjnhXWgk3vGu"
    g.add_node(root, hop=0)
    g.add_node(ofac_addr, hop=1)
    g.add_edge(root, ofac_addr, tx_hash="tx_ofac_direct", amount=5.0, timestamp=datetime.now(timezone.utc))

    assessment = RiskClassifier.evaluate_risk(g, root)
    indicators_str = " ".join(assessment.indicators)
    assert "SANCTIONED" in indicators_str
    assert assessment.score >= 45.0
    assert assessment.risk_level in ("MEDIUM", "HIGH", "CRITICAL")


def test_risk_scorer_strict_100_saturation():
    """
    When all 4 layers are completely saturated (Velocity=25, Dispersion=25, Recurrence=10, Entity=50 = 110 raw),
    the composite risk score must be bounded strictly to 100.0.
    """
    g = nx.MultiDiGraph()
    root = "0xheavy_illicit"
    g.add_node(root, hop=0)
    t0 = datetime.now(timezone.utc)

    # 1. Entity Layer (50 cap): SANCTIONED (45) + MIXER (30 raw -> 5 eff = 50)
    g.add_node("0xsanc_sat", hop=1)
    g.add_node("0xmix_sat", hop=1)
    g.add_edge(root, "0xsanc_sat", tx_hash="tx_s", amount=10.0, timestamp=t0)
    g.add_edge(root, "0xmix_sat", tx_hash="tx_m", amount=10.0, timestamp=t0 + timedelta(minutes=1))

    # 2. Velocity Layer (25 cap): RAPID_FORWARDING (20) + SUSPICIOUS_VELOCITY (10 raw -> 5 eff = 25)
    # Rapid forwarding: 0xsanc_sat sends within 10 min of receipt
    g.add_node("0xrapid_dest", hop=2)
    g.add_edge("0xsanc_sat", "0xrapid_dest", tx_hash="tx_rf", amount=10.0, timestamp=t0 + timedelta(minutes=5))

    # 3. Dispersion Layer (25 cap): HIGH_FAN_OUT (12) + HIGH_FAN_IN (12) + PEEL_CHAIN/SWEEP (1 eff = 25)
    # Root out-degree >= 5
    for i in range(5):
        g.add_edge(root, f"0xfan_out_{i}", tx_hash=f"tx_fan_out_{i}", amount=10.0, timestamp=t0 + timedelta(minutes=2 + i))
    # 0xaggregator in-degree >= 5
    g.add_node("0xaggregator", hop=1)
    for i in range(5):
        g.add_edge(f"0xfan_in_src_{i}", "0xaggregator", tx_hash=f"tx_fan_in_{i}", amount=10.0, timestamp=t0 + timedelta(minutes=2 + i))

    # 4. Recurrence Layer (10 cap): REPEATED_DESTINATION (8) + ROUND_AMOUNT_PATTERN (5 raw -> 2 eff = 10)
    # 0xsanc_sat received 3 transfers of round amounts (10.0)
    g.add_edge(root, "0xsanc_sat", tx_hash="tx_s_rep1", amount=10.0, timestamp=t0 + timedelta(minutes=8))
    g.add_edge(root, "0xsanc_sat", tx_hash="tx_s_rep2", amount=10.0, timestamp=t0 + timedelta(minutes=9))

    known = {"0xsanc_sat": "SANCTIONED", "0xmix_sat": "MIXER"}
    assessment = RiskClassifier.evaluate_risk(g, root, known_entities=known)

    assert assessment.score == 100.0
    assert assessment.risk_level == "CRITICAL"
