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
  Download,
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
  const [downloadingCaseId, setDownloadingCaseId] = useState<string | null>(null);
  const [auditTotal, setAuditTotal] = useState(0);
  const [error, setError] = useState<string | null>(null);

  const isSupervisor = currentUser?.role === 'supervisor';

  useEffect(() => {
    loadData();
  }, [currentUser?.role, statusFilter, priorityFilter, chainFilter, actionFilter]);

  const loadData = async () => {
    setIsLoading(true);
    try {
      setError(null);
      // 1. Load cases directly from database
      const casesData = await api.getCases({
        status: statusFilter !== 'ALL' ? statusFilter : undefined,
        priority: priorityFilter !== 'ALL' ? priorityFilter : undefined,
        chain: chainFilter !== 'ALL' ? chainFilter : undefined,
        search: searchQuery.trim() || undefined,
      });
      setCases(casesData || []);

      // 2. Load audit logs
      try {
        const auditData = await api.getGlobalAuditLogs({
          action: actionFilter !== 'ALL' ? actionFilter : undefined,
          limit: 50,
        });

        setAuditLogs(auditData.logs || []);
        setAuditTotal(auditData.total || 0);
      } catch (auditErr) {
        console.warn('Could not load global audit logs:', auditErr);
      }
    } catch (err: any) {
      console.error('Error loading case and audit data:', err);
      setError(err.message || 'Failed to communicate with case management service.');
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

  const handleDownloadDossier = async (caseId: string) => {
    try {
      setDownloadingCaseId(caseId);
      await api.downloadCourtDossier(caseId);
    } catch (err: any) {
      alert(`Court dossier export failed: ${err.message}`);
    } finally {
      setDownloadingCaseId(null);
    }
  };

  // Cross-Case Analytics Derived Metrics
  const totalVolumeInr = cases.reduce((acc, c) => acc + (c.victim_loss_inr || 0), 0);
  const criticalCasesCount = cases.filter((c) => c.priority === 'CRITICAL').length;
  const highCasesCount = cases.filter((c) => c.priority === 'HIGH').length;
  const openCasesCount = cases.filter((c) => c.status === 'OPEN').length;

  return (
    <div className="space-y-5 font-sans text-xs">
      {/* Top Banner & Role Indicator */}
      <div className="bg-white border border-[#E2E8F0] rounded-2xl p-5 shadow-sm flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div className="flex items-center space-x-3.5">
          <div className="w-11 h-11 rounded-xl bg-sky-50 border border-sky-200 flex items-center justify-center text-[#0284C7] shrink-0 shadow-sm">
            <Briefcase className="h-6 w-6" />
          </div>
          <div>
            <div className="flex items-center space-x-2.5">
              <h2 className="text-base font-bold text-[#0F172A] tracking-wide uppercase font-mono">
                Law Enforcement Case Register &amp; Audit Trail
              </h2>
              <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-mono font-bold uppercase border ${isSupervisor
                ? 'bg-sky-50 text-[#0284C7] border-sky-200'
                : 'bg-emerald-50 text-emerald-700 border-emerald-200'
                }`}>
                {isSupervisor ? 'SUPERVISOR ROLE (ALL CASES)' : 'INVESTIGATOR ROLE (ASSIGNED CASES)'}
              </span>
            </div>
            <p className="text-xs text-[#64748B] font-sans pt-0.5">
              Court-admissible case management with immutable cryptographic audit logging (Rule 6 compliant).
            </p>
          </div>
        </div>

        <div className="flex items-center space-x-2">
          {onSwitchRole && (
            <div className="flex items-center bg-[#F1F5F9] border border-[#E2E8F0] rounded-lg p-1 font-mono text-[10px]">
              <span className="px-2.5 text-[#64748B] font-semibold">Role:</span>
              <button
                onClick={() => onSwitchRole('supervisor')}
                className={`px-3 py-1 rounded-md transition-colors ${isSupervisor
                  ? 'bg-[#0284C7] text-white font-bold shadow-sm'
                  : 'text-[#64748B] hover:text-[#0F172A]'
                  }`}
              >
                Supervisor
              </button>
              <button
                onClick={() => onSwitchRole('investigator')}
                className={`px-3 py-1 rounded-md transition-colors ${!isSupervisor
                  ? 'bg-[#0284C7] text-white font-bold shadow-sm'
                  : 'text-[#64748B] hover:text-[#0F172A]'
                  }`}
              >
                Investigator
              </button>
            </div>
          )}

          <button
            onClick={onOpenNewCaseIntake}
            className="flex items-center space-x-1.5 px-4 py-2 bg-[#0284C7] hover:bg-[#0369A1] text-white font-bold rounded-lg shadow-sm transition-all font-mono text-xs"
          >
            <Plus className="h-3.5 w-3.5" />
            <span>New Case Intake</span>
          </button>
        </div>
      </div>

      {error && (
        <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-rose-700 text-xs font-mono flex items-center justify-between">
          <span>Database connection or authentication error: {error}</span>
          <button onClick={loadData} className="underline hover:text-rose-900 font-bold">Retry</button>
        </div>
      )}

      {/* Cross-case Analytical Metrics Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 font-mono">
        <div className="bg-white border border-[#E2E8F0] rounded-xl p-4 space-y-1 shadow-sm">
          <span className="text-[10px] text-[#64748B] uppercase tracking-wider block font-semibold">
            Active Cases
          </span>
          <div className="text-xl font-bold text-[#0F172A] flex items-baseline justify-between">
            <span>{cases.length}</span>
            <span className="text-[10px] text-emerald-600 font-medium">{openCasesCount} Open</span>
          </div>
        </div>

        <div className="bg-white border border-[#E2E8F0] rounded-xl p-4 space-y-1 shadow-sm">
          <span className="text-[10px] text-[#64748B] uppercase tracking-wider block font-semibold">
            Reported Loss Traced
          </span>
          <div className="text-xl font-bold text-[#0F172A] flex items-baseline justify-between">
            <span>₹{(totalVolumeInr / 100000).toFixed(1)} Lakh</span>
            <span className="text-[10px] text-[#64748B] font-normal">INR Volume</span>
          </div>
        </div>

        <div className="bg-white border border-[#E2E8F0] rounded-xl p-4 space-y-1 shadow-sm">
          <span className="text-[10px] text-[#64748B] uppercase tracking-wider block font-semibold">
            Critical / High Priority
          </span>
          <div className="text-xl font-bold text-rose-600 flex items-baseline justify-between">
            <span>{criticalCasesCount + highCasesCount}</span>
            <span className="text-[10px] text-rose-600 font-normal">{criticalCasesCount} Critical</span>
          </div>
        </div>

        <div className="bg-white border border-[#E2E8F0] rounded-xl p-4 space-y-1 shadow-sm">
          <span className="text-[10px] text-[#64748B] uppercase tracking-wider block font-semibold">
            Audit Logged Actions
          </span>
          <div className="text-xl font-bold text-[#0284C7] flex items-baseline justify-between">
            <span>{auditTotal || auditLogs.length}</span>
            <span className="text-[10px] text-emerald-600 font-normal">Chain-of-Custody</span>
          </div>
        </div>
      </div>

      {/* Sub-Navigation Switcher */}
      <div className="flex border-b border-[#E2E8F0] bg-white px-4 pt-2 rounded-t-xl font-mono text-xs gap-2">
        <button
          onClick={() => setActiveSubTab('cases')}
          className={`pb-3 px-4 font-semibold border-b-2 transition-colors flex items-center space-x-2 ${activeSubTab === 'cases'
            ? 'border-[#0284C7] text-[#0284C7]'
            : 'border-transparent text-[#64748B] hover:text-[#0F172A]'
            }`}
        >
          <FolderOpen className="h-3.5 w-3.5" />
          <span>Case Files ({cases.length})</span>
        </button>

        <button
          onClick={() => setActiveSubTab('audit')}
          className={`pb-3 px-4 font-semibold border-b-2 transition-colors flex items-center space-x-2 ${activeSubTab === 'audit'
            ? 'border-[#0284C7] text-[#0284C7]'
            : 'border-transparent text-[#64748B] hover:text-[#0F172A]'
            }`}
        >
          <Lock className="h-3.5 w-3.5" />
          <span>Statutory Audit Trail ({auditTotal || auditLogs.length})</span>
        </button>

        <button
          onClick={() => setActiveSubTab('analytics')}
          className={`pb-3 px-4 font-semibold border-b-2 transition-colors flex items-center space-x-2 ${activeSubTab === 'analytics'
            ? 'border-[#0284C7] text-[#0284C7]'
            : 'border-transparent text-[#64748B] hover:text-[#0F172A]'
            }`}
        >
          <TrendingUp className="h-3.5 w-3.5" />
          <span>LEA Analytics &amp; Heatmap</span>
        </button>
      </div>

      {/* ======================================================================= */}
      {/* SUB-TAB 1: CASES REGISTER */}
      {/* ======================================================================= */}
      {activeSubTab === 'cases' && (
        <div className="bg-white border border-[#E2E8F0] rounded-b-xl shadow-sm p-4 space-y-4 font-mono">
          {/* Filters Bar */}
          <div className="flex flex-wrap items-center justify-between gap-2.5">
            <div className="flex items-center space-x-2 flex-1 min-w-[240px] max-w-md">
              <div className="relative w-full">
                <Search className="absolute left-3 top-2.5 h-3.5 w-3.5 text-[#64748B]" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && loadData()}
                  placeholder="Search case ID, title, or suspect address..."
                  className="w-full pl-9 pr-4 py-2 bg-[#F8FAFC] border border-[#E2E8F0] focus:border-[#0284C7] rounded-lg text-[#0F172A] placeholder-[#94A3B8] text-xs focus:outline-none"
                />
              </div>
              <button
                onClick={loadData}
                className="p-2 rounded-lg bg-white hover:bg-slate-50 text-[#0F172A] border border-[#E2E8F0] shadow-sm transition-colors"
                title="Refresh Cases"
              >
                <RefreshCw className={`h-3.5 w-3.5 ${isLoading ? 'animate-spin text-[#0284C7]' : ''}`} />
              </button>
            </div>

            <div className="flex flex-wrap items-center gap-2 text-[11px]">
              {/* Status Filter */}
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="px-3 py-1.5 bg-[#F8FAFC] border border-[#E2E8F0] focus:border-[#0284C7] rounded-lg text-[#0F172A] focus:outline-none"
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
                className="px-3 py-1.5 bg-[#F8FAFC] border border-[#E2E8F0] focus:border-[#0284C7] rounded-lg text-[#0F172A] focus:outline-none"
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
                className="px-3 py-1.5 bg-[#F8FAFC] border border-[#E2E8F0] focus:border-[#0284C7] rounded-lg text-[#0F172A] focus:outline-none"
              >
                <option value="ALL">Chain: All</option>
                <option value="ethereum">Ethereum Mainnet</option>
                <option value="tron">Tron TRC-20</option>
                <option value="bitcoin">Bitcoin</option>
              </select>
            </div>
          </div>

          {/* Cases Table */}
          <div className="border border-[#E2E8F0] rounded-xl overflow-hidden">
            <table className="w-full text-left text-[11px]">
              <thead className="bg-[#F8FAFC] text-[#64748B] uppercase text-[10px] border-b border-[#E2E8F0]">
                <tr>
                  <th className="px-3.5 py-3">Case ID</th>
                  <th className="px-3.5 py-3">Priority</th>
                  <th className="px-3.5 py-3">Title / NCRP Ref</th>
                  <th className="px-3.5 py-3">Suspect Wallet</th>
                  <th className="px-3.5 py-3">Chain</th>
                  <th className="px-3.5 py-3">Reported Loss</th>
                  <th className="px-3.5 py-3">Officer</th>
                  <th className="px-3.5 py-3">Status</th>
                  <th className="px-3.5 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#E2E8F0]">
                {cases.length > 0 ? (
                  cases.map((c) => (
                    <tr key={c.id} className="hover:bg-[#F8FAFC] transition-colors">
                      <td className="px-3.5 py-3 font-bold text-[#0F172A]">
                        {c.id}
                      </td>
                      <td className="px-3.5 py-3">
                        <span className={`px-2.5 py-0.5 rounded-full font-bold text-[9px] uppercase border ${c.priority === 'CRITICAL' || c.priority === 'HIGH'
                          ? 'bg-rose-50 text-rose-700 border-rose-200'
                          : c.priority === 'MEDIUM'
                            ? 'bg-amber-50 text-amber-700 border-amber-200'
                            : 'bg-emerald-50 text-emerald-700 border-emerald-200'
                          }`}>
                          {c.priority}
                        </span>
                      </td>
                      <td className="px-3.5 py-3">
                        <div className="font-semibold text-[#0F172A] truncate max-w-[180px]">
                          {c.title}
                        </div>
                        {c.ncrp_complaint_id && (
                          <div className="text-[10px] text-[#64748B]">
                            Ref: {c.ncrp_complaint_id}
                          </div>
                        )}
                      </td>
                      <td className="px-3.5 py-3">
                        <div className="flex items-center space-x-1.5">
                          <span className="text-[#0F172A] font-bold font-mono">
                            {c.suspect_address.slice(0, 6)}...{c.suspect_address.slice(-4)}
                          </span>
                          <button
                            onClick={() => handleCopy(c.suspect_address)}
                            className="p-1 text-[#64748B] hover:text-[#0F172A] transition-colors"
                            title="Copy address"
                          >
                            {copiedAddress === c.suspect_address ? (
                              <Check className="h-3 w-3 text-emerald-600" />
                            ) : (
                              <Copy className="h-3 w-3" />
                            )}
                          </button>
                        </div>
                      </td>
                      <td className="px-3.5 py-3 uppercase text-[10px] text-[#0284C7] font-semibold">
                        {c.chain}
                      </td>
                      <td className="px-3.5 py-3 text-[#0F172A] font-mono">
                        ₹{(c.victim_loss_inr || 0).toLocaleString('en-IN')}
                      </td>
                      <td className="px-3.5 py-3 text-[#64748B]">
                        {c.creator_username || 'investigator'}
                      </td>
                      <td className="px-3.5 py-3">
                        <span className="px-2.5 py-0.5 rounded-full text-[9px] font-bold uppercase bg-emerald-50 text-emerald-700 border border-emerald-200">
                          {c.status}
                        </span>
                      </td>
                      <td className="px-3.5 py-3 text-right space-x-1.5">
                        <button
                          onClick={() => handleDownloadDossier(c.id)}
                          disabled={downloadingCaseId === c.id}
                          className="px-2.5 py-1 rounded-lg bg-white hover:bg-slate-50 text-emerald-700 border border-[#E2E8F0] shadow-sm transition-colors text-[10px] inline-flex items-center space-x-1"
                          title="Download 5-asset court dossier (.ZIP)"
                        >
                          <Download className="h-2.5 w-2.5" />
                          <span>{downloadingCaseId === c.id ? 'ZIP...' : 'Court ZIP'}</span>
                        </button>
                        <button
                          onClick={() => handleViewCase(c.id)}
                          className="px-2.5 py-1 rounded-lg bg-white hover:bg-slate-50 text-[#0F172A] border border-[#E2E8F0] shadow-sm transition-colors text-[10px]"
                        >
                          Dossier
                        </button>
                        <button
                          onClick={() => onOpenCaseInWorkspace(c.suspect_address, 3)}
                          className="px-3 py-1 rounded-lg bg-[#0284C7] hover:bg-[#0369A1] text-white font-bold shadow-sm transition-all text-[10px]"
                        >
                          Trace →
                        </button>
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={9} className="px-4 py-8 text-center text-[#64748B]">
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
        <div className="bg-white border border-[#E2E8F0] rounded-b-xl shadow-sm p-4 space-y-4 font-mono">
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[#E2E8F0] pb-3">
            <div className="flex items-center space-x-2">
              <History className="h-4 w-4 text-[#0284C7]" />
              <h3 className="text-xs uppercase font-bold text-[#0F172A] tracking-wider">
                Immutable Law Enforcement Audit Log (Total: {auditTotal || auditLogs.length})
              </h3>
            </div>

            <div className="flex items-center space-x-2">
              <span className="text-[10px] text-[#64748B]">Filter Action:</span>
              <select
                value={actionFilter}
                onChange={(e) => setActionFilter(e.target.value)}
                className="px-3 py-1 bg-[#F8FAFC] border border-[#E2E8F0] focus:border-[#0284C7] rounded-lg text-[#0F172A] text-[10px] focus:outline-none"
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
                className="p-1.5 rounded-lg bg-white hover:bg-slate-50 text-[#0F172A] border border-[#E2E8F0] shadow-sm transition-colors"
                title="Refresh Audit Logs"
              >
                <RefreshCw className={`h-3 w-3 ${isLoading ? 'animate-spin text-[#0284C7]' : ''}`} />
              </button>
            </div>
          </div>

          <div className="border border-[#E2E8F0] rounded-xl overflow-hidden max-h-[600px] overflow-y-auto">
            <table className="w-full text-left text-[11px]">
              <thead className="bg-[#F8FAFC] text-[#64748B] uppercase text-[10px] border-b border-[#E2E8F0] sticky top-0">
                <tr>
                  <th className="px-3.5 py-3">Timestamp (UTC)</th>
                  <th className="px-3.5 py-3">Officer</th>
                  <th className="px-3.5 py-3">Action</th>
                  <th className="px-3.5 py-3">Resource Type</th>
                  <th className="px-3.5 py-3">Case / Resource Ref</th>
                  <th className="px-3.5 py-3">IP Address</th>
                  <th className="px-3.5 py-3">Event Parameters</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#E2E8F0]">
                {auditLogs.length > 0 ? (
                  auditLogs.map((log) => (
                    <tr key={log.id} className="hover:bg-[#F8FAFC] transition-colors">
                      <td className="px-3.5 py-3 text-[#64748B] text-[10px]">
                        {new Date(log.timestamp).toISOString().replace('T', ' ').slice(0, 19)}
                      </td>
                      <td className="px-3.5 py-3 font-bold text-[#0F172A]">
                        {log.username}
                      </td>
                      <td className="px-3.5 py-3">
                        <span className={`px-2 py-0.5 rounded-full font-bold text-[9px] uppercase border ${log.action.includes('CREATE') || log.action.includes('START')
                          ? 'bg-sky-50 text-[#0284C7] border-sky-200'
                          : log.action.includes('DISCLOSURE')
                            ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                            : log.action.includes('REPORT')
                              ? 'bg-rose-50 text-rose-700 border-rose-200'
                              : 'bg-[#F1F5F9] text-[#64748B] border-[#E2E8F0]'
                          }`}>
                          {log.action}
                        </span>
                      </td>
                      <td className="px-3.5 py-3 uppercase text-[10px] text-[#64748B]">
                        {log.resource_type}
                      </td>
                      <td className="px-3.5 py-3 text-[#0F172A] font-bold">
                        {log.case_id || log.resource_id || 'N/A'}
                      </td>
                      <td className="px-3.5 py-3 text-[#64748B] text-[10px]">
                        {log.ip_address || '127.0.0.1'}
                      </td>
                      <td className="px-3.5 py-3 text-[#64748B] text-[10px] max-w-[220px] truncate">
                        {JSON.stringify(log.details)}
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={7} className="px-4 py-8 text-center text-[#64748B]">
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
          <div className="bg-white border border-[#E2E8F0] rounded-xl p-5 space-y-3 shadow-sm">
            <h3 className="text-xs font-bold text-[#0F172A] uppercase tracking-wider flex items-center space-x-2">
              <Activity className="h-4 w-4 text-[#0284C7]" />
              <span>Case Risk &amp; Priority Distribution</span>
            </h3>
            <div className="space-y-3 pt-2">
              {[
                { label: 'CRITICAL PRIORITY', count: criticalCasesCount, color: 'bg-rose-600', text: 'text-rose-600 font-bold' },
                { label: 'HIGH PRIORITY', count: highCasesCount, color: 'bg-rose-400', text: 'text-rose-500 font-semibold' },
                { label: 'MEDIUM PRIORITY', count: cases.filter(c => c.priority === 'MEDIUM').length, color: 'bg-amber-500', text: 'text-amber-600 font-semibold' },
                { label: 'LOW PRIORITY', count: cases.filter(c => c.priority === 'LOW').length, color: 'bg-emerald-500', text: 'text-emerald-600 font-semibold' },
              ].map((p, idx) => (
                <div key={idx} className="space-y-1.5">
                  <div className="flex items-center justify-between text-[11px]">
                    <span className={p.text}>{p.label}</span>
                    <span className="font-bold text-[#0F172A]">{p.count} Cases</span>
                  </div>
                  <div className="w-full bg-[#F1F5F9] h-2 rounded-full overflow-hidden border border-[#E2E8F0]">
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
          <div className="bg-white border border-[#E2E8F0] rounded-xl p-5 space-y-3 shadow-sm">
            <h3 className="text-xs font-bold text-[#0F172A] uppercase tracking-wider flex items-center space-x-2">
              <Layers className="h-4 w-4 text-[#0284C7]" />
              <span>Multi-Chain Off-Ramp Distribution</span>
            </h3>
            <div className="space-y-3 pt-2">
              {[
                { chain: 'Ethereum Mainnet (EVM)', count: cases.filter(c => c.chain === 'ethereum').length, color: 'bg-[#0284C7]' },
                { chain: 'Tron Network (TRC-20 USDT)', count: cases.filter(c => c.chain === 'tron').length, color: 'bg-emerald-500' },
                { chain: 'Bitcoin Network (BTC UTXO)', count: cases.filter(c => c.chain === 'bitcoin').length, color: 'bg-amber-500' },
              ].map((c, idx) => (
                <div key={idx} className="space-y-1.5">
                  <div className="flex items-center justify-between text-[11px]">
                    <span className="text-[#0F172A]">{c.chain}</span>
                    <span className="font-bold text-[#0F172A]">{c.count} Target Wallets</span>
                  </div>
                  <div className="w-full bg-[#F1F5F9] h-2 rounded-full overflow-hidden border border-[#E2E8F0]">
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
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white border border-[#E2E8F0] rounded-2xl w-full max-w-2xl max-h-[85vh] flex flex-col shadow-2xl overflow-hidden font-mono text-xs">
            <div className="p-4 border-b border-[#E2E8F0] flex items-center justify-between bg-[#F8FAFC]">
              <div className="flex items-center space-x-2">
                <FolderOpen className="h-4 w-4 text-[#0284C7]" />
                <h3 className="font-bold text-[#0F172A] uppercase">
                  Case Dossier: {selectedCaseDetail.id}
                </h3>
              </div>
              <button
                onClick={() => setSelectedCaseDetail(null)}
                className="text-[#64748B] hover:text-[#0F172A] p-1.5 rounded-lg hover:bg-slate-100 transition-colors"
              >
                ✕
              </button>
            </div>

            <div className="p-5 space-y-4 overflow-y-auto flex-1">
              <div className="grid grid-cols-2 gap-3 text-[11px]">
                <div>
                  <span className="text-[#64748B] block uppercase text-[10px]">Title</span>
                  <strong className="text-[#0F172A]">{selectedCaseDetail.title}</strong>
                </div>
                <div>
                  <span className="text-[#64748B] block uppercase text-[10px]">Suspect Address</span>
                  <strong className="text-[#0284C7] break-all">{selectedCaseDetail.suspect_address}</strong>
                </div>
                <div>
                  <span className="text-[#64748B] block uppercase text-[10px]">Chain Rail</span>
                  <strong className="text-[#0F172A] uppercase">{selectedCaseDetail.chain}</strong>
                </div>
                <div>
                  <span className="text-[#64748B] block uppercase text-[10px]">Reported Loss</span>
                  <strong className="text-[#0F172A]">₹{(selectedCaseDetail.victim_loss_inr || 0).toLocaleString('en-IN')}</strong>
                </div>
                <div>
                  <span className="text-[#64748B] block uppercase text-[10px]">NCRP Ref</span>
                  <strong className="text-[#0F172A]">{selectedCaseDetail.ncrp_complaint_id || 'None'}</strong>
                </div>
                <div>
                  <span className="text-[#64748B] block uppercase text-[10px]">Assigned Officer</span>
                  <strong className="text-[#0F172A]">{selectedCaseDetail.creator_username || 'investigator'}</strong>
                </div>
              </div>

              {selectedCaseDetail.description && (
                <div className="p-3 bg-[#F8FAFC] border border-[#E2E8F0] rounded-xl text-[11px] text-[#64748B]">
                  {selectedCaseDetail.description}
                </div>
              )}

              {/* Case-Specific Audit Timeline */}
              <div className="space-y-2 pt-2 border-t border-[#E2E8F0]">
                <span className="text-[10px] uppercase font-bold text-[#64748B]">
                  Case Audit Timeline ({selectedCaseDetail.audit_trail?.length || 0} events)
                </span>
                <div className="space-y-1.5 max-h-40 overflow-y-auto">
                  {selectedCaseDetail.audit_trail?.map((a, idx) => (
                    <div key={idx} className="p-2.5 bg-[#F8FAFC] rounded-lg border border-[#E2E8F0] text-[10px] flex items-center justify-between">
                      <span className="text-[#0284C7] font-bold">{a.action}</span>
                      <span className="text-[#64748B]">{a.username} • {new Date(a.timestamp).toLocaleTimeString()}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            <div className="p-4 border-t border-[#E2E8F0] bg-[#F8FAFC] flex justify-between items-center">
              <button
                onClick={() => handleDownloadDossier(selectedCaseDetail.id)}
                disabled={downloadingCaseId === selectedCaseDetail.id}
                className="px-3.5 py-1.5 rounded-lg bg-white hover:bg-slate-50 text-emerald-700 font-bold text-[11px] border border-[#E2E8F0] flex items-center space-x-1.5 transition-colors shadow-sm"
              >
                <Download className="h-3.5 w-3.5" />
                <span>{downloadingCaseId === selectedCaseDetail.id ? 'Exporting Court Dossier...' : 'Download Court Dossier (.ZIP)'}</span>
              </button>

              <div className="flex space-x-2">
                <button
                  onClick={() => setSelectedCaseDetail(null)}
                  className="px-3.5 py-1.5 rounded-lg bg-white hover:bg-slate-50 text-[#0F172A] border border-[#E2E8F0] transition-colors"
                >
                  Close
                </button>
                <button
                  onClick={() => {
                    const addr = selectedCaseDetail.suspect_address;
                    setSelectedCaseDetail(null);
                    onOpenCaseInWorkspace(addr, 3);
                  }}
                  className="px-4 py-1.5 rounded-lg bg-[#0284C7] hover:bg-[#0369A1] text-white font-bold transition-all shadow-sm"
                >
                  Open in Workspace &amp; Trace →
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
