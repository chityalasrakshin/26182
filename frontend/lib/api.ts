import {
  AnalysisStatus,
  GraphData,
  Attribution,
  EvidenceItem,
  NormalizedTransaction,
  InvestigationReport,
  VASPItem,
  VASPDirectoryItem,
  DisclosureRequestResponse,
  UserAuth,
  CaseItem,
  CaseDetail,
  CaseCreatePayload,
  AuditLogEntry,
  AuditLogListResponse,
  TraceStreamEvent,
} from './types';

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000/api/v1';
const ROOT_URL = API_BASE_URL.replace(/\/api\/v1\/?$/, '');

async function handleResponse<T>(res: Response): Promise<T> {
  if (!res.ok) {
    let errorDetail = 'API request failed';
    try {
      const data = await res.json();
      errorDetail = data.detail || errorDetail;
    } catch {
      errorDetail = res.statusText || errorDetail;
    }
    throw new Error(errorDetail);
  }
  return res.json();
}

export const api = {
  async startAnalysis(walletAddress: string, maxHops: number = 3): Promise<AnalysisStatus> {
    const res = await fetch(`${API_BASE_URL}/analyze`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ wallet_address: walletAddress, max_hops: maxHops }),
    });
    return handleResponse<AnalysisStatus>(res);
  },

  async getAnalysisStatus(analysisId: string): Promise<AnalysisStatus> {
    const res = await fetch(`${API_BASE_URL}/analysis/${analysisId}`, { cache: 'no-store' });
    return handleResponse<AnalysisStatus>(res);
  },

  async getAnalysisGraph(analysisId: string): Promise<GraphData> {
    const res = await fetch(`${API_BASE_URL}/analysis/${analysisId}/graph`, { cache: 'no-store' });
    return handleResponse<GraphData>(res);
  },

  async getAnalysisAttributions(analysisId: string): Promise<Attribution[]> {
    const res = await fetch(`${API_BASE_URL}/analysis/${analysisId}/attributions`, { cache: 'no-store' });
    return handleResponse<Attribution[]>(res);
  },

  async getAnalysisEvidence(analysisId: string): Promise<EvidenceItem[]> {
    const res = await fetch(`${API_BASE_URL}/analysis/${analysisId}/evidence`, { cache: 'no-store' });
    return handleResponse<EvidenceItem[]>(res);
  },

  async getAnalysisTransactions(analysisId: string): Promise<NormalizedTransaction[]> {
    const res = await fetch(`${API_BASE_URL}/analysis/${analysisId}/transactions`, { cache: 'no-store' });
    return handleResponse<NormalizedTransaction[]>(res);
  },

  async getAnalysisReport(analysisId: string, format: 'json' | 'markdown' = 'json'): Promise<InvestigationReport | { report_markdown: string }> {
    const res = await fetch(`${API_BASE_URL}/analysis/${analysisId}/report?format=${format}`, { cache: 'no-store' });
    return handleResponse(res);
  },

  async getVASPRegistry(): Promise<VASPItem[]> {
    const res = await fetch(`${API_BASE_URL}/vasps`, { cache: 'no-store' });
    return handleResponse<VASPItem[]>(res);
  },

  async getVASPStats(): Promise<any> {
    const res = await fetch(`${API_BASE_URL}/vasps/stats`, { cache: 'no-store' });
    return handleResponse(res);
  },

  async getVASPAddresses(params: {
    query?: string;
    chain?: string;
    vasp_name?: string;
    address_type?: string;
    verification_status?: string;
    limit?: number;
    offset?: number;
  } = {}): Promise<{ total: number; limit: number; offset: number; addresses: any[] }> {
    const sp = new URLSearchParams();
    if (params.query) sp.append('query', params.query);
    if (params.chain) sp.append('chain', params.chain);
    if (params.vasp_name) sp.append('vasp_name', params.vasp_name);
    if (params.address_type) sp.append('address_type', params.address_type);
    if (params.verification_status) sp.append('verification_status', params.verification_status);
    if (params.limit !== undefined) sp.append('limit', params.limit.toString());
    if (params.offset !== undefined) sp.append('offset', params.offset.toString());
    const res = await fetch(`${API_BASE_URL}/vasps/addresses?${sp.toString()}`, { cache: 'no-store' });
    return handleResponse(res);
  },

  async getRecentAnalyses(): Promise<AnalysisStatus[]> {
    const res = await fetch(`${API_BASE_URL}/recent`, { cache: 'no-store' });
    return handleResponse<AnalysisStatus[]>(res);
  },

  async getFreezeNotice(analysisId: string, officerName?: string, policeStation?: string, crimeNumber?: string): Promise<any> {
    const params = new URLSearchParams();
    if (officerName) params.append('officer_name', officerName);
    if (policeStation) params.append('police_station', policeStation);
    if (crimeNumber) params.append('crime_number', crimeNumber);
    const res = await fetch(`${API_BASE_URL}/analysis/${analysisId}/freeze-notice?${params.toString()}`, { cache: 'no-store' });
    return handleResponse(res);
  },

  async getNCRPCases(): Promise<any[]> {
    const res = await fetch(`${API_BASE_URL}/ncrp/cases`, { cache: 'no-store' });
    return handleResponse<any[]>(res);
  },

  async getHealth(): Promise<any> {
    const res = await fetch(`${API_BASE_URL}/health`, { cache: 'no-store' });
    return handleResponse(res);
  },

  async getMLEvaluation(): Promise<any> {
    const res = await fetch(`${API_BASE_URL}/ml/evaluation`, { cache: 'no-store' });
    return handleResponse(res);
  },

  async getDatasetIngestionStatus(): Promise<any> {
    const res = await fetch(`${API_BASE_URL}/data/ingestion-status`, { cache: 'no-store' });
    return handleResponse(res);
  },

  async startDatasetIngestion(target: number = 100000): Promise<any> {
    const res = await fetch(`${API_BASE_URL}/data/start-ingestion?target=${target}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
    });
    return handleResponse(res);
  },

  async stopDatasetIngestion(): Promise<any> {
    const res = await fetch(`${API_BASE_URL}/data/stop-ingestion`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
    });
    return handleResponse(res);
  },

  async getCandidates(params: {
    chain?: string;
    min_score?: number;
    min_tx?: number;
    vasp?: string;
    status?: string;
    search?: string;
    sort_by?: string;
    limit?: number;
    offset?: number;
  } = {}): Promise<any> {
    const sp = new URLSearchParams();
    if (params.chain) sp.append('chain', params.chain);
    if (params.min_score !== undefined) sp.append('min_score', params.min_score.toString());
    if (params.min_tx !== undefined) sp.append('min_tx', params.min_tx.toString());
    if (params.vasp) sp.append('vasp', params.vasp);
    if (params.status) sp.append('status', params.status);
    if (params.search) sp.append('search', params.search);
    if (params.sort_by) sp.append('sort_by', params.sort_by);
    if (params.limit !== undefined) sp.append('limit', params.limit.toString());
    if (params.offset !== undefined) sp.append('offset', params.offset.toString());
    const res = await fetch(`${API_BASE_URL}/candidates?${sp.toString()}`, { cache: 'no-store' });
    return handleResponse(res);
  },

  async getCandidateStats(): Promise<any> {
    const res = await fetch(`${API_BASE_URL}/candidates/stats`, { cache: 'no-store' });
    return handleResponse(res);
  },

  async triggerCandidateDiscovery(max_seeds: number = 20, max_candidates_per_seed: number = 15): Promise<any> {
    const res = await fetch(
      `${API_BASE_URL}/candidates/discover?max_seeds=${max_seeds}&max_candidates_per_seed=${max_candidates_per_seed}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      }
    );
    return handleResponse(res);
  },

  async downloadPdfDossier(
    analysisId: string,
    officerName?: string,
    policeStation?: string
  ): Promise<void> {
    const params = new URLSearchParams();
    if (officerName) params.append('officer_name', officerName);
    if (policeStation) params.append('police_station', policeStation);
    const res = await fetch(
      `${API_BASE_URL}/analysis/${analysisId}/pdf?${params.toString()}`,
      { cache: 'no-store' }
    );
    if (!res.ok) {
      let errorDetail = 'PDF download failed';
      try {
        const data = await res.json();
        errorDetail = data.detail || errorDetail;
      } catch {
        errorDetail = res.statusText || errorDetail;
      }
      throw new Error(errorDetail);
    }
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `case_dossier_${analysisId.slice(0, 8).toUpperCase()}.pdf`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  },

  async getVASPDirectory(query?: string, fiuOnly: boolean = false): Promise<VASPDirectoryItem[]> {
    const params = new URLSearchParams();
    if (query) params.append('query', query);
    if (fiuOnly) params.append('fiu_only', 'true');
    const res = await fetch(`${API_BASE_URL}/vasps/directory?${params.toString()}`, { cache: 'no-store' });
    return handleResponse<VASPDirectoryItem[]>(res);
  },

  async getVASPDirectoryEntry(vaspName: string): Promise<VASPDirectoryItem> {
    const res = await fetch(`${API_BASE_URL}/vasps/directory/${encodeURIComponent(vaspName)}`, { cache: 'no-store' });
    return handleResponse<VASPDirectoryItem>(res);
  },

  async dispatchDisclosureRequest(
    targetId: string,
    payload?: {
      target_vasp?: string;
      urgency?: string;
      officer_name?: string;
      police_station?: string;
      crime_reference?: string;
      custom_instructions?: string;
    },
    isCase: boolean = false
  ): Promise<DisclosureRequestResponse> {
    const endpoint = isCase
      ? `${API_BASE_URL}/cases/${targetId}/disclosure-request`
      : `${API_BASE_URL}/analysis/${targetId}/disclosure-request`;

    const token = typeof window !== 'undefined' ? localStorage.getItem('token') : null;
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }

    const res = await fetch(endpoint, {
      method: 'POST',
      headers,
      body: JSON.stringify(payload || {}),
    });
    return handleResponse<DisclosureRequestResponse>(res);
  },

  // ==============================================================================
  // Phase 7: Authentication & RBAC Access Control
  // ==============================================================================

  async login(username: string, password: string): Promise<UserAuth> {
    const res = await fetch(`${API_BASE_URL}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, password }),
    });
    const authData = await handleResponse<any>(res);
    if (typeof window !== 'undefined') {
      localStorage.setItem('token', authData.access_token);
      localStorage.setItem('user_role', authData.role);
      localStorage.setItem('username', authData.username);
      if (authData.full_name) localStorage.setItem('user_full_name', authData.full_name);
    }
    return {
      access_token: authData.access_token,
      token_type: authData.token_type,
      role: authData.role,
      username: authData.username,
      full_name: authData.full_name,
    };
  },

  logout(): void {
    if (typeof window !== 'undefined') {
      localStorage.removeItem('token');
      localStorage.removeItem('user_role');
      localStorage.removeItem('username');
      localStorage.removeItem('user_full_name');
    }
  },

  getStoredUser(): UserAuth | null {
    if (typeof window === 'undefined') return null;
    const token = localStorage.getItem('token');
    const role = localStorage.getItem('user_role');
    const username = localStorage.getItem('username');
    if (!token || !role || !username) return null;
    return {
      access_token: token,
      token_type: 'bearer',
      role: role as 'supervisor' | 'investigator',
      username,
      full_name: localStorage.getItem('user_full_name') || undefined,
    };
  },

  // ==============================================================================
  // Phase 7: Case Management Endpoints
  // ==============================================================================

  async getCases(params: {
    status?: string;
    chain?: string;
    priority?: string;
    search?: string;
  } = {}): Promise<CaseItem[]> {
    const sp = new URLSearchParams();
    if (params.status) sp.append('status', params.status);
    if (params.chain) sp.append('chain', params.chain);
    if (params.priority) sp.append('priority', params.priority);
    if (params.search) sp.append('search', params.search);

    const token = typeof window !== 'undefined' ? localStorage.getItem('token') : null;
    const headers: Record<string, string> = {};
    if (token) headers['Authorization'] = `Bearer ${token}`;

    const res = await fetch(`${API_BASE_URL}/cases?${sp.toString()}`, {
      headers,
      cache: 'no-store',
    });
    return handleResponse<CaseItem[]>(res);
  },

  async createCase(payload: CaseCreatePayload): Promise<CaseItem> {
    const token = typeof window !== 'undefined' ? localStorage.getItem('token') : null;
    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
    if (token) headers['Authorization'] = `Bearer ${token}`;

    const res = await fetch(`${API_BASE_URL}/cases`, {
      method: 'POST',
      headers,
      body: JSON.stringify(payload),
    });
    return handleResponse<CaseItem>(res);
  },

  async getCaseDetail(caseId: string): Promise<CaseDetail> {
    const token = typeof window !== 'undefined' ? localStorage.getItem('token') : null;
    const headers: Record<string, string> = {};
    if (token) headers['Authorization'] = `Bearer ${token}`;

    const res = await fetch(`${API_BASE_URL}/cases/${caseId}`, {
      headers,
      cache: 'no-store',
    });
    return handleResponse<CaseDetail>(res);
  },

  async getCaseAuditTrail(caseId: string): Promise<AuditLogEntry[]> {
    const token = typeof window !== 'undefined' ? localStorage.getItem('token') : null;
    const headers: Record<string, string> = {};
    if (token) headers['Authorization'] = `Bearer ${token}`;

    const res = await fetch(`${API_BASE_URL}/cases/${caseId}/audit-trail`, {
      headers,
      cache: 'no-store',
    });
    return handleResponse<AuditLogEntry[]>(res);
  },

  async startCaseTrace(caseId: string, maxDepth: number = 6): Promise<{ job_id: string; status: string; chain: string }> {
    const token = typeof window !== 'undefined' ? localStorage.getItem('token') : null;
    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
    if (token) headers['Authorization'] = `Bearer ${token}`;

    const res = await fetch(`${API_BASE_URL}/cases/${caseId}/trace`, {
      method: 'POST',
      headers,
      body: JSON.stringify({ max_depth: maxDepth }),
    });
    return handleResponse<any>(res);
  },

  // ==============================================================================
  // Phase 7: Multi-Hop Async Trace & Real-Time WebSocket Streaming
  // ==============================================================================

  async startTrace(address: string, chain?: string, maxDepth: number = 6): Promise<{ job_id: string; status: string; chain: string }> {
    const token = typeof window !== 'undefined' ? localStorage.getItem('token') : null;
    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
    if (token) headers['Authorization'] = `Bearer ${token}`;

    const res = await fetch(`${ROOT_URL}/trace`, {
      method: 'POST',
      headers,
      body: JSON.stringify({ address, chain, max_depth: maxDepth }),
    });
    return handleResponse<any>(res);
  },

  async getTraceStatus(jobId: string): Promise<any> {
    const res = await fetch(`${ROOT_URL}/trace/${jobId}/status`, { cache: 'no-store' });
    return handleResponse<any>(res);
  },

  async getTraceGraph(jobId: string): Promise<GraphData> {
    const res = await fetch(`${ROOT_URL}/trace/${jobId}/graph`, { cache: 'no-store' });
    return handleResponse<GraphData>(res);
  },

  connectTraceWebSocket(
    jobId: string,
    onMessage: (event: TraceStreamEvent) => void,
    onError?: (err: any) => void,
    onClose?: () => void
  ): WebSocket | null {
    if (typeof window === 'undefined') return null;

    const wsUrl = (ROOT_URL.replace(/^http/, 'ws')) + `/trace/${jobId}/ws`;
    const ws = new WebSocket(wsUrl);

    ws.onmessage = (e) => {
      try {
        const parsed = JSON.parse(e.data);
        onMessage(parsed);
      } catch (err) {
        console.warn('Failed to parse WebSocket trace event:', err);
      }
    };

    if (onError) ws.onerror = onError;
    if (onClose) ws.onclose = onClose;

    return ws;
  },

  // ==============================================================================
  // Phase 7: Global Audit Log Inspector (Supervisor RBAC)
  // ==============================================================================

  async getGlobalAuditLogs(params: {
    action?: string;
    resource_type?: string;
    user_id?: number;
    case_id?: string;
    limit?: number;
    offset?: number;
  } = {}): Promise<AuditLogListResponse> {
    const sp = new URLSearchParams();
    if (params.action) sp.append('action', params.action);
    if (params.resource_type) sp.append('resource_type', params.resource_type);
    if (params.user_id !== undefined) sp.append('user_id', params.user_id.toString());
    if (params.case_id) sp.append('case_id', params.case_id);
    if (params.limit !== undefined) sp.append('limit', params.limit.toString());
    if (params.offset !== undefined) sp.append('offset', params.offset.toString());

    const token = typeof window !== 'undefined' ? localStorage.getItem('token') : null;
    const headers: Record<string, string> = {};
    if (token) headers['Authorization'] = `Bearer ${token}`;

    const res = await fetch(`${API_BASE_URL}/audit/logs?${sp.toString()}`, {
      headers,
      cache: 'no-store',
    });
    return handleResponse<AuditLogListResponse>(res);
  },
};
