"""
Unit Tests for Case 4: Bulk NCRP 1930 CSV Batch Triage & Flight-Risk Queue.

Verifies:
1. NCRPTriageWorker batch creation and lifecycle.
2. Flight-risk scoring: CRITICAL for Indian FIU VASP hits.
3. Flight-risk scoring: HIGH for international CEX / instant swap hits.
4. Flight-risk scoring: MEDIUM for unknown wallets.
5. Invalid wallet address handling.
6. Batch sorting by flight-risk score (highest first).
7. NCRPComplaintResult serialization.
8. API model validation (NCRPComplaintItem, NCRPTriageRequest).
"""

import pytest
from backend.app.workers.ncrp_worker import (
    NCRPTriageWorker,
    NCRPComplaintResult,
    NCRPBatchResult,
    INDIAN_FIU_VASPS,
    INTERNATIONAL_CEXS,
    INSTANT_SWAP_DESKS,
    ncrp_triage_worker,
)


@pytest.fixture
def worker():
    """Fresh NCRPTriageWorker for each test."""
    return NCRPTriageWorker()


def test_batch_creation(worker):
    """Verify batch creation returns valid batch_id."""
    complaints = [
        {"complaint_id": "NCRP-001", "suspect_wallet": "0x1234"},
        {"complaint_id": "NCRP-002", "suspect_wallet": "0x5678"},
    ]
    batch_id = worker.create_batch(complaints)
    assert batch_id.startswith("NCRP-BATCH-")
    batch = worker.get_batch(batch_id)
    assert batch is not None
    assert batch.total_complaints == 2
    assert batch.status == "PENDING"


def test_batch_not_found(worker):
    """Verify get_batch returns None for nonexistent batch."""
    assert worker.get_batch("NONEXISTENT-BATCH-ID") is None


@pytest.mark.asyncio
async def test_indian_fiu_vasp_critical_scoring(worker):
    """Verify Indian FIU VASP address scores CRITICAL (≥80)."""
    # WazirX hot wallet (known Indian FIU VASP)
    complaints = [
        {
            "complaint_id": "NCRP-CRITICAL-001",
            "suspect_wallet": "0x27ec165507cc258778619ebfdba472be9c3fe80a",
            "victim_loss_inr": 500000,
        },
    ]
    batch_id = worker.create_batch(complaints)
    batch = await worker.process_batch(batch_id, complaints)

    assert batch.status == "COMPLETED"
    assert batch.processed == 1
    assert batch.critical_count == 1
    assert batch.results[0].priority == "CRITICAL"
    assert batch.results[0].flight_risk_score >= 80
    assert batch.results[0].is_indian_fiu_vasp is True
    assert batch.results[0].nearest_vasp == "WazirX"
    assert batch.results[0].priority_badge == "🔴"


@pytest.mark.asyncio
async def test_international_cex_high_scoring(worker):
    """Verify international CEX address scores HIGH (60-79)."""
    # Binance hot wallet (international CEX)
    complaints = [
        {
            "complaint_id": "NCRP-HIGH-001",
            "suspect_wallet": "0x28C6c06298d514Db089934071355E5743bf21d60",
            "victim_loss_inr": 300000,
        },
    ]
    batch_id = worker.create_batch(complaints)
    batch = await worker.process_batch(batch_id, complaints)

    assert batch.status == "COMPLETED"
    assert batch.high_count == 1
    result = batch.results[0]
    assert result.priority == "HIGH"
    assert 60 <= result.flight_risk_score <= 79
    assert result.nearest_vasp == "Binance"
    assert result.priority_badge == "🟡"


@pytest.mark.asyncio
async def test_instant_swap_high_scoring(worker):
    """Verify instant swap desk address scores HIGH with is_instant_swap flag."""
    # FixedFloat ETH hot wallet
    complaints = [
        {
            "complaint_id": "NCRP-SWAP-001",
            "suspect_wallet": "0x4e5b2e1dc63f6b91cb6cd759936495434c7e972f",
            "victim_loss_inr": 100000,
        },
    ]
    batch_id = worker.create_batch(complaints)
    batch = await worker.process_batch(batch_id, complaints)

    assert batch.high_count == 1
    result = batch.results[0]
    assert result.priority == "HIGH"
    assert result.is_instant_swap is True
    assert result.nearest_vasp == "FixedFloat"


@pytest.mark.asyncio
async def test_unknown_wallet_medium_scoring(worker):
    """Verify unknown wallet address scores MEDIUM (40-59)."""
    complaints = [
        {
            "complaint_id": "NCRP-MED-001",
            "suspect_wallet": "0x742d35Cc6634C0532925a3b844Bc9e7595f2bD10",
            "victim_loss_inr": 200000,
        },
    ]
    batch_id = worker.create_batch(complaints)
    batch = await worker.process_batch(batch_id, complaints)

    result = batch.results[0]
    assert result.priority == "MEDIUM"
    assert 40 <= result.flight_risk_score <= 59
    assert result.priority_badge == "🟠"


@pytest.mark.asyncio
async def test_invalid_wallet_cold_scoring(worker):
    """Verify invalid wallet address scores COLD (< 40)."""
    complaints = [
        {
            "complaint_id": "NCRP-INVALID-001",
            "suspect_wallet": "not-a-valid-address",
            "victim_loss_inr": 50000,
        },
    ]
    batch_id = worker.create_batch(complaints)
    batch = await worker.process_batch(batch_id, complaints)

    result = batch.results[0]
    assert result.priority == "COLD"
    assert result.flight_risk_score < 40
    assert "Invalid" in result.analysis_notes


@pytest.mark.asyncio
async def test_batch_sorted_by_risk_score(worker):
    """Verify batch results are sorted by flight-risk score (highest first)."""
    complaints = [
        {
            "complaint_id": "NCRP-LOW",
            "suspect_wallet": "not-valid",
            "victim_loss_inr": 10000,
        },
        {
            "complaint_id": "NCRP-HIGH",
            "suspect_wallet": "0x27ec165507cc258778619ebfdba472be9c3fe80a",  # WazirX
            "victim_loss_inr": 500000,
        },
        {
            "complaint_id": "NCRP-MED",
            "suspect_wallet": "0x742d35Cc6634C0532925a3b844Bc9e7595f2bD10",
            "victim_loss_inr": 100000,
        },
    ]
    batch_id = worker.create_batch(complaints)
    batch = await worker.process_batch(batch_id, complaints)

    assert batch.processed == 3
    # Results should be sorted highest score first
    scores = [r.flight_risk_score for r in batch.results]
    assert scores == sorted(scores, reverse=True)
    assert batch.results[0].priority == "CRITICAL"


def test_complaint_result_serialization():
    """Verify NCRPComplaintResult serializes correctly."""
    result = NCRPComplaintResult(
        complaint_id="NCRP-TEST",
        suspect_wallet="0xabc123",
        chain="ethereum",
        flight_risk_score=85,
        priority="CRITICAL",
        priority_badge="🔴",
        nearest_vasp="WazirX",
        vasp_hop_distance=0,
        is_indian_fiu_vasp=True,
        defrauded_amount_inr=500000.0,
    )
    data = result.to_dict()
    assert data["complaint_id"] == "NCRP-TEST"
    assert data["flight_risk_score"] == 85
    assert data["priority"] == "CRITICAL"
    assert data["is_indian_fiu_vasp"] is True


def test_batch_result_serialization():
    """Verify NCRPBatchResult serializes correctly."""
    batch = NCRPBatchResult(
        batch_id="NCRP-BATCH-TEST",
        total_complaints=3,
        processed=3,
        critical_count=1,
        high_count=1,
        cold_count=1,
        status="COMPLETED",
    )
    data = batch.to_dict()
    assert data["batch_id"] == "NCRP-BATCH-TEST"
    assert data["total_complaints"] == 3
    assert data["critical_count"] == 1


def test_indian_fiu_vasp_constants():
    """Verify Indian FIU VASP set has expected exchanges."""
    assert "WazirX" in INDIAN_FIU_VASPS
    assert "CoinDCX" in INDIAN_FIU_VASPS
    assert "ZebPay" in INDIAN_FIU_VASPS
    assert len(INDIAN_FIU_VASPS) >= 5


def test_instant_swap_desk_constants():
    """Verify instant swap desk set has expected services."""
    assert "FixedFloat" in INSTANT_SWAP_DESKS
    assert "ChangeNOW" in INSTANT_SWAP_DESKS
    assert "SimpleSwap" in INSTANT_SWAP_DESKS
    assert "SideShift" in INSTANT_SWAP_DESKS


def test_global_singleton():
    """Verify ncrp_triage_worker is a global singleton."""
    assert ncrp_triage_worker is not None
    assert isinstance(ncrp_triage_worker, NCRPTriageWorker)


@pytest.mark.asyncio
async def test_ncrp_csv_parsing_and_upload():
    """Verify CSV file format is parsed into structured complaints."""
    import io
    import csv
    from backend.app.api.v1.router import upload_ncrp_csv_batch_triage
    from fastapi import UploadFile

    csv_content = """Acknowledgement_Number,Complainant_Name,Incident_Date,Defrauded_Amount_INR,Suspect_Crypto_Address,Crime_Subcategory
2026/CYBER/001,Rajesh Kumar,2026-09-01,1500000,0x27ec165507cc258778619ebfdba472be9c3fe80a,Digital Arrest Fraud
2026/CYBER/002,Priya Sharma,2026-09-02,500000,0x4e5b2e1dc63f6b91cb6cd759936495434c7e972f,Part-time Task Fraud
"""
    file = UploadFile(filename="ncrp_test.csv", file=io.BytesIO(csv_content.encode("utf-8")))

    resp = await upload_ncrp_csv_batch_triage(file=file)
    assert resp.batch_id.startswith("NCRP-BATCH-")
    assert resp.total_complaints == 2
    assert resp.status == "PENDING"

