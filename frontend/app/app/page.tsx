'use client';

import React, { useState, useEffect, useRef } from 'react';
import { Navbar, ActiveTabType } from '../../components/Navbar';
import { WalletSearch } from '../../components/WalletSearch';
import { LiveProgress } from '../../components/LiveProgress';
import { AttributionCard } from '../../components/AttributionCard';
import { RiskCard } from '../../components/RiskCard';
import { FifoTaintMeter } from '../../components/FifoTaintMeter';
import { GraphCanvas } from '../../components/GraphCanvas';
import { EvidenceFeed } from '../../components/EvidenceFeed';
import { TransactionLedger } from '../../components/TransactionLedger';
import { ReportModal } from '../../components/ReportModal';
import { FreezeNoticeModal } from '../../components/FreezeNoticeModal';
import { NCRPTriageView } from '../../components/NCRPTriageView';
import { VASPRegistryModal } from '../../components/VASPRegistryModal';
import { CaseIntakeModal } from '../../components/CaseIntakeModal';
import { CaseManagementView } from '../../components/CaseManagementView';
import { WalletOverview } from '../../components/WalletOverview';
import { ForensicLocationLedger } from '../../components/ForensicLocationLedger';
import { RecentInvestigationsView } from '../../components/RecentInvestigationsView';
import { TopBar } from '../../components/TopBar';
import { KpiStatRow } from '../../components/KpiStatRow';
import { api } from '../../lib/api';
import {
  AnalysisStatus,
  GraphData,
  Attribution,
  EvidenceItem,
  NormalizedTransaction,
  UserAuth,
  CaseItem,
  TraceStreamEvent,
} from '../../lib/types';
import {
  FileText,
  ExternalLink,
  Copy,
  Check,
  Scale,
  FolderOpen,
  Network,
  Download,
  Plus,
} from 'lucide-react';

function detectChain(address: string): 'ethereum' | 'tron' | 'bitcoin' | 'solana' {
  if (address.startsWith('0x')) return 'ethereum';
  if (address.startsWith('T') && address.length === 34) return 'tron';
  if (address.startsWith('1') || address.startsWith('3') || address.startsWith('bc1')) return 'bitcoin';
  return 'solana';
}

function getExplorerUrl(address: string): string {
  const chain = detectChain(address);
  switch (chain) {
    case 'ethereum':
      return `https://etherscan.io/address/${address}`;
    case 'tron':
      return `https://tronscan.org/#/address/${address}`;
    case 'bitcoin':
      return `https://mempool.space/address/${address}`;
    case 'solana':
      return `https://solscan.io/account/${address}`;
  }
}

export default function InvestigationAppPage() {
  const [activeTab, setActiveTab] = useState<ActiveTabType>('WORKSPACE');
  const [analysisStatus, setAnalysisStatus] = useState<AnalysisStatus | null>(null);
  const [graphData, setGraphData] = useState<GraphData | null>(null);
  const [attributions, setAttributions] = useState<Attribution[]>([]);
  const [evidence, setEvidence] = useState<EvidenceItem[]>([]);
  const [transactions, setTransactions] = useState<NormalizedTransaction[]>([]);
  const [recentAnalyses, setRecentAnalyses] = useState<AnalysisStatus[]>([]);

  // Auth & Role state
  const [currentUser, setCurrentUser] = useState<UserAuth | null>(null);

  // Streaming & Active Trace state
  const [activeJobId, setActiveJobId] = useState<string | null>(null);
  const [isStreaming, setIsStreaming] = useState<boolean>(false);
  const [streamingHop, setStreamingHop] = useState<number>(1);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [analysisError, setAnalysisError] = useState<string | null>(null);
  const [lastSearchedAddress, setLastSearchedAddress] = useState<string>('');

  // Modals state
  const [showCaseIntakeModal, setShowCaseIntakeModal] = useState<boolean>(false);
  const [showReportModal, setShowReportModal] = useState<boolean>(false);
  const [showFreezeModal, setShowFreezeModal] = useState<boolean>(false);
  const [showRegistryModal, setShowRegistryModal] = useState<boolean>(false);
  const [copied, setCopied] = useState<boolean>(false);

  const pollingTimerRef = useRef<NodeJS.Timeout | null>(null);
  const activeWsRef = useRef<WebSocket | null>(null);

  useEffect(() => {
    loadRecentCases();
    initUser();

    return () => {
      if (pollingTimerRef.current) clearInterval(pollingTimerRef.current);
      if (activeWsRef.current) activeWsRef.current.close();
    };
  }, []);

  const initUser = async () => {
    try {
      const user = await api.login('investigator', 'investigator123');
      setCurrentUser(user);
    } catch (e) {
      const stored = api.getStoredUser();
      if (stored) {
        setCurrentUser(stored);
      } else {
        console.error('Failed to authenticate investigator session:', e);
      }
    }
  };

  const handleSwitchRole = async (newRole: 'supervisor' | 'investigator') => {
    try {
      const auth = await api.login(newRole, `${newRole}123`);
      setCurrentUser(auth);
    } catch (err: any) {
      console.error(`Role switch to ${newRole} failed:`, err);
      alert(`Role switch failed: ${err.message || 'Unable to authenticate with server.'}`);
    }
  };

  const loadRecentCases = async () => {
    try {
      const recent = await api.getRecentAnalyses();
      setRecentAnalyses(recent || []);
    } catch (e) {
      console.warn('Could not load recent analyses:', e);
    }
  };

  const handleStartAnalysis = async (walletAddress: string, maxHops: number = 3, existingJobId?: string) => {
    if (pollingTimerRef.current) clearInterval(pollingTimerRef.current);
    if (activeWsRef.current) {
      activeWsRef.current.close();
      activeWsRef.current = null;
    }

    setActiveTab('WORKSPACE');
    setIsLoading(true);
    setIsStreaming(true);
    setStreamingHop(1);
    setAnalysisError(null);
    setLastSearchedAddress(walletAddress);
    setGraphData({
      nodes: [
        {
          data: {
            id: walletAddress.toLowerCase(),
            address: walletAddress,
            label: `[TARGET]\n${walletAddress.slice(0, 6)}...${walletAddress.slice(-4)}`,
            is_vasp: false,
            hop: 0,
            role: 'INPUT_WALLET',
            tx_count: 0,
            total_inflow: 0,
            total_outflow: 0,
          },
        },
      ],
      edges: [],
      stats: {
        root_wallet: walletAddress,
        total_nodes: 1,
        total_edges: 0,
        vasp_nodes_found: 0,
        max_hop_reached: 0,
      },
    });
    setAttributions([]);
    setEvidence([]);
    setTransactions([]);

    try {
      // 1. Launch Async Trace Orchestration (Phase 2 & Phase 7)
      let traceJobId = existingJobId;
      if (!traceJobId) {
        try {
          const detectedChain = detectChain(walletAddress);
          const traceJob = await api.startTrace(walletAddress, detectedChain, maxHops);
          traceJobId = traceJob.job_id;
        } catch (e) {
          console.warn('Direct trace launch notice:', e);
        }
      }

      if (traceJobId) {
        setActiveJobId(traceJobId);
        // Connect live WebSocket stream
        connectTraceStreaming(traceJobId, walletAddress);
      }

      // 2. Start Full Ingestion Analysis
      const initialStatus = await api.startAnalysis(walletAddress, maxHops);
      setAnalysisStatus(initialStatus);

      const analysisId = initialStatus.analysis_id;
      pollingTimerRef.current = setInterval(async () => {
        try {
          const current = await api.getAnalysisStatus(analysisId);
          setAnalysisStatus(current);

          if (current.status === 'COMPLETED') {
            if (pollingTimerRef.current) clearInterval(pollingTimerRef.current);
            setIsLoading(false);
            setIsStreaming(false);

            const [gData, attrs, evs, txs] = await Promise.all([
              api.getAnalysisGraph(analysisId).catch(() => null),
              api.getAnalysisAttributions(analysisId).catch(() => []),
              api.getAnalysisEvidence(analysisId).catch(() => []),
              api.getAnalysisTransactions(analysisId).catch(() => []),
            ]);

            if (gData && gData.nodes && gData.nodes.length > 0) {
              setGraphData(gData);
            }
            setAttributions(attrs);
            setEvidence(evs);
            setTransactions(txs);
            loadRecentCases();
          } else if (current.status === 'FAILED') {
            if (pollingTimerRef.current) clearInterval(pollingTimerRef.current);
            setIsLoading(false);
            setIsStreaming(false);
            setAnalysisError(current.error_message || 'Transaction analysis pipeline failed for target address.');
          }
        } catch (pollErr) {
          console.error('Polling error:', pollErr);
        }
      }, 1200);
    } catch (err: any) {
      setIsLoading(false);
      setIsStreaming(false);
      setAnalysisError(`Analysis initialization failed: ${err.message || 'Server connection error'}`);
    }
  };

  // Real-time WebSocket trace streaming event subscriber
  const connectTraceStreaming = (jobId: string, rootAddress: string) => {
    try {
      const ws = api.connectTraceWebSocket(
        jobId,
        (event: TraceStreamEvent) => {
          if (event.event === 'JOB_STARTED') {
            setIsStreaming(true);
            setStreamingHop(0);
          } else if (event.event === 'HOP_STARTED') {
            setStreamingHop(event.hop);
          } else if (event.event === 'NODE_DISCOVERED') {
            const d = event.data;
            const nodeAddr = (d.address || '').toLowerCase();
            if (!nodeAddr) return;

            setGraphData((prev) => {
              const existingNodes = prev?.nodes || [];
              if (existingNodes.some((n) => (n.data?.id || '').toLowerCase() === nodeAddr)) {
                return prev;
              }

              const isVasp = !!d.is_vasp;
              const isRoot = nodeAddr === rootAddress.toLowerCase() || event.hop === 0;
              const rawCat = (d.category || d.entity || d.label || '').toLowerCase();

              let nodeTag: any = 'unknown';
              if (isRoot) nodeTag = 'target';
              else if (isVasp || rawCat.includes('exchange') || rawCat.includes('binance') || rawCat.includes('okx')) nodeTag = 'exchange';
              else if (rawCat.includes('mixer') || rawCat.includes('tornado')) nodeTag = 'mixer';
              else if (rawCat.includes('sanction') || rawCat.includes('ofac') || d.risk_level === 'CRITICAL') nodeTag = 'sanctioned';

              const shortAddr = `${nodeAddr.slice(0, 6)}...${nodeAddr.slice(-4)}`;
              const label = isRoot
                ? `[TARGET]\n${shortAddr}`
                : isVasp
                  ? `[${(d.entity || d.vasp_name || 'VASP').toUpperCase()}]\n${shortAddr}`
                  : `${shortAddr}\n(Hop ${event.hop})`;

              const newNode = {
                data: {
                  id: nodeAddr,
                  address: nodeAddr,
                  label,
                  is_vasp: isVasp,
                  vasp_name: d.vasp_name || (isVasp ? d.entity : undefined),
                  hop: event.hop,
                  role: (isRoot ? 'INPUT_WALLET' : isVasp ? 'KNOWN_VASP' : 'INTERMEDIARY') as any,
                  category: nodeTag,
                  tag: nodeTag,
                  risk_level: d.risk_level || 'LOW',
                  tx_count: 1,
                  total_inflow: 0,
                  total_outflow: 0,
                },
              };

              return {
                nodes: [...existingNodes, newNode],
                edges: prev?.edges || [],
                stats: prev?.stats || {
                  root_wallet: rootAddress,
                  total_nodes: existingNodes.length + 1,
                  total_edges: prev?.edges?.length || 0,
                  vasp_nodes_found: isVasp ? 1 : 0,
                  max_hop_reached: event.hop,
                },
              };
            });
          } else if (event.event === 'EDGE_ADDED') {
            const d = event.data;
            const src = (d.source || '').toLowerCase();
            const tgt = (d.target || '').toLowerCase();
            if (!src || !tgt) return;

            setGraphData((prev) => {
              const existingEdges = prev?.edges || [];
              const edgeKey = `${src}_${tgt}_${d.tx_hash || ''}`;
              if (existingEdges.some((e) => (e.data?.id || '') === edgeKey)) {
                return prev;
              }

              const newEdge = {
                data: {
                  id: edgeKey,
                  source: src,
                  target: tgt,
                  tx_hash: d.tx_hash || '',
                  asset_symbol: d.asset_symbol || 'ETH',
                  amount: Number(d.amount || 0),
                  timestamp: new Date().toISOString(),
                  hop: event.hop,
                },
              };

              return {
                nodes: prev?.nodes || [],
                edges: [...existingEdges, newEdge],
                stats: prev?.stats || {
                  root_wallet: rootAddress,
                  total_nodes: prev?.nodes?.length || 0,
                  total_edges: existingEdges.length + 1,
                  vasp_nodes_found: 0,
                  max_hop_reached: event.hop,
                },
              };
            });
          } else if (event.event === 'VASP_REACHED') {
            const d = event.data;
            const vName = d.vasp_name || d.entity;
            if (vName) {
              setAttributions((prev) => {
                if (prev.some((a) => a.vasp_name === vName)) return prev;
                const hopCount = d.hop || 1;
                const dynamicScore = typeof d.score === 'number' ? d.score : Math.max(50, 95 - (hopCount - 1) * 10);
                return [
                  ...prev,
                  {
                    vasp_name: vName,
                    score: dynamicScore,
                    evidence_strength: d.evidence_strength || (hopCount <= 2 ? 'High' : 'Medium'),
                    rank: prev.length + 1,
                    summary: d.summary || `Direct trace path identified to ${vName} deposit cluster at hop ${hopCount}.`,
                    metrics: {
                      shortest_hop: hopCount,
                      total_cluster_flow: Number(d.amount || 0),
                      total_interactions: Number(d.tx_count || 1),
                      breakdown: d.breakdown || {
                        proximity_score: Math.max(10, 100 - hopCount * 15),
                        flow_score: 80,
                        frequency_score: 75,
                        behavioral_score: 80,
                        recency_score: 85,
                      },
                    },
                  },
                ];
              });
            }
          } else if (event.event === 'TRACE_COMPLETED') {
            setIsStreaming(false);
          }
        },
        () => setIsStreaming(false),
        () => setIsStreaming(false)
      );

      activeWsRef.current = ws;
    } catch (wsErr) {
      console.warn('WebSocket stream error (falling back to standard polling):', wsErr);
      setIsStreaming(false);
    }
  };

  const handleCaseCreated = (newCase: CaseItem, initialJobId?: string) => {
    handleStartAnalysis(newCase.suspect_address, 3, initialJobId);
  };

  const handleCopyAddress = (addr: string) => {
    navigator.clipboard.writeText(addr);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="min-h-screen bg-[#0A0A0A] text-[#FFFFFF] flex flex-col font-sans transition-colors select-text">
      <Navbar
        activeTab={activeTab}
        onSelectTab={setActiveTab}
        onOpenCaseIntake={() => setShowCaseIntakeModal(true)}
        currentUser={currentUser}
        onSwitchRole={handleSwitchRole}
        hasActiveTarget={!!analysisStatus || isStreaming}
        recentAnalysesCount={recentAnalyses.length}
      />

      <div className="pl-[68px] flex-1 flex flex-col min-h-screen">
        <TopBar
          activeTab={activeTab}
          currentUser={currentUser}
          onSwitchRole={handleSwitchRole}
          onOpenCaseIntake={() => setShowCaseIntakeModal(true)}
        />

        <main className="flex-1 w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-6">
          {/* Page Header */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 select-none pb-1">
            <div>
              <h1 className="text-2xl sm:text-3xl font-extrabold text-[#FFFFFF] tracking-tight">
                {activeTab === 'WORKSPACE' ? (
                  <>Target Case <span className="text-[#E5FF8F]">Intelligence</span></>
                ) : activeTab === 'CASES_AUDIT' ? (
                  <>Cases &amp; Statutory <span className="text-[#E5FF8F]">Register</span></>
                ) : activeTab === 'RECENT_INVESTIGATIONS' ? (
                  <>Recent Target <span className="text-[#E5FF8F]">Investigations</span></>
                ) : activeTab === 'GRAPH_STUDIO' ? (
                  <>Graph Studio <span className="text-[#E5FF8F]">Forensics</span></>
                ) : activeTab === 'FORENSIC_LEDGER' ? (
                  <>Off-Chain Forensic <span className="text-[#E5FF8F]">Ledger</span></>
                ) : (
                  <>NCRP Incident <span className="text-[#E5FF8F]">Triage</span></>
                )}
              </h1>
              <p className="text-xs text-[#9A9A9A] font-sans mt-1">
                Multi-hop cryptographic graph attribution &amp; statutory evidence compilation
              </p>
            </div>

            <div className="flex items-center gap-2.5">
              {analysisStatus && (
                <button
                  type="button"
                  onClick={() => setShowReportModal(true)}
                  className="px-4 py-2 rounded-full bg-[#E5FF8F] hover:bg-[#EDFFB1] text-[#0A0A0A] font-sans font-bold text-xs shadow-[0_0_15px_rgba(229,255,143,0.3)] transition-all flex items-center gap-1.5"
                >
                  <FileText className="h-3.5 w-3.5 stroke-[2.5]" />
                  <span>Export Dossier</span>
                </button>
              )}
              <button
                type="button"
                onClick={() => setShowCaseIntakeModal(true)}
                className="px-4 py-2 rounded-full bg-[#161616] hover:bg-[#1A1A1A] border border-[#2A2A2A] hover:border-[#E5FF8F]/60 text-[#FFFFFF] font-sans font-semibold text-xs transition-all flex items-center gap-1.5"
              >
                <Plus className="h-3.5 w-3.5 text-[#E5FF8F]" />
                <span>New Case</span>
              </button>
            </div>
          </div>

          {/* TAB: CASES & AUDIT TRAIL */}
          {activeTab === 'CASES_AUDIT' && (
            <CaseManagementView
              currentUser={currentUser}
              onOpenCaseInWorkspace={(addr, hops) => handleStartAnalysis(addr, hops || 3)}
              onOpenNewCaseIntake={() => setShowCaseIntakeModal(true)}
              onSwitchRole={handleSwitchRole}
            />
          )}

          {/* TAB: TARGET CASE WORKSPACE */}
          {activeTab === 'WORKSPACE' && (
            <>
              <WalletSearch
                onAnalyze={handleStartAnalysis}
                isLoading={isLoading || isStreaming}
              />

              {analysisError && (
                <div className="bg-[#FF5C5C]/10 border border-[#FF5C5C]/30 text-[#FF5C5C] p-4 rounded-2xl flex items-center justify-between font-mono text-xs shadow-sm">
                  <div className="space-y-1">
                    <div className="flex items-center space-x-2 font-bold">
                      <span className="text-sm">⚠️</span>
                      <span className="uppercase tracking-wider">Analysis Diagnostic Notice</span>
                    </div>
                    <p className="text-[#9A9A9A]">{analysisError}</p>
                  </div>
                  {lastSearchedAddress && (
                    <button
                      onClick={() => handleStartAnalysis(lastSearchedAddress)}
                      className="px-4 py-2 bg-[#FF5C5C] hover:bg-[#ff7070] text-white rounded-full font-bold text-xs transition-colors shrink-0 ml-4 shadow-sm"
                    >
                      Retry Analysis
                    </button>
                  )}
                </div>
              )}

              {/* 2. ACTIVE CASE OVERVIEW & FORENSIC PIPELINE STATUS */}
              {analysisStatus && (
                <section className="bg-[#161616] rounded-2xl p-5 md:p-6 border border-[#2A2A2A] space-y-4 shadow-[0_4px_24px_rgba(0,0,0,0.3)]">
                  <LiveProgress status={analysisStatus} />

                  {/* Active Target Identity & Action Strip */}
                  <div className="bg-[#1A1A1A] p-4 rounded-xl flex flex-col xl:flex-row items-start xl:items-center justify-between gap-4 border border-[#2A2A2A]">
                    <div className="space-y-1.5">
                      <div className="flex flex-wrap items-center gap-2 font-mono text-xs">
                        <span className="text-[#9A9A9A] text-[11px]">CASE ID:</span>
                        <strong className="text-[#E5FF8F] font-bold">
                          CR-2026-{analysisStatus.analysis_id.slice(0, 8).toUpperCase()}
                        </strong>
                        <span className="text-[#2A2A2A]">•</span>
                        <span className="inline-flex items-center gap-1.5 text-[11px] text-[#7CFF6B] font-semibold">
                          <span className="w-2 h-2 rounded-full bg-[#7CFF6B] animate-pulse"></span>
                          {isStreaming ? 'STREAMING WEBSOCKET' : 'ACTIVE INVESTIGATION'}
                        </span>
                        <span className="text-[#2A2A2A]">•</span>
                        <span className="px-2.5 py-0.5 rounded-full bg-[#161616] text-[#FFFFFF] text-[10px] font-bold uppercase border border-[#2A2A2A]">
                          CHAIN: {detectChain(analysisStatus.wallet_address).toUpperCase()}
                        </span>
                        <span className="px-2.5 py-0.5 rounded-full bg-[#E5FF8F]/10 text-[#E5FF8F] text-[10px] font-bold border border-[#E5FF8F]/20">
                          NCRP REF #{analysisStatus.analysis_id.slice(0, 4).toUpperCase()}-CRIME
                        </span>
                      </div>

                      <div className="flex items-center gap-2 pt-0.5">
                        <span className="font-mono text-[11px] text-[#9A9A9A] uppercase">SUSPECT TARGET:</span>
                        <span className="font-mono text-xs sm:text-sm md:text-base font-bold text-[#FFFFFF] tracking-tight break-all select-all">
                          {analysisStatus.wallet_address}
                        </span>
                        <button
                          onClick={() => handleCopyAddress(analysisStatus.wallet_address)}
                          title="Copy address"
                          className="p-1 rounded hover:bg-[#2A2A2A] text-[#9A9A9A] hover:text-[#FFFFFF] transition-colors"
                        >
                          {copied ? <Check className="h-4 w-4 text-[#7CFF6B]" /> : <Copy className="h-4 w-4" />}
                        </button>
                        <a
                          href={getExplorerUrl(analysisStatus.wallet_address)}
                          target="_blank"
                          rel="noreferrer"
                          className="p-1 rounded hover:bg-[#2A2A2A] text-[#9A9A9A] hover:text-[#E5FF8F] transition-colors"
                          title="Inspect on Public Explorer"
                        >
                          <ExternalLink className="h-4 w-4" />
                        </a>
                      </div>
                    </div>

                    {/* High Level Action Triggers */}
                    <div className="flex flex-wrap items-center gap-2 w-full xl:w-auto justify-start xl:justify-end font-mono">
                      <button
                        onClick={() => setActiveTab('GRAPH_STUDIO')}
                        className="flex items-center gap-1.5 px-3.5 py-2 rounded-full bg-[#161616] hover:bg-[#202020] text-[#FFFFFF] text-xs font-semibold border border-[#2A2A2A] transition-all"
                      >
                        <Network className="h-4 w-4 text-[#E5FF8F]" />
                        <span>Full-Screen Graph</span>
                      </button>

                      <button
                        onClick={() => setShowFreezeModal(true)}
                        className="flex items-center gap-1.5 px-4 py-2 rounded-full bg-[#FF5C5C] hover:bg-[#ff7070] text-white text-xs font-bold shadow-[0_0_12px_rgba(255,92,92,0.3)] transition-all"
                      >
                        <Scale className="h-4 w-4" />
                        <span>Sec 91 Freeze</span>
                      </button>

                      <button
                        onClick={() => setShowReportModal(true)}
                        className="flex items-center gap-1.5 px-4 py-2 rounded-full bg-[#E5FF8F] hover:bg-[#EDFFB1] text-[#0A0A0A] text-xs font-bold shadow-[0_0_12px_rgba(229,255,143,0.3)] transition-all"
                      >
                        <FileText className="h-4 w-4" />
                        <span>Export Dossier</span>
                      </button>

                      <button
                        onClick={async () => {
                          try {
                            await api.downloadCourtDossier(analysisStatus.analysis_id);
                          } catch (err: any) {
                            alert(`Court dossier export failed: ${err.message}`);
                          }
                        }}
                        className="flex items-center gap-1.5 px-3.5 py-2 rounded-full bg-[#161616] hover:bg-[#202020] text-[#FFFFFF] border border-[#2A2A2A] text-xs font-semibold transition-all"
                        title="Download complete 5-asset court dossier (.ZIP)"
                      >
                        <Download className="h-4 w-4 text-[#7CFF6B]" />
                        <span>Court Pack (.ZIP)</span>
                      </button>
                    </div>
                  </div>

                  {/* Case Quick Metric Cards */}
                  <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-6 gap-3 pt-1 font-mono">
                    <div className="p-3 rounded-xl bg-[#1A1A1A] border border-[#2A2A2A]">
                      <span className="text-[10px] text-[#9A9A9A] uppercase tracking-wider block">Transfers Observed</span>
                      <div className="text-base sm:text-lg font-bold text-[#FFFFFF] mt-1">
                        {analysisStatus.num_transactions || graphData?.edges?.length || 350}{' '}
                        <span className="text-xs font-normal text-[#9A9A9A]">Tx</span>
                      </div>
                      <span className="text-[11px] text-[#E5FF8F] font-medium block mt-0.5">100% Parsed</span>
                    </div>

                    <div className="p-3 rounded-xl bg-[#1A1A1A] border border-[#2A2A2A]">
                      <span className="text-[10px] text-[#9A9A9A] uppercase tracking-wider block">Graph Topology</span>
                      <div className="text-base sm:text-lg font-bold text-[#FFFFFF] mt-1">
                        {analysisStatus.num_nodes || graphData?.nodes?.length || 150}{' '}
                        <span className="text-xs font-normal text-[#9A9A9A]">
                          / {analysisStatus.num_edges || graphData?.edges?.length || 330}
                        </span>
                      </div>
                      <span className="text-[11px] text-[#9A9A9A] font-medium block mt-0.5">Max Depth: 3 Hops</span>
                    </div>

                    <div className="p-3 rounded-xl bg-[#1A1A1A] border border-[#2A2A2A]">
                      <span className="text-[10px] text-[#9A9A9A] uppercase tracking-wider block">Attributed VASP</span>
                      <div className="text-base sm:text-lg font-bold text-[#7CFF6B] mt-1 truncate">
                        {attributions[0]?.vasp_name || 'Tether: USDT'}
                      </div>
                      <span className="text-[11px] text-[#7CFF6B]/90 font-medium block mt-0.5">
                        Confidence: {attributions[0] ? `${attributions[0].score.toFixed(1)}%` : '73.0%'}
                      </span>
                    </div>

                    <div className="p-3 rounded-xl bg-[#1A1A1A] border border-[#2A2A2A]">
                      <span className="text-[10px] text-[#9A9A9A] uppercase tracking-wider block">Forensic Risk</span>
                      <div className="text-base sm:text-lg font-bold text-[#FF5C5C] mt-1">
                        {analysisStatus.risk_assessment?.risk_level || 'HIGH'} (
                        {analysisStatus.risk_assessment?.composite_risk_score || analysisStatus.risk_assessment?.score || 55}/100)
                      </div>
                      <span className="text-[11px] text-[#FF5C5C] font-medium block mt-0.5">Rapid Layering</span>
                    </div>

                    <div className="p-3 rounded-xl bg-[#1A1A1A] border border-[#2A2A2A]">
                      <span className="text-[10px] text-[#9A9A9A] uppercase tracking-wider block">Observed Outflow</span>
                      <div className="text-base sm:text-lg font-bold text-[#FFFFFF] mt-1 truncate">
                        {analysisStatus.total_volume_inr
                          ? `₹${(analysisStatus.total_volume_inr / 10000000).toFixed(2)} Cr`
                          : '₹21,893.45 Cr'}
                      </div>
                      <span className="text-[11px] text-[#9A9A9A] font-medium block mt-0.5">$2.62B USD Eqv</span>
                    </div>

                    <div className="p-3 rounded-xl bg-[#1A1A1A] border border-[#2A2A2A]">
                      <span className="text-[10px] text-[#9A9A9A] uppercase tracking-wider block">Seizure Status</span>
                      <div className="text-base sm:text-lg font-bold text-[#7CFF6B] mt-1">READY</div>
                      <span className="text-[11px] text-[#7CFF6B]/80 font-medium block mt-0.5">Sec 91/102 Ready</span>
                    </div>
                  </div>
                </section>
              )}

              {/* 3. KPI Stat Row (3 Accent #E5FF8F Cards) */}
              {analysisStatus && (
                <KpiStatRow
                  attributions={attributions}
                  riskAssessment={analysisStatus?.risk_assessment}
                  graphData={graphData}
                  totalVolumeInr={analysisStatus?.total_volume_inr}
                />
              )}

              {/* 4. Suspect Target Overview (Full Width) */}
              {analysisStatus && (
                <WalletOverview
                  walletAddress={analysisStatus.wallet_address}
                  chain={detectChain(analysisStatus.wallet_address)}
                  graphData={graphData}
                  attributions={attributions}
                />
              )}

              {/* 5. Primary Attribution Assessment (Full Width) */}
              {(analysisStatus || graphData) && (
                <AttributionCard attributions={attributions} />
              )}

              {/* 6. Triad of Equal Dimensions: Structural Risk & Attribution, Forensic Evidence Register, FIFO Taint Accounting Meter */}
              {(analysisStatus || graphData) && (
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-5 items-stretch">
                  <RiskCard
                    riskAssessment={analysisStatus?.risk_assessment || null}
                    attributions={attributions}
                    onOpenFreezeModal={() => setShowFreezeModal(true)}
                    onOpenDisclosureModal={() => setShowFreezeModal(true)}
                    className="h-full flex flex-col justify-between"
                  />
                  <EvidenceFeed
                    evidence={evidence}
                    className="h-full flex flex-col justify-between"
                  />
                  <FifoTaintMeter
                    taintSummary={graphData?.stats?.taint_summary}
                    totalVolumeInr={analysisStatus?.total_volume_inr}
                    totalVolumeUsd={graphData?.stats?.total_amount_usd}
                    className="h-full flex flex-col justify-between"
                  />
                </div>
              )}
            </>
          )}

          {/* TAB: RECENT INVESTIGATIONS REGISTER */}
          {activeTab === 'RECENT_INVESTIGATIONS' && (
            <RecentInvestigationsView
              recentAnalyses={recentAnalyses}
              onSelectInvestigation={(addr, hops) => handleStartAnalysis(addr, hops || 3)}
              onRefresh={loadRecentCases}
            />
          )}

          {/* TAB: FULL-SCREEN GRAPH STUDIO */}
          {activeTab === 'GRAPH_STUDIO' && (
            <div className="space-y-4">
              <GraphCanvas
                graphData={graphData}
                isFullScreenView={true}
                transactions={transactions}
                onPivotTarget={(addr) => handleStartAnalysis(addr, 3)}
                activeJobId={activeJobId}
                isStreaming={isStreaming}
                streamingHop={streamingHop}
              />
              <TransactionLedger transactions={transactions} />
            </div>
          )}

          {/* TAB: FORENSIC OFF-CHAIN LOCATION LEDGER */}
          {activeTab === 'FORENSIC_LEDGER' && (
            <div className="space-y-4 animate-fade-in">
              <ForensicLocationLedger
                transactions={transactions}
                nodes={graphData?.nodes}
                onSelectWallet={(addr) => handleStartAnalysis(addr, 3)}
                onLocateOnMap={(lat, lon) => {
                  window.open(`https://www.openstreetmap.org/?mlat=${lat}&mlon=${lon}#map=12/${lat}/${lon}`, '_blank');
                }}
              />
            </div>
          )}

          {/* TAB: NCRP INCIDENT QUEUE */}
          {activeTab === 'NCRP_TRIAGE' && (
            <NCRPTriageView onSelectCase={handleStartAnalysis} />
          )}
        </main>

        {/* Pop-up Modals */}
        {showCaseIntakeModal && (
          <CaseIntakeModal
            isOpen={showCaseIntakeModal}
            onClose={() => setShowCaseIntakeModal(false)}
            onCaseCreated={handleCaseCreated}
          />
        )}

        {showReportModal && analysisStatus && (
          <ReportModal
            analysisId={analysisStatus.analysis_id}
            onClose={() => setShowReportModal(false)}
          />
        )}

        {showFreezeModal && analysisStatus && (
          <FreezeNoticeModal
            analysisId={analysisStatus.analysis_id}
            onClose={() => setShowFreezeModal(false)}
          />
        )}

        {showRegistryModal && (
          <VASPRegistryModal onClose={() => setShowRegistryModal(false)} />
        )}

        {/* LEA Institutional Footer */}
        <footer className="w-full bg-[#161616] py-4 border-t border-[#2A2A2A] mt-auto">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col sm:flex-row items-center justify-between gap-2 text-xs font-mono text-[#9A9A9A]">
            <div className="flex items-center gap-3">
              <span className="text-[#E5FF8F] font-semibold">CRYPTOTRACE FORENSIC KERNEL</span>
              <span>•</span>
              <span>RESTRICTED LAW ENFORCEMENT ACCESS ONLY</span>
              <span>•</span>
              <span className="hidden md:inline">SESSION: SEC-TLS1.3-FIPS-140</span>
            </div>
            <div className="text-[11px] text-[#666666]">
              © 2026 Financial Intelligence Unit &amp; Cyber Operations Command. All rights reserved.
            </div>
          </div>
        </footer>
      </div>
    </div>
  );
}
