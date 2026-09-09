"""
Pydantic Schemas for VASP Directory & Mock SAHYOG Lawful Disclosure Request Integration.
Phase 6: Mock SAHYOG / VASP Directory.
"""

from datetime import datetime
from typing import Optional, List, Dict, Any
from pydantic import BaseModel, Field, ConfigDict


class VASPDirectoryResponse(BaseModel):
    id: int
    name: str
    category: str = "Centralized Exchange"
    jurisdiction: str
    country: str
    known_deposit_cluster_labels: List[str] = Field(default_factory=list)
    mock_contact_endpoint: str
    mock_response_sla: str
    fiu_registration_number: Optional[str] = None
    sahyog_routing_code: Optional[str] = None
    compliance_email: Optional[str] = None
    designated_lea_email: Optional[str] = None
    compliance_portal: Optional[str] = None
    nodal_officer: Optional[str] = None
    is_fiu_registered: bool = False
    is_simulated: bool = True
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)


class DisclosureRequestCreate(BaseModel):
    target_vasp: Optional[str] = Field(default=None, description="Target VASP name (auto-inferred from case attributions if omitted)")
    urgency: str = Field(default="CRITICAL_24H", description="Urgency: EMERGENCY_6H, CRITICAL_24H, STANDARD_48H")
    officer_name: Optional[str] = Field(default=None, description="Investigating Officer Name")
    police_station: Optional[str] = Field(default=None, description="Police Unit / Station")
    crime_reference: Optional[str] = Field(default=None, description="NCRP Acknowledgment / Crime Number")
    custom_instructions: Optional[str] = Field(default=None, description="Additional lawful preservation directives")


class DisclosureRequestResponse(BaseModel):
    is_simulated: bool = Field(default=True, description="Explicit simulated boundary indicator")
    simulation_notice: str = Field(
        default="SIMULATED INTEGRATION — Mock Lawful Disclosure Dispatch via SAHYOG API",
        description="Clear disclaimer that no production government connection was made"
    )
    dispatch_id: str
    case_id: str
    suspect_address: str
    chain: str
    target_vasp: str
    sahyog_routing_code: str
    mock_contact_endpoint: str
    mock_response_sla: str
    status: str = "ACKNOWLEDGED_SIMULATED"
    acknowledgment_message: str
    statutory_authority: str = "Section 94 BNSS, 2023 / Section 91 Cr.P.C., 1973"
    dispatched_by: str
    timestamp: datetime
    timeline_event_id: Optional[int] = None
    draft_notice_summary: Optional[Dict[str, Any]] = None

    model_config = ConfigDict(from_attributes=True)
