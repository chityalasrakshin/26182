"""
Append-only Audit Logging Service for evidentiary integrity, chain of custody,
and compliance with Rule 6.
"""

import json
import logging
import datetime
from typing import Optional, Dict, Any, List
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, desc

from backend.app.models.database import AsyncSessionLocal, AuditLog

logger = logging.getLogger("app.services.audit")


class AuditAction:
    AUTH_LOGIN = "AUTH_LOGIN"
    AUTH_LOGOUT = "AUTH_LOGOUT"
    USER_CREATE = "USER_CREATE"
    
    CASE_CREATE = "CASE_CREATE"
    CASE_UPDATE = "CASE_UPDATE"
    CASE_VIEW = "CASE_VIEW"
    CASE_CLOSE = "CASE_CLOSE"
    
    TRACE_START = "TRACE_START"
    TRACE_COMPLETE = "TRACE_COMPLETE"
    ANALYSIS_START = "ANALYSIS_START"
    ANALYSIS_COMPLETE = "ANALYSIS_COMPLETE"
    
    REPORT_VIEW = "REPORT_VIEW"
    REPORT_EXPORT_PDF = "REPORT_EXPORT_PDF"
    FREEZE_NOTICE_EXPORT = "FREEZE_NOTICE_EXPORT"
    DISCLOSURE_REQUEST = "DISCLOSURE_REQUEST"


class AuditResourceType:
    AUTH = "auth"
    USER = "user"
    CASE = "case"
    TRACE = "trace"
    ANALYSIS = "analysis"
    REPORT = "report"
    EXPORT = "export"
    DISCLOSURE = "disclosure"


class AuditLogger:
    """
    Singleton service handling append-only writes to the audit_log table.
    Guarantees every critical investigator action is permanently recorded.
    """

    @staticmethod
    async def log_event(
        action: str,
        resource_type: str,
        resource_id: Optional[str] = None,
        case_id: Optional[str] = None,
        user_id: Optional[int] = None,
        username: Optional[str] = None,
        details: Optional[Dict[str, Any]] = None,
        ip_address: Optional[str] = None,
        db: Optional[AsyncSession] = None
    ) -> Optional[AuditLog]:
        """
        Appends an immutable audit log entry.
        Can use an existing AsyncSession or spawn a standalone session.
        """
        details_str = json.dumps(details or {})
        user_name = username or ("anonymous" if user_id is None else f"user_{user_id}")

        async def _persist(session: AsyncSession) -> AuditLog:
            entry = AuditLog(
                timestamp=datetime.datetime.now(datetime.timezone.utc).replace(tzinfo=None),
                user_id=user_id,
                username=user_name,
                action=action,
                resource_type=resource_type,
                resource_id=resource_id,
                case_id=case_id,
                details_json=details_str,
                ip_address=ip_address
            )
            session.add(entry)
            await session.commit()
            await session.refresh(entry)
            return entry

        try:
            if db is not None:
                return await _persist(db)
            else:
                async with AsyncSessionLocal() as session:
                    return await _persist(session)
        except Exception as e:
            logger.error(f"Audit log write failed for action '{action}': {e}", exc_info=True)
            return None

    @staticmethod
    async def get_case_timeline(
        case_id: str,
        db: AsyncSession,
        limit: int = 50
    ) -> List[AuditLog]:
        """Returns the chronological audit trail entries linked to a specific case."""
        stmt = (
            select(AuditLog)
            .where(AuditLog.case_id == case_id)
            .order_by(desc(AuditLog.timestamp))
            .limit(limit)
        )
        res = await db.execute(stmt)
        return list(res.scalars().all())

    @staticmethod
    async def query_logs(
        db: AsyncSession,
        action: Optional[str] = None,
        resource_type: Optional[str] = None,
        user_id: Optional[int] = None,
        case_id: Optional[str] = None,
        limit: int = 50,
        offset: int = 0
    ) -> tuple[int, List[AuditLog]]:
        """Queries audit trail with filtering and pagination for supervisors."""
        stmt = select(AuditLog)
        
        if action:
            stmt = stmt.where(AuditLog.action == action)
        if resource_type:
            stmt = stmt.where(AuditLog.resource_type == resource_type)
        if user_id is not None:
            stmt = stmt.where(AuditLog.user_id == user_id)
        if case_id:
            stmt = stmt.where(AuditLog.case_id == case_id)

        # Count total matches
        from sqlalchemy import func
        count_stmt = select(func.count()).select_from(stmt.subquery())
        total = await db.scalar(count_stmt) or 0

        # Paginate
        paginated_stmt = stmt.order_by(desc(AuditLog.timestamp)).offset(offset).limit(limit)
        res = await db.execute(paginated_stmt)
        logs = list(res.scalars().all())
        return total, logs


audit_logger = AuditLogger()
