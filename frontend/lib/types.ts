export interface NormalizedTransaction {
  tx_hash: string;
  chain: string;
  block_number: number;
  timestamp: string;
  from_address: string;
  to_address: string;
  asset_type: string;
  token_address?: string | null;
  token_symbol: string;
  token_decimals: number;
  amount: number;
  amount_usd_if_available?: number | null;
  amount_usd?: number | null;
  amount_inr?: number | null;
  gas_used?: number | null;
  is_error: boolean;
  hop?: number;
  direction?: 'INCOMING' | 'OUTGOING';
  is_bridge?: boolean;
  bridge_protocol?: string | null;
  destination_chain?: string | null;
  destination_address?: string | null;
}

export interface GraphNodeData {
  id: string;
  label: string;
  address: string;
  role: 'INPUT_WALLET' | 'INTERMEDIARY_HOP_1' | 'INTERMEDIARY_HOP_2' | 'INTERMEDIARY_HOP_3' | 'KNOWN_VASP' | 'BRIDGE_PROTOCOL' | 'EXTERNAL';
  hop: number;
  is_vasp: boolean;
  vasp_name?: string | null;
  vasp_confidence?: string | null;
  address_type?: string | null;
  tx_count: number;
  total_inflow: number;
  total_outflow: number;
  is_contract?: boolean;
  chain?: string | null;
  is_bridge?: boolean;
  bridge_protocol?: string | null;
  is_sanctioned?: boolean;
  is_exploit?: boolean;
  entity_name?: string | null;
  category?: string | null;
  risk_level?: string | null;
  is_mixer?: boolean;
  sanctions_program?: string | null;
}


export interface GraphNode {
  data: GraphNodeData;
}

export interface GraphEdgeData {
  id: string;
  source: string;
  target: string;
  tx_hash: string;
  asset_symbol: string;
  amount: number;
  timestamp: string;
  hop: number;
  is_cross_chain?: boolean;
  bridge_protocol?: string | null;
  source_chain?: string | null;
  target_chain?: string | null;
  // Case 6: INR/USD Asset Valuation
  amount_usd?: number | null;
  amount_inr?: number | null;
  unit_price_usd?: number | null;
  unit_price_inr?: number | null;
  // Case 2: FIFO Taint Tracking
  traceable_amount?: number | null;
  unclassified_amount?: number | null;
  taint_ratio?: number | null;
}

export interface GraphEdge {
  data: GraphEdgeData;
}

export interface TaintSummary {
  total_transactions?: number;
  total_volume?: number;
  total_traceable?: number;
  total_unclassified?: number;
  overall_taint_ratio?: number;
  suspect_wallets_count?: number;
  tainted_addresses_count?: number;
  tainted_addresses?: string[];
}

export interface GraphData {
  nodes: GraphNode[];
  edges: GraphEdge[];
  stats: {
    root_wallet: string;
    chain?: string;
    total_nodes: number;
    total_edges: number;
    vasp_nodes_found: number;
    cross_chain_edges?: number;
    max_hop_reached: number;
    total_amount_inr?: number;
    total_amount_usd?: number;
    taint_summary?: TaintSummary;
  };
}

export interface Attribution {
  id?: number;
  vasp_name: string;
  score: number;
  evidence_strength: 'High' | 'Medium' | 'Low';
  rank: number;
  summary: string;
  metrics?: {
    shortest_hop: number;
    total_cluster_flow: number;
    total_interactions: number;
    breakdown: {
      proximity_score: number;
      flow_score: number;
      frequency_score: number;
      behavioral_score: number;
      recency_score: number;
    };
  };
}

export interface EvidenceItem {
  id?: number;
  evidence_type: string;
  source_address?: string | null;
  target_address?: string | null;
  tx_hash?: string | null;
  hop_distance?: number | null;
  amount?: number | null;
  asset_symbol?: string | null;
  explanation: string;
  strength: 'HIGH' | 'MEDIUM' | 'LOW';
}

export interface RiskAssessment {
  risk_level: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  score: number;
  composite_risk_score?: number;
  indicators: string[];
  explanation: string;
}

export interface AddressLookupResponse {
  address: string;
  chain: string;
  has_label: boolean;
  is_sanctioned: boolean;
  is_exploit?: boolean;
  is_vasp: boolean;
  is_mixer: boolean;
  risk_level: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  entity?: string | null;
  label: string;
  category: string;
  confidence?: string | number | null;
  confidence_score?: number | null;
  source_name?: string | null;
  source_url?: string | null;
  notes?: string | null;
  cached_analysis_id?: string | null;
}


export interface AnalysisStatus {
  analysis_id: string;
  wallet_address: string;
  status: 'QUEUED' | 'FETCHING_DATA' | 'BUILDING_GRAPH' | 'ANALYZING' | 'COMPLETED' | 'FAILED';
  error_message?: string | null;
  started_at: string;
  completed_at?: string | null;
  num_transactions: number;
  num_nodes: number;
  num_edges: number;
  demo_mode?: boolean;
  is_cached?: boolean;
  top_attribution?: Attribution | null;
  risk_assessment?: RiskAssessment | null;
  total_volume?: number;
  total_volume_inr?: number;
  total_volume_usd?: number;
  total_traceable_inr?: number;
  total_traceable_usd?: number;
  entity_name?: string | null;
  entity_label?: string | null;
  category?: string | null;
  is_sanctioned?: boolean;
  is_exploit?: boolean;
}

export interface TraceJob {
  job_id: string;
  status: string;
  address: string;
  chain: string;
  max_depth: number;
  started_at: string;
  demo_mode?: boolean;
}

export interface TraceStatus {
  job_id: string;
  address: string;
  chain: string;
  status: 'QUEUED' | 'RUNNING' | 'COMPLETED' | 'FAILED';
  max_depth: number;
  current_depth: number;
  started_at: string;
  completed_at?: string | null;
  num_nodes: number;
  num_edges: number;
  num_transactions: number;
  vasp_found: boolean;
  matched_vasps: any[];
  shortest_path?: any;
  leaf_nodes: any[];
  demo_mode?: boolean;
  is_cached?: boolean;
  error_message?: string | null;
  summary?: string | null;
}

export interface VASPAddress {
  address: string;
  chain: string;
  address_type: string;
  source: string;
  confidence: string;
  notes?: string;
}

export interface VASPItem {
  name: string;
  category: string;
  website?: string;
  risk_rating: string;
  notes?: string;
  addresses: VASPAddress[];
}

export interface InvestigationReport {
  case_id: string;
  input_wallet: string;
  chain: string;
  analysis_timestamp: string;
  data_sources: string[];
  summary_metrics: Record<string, any>;
  top_attribution?: Attribution;
  all_attributions: Attribution[];
  key_evidence: EvidenceItem[];
  risk_assessment?: RiskAssessment;
  critical_transactions: any[];
  methodology_summary: string;
  limitations: string[];
  legal_disclaimer: string;
}

export interface ReachableVASPSummary {
  name: string;
  min_hop: number;
  direct_tx_count: number;
  flow_volume_usd: number;
  paths_count: number;
}

export interface CandidateQualityBreakdown {
  history_quality: number;
  activity_quality: number;
  graph_quality: number;
  vasp_connectivity: number;
  flow_quality: number;
}

export interface CandidateWallet {
  id: number;
  address: string;
  chain: string;
  discovery_source: string;
  discovery_vasp_name: string;
  discovery_vasp_address: string;
  discovered_from_tx_hash?: string | null;
  discovered_at: string;
  last_analyzed_at: string;
  transaction_count: number;
  token_transfers_count: number;
  unique_counterparties_count: number;
  usdt_volume: number;
  usdc_volume: number;
  total_volume_usd: number;
  first_activity?: string | null;
  latest_activity?: string | null;
  active_days: number;
  incoming_tx_count: number;
  outgoing_tx_count: number;
  incoming_volume: number;
  outgoing_volume: number;
  reachable_vasps: ReachableVASPSummary[];
  min_hop_to_vasp: number;
  reachable_vasp_count: number;
  total_paths_to_vasps: number;
  candidate_quality_score: number;
  quality_breakdown?: CandidateQualityBreakdown;
  status: 'investigation_ready' | 'insufficient_activity' | 'incomplete_data' | 'filtered';
  rejection_reason?: string | null;
}

export interface CandidateListResponse {
  total: number;
  limit: number;
  offset: number;
  candidates: CandidateWallet[];
}

export interface CandidateStats {
  total_candidates_stored: number;
  investigation_ready_count: number;
  hop_1_count: number;
  hop_2_count: number;
  hop_3_count: number;
  average_quality_score: number;
  is_running: boolean;
  vasp_seeds_processed: number;
  total_counterparties_discovered: number;
  total_rejected: number;
  last_processed_address?: string | null;
  last_updated: string;
}

export interface VASPDirectoryItem {
  id: number;
  name: string;
  category: string;
  jurisdiction: string;
  country: string;
  known_deposit_cluster_labels: string[];
  mock_contact_endpoint?: string | null;
  mock_response_sla?: string | null;
  contact_endpoint?: string | null;
  response_sla?: string | null;
  fiu_registration_number?: string | null;
  sahyog_routing_code?: string | null;
  compliance_email?: string | null;
  designated_lea_email?: string | null;
  compliance_portal?: string | null;
  nodal_officer?: string | null;
  is_fiu_registered: boolean;
  is_simulated: boolean;
  created_at: string;
}

export interface DisclosureRequestResponse {
  is_simulated: boolean;
  simulation_notice: string;
  dispatch_id: string;
  case_id: string;
  suspect_address: string;
  chain: string;
  target_vasp: string;
  sahyog_routing_code: string;
  mock_contact_endpoint: string;
  mock_response_sla: string;
  contact_endpoint?: string;
  response_sla?: string;
  status: string;
  acknowledgment_message: string;
  statutory_authority: string;
  dispatched_by: string;
  timestamp: string;
  timeline_event_id?: number | null;
  draft_notice_summary?: {
    ref_number?: string;
    fiu_ind_registration?: string;
    compliance_email?: string;
    designated_lea_email?: string;
    statutory_references?: string[];
  } | null;
}

// ==============================================================================
// Phase 7 — Case Management, RBAC Auth, Audit Trail & Streaming Types
// ==============================================================================

export interface UserAuth {
  access_token: string;
  token_type: string;
  role: 'supervisor' | 'investigator' | string;
  username: string;
  full_name?: string;
  email?: string;
}

export interface CaseItem {
  id: string;
  title: string;
  description?: string | null;
  suspect_address: string;
  chain: string;
  status: 'OPEN' | 'IN_PROGRESS' | 'CLOSED';
  priority: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  created_by_id?: number;
  creator_username?: string | null;
  assigned_to_id?: number;
  assignee_username?: string | null;
  victim_loss_inr: number;
  ncrp_complaint_id?: string | null;
  trace_job_ids: string[];
  analysis_ids: string[];
  tags: string[];
  notes?: string | null;
  created_at: string;
  updated_at: string;
}

export interface CaseDetail extends CaseItem {
  traces: Array<{
    job_id: string;
    status: string;
    chain: string;
    vasp_found: boolean;
    matched_vasps: any[];
    shortest_path?: any;
    num_nodes: number;
    num_edges: number;
  }>;
  analyses: any[];
  audit_trail: AuditLogEntry[];
  disclosure_requests?: DisclosureRequestResponse[];
}

export interface CaseCreatePayload {
  title: string;
  description?: string;
  suspect_address: string;
  chain?: string;
  priority?: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  victim_loss_inr?: number;
  ncrp_complaint_id?: string;
  tags?: string[];
  notes?: string;
}

export interface AuditLogEntry {
  id: number;
  timestamp: string;
  user_id?: number | null;
  username: string;
  action: string;
  resource_type: string;
  resource_id?: string | null;
  case_id?: string | null;
  details: Record<string, any>;
  ip_address?: string | null;
}

export interface AuditLogListResponse {
  total: number;
  limit: number;
  offset: number;
  logs: AuditLogEntry[];
}

export interface TraceStreamEvent {
  event: 'JOB_STARTED' | 'HOP_STARTED' | 'NODE_DISCOVERED' | 'EDGE_ADDED' | 'VASP_REACHED' | 'HOP_COMPLETED' | 'TRACE_COMPLETED' | 'TRACE_FAILED';
  job_id: string;
  hop: number;
  timestamp: string;
  data: {
    address?: string;
    chain?: string;
    is_vasp?: boolean;
    label?: string;
    entity?: string;
    risk_level?: string;
    category?: string; // 'exchange' | 'mixer' | 'sanctioned' | 'unknown'
    source?: string;
    target?: string;
    tx_hash?: string;
    amount?: number;
    asset_symbol?: string;
    vasp_name?: string;
    path?: string[];
    num_nodes?: number;
    num_edges?: number;
    matched_vasps?: any[];
    shortest_path?: any;
    error?: string;
    [key: string]: any;
  };
}

export interface CSVIntakeRecord {
  id: string;
  address: string;
  chain: string;
  label?: string;
  victim_loss_inr?: number;
  priority?: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  status: 'valid' | 'invalid';
  error?: string;
}
