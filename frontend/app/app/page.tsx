'use client';

import React, { useState, useEffect, useRef } from 'react';
import { Navbar, ActiveTabType } from '../../components/Navbar';
import { TopBar } from '../../components/TopBar';
import { GraphCanvas } from '../../components/GraphCanvas';
import { InspectorSidebar } from '../../components/InspectorSidebar';
import { ComplianceOverviewView } from '../../components/ComplianceOverviewView';
import { ReportModal } from '../../components/ReportModal';
import { FreezeNoticeModal } from '../../components/FreezeNoticeModal';
import { NCRPTriageView } from '../../components/NCRPTriageView';
import { VASPRegistryModal } from '../../components/VASPRegistryModal';
import { CaseIntakeModal } from '../../components/CaseIntakeModal';
import { CaseManagementView } from '../../components/CaseManagementView';
import { ForensicLocationLedger } from '../../components/ForensicLocationLedger';
import { RecentInvestigationsView } from '../../components/RecentInvestigationsView';
import { TransactionLedger } from '../../components/TransactionLedger';
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
  Network,
  Download,
  Plus,
  Search,
  Radar,
  Activity,
  Layers,
  SlidersHorizontal,
  ChevronRight,
  Shield,
  Building2,
} from 'lucide-react';

function extractCleanAddress(input: string): string {
  if (!input) return '';
  const trimmed = input.trim();
  
  // EVM 0x address (case-insensitive)
  const ethMatch = trimmed.match(/0x[a-fA-F0-9]{40}/);
  if (ethMatch) return ethMatch[0];

  // Tron T... address (34 chars base58)
  const tronMatch = trimmed.match(/T[a-zA-Z0-9]{33}/);
  if (tronMatch) return tronMatch[0];

  // Bitcoin addresses (bc1... or 1... or 3...)
  const btcMatch = trimmed.match(/(?:bc1|[13])[a-zA-HJ-NP-Z0-9]{25,39}/);
  if (btcMatch) return btcMatch[0];

  // Solana base58 address
  const solMatch = trimmed.match(/[1-9A-HJ-NP-Za-km-z]{32,44}/);
  if (solMatch) return solMatch[0];

  return trimmed;
}

function detectChain(address: string): 'ethereum' | 'tron' | 'bitcoin' | 'solana' {
  const clean = extractCleanAddress(address);
  if (!clean) return 'ethereum';
  if (clean.startsWith('0x')) return 'ethereum';
  if (clean.startsWith('T') && clean.length === 34) return 'tron';
  if (clean.startsWith('1') || clean.startsWith('3') || clean.startsWith('bc1')) return 'bitcoin';
  return 'solana';
}

function getExplorerUrl(address: string): string {
  const clean = extractCleanAddress(address);
  const chain = detectChain(clean);
  switch (chain) {
    case 'ethereum':
      return `https://etherscan.io/address/${clean}`;
    case 'tron':
      return `https://tronscan.org/#/address/${clean}`;
    case 'bitcoin':
      return `https://mempool.space/address/${clean}`;
    case 'solana':
      return `https://solscan.io/account/${clean}`;
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

  // Selected node in Cytoscape for right-hand inspector
  const [selectedNode, setSelectedNode] = useState<any | null>(null);

  // Search input & parameters for Top Search HUD
  const [searchInput, setSearchInput] = useState<string>('');
  const [hops, setHops] = useState<number>(3);
  const [selectedChainFilter, setSelectedChainFilter] = useState<'ALL' | 'ETH' | 'TRX' | 'BTC' | 'SOL'>('ALL');

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

  const handleStartAnalysis = async (rawAddress: string, maxHops: number = 3, existingJobId?: string) => {
    const walletAddress = extractCleanAddress(rawAddress);
    if (!walletAddress) return;

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
    setSearchInput(walletAddress);
    setSelectedNode(null);

    // FLUSH old analysis state immediately to prevent showing stale wallet results
    setAnalysisStatus(null);
    setAttributions([]);
    setEvidence([]);
    setTransactions([]);

    // 1. Instantaneous pre-flight intelligence lookup from label store
    let preflight: any = null;
    try {
      preflight = await api.lookupAddress(walletAddress);
    } catch (e) {
      console.debug('Preflight lookup error:', e);
    }

    const isSanctioned = Boolean(preflight?.is_sanctioned);
    const isExploit = !isSanctioned && Boolean(preflight?.is_exploit || preflight?.category === 'exploit' || preflight?.category === 'hack');
    const entityName = preflight?.entity || preflight?.label || null;

    setGraphData({
      nodes: [
        {
          data: {
            id: walletAddress.toLowerCase(),
            address: walletAddress,
            label: isSanctioned
              ? `🚨 TARGET (SANCTIONED)\n${entityName ? entityName + '\n' : ''}${walletAddress.slice(0, 6)}...${walletAddress.slice(-4)}`
              : isExploit
              ? `⚠️ TARGET (EXPLOIT)\n${entityName ? entityName + '\n' : ''}${walletAddress.slice(0, 6)}...${walletAddress.slice(-4)}`
              : entityName
              ? `[TARGET: ${entityName}]\n${walletAddress.slice(0, 6)}...${walletAddress.slice(-4)}`
              : `[TARGET]\n${walletAddress.slice(0, 6)}...${walletAddress.slice(-4)}`,
            is_vasp: Boolean(preflight?.is_vasp),
            is_sanctioned: isSanctioned,
            is_exploit: isExploit,
            entity_name: entityName,
            category: preflight?.category || (isSanctioned ? 'sanctioned' : isExploit ? 'exploit' : null),
            risk_level: preflight?.risk_level || (isSanctioned || isExploit ? 'CRITICAL' : 'UNKNOWN'),
            is_mixer: Boolean(preflight?.is_mixer),
            sanctions_program: preflight?.notes || null,
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

    // If there is an existing completed analysis for this exact wallet in DB, load it instantaneously!
    if (preflight?.cached_analysis_id) {
      const cachedId = preflight.cached_analysis_id;
      try {
        const [cachedStatus, gData, attrs, evs, txs] = await Promise.all([
          api.getAnalysisStatus(cachedId).catch(() => null),
          api.getAnalysisGraph(cachedId).catch(() => null),
          api.getAnalysisAttributions(cachedId).catch(() => []),
          api.getAnalysisEvidence(cachedId).catch(() => []),
          api.getAnalysisTransactions(cachedId).catch(() => []),
        ]);
        if (cachedStatus && cachedStatus.status === 'COMPLETED') {
          setAnalysisStatus(cachedStatus);
          if (gData && gData.nodes && gData.nodes.length > 0) {
            setGraphData(gData);
          }
          setAttributions(attrs);
          setEvidence(evs);
          setTransactions(txs);
          setIsLoading(false);
          setIsStreaming(false);
          loadRecentCases();
          return;
        }
      } catch (cacheErr) {
        console.warn('Instant cache load skipped, continuing to fresh trace:', cacheErr);
      }
    }

    try {
      // 2. Launch Async Trace Orchestration
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
        connectTraceStreaming(traceJobId, walletAddress);
      }

      // 3. Start Full Ingestion Analysis
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
        (payload: TraceStreamEvent) => {
          handleTraceStreamMessage(payload, rootAddress);
        },
        (err) => {
          console.warn('[TraceStream] WebSocket error:', err);
        },
        () => {
          console.log(`[TraceStream] Connection closed for job ${jobId}`);
        }
      );
      activeWsRef.current = ws;
    } catch (e) {
      console.warn('[TraceStream] WebSocket subscription failed:', e);
    }
  };

  const handleTraceStreamMessage = (event: TraceStreamEvent, rootAddress: string) => {
    const eventType = ((event as any).type || event.event || '').toLowerCase();
    const data = event.data || (event as any);
    const hop = event.hop ?? (data?.hop || 1);

    if (eventType === 'hop_start' || eventType === 'hop_started') {
      setStreamingHop(hop);
    }

    if (eventType === 'hop_completed' || eventType === 'hop_done') {
      setStreamingHop(hop + 1);
      if (data.nodes && data.nodes.length > 0) {
        setGraphData((prev) => {
          if (!prev) return null;
          const existingIds = new Set(prev.nodes.map((n: any) => (n.data?.id || n.id).toLowerCase()));
          const newNodes = data.nodes
            .filter((n: any) => !existingIds.has((n.data?.id || n.id).toLowerCase()))
            .map((n: any) => (n.data ? n : { data: n }));

          const existingEdgeIds = new Set(prev.edges.map((e: any) => (e.data?.id || e.id || '')));
          const newEdges = (data.edges || [])
            .filter((e: any) => !existingEdgeIds.has(e.data?.id || e.id || ''))
            .map((e: any) => (e.data ? e : { data: e }));

          return {
            ...prev,
            nodes: [...prev.nodes, ...newNodes],
            edges: [...prev.edges, ...newEdges],
            stats: {
              ...prev.stats,
              total_nodes: prev.nodes.length + newNodes.length,
              total_edges: prev.edges.length + newEdges.length,
            },
          };
        });
      }
    }

    if (eventType === 'trace_completed' || eventType === 'trace_failed') {
      setIsStreaming(false);
      if (activeWsRef.current) {
        activeWsRef.current.close();
        activeWsRef.current = null;
      }
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

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const clean = extractCleanAddress(searchInput);
    if (!clean) return;
    setSearchInput(clean);
    handleStartAnalysis(clean, hops);
  };


  return (
    <div className="h-screen w-screen bg-[#F4F6F8] text-[#0F172A] flex flex-col font-sans transition-colors select-text overflow-hidden">
      {/* Left Navigation Rail */}
      <Navbar
        activeTab={activeTab}
        onSelectTab={setActiveTab}
        onOpenCaseIntake={() => setShowCaseIntakeModal(true)}
        currentUser={currentUser}
        onSwitchRole={handleSwitchRole}
        hasActiveTarget={!!analysisStatus || isStreaming}
        recentAnalysesCount={recentAnalyses.length}
      />

      {/* Main Content Area (Offset by left navbar 68px) */}
      <div className="pl-[68px] flex-1 flex flex-col h-screen overflow-hidden">
        {/* Top Header Bar */}
        <TopBar
          activeTab={activeTab}
          onSelectTab={setActiveTab}
          currentUser={currentUser}
          onSwitchRole={handleSwitchRole}
          onOpenCaseIntake={() => setShowCaseIntakeModal(true)}
        />

        {/* ════════════════════════════════════════════════════════════════ */}
        {/* TAB 1: WORKSPACE / INVESTIGATE (Chainalysis Reactor Split Layout) */}
        {/* ════════════════════════════════════════════════════════════════ */}
        {activeTab === 'WORKSPACE' && (
          <div className="flex-1 flex flex-row overflow-hidden w-full h-[calc(100vh-64px)]">
            {/* Left/Center Area: Canvas + Floating Top Search HUD */}
            <div className="flex-1 h-full relative overflow-hidden flex flex-col bg-[#F4F6F8]">
              {/* Top Search HUD */}
              <div className="bg-white border-b border-[#E2E8F0] px-4 py-2.5 flex flex-wrap items-center justify-between gap-3 shrink-0 text-xs font-mono shadow-2xs z-10">
                <form onSubmit={handleSearchSubmit} className="flex flex-1 items-center gap-2 max-w-3xl">
                  {/* Chain Selector Pills */}
                  <div className="flex items-center bg-[#F1F5F9] p-0.5 rounded-lg border border-[#E2E8F0] shrink-0">
                    {(['ALL', 'ETH', 'TRX', 'BTC', 'SOL'] as const).map((c) => (
                      <button
                        key={c}
                        type="button"
                        onClick={() => setSelectedChainFilter(c)}
                        className={`px-2.5 py-1 rounded text-[11px] font-bold transition-all ${
                          selectedChainFilter === c
                            ? 'bg-white text-[#0284C7] shadow-xs border border-[#E2E8F0]'
                            : 'text-[#64748B] hover:text-[#0F172A]'
                        }`}
                      >
                        {c}
                      </button>
                    ))}
                  </div>

                  {/* Search Input */}
                  <div className="relative flex-1">
                    <Search className="absolute left-3 top-2.5 h-3.5 w-3.5 text-[#94A3B8]" />
                    <input
                      type="text"
                      placeholder="Enter target wallet (0x...), Tron (T...), BTC, or Solana address..."
                      value={searchInput}
                      onChange={(e) => {
                        const val = e.target.value;
                        if (val.includes('http://') || val.includes('https://') || val.includes('etherscan.io') || val.includes('tronscan.org') || val.includes('mempool.space') || val.includes('solscan.io')) {
                          setSearchInput(extractCleanAddress(val));
                        } else {
                          setSearchInput(val);
                        }
                      }}
                      className="w-full bg-[#F8FAFC] border border-[#E2E8F0] rounded-lg pl-9 pr-3 py-1.5 text-xs text-[#0F172A] placeholder-[#94A3B8] focus:outline-none focus:border-[#0284C7] font-mono"
                    />
                  </div>

                  {/* Hop Selector */}
                  <div className="flex items-center gap-1.5 shrink-0 bg-[#F8FAFC] px-2.5 py-1.5 rounded-lg border border-[#E2E8F0]">
                    <span className="text-[10px] text-[#64748B] uppercase font-bold">Hops:</span>
                    <select
                      value={hops}
                      onChange={(e) => setHops(Number(e.target.value))}
                      className="bg-transparent text-xs font-bold text-[#0F172A] focus:outline-none cursor-pointer"
                    >
                      <option value={1}>1 Hop</option>
                      <option value={2}>2 Hops</option>
                      <option value={3}>3 Hops</option>
                      <option value={4}>4 Hops</option>
                    </select>
                  </div>

                  {/* Submit Button */}
                  <button
                    type="submit"
                    disabled={isLoading || isStreaming}
                    className="px-4 py-1.5 bg-[#0284C7] hover:bg-[#0369A1] text-white rounded-lg font-bold text-xs shadow-sm transition-all flex items-center gap-1.5 shrink-0 disabled:opacity-50"
                  >
                    {isLoading || isStreaming ? (
                      <>
                        <span className="w-3 h-3 border-2 border-white border-t-transparent rounded-full animate-spin"></span>
                        <span>Tracing...</span>
                      </>
                    ) : (
                      <>
                        <Network className="h-3.5 w-3.5" />
                        <span>Trace</span>
                      </>
                    )}
                  </button>
                </form>
              </div>

              {/* Analysis Diagnostic Notification Banner */}
              {analysisError && (
                <div className="bg-[#FEF2F2] border-b border-[#FECACA] text-[#DC2626] px-4 py-2 flex items-center justify-between font-mono text-xs shrink-0">
                  <div className="flex items-center space-x-2">
                    <span>⚠️</span>
                    <span>{analysisError}</span>
                  </div>
                  {lastSearchedAddress && (
                    <button
                      onClick={() => handleStartAnalysis(lastSearchedAddress, hops)}
                      className="px-2.5 py-1 bg-[#EF4444] text-white rounded text-[10px] font-bold"
                    >
                      Retry
                    </button>
                  )}
                </div>
              )}



              {/* Main Full-Height Graph Canvas */}
              <div className="flex-1 w-full h-full relative overflow-hidden">
                <GraphCanvas
                  graphData={graphData}
                  isFullScreenView={false}
                  transactions={transactions}
                  onPivotTarget={(addr) => {
                    const clean = extractCleanAddress(addr);
                    setSearchInput(clean);
                    handleStartAnalysis(clean, hops);
                  }}
                  activeJobId={activeJobId}
                  isStreaming={isStreaming}
                  streamingHop={streamingHop}
                  onSelectNode={(node) => setSelectedNode(node)}
                  className="h-full w-full rounded-none border-none"
                />
              </div>
            </div>

            {/* Right Inspector Sidebar Panel (Chainalysis Reactor Reference) */}
            <div className="w-[400px] xl:w-[440px] 2xl:w-[480px] h-full shrink-0 border-l border-[#E2E8F0] bg-white flex flex-col shadow-sm">
              <InspectorSidebar
                selectedNode={selectedNode}
                targetAddress={analysisStatus?.wallet_address || lastSearchedAddress || ''}
                analysisStatus={analysisStatus}
                attributions={attributions}
                evidence={evidence}
                transactions={transactions}
                graphData={graphData}
                onOpenReport={() => setShowReportModal(true)}
                onOpenFreeze={() => setShowFreezeModal(true)}
                onPivotTarget={(addr) => {
                  const clean = extractCleanAddress(addr);
                  setSearchInput(clean);
                  handleStartAnalysis(clean, hops);
                }}
                isStreaming={isStreaming}
              />
            </div>

          </div>
        )}

        {/* ════════════════════════════════════════════════════════════════ */}
        {/* TAB 2: COMPLIANCE / KYT OVERVIEW (Elliptic 2x2 Grid Reference)   */}
        {/* ════════════════════════════════════════════════════════════════ */}
        {activeTab === 'COMPLIANCE' && (
          <main className="flex-1 w-full overflow-y-auto bg-[#F4F6F8]">
            <ComplianceOverviewView
              onSelectEntity={(addr) => {
                setSearchInput(addr);
                handleStartAnalysis(addr, 3);
              }}
              onOpenReport={() => setShowReportModal(true)}
            />
          </main>
        )}

        {/* ════════════════════════════════════════════════════════════════ */}
        {/* TAB 3: CASES & AUDIT REGISTER                                   */}
        {/* ════════════════════════════════════════════════════════════════ */}
        {activeTab === 'CASES_AUDIT' && (
          <main className="flex-1 w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-6 overflow-y-auto">
            <CaseManagementView
              currentUser={currentUser}
              onOpenCaseInWorkspace={(addr, caseHops) => handleStartAnalysis(addr, caseHops || 3)}
              onOpenNewCaseIntake={() => setShowCaseIntakeModal(true)}
              onSwitchRole={handleSwitchRole}
            />
          </main>
        )}

        {/* ════════════════════════════════════════════════════════════════ */}
        {/* TAB 4: RECENT INVESTIGATIONS REGISTER                           */}
        {/* ════════════════════════════════════════════════════════════════ */}
        {activeTab === 'RECENT_INVESTIGATIONS' && (
          <main className="flex-1 w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-6 overflow-y-auto">
            <RecentInvestigationsView
              recentAnalyses={recentAnalyses}
              onSelectInvestigation={(addr, caseHops) => handleStartAnalysis(addr, caseHops || 3)}
              onRefresh={loadRecentCases}
            />
          </main>
        )}

        {/* ════════════════════════════════════════════════════════════════ */}
        {/* TAB 5: FULL-SCREEN GRAPH STUDIO                                 */}
        {/* ════════════════════════════════════════════════════════════════ */}
        {activeTab === 'GRAPH_STUDIO' && (
          <main className="flex-1 w-full p-4 overflow-y-auto space-y-4">
            <GraphCanvas
              graphData={graphData}
              isFullScreenView={false}
              transactions={transactions}
              onPivotTarget={(addr) => handleStartAnalysis(addr, 3)}
              activeJobId={activeJobId}
              isStreaming={isStreaming}
              streamingHop={streamingHop}
              onSelectNode={(node) => setSelectedNode(node)}
            />
            <TransactionLedger transactions={transactions} />
          </main>
        )}

        {/* ════════════════════════════════════════════════════════════════ */}
        {/* TAB 6: FORENSIC OFF-CHAIN LOCATION LEDGER                       */}
        {/* ════════════════════════════════════════════════════════════════ */}
        {activeTab === 'FORENSIC_LEDGER' && (
          <main className="flex-1 w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-6 overflow-y-auto animate-fade-in">
            <ForensicLocationLedger
              transactions={transactions}
              nodes={graphData?.nodes}
              onSelectWallet={(addr) => handleStartAnalysis(addr, 3)}
              onLocateOnMap={(lat, lon) => {
                window.open(`https://www.openstreetmap.org/?mlat=${lat}&mlon=${lon}#map=12/${lat}/${lon}`, '_blank');
              }}
            />
          </main>
        )}

        {/* ════════════════════════════════════════════════════════════════ */}
        {/* TAB 7: NCRP INCIDENT QUEUE                                      */}
        {/* ════════════════════════════════════════════════════════════════ */}
        {activeTab === 'NCRP_TRIAGE' && (
          <main className="flex-1 w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-6 overflow-y-auto">
            <NCRPTriageView onSelectCase={(addr) => handleStartAnalysis(addr, 3)} />
          </main>
        )}

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
      </div>
    </div>
  );
}
