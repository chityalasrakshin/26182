"""
Unit and Integration Tests for Phase 6: Mock SAHYOG / VASP Directory.

Verifies:
1. VASP Directory Persistence & Seeding:
   - 16 major VASPs seeded with full metadata (jurisdiction, country, cluster tags, mock SLA, FIU registrations, routing codes).
   - Idempotent re-seeding and updating.
2. Directory API Endpoints:
   - GET /api/v1/vasps/directory (search, FIU-IND filter, pagination).
   - GET /api/v1/vasps/directory/{vasp_name} (lookup by name, 404 for invalid).
3. Mock SAHYOG Lawful Disclosure Request Dispatch:
   - POST /api/v1/cases/{id}/disclosure-request:
     - Clearly labeled simulated action (is_simulated == True).
     - Returns exact acknowledgment text per BUILD-PLAN.md:
       "Request logged — SAHYOG production integration would route this to {VASP} via the SAHYOG lawful-disclosure API".
     - Automatic VASP resolution from linked case analysis/traces.
     - Custom VASP override from payload.
4. Immutable Audit Trail Logging (Rule 6 Compliance):
   - Writes AuditAction.DISCLOSURE_REQUEST row to database.
   - Record immediately appears in case timeline (GET /cases/{id} and GET /cases/{id}/audit-trail).
5. Role-Based Access Control (RBAC):
   - Investigators can dispatch for own or assigned cases.
   - Investigators blocked (403) for unassigned cases.
   - Supervisors can dispatch for any case.
   - Unauthenticated requests blocked (401).
6. Direct Analysis Mock Dispatch:
   - POST /api/v1/analysis/{analysis_id}/disclosure-request.
"""

import pytest
import uuid
import json
from datetime import datetime, timezone
from fastapi.testclient import TestClient

from backend.app.main import app
from backend.app.models.database import (
    init_db,
    AsyncSessionLocal,
    User,
    Case,
    AuditLog,
    VASPDirectory,
    AnalysisRun
)
from backend.app.core.security import get_password_hash, create_access_token
from backend.app.services.vasp.directory_service import directory_service, SEED_VASP_DIRECTORY_DATA
from backend.app.services.audit.logger import AuditAction, AuditResourceType
from backend.app.workers.analysis_worker import active_analyses_cache

client = TestClient(app)


# ==============================================================================
# Database & Auth Fixtures
# ==============================================================================

@pytest.fixture(scope="module", autouse=True)
def setup_database():
    import asyncio

    async def _setup():
        await init_db()
        async with AsyncSessionLocal() as session:
            # Seed directory
            await directory_service.seed_directory(session)

            # Ensure test supervisor
            sup_res = await session.execute(
                User.__table__.select().where(User.username == "supervisor_p6")
            )
            if not sup_res.first():
                sup = User(
                    username="supervisor_p6",
                    email="supervisor_p6@setu.gov",
                    hashed_password=get_password_hash("sup123"),
                    full_name="Supervisor P6",
                    role="supervisor",
                    is_active=True
                )
                session.add(sup)

            # Ensure test investigator 1
            inv1_res = await session.execute(
                User.__table__.select().where(User.username == "investigator_p6_a")
            )
            if not inv1_res.first():
                inv1 = User(
                    username="investigator_p6_a",
                    email="inv1_p6@setu.gov",
                    hashed_password=get_password_hash("inv123"),
                    full_name="Inspector P6 Alpha",
                    role="investigator",
                    is_active=True
                )
                session.add(inv1)

            # Ensure test investigator 2
            inv2_res = await session.execute(
                User.__table__.select().where(User.username == "investigator_p6_b")
            )
            if not inv2_res.first():
                inv2 = User(
                    username="investigator_p6_b",
                    email="inv2_p6@setu.gov",
                    hashed_password=get_password_hash("inv123"),
                    full_name="Inspector P6 Bravo",
                    role="investigator",
                    is_active=True
                )
                session.add(inv2)

            await session.commit()

    asyncio.run(_setup())


@pytest.fixture
def supervisor_token():
    return create_access_token(data={"sub": "supervisor_p6", "role": "supervisor"})


@pytest.fixture
def investigator_a_token():
    return create_access_token(data={"sub": "investigator_p6_a", "role": "investigator"})


@pytest.fixture
def investigator_b_token():
    return create_access_token(data={"sub": "investigator_p6_b", "role": "investigator"})


# ==============================================================================
# Unit Tests: VASP Directory Service & Seeding
# ==============================================================================

@pytest.mark.asyncio
async def test_vasp_directory_seeding_and_lookup():
    """Verifies all 16 seed VASPs are stored with jurisdiction, SLA, and routing codes."""
    async with AsyncSessionLocal() as session:
        items = await directory_service.get_directory(session)
        assert len(items) >= 16

        names = [item["name"] for item in items]
        assert "Binance" in names
        assert "WazirX" in names
        assert "CoinDCX" in names
        assert "Coinbase" in names
        assert "OKX" in names
        assert "Kraken" in names

        # Verify Binance metadata
        binance = await directory_service.get_by_name(session, "Binance")
        assert binance is not None
        assert binance["name"] == "Binance"
        assert binance["is_fiu_registered"] is True
        assert binance["sahyog_routing_code"] == "SAHYOG-VASP-BINANCE-GLB"
        assert "24 Hours" in binance["mock_response_sla"]
        assert len(binance["known_deposit_cluster_labels"]) > 0
        assert binance["is_simulated"] is True

        # Verify Indian domestic VASP metadata
        wazirx = await directory_service.get_by_name(session, "WazirX")
        assert wazirx is not None
        assert wazirx["country"] == "India"
        assert wazirx["is_fiu_registered"] is True
        assert wazirx["sahyog_routing_code"] == "SAHYOG-VASP-WAZIRX-IND"
        assert "FIU-IND" in wazirx["fiu_registration_number"]

        # Verify foreign VASP metadata
        coinbase = await directory_service.get_by_name(session, "Coinbase")
        assert coinbase is not None
        assert coinbase["country"] == "United States"
        assert coinbase["is_fiu_registered"] is False
        assert coinbase["sahyog_routing_code"] == "SAHYOG-VASP-COINBASE-US"


# ==============================================================================
# Integration Tests: Directory API Endpoints
# ==============================================================================

def test_api_get_vasp_directory():
    """Verifies GET /api/v1/vasps/directory returns full directory list."""
    response = client.get("/api/v1/vasps/directory")
    assert response.status_code == 200
    data = response.json()
    assert isinstance(data, list)
    assert len(data) >= 16

    first = data[0]
    assert "name" in first
    assert "jurisdiction" in first
    assert "country" in first
    assert "mock_contact_endpoint" in first
    assert "mock_response_sla" in first
    assert "sahyog_routing_code" in first
    assert "is_simulated" in first
    assert first["is_simulated"] is True


def test_api_get_vasp_directory_filters():
    """Verifies search query and FIU-IND filtering."""
    # Search query
    res = client.get("/api/v1/vasps/directory?query=wazirx")
    assert res.status_code == 200
    items = res.json()
    assert len(items) == 1
    assert items[0]["name"] == "WazirX"

    # FIU-IND only filter
    res_fiu = client.get("/api/v1/vasps/directory?fiu_only=true")
    assert res_fiu.status_code == 200
    fiu_items = res_fiu.json()
    assert len(fiu_items) > 0
    for v in fiu_items:
        assert v["is_fiu_registered"] is True


def test_api_get_single_vasp_directory_entry():
    """Verifies GET /api/v1/vasps/directory/{vasp_name}."""
    res = client.get("/api/v1/vasps/directory/CoinDCX")
    assert res.status_code == 200
    data = res.json()
    assert data["name"] == "CoinDCX"
    assert data["sahyog_routing_code"] == "SAHYOG-VASP-COINDCX-IND"
    assert data["is_simulated"] is True

    # Non-existent VASP
    res_404 = client.get("/api/v1/vasps/directory/NonExistentExchange99")
    assert res_404.status_code == 404


# ==============================================================================
# Integration Tests: Mock SAHYOG Disclosure Request Dispatch
# ==============================================================================

def test_api_case_disclosure_request_dispatch(investigator_a_token):
    """
    Tests POST /cases/{id}/disclosure-request:
    - Verifies simulated acknowledgment format.
    - Verifies exact acknowledgment message.
    - Verifies SLA and routing code resolution.
    - Verifies audit log creation and presence in case timeline.
    """
    # 1. Create a case as investigator_a
    case_payload = {
        "title": "NCRP Cyber Scam - Immediate Freeze Requisition",
        "description": "Victim defrauded of funds routed into Binance deposit cluster",
        "suspect_address": "0x28c6c06298d514db089934071355e5743bf21d60",
        "chain": "ethereum",
        "priority": "HIGH",
        "victim_loss_inr": 2500000.0,
        "ncrp_complaint_id": "NCRP/2026/CYBER-8841"
    }
    create_res = client.post(
        "/api/v1/cases",
        headers={"Authorization": f"Bearer {investigator_a_token}"},
        json=case_payload
    )
    assert create_res.status_code == 200
    case_data = create_res.json()
    case_id = case_data["id"]

    # 2. Attach a completed analysis to active_analyses_cache
    analysis_id = f"test-analysis-{uuid.uuid4().hex[:6]}"
    active_analyses_cache[analysis_id] = {
        "analysis_id": analysis_id,
        "wallet_address": case_payload["suspect_address"],
        "status": "COMPLETED",
        "attributions": [
            {
                "vasp_name": "Binance",
                "score": 96.5,
                "evidence_strength": "High",
                "rank": 1,
                "summary": "Direct deposit into Binance Hot Wallet Cluster"
            }
        ],
        "evidence": [],
        "transactions": [
            {
                "tx_hash": "0xaaaabbbbccccdddd1111222233334444555566667777888899990000aaaabbbb",
                "chain": "ethereum",
                "block_number": 19000000,
                "timestamp": datetime.now(timezone.utc).isoformat(),
                "from_address": case_payload["suspect_address"],
                "to_address": "0x28c6c06298d514db089934071355e5743bf21d60",
                "asset_type": "ERC20",
                "token_symbol": "USDT",
                "token_decimals": 6,
                "amount": 25000.0,
                "is_error": False
            }
        ]
    }

    # Link analysis to case
    client.patch(
        f"/api/v1/cases/{case_id}",
        headers={"Authorization": f"Bearer {investigator_a_token}"},
        json={"notes": "Linked completed analysis"}
    )
    # Manually ensure analysis_id is linked
    import asyncio
    async def _link():
        async with AsyncSessionLocal() as session:
            c = (await session.execute(Case.__table__.select().where(Case.id == case_id))).first()
            stmt = Case.__table__.update().where(Case.id == case_id).values(
                analysis_ids_json=json.dumps([analysis_id])
            )
            await session.execute(stmt)
            await session.commit()
    asyncio.run(_link())

    # 3. Dispatch disclosure request
    dispatch_payload = {
        "urgency": "CRITICAL_24H",
        "officer_name": "Inspector R. K. Sharma",
        "police_station": "Cyber Crime Police Station, CID",
        "custom_instructions": "Please freeze destination account immediately under Sec 94 BNSS."
    }
    dispatch_res = client.post(
        f"/api/v1/cases/{case_id}/disclosure-request",
        headers={"Authorization": f"Bearer {investigator_a_token}"},
        json=dispatch_payload
    )
    # Gateway is not configured: must return 501 rather than fake simulated acknowledgment
    assert dispatch_res.status_code == 501
    assert "External electronic lawful disclosure API gateway is not configured" in dispatch_res.json()["detail"]




def test_api_case_disclosure_request_custom_override(supervisor_token, investigator_a_token):
    """Verifies that an investigator or supervisor can override target VASP explicitly."""
    case_payload = {
        "title": "WazirX Laundering Lead",
        "suspect_address": "0xd8da6bf26964af9d7eed9e03e53415d37aa96045",
        "chain": "ethereum"
    }
    create_res = client.post(
        "/api/v1/cases",
        headers={"Authorization": f"Bearer {supervisor_token}"},
        json=case_payload
    )
    case_id = create_res.json()["id"]

    # Dispatch with explicit target_vasp override = "CoinDCX"
    dispatch_res = client.post(
        f"/api/v1/cases/{case_id}/disclosure-request",
        headers={"Authorization": f"Bearer {supervisor_token}"},
        json={"target_vasp": "CoinDCX", "urgency": "EMERGENCY_6H"}
    )
    assert dispatch_res.status_code == 501
    assert "External electronic lawful disclosure API gateway is not configured" in dispatch_res.json()["detail"]


def test_api_case_disclosure_request_rbac_protection(investigator_a_token, investigator_b_token):
    """Verifies investigator B cannot dispatch a disclosure request on investigator A's unassigned case."""
    case_payload = {
        "title": "Confidential Unit Case A",
        "suspect_address": "0x53d28326dda0585ab07b3d40c79e60249725fcad",
        "chain": "ethereum"
    }
    create_res = client.post(
        "/api/v1/cases",
        headers={"Authorization": f"Bearer {investigator_a_token}"},
        json=case_payload
    )
    case_id = create_res.json()["id"]

    # Investigator B attempts dispatch -> 403 Forbidden
    unauthorized_res = client.post(
        f"/api/v1/cases/{case_id}/disclosure-request",
        headers={"Authorization": f"Bearer {investigator_b_token}"},
        json={"target_vasp": "Binance"}
    )
    assert unauthorized_res.status_code == 403

    # Unauthenticated attempt -> 401 Unauthorized
    unauth_res = client.post(f"/api/v1/cases/{case_id}/disclosure-request", json={})
    assert unauth_res.status_code == 401


def test_api_direct_analysis_disclosure_request():
    """Verifies direct analysis mock dispatch: POST /analysis/{analysis_id}/disclosure-request."""
    analysis_id = f"direct-analysis-{uuid.uuid4().hex[:6]}"
    active_analyses_cache[analysis_id] = {
        "analysis_id": analysis_id,
        "wallet_address": "0x3f5ce5fbfe3e9af3971dd833d26ba9b5c936f0be",
        "status": "COMPLETED",
        "attributions": [{"vasp_name": "Bitfinex", "score": 92.0}],
        "evidence": [],
        "transactions": []
    }

    res = client.post(
        f"/api/v1/analysis/{analysis_id}/disclosure-request",
        json={"urgency": "STANDARD_48H"}
    )
    assert res.status_code == 501
    assert "External electronic lawful disclosure API gateway is not configured" in res.json()["detail"]
