"""
Unit Tests for Bitcoin Change-Address Disambiguation & Advanced Forensics (Phase 2).

Adapted from VincenzoImp/bitcoin-address-clustering (Section 4.5 Heuristics):
1. Address Reuse Heuristic (same address in input and output)
2. Optimal Change Heuristic (unnecessary input aggregation)
3. Round Value Heuristic (clean decimal payment vs irregular satoshi change)
4. Script Type Consistency (SegWit vs Legacy output format matching inputs)
5. Composite Multi-Heuristic Confidence Boosting
6. Full HeuristicsEngine Orchestration Integration
"""

import pytest
from datetime import datetime, timezone

from backend.app.schemas.heuristics import (
    UTXOTransaction,
    UTXOInput,
    UTXOOutput
)
from backend.app.services.heuristics.change_detector import (
    ChangeAddressDetector,
    change_detector,
    count_decimal_places,
    is_round_btc_amount
)
from backend.app.services.heuristics.engine import HeuristicsEngine

# Standard valid Bitcoin test addresses
GENESIS_ADDR = "1A1zP1eP5QGefi2DMPTfTL5SLmv7DivfNa"
HYDRA_ADDR = "149vaAYqWbZsQjMsGGCtVafjnhXWgk3vGu"
LAZARUS_ADDR_1 = "134r8iHv69xdT6p5qVKTsHrcUEuBVZAYak"
LAZARUS_ADDR_2 = "1PfwHNxUnkpfkK9MKjMqzR3Xq3KCtq9u17"
BINANCE_COLD = "34xp4vRoCGJym3xR7yCVPFHoCNxv4Twseo"
SEGWIT_ADDR_1 = "bc1qar0srrr7xfkvy5l643lydnw9re59gtzzwf5mdq"
SEGWIT_ADDR_2 = "bc1qw508d6qejxtdg4y5r3zarvary0c5xw7kv8f3t4"


@pytest.fixture
def detector():
    return ChangeAddressDetector()


def test_decimal_counting_and_roundness():
    """Verify decimal precision helper and round BTC detection."""
    assert count_decimal_places(1.0) == 0
    assert count_decimal_places(0.5) == 1
    assert count_decimal_places(0.025) == 3
    assert count_decimal_places(0.12345678) == 8

    assert is_round_btc_amount(1.0) is True
    assert is_round_btc_amount(0.5) is True
    assert is_round_btc_amount(0.01) is True
    assert is_round_btc_amount(0.12345678) is False


def test_optimal_change_heuristic(detector):
    """
    Test VincenzoImp Heuristic 2 (Unnecessary Input / Optimal Change):
    Inputs: 2.0 BTC, 3.0 BTC (min input = 2.0 BTC).
    Output 0: 0.45789123 BTC (< min input).
    Output 1: 4.54210877 BTC (>= min input).
    Outcome: Output 0 is change residue; Output 1 necessitated the 2nd input and is payment.
    """
    tx = UTXOTransaction(
        tx_hash="tx_opt_change_1",
        timestamp=datetime.now(timezone.utc),
        inputs=[
            UTXOInput(address=GENESIS_ADDR, amount_btc=2.0),
            UTXOInput(address=HYDRA_ADDR, amount_btc=3.0),
        ],
        outputs=[
            UTXOOutput(address=LAZARUS_ADDR_1, amount_btc=0.45789123),
            UTXOOutput(address=LAZARUS_ADDR_2, amount_btc=4.54210877),
        ]
    )

    res = detector.detect_change(tx)
    assert res is not None
    assert res.change_address == LAZARUS_ADDR_1
    assert res.payment_address == LAZARUS_ADDR_2
    assert res.change_amount_btc == 0.45789123
    assert res.payment_amount_btc == 4.54210877
    assert res.confidence_score >= 0.90
    assert "OPTIMAL_CHANGE" in res.heuristic_rule


def test_round_value_heuristic(detector):
    """
    Test VincenzoImp Heuristic 3 (Round Value / Decimal):
    Output 0 has clean merchant round amount: 1.0 BTC.
    Output 1 has irregular fractional satoshi change: 0.48723912 BTC.
    Outcome: Output 0 is payment; Output 1 is change.
    """
    tx = UTXOTransaction(
        tx_hash="tx_round_val_1",
        timestamp=datetime.now(timezone.utc),
        inputs=[
            UTXOInput(address=LAZARUS_ADDR_1, amount_btc=1.5),
        ],
        outputs=[
            UTXOOutput(address=GENESIS_ADDR, amount_btc=1.0),
            UTXOOutput(address=LAZARUS_ADDR_2, amount_btc=0.48723912),
        ]
    )

    res = detector.detect_change(tx)
    assert res is not None
    assert res.payment_address == GENESIS_ADDR
    assert res.payment_amount_btc == 1.0
    assert res.change_address == LAZARUS_ADDR_2
    assert res.change_amount_btc == 0.48723912
    assert "ROUND_PAYMENT" in res.heuristic_rule
    assert res.confidence_score >= 0.85


def test_address_reuse_heuristic(detector):
    """
    Test VincenzoImp Heuristic 1 (Address Reuse / Same Address in Input & Output):
    Output 1 sends back to one of the input addresses.
    Outcome: Output 1 is definitively identified as change (0.98 confidence).
    """
    tx = UTXOTransaction(
        tx_hash="tx_addr_reuse_1",
        timestamp=datetime.now(timezone.utc),
        inputs=[
            UTXOInput(address=GENESIS_ADDR, amount_btc=3.0),
            UTXOInput(address=HYDRA_ADDR, amount_btc=1.0),
        ],
        outputs=[
            UTXOOutput(address=LAZARUS_ADDR_1, amount_btc=3.2),
            UTXOOutput(address=GENESIS_ADDR, amount_btc=0.79),  # Reused sender address
        ]
    )

    res = detector.detect_change(tx)
    assert res is not None
    assert res.change_address == GENESIS_ADDR
    assert res.payment_address == LAZARUS_ADDR_1
    assert res.heuristic_rule == "ADDRESS_REUSE"
    assert res.confidence_score == 0.98
    assert "Address reuse" in res.explanation


def test_script_type_consistency_heuristic(detector):
    """
    Test Script Type Consistency:
    Inputs are Native SegWit (bc1q...).
    Output 0 is Legacy (1...).
    Output 1 is Native SegWit (bc1q...) matching sender wallet script format.
    Both outputs have irregular satoshi amounts (no round value bias).
    Outcome: Output 1 is change; Output 0 is payment.
    """
    tx = UTXOTransaction(
        tx_hash="tx_script_cons_1",
        timestamp=datetime.now(timezone.utc),
        inputs=[
            UTXOInput(address=SEGWIT_ADDR_1, amount_btc=2.0),
        ],
        outputs=[
            UTXOOutput(address=GENESIS_ADDR, amount_btc=1.12345678),
            UTXOOutput(address=SEGWIT_ADDR_2, amount_btc=0.87654321),
        ]
    )

    res = detector.detect_change(tx)
    assert res is not None
    assert res.change_address == SEGWIT_ADDR_2
    assert res.payment_address == GENESIS_ADDR
    assert "SCRIPT_TYPE_CONSISTENCY" in res.heuristic_rule
    assert res.confidence_score >= 0.75


def test_composite_heuristics_boost(detector):
    """
    When Optimal Change and Round Value heuristics both corroborate the same change output,
    confidence score is boosted to >= 0.95 and rule is marked COMPOSITE.
    """
    tx = UTXOTransaction(
        tx_hash="tx_composite_boost_1",
        timestamp=datetime.now(timezone.utc),
        inputs=[
            UTXOInput(address=LAZARUS_ADDR_1, amount_btc=2.5),
            UTXOInput(address=LAZARUS_ADDR_2, amount_btc=2.5),
        ],
        outputs=[
            # Output 0: Clean 4.0 BTC payment (>= min input 2.5 BTC, clean round amount)
            UTXOOutput(address=GENESIS_ADDR, amount_btc=4.0),
            # Output 1: 0.99843219 BTC change (< min input 2.5 BTC, irregular satoshi residue)
            UTXOOutput(address=HYDRA_ADDR, amount_btc=0.99843219),
        ]
    )

    res = detector.detect_change(tx)
    assert res is not None
    assert res.payment_address == GENESIS_ADDR
    assert res.change_address == HYDRA_ADDR
    assert res.confidence_score >= 0.95
    assert res.heuristic_rule == "COMPOSITE"
    assert "Optimal change" in res.explanation and "Round payment" in res.explanation


def test_heuristics_engine_change_orchestration():
    """Verify HeuristicsEngine automatically executes ChangeAddressDetector and records metrics."""
    engine = HeuristicsEngine()

    tx1 = UTXOTransaction(
        tx_hash="tx_engine_ch_1",
        timestamp=datetime.now(timezone.utc),
        inputs=[
            UTXOInput(address=LAZARUS_ADDR_1, amount_btc=2.0),
            UTXOInput(address=LAZARUS_ADDR_2, amount_btc=3.0),
        ],
        outputs=[
            UTXOOutput(address=GENESIS_ADDR, amount_btc=4.5),
            UTXOOutput(address=HYDRA_ADDR, amount_btc=0.49982314),
        ]
    )

    summary = engine.analyze_utxo_transactions([tx1], queried_address=LAZARUS_ADDR_1)

    assert len(summary.change_detected) == 1
    ch_res = summary.change_detected[0]
    assert ch_res.payment_address == GENESIS_ADDR
    assert ch_res.change_address == HYDRA_ADDR

    # Verify metrics
    assert summary.metrics["change_transactions_count"] == 1
    assert summary.metrics["total_payment_volume"] == 4.5
    assert summary.metrics["identified_change_addresses_count"] == 1

    # Verify narrative summary mentions change disambiguation
    assert "change address disambiguation(s) detected" in summary.summary


def test_api_change_detection_endpoint():
    """Verify POST /api/v1/heuristics/change-detection returns structured change analysis."""
    from fastapi.testclient import TestClient
    from backend.app.main import app
    client = TestClient(app)

    payload = [
        {
            "tx_hash": "tx_api_change_1",
            "chain": "bitcoin",
            "timestamp": "2026-03-01T12:00:00Z",
            "inputs": [
                {"address": GENESIS_ADDR, "amount_btc": 2.0},
                {"address": HYDRA_ADDR, "amount_btc": 3.0}
            ],
            "outputs": [
                {"address": LAZARUS_ADDR_1, "amount_btc": 0.45789123},
                {"address": LAZARUS_ADDR_2, "amount_btc": 4.54210877}
            ]
        }
    ]

    res = client.post("/api/v1/heuristics/change-detection", json=payload)
    assert res.status_code == 200
    data = res.json()
    assert len(data) == 1
    assert data[0]["change_address"] == LAZARUS_ADDR_1
    assert data[0]["payment_address"] == LAZARUS_ADDR_2
    assert "OPTIMAL_CHANGE" in data[0]["heuristic_rule"]
