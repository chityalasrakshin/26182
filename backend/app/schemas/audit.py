"""
Pydantic schemas for the append-only Audit Log.
"""

from datetime import datetime
from typing import Optional, Dict, Any, List
from pydantic import BaseModel, Field, ConfigDict


class AuditLogResponse(BaseModel):
    id: int
    timestamp: datetime
    user_id: Optional[int] = None
    username: str
    action: str
    resource_type: str
    resource_id: Optional[str] = None
    case_id: Optional[str] = None
    details: Dict[str, Any] = Field(default_factory=dict)
    ip_address: Optional[str] = None

    model_config = ConfigDict(from_attributes=True)


class AuditLogListResponse(BaseModel):
    total: int
    limit: int
    offset: int
    logs: List[AuditLogResponse]
