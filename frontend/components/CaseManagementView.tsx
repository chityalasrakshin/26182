'use client';

import React, { useState, useEffect } from 'react';
import {
  Briefcase,
  ShieldCheck,
  Search,
  Filter,
  Plus,
  RefreshCw,
  FolderOpen,
  ArrowRight,
  Clock,
  User,
  Activity,
  AlertTriangle,
  ExternalLink,
  Copy,
  Check,
  Building2,
  FileText,
  DollarSign,
  TrendingUp,
  History,
  Lock,
  ChevronRight,
  Eye,
  Layers,
} from 'lucide-react';
import { api } from '../lib/api';
import { CaseItem, CaseDetail, AuditLogEntry, UserAuth } from '../lib/types';

interface CaseManagementViewProps {
  currentUser: UserAuth | null;
  onOpenCaseInWorkspace: (walletAddress: string, maxHops?: number) => void;
  onOpenNewCaseIntake: () => void;
  onSwitchRole?: (role: 'supervisor' | 'investigator') => void;
}

export const CaseManagementView: React.FC<CaseManagementViewProps> = ({
  currentUser,
  onOpenCaseInWorkspace,
  onOpenNewCaseIntake,
  onSwitchRole,
}) => {
  const [activeSubTab, setActiveSubTab] = useState<'cases' | 'audit' | 'analytics'>('cases');
  const [cases, setCases] = useState<CaseItem[]>([]);
  const [auditLogs, setAuditLogs] = useState<AuditLogEntry[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [priorityFilter, setPriorityFilter] = useState('ALL');
  const [chainFilter, setChainFilter] = useState('ALL');
  const [actionFilter, setActionFilter] = useState('ALL');
  const [selectedCaseDetail, setSelectedCaseDetail] = useState<CaseDetail | null>(null);
  const [copiedAddress, setCopiedAddress] = useState<string | null>(null);
  const [auditTotal, setAuditTotal] = useState(0);

  const isSupervisor = currentUser?.role === 'supervisor';

  useEffect(() => {
    loadData();
  }, [currentUser?.role, statusFilter, priorityFilter, chainFilter, actionFilter]);

  const loadData = async () => {
    setIsLoading(true);
    try {
      // 1. Load cases
      const casesData = await api.getCases({
        status: statusFilter !== 'ALL' ? statusFilter : undefined,
        priority: priorityFilter !== 'ALL' ? priorityFilter : undefined,
        chain: chainFilter !== 'ALL' ? chainFilter : undefined,
        search: searchQuery.trim() || undefined,
      }).catch(() => []);
      setCases(casesData || []);

      // 2. Load audit logs if supervisor or fallback
      const auditData = await api.getGlobalAuditLogs({
        action: actionFilter !== 'ALL' ? actionFilter : undefined,
        limit: 50,
      }).catch(() => ({ total: 0, limit: 50, offset: 0, logs: [] }));

      setAuditLogs(auditData.logs || []);
      setAuditTotal(auditData.total || 0);
    } catch (err) {
      console.warn('Error loading case and audit data:', err);
    } finally {
      setIsLoading(false);
    }
  };

  const handleCopy = (addr: string) => {
    navigator.clipboard.writeText(addr);
    setCopiedAddress(addr);
    setTimeout(() => setCopiedAddress(null), 2000);
  };

  const handleViewCase = async (caseId: string) => {
    try {
      const detail = await api.getCaseDetail(caseId);
      setSelectedCaseDetail(detail);
    } catch (err: any) {
      alert(`Could not load case details: ${err.message}`);
    }
  };

  // Cross-Case Analytics Derived Metrics
  const totalVolumeInr = cases.reduce((acc, c) => acc + (c.victim_loss_inr || 0), 0);
  const criticalCasesCount = cases.filter((c) => c.priority === 'CRITICAL').length;
  const highCasesCount = cases.filter((c) => c.priority === 'HIGH').length;
  const openCasesCount = cases.filter((c) => c.status === 'OPEN').length;

  return (
    <div className="space-y-4 font-sans text-xs">
      {/* Top Banner & Role Indicator */}
      <div className="bg-forensic-surface border border-forensic-border rounded p-4 shadow-sm flex flex-col md:flex-row items-start md:items-center justify-between gap-3">
        <div className="flex items-center space-x-3">
          <div className="p-2.5 rounded bg-blue-500/10 border border-blue-500/30 text-blue-400">
            <Briefcase className="h-5 w-5" />
          </div>
          <div>
            <div className="flex items-center space-x-2">
              <h2 className="text-sm font-bold text-forensic-text tracking-wide uppercase">
                Law Enforcement Case Register & Audit Trail
              </h2>
              <span className={`px-2 py-0.5 rounded text-[10px] font-mono font-bold uppercase border ${
                isSupervisor
                  ? 'bg-purple-500/15 text-purple-400 border-purple-500/30'
                  : 'bg-teal-500/15 text-teal-400 border-teal-500/30'
              }`}>
                {isSupervisor ? 'SUPERVISOR ROLE (ALL CASES)' : 'INVESTIGATOR ROLE (ASSIGNED CASES)'}
              </span>
            </div>
            <p className="text-[11px] text-forensic-textDim font-mono pt-0.5">
              Court-admissible case management with immutable cryptographic audit logging (Rule 6 compliant).
            </p>
          </div>
        </div>

        <div className="flex items-center space-x-2">
          {onSwitchRole && (
            <div className="flex items-center bg-forensic-surfaceRaised border border-forensic-border rounded p-0.5 font-mono text-[10px]">
              <span className="px-2 text-forensic-textDim font-semibold">Demo Role:</span>
              <button
                onClick={() => onSwitchRole('supervisor')}
                className={`px-2 py-1 rounded transition-colors ${
                  isSupervisor
                    ? 'bg-purple-600 text-white font-bold'
                    : 'text-forensic-textMuted hover:text-forensic-text'
                }`}
              >
                Supervisor
              </button>
              <button
                onClick={() => onSwitchRole('investigator')}
                className={`px-2 py-1 rounded transition-colors ${
                  !isSupervisor
                    ? 'bg-blue-600 text-white font-bold'
                    : 'text-forensic-textMuted hover:text-forensic-text'
                }`}
              >
                Investigator
              </button>
            </div>
          )}

          <button
            onClick={onOpenNewCaseIntake}
            className="flex items-center space-x-1.5 px-3 py-1.5 bg-blue-600 hover:bg-blue-500 text-white font-bold rounded shadow transition-colors font-mono text-xs"
          >
            <Plus className="h-3.5 w-3.5" />
            <span>New Case Intake</span>
          </button>
        </div>
      </div>

      {/* Cross-case Analytical Metrics Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 font-mono">
        <div className="bg-forensic-surface border border-forensic-border rounded p-3 space-y-1">
          <span className="text-[10px] text-forensic-textDim uppercase tracking-wider block">
            Active Cases
          </span>
          <div className="text-lg font-bold text-forensic-text flex items-baseline justify-between">
            <span>{cases.length}</span>
            <span className="text-[10px] text-teal-400 font-normal">{openCasesCount} Open</span>
          </div>
        </div>

        <div className="bg-forensic-surface border border-forensic-border rounded p-3 space-y-1">
          <span className="text-[10px] text-forensic-textDim uppercase tracking-wider block">
            Reported Loss Traced
          </span>
          <div className="text-lg font-bold text-forensic-text flex items-baseline justify-between">
            <span>₹{(totalVolumeInr / 100000).toFixed(1)} Lakh</span>
            <span className="text-[10px] text-forensic-textDim font-normal">INR Volume</span>
          </div>
        </div>

        <div className="bg-forensic-surface border border-forensic-border rounded p-3 space-y-1">
          <span className="text-[10px] text-forensic-textDim uppercase tracking-wider block">
            Critical / High Priority
          </span>
          <div className="text-lg font-bold text-red-400 flex items-baseline justify-between">
            <span>{criticalCasesCount + highCasesCount}</span>
            <span className="text-[10px] text-amber-400 font-normal">{criticalCasesCount} Critical</span>
          </div>
        </div>

        <div className="bg-forensic-surface border border-forensic-border rounded p-3 space-y-1">
          <span className="text-[10px] text-forensic-textDim uppercase tracking-wider block">
            Audit Logged Actions
          </span>
          <div className="text-lg font-bold text-purple-400 flex items-baseline justify-between">
            <span>{auditTotal || auditLogs.length}</span>
            <span className="text-[10px] text-teal-400 font-normal">Chain-of-Custody</span>
          </div>
        </div>
      </div>

      {/* Sub-Navigation Switcher */}
      <div className="flex border-b border-forensic-border bg-forensic-surfaceRaised/40 px-4 pt-1 font-mono text-xs">
        <button
          onClick={() => setActiveSubTab('cases')}
          className={`pb-2 px-4 font-semibold border-b-2 transition-colors flex items-center space-x-2 ${
            activeSubTab === 'cases'
              ? 'border-blue-500 text-blue-400'
              : 'border-transparent text-forensic-textMuted hover:text-forensic-text'
          }`}
        >
          <FolderOpen className="h-3.5 w-3.5" />
          <span>Case Files Register ({cases.length})</span>
        </button>

        <button
          onClick={() => setActiveSubTab('audit')}
          className={`pb-2 px-4 font-semibold border-b-2 transition-colors flex items-center space-x-2 ${
            activeSubTab === 'audit'
              ? 'border-purple-500 text-purple-400'
              : 'border-transparent text-forensic-textMuted hover:text-forensic-text'
          }`}
        >
          <History className="h-3.5 w-3.5" />
          <span>Supervisor Audit Trail ({auditLogs.length})</span>
        </button>

        <button
          onClick={() => setActiveSubTab('analytics')}
          className={`pb-2 px-4 font-semibold border-b-2 transition-colors flex items-center space-x-2 ${
            activeSubTab === 'analytics'
              ? 'border-teal-500 text-teal-400'
              : 'border-transparent text-forensic-textMuted hover:text-forensic-text'
          }`}
        >
          <TrendingUp className="h-3.5 w-3.5" />
          <span>LEA Analytics & Heatmap</span>
        </button>
      </div>

      {/* ======================================================================= */}
      {/* SUB-TAB 1: CASES REGISTER */}
      {/* ======================================================================= */}
      {activeSubTab === 'cases' && (
        <div className="bg-forensic-surface border border-forensic-border rounded shadow-sm p-4 space-y-4 font-mono">
          {/* Filters Bar */}
          <div className="flex flex-wrap items-center justify-between gap-2.5">
            <div className="flex items-center space-x-2 flex-1 min-w-[240px] max-w-md">
              <div className="relative w-full">
                <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-forensic-textDim" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && loadData()}
                  placeholder="Search case ID, title, or suspect address..."
                  className="w-full pl-8 pr-3 py-1.5 bg-forensic-bg border border-forensic-border rounded text-forensic-text text-xs focus:outline-none focus:border-blue-500"
                />
              </div>
              <button
                onClick={loadData}
                className="p-2 rounded bg-forensic-surfaceRaised hover:bg-forensic-border text-forensic-text border border-forensic-border transition-colors"
                title="Refresh Cases"
              >
                <RefreshCw className={`h-3.5 w-3.5 ${isLoading ? 'animate-spin' : ''}`} />
              </button>
            </div>

            <div className="flex flex-wrap items-center gap-2 text-[11px]">
              {/* Status Filter */}
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="px-2.5 py-1.5 bg-forensic-bg border border-forensic-border rounded text-forensic-text focus:outline-none"
              >
                <option value="ALL">Status: All</option>
                <option value="OPEN">Open</option>
                <option value="IN_PROGRESS">In Progress</option>
                <option value="CLOSED">Closed</option>
              </select>

              {/* Priority Filter */}
              <select
                value={priorityFilter}
                onChange={(e) => setPriorityFilter(e.target.value)}
                className="px-2.5 py-1.5 bg-forensic-bg border border-forensic-border rounded text-forensic-text focus:outline-none"
              >
                <option value="ALL">Priority: All</option>
                <option value="CRITICAL">Critical</option>
                <option value="HIGH">High</option>
                <option value="MEDIUM">Medium</option>
                <option value="LOW">Low</option>
              </select>

              {/* Chain Filter */}
              <select
                value={chainFilter}
                onChange={(e) => setChainFilter(e.target.value)}
                className="px-2.5 py-1.5 bg-forensic-bg border border-forensic-border rounded text-forensic-text focus:outline-none"
              >
                <option value="ALL">Chain: All</option>
                <option value="ethereum">Ethereum Mainnet</option>
                <option value="tron">Tron TRC-20</option>
                <option value="bitcoin">Bitcoin</option>
              </select>
            </div>
          </div>

          {/* Cases Table */}
          <div className="border border-forensic-border rounded overflow-hidden">
            <table className="w-full text-left text-[11px]">
              <thead className="bg-forensic-bg text-forensic-textDim uppercase text-[10px] border-b border-forensic-border">
                <tr>
                  <th className="px-3 py-2">Case ID</th>
                  <th className="px-3 py-2">Priority</th>
                  <th className="px-3 py-2">Title / NCRP Ref</th>
                  <th className="px-3 py-2">Suspect Wallet</th>
                  <th className="px-3 py-2">Chain</th>
                  <th className="px-3 py-2">Reported Loss</th>
                  <th className="px-3 py-2">Officer</th>
                  <th className="px-3 py-2">Status</th>
                  <th className="px-3 py-2 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-forensic-border">
                {cases.length > 0 ? (
                  cases.map((c) => (
                    <tr key={c.id} className="hover:bg-forensic-surfaceRaised/50 transition-colors">
                      <td className="px-3 py-2.5 font-bold text-forensic-text">
                        {c.id}
                      </td>
                      <td className="px-3 py-2.5">
                        <span className={`px-1.5 py-0.2 rounded font-bold text-[9px] uppercase border ${
                          c.priority === 'CRITICAL'
                            ? 'bg-red-500/15 text-red-400 border-red-500/30'
                            : c.priority === 'HIGH'
                            ? 'bg-amber-500/15 text-amber-400 border-amber-500/30'
                            : 'bg-teal-500/15 text-teal-400 border-teal-500/30'
                        }`}>
                          {c.priority}
                        </span>
                      </td>
                      <td className="px-3 py-2.5">
                        <div className="font-semibold text-forensic-text truncate max-w-[180px]">
                          {c.title}
                        </div>
                        {c.ncrp_complaint_id && (
                          <div className="text-[10px] text-forensic-textDim">
                            Ref: {c.ncrp_complaint_id}
                          </div>
                        )}
                      </td>
                      <td className="px-3 py-2.5">
                        <div className="flex items-center space-x-1.5">
                          <span className="text-forensic-text font-bold">
                            {c.suspect_address.slice(0, 6)}...{c.suspect_address.slice(-4)}
                          </span>
                          <button
                            onClick={() => handleCopy(c.suspect_address)}
                            className="p-0.5 text-forensic-textDim hover:text-forensic-text"
                            title="Copy address"
                          >
                            {copiedAddress === c.suspect_address ? (
                              <Check className="h-3 w-3 text-teal-400" />
                            ) : (
                              <Copy className="h-3 w-3" />
                            )}
                          </button>
                        </div>
                      </td>
                      <td className="px-3 py-2.5 uppercase text-[10px] text-blue-400">
                        {c.chain}
                      </td>
                      <td className="px-3 py-2.5 text-forensic-text">
                        ₹{(c.victim_loss_inr || 0).toLocaleString('en-IN')}
                      </td>
                      <td className="px-3 py-2.5 text-forensic-textDim">
                        {c.creator_username || 'investigator'}
                      </td>
                      <td className="px-3 py-2.5">
                        <span className="px-1.5 py-0.2 rounded text-[9px] font-bold uppercase bg-teal-500/10 text-teal-400 border border-teal-500/20">
                          {c.status}
                        </span>
                      </td>
                      <td className="px-3 py-2.5 text-right space-x-1.5">
                        <button
                          onClick={() => handleViewCase(c.id)}
                          className="px-2 py-0.5 rounded bg-forensic-surfaceRaised hover:bg-forensic-border text-forensic-text border border-forensic-border transition-colors text-[10px]"
                        >
                          Dossier
                        </button>
                        <button
                          onClick={() => onOpenCaseInWorkspace(c.suspect_address, 3)}
                          className="px-2.5 py-0.5 rounded bg-blue-600 hover:bg-blue-500 text-white font-bold transition-colors text-[10px]"
                        >
                          Trace →
                        </button>
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={9} className="px-4 py-8 text-center text-forensic-textDim">
                      {isLoading ? 'Loading cases from database...' : 'No cases matching active filters.'}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ======================================================================= */}
      {/* SUB-TAB 2: SUPERVISOR AUDIT TRAIL */}
      {/* ======================================================================= */}
      {activeSubTab === 'audit' && (
        <div className="bg-forensic-surface border border-forensic-border rounded shadow-sm p-4 space-y-4 font-mono">
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-forensic-border pb-3">
            <div className="flex items-center space-x-2">
              <History className="h-4 w-4 text-purple-400" />
              <h3 className="text-xs uppercase font-bold text-forensic-text tracking-wider">
                Immutable Law Enforcement Audit Log (Total: {auditTotal || auditLogs.length})
              </h3>
            </div>

            <div className="flex items-center space-x-2">
              <span className="text-[10px] text-forensic-textDim">Filter Action:</span>
              <select
                value={actionFilter}
                onChange={(e) => setActionFilter(e.target.value)}
                className="px-2 py-1 bg-forensic-bg border border-forensic-border rounded text-forensic-text text-[10px] focus:outline-none"
              >
                <option value="ALL">All Actions</option>
                <option value="CASE_CREATE">CASE_CREATE</option>
                <option value="TRACE_START">TRACE_START</option>
                <option value="REPORT_GENERATE">REPORT_GENERATE</option>
                <option value="DISCLOSURE_REQUEST">DISCLOSURE_REQUEST</option>
                <option value="AUTH_LOGIN">AUTH_LOGIN</option>
                <option value="CASE_UPDATE">CASE_UPDATE</option>
              </select>
              <button
                onClick={loadData}
                className="p-1 rounded bg-forensic-surfaceRaised hover:bg-forensic-border text-forensic-text border border-forensic-border transition-colors"
                title="Refresh Audit Logs"
              >
                <RefreshCw className={`h-3 w-3 ${isLoading ? 'animate-spin' : ''}`} />
              </button>
            </div>
          </div>

          <div className="border border-forensic-border rounded overflow-hidden max-h-[600px] overflow-y-auto">
            <table className="w-full text-left text-[11px]">
              <thead className="bg-forensic-bg text-forensic-textDim uppercase text-[10px] border-b border-forensic-border sticky top-0">
                <tr>
                  <th className="px-3 py-2">Timestamp (UTC)</th>
                  <th className="px-3 py-2">Officer</th>
                  <th className="px-3 py-2">Action</th>
                  <th className="px-3 py-2">Resource Type</th>
                  <th className="px-3 py-2">Case / Resource Ref</th>
                  <th className="px-3 py-2">IP Address</th>
                  <th className="px-3 py-2">Event Parameters</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-forensic-border">
                {auditLogs.length > 0 ? (
                  auditLogs.map((log) => (
                    <tr key={log.id} className="hover:bg-forensic-surfaceRaised/40 transition-colors">
                      <td className="px-3 py-2 text-forensic-textDim text-[10px]">
                        {new Date(log.timestamp).toISOString().replace('T', ' ').slice(0, 19)}
                      </td>
                      <td className="px-3 py-2 font-bold text-forensic-text">
                        {log.username}
                      </td>
                      <td className="px-3 py-2">
                        <span className={`px-1.5 py-0.2 rounded font-bold text-[9px] uppercase border ${
                          log.action.includes('CREATE') || log.action.includes('START')
                            ? 'bg-blue-500/15 text-blue-400 border-blue-500/30'
                            : log.action.includes('DISCLOSURE')
                            ? 'bg-teal-500/15 text-teal-400 border-teal-500/30'
                            : log.action.includes('REPORT')
                            ? 'bg-amber-500/15 text-amber-400 border-amber-500/30'
                            : 'bg-purple-500/15 text-purple-400 border-purple-500/30'
                        }`}>
                          {log.action}
                        </span>
                      </td>
                      <td className="px-3 py-2 uppercase text-[10px] text-forensic-textDim">
                        {log.resource_type}
                      </td>
                      <td className="px-3 py-2 text-forensic-text font-bold">
                        {log.case_id || log.resource_id || 'N/A'}
                      </td>
                      <td className="px-3 py-2 text-forensic-textDim text-[10px]">
                        {log.ip_address || '127.0.0.1'}
                      </td>
                      <td className="px-3 py-2 text-forensic-textDim text-[10px] max-w-[220px] truncate">
                        {JSON.stringify(log.details)}
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={7} className="px-4 py-8 text-center text-forensic-textDim">
                      {isLoading ? 'Querying supervisor audit logs...' : 'No audit entries found.'}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ======================================================================= */}
      {/* SUB-TAB 3: LEA ANALYTICS & HEATMAP */}
      {/* ======================================================================= */}
      {activeSubTab === 'analytics' && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 font-mono">
          {/* Priority & Risk Distribution */}
          <div className="bg-forensic-surface border border-forensic-border rounded p-4 space-y-3">
            <h3 className="text-xs font-bold text-forensic-text uppercase tracking-wider flex items-center space-x-2">
              <Activity className="h-4 w-4 text-blue-400" />
              <span>Case Risk & Priority Distribution</span>
            </h3>
            <div className="space-y-2 pt-1">
              {[
                { label: 'CRITICAL PRIORITY', count: criticalCasesCount, color: 'bg-red-500', text: 'text-red-400' },
                { label: 'HIGH PRIORITY', count: highCasesCount, color: 'bg-amber-400', text: 'text-amber-400' },
                { label: 'MEDIUM PRIORITY', count: cases.filter(c => c.priority === 'MEDIUM').length, color: 'bg-blue-400', text: 'text-blue-400' },
                { label: 'LOW PRIORITY', count: cases.filter(c => c.priority === 'LOW').length, color: 'bg-teal-400', text: 'text-teal-400' },
              ].map((p, idx) => (
                <div key={idx} className="space-y-1">
                  <div className="flex items-center justify-between text-[11px]">
                    <span className={p.text}>{p.label}</span>
                    <span className="font-bold text-forensic-text">{p.count} Cases</span>
                  </div>
                  <div className="w-full bg-forensic-bg h-2 rounded-full overflow-hidden border border-forensic-border">
                    <div
                      className={`h-full ${p.color}`}
                      style={{ width: `${cases.length > 0 ? (p.count / cases.length) * 100 : 0}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Blockchain Rail Distribution */}
          <div className="bg-forensic-surface border border-forensic-border rounded p-4 space-y-3">
            <h3 className="text-xs font-bold text-forensic-text uppercase tracking-wider flex items-center space-x-2">
              <Layers className="h-4 w-4 text-teal-400" />
              <span>Multi-Chain Off-Ramp Distribution</span>
            </h3>
            <div className="space-y-2 pt-1">
              {[
                { chain: 'Ethereum Mainnet (EVM)', count: cases.filter(c => c.chain === 'ethereum').length, color: 'bg-blue-500' },
                { chain: 'Tron Network (TRC-20 USDT)', count: cases.filter(c => c.chain === 'tron').length, color: 'bg-teal-400' },
                { chain: 'Bitcoin Network (BTC UTXO)', count: cases.filter(c => c.chain === 'bitcoin').length, color: 'bg-amber-400' },
              ].map((c, idx) => (
                <div key={idx} className="space-y-1">
                  <div className="flex items-center justify-between text-[11px]">
                    <span className="text-forensic-text">{c.chain}</span>
                    <span className="font-bold text-forensic-text">{c.count} Target Wallets</span>
                  </div>
                  <div className="w-full bg-forensic-bg h-2 rounded-full overflow-hidden border border-forensic-border">
                    <div
                      className={`h-full ${c.color}`}
                      style={{ width: `${cases.length > 0 ? (c.count / cases.length) * 100 : 0}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Case Detail Modal / Drawer */}
      {selectedCaseDetail && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-forensic-surface border border-forensic-border rounded-lg w-full max-w-2xl max-h-[85vh] flex flex-col shadow-2xl overflow-hidden font-mono text-xs">
            <div className="p-4 border-b border-forensic-border flex items-center justify-between bg-forensic-bg">
              <div className="flex items-center space-x-2">
                <FolderOpen className="h-4 w-4 text-blue-400" />
                <h3 className="font-bold text-forensic-text uppercase">
                  Case Dossier: {selectedCaseDetail.id}
                </h3>
              </div>
              <button
                onClick={() => setSelectedCaseDetail(null)}
                className="text-forensic-textDim hover:text-forensic-text"
              >
                ✕
              </button>
            </div>

            <div className="p-4 space-y-3 overflow-y-auto flex-1">
              <div className="grid grid-cols-2 gap-2 text-[11px]">
                <div>
                  <span className="text-forensic-textDim block uppercase text-[10px]">Title</span>
                  <strong className="text-forensic-text">{selectedCaseDetail.title}</strong>
                </div>
                <div>
                  <span className="text-forensic-textDim block uppercase text-[10px]">Suspect Address</span>
                  <strong className="text-blue-400 break-all">{selectedCaseDetail.suspect_address}</strong>
                </div>
                <div>
                  <span className="text-forensic-textDim block uppercase text-[10px]">Chain Rail</span>
                  <strong className="text-forensic-text uppercase">{selectedCaseDetail.chain}</strong>
                </div>
                <div>
                  <span className="text-forensic-textDim block uppercase text-[10px]">Reported Loss</span>
                  <strong className="text-forensic-text">₹{(selectedCaseDetail.victim_loss_inr || 0).toLocaleString('en-IN')}</strong>
                </div>
                <div>
                  <span className="text-forensic-textDim block uppercase text-[10px]">NCRP Ref</span>
                  <strong className="text-forensic-text">{selectedCaseDetail.ncrp_complaint_id || 'None'}</strong>
                </div>
                <div>
                  <span className="text-forensic-textDim block uppercase text-[10px]">Assigned Officer</span>
                  <strong className="text-forensic-text">{selectedCaseDetail.creator_username || 'investigator'}</strong>
                </div>
              </div>

              {selectedCaseDetail.description && (
                <div className="p-2.5 bg-forensic-bg border border-forensic-border rounded text-[11px] text-forensic-textMuted">
                  {selectedCaseDetail.description}
                </div>
              )}

              {/* Case-Specific Audit Timeline */}
              <div className="space-y-1.5 pt-2 border-t border-forensic-border">
                <span className="text-[10px] uppercase font-bold text-forensic-textDim">
                  Case Audit Timeline ({selectedCaseDetail.audit_trail?.length || 0} events)
                </span>
                <div className="space-y-1 max-h-40 overflow-y-auto">
                  {selectedCaseDetail.audit_trail?.map((a, idx) => (
                    <div key={idx} className="p-1.5 bg-forensic-bg rounded border border-forensic-border text-[10px] flex items-center justify-between">
                      <span className="text-blue-400 font-bold">{a.action}</span>
                      <span className="text-forensic-textDim">{a.username} • {new Date(a.timestamp).toLocaleTimeString()}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            <div className="p-3 border-t border-forensic-border bg-forensic-bg flex justify-end space-x-2">
              <button
                onClick={() => setSelectedCaseDetail(null)}
                className="px-3 py-1.5 rounded bg-forensic-surfaceRaised text-forensic-text border border-forensic-border"
              >
                Close
              </button>
              <button
                onClick={() => {
                  const addr = selectedCaseDetail.suspect_address;
                  setSelectedCaseDetail(null);
                  onOpenCaseInWorkspace(addr, 3);
                }}
                className="px-4 py-1.5 rounded bg-blue-600 hover:bg-blue-500 text-white font-bold"
              >
                Open in Workspace & Trace →
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
