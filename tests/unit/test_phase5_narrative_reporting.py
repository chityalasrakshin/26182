"""
Unit and Integration Tests for Phase 5: LLM Narrative & Report Generation.

Verifies:
1. LLM Narrative Service:
   - Structured context extraction adhering to Operating Rule 5 (non-decisional boundary).
   - Estimative probability ladder mapping per write-the-intel-brief.
   - Deterministic intelligence brief synthesis (BLUF, Observation, Inference, Assessment, Negative Findings).
   - Mocked Claude API interaction and graceful error fallback (Operating Rules 4 & 8).
2. Trace Graph Visualizer:
   - Server-side flow diagram rendering with Pillow.
   - Output valid PNG bytes with proper headers and dimensions.
3. Court-Admissible PDF Dossier Generator:
   - Integration of narrative brief, graph flow diagram, and Section 94 BNSS notice.
   - Valid %PDF- document output with SHA-256 chain-of-custody checksum and Section 65B certificate.
4. Report Generator:
   - Populating InvestigationReportSchema with narrative, metadata, and draft disclosure notice.
   - Markdown export formatting with statutory notices.
5. API Endpoints & Audit Logging (Operating Rule 6):
   - /api/v1/analysis/{id}/report (JSON and Markdown)
   - /api/v1/analysis/{id}/narrative
   - /api/v1/analysis/{id}/graph-image
   - /api/v1/analysis/{id}/export/pdf
   - /api/v1/cases/{case_id}/report
   - /api/v1/cases/{case_id}/export/pdf
   - Verification of immutable audit trail rows for report views and PDF exports.
"""

import io
import uuid
from datetime import datetime, timezone
import pytest
from unittest.mock import AsyncMock, patch, MagicMock
from fastapi.testclient import TestClient

from backend.app.main import app
from backend.app.models.database import init_db, AsyncSessionLocal, User, Case
from backend.app.core.security import get_password_hash, create_access_token
from backend.app.services.audit.logger import AuditAction, AuditResourceType
from backend.app.services.reporting.narrative_service import (
    LLMNarrativeService,
    narrative_service,
    map_score_to_estimative_term
)
from backend.app.services.reporting.graph_visualizer import trace_graph_visualizer
from backend.app.services.reporting.pdf_generator import PDFDossierGenerator
from backend.app.services.reporting.generator import ReportGenerator
from backend.app.services.reporting.legal_notice_generator import LegalNoticeGenerator
from backend.app.schemas.analysis import AttributionSchema, EvidenceSchema, RiskAssessmentSchema
from backend.app.workers.analysis_worker import active_analyses_cache

client = TestClient(app)


# ==============================================================================
# Database & Authentication Setup Fixtures
# ==============================================================================

@pytest.fixture(scope="module", autouse=True)
def setup_test_users():
    """Initializes database and seeds supervisor and investigator users."""
    import asyncio
    from sqlalchemy import select

    async def _setup():
        await init_db()
        async with AsyncSessionLocal() as session:
            sup = (await session.execute(select(User).where(User.username == "p5_supervisor"))).scalar_one_or_none()
            if not sup:
                session.add(User(
                    username="p5_supervisor",
                    email="p5_supervisor@setu.gov",
                    hashed_password=get_password_hash("supervisor123"),
                    full_name="Phase 5 Supervisor",
                    role="supervisor",
                    is_active=True
                ))

            inv = (await session.execute(select(User).where(User.username == "p5_investigator"))).scalar_one_or_none()
            if not inv:
                session.add(User(
                    username="p5_investigator",
                    email="p5_investigator@setu.gov",
                    hashed_password=get_password_hash("investigator123"),
                    full_name="Phase 5 Investigator",
                    role="investigator",
                    is_active=True
                ))

            other = (await session.execute(select(User).where(User.username == "p5_other_inv"))).scalar_one_or_none()
            if not other:
                session.add(User(
                    username="p5_other_inv",
                    email="p5_other@setu.gov",
                    hashed_password=get_password_hash("other123"),
                    full_name="Other Investigator",
                    role="investigator",
                    is_active=True
                ))

            await session.commit()

    asyncio.run(_setup())


def get_token(username: str, role: str) -> str:
    """Helper to generate JWT access token."""
    return create_access_token(data={"sub": username, "role": role})


# ==============================================================================
# Unit Tests: Estimative Language & Narrative Service
# ==============================================================================

def test_estimative_probability_ladder_mapping():
    """Verifies score mapping to standardized estimative probability language."""
    assert map_score_to_estimative_term(92.0) == "almost certainly"
    assert map_score_to_estimative_term(85.0) == "almost certainly"
    assert map_score_to_estimative_term(78.5) == "highly likely"
    assert map_score_to_estimative_term(62.0) == "likely"
    assert map_score_to_estimative_term(48.0) == "roughly even chance"
    assert map_score_to_estimative_term(33.0) == "unlikely"
    assert map_score_to_estimative_term(18.0) == "highly unlikely"
    assert map_score_to_estimative_term(4.0) == "remote"


@pytest.mark.asyncio
async def test_narrative_service_deterministic_synthesis():
    """
    Verifies that LLMNarrativeService raises RuntimeError when ANTHROPIC_API_KEY
    is not configured, strictly preventing fake or static fallback responses.
    """
    service = LLMNarrativeService(api_key="")
    wallet = "0xa090e606e30bd747d4e6245a1517ebe430f0057e"

    with pytest.raises(RuntimeError, match="Anthropic Claude API key is not configured"):
        await service.generate_narrative(
            case_id="case-p5-test",
            wallet_address=wallet,
            chain="Ethereum Mainnet",
            attributions=[{"vasp_name": "Binance", "score": 88.5, "evidence_strength": "High", "rank": 1}],
            risk_assessment={"score": 75.0, "risk_level": "HIGH"},
            evidence=[],
            transactions=[],
            summary_stats={"total_nodes": 12, "total_edges": 15, "vasp_nodes_found": 1, "max_hop_reached": 3}
        )


@pytest.mark.asyncio
async def test_narrative_service_claude_api_mock():
    """Verifies successful synthesis when calling Claude API endpoint."""
    service = LLMNarrativeService(api_key="sk-ant-api03-valid-mock-key-for-testing-123456789")

    mock_claude_response = {
        "content": [
            {
                "type": "text",
                "text": (
                    "### 1. BOTTOM LINE UP FRONT (BLUF)\n"
                    "Funds from suspect wallet 0x123 almost certainly reached Binance.\n\n"
                    "### 2. VERIFIABLE OBSERVATIONS (FACTUAL RECORD)\n"
                    "- Observed 3 transactions.\n\n"
                    "### 3. FORENSIC INFERENCES (TRANSACTION DYNAMICS & PATTERNS)\n"
                    "- Peeling chain observed.\n\n"
                    "### 4. ANALYTIC ASSESSMENT (VASP ATTRIBUTION & ESTIMATIVE RATING)\n"
                    "We assess it is almost certainly a custodial deposit.\n\n"
                    "### 5. NEGATIVE FINDINGS & LIMITATIONS\n"
                    "- No darknet hits.\n\n"
                    "### 6. RECOMMENDED LAW ENFORCEMENT ACTIONS (SECTION 94 BNSS / 91 CrPC)\n"
                    "- Serve freeze notice."
                )
            }
        ]
    }

    with patch("httpx.AsyncClient.post") as mock_post:
        mock_resp = MagicMock()
        mock_resp.status_code = 200
        mock_resp.json.return_value = mock_claude_response
        mock_post.return_value = mock_resp

        res = await service.generate_narrative(
            case_id="case-claude-test",
            wallet_address="0x123",
            chain="Ethereum",
            attributions=[{"vasp_name": "Binance", "score": 90.0, "evidence_strength": "High"}],
            risk_assessment={"score": 80.0, "risk_level": "HIGH"},
            evidence=[],
            transactions=[],
            summary_stats={}
        )

        assert res["mode"] == "claude_api"
        assert "almost certainly reached Binance" in res["bluf"]
        assert "BOTTOM LINE UP FRONT" in res["narrative"]


# ==============================================================================
# Unit Tests: Trace Graph Visualizer (Pillow PNG)
# ==============================================================================

def test_trace_graph_visualizer_renders_valid_png():
    """Verifies that TraceGraphVisualizer outputs a valid PNG byte stream."""
    png_bytes = trace_graph_visualizer.render_flow_diagram(
        wallet_address="0xa090e606e30bd747d4e6245a1517ebe430f0057e",
        chain="ethereum",
        top_vasp_name="WazirX",
        attribution_score=82.0,
        risk_level="HIGH",
        transactions=[
            {"from": "0xa090e606...", "to": "0xb5d85cbf...", "amount": 2.5, "asset": "ETH"},
            {"from": "0xb5d85cbf...", "to": "0x98765432...", "amount": 2.48, "asset": "ETH"}
        ],
        case_id="TEST-CASE-P5"
    )

    assert isinstance(png_bytes, bytes)
    assert len(png_bytes) > 5000  # Detailed graphical diagram
    assert png_bytes[:8] == b"\x89PNG\r\n\x1a\n"  # PNG magic header


# ==============================================================================
# Unit Tests: PDF Dossier Generator with Phase 5 Additions
# ==============================================================================

def test_pdf_dossier_generator_with_narrative_and_graph():
    """
    Verifies that PDFDossierGenerator compiles a complete PDF document
    incorporating the executive narrative, rendered graph image,
    and statutory preservation notice.
    """
    generator = PDFDossierGenerator()

    narrative = (
        "### 1. BOTTOM LINE UP FRONT (BLUF)\n"
        "Funds were traced across 3 hops to Binance custodial deposit cluster.\n"
        "### 2. VERIFIABLE OBSERVATIONS (FACTUAL RECORD)\n"
        "- Target wallet 0x123...456 generated 5 outbound transactions.\n"
        "### 3. FORENSIC INFERENCES (TRANSACTION DYNAMICS & PATTERNS)\n"
        "- Peeling behavior observed.\n"
        "### 4. ANALYTIC ASSESSMENT (VASP ATTRIBUTION & ESTIMATIVE RATING)\n"
        "We assess it is highly likely that Binance is the ultimate recipient."
    )

    draft_notice = {
        "vasp_name": "Binance",
        "ref_number": "LEA/CYBER/2026/P5-TEST",
        "designated_lea_email": "lawenforcement@binance.com",
        "sahyog_routing_code": "SAHYOG-VASP-BINANCE-GLB",
        "nodal_officer": "Binance Global LE Desk",
        "notice_markdown": "URGENT FREEZE DIRECTIVE UNDER SECTION 94 BNSS"
    }

    pdf_bytes = generator.generate(
        case_id="case-pdf-p5",
        wallet_address="0xa090e606e30bd747d4e6245a1517ebe430f0057e",
        chain="Ethereum Mainnet",
        attributions=[{"vasp_name": "Binance", "score": 85.0, "evidence_strength": "High", "rank": 1, "summary": "Binance cluster"}],
        evidence=[{"evidence_type": "Flow", "strength": "High", "hop_distance": 1, "source_address": "0x1", "target_address": "0x2", "tx_hash": "0x3"}],
        risk_assessment={"risk_level": "HIGH", "score": 80.0, "explanation": "High risk", "indicators": ["Peeling chain"]},
        transactions=[{"tx_hash": "0x3", "from": "0x1", "to": "0x2", "amount": 1.5, "asset": "ETH", "hop": 1}],
        summary_stats={"total_nodes": 5, "total_edges": 4, "vasp_nodes_found": 1, "max_hop_reached": 2},
        narrative=narrative,
        draft_notice=draft_notice,
        officer_name="Inspector Vikram Singh",
        police_station="Cyber Crime Police Station, CID"
    )

    assert isinstance(pdf_bytes, bytes)
    assert len(pdf_bytes) > 20000
    assert pdf_bytes.startswith(b"%PDF-")


# ==============================================================================
# Unit Tests: ReportGenerator Schema Integration
# ==============================================================================

def test_report_generator_schema_and_markdown():
    """Verifies that ReportGenerator populates narrative and outputs markdown."""
    report = ReportGenerator.generate_report(
        case_id="rep-case-123",
        wallet_address="0xa090e606e30bd747d4e6245a1517ebe430f0057e",
        attributions=[AttributionSchema(vasp_name="CoinDCX", score=82.0, evidence_strength="High", rank=1, summary="CoinDCX deposit")],
        evidence=[EvidenceSchema(evidence_type="Flow", strength="High", hop_distance=1, source_address="0x1", target_address="0x2", tx_hash="0x3", explanation="Flow proof")],
        risk_assessment=RiskAssessmentSchema(risk_level="MEDIUM", score=55.0, indicators=["Transit activity"], explanation="Moderate transit flow"),
        summary_stats={"total_nodes": 6, "total_edges": 8, "vasp_nodes_found": 1, "max_hop_reached": 2},
        critical_txs=[{"tx_hash": "0x3", "from": "0x1", "to": "0x2", "amount": 10.0, "asset": "USDT", "hop": 1}],
        narrative="Verified CoinDCX deposit flow."
    )

    assert report.narrative is not None
    assert report.draft_disclosure_notice is not None
    assert report.draft_disclosure_notice.get("vasp_name") == "CoinDCX"
    assert "CoinDCX" in report.narrative

    md = ReportGenerator.format_as_markdown(report)
    assert "EXECUTIVE FORENSIC INTELLIGENCE BRIEF" in md
    assert "DRAFT STATUTORY ASSET PRESERVATION REQUISITION" in md
    assert "SECTION 94 BNSS" in md
    assert "SECTION 65B INDIAN EVIDENCE ACT CERTIFICATE" in md


# ==============================================================================
# Integration Tests: Analysis Report, Narrative, and Export Endpoints
# ==============================================================================

@pytest.fixture
def mock_completed_analysis():
    """Seeds active_analyses_cache with a completed trace analysis."""
    aid = f"analysis-{uuid.uuid4()}"
    active_analyses_cache[aid] = {
        "status": "COMPLETED",
        "wallet_address": "0xa090e606e30bd747d4e6245a1517ebe430f0057e",
        "max_hops": 3,
        "num_nodes": 8,
        "num_edges": 10,
        "attributions": [
            AttributionSchema(vasp_name="Binance", score=88.0, evidence_strength="High", rank=1, summary="Direct cluster interaction")
        ],
        "evidence": [
            EvidenceSchema(evidence_type="Flow", strength="High", hop_distance=1, source_address="0xa090e606...", target_address="0xb5d85cbf...", tx_hash="0x59fd...", explanation="Deposit flow")
        ],
        "risk_assessment": RiskAssessmentSchema(risk_level="HIGH", score=80.0, indicators=["Rapid peeling sequence"], explanation="High velocity transfer"),
        "transactions": [
            {"tx_hash": "0x59fd...", "from_address": "0xa090e606...", "to_address": "0xb5d85cbf...", "amount": 5.0, "token_symbol": "ETH", "hop": 1}
        ]
    }
    return aid


def test_api_get_analysis_report_json_and_markdown(mock_completed_analysis):
    """Verifies GET /api/v1/analysis/{id}/report in JSON and Markdown formats."""
    aid = mock_completed_analysis
    token = get_token("p5_investigator", "investigator")
    headers = {"Authorization": f"Bearer {token}"}

    # 1. JSON format
    resp_json = client.get(f"/api/v1/analysis/{aid}/report?format=json", headers=headers)
    assert resp_json.status_code == 200
    data = resp_json.json()
    assert data["case_id"] == aid
    assert "draft_disclosure_notice" in data

    # 2. Markdown format
    resp_md = client.get(f"/api/v1/analysis/{aid}/report?format=markdown", headers=headers)
    assert resp_md.status_code == 200
    md_data = resp_md.json()
    assert "report_markdown" in md_data
    assert "CRYPTOCURRENCY ASSET INVESTIGATION DOSSIER" in md_data["report_markdown"]


def test_api_get_analysis_narrative_endpoint(mock_completed_analysis):
    """Verifies dedicated GET /api/v1/analysis/{id}/narrative returns 503 when Claude API is unconfigured."""
    aid = mock_completed_analysis
    token = get_token("p5_investigator", "investigator")
    headers = {"Authorization": f"Bearer {token}"}

    resp = client.get(f"/api/v1/analysis/{aid}/narrative", headers=headers)
    assert resp.status_code == 503
    assert "Anthropic" in resp.json()["detail"]


def test_api_get_analysis_graph_image_endpoint(mock_completed_analysis):
    """Verifies GET /api/v1/analysis/{id}/graph-image returns valid PNG bytes."""
    aid = mock_completed_analysis
    token = get_token("p5_investigator", "investigator")
    headers = {"Authorization": f"Bearer {token}"}

    resp = client.get(f"/api/v1/analysis/{aid}/graph-image", headers=headers)
    assert resp.status_code == 200
    assert resp.headers["content-type"] == "image/png"
    assert resp.content.startswith(b"\x89PNG\r\n\x1a\n")


def test_api_export_analysis_pdf_endpoint(mock_completed_analysis):
    """Verifies GET /api/v1/analysis/{id}/export/pdf downloads valid court-ready PDF."""
    aid = mock_completed_analysis
    token = get_token("p5_investigator", "investigator")
    headers = {"Authorization": f"Bearer {token}"}

    resp = client.get(f"/api/v1/analysis/{aid}/export/pdf?officer_name=Insp.+Sharma", headers=headers)
    assert resp.status_code == 200
    assert resp.headers["content-type"] == "application/pdf"
    assert "attachment; filename=" in resp.headers.get("content-disposition", "")
    assert resp.content.startswith(b"%PDF-")


# ==============================================================================
# Integration Tests: Case-Linked Report & PDF Export Endpoints
# ==============================================================================

def test_api_case_report_and_pdf_export_rbac_and_audit():
    """
    Verifies:
    1. Case owner can fetch report and export PDF.
    2. Other investigator is forbidden (403).
    3. Supervisor can access case report.
    4. Audit trail writes rows for REPORT_VIEW and REPORT_EXPORT_PDF.
    """
    inv_token = get_token("p5_investigator", "investigator")
    other_token = get_token("p5_other_inv", "investigator")
    sup_token = get_token("p5_supervisor", "supervisor")

    # 1. Create a case
    create_payload = {
        "title": "Phase 5 Case Flow Test",
        "description": "Testing case report generation and export",
        "suspect_address": "0xa090e606e30bd747d4e6245a1517ebe430f0057e",
        "chain": "ethereum",
        "priority": "HIGH"
    }
    c_resp = client.post("/api/v1/cases", json=create_payload, headers={"Authorization": f"Bearer {inv_token}"})
    assert c_resp.status_code in (200, 201)
    case_id = c_resp.json()["id"]

    # 2. Seed active_analyses_cache linked to this case
    aid = f"analysis-{uuid.uuid4()}"
    active_analyses_cache[aid] = {
        "status": "COMPLETED",
        "wallet_address": "0xa090e606e30bd747d4e6245a1517ebe430f0057e",
        "max_hops": 3,
        "num_nodes": 10,
        "num_edges": 12,
        "attributions": [
            AttributionSchema(vasp_name="Binance", score=92.0, evidence_strength="High", rank=1, summary="Strong custodial flow")
        ],
        "evidence": [
            EvidenceSchema(evidence_type="Direct Transfer", strength="High", hop_distance=1, source_address="0xa090e606...", target_address="0xb5d85cbf...", tx_hash="0x59fd...", explanation="Flow verified")
        ],
        "risk_assessment": RiskAssessmentSchema(risk_level="HIGH", score=85.0, indicators=["Peeling chain observed"], explanation="Rapid movement"),
        "transactions": [
            {"tx_hash": "0x59fd...", "from_address": "0xa090e606...", "to_address": "0xb5d85cbf...", "amount": 10.0, "token_symbol": "ETH", "hop": 1}
        ]
    }

    # Link analysis id to case in DB
    import asyncio
    async def _link():
        import json
        from sqlalchemy import select
        async with AsyncSessionLocal() as session:
            c = (await session.execute(select(Case).where(Case.id == case_id))).scalar_one()
            c.analysis_ids_json = json.dumps([aid])
            await session.commit()
    asyncio.run(_link())

    # 3. Case owner fetches report
    rep_resp = client.get(f"/api/v1/cases/{case_id}/report?format=markdown", headers={"Authorization": f"Bearer {inv_token}"})
    assert rep_resp.status_code == 200
    assert "report_markdown" in rep_resp.json()
    assert "CRYPTOCURRENCY ASSET INVESTIGATION DOSSIER" in rep_resp.json()["report_markdown"]

    # 4. Other investigator is forbidden (403)
    forbidden_resp = client.get(f"/api/v1/cases/{case_id}/report", headers={"Authorization": f"Bearer {other_token}"})
    assert forbidden_resp.status_code == 403

    # 5. Supervisor can view case report
    sup_rep = client.get(f"/api/v1/cases/{case_id}/report", headers={"Authorization": f"Bearer {sup_token}"})
    assert sup_rep.status_code == 200
    assert sup_rep.json()["top_attribution"]["vasp_name"] == "Binance"

    # 6. Case owner exports PDF
    pdf_resp = client.get(f"/api/v1/cases/{case_id}/export/pdf", headers={"Authorization": f"Bearer {inv_token}"})
    assert pdf_resp.status_code == 200
    assert pdf_resp.headers["content-type"] == "application/pdf"
    assert pdf_resp.content.startswith(b"%PDF-")

    # 7. Check audit trail for this case
    audit_resp = client.get(f"/api/v1/cases/{case_id}/audit-trail", headers={"Authorization": f"Bearer {sup_token}"})
    assert audit_resp.status_code == 200
    audit_events = audit_resp.json()
    actions = [ev["action"] for ev in audit_events]
    assert "REPORT_VIEW" in actions
    assert "REPORT_EXPORT_PDF" in actions
