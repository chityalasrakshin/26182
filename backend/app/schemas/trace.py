"""
Pydantic schemas for Phase 2 Trace Orchestration (Async, Multi-Hop).
Defines request payloads, job status responses, and real-time streaming event contracts.
"""

import datetime
from typing import List, Dict, Any, Optional
from pydantic import BaseModel, Field


class TraceRequest(BaseModel):
    address: str = Field(..., description="Suspect cryptocurrency wallet address to trace")
    chain: Optional[str] = Field(default=None, description="Blockchain network (ethereum, tron, bitcoin) - auto-detected if omitted")
    max_depth: int = Field(default=6, ge=1, le=10, description="Maximum traversal depth from root wallet (default: 6)")
    direction: str = Field(default="outgoing", description="Traversal direction: 'outgoing', 'incoming', or 'both'")


class TraceJobResponse(BaseModel):
    job_id: str = Field(..., description="Unique asynchronous trace execution identifier")
    status: str = Field(..., description="Current job status: QUEUED, RUNNING, COMPLETED, FAILED")
    address: str = Field(..., description="Normalized root suspect address")
    chain: str = Field(..., description="Identified blockchain rail")
    max_depth: int = Field(..., description="Configured maximum hop depth")
    started_at: datetime.datetime = Field(..., description="Job initialization timestamp")


class TraceEvent(BaseModel):
    event: str = Field(..., description="Event type: JOB_STARTED, HOP_STARTED, NODE_DISCOVERED, EDGE_ADDED, VASP_REACHED, HOP_COMPLETED, TRACE_COMPLETED, TRACE_FAILED")
    job_id: str = Field(..., description="Associated trace job ID")
    hop: int = Field(default=0, description="Current traversal hop index")
    timestamp: datetime.datetime = Field(default_factory=datetime.datetime.utcnow)
    data: Dict[str, Any] = Field(default_factory=dict, description="Event-specific metadata payload")


class TraceStatusResponse(BaseModel):
    job_id: str
    address: str
    chain: str
    status: str  # QUEUED, RUNNING, COMPLETED, FAILED
    max_depth: int
    current_depth: int = 0
    started_at: datetime.datetime
    completed_at: Optional[datetime.datetime] = None
    num_nodes: int = 0
    num_edges: int = 0
    num_transactions: int = 0
    vasp_found: bool = False
    matched_vasps: List[Dict[str, Any]] = Field(default_factory=list)
    shortest_path: Optional[Dict[str, Any]] = None
    leaf_nodes: List[Dict[str, Any]] = Field(default_factory=list)
    error_message: Optional[str] = None
    summary: Optional[str] = None
