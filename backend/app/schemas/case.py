"""
Pydantic schemas for Case Management.
"""

from datetime import datetime
from typing import Optional, List, Dict, Any
from pydantic import BaseModel, Field, ConfigDict


class CaseCreate(BaseModel):
    title: str = Field(..., min_length=3, max_length=200, description="Investigation case title")
    description: Optional[str] = Field(default=None, description="Detailed case background")
    suspect_address: str = Field(..., description="Target cryptocurrency wallet address")
    chain: str = Field(default="ethereum", description="Target blockchain: ethereum, tron, bitcoin")
    priority: str = Field(default="MEDIUM", description="Priority: LOW, MEDIUM, HIGH, CRITICAL")
    assigned_to_id: Optional[int] = Field(default=None, description="Assigned investigator user ID")
    victim_loss_inr: Optional[float] = Field(default=None, description="Reported victim loss amount in INR")
    ncrp_complaint_id: Optional[str] = Field(default=None, description="Linked NCRP Acknowledgment Number")
    tags: List[str] = Field(default_factory=list, description="Categorization tags")
    notes: Optional[str] = Field(default=None, description="Investigator notes")


class CaseUpdate(BaseModel):
    title: Optional[str] = Field(default=None, min_length=3, max_length=200)
    description: Optional[str] = None
    status: Optional[str] = Field(default=None, description="Status: OPEN, IN_PROGRESS, CLOSED, ARCHIVED")
    priority: Optional[str] = Field(default=None, description="Priority: LOW, MEDIUM, HIGH, CRITICAL")
    assigned_to_id: Optional[int] = None
    victim_loss_inr: Optional[float] = None
    ncrp_complaint_id: Optional[str] = None
    tags: Optional[List[str]] = None
    notes: Optional[str] = None


class CaseResponse(BaseModel):
    id: str
    title: str
    description: Optional[str] = None
    suspect_address: str
    chain: str
    status: str
    priority: str
    created_by_id: int
    creator_username: Optional[str] = None
    assigned_to_id: Optional[int] = None
    assignee_username: Optional[str] = None
    victim_loss_inr: Optional[float] = None
    ncrp_complaint_id: Optional[str] = None
    trace_job_ids: List[str] = Field(default_factory=list)
    analysis_ids: List[str] = Field(default_factory=list)
    tags: List[str] = Field(default_factory=list)
    notes: Optional[str] = None
    created_at: datetime
    updated_at: datetime

    model_config = ConfigDict(from_attributes=True)


class CaseDetailResponse(CaseResponse):
    trace_jobs: List[Dict[str, Any]] = Field(default_factory=list, description="Resolved details of linked trace jobs")
    analyses: List[Dict[str, Any]] = Field(default_factory=list, description="Resolved details of linked 3-hop analyses")
    recent_audit_events: List[Dict[str, Any]] = Field(default_factory=list, description="Recent audit log events for this case")


class CaseTraceRequest(BaseModel):
    max_depth: int = Field(default=6, ge=1, le=10, description="Trace traversal depth")
    link_only_job_id: Optional[str] = Field(default=None, description="Optional existing trace job ID to link")
