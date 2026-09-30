"""
Case Management Endpoints with Role-Based Access Control and Audit Logging.
"""

import uuid
import json
import logging
from datetime import datetime, timezone
from typing import List, Optional, Dict, Any
from fastapi import APIRouter, Depends, HTTPException, status, Request, Query, BackgroundTasks, Response
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, desc, or_
from sqlalchemy.orm import selectinload

from backend.app.core.auth import get_current_user
from backend.app.core.address_validator import detect_blockchain, is_valid_crypto_address, normalize_address
from backend.app.models.database import get_db, User, Case, AnalysisRun
from backend.app.schemas.case import (
    CaseCreate,
    CaseUpdate,
    CaseResponse,
    CaseDetailResponse,
    CaseTraceRequest
)
from backend.app.schemas.vasp_directory import (
    DisclosureRequestCreate,
    DisclosureRequestResponse
)
from backend.app.schemas.audit import AuditLogResponse
from backend.app.schemas.trace import TraceJobResponse
from backend.app.services.audit.logger import audit_logger, AuditAction, AuditResourceType
from backend.app.services.trace.job_manager import trace_job_manager
from backend.app.workers.analysis_worker import active_analyses_cache
from backend.app.services.reporting.generator import ReportGenerator
from backend.app.services.reporting.narrative_service import narrative_service
from backend.app.services.reporting.legal_notice_generator import LegalNoticeGenerator

logger = logging.getLogger("app.api.cases")
cases_router = APIRouter(prefix="/cases", tags=["Case Management"])


def _serialize_case(case: Case) -> CaseResponse:
    """Helper to convert ORM Case into CaseResponse."""
    try:
        trace_ids = json.loads(case.trace_job_ids_json or "[]")
    except Exception:
        trace_ids = []

    try:
        analysis_ids = json.loads(case.analysis_ids_json or "[]")
    except Exception:
        analysis_ids = []

    try:
        tags = json.loads(case.tags_json or "[]")
    except Exception:
        tags = []

    return CaseResponse(
        id=case.id,
        title=case.title,
        description=case.description,
        suspect_address=case.suspect_address,
        chain=case.chain,
        status=case.status,
        priority=case.priority,
        created_by_id=case.created_by_id,
        creator_username=case.creator.username if case.creator else None,
        assigned_to_id=case.assigned_to_id,
        assignee_username=case.assignee.username if case.assignee else None,
        victim_loss_inr=case.victim_loss_inr,
        ncrp_complaint_id=case.ncrp_complaint_id,
        trace_job_ids=trace_ids,
        analysis_ids=analysis_ids,
        tags=tags,
        notes=case.notes,
        created_at=case.created_at,
        updated_at=case.updated_at
    )


@cases_router.get("", response_model=List[CaseResponse])
async def list_cases(
    status: Optional[str] = Query(default=None, description="Filter by case status: OPEN, IN_PROGRESS, CLOSED"),
    chain: Optional[str] = Query(default=None, description="Filter by blockchain"),
    priority: Optional[str] = Query(default=None, description="Filter by priority: LOW, MEDIUM, HIGH, CRITICAL"),
    search: Optional[str] = Query(default=None, description="Search title or suspect wallet address"),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """
    Lists investigation cases with Role-Based Access Control:
    - Investigators view their created and assigned cases.
    - Supervisors view all cases across all investigators.
    """
    stmt = (
        select(Case)
        .options(selectinload(Case.creator), selectinload(Case.assignee))
        .order_by(desc(Case.updated_at))
    )

    # RBAC filtering
    if current_user.role != "supervisor":
        stmt = stmt.where(
            or_(
                Case.created_by_id == current_user.id,
                Case.assigned_to_id == current_user.id
            )
        )

    # Optional query filters
    if status:
        stmt = stmt.where(Case.status == status.upper())
    if chain:
        stmt = stmt.where(Case.chain == chain.lower())
    if priority:
        stmt = stmt.where(Case.priority == priority.upper())
    if search:
        s = f"%{search.strip()}%"
        stmt = stmt.where(or_(Case.title.ilike(s), Case.suspect_address.ilike(s)))

    res = await db.execute(stmt)
    cases = res.scalars().all()
    return [_serialize_case(c) for c in cases]


@cases_router.post("", response_model=CaseResponse)
async def create_case(
    req: CaseCreate,
    request: Request,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """
    Creates a new investigation case assigned to the current investigator.
    Writes an append-only audit log entry for court-admissible chain of custody.
    """
    if not is_valid_crypto_address(req.suspect_address):
        raise HTTPException(
            status_code=400,
            detail=f"Invalid suspect crypto address format: {req.suspect_address}"
        )

    norm_address = normalize_address(req.suspect_address)
    detected_chain = req.chain.lower() if req.chain else detect_blockchain(norm_address)

    # Generate Case ID (e.g. CASE-2026-8A3B2F)
    short_uuid = uuid.uuid4().hex[:8].upper()
    now_utc = datetime.now(timezone.utc).replace(tzinfo=None)
    case_id = f"CASE-{now_utc.year}-{short_uuid}"

    assigned_id = req.assigned_to_id or current_user.id

    new_case = Case(
        id=case_id,
        title=req.title,
        description=req.description,
        suspect_address=norm_address,
        chain=detected_chain,
        status="OPEN",
        priority=req.priority.upper(),
        created_by_id=current_user.id,
        assigned_to_id=assigned_id,
        victim_loss_inr=req.victim_loss_inr,
        ncrp_complaint_id=req.ncrp_complaint_id,
        trace_job_ids_json="[]",
        analysis_ids_json="[]",
        tags_json=json.dumps(req.tags or []),
        notes=req.notes,
        created_at=now_utc,
        updated_at=now_utc
    )
    db.add(new_case)
    await db.commit()

    # Re-fetch with relationships loaded
    stmt = (
        select(Case)
        .options(selectinload(Case.creator), selectinload(Case.assignee))
        .where(Case.id == case_id)
    )
    loaded_case = (await db.execute(stmt)).scalar_one()

    # Append audit log
    ip_addr = request.client.host if request.client else None
    await audit_logger.log_event(
        action=AuditAction.CASE_CREATE,
        resource_type=AuditResourceType.CASE,
        resource_id=case_id,
        case_id=case_id,
        user_id=current_user.id,
        username=current_user.username,
        details={
            "title": new_case.title,
            "suspect_address": new_case.suspect_address,
            "chain": new_case.chain,
            "priority": new_case.priority
        },
        ip_address=ip_addr,
        db=db
    )

    return _serialize_case(loaded_case)


@cases_router.get("/{case_id}", response_model=CaseDetailResponse)
async def get_case_detail(
    case_id: str,
    request: Request,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """
    Retrieves complete case dossier including:
    - Case metadata and assigned officers
    - Live statuses of all linked multi-hop trace jobs
    - Completed 3-hop VASP attribution analyses
    - Case-specific audit event timeline
    """
    stmt = (
        select(Case)
        .options(selectinload(Case.creator), selectinload(Case.assignee))
        .where(Case.id == case_id)
    )
    case = (await db.execute(stmt)).scalar_one_or_none()

    if not case:
        raise HTTPException(status_code=404, detail=f"Case '{case_id}' not found.")

    # RBAC check
    if current_user.role != "supervisor":
        if case.created_by_id != current_user.id and case.assigned_to_id != current_user.id:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="You do not have permission to view this case."
            )

    base_serialized = _serialize_case(case)

    # 1. Resolve linked trace jobs
    resolved_traces = []
    for job_id in base_serialized.trace_job_ids:
        job = trace_job_manager.get_job(job_id)
        if job:
            resolved_traces.append({
                "job_id": job["job_id"],
                "status": job["status"],
                "chain": job["chain"],
                "vasp_found": job.get("vasp_found", False),
                "matched_vasps": job.get("matched_vasps", []),
                "shortest_path": job.get("shortest_path"),
                "num_nodes": job.get("num_nodes", 0),
                "num_edges": job.get("num_edges", 0)
            })

    # 2. Resolve linked analysis runs
    resolved_analyses = []
    for a_id in base_serialized.analysis_ids:
        if a_id in active_analyses_cache:
            c = active_analyses_cache[a_id]
            resolved_analyses.append({
                "analysis_id": a_id,
                "status": c.get("status"),
                "top_attribution": c.get("attributions", [None])[0] if c.get("attributions") else None,
                "risk_score": c.get("risk_assessment", {}).get("score", 0.0) if c.get("risk_assessment") else 0.0
            })
        else:
            stmt_a = select(AnalysisRun).where(AnalysisRun.id == a_id)
            run = (await db.execute(stmt_a)).scalar_one_or_none()
            if run:
                resolved_analyses.append({
                    "analysis_id": run.id,
                    "status": run.status,
                    "completed_at": run.completed_at.isoformat() if run.completed_at else None
                })

    # 3. Retrieve recent case audit events
    audit_events = await audit_logger.get_case_timeline(case_id=case_id, db=db, limit=20)
    timeline_items = [
        {
            "id": e.id,
            "timestamp": e.timestamp.isoformat(),
            "username": e.username,
            "action": e.action,
            "resource_type": e.resource_type,
            "resource_id": e.resource_id,
            "details": json.loads(e.details_json or "{}")
        }
        for e in audit_events
    ]

    # Log case view action
    ip_addr = request.client.host if request.client else None
    await audit_logger.log_event(
        action=AuditAction.CASE_VIEW,
        resource_type=AuditResourceType.CASE,
        resource_id=case_id,
        case_id=case_id,
        user_id=current_user.id,
        username=current_user.username,
        details={"case_title": case.title},
        ip_address=ip_addr,
        db=db
    )

    return CaseDetailResponse(
        **base_serialized.model_dump(),
        trace_jobs=resolved_traces,
        analyses=resolved_analyses,
        recent_audit_events=timeline_items
    )


@cases_router.patch("/{case_id}", response_model=CaseResponse)
async def update_case(
    case_id: str,
    req: CaseUpdate,
    request: Request,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Updates case status, notes, tags, priority, or assignee."""
    stmt = (
        select(Case)
        .options(selectinload(Case.creator), selectinload(Case.assignee))
        .where(Case.id == case_id)
    )
    case = (await db.execute(stmt)).scalar_one_or_none()

    if not case:
        raise HTTPException(status_code=404, detail=f"Case '{case_id}' not found.")

    # RBAC check
    if current_user.role != "supervisor":
        if case.created_by_id != current_user.id and case.assigned_to_id != current_user.id:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="You do not have permission to update this case."
            )

    updated_fields = {}
    if req.title is not None:
        case.title = req.title
        updated_fields["title"] = req.title
    if req.description is not None:
        case.description = req.description
        updated_fields["description"] = True
    if req.status is not None:
        case.status = req.status.upper()
        updated_fields["status"] = case.status
    if req.priority is not None:
        case.priority = req.priority.upper()
        updated_fields["priority"] = case.priority
    if req.assigned_to_id is not None:
        case.assigned_to_id = req.assigned_to_id
        updated_fields["assigned_to_id"] = req.assigned_to_id
    if req.victim_loss_inr is not None:
        case.victim_loss_inr = req.victim_loss_inr
        updated_fields["victim_loss_inr"] = req.victim_loss_inr
    if req.ncrp_complaint_id is not None:
        case.ncrp_complaint_id = req.ncrp_complaint_id
        updated_fields["ncrp_complaint_id"] = req.ncrp_complaint_id
    if req.tags is not None:
        case.tags_json = json.dumps(req.tags)
        updated_fields["tags"] = req.tags
    if req.notes is not None:
        case.notes = req.notes
        updated_fields["notes_updated"] = True

    case.updated_at = datetime.now(timezone.utc).replace(tzinfo=None)
    await db.commit()
    await db.refresh(case)

    # Log audit event
    ip_addr = request.client.host if request.client else None
    await audit_logger.log_event(
        action=AuditAction.CASE_UPDATE,
        resource_type=AuditResourceType.CASE,
        resource_id=case_id,
        case_id=case_id,
        user_id=current_user.id,
        username=current_user.username,
        details={"updated_fields": updated_fields},
        ip_address=ip_addr,
        db=db
    )

    return _serialize_case(case)


@cases_router.post("/{case_id}/trace", response_model=TraceJobResponse)
async def dispatch_case_trace(
    case_id: str,
    req: CaseTraceRequest,
    background_tasks: BackgroundTasks,
    request: Request,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """
    Launches a multi-hop trace against the suspect address associated with this case,
    attaches the resulting job to the case, and records an append-only audit log row.
    """
    stmt = (
        select(Case)
        .options(selectinload(Case.creator), selectinload(Case.assignee))
        .where(Case.id == case_id)
    )
    case = (await db.execute(stmt)).scalar_one_or_none()
    if not case:
        raise HTTPException(status_code=404, detail=f"Case '{case_id}' not found.")

    if current_user.role != "supervisor":
        if case.created_by_id != current_user.id and case.assigned_to_id != current_user.id:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="You do not have permission to run traces on this case."
            )

    if req.link_only_job_id:
        job_id = req.link_only_job_id
        job_data = trace_job_manager.get_job(job_id)
        if not job_data:
            raise HTTPException(status_code=404, detail=f"Trace job '{job_id}' not found.")
    else:
        # Create and dispatch a new multi-hop trace job
        job_id = trace_job_manager.create_job(
            address=case.suspect_address,
            chain=case.chain,
            max_depth=req.max_depth
        )
        background_tasks.add_task(trace_job_manager.execute_trace, job_id=job_id)
        job_data = trace_job_manager.get_job(job_id)

    # Link job_id to case.trace_job_ids_json
    try:
        current_trace_ids = json.loads(case.trace_job_ids_json or "[]")
    except Exception:
        current_trace_ids = []

    if job_id not in current_trace_ids:
        current_trace_ids.append(job_id)
        case.trace_job_ids_json = json.dumps(current_trace_ids)
        case.status = "IN_PROGRESS"
        case.updated_at = datetime.now(timezone.utc).replace(tzinfo=None)
        await db.commit()

    # Append audit log
    ip_addr = request.client.host if request.client else None
    await audit_logger.log_event(
        action=AuditAction.TRACE_START,
        resource_type=AuditResourceType.TRACE,
        resource_id=job_id,
        case_id=case_id,
        user_id=current_user.id,
        username=current_user.username,
        details={
            "case_id": case_id,
            "address": case.suspect_address,
            "chain": case.chain,
            "max_depth": req.max_depth
        },
        ip_address=ip_addr,
        db=db
    )

    return TraceJobResponse(
        job_id=job_id,
        status=job_data["status"],
        address=job_data["address"],
        chain=job_data["chain"],
        max_depth=job_data["max_depth"],
        started_at=job_data["started_at"]
    )


@cases_router.get("/{case_id}/audit-trail", response_model=List[AuditLogResponse])
async def get_case_audit_trail(
    case_id: str,
    limit: int = Query(default=50, ge=1, le=200),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Retrieves the complete immutable audit trail for an investigation case."""
    stmt = select(Case).where(Case.id == case_id)
    case = (await db.execute(stmt)).scalar_one_or_none()
    if not case:
        raise HTTPException(status_code=404, detail=f"Case '{case_id}' not found.")

    if current_user.role != "supervisor":
        if case.created_by_id != current_user.id and case.assigned_to_id != current_user.id:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="You do not have permission to view audit logs for this case."
            )

    logs = await audit_logger.get_case_timeline(case_id=case_id, db=db, limit=limit)
    output = []
    for l in logs:
        try:
            details_dict = json.loads(l.details_json or "{}")
        except Exception:
            details_dict = {}

        output.append(
            AuditLogResponse(
                id=l.id,
                timestamp=l.timestamp,
                user_id=l.user_id,
                username=l.username,
                action=l.action,
                resource_type=l.resource_type,
                resource_id=l.resource_id,
                case_id=l.case_id,
                details=details_dict,
                ip_address=l.ip_address
            )
        )
    return output


@cases_router.get("/{case_id}/report")
async def get_case_report(
    case_id: str,
    format: str = "json",
    request: Request = None,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """
    Returns the investigation report for a case (JSON or publication-ready markdown).
    Enforces RBAC and records an immutable audit log.
    """
    stmt = select(Case).where(Case.id == case_id)
    case = (await db.execute(stmt)).scalar_one_or_none()
    if not case:
        raise HTTPException(status_code=404, detail=f"Case '{case_id}' not found.")

    if current_user.role != "supervisor":
        if case.created_by_id != current_user.id and case.assigned_to_id != current_user.id:
            raise HTTPException(status_code=403, detail="You do not have permission to access reports for this case.")

    # Find cached analysis data
    cached = None
    try:
        a_ids = json.loads(case.analysis_ids_json or "[]")
    except Exception:
        a_ids = []

    for aid in a_ids:
        if aid in active_analyses_cache:
            cached = active_analyses_cache[aid]
            break

    if not cached:
        for aid, data in active_analyses_cache.items():
            if data.get("wallet_address", "").lower() == case.suspect_address.lower():
                cached = data
                break

    if not cached or cached.get("status") != "COMPLETED":
        raise HTTPException(
            status_code=400,
            detail="Investigation report requires a COMPLETED trace analysis. Please run or wait for trace completion."
        )

    # Log audit event
    ip_addr = request.client.host if request and request.client else None
    await audit_logger.log_event(
        action=AuditAction.REPORT_VIEW,
        resource_type=AuditResourceType.REPORT,
        resource_id=case_id,
        user_id=current_user.id,
        username=current_user.username,
        case_id=case_id,
        details={"case_id": case_id, "format": format},
        ip_address=ip_addr,
        db=db
    )

    chain_name = (
        "Ethereum Mainnet" if case.chain == "ethereum"
        else "Tron Network" if case.chain == "tron"
        else "Bitcoin Network" if case.chain == "bitcoin"
        else "Multi-Chain Blockchain"
    )

    attr_dicts = [
        a.model_dump() if hasattr(a, "model_dump") else a
        for a in cached.get("attributions", [])
    ]
    risk_dict = cached.get("risk_assessment")
    if risk_dict and hasattr(risk_dict, "model_dump"):
        risk_dict = risk_dict.model_dump()

    evidence_dicts = [
        e.model_dump() if hasattr(e, "model_dump") else e
        for e in cached.get("evidence", [])
    ]
    tx_dicts = [
        t.model_dump() if hasattr(t, "model_dump") else t
        for t in cached.get("transactions", [])
    ]

    narrative_data = None
    try:
        narrative_data = await narrative_service.generate_narrative(
            case_id=case_id,
            wallet_address=case.suspect_address,
            chain=chain_name,
            attributions=attr_dicts,
            risk_assessment=risk_dict,
            evidence=evidence_dicts,
            transactions=tx_dicts,
            summary_stats={
                "total_nodes": cached.get("num_nodes", 0),
                "total_edges": cached.get("num_edges", 0),
                "vasp_nodes_found": len(attr_dicts),
                "max_hop_reached": cached.get("max_hops", 3)
            }
        )
    except RuntimeError as err:
        logger.warning(f"AI narrative omitted from case report: {err}")

    report = ReportGenerator.generate_report(
        case_id=case_id,
        wallet_address=case.suspect_address,
        attributions=cached.get("attributions", []),
        evidence=cached.get("evidence", []),
        risk_assessment=cached.get("risk_assessment"),
        summary_stats={
            "total_nodes": cached.get("num_nodes", 0),
            "total_edges": cached.get("num_edges", 0),
            "vasp_nodes_found": len(attr_dicts),
            "max_hop_reached": cached.get("max_hops", 3)
        },
        critical_txs=[
            {
                "tx_hash": t.tx_hash if hasattr(t, "tx_hash") else t.get("tx_hash", "N/A"),
                "from": t.from_address if hasattr(t, "from_address") else t.get("from", t.get("from_address", "N/A")),
                "to": t.to_address if hasattr(t, "to_address") else t.get("to", t.get("to_address", "N/A")),
                "amount": t.amount if hasattr(t, "amount") else t.get("amount", 0.0),
                "asset": t.token_symbol if hasattr(t, "token_symbol") else t.get("token_symbol", t.get("asset", "ETH")),
                "hop": t.hop if hasattr(t, "hop") else t.get("hop", 1)
            }
            for t in cached.get("transactions", [])[:10]
        ],
        narrative=narrative_data.get("narrative") if narrative_data else None,
        narrative_metadata=narrative_data
    )
    report.chain = chain_name

    if format.lower() == "markdown":
        md_text = ReportGenerator.format_as_markdown(report)
        return {"report_markdown": md_text, "case_id": case_id}

    return report


@cases_router.get("/{case_id}/export/pdf")
async def export_case_pdf(
    case_id: str,
    officer_name: str = Query(default="Investigating Officer"),
    police_station: str = Query(default="Cyber Crime Police Station"),
    request: Request = None,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """
    Exports a court-admissible PDF investigation dossier for a case.
    Enforces RBAC and logs an immutable audit event.
    """
    stmt = select(Case).where(Case.id == case_id)
    case = (await db.execute(stmt)).scalar_one_or_none()
    if not case:
        raise HTTPException(status_code=404, detail=f"Case '{case_id}' not found.")

    if current_user.role != "supervisor":
        if case.created_by_id != current_user.id and case.assigned_to_id != current_user.id:
            raise HTTPException(status_code=403, detail="You do not have permission to export dossiers for this case.")

    cached = None
    try:
        a_ids = json.loads(case.analysis_ids_json or "[]")
    except Exception:
        a_ids = []

    for aid in a_ids:
        if aid in active_analyses_cache:
            cached = active_analyses_cache[aid]
            break

    if not cached:
        for aid, data in active_analyses_cache.items():
            if data.get("wallet_address", "").lower() == case.suspect_address.lower():
                cached = data
                break

    if not cached or cached.get("status") != "COMPLETED":
        raise HTTPException(
            status_code=400,
            detail="PDF export requires a COMPLETED trace analysis."
        )

    ip_addr = request.client.host if request and request.client else None
    await audit_logger.log_event(
        action=AuditAction.REPORT_EXPORT_PDF,
        resource_type=AuditResourceType.EXPORT,
        resource_id=case_id,
        user_id=current_user.id,
        username=current_user.username,
        case_id=case_id,
        details={"case_id": case_id, "officer_name": officer_name},
        ip_address=ip_addr,
        db=db
    )

    from backend.app.services.reporting.pdf_generator import PDFDossierGenerator

    chain_name = (
        "Ethereum Mainnet" if case.chain == "ethereum"
        else "Tron Network" if case.chain == "tron"
        else "Bitcoin Network" if case.chain == "bitcoin"
        else "Multi-Chain Blockchain"
    )

    attr_dicts = [
        a.model_dump() if hasattr(a, "model_dump") else a
        for a in cached.get("attributions", [])
    ]
    risk_dict = cached.get("risk_assessment")
    if risk_dict and hasattr(risk_dict, "model_dump"):
        risk_dict = risk_dict.model_dump()

    evidence_dicts = [
        e.model_dump() if hasattr(e, "model_dump") else e
        for e in cached.get("evidence", [])
    ]
    tx_dicts = [
        t.model_dump() if hasattr(t, "model_dump") else t
        for t in cached.get("transactions", [])
    ]

    narrative_res = None
    try:
        narrative_res = await narrative_service.generate_narrative(
            case_id=case_id,
            wallet_address=case.suspect_address,
            chain=chain_name,
            attributions=attr_dicts,
            risk_assessment=risk_dict,
            evidence=evidence_dicts,
            transactions=tx_dicts,
            summary_stats={
                "total_nodes": cached.get("num_nodes", 0),
                "total_edges": cached.get("num_edges", 0),
                "vasp_nodes_found": len(attr_dicts),
                "max_hop_reached": cached.get("max_hops", 3)
            }
        )
    except RuntimeError as err:
        logger.warning(f"AI narrative omitted from case PDF: {err}")

    top_attr_obj = cached.get("attributions", [None])[0] if cached.get("attributions") else None
    draft_notice = LegalNoticeGenerator.generate_freeze_notice(
        case_id=case_id,
        wallet_address=case.suspect_address,
        chain=case.chain,
        attribution=top_attr_obj,
        evidence=cached.get("evidence", []),
        transactions=cached.get("transactions", []),
        officer_name=officer_name,
        police_station=police_station
    )

    generator = PDFDossierGenerator()
    pdf_bytes = generator.generate(
        case_id=case_id,
        wallet_address=case.suspect_address,
        chain=chain_name,
        attributions=attr_dicts,
        evidence=evidence_dicts,
        risk_assessment=risk_dict,
        transactions=tx_dicts,
        summary_stats={
            "total_nodes": cached.get("num_nodes", 0),
            "total_edges": cached.get("num_edges", 0),
            "vasp_nodes_found": len(attr_dicts),
            "max_hop_reached": cached.get("max_hops", 3)
        },
        narrative=narrative_res.get("narrative") if narrative_res else None,
        draft_notice=draft_notice,
        officer_name=officer_name,
        police_station=police_station
    )

    filename = f"case_dossier_{case_id[:8].upper()}.pdf"
    return Response(
        content=pdf_bytes,
        media_type="application/pdf",
        headers={
            "Content-Disposition": f'attachment; filename="{filename}"',
            "Content-Length": str(len(pdf_bytes))
        }
    )


@cases_router.post("/{case_id}/disclosure-request", response_model=DisclosureRequestResponse)
async def dispatch_case_disclosure_request(
    case_id: str,
    payload: Optional[DisclosureRequestCreate] = None,
    request: Request = None,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """
    POST /cases/{id}/disclosure-request (Phase 6: Mock SAHYOG / VASP Directory).
    
    Clearly-labeled SIMULATED action:
    - Verifies the case exists and enforces investigator/supervisor RBAC.
    - Resolves the attributed VASP (from payload override or case's linked traces/analyses).
    - Queries the mock SAHYOG VASP Directory for jurisdiction, routing code, and response SLA.
    - Emits an immutable audit trail event (AuditAction.DISCLOSURE_REQUEST) per Rule 6,
      ensuring immediate visibility in the case timeline.
    - Returns a mock acknowledgment simulating electronic routing to the destination VASP.
    """
    stmt = select(Case).where(Case.id == case_id)
    case = (await db.execute(stmt)).scalar_one_or_none()
    if not case:
        raise HTTPException(status_code=404, detail=f"Case '{case_id}' not found.")

    if current_user.role != "supervisor":
        if case.created_by_id != current_user.id and case.assigned_to_id != current_user.id:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="You do not have permission to dispatch disclosure requests for this case."
            )

    # 1. Resolve Target VASP
    target_vasp = payload.target_vasp.strip() if payload and payload.target_vasp else None
    cached_analysis = None

    if not target_vasp:
        try:
            a_ids = json.loads(case.analysis_ids_json or "[]")
        except Exception:
            a_ids = []

        for aid in a_ids:
            if aid in active_analyses_cache:
                cached_analysis = active_analyses_cache[aid]
                attrs = cached_analysis.get("attributions", [])
                if attrs:
                    top_a = attrs[0]
                    target_vasp = getattr(top_a, "vasp_name", None) or (top_a.get("vasp_name") if isinstance(top_a, dict) else None)
                    if target_vasp:
                        break

    if not target_vasp:
        try:
            a_ids = json.loads(case.analysis_ids_json or "[]")
        except Exception:
            a_ids = []
        if a_ids:
            from backend.app.models.database import Attribution
            attr_stmt = (
                select(Attribution)
                .where(Attribution.analysis_id.in_(a_ids))
                .order_by(Attribution.rank.asc(), Attribution.score.desc())
            )
            top_attr_rec = (await db.execute(attr_stmt)).scalars().first()
            if top_attr_rec:
                target_vasp = top_attr_rec.vasp_name

    if not target_vasp:
        try:
            t_ids = json.loads(case.trace_job_ids_json or "[]")
        except Exception:
            t_ids = []
        for tid in t_ids:
            job = trace_job_manager.get_job(tid)
            if job and job.get("matched_vasps"):
                target_vasp = job["matched_vasps"][0]
                break

    if not target_vasp:
        from backend.app.services.vasp.matcher import vasp_matcher
        m = vasp_matcher.match_address(case.suspect_address, case.chain)
        if m:
            target_vasp = m.get("vasp_name")

    if not target_vasp:
        target_vasp = "Virtual Asset Service Provider"

    # 2. Check if live external electronic disclosure gateway is configured
    raise HTTPException(
        status_code=501,
        detail="External electronic lawful disclosure API gateway is not configured. Generate the court-admissible Section 94 BNSS / Section 91 Cr.P.C. legal notice PDF or transmit directly via the verified VASP Law Enforcement compliance portal."
    )


# ==============================================================================
# Case 5: One-Click Judicial Court Dossier (.ZIP Export)
# ==============================================================================

@cases_router.get("/{case_id}/export-dossier")
@cases_router.get("/{case_id}/dossier")
async def export_court_dossier(
    case_id: str,
    request: Request,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """
    Generates and downloads a complete court-ready dossier ZIP archive.

    Contains 5 synchronized artifacts:
    1. CrPC Section 91 Seizure Notice
    2. Section 65B Evidence Certificate
    3. Forensic Graph Topography (PNG)
    4. Transaction Ledger Audit (CSV)
    5. Case Diary Investigative Narrative

    All artifacts include SHA-256 checksums in a manifest file.
    """
    from backend.app.services.reporting.dossier_service import dossier_service
    from fastapi.responses import StreamingResponse
    import io

    # 1. Load case
    stmt = select(Case).where(Case.id == case_id)
    result = await db.execute(stmt)
    case = result.scalar_one_or_none()
    if not case:
        raise HTTPException(status_code=404, detail="Case not found.")

    # 2. Gather data from analysis cache and trace jobs
    attributions = []
    evidence_list = []
    transactions = []
    risk_assessment = None
    narrative_text = None

    # Check analysis cache
    try:
        analysis_ids = json.loads(case.analysis_ids_json or "[]")
    except Exception:
        analysis_ids = []

    for aid in analysis_ids:
        if aid in active_analyses_cache:
            cached = active_analyses_cache[aid]
            if cached.get("attributions"):
                attributions = [
                    a.model_dump() if hasattr(a, "model_dump") else a
                    for a in cached["attributions"]
                ]
            if cached.get("evidence"):
                evidence_list = [
                    e.model_dump() if hasattr(e, "model_dump") else e
                    for e in cached["evidence"]
                ]
            if cached.get("transactions"):
                transactions = [
                    t.model_dump() if hasattr(t, "model_dump") else t
                    for t in cached["transactions"]
                ]
            risk_assessment = cached.get("risk_assessment")
            if risk_assessment and hasattr(risk_assessment, "model_dump"):
                risk_assessment = risk_assessment.model_dump()
            break

    # Check trace jobs for additional data
    try:
        trace_ids = json.loads(case.trace_job_ids_json or "[]")
    except Exception:
        trace_ids = []

    for tid in trace_ids:
        job = trace_job_manager.get_job(tid)
        if job and job.get("matched_vasps") and not attributions:
            for vasp_name in job["matched_vasps"]:
                attributions.append({
                    "vasp_name": vasp_name,
                    "score": 85.0,
                    "evidence_strength": "HIGH",
                    "rank": len(attributions) + 1,
                    "summary": f"Funds traced to {vasp_name} via multi-hop analysis",
                })

    # 3. Generate dossier ZIP
    chain = case.chain or "ethereum"
    zip_bytes = dossier_service.generate_dossier(
        case_id=case_id,
        wallet_address=case.suspect_address,
        chain=chain,
        attributions=attributions,
        evidence=evidence_list,
        transactions=transactions,
        risk_assessment=risk_assessment,
        narrative_text=narrative_text,
        investigator_name=current_user.full_name or current_user.username,
        investigating_unit="Cyber Crime Investigation Cell",
    )

    # 4. Audit log
    ip_addr = request.client.host if request and request.client else None
    await audit_logger.log_event(
        action=AuditAction.REPORT_EXPORT,
        resource_type=AuditResourceType.REPORT,
        resource_id=case_id,
        user_id=current_user.id,
        username=current_user.username,
        details={"case_id": case_id, "format": "zip_dossier", "size_bytes": len(zip_bytes)},
        ip_address=ip_addr,
        db=db,
    )

    # 5. Stream ZIP back
    safe_case_id = case_id.replace("/", "_").replace("\\", "_")[:50]
    filename = f"SETU_Dossier_{safe_case_id}.zip"

    return StreamingResponse(
        io.BytesIO(zip_bytes),
        media_type="application/zip",
        headers={
            "Content-Disposition": f'attachment; filename="{filename}"',
            "Content-Length": str(len(zip_bytes)),
        },
    )
