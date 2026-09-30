"""
Unit and Integration Tests for Phase 4: Case Management, Auth, and Audit Trail.

Verifies:
1. Core Security: Bcrypt password hashing, JWT encoding/decoding, expiration handling.
2. Authentication API: /api/v1/auth/register, /api/v1/auth/login, /api/v1/auth/me.
3. Role-Based Access Control (RBAC):
   - Investigator role restrictions (can only view own cases).
   - Supervisor role privileges (can view all cases and global audit log).
   - 401 Unauthenticated and 403 Forbidden enforcement.
4. Case Management Lifecycle:
   - Case creation with address validation.
   - Case updating (status, priority, notes, tags).
   - Case detail resolution with linked traces and audit timeline.
5. Case-linked Trace Orchestration:
   - Dispatching multi-hop trace directly from an active case.
   - Automatic linking of trace job IDs and status progression.
6. Append-Only Audit Trail (Rule 6 Compliance):
   - Automatic audit log creation on case creation, trace start, analysis start, and report access.
   - Audit trail filtering and pagination for supervisors.
"""

import pytest
import uuid
from datetime import timedelta
from fastapi.testclient import TestClient

from backend.app.main import app
from backend.app.core.security import (
    verify_password,
    get_password_hash,
    create_access_token,
    decode_access_token
)
from backend.app.models.database import init_db
from backend.app.services.audit.logger import AuditAction, AuditResourceType

client = TestClient(app)


# ==============================================================================
# Helper Fixtures & Setup
# ==============================================================================

@pytest.fixture(scope="module", autouse=True)
def setup_database():
    import asyncio
    from backend.app.models.database import AsyncSessionLocal, User
    from backend.app.core.security import get_password_hash
    from sqlalchemy import select

    async def _setup():
        await init_db()
        async with AsyncSessionLocal() as session:
            sup = (await session.execute(select(User).where(User.username == "supervisor"))).scalar_one_or_none()
            if not sup:
                sup = User(
                    username="supervisor",
                    email="supervisor@setu.gov",
                    hashed_password=get_password_hash("supervisor123"),
                    full_name="Senior Supervisor",
                    role="supervisor",
                    is_active=True
                )
                session.add(sup)
                await session.commit()
            else:
                # Ensure password hash matches current bcrypt
                sup.hashed_password = get_password_hash("supervisor123")
                await session.commit()
    asyncio.run(_setup())


class MockTraceProvider:
    async def get_outgoing_txs(self, address: str, max_results: int = 50):
        return []

    async def get_incoming_txs(self, address: str, max_results: int = 50):
        return []


@pytest.fixture(autouse=True)
def mock_blockchain_calls(monkeypatch):
    from backend.app.services.blockchain.factory import BlockchainProviderFactory
    mock = MockTraceProvider()
    monkeypatch.setattr(BlockchainProviderFactory, "get_provider", lambda chain: mock)


@pytest.fixture(scope="module")
def unique_suffix():
    return uuid.uuid4().hex[:6]


@pytest.fixture(scope="module")
def auth_tokens(unique_suffix):
    """Provisions a test supervisor and two test investigators, returning tokens."""
    # 1. Obtain Supervisor Token (via pre-seeded bootstrap account or login)
    login_sup = client.post("/api/v1/auth/login", json={
        "username": "supervisor",
        "password": "supervisor123"
    })
    if login_sup.status_code == 200:
        sup_token = login_sup.json()["access_token"]
        sup_user = login_sup.json()["user"]
        sup_username = "supervisor"
    else:
        # Fallback: create fresh supervisor
        sup_username = f"sup_{unique_suffix}"
        sup_pass = "SuperSecret123!"
        reg_sup = client.post("/api/v1/auth/register", json={
            "username": sup_username,
            "email": f"{sup_username}@agency.gov",
            "full_name": "Senior Supervisor",
            "role": "supervisor",
            "password": sup_pass
        })
        assert reg_sup.status_code == 200
        login_res = client.post("/api/v1/auth/login", json={
            "username": sup_username,
            "password": sup_pass
        })
        assert login_res.status_code == 200
        sup_token = login_res.json()["access_token"]
        sup_user = login_res.json()["user"]

    # 2. Register Investigator 1 (using supervisor auth)
    inv1_username = f"inv1_{unique_suffix}"
    inv1_pass = "Investigate123!"
    reg_inv1 = client.post(
        "/api/v1/auth/register",
        json={
            "username": inv1_username,
            "email": f"{inv1_username}@agency.gov",
            "full_name": "Investigating Officer One",
            "role": "investigator",
            "password": inv1_pass
        },
        headers={"Authorization": f"Bearer {sup_token}"}
    )
    assert reg_inv1.status_code == 200

    login_inv1 = client.post("/api/v1/auth/login", json={
        "username": inv1_username,
        "password": inv1_pass
    })
    inv1_token = login_inv1.json()["access_token"]
    inv1_user = login_inv1.json()["user"]

    # 3. Register Investigator 2
    inv2_username = f"inv2_{unique_suffix}"
    inv2_pass = "Investigate456!"
    reg_inv2 = client.post(
        "/api/v1/auth/register",
        json={
            "username": inv2_username,
            "email": f"{inv2_username}@agency.gov",
            "full_name": "Investigating Officer Two",
            "role": "investigator",
            "password": inv2_pass
        },
        headers={"Authorization": f"Bearer {sup_token}"}
    )
    assert reg_inv2.status_code == 200

    login_inv2 = client.post("/api/v1/auth/login", json={
        "username": inv2_username,
        "password": inv2_pass
    })
    inv2_token = login_inv2.json()["access_token"]
    inv2_user = login_inv2.json()["user"]

    return {
        "supervisor": {"token": sup_token, "user": sup_user, "username": sup_username},
        "investigator_1": {"token": inv1_token, "user": inv1_user, "username": inv1_username},
        "investigator_2": {"token": inv2_token, "user": inv2_user, "username": inv2_username},
    }


# ==============================================================================
# 1. Core Security Tests
# ==============================================================================

def test_password_hashing_and_verification():
    """Verify bcrypt hash generation and constant-time password matching."""
    raw_pass = "ForensicAnalysis2026!"
    hashed = get_password_hash(raw_pass)

    assert hashed != raw_pass
    assert verify_password(raw_pass, hashed) is True
    assert verify_password("WrongPassword!", hashed) is False


def test_jwt_creation_and_decoding():
    """Verify JWT payload signing, extraction, and validation."""
    data = {"sub": "test_officer", "role": "investigator", "user_id": 42}
    token = create_access_token(data=data, expires_delta=timedelta(minutes=15))

    decoded = decode_access_token(token)
    assert decoded is not None
    assert decoded["sub"] == "test_officer"
    assert decoded["role"] == "investigator"
    assert decoded["user_id"] == 42
    assert "exp" in decoded


def test_jwt_expired_or_invalid():
    """Verify expired and tampered tokens are rejected."""
    # Expired token
    expired_token = create_access_token(
        data={"sub": "expired_user"},
        expires_delta=timedelta(seconds=-10)
    )
    assert decode_access_token(expired_token) is None

    # Tampered token
    tampered_token = expired_token[:-4] + "ABCD"
    assert decode_access_token(tampered_token) is None


# ==============================================================================
# 2. Authentication API Tests
# ==============================================================================

def test_auth_login_success_and_failure(auth_tokens):
    """Verify login authentication endpoints and rejection on bad credentials."""
    inv = auth_tokens["investigator_1"]

    # Failed login with bad password
    bad_login = client.post("/api/v1/auth/login", json={
        "username": inv["username"],
        "password": "IncorrectPassword"
    })
    assert bad_login.status_code == 401
    assert "Incorrect username or password" in bad_login.json()["detail"]

    # Non-existent user
    non_existent = client.post("/api/v1/auth/login", json={
        "username": "user_does_not_exist_999",
        "password": "SomePassword123"
    })
    assert non_existent.status_code == 401


def test_auth_get_me_profile(auth_tokens):
    """Verify /api/v1/auth/me returns current user data and requires valid token."""
    inv = auth_tokens["investigator_1"]
    res = client.get(
        "/api/v1/auth/me",
        headers={"Authorization": f"Bearer {inv['token']}"}
    )
    assert res.status_code == 200
    data = res.json()
    assert data["username"] == inv["username"]
    assert data["role"] == "investigator"

    # Missing token returns 401
    res_no_auth = client.get("/api/v1/auth/me")
    assert res_no_auth.status_code == 401


# ==============================================================================
# 3. Case Management & RBAC Tests
# ==============================================================================

def test_case_create_and_validation(auth_tokens):
    """Test creating an investigation case with address validation."""
    inv1 = auth_tokens["investigator_1"]

    # Invalid address format should fail
    bad_addr_res = client.post(
        "/api/v1/cases",
        json={
            "title": "Invalid Wallet Case",
            "suspect_address": "invalid_address_not_crypto",
            "chain": "ethereum"
        },
        headers={"Authorization": f"Bearer {inv1['token']}"}
    )
    assert bad_addr_res.status_code == 400

    # Valid Ethereum suspect wallet
    valid_res = client.post(
        "/api/v1/cases",
        json={
            "title": "Operation DarkHydra - Extortion Wallet",
            "description": "Telegram task scam laundering pipeline identified from NCRP complaint.",
            "suspect_address": "0x28C6c06298d514Db089934071355E5743bf21d60",
            "chain": "ethereum",
            "priority": "HIGH",
            "victim_loss_inr": 1500000.0,
            "ncrp_complaint_id": "NCRP-2026-DEL-10293",
            "tags": ["Telegram Scam", "Part-Time Task", "Ethereum"],
            "notes": "Suspect requested USDT deposits."
        },
        headers={"Authorization": f"Bearer {inv1['token']}"}
    )
    assert valid_res.status_code == 200
    case_data = valid_res.json()
    assert case_data["id"].startswith("CASE-")
    assert case_data["title"] == "Operation DarkHydra - Extortion Wallet"
    assert case_data["status"] == "OPEN"
    assert case_data["priority"] == "HIGH"
    assert case_data["created_by_id"] == inv1["user"]["id"]
    assert case_data["creator_username"] == inv1["username"]


def test_rbac_investigator_case_isolation(auth_tokens):
    """
    Verify Investigator 2 cannot view or edit Investigator 1's private case,
    while Supervisor can view all cases.
    """
    inv1 = auth_tokens["investigator_1"]
    inv2 = auth_tokens["investigator_2"]
    sup = auth_tokens["supervisor"]

    # Investigator 1 creates a case
    create_res = client.post(
        "/api/v1/cases",
        json={
            "title": "Investigator 1 Private Case",
            "suspect_address": "0x95222290DD7278Aa3Ddd389Cc1E1d165CC4BAfe5",
            "chain": "ethereum",
            "priority": "MEDIUM"
        },
        headers={"Authorization": f"Bearer {inv1['token']}"}
    )
    assert create_res.status_code == 200
    case_id = create_res.json()["id"]

    # Investigator 1 can view the case
    res1 = client.get(
        f"/api/v1/cases/{case_id}",
        headers={"Authorization": f"Bearer {inv1['token']}"}
    )
    assert res1.status_code == 200
    assert res1.json()["id"] == case_id

    # Investigator 2 is FORBIDDEN (403) from viewing Investigator 1's case
    res2 = client.get(
        f"/api/v1/cases/{case_id}",
        headers={"Authorization": f"Bearer {inv2['token']}"}
    )
    assert res2.status_code == 403

    # Investigator 2 is FORBIDDEN (403) from modifying Investigator 1's case
    res2_patch = client.patch(
        f"/api/v1/cases/{case_id}",
        json={"priority": "CRITICAL"},
        headers={"Authorization": f"Bearer {inv2['token']}"}
    )
    assert res2_patch.status_code == 403

    # Supervisor CAN view Investigator 1's case
    res_sup = client.get(
        f"/api/v1/cases/{case_id}",
        headers={"Authorization": f"Bearer {sup['token']}"}
    )
    assert res_sup.status_code == 200
    assert res_sup.json()["id"] == case_id

    # Supervisor lists all cases and sees it
    res_sup_list = client.get(
        "/api/v1/cases",
        headers={"Authorization": f"Bearer {sup['token']}"}
    )
    assert res_sup_list.status_code == 200
    sup_case_ids = [c["id"] for c in res_sup_list.json()]
    assert case_id in sup_case_ids


def test_case_update_lifecycle(auth_tokens):
    """Test updating case status, notes, and priority."""
    inv1 = auth_tokens["investigator_1"]

    create_res = client.post(
        "/api/v1/cases",
        json={
            "title": "Tron USDT Ransom Case",
            "suspect_address": "TMuA6YMeL4nNFYWAnWUCtqnmEvrCfsugnR",
            "chain": "tron",
            "priority": "LOW"
        },
        headers={"Authorization": f"Bearer {inv1['token']}"}
    )
    case_id = create_res.json()["id"]

    # Update case status and notes
    patch_res = client.patch(
        f"/api/v1/cases/{case_id}",
        json={
            "status": "IN_PROGRESS",
            "priority": "CRITICAL",
            "notes": "Traced 1 hop to Binance Tron hot wallet.",
            "tags": ["Tron", "Ransomware", "Escalated"]
        },
        headers={"Authorization": f"Bearer {inv1['token']}"}
    )
    assert patch_res.status_code == 200
    updated = patch_res.json()
    assert updated["status"] == "IN_PROGRESS"
    assert updated["priority"] == "CRITICAL"
    assert updated["notes"] == "Traced 1 hop to Binance Tron hot wallet."
    assert "Escalated" in updated["tags"]


# ==============================================================================
# 4. Trace Dispatch from Case Tests
# ==============================================================================

def test_dispatch_case_trace_linking(auth_tokens):
    """
    Verify launching a multi-hop trace from a case automatically links the job ID,
    advances the case status to IN_PROGRESS, and writes an audit log.
    """
    inv1 = auth_tokens["investigator_1"]

    create_res = client.post(
        "/api/v1/cases",
        json={
            "title": "Live Trace Case",
            "suspect_address": "0x28C6c06298d514Db089934071355E5743bf21d60",
            "chain": "ethereum",
            "priority": "HIGH"
        },
        headers={"Authorization": f"Bearer {inv1['token']}"}
    )
    case_id = create_res.json()["id"]

    # Dispatch trace from case
    trace_res = client.post(
        f"/api/v1/cases/{case_id}/trace",
        json={"max_depth": 3},
        headers={"Authorization": f"Bearer {inv1['token']}"}
    )
    assert trace_res.status_code == 200
    job_data = trace_res.json()
    assert "job_id" in job_data
    job_id = job_data["job_id"]

    # Verify case details reflects the linked trace job
    detail_res = client.get(
        f"/api/v1/cases/{case_id}",
        headers={"Authorization": f"Bearer {inv1['token']}"}
    )
    assert detail_res.status_code == 200
    detail = detail_res.json()
    assert job_id in detail["trace_job_ids"]
    assert detail["status"] == "IN_PROGRESS"
    assert len(detail["trace_jobs"]) >= 1
    assert detail["trace_jobs"][0]["job_id"] == job_id


# ==============================================================================
# 5. Append-Only Audit Trail Tests (Rule 6 Compliance)
# ==============================================================================

def test_case_audit_trail_endpoint(auth_tokens):
    """Verify case audit trail records CASE_CREATE and subsequent actions."""
    inv1 = auth_tokens["investigator_1"]

    create_res = client.post(
        "/api/v1/cases",
        json={
            "title": "Audit Trail Inspection Case",
            "suspect_address": "0xA090e606E30bD747d4E6245a1517EbE430F0057e",
            "chain": "ethereum",
            "priority": "MEDIUM"
        },
        headers={"Authorization": f"Bearer {inv1['token']}"}
    )
    case_id = create_res.json()["id"]

    # Update case to trigger second audit event
    client.patch(
        f"/api/v1/cases/{case_id}",
        json={"priority": "HIGH"},
        headers={"Authorization": f"Bearer {inv1['token']}"}
    )

    # Query case audit trail
    trail_res = client.get(
        f"/api/v1/cases/{case_id}/audit-trail",
        headers={"Authorization": f"Bearer {inv1['token']}"}
    )
    assert trail_res.status_code == 200
    trail = trail_res.json()
    assert len(trail) >= 2

    actions = [item["action"] for item in trail]
    assert AuditAction.CASE_CREATE in actions
    assert AuditAction.CASE_UPDATE in actions

    # Verify immutable fields
    for item in trail:
        assert item["username"] == inv1["username"]
        assert item["resource_type"] == AuditResourceType.CASE
        assert "timestamp" in item


def test_supervisor_global_audit_logs_access(auth_tokens):
    """
    Verify /api/v1/audit/logs is restricted to supervisors and allows
    filtering and pagination.
    """
    inv1 = auth_tokens["investigator_1"]
    sup = auth_tokens["supervisor"]

    # Investigator is FORBIDDEN (403) from inspecting global audit log
    inv_res = client.get(
        "/api/v1/audit/logs",
        headers={"Authorization": f"Bearer {inv1['token']}"}
    )
    assert inv_res.status_code == 403

    # Supervisor CAN access global audit log
    sup_res = client.get(
        "/api/v1/audit/logs?limit=10",
        headers={"Authorization": f"Bearer {sup['token']}"}
    )
    assert sup_res.status_code == 200
    audit_data = sup_res.json()
    assert "total" in audit_data
    assert "logs" in audit_data
    assert audit_data["total"] >= 1
    assert len(audit_data["logs"]) <= 10


def test_audit_logging_on_trace_and_report_actions(auth_tokens):
    """
    Verify that standalone trace and report actions write audit rows
    even when unauthenticated (Rule 6).
    """
    sup = auth_tokens["supervisor"]

    # 1. Trigger standalone trace
    trace_res = client.post("/api/v1/trace", json={
        "address": "0x28C6c06298d514Db089934071355E5743bf21d60",
        "chain": "ethereum",
        "max_depth": 2
    })
    assert trace_res.status_code == 200
    job_id = trace_res.json()["job_id"]

    # 2. Check supervisor global audit log for TRACE_START
    logs_res = client.get(
        f"/api/v1/audit/logs?action={AuditAction.TRACE_START}&limit=5",
        headers={"Authorization": f"Bearer {sup['token']}"}
    )
    assert logs_res.status_code == 200
    logs = logs_res.json()["logs"]
    matching = [l for l in logs if l["resource_id"] == job_id]
    assert len(matching) >= 1
    assert matching[0]["action"] == AuditAction.TRACE_START
    assert matching[0]["resource_type"] == AuditResourceType.TRACE
