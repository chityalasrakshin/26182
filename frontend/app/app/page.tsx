'use client';

import React, { useState, useEffect, useRef } from 'react';
import { Navbar, ActiveTabType } from '../../components/Navbar';
import { WalletSearch } from '../../components/WalletSearch';
import { LiveProgress } from '../../components/LiveProgress';
import { AttributionCard } from '../../components/AttributionCard';
import { RiskCard } from '../../components/RiskCard';
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
} from 'lucide-react';

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
    } catch {
      setCurrentUser({
        access_token: 'demo-token',
        token_type: 'bearer',
        role: newRole,
        username: newRole,
        full_name: newRole === 'supervisor' ? 'Senior Cyber Crime Supervisor' : 'Cyber Crime Investigating Officer',
      });
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
          const detectedChain = walletAddress.startsWith('0x') ? 'ethereum' : walletAddress.startsWith('T') ? 'tron' : 'bitcoin';
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
          }
        } catch (pollErr) {
          console.error('Polling error:', pollErr);
        }
      }, 1200);
    } catch (err: any) {
      setIsLoading(false);
      setIsStreaming(false);
      alert(`Analysis initialization failed: ${err.message}`);
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
                return [
                  ...prev,
                  {
                    vasp_name: vName,
                    score: 98.0,
                    evidence_strength: 'High',
                    rank: prev.length + 1,
                    summary: `Live trace path attributed to ${vName} deposit cluster in ${d.hop || 1} hops.`,
                    metrics: {
                      shortest_hop: d.hop || 1,
                      total_cluster_flow: 1000000,
                      total_interactions: 5,
                      breakdown: {
                        proximity_score: 95,
                        flow_score: 90,
                        frequency_score: 85,
                        behavioral_score: 92,
                        recency_score: 94,
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
    <div className="min-h-screen bg-forensic-bg text-forensic-text flex flex-col font-sans transition-colors">
      <Navbar
        activeTab={activeTab}
        onSelectTab={setActiveTab}
        onOpenCaseIntake={() => setShowCaseIntakeModal(true)}
        currentUser={currentUser}
        onSwitchRole={handleSwitchRole}
        hasActiveTarget={!!analysisStatus || isStreaming}
      />

      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 py-4 space-y-4">
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

            {analysisStatus && <LiveProgress status={analysisStatus} />}

            {analysisStatus && (
              <div className="bg-forensic-surface border border-forensic-border rounded p-3.5 shadow-sm text-xs font-mono transition-colors">
                <div className="flex flex-wrap items-center justify-between gap-3 border-b border-forensic-border pb-3">
                  <div className="space-y-1">
                    <div className="flex items-center space-x-3 text-[10px] text-forensic-textDim uppercase">
                      <span>CASE ID: <strong className="text-forensic-text">CR-2026-{analysisStatus.analysis_id.slice(0, 8).toUpperCase()}</strong></span>
                      <span>•</span>
                      <span>STATUS: <strong className="text-forensic-teal">{isStreaming ? 'STREAMING VIA WEBSOCKET' : 'ACTIVE INVESTIGATION'}</strong></span>
                      <span>•</span>
                      <span>CHAIN: <strong className="text-blue-500">{analysisStatus.wallet_address.startsWith('0x') ? 'ETHEREUM' : analysisStatus.wallet_address.startsWith('T') ? 'TRON' : 'BITCOIN'}</strong></span>
                    </div>

                    <div className="flex items-center space-x-2 pt-0.5">
                      <span className="text-sm font-bold text-forensic-text break-all select-all">
                        {analysisStatus.wallet_address}
                      </span>
                      <button
                        onClick={() => handleCopyAddress(analysisStatus.wallet_address)}
                        title="Copy address"
                        className="p-1 hover:text-forensic-text text-forensic-textDim"
                      >
                        {copied ? <Check className="h-3.5 w-3.5 text-forensic-teal" /> : <Copy className="h-3.5 w-3.5" />}
                      </button>
                      <a
                        href={
                          analysisStatus.wallet_address.startsWith('0x')
                            ? `https://etherscan.io/address/${analysisStatus.wallet_address}`
                            : analysisStatus.wallet_address.startsWith('T')
                            ? `https://tronscan.org/#/address/${analysisStatus.wallet_address}`
                            : `https://mempool.space/address/${analysisStatus.wallet_address}`
                        }
                        target="_blank"
                        rel="noreferrer"
                        className="p-1 text-blue-500 hover:underline"
                        title="Inspect on Public Explorer"
                      >
                        <ExternalLink className="h-3.5 w-3.5" />
                      </a>
                    </div>
                  </div>

                  <div className="flex items-center space-x-2">
                    <button
                      onClick={() => setActiveTab('GRAPH_STUDIO')}
                      className="flex items-center space-x-1.5 px-3 py-1.5 bg-forensic-surfaceRaised hover:bg-forensic-border text-forensic-text border border-forensic-border font-medium text-[11px] rounded transition-colors shadow-sm"
                    >
                      <Network className="h-3.5 w-3.5 text-forensic-teal" />
                      <span>Full-Screen Graph</span>
                    </button>

                    <button
                      onClick={() => setShowFreezeModal(true)}
                      className="flex items-center space-x-1.5 px-3 py-1.5 bg-red-700 hover:bg-red-600 text-white font-medium text-[11px] rounded transition-colors shadow-sm"
                    >
                      <Scale className="h-3.5 w-3.5" />
                      <span>Freeze Notice</span>
                    </button>

                    <button
                      onClick={() => setShowReportModal(true)}
                      className="flex items-center space-x-1.5 px-3 py-1.5 bg-blue-700 hover:bg-blue-600 text-white font-medium text-[11px] rounded transition-colors shadow-sm"
                    >
                      <FileText className="h-3.5 w-3.5" />
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
                      className="flex items-center space-x-1.5 px-3 py-1.5 bg-indigo-700 hover:bg-indigo-600 text-white font-medium text-[11px] rounded transition-colors shadow-sm"
                      title="Download complete 5-asset court dossier (.ZIP)"
                    >
                      <Download className="h-3.5 w-3.5" />
                      <span>Court Dossier (.ZIP)</span>
                    </button>
                  </div>
                </div>

                {/* Evidence Metrics Summary Bar */}
                <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-6 gap-2 pt-2.5 text-[10px] text-forensic-textDim">
                  <div>
                    <span className="block uppercase text-forensic-textDim">Transfers</span>
                    <strong className="text-forensic-text text-xs">{analysisStatus.num_transactions || graphData?.edges?.length || 0} Tx</strong>
                  </div>
                  <div>
                    <span className="block uppercase text-forensic-textDim">Nodes</span>
                    <strong className="text-forensic-text text-xs">{analysisStatus.num_nodes || graphData?.nodes?.length || 1}</strong>
                  </div>
                  <div>
                    <span className="block uppercase text-forensic-textDim">Attributed VASP</span>
                    <strong className="text-blue-500 text-xs">
                      {attributions[0]?.vasp_name || 'Evaluating...'}
                    </strong>
                  </div>
                  <div>
                    <span className="block uppercase text-forensic-textDim">Confidence</span>
                    <strong className="text-forensic-teal text-xs">
                      {attributions[0] ? `${attributions[0].score.toFixed(1)}%` : 'Evaluating'}
                    </strong>
                  </div>
                  <div>
                    <span className="block uppercase text-forensic-textDim">Risk Level</span>
                    <strong className="text-forensic-amber text-xs">
                      {analysisStatus.risk_assessment?.risk_level || 'ELEVATED'}
                    </strong>
                  </div>
                  <div>
                    <span className="block uppercase text-forensic-textDim">Evidence</span>
                    <strong className="text-forensic-text text-xs">{evidence.length || 1} Records</strong>
                  </div>
                </div>
              </div>
            )}

            {/* Case 6: Live INR Valuation & Suspect Target Overview */}
            {analysisStatus && (
              <WalletOverview
                walletAddress={analysisStatus.wallet_address}
                chain={analysisStatus.wallet_address.startsWith('0x') ? 'ethereum' : analysisStatus.wallet_address.startsWith('T') ? 'tron' : 'bitcoin'}
                graphData={graphData}
                attributions={attributions}
              />
            )}

            {/* Split Workspace View */}
            {(analysisStatus || graphData) && (
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
                <div className="lg:col-span-5 space-y-4">
                  <AttributionCard attributions={attributions} />
                  <RiskCard
                    riskAssessment={analysisStatus?.risk_assessment || {
                      risk_level: 'MEDIUM',
                      score: 68.5,
                      indicators: ['Layering through intermediary wallets', 'Proximity to high-volume VASP hot wallet'],
                      explanation: 'Wallet exhibits multi-hop outbound transaction dispersion toward exchange custody.',
                    }}
                    attributions={attributions}
                    onOpenFreezeModal={() => setShowFreezeModal(true)}
                    onOpenDisclosureModal={() => setShowFreezeModal(true)}
                  />
                  <EvidenceFeed evidence={evidence} />
                </div>

                <div className="lg:col-span-7 space-y-4">
                  <GraphCanvas
                    graphData={graphData}
                    transactions={transactions}
                    onPivotTarget={(addr) => handleStartAnalysis(addr, 3)}
                    activeJobId={activeJobId}
                    isStreaming={isStreaming}
                    streamingHop={streamingHop}
                  />
                  <TransactionLedger transactions={transactions} />
                </div>
              </div>
            )}

            {/* Recent Cases */}
            {recentAnalyses.length > 0 && !isLoading && !isStreaming && (
              <div className="bg-forensic-surface border border-forensic-border rounded p-3.5 shadow-sm text-xs font-mono space-y-2.5 transition-colors">
                <div className="flex items-center justify-between border-b border-forensic-border pb-2">
                  <div className="flex items-center space-x-2 text-forensic-text">
                    <FolderOpen className="h-4 w-4 text-forensic-textDim" />
                    <h3 className="uppercase font-bold text-xs tracking-wider">
                      Recent Investigations ({recentAnalyses.length})
                    </h3>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2.5">
                  {recentAnalyses.map((run, idx) => (
                    <button
                      key={idx}
                      onClick={() => handleStartAnalysis(run.wallet_address, 3)}
                      className="p-2.5 bg-forensic-bg hover:bg-forensic-surfaceRaised border border-forensic-border rounded text-left transition-colors group space-y-1"
                    >
                      <div className="flex items-center justify-between text-[11px]">
                        <span className="text-forensic-text font-bold truncate max-w-[170px]">
                          {run.wallet_address.slice(0, 8)}...{run.wallet_address.slice(-6)}
                        </span>
                        <span className={`text-[9px] px-1.5 py-0.2 rounded font-bold uppercase ${
                          run.status === 'COMPLETED' ? 'bg-teal-500/15 text-forensic-teal border border-teal-500/30' : 'bg-forensic-surfaceRaised text-forensic-textMuted border border-forensic-border'
                        }`}>
                          {run.status}
                        </span>
                      </div>
                      <div className="flex items-center justify-between text-[10px] text-forensic-textDim pt-0.5">
                        <span>{run.num_transactions} Transfers • {run.num_nodes} Nodes</span>
                        <span className="text-blue-500 group-hover:underline font-semibold">Load →</span>
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            )}
          </>
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
    </div>
  );
}
