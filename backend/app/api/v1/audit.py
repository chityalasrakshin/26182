"""
Supervisor Audit Log Endpoints for inspecting global chain of custody.
"""

import json
from typing import Optional
from fastapi import APIRouter, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession

from backend.app.core.auth import get_current_investigator, get_current_supervisor
from backend.app.models.database import get_db, User
from backend.app.schemas.audit import AuditLogResponse, AuditLogListResponse
from backend.app.services.audit.logger import audit_logger

audit_api_router = APIRouter(prefix="/audit", tags=["Audit Log & Compliance"])


@audit_api_router.get("/logs", response_model=AuditLogListResponse)
async def query_global_audit_logs(
    action: Optional[str] = Query(default=None, description="Filter by action type (e.g., TRACE_START, CASE_CREATE)"),
    resource_type: Optional[str] = Query(default=None, description="Filter by resource type: case, trace, report, export"),
    user_id: Optional[int] = Query(default=None, description="Filter by user ID"),
    case_id: Optional[str] = Query(default=None, description="Filter by case ID"),
    limit: int = Query(default=50, ge=1, le=200, description="Page limit"),
    offset: int = Query(default=0, ge=0, description="Page offset"),
    current_user: User = Depends(get_current_supervisor),
    db: AsyncSession = Depends(get_db)
):
    """
    Returns paginated and filtered global audit logs.
    Restricted to supervisor accounts to verify LEA compliance, chain of custody,
    and access history.
    """
    total, logs = await audit_logger.query_logs(
        db=db,
        action=action,
        resource_type=resource_type,
        user_id=user_id,
        case_id=case_id,
        limit=limit,
        offset=offset
    )

    serialized_logs = []
    for l in logs:
        try:
            details_dict = json.loads(l.details_json or "{}")
        except Exception:
            details_dict = {}

        serialized_logs.append(
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

    return AuditLogListResponse(
        total=total,
        limit=limit,
        offset=offset,
        logs=serialized_logs
    )
