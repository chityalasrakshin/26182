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
      <div className="bg-[#161616] border border-[#2A2A2A] rounded-2xl p-5 shadow-sm flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div className="flex items-center space-x-3.5">
          <div className="w-11 h-11 rounded-xl bg-[#E5FF8F]/10 border border-[#E5FF8F]/20 flex items-center justify-center text-[#E5FF8F] shrink-0 shadow-sm">
            <Briefcase className="h-6 w-6" />
          </div>
          <div>
            <div className="flex items-center space-x-2.5">
              <h2 className="text-base font-bold text-[#FFFFFF] tracking-wide uppercase font-mono">
                Law Enforcement Case Register &amp; Audit Trail
              </h2>
              <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-mono font-bold uppercase border ${isSupervisor
                ? 'bg-[#E5FF8F]/10 text-[#E5FF8F] border-[#E5FF8F]/20'
                : 'bg-[#7CFF6B]/10 text-[#7CFF6B] border-[#7CFF6B]/20'
                }`}>
                {isSupervisor ? 'SUPERVISOR ROLE (ALL CASES)' : 'INVESTIGATOR ROLE (ASSIGNED CASES)'}
              </span>
            </div>
            <p className="text-xs text-[#9A9A9A] font-sans pt-0.5">
              Court-admissible case management with immutable cryptographic audit logging (Rule 6 compliant).
            </p>
          </div>
        </div>

        <div className="flex items-center space-x-2">
          {onSwitchRole && (
            <div className="flex items-center bg-[#1A1A1A] border border-[#2A2A2A] rounded-full p-1 font-mono text-[10px]">
              <span className="px-2.5 text-[#9A9A9A] font-semibold">Role:</span>
              <button
                onClick={() => onSwitchRole('supervisor')}
                className={`px-3 py-1 rounded-full transition-colors ${isSupervisor
                  ? 'bg-[#E5FF8F] text-[#0A0A0A] font-bold'
                  : 'text-[#9A9A9A] hover:text-[#FFFFFF]'
                  }`}
              >
                Supervisor
              </button>
              <button
                onClick={() => onSwitchRole('investigator')}
                className={`px-3 py-1 rounded-full transition-colors ${!isSupervisor
                  ? 'bg-[#E5FF8F] text-[#0A0A0A] font-bold'
                  : 'text-[#9A9A9A] hover:text-[#FFFFFF]'
                  }`}
              >
                Investigator
              </button>
            </div>
          )}

          <button
            onClick={onOpenNewCaseIntake}
            className="flex items-center space-x-1.5 px-4 py-2 bg-[#E5FF8F] hover:bg-[#EDFFB1] text-[#0A0A0A] font-bold rounded-full shadow transition-all font-mono text-xs"
          >
            <Plus className="h-3.5 w-3.5" />
            <span>New Case Intake</span>
          </button>
        </div>
      </div>

      {error && (
        <div className="p-3 bg-[#FF5C5C]/10 border border-[#FF5C5C]/30 rounded-2xl text-[#FF5C5C] text-xs font-mono flex items-center justify-between">
          <span>Database connection or authentication error: {error}</span>
          <button onClick={loadData} className="underline hover:text-white font-bold">Retry</button>
        </div>
      )}

      {/* Cross-case Analytical Metrics Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 font-mono">
        <div className="bg-[#161616] border border-[#2A2A2A] rounded-2xl p-4 space-y-1">
          <span className="text-[10px] text-[#9A9A9A] uppercase tracking-wider block">
            Active Cases
          </span>
          <div className="text-xl font-bold text-[#FFFFFF] flex items-baseline justify-between">
            <span>{cases.length}</span>
            <span className="text-[10px] text-[#7CFF6B] font-normal">{openCasesCount} Open</span>
          </div>
        </div>

        <div className="bg-[#161616] border border-[#2A2A2A] rounded-2xl p-4 space-y-1">
          <span className="text-[10px] text-[#9A9A9A] uppercase tracking-wider block">
            Reported Loss Traced
          </span>
          <div className="text-xl font-bold text-[#FFFFFF] flex items-baseline justify-between">
            <span>₹{(totalVolumeInr / 100000).toFixed(1)} Lakh</span>
            <span className="text-[10px] text-[#9A9A9A] font-normal">INR Volume</span>
          </div>
        </div>

        <div className="bg-[#161616] border border-[#2A2A2A] rounded-2xl p-4 space-y-1">
          <span className="text-[10px] text-[#9A9A9A] uppercase tracking-wider block">
            Critical / High Priority
          </span>
          <div className="text-xl font-bold text-[#FF5C5C] flex items-baseline justify-between">
            <span>{criticalCasesCount + highCasesCount}</span>
            <span className="text-[10px] text-[#FF5C5C] font-normal">{criticalCasesCount} Critical</span>
          </div>
        </div>

        <div className="bg-[#161616] border border-[#2A2A2A] rounded-2xl p-4 space-y-1">
          <span className="text-[10px] text-[#9A9A9A] uppercase tracking-wider block">
            Audit Logged Actions
          </span>
          <div className="text-xl font-bold text-[#E5FF8F] flex items-baseline justify-between">
            <span>{auditTotal || auditLogs.length}</span>
            <span className="text-[10px] text-[#7CFF6B] font-normal">Chain-of-Custody</span>
          </div>
        </div>
      </div>

      {/* Sub-Navigation Switcher */}
      <div className="flex border-b border-[#2A2A2A] bg-[#161616] px-4 pt-2 rounded-t-2xl font-mono text-xs gap-2">
        <button
          onClick={() => setActiveSubTab('cases')}
          className={`pb-3 px-4 font-semibold border-b-2 transition-colors flex items-center space-x-2 ${activeSubTab === 'cases'
            ? 'border-[#E5FF8F] text-[#E5FF8F]'
            : 'border-transparent text-[#9A9A9A] hover:text-[#FFFFFF]'
            }`}
        >
          <FolderOpen className="h-3.5 w-3.5" />
          <span>Case Files ({cases.length})</span>
        </button>

        <button
          onClick={() => setActiveSubTab('audit')}
          className={`pb-3 px-4 font-semibold border-b-2 transition-colors flex items-center space-x-2 ${activeSubTab === 'audit'
            ? 'border-[#E5FF8F] text-[#E5FF8F]'
            : 'border-transparent text-[#9A9A9A] hover:text-[#FFFFFF]'
            }`}
        >
          <Lock className="h-3.5 w-3.5" />
          <span>Statutory Audit Trail ({auditTotal || auditLogs.length})</span>
        </button>

        <button
          onClick={() => setActiveSubTab('analytics')}
          className={`pb-3 px-4 font-semibold border-b-2 transition-colors flex items-center space-x-2 ${activeSubTab === 'analytics'
            ? 'border-[#E5FF8F] text-[#E5FF8F]'
            : 'border-transparent text-[#9A9A9A] hover:text-[#FFFFFF]'
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
        <div className="bg-[#161616] border border-[#2A2A2A] rounded-b-2xl shadow-sm p-4 space-y-4 font-mono">
          {/* Filters Bar */}
          <div className="flex flex-wrap items-center justify-between gap-2.5">
            <div className="flex items-center space-x-2 flex-1 min-w-[240px] max-w-md">
              <div className="relative w-full">
                <Search className="absolute left-3 top-2.5 h-3.5 w-3.5 text-[#9A9A9A]" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && loadData()}
                  placeholder="Search case ID, title, or suspect address..."
                  className="w-full pl-9 pr-4 py-2 bg-[#1A1A1A] border border-[#2A2A2A] focus:border-[#E5FF8F] rounded-full text-[#FFFFFF] placeholder-[#666666] text-xs focus:outline-none"
                />
              </div>
              <button
                onClick={loadData}
                className="p-2 rounded-full bg-[#1A1A1A] hover:bg-[#252525] text-[#FFFFFF] border border-[#2A2A2A] transition-colors"
                title="Refresh Cases"
              >
                <RefreshCw className={`h-3.5 w-3.5 ${isLoading ? 'animate-spin text-[#E5FF8F]' : ''}`} />
              </button>
            </div>

            <div className="flex flex-wrap items-center gap-2 text-[11px]">
              {/* Status Filter */}
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="px-3 py-1.5 bg-[#1A1A1A] border border-[#2A2A2A] focus:border-[#E5FF8F] rounded-full text-[#FFFFFF] focus:outline-none"
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
                className="px-3 py-1.5 bg-[#1A1A1A] border border-[#2A2A2A] focus:border-[#E5FF8F] rounded-full text-[#FFFFFF] focus:outline-none"
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
                className="px-3 py-1.5 bg-[#1A1A1A] border border-[#2A2A2A] focus:border-[#E5FF8F] rounded-full text-[#FFFFFF] focus:outline-none"
              >
                <option value="ALL">Chain: All</option>
                <option value="ethereum">Ethereum Mainnet</option>
                <option value="tron">Tron TRC-20</option>
                <option value="bitcoin">Bitcoin</option>
              </select>
            </div>
          </div>

          {/* Cases Table */}
          <div className="border border-[#2A2A2A] rounded-xl overflow-hidden">
            <table className="w-full text-left text-[11px]">
              <thead className="bg-[#1A1A1A] text-[#9A9A9A] uppercase text-[10px] border-b border-[#2A2A2A]">
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
              <tbody className="divide-y divide-[#2A2A2A]">
                {cases.length > 0 ? (
                  cases.map((c) => (
                    <tr key={c.id} className="hover:bg-[#1A1A1A]/60 transition-colors">
                      <td className="px-3.5 py-3 font-bold text-[#FFFFFF]">
                        {c.id}
                      </td>
                      <td className="px-3.5 py-3">
                        <span className={`px-2.5 py-0.5 rounded-full font-bold text-[9px] uppercase border ${c.priority === 'CRITICAL' || c.priority === 'HIGH'
                          ? 'bg-[#FF5C5C]/10 text-[#FF5C5C] border-[#FF5C5C]/30'
                          : c.priority === 'MEDIUM'
                            ? 'bg-[#E5D34F]/10 text-[#E5D34F] border-[#E5D34F]/30'
                            : 'bg-[#7CFF6B]/10 text-[#7CFF6B] border-[#7CFF6B]/30'
                          }`}>
                          {c.priority}
                        </span>
                      </td>
                      <td className="px-3.5 py-3">
                        <div className="font-semibold text-[#FFFFFF] truncate max-w-[180px]">
                          {c.title}
                        </div>
                        {c.ncrp_complaint_id && (
                          <div className="text-[10px] text-[#9A9A9A]">
                            Ref: {c.ncrp_complaint_id}
                          </div>
                        )}
                      </td>
                      <td className="px-3.5 py-3">
                        <div className="flex items-center space-x-1.5">
                          <span className="text-[#FFFFFF] font-bold font-mono">
                            {c.suspect_address.slice(0, 6)}...{c.suspect_address.slice(-4)}
                          </span>
                          <button
                            onClick={() => handleCopy(c.suspect_address)}
                            className="p-1 text-[#9A9A9A] hover:text-[#FFFFFF] transition-colors"
                            title="Copy address"
                          >
                            {copiedAddress === c.suspect_address ? (
                              <Check className="h-3 w-3 text-[#7CFF6B]" />
                            ) : (
                              <Copy className="h-3 w-3" />
                            )}
                          </button>
                        </div>
                      </td>
                      <td className="px-3.5 py-3 uppercase text-[10px] text-[#E5FF8F] font-semibold">
                        {c.chain}
                      </td>
                      <td className="px-3.5 py-3 text-[#FFFFFF] font-mono">
                        ₹{(c.victim_loss_inr || 0).toLocaleString('en-IN')}
                      </td>
                      <td className="px-3.5 py-3 text-[#9A9A9A]">
                        {c.creator_username || 'investigator'}
                      </td>
                      <td className="px-3.5 py-3">
                        <span className="px-2.5 py-0.5 rounded-full text-[9px] font-bold uppercase bg-[#7CFF6B]/10 text-[#7CFF6B] border border-[#7CFF6B]/30">
                          {c.status}
                        </span>
                      </td>
                      <td className="px-3.5 py-3 text-right space-x-1.5">
                        <button
                          onClick={() => handleDownloadDossier(c.id)}
                          disabled={downloadingCaseId === c.id}
                          className="px-2.5 py-1 rounded-full bg-[#1A1A1A] hover:bg-[#252525] text-[#7CFF6B] border border-[#2A2A2A] transition-colors text-[10px] inline-flex items-center space-x-1"
                          title="Download 5-asset court dossier (.ZIP)"
                        >
                          <Download className="h-2.5 w-2.5" />
                          <span>{downloadingCaseId === c.id ? 'ZIP...' : 'Court ZIP'}</span>
                        </button>
                        <button
                          onClick={() => handleViewCase(c.id)}
                          className="px-2.5 py-1 rounded-full bg-[#1A1A1A] hover:bg-[#252525] text-[#FFFFFF] border border-[#2A2A2A] transition-colors text-[10px]"
                        >
                          Dossier
                        </button>
                        <button
                          onClick={() => onOpenCaseInWorkspace(c.suspect_address, 3)}
                          className="px-3 py-1 rounded-full bg-[#E5FF8F] hover:bg-[#EDFFB1] text-[#0A0A0A] font-bold transition-all text-[10px]"
                        >
                          Trace →
                        </button>
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={9} className="px-4 py-8 text-center text-[#9A9A9A]">
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
        <div className="bg-[#161616] border border-[#2A2A2A] rounded-b-2xl shadow-sm p-4 space-y-4 font-mono">
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[#2A2A2A] pb-3">
            <div className="flex items-center space-x-2">
              <History className="h-4 w-4 text-[#E5FF8F]" />
              <h3 className="text-xs uppercase font-bold text-[#FFFFFF] tracking-wider">
                Immutable Law Enforcement Audit Log (Total: {auditTotal || auditLogs.length})
              </h3>
            </div>

            <div className="flex items-center space-x-2">
              <span className="text-[10px] text-[#9A9A9A]">Filter Action:</span>
              <select
                value={actionFilter}
                onChange={(e) => setActionFilter(e.target.value)}
                className="px-3 py-1 bg-[#1A1A1A] border border-[#2A2A2A] focus:border-[#E5FF8F] rounded-full text-[#FFFFFF] text-[10px] focus:outline-none"
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
                className="p-1.5 rounded-full bg-[#1A1A1A] hover:bg-[#252525] text-[#FFFFFF] border border-[#2A2A2A] transition-colors"
                title="Refresh Audit Logs"
              >
                <RefreshCw className={`h-3 w-3 ${isLoading ? 'animate-spin text-[#E5FF8F]' : ''}`} />
              </button>
            </div>
          </div>

          <div className="border border-[#2A2A2A] rounded-xl overflow-hidden max-h-[600px] overflow-y-auto">
            <table className="w-full text-left text-[11px]">
              <thead className="bg-[#1A1A1A] text-[#9A9A9A] uppercase text-[10px] border-b border-[#2A2A2A] sticky top-0">
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
              <tbody className="divide-y divide-[#2A2A2A]">
                {auditLogs.length > 0 ? (
                  auditLogs.map((log) => (
                    <tr key={log.id} className="hover:bg-[#1A1A1A]/60 transition-colors">
                      <td className="px-3.5 py-3 text-[#9A9A9A] text-[10px]">
                        {new Date(log.timestamp).toISOString().replace('T', ' ').slice(0, 19)}
                      </td>
                      <td className="px-3.5 py-3 font-bold text-[#FFFFFF]">
                        {log.username}
                      </td>
                      <td className="px-3.5 py-3">
                        <span className={`px-2 py-0.5 rounded-full font-bold text-[9px] uppercase border ${log.action.includes('CREATE') || log.action.includes('START')
                          ? 'bg-[#E5FF8F]/10 text-[#E5FF8F] border-[#E5FF8F]/30'
                          : log.action.includes('DISCLOSURE')
                            ? 'bg-[#7CFF6B]/10 text-[#7CFF6B] border-[#7CFF6B]/30'
                            : log.action.includes('REPORT')
                              ? 'bg-[#FF5C5C]/10 text-[#FF5C5C] border-[#FF5C5C]/30'
                              : 'bg-[#1A1A1A] text-[#9A9A9A] border-[#2A2A2A]'
                          }`}>
                          {log.action}
                        </span>
                      </td>
                      <td className="px-3.5 py-3 uppercase text-[10px] text-[#9A9A9A]">
                        {log.resource_type}
                      </td>
                      <td className="px-3.5 py-3 text-[#FFFFFF] font-bold">
                        {log.case_id || log.resource_id || 'N/A'}
                      </td>
                      <td className="px-3.5 py-3 text-[#9A9A9A] text-[10px]">
                        {log.ip_address || '127.0.0.1'}
                      </td>
                      <td className="px-3.5 py-3 text-[#9A9A9A] text-[10px] max-w-[220px] truncate">
                        {JSON.stringify(log.details)}
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={7} className="px-4 py-8 text-center text-[#9A9A9A]">
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
          <div className="bg-[#161616] border border-[#2A2A2A] rounded-2xl p-5 space-y-3 shadow-sm">
            <h3 className="text-xs font-bold text-[#FFFFFF] uppercase tracking-wider flex items-center space-x-2">
              <Activity className="h-4 w-4 text-[#E5FF8F]" />
              <span>Case Risk &amp; Priority Distribution</span>
            </h3>
            <div className="space-y-3 pt-2">
              {[
                { label: 'CRITICAL PRIORITY', count: criticalCasesCount, color: 'bg-[#FF5C5C]', text: 'text-[#FF5C5C]' },
                { label: 'HIGH PRIORITY', count: highCasesCount, color: 'bg-[#FF7070]', text: 'text-[#FF7070]' },
                { label: 'MEDIUM PRIORITY', count: cases.filter(c => c.priority === 'MEDIUM').length, color: 'bg-[#E5D34F]', text: 'text-[#E5D34F]' },
                { label: 'LOW PRIORITY', count: cases.filter(c => c.priority === 'LOW').length, color: 'bg-[#7CFF6B]', text: 'text-[#7CFF6B]' },
              ].map((p, idx) => (
                <div key={idx} className="space-y-1.5">
                  <div className="flex items-center justify-between text-[11px]">
                    <span className={p.text}>{p.label}</span>
                    <span className="font-bold text-[#FFFFFF]">{p.count} Cases</span>
                  </div>
                  <div className="w-full bg-[#1A1A1A] h-2 rounded-full overflow-hidden border border-[#2A2A2A]">
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
          <div className="bg-[#161616] border border-[#2A2A2A] rounded-2xl p-5 space-y-3 shadow-sm">
            <h3 className="text-xs font-bold text-[#FFFFFF] uppercase tracking-wider flex items-center space-x-2">
              <Layers className="h-4 w-4 text-[#E5FF8F]" />
              <span>Multi-Chain Off-Ramp Distribution</span>
            </h3>
            <div className="space-y-3 pt-2">
              {[
                { chain: 'Ethereum Mainnet (EVM)', count: cases.filter(c => c.chain === 'ethereum').length, color: 'bg-[#2563EB]' },
                { chain: 'Tron Network (TRC-20 USDT)', count: cases.filter(c => c.chain === 'tron').length, color: 'bg-[#7CFF6B]' },
                { chain: 'Bitcoin Network (BTC UTXO)', count: cases.filter(c => c.chain === 'bitcoin').length, color: 'bg-[#E5D34F]' },
              ].map((c, idx) => (
                <div key={idx} className="space-y-1.5">
                  <div className="flex items-center justify-between text-[11px]">
                    <span className="text-[#FFFFFF]">{c.chain}</span>
                    <span className="font-bold text-[#FFFFFF]">{c.count} Target Wallets</span>
                  </div>
                  <div className="w-full bg-[#1A1A1A] h-2 rounded-full overflow-hidden border border-[#2A2A2A]">
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
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-4">
          <div className="bg-[#161616] border border-[#2A2A2A] rounded-2xl w-full max-w-2xl max-h-[85vh] flex flex-col shadow-2xl overflow-hidden font-mono text-xs">
            <div className="p-4 border-b border-[#2A2A2A] flex items-center justify-between bg-[#1A1A1A]/90 backdrop-blur-md">
              <div className="flex items-center space-x-2">
                <FolderOpen className="h-4 w-4 text-[#E5FF8F]" />
                <h3 className="font-bold text-[#FFFFFF] uppercase">
                  Case Dossier: {selectedCaseDetail.id}
                </h3>
              </div>
              <button
                onClick={() => setSelectedCaseDetail(null)}
                className="text-[#9A9A9A] hover:text-[#FFFFFF] p-1.5 rounded-full hover:bg-[#2A2A2A] transition-colors"
              >
                ✕
              </button>
            </div>

            <div className="p-5 space-y-4 overflow-y-auto flex-1">
              <div className="grid grid-cols-2 gap-3 text-[11px]">
                <div>
                  <span className="text-[#9A9A9A] block uppercase text-[10px]">Title</span>
                  <strong className="text-[#FFFFFF]">{selectedCaseDetail.title}</strong>
                </div>
                <div>
                  <span className="text-[#9A9A9A] block uppercase text-[10px]">Suspect Address</span>
                  <strong className="text-[#E5FF8F] break-all">{selectedCaseDetail.suspect_address}</strong>
                </div>
                <div>
                  <span className="text-[#9A9A9A] block uppercase text-[10px]">Chain Rail</span>
                  <strong className="text-[#FFFFFF] uppercase">{selectedCaseDetail.chain}</strong>
                </div>
                <div>
                  <span className="text-[#9A9A9A] block uppercase text-[10px]">Reported Loss</span>
                  <strong className="text-[#FFFFFF]">₹{(selectedCaseDetail.victim_loss_inr || 0).toLocaleString('en-IN')}</strong>
                </div>
                <div>
                  <span className="text-[#9A9A9A] block uppercase text-[10px]">NCRP Ref</span>
                  <strong className="text-[#FFFFFF]">{selectedCaseDetail.ncrp_complaint_id || 'None'}</strong>
                </div>
                <div>
                  <span className="text-[#9A9A9A] block uppercase text-[10px]">Assigned Officer</span>
                  <strong className="text-[#FFFFFF]">{selectedCaseDetail.creator_username || 'investigator'}</strong>
                </div>
              </div>

              {selectedCaseDetail.description && (
                <div className="p-3 bg-[#1A1A1A] border border-[#2A2A2A] rounded-xl text-[11px] text-[#9A9A9A]">
                  {selectedCaseDetail.description}
                </div>
              )}

              {/* Case-Specific Audit Timeline */}
              <div className="space-y-2 pt-2 border-t border-[#2A2A2A]">
                <span className="text-[10px] uppercase font-bold text-[#9A9A9A]">
                  Case Audit Timeline ({selectedCaseDetail.audit_trail?.length || 0} events)
                </span>
                <div className="space-y-1.5 max-h-40 overflow-y-auto">
                  {selectedCaseDetail.audit_trail?.map((a, idx) => (
                    <div key={idx} className="p-2.5 bg-[#1A1A1A] rounded-xl border border-[#2A2A2A] text-[10px] flex items-center justify-between">
                      <span className="text-[#E5FF8F] font-bold">{a.action}</span>
                      <span className="text-[#9A9A9A]">{a.username} • {new Date(a.timestamp).toLocaleTimeString()}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            <div className="p-4 border-t border-[#2A2A2A] bg-[#1A1A1A] flex justify-between items-center">
              <button
                onClick={() => handleDownloadDossier(selectedCaseDetail.id)}
                disabled={downloadingCaseId === selectedCaseDetail.id}
                className="px-3.5 py-1.5 rounded-full bg-[#161616] hover:bg-[#252525] text-[#7CFF6B] font-bold text-[11px] border border-[#2A2A2A] flex items-center space-x-1.5 transition-colors shadow-sm"
              >
                <Download className="h-3.5 w-3.5" />
                <span>{downloadingCaseId === selectedCaseDetail.id ? 'Exporting Court Dossier...' : 'Download Court Dossier (.ZIP)'}</span>
              </button>

              <div className="flex space-x-2">
                <button
                  onClick={() => setSelectedCaseDetail(null)}
                  className="px-3.5 py-1.5 rounded-full bg-[#161616] hover:bg-[#252525] text-[#FFFFFF] border border-[#2A2A2A] transition-colors"
                >
                  Close
                </button>
                <button
                  onClick={() => {
                    const addr = selectedCaseDetail.suspect_address;
                    setSelectedCaseDetail(null);
                    onOpenCaseInWorkspace(addr, 3);
                  }}
                  className="px-4 py-1.5 rounded-full bg-[#E5FF8F] hover:bg-[#EDFFB1] text-[#0A0A0A] font-bold transition-all"
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
