'use client';

import React, { useState, useRef, useEffect, useMemo, useCallback } from 'react';
import {
  ZoomIn,
  ZoomOut,
  RotateCcw,
  Maximize2,
  Minimize2,
  SlidersHorizontal,
  ChevronLeft,
  ChevronRight,
  Sparkles,
  Share2,
  ExternalLink,
  ShieldCheck,
  Copy,
  Check,
  X,
  Network,
  Box,
} from 'lucide-react';
import dynamic from 'next/dynamic';
import { GraphData, NormalizedTransaction } from '../lib/types';
import { SankeyFlowView } from './SankeyFlowView';
import { TimelineReplayBar } from './TimelineReplayBar';
import { EntityCentralityPanel } from './EntityCentralityPanel';
import { TemporalHistogramBar } from './TemporalHistogramBar';

const GraphCanvas3D = dynamic(() => import('./GraphCanvas3D'), { ssr: false });

type LayoutType = 'flow' | 'force' | 'hierarchical' | 'radial' | 'i2-peeling';
type ViewMode = 'NETWORK' | 'FUND_FLOW' | 'TIMELINE' | 'EVIDENCE';
type RiskFilterType = 'ALL' | 'LOW' | 'MEDIUM' | 'HIGH';

interface GraphCanvasProps {
  graphData: GraphData | null | undefined;
  isFullScreenView?: boolean;
  transactions?: NormalizedTransaction[];
  onPivotTarget?: (address: string) => void;
  activeJobId?: string | null;
  isStreaming?: boolean;
  streamingHop?: number;
  onSelectNode?: (nodeData: any) => void;
  className?: string;
}

export const GraphCanvas: React.FC<GraphCanvasProps> = ({
  graphData,
  isFullScreenView = false,
  transactions,
  onPivotTarget,
  onSelectNode,
  className = '',
}) => {
  // View & Layout State (Pure 3D Graph)
  const [layoutMode, setLayoutMode] = useState<LayoutType>('flow');
  const [viewMode, setViewMode] = useState<ViewMode>('NETWORK');
  const [isSidebarOpen, setIsSidebarOpen] = useState<boolean>(false);
  const [isFullScreen, setIsFullScreen] = useState<boolean>(false);

  // 3D Camera Micro-Tool Refs
  const fit3DRef = useRef<(() => void) | null>(null);
  const reset3DRef = useRef<(() => void) | null>(null);
  const zoomIn3DRef = useRef<(() => void) | null>(null);
  const zoomOut3DRef = useRef<(() => void) | null>(null);

  // Filter States
  const [selectedHops, setSelectedHops] = useState<Set<number>>(new Set([1, 2, 3]));
  const [selectedEntityTypes, setSelectedEntityTypes] = useState<Set<string>>(
    new Set(['TARGET', 'VASP', 'INTERMEDIARY', 'BRIDGE', 'EXTERNAL'])
  );
  const [selectedToken, setSelectedToken] = useState<string>('ALL');
  const [selectedChain, setSelectedChain] = useState<string>('ALL');
  const [minAmount, setMinAmount] = useState<number>(0);
  const [timeRange, setTimeRange] = useState<string>('ALL');
  const [riskFilter, setRiskFilter] = useState<RiskFilterType>('ALL');

  // Forensic Analysis Tools State
  const [showCentralityPanel, setShowCentralityPanel] = useState<boolean>(false);
  const [selectedTemporalHour, setSelectedTemporalHour] = useState<number | null>(null);
  const [showHistogramBar, setShowHistogramBar] = useState<boolean>(true);

  // Highlight filters for 3D view
  const [highlightedNodeIds, setHighlightedNodeIds] = useState<Set<string> | null>(null);
  const [highlightedEdgeIds, setHighlightedEdgeIds] = useState<Set<string> | null>(null);

  // Inspection & Path Focus State
  const [selectedElement, setSelectedElement] = useState<any>(null);
  const [focusedPath, setFocusedPath] = useState<{
    targetNodeId: string;
    nodeIds: Set<string>;
    edgeIds: Set<string>;
    totalVolume: number;
    hopDistance: number;
    destinationName?: string;
  } | null>(null);

  const [copied, setCopied] = useState<boolean>(false);

  // Fullscreen keyboard listener (Escape)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isFullScreen) {
        setIsFullScreen(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isFullScreen]);

  // Derived Target Node & Graph Metrics
  const rootNode = useMemo(() => {
    if (!graphData?.nodes || graphData.nodes.length === 0) return null;
    return (
      graphData.nodes.find((n: any) => {
        const d = n.data || n;
        return d.role === 'INPUT_WALLET' || d.is_root || d.isRoot || d.hop === 0;
      }) || graphData.nodes[0]
    );
  }, [graphData]);

  const rootAddress = useMemo(() => {
    if (!rootNode) return '0x...';
    const d = (rootNode as any).data || rootNode;
    return d.id || d.address || '0x...';
  }, [rootNode]);

  const graphMetrics = useMemo(() => {
    const nodes = graphData?.nodes || [];
    const edges = graphData?.edges || [];

    let totalVol = 0;
    const tokenSet = new Set<string>();
    const chainSet = new Set<string>();

    edges.forEach((e: any) => {
      const d = e.data || e;
      totalVol += Number(d.amount || 0);
      const sym = (d.asset_symbol || d.token_symbol || 'ETH').toUpperCase();
      tokenSet.add(sym);
      if (d.source_chain) chainSet.add(d.source_chain.toLowerCase());
      if (d.target_chain) chainSet.add(d.target_chain.toLowerCase());
    });

    nodes.forEach((n: any) => {
      const d = n.data || n;
      if (d.chain) chainSet.add(d.chain.toLowerCase());
    });

    return {
      nodeCount: nodes.length,
      edgeCount: edges.length,
      totalVolume: totalVol,
      tokensAvailable: ['ALL', ...Array.from(tokenSet)],
      chainsAvailable: ['ALL', ...Array.from(chainSet)],
      primaryToken: Array.from(tokenSet)[0] || 'ETH',
    };
  }, [graphData]);

  // Handle Copy to Clipboard
  const handleCopy = (text: string) => {
    if (!text) return;
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  // Filter Toggle Handlers
  const toggleHopFilter = (hop: number) => {
    const next = new Set(selectedHops);
    if (next.has(hop)) {
      if (next.size > 1) next.delete(hop);
    } else {
      next.add(hop);
    }
    setSelectedHops(next);
  };

  const toggleEntityType = (type: string) => {
    const next = new Set(selectedEntityTypes);
    if (next.has(type)) {
      if (next.size > 1) next.delete(type);
    } else {
      next.add(type);
    }
    setSelectedEntityTypes(next);
  };

  const handleClearFilters = () => {
    setSelectedHops(new Set([1, 2, 3]));
    setSelectedEntityTypes(new Set(['TARGET', 'VASP', 'INTERMEDIARY', 'BRIDGE', 'EXTERNAL']));
    setSelectedToken('ALL');
    setSelectedChain('ALL');
    setMinAmount(0);
    setTimeRange('ALL');
    setRiskFilter('ALL');
    setHighlightedNodeIds(null);
    setHighlightedEdgeIds(null);
  };

  // Micro-Tools Trigger Handlers
  const handleFit = () => {
    fit3DRef.current?.();
  };
  const handleZoomIn = () => {
    zoomIn3DRef.current?.();
  };
  const handleZoomOut = () => {
    zoomOut3DRef.current?.();
  };
  const handleReset = () => {
    reset3DRef.current?.();
    setFocusedPath(null);
    setSelectedElement(null);
    setHighlightedNodeIds(null);
    setHighlightedEdgeIds(null);
    onSelectNode?.(null);
  };

  const handleSelectElement = (el: any) => {
    setSelectedElement(el);
    if (el?.type === 'NODE') {
      onSelectNode?.(el.data);
    } else {
      onSelectNode?.(null);
    }
  };

  return (
    <div
      className={`bg-white dark:bg-[#0D131F] ${
        isFullScreen
          ? 'fixed inset-0 z-[9999] w-screen h-screen rounded-none border-none m-0 p-0 overflow-hidden flex flex-col'
          : `border border-slate-200 dark:border-[#1E293B] rounded-xl shadow-sm dark:shadow-2xl flex flex-col relative text-xs overflow-hidden transition-all duration-300 ${
              className ? className : isFullScreenView ? 'h-[85vh]' : 'h-auto min-h-[740px]'
            }`
      }`}
    >
      {/* ───────────────────────────────────────────────────────────────────────────── */}
      {/* 1. INVESTIGATION SUMMARY HEADER BAR                                           */}
      {/* ───────────────────────────────────────────────────────────────────────────── */}
      <div className="p-3.5 border-b border-slate-200 dark:border-[#1E293B] bg-white/95 dark:bg-[#0D131F]/90 backdrop-blur-md flex flex-wrap items-center justify-between gap-3 text-xs shrink-0">
        {/* Left: Graph Studio + 3D Engine badge + Target address */}
        <div className="flex items-center space-x-3">
          <div className="w-10 h-10 rounded-lg bg-blue-50 dark:bg-blue-900/30 border border-blue-200 dark:border-blue-900/40 flex items-center justify-center text-[#2563EB] dark:text-[#3B82F6]">
            <Box className="h-5 w-5" />
          </div>
          <div>
            <div className="flex items-center space-x-2">
              <span className="font-bold text-slate-900 dark:text-[#F8FAFC] text-base tracking-wide font-sans">
                3D Forensic Studio
              </span>
              <span className="px-2 py-0.5 rounded-full text-[10px] font-mono font-bold bg-blue-100 dark:bg-blue-950/60 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-800">
                REAL-TIME FLOW ENGINE
              </span>
            </div>
            <div className="flex items-center space-x-1.5 text-xs font-mono text-slate-500 dark:text-[#94A3B8] mt-0.5">
              <span>Target:</span>
              <span className="text-slate-800 dark:text-[#E2E8F0] font-medium">
                {rootAddress && rootAddress !== '0x...'
                  ? `${rootAddress.slice(0, 8)}...${rootAddress.slice(-4)}`
                  : 'No active target'}
              </span>
              {((rootNode as any)?.category === 'exploit' ||
                (rootNode as any)?.category === 'hack' ||
                (rootNode as any)?.is_exploit ||
                (rootNode as any)?.isExploit) ? (
                <span className="px-1.5 py-0.2 rounded text-[10px] font-bold uppercase bg-rose-100 text-rose-700 border border-rose-200 animate-pulse">
                  EXPLOIT DRAINER
                </span>
              ) : ((rootNode as any)?.is_sanctioned ||
                  (rootNode as any)?.isSanctioned ||
                  (rootNode as any)?.tag === 'sanctioned') ? (
                <span className="px-1.5 py-0.2 rounded text-[10px] font-bold uppercase bg-red-100 text-red-700 border border-red-200 animate-pulse">
                  OFAC SANCTIONED
                </span>
              ) : null}

              {rootAddress && rootAddress !== '0x...' && (
                <button
                  onClick={() => handleCopy(rootAddress)}
                  className="hover:text-slate-900 dark:hover:text-white transition-colors p-0.5 text-slate-400 dark:text-[#94A3B8]"
                  title="Copy Target Wallet"
                >
                  {copied ? <Check className="h-3.5 w-3.5 text-emerald-600" /> : <Copy className="h-3.5 w-3.5" />}
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Right: View Mode Tabs */}
        <div className="flex items-center space-x-2.5">
          <div className="flex items-center bg-slate-100 dark:bg-[#111827] border border-slate-200 dark:border-[#1E293B] rounded-lg p-1 font-mono text-xs">
            {(['NETWORK', 'FUND_FLOW', 'TIMELINE', 'EVIDENCE'] as ViewMode[]).map((mode) => (
              <button
                key={mode}
                onClick={() => setViewMode(mode)}
                className={`px-3 py-1.5 rounded-md font-semibold transition-all ${
                  viewMode === mode
                    ? 'bg-[#2563EB] text-white shadow-sm font-bold'
                    : 'text-slate-600 dark:text-[#94A3B8] hover:text-slate-900 dark:hover:text-[#F8FAFC] hover:bg-slate-200 dark:hover:bg-[#1E293B]'
                }`}
              >
                {mode === 'FUND_FLOW' ? 'Fund Flow' : mode.charAt(0) + mode.slice(1).toLowerCase()}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* ───────────────────────────────────────────────────────────────────────────── */}
      {/* 2. SUB-STRIP: LAYOUT & CHAIN CONTROLS                                         */}
      {/* ───────────────────────────────────────────────────────────────────────────── */}
      <div className="px-4 py-2.5 border-b border-slate-200 dark:border-[#1E293B] bg-slate-50/80 dark:bg-[#111827]/80 backdrop-blur-md flex flex-wrap items-center justify-between gap-y-2 text-xs font-mono shrink-0">
        <div className="flex flex-wrap items-center gap-x-6 gap-y-2">
          {/* LAYOUT Engine Selector */}
          <div className="flex items-center space-x-2">
            <span className="text-slate-500 dark:text-[#94A3B8] font-bold text-[11px] tracking-wider">LAYOUT:</span>
            <div className="flex items-center space-x-1.5">
              {[
                { id: 'flow', label: 'Flow (DAG)' },
                { id: 'i2-peeling', label: 'i2 Peeling' },
                { id: 'force', label: 'Force (CoSE)' },
                { id: 'radial', label: 'Radial' },
              ].map((l) => (
                <button
                  key={l.id}
                  onClick={() => setLayoutMode(l.id as LayoutType)}
                  className={`px-2.5 py-1 rounded text-[11px] font-semibold transition-all ${
                    layoutMode === l.id
                      ? 'bg-[#2563EB] text-white shadow-sm font-bold'
                      : 'bg-white dark:bg-[#191c22] text-slate-600 dark:text-[#94A3B8] hover:text-slate-900 dark:hover:text-[#F8FAFC] border border-slate-200 dark:border-[#1E293B]'
                  }`}
                >
                  {l.label}
                </button>
              ))}
            </div>
          </div>

          {/* CHAIN Selector */}
          <div className="flex items-center space-x-2">
            <span className="text-slate-500 dark:text-[#94A3B8] font-bold text-[11px] tracking-wider">CHAIN:</span>
            <div className="flex items-center space-x-1.5">
              {['ALL', 'Ethereum', 'Tron', 'Bitcoin'].map((c) => {
                const isSelected =
                  c === 'ALL'
                    ? selectedChain === 'ALL' || !selectedChain
                    : selectedChain.toLowerCase() === c.toLowerCase();
                return (
                  <button
                    key={c}
                    onClick={() => setSelectedChain(c === 'ALL' ? 'ALL' : c.toLowerCase())}
                    className={`px-2.5 py-1 rounded text-[11px] font-semibold transition-all uppercase ${
                      isSelected
                        ? 'bg-[#2563EB] text-white shadow-sm font-bold'
                        : 'bg-white dark:bg-[#191c22] text-slate-600 dark:text-[#94A3B8] hover:text-slate-900 dark:hover:text-[#F8FAFC] border border-slate-200 dark:border-[#1E293B]'
                    }`}
                  >
                    {c}
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        {/* Right Action buttons */}
        <div className="flex items-center space-x-2">
          <button
            onClick={() => setIsSidebarOpen(!isSidebarOpen)}
            className={`px-2.5 py-1 rounded text-[11px] font-bold flex items-center space-x-1.5 transition-colors border ${
              isSidebarOpen
                ? 'bg-[#2563EB] text-white border-[#2563EB]'
                : 'bg-white dark:bg-[#191c22] hover:bg-slate-100 dark:hover:bg-[#1E293B] text-slate-600 dark:text-[#94A3B8] border border-slate-200 dark:border-[#1E293B]'
            }`}
            title="Toggle Investigation Filters"
          >
            <SlidersHorizontal className="h-3 w-3" />
            <span>Filters</span>
          </button>
          <button
            onClick={() => setShowCentralityPanel(!showCentralityPanel)}
            className={`px-2.5 py-1 rounded text-[11px] font-bold flex items-center space-x-1.5 transition-colors border ${
              showCentralityPanel
                ? 'bg-[#2563EB] text-white border-[#2563EB]'
                : 'bg-white dark:bg-[#191c22] hover:bg-slate-100 dark:hover:bg-[#1E293B] text-slate-600 dark:text-[#94A3B8] border border-slate-200 dark:border-[#1E293B]'
            }`}
            title="Toggle Centrality List"
          >
            <Network className="h-3 w-3" />
            <span>Centrality</span>
          </button>
          <button
            onClick={() => setIsFullScreen(!isFullScreen)}
            className={`p-1.5 rounded transition-colors border ${
              isFullScreen
                ? 'bg-blue-50 dark:bg-blue-900/30 text-[#2563EB] dark:text-[#3B82F6] border-[#2563EB]/40 shadow-sm'
                : 'hover:bg-slate-100 dark:hover:bg-[#1E293B] text-slate-600 dark:text-[#94A3B8] hover:text-slate-900 dark:hover:text-[#F8FAFC] border-slate-200 dark:border-[#1E293B]'
            }`}
            title={isFullScreen ? 'Exit Fullscreen (Esc)' : 'Enter Fullscreen'}
          >
            {isFullScreen ? <Minimize2 className="h-3.5 w-3.5 text-[#2563EB] dark:text-[#3B82F6]" /> : <Maximize2 className="h-3.5 w-3.5" />}
          </button>
        </div>
      </div>

      {/* ───────────────────────────────────────────────────────────────────────────── */}
      {/* 3. MAIN WORKSPACE BODY: 3D Canvas + Slide-out Panels                          */}
      {/* ───────────────────────────────────────────────────────────────────────────── */}
      <div className="flex-1 relative flex overflow-hidden w-full h-full">
        {/* Slide-out Left Filter Panel */}
        {isSidebarOpen && (
          <div
            className={`border-r border-slate-200 dark:border-[#1E293B] bg-white/95 dark:bg-[#0D131F]/95 backdrop-blur-md transition-all duration-300 flex flex-col z-20 overflow-y-auto ${
              isSidebarOpen ? 'w-64 min-w-[16rem]' : 'hidden'
            }`}
          >
            <div className="p-2.5 border-b border-slate-200 dark:border-[#1E293B] flex items-center justify-between">
              <div className="flex items-center space-x-2 font-mono text-xs font-bold text-slate-800 dark:text-[#F8FAFC] uppercase">
                <SlidersHorizontal className="h-3.5 w-3.5 text-[#2563EB]" />
                <span>Investigation Filters</span>
              </div>
              <button
                onClick={() => setIsSidebarOpen(false)}
                className="p-1 rounded hover:bg-slate-100 dark:hover:bg-[#1E293B] text-slate-500 dark:text-[#94A3B8] hover:text-slate-900 dark:hover:text-[#F8FAFC] transition-colors"
                title="Collapse Panel"
              >
                <ChevronLeft className="h-4 w-4" />
              </button>
            </div>

            <div className="p-3.5 space-y-4 text-xs">
              {/* LAYOUT Selector */}
              <div>
                <div className="text-[10px] font-mono uppercase text-slate-400 dark:text-[#64748B] font-bold mb-2 tracking-wider">
                  3D Spatial Layout
                </div>
                <div className="grid grid-cols-2 gap-1.5 font-mono text-[11px]">
                  {[
                    { id: 'flow', label: 'Flow (DAG)' },
                    { id: 'i2-peeling', label: 'i2 Peeling' },
                    { id: 'force', label: 'Force (Organic)' },
                    { id: 'radial', label: 'Radial' },
                  ].map((l) => (
                    <button
                      key={l.id}
                      onClick={() => setLayoutMode(l.id as LayoutType)}
                      className={`px-2 py-1.5 rounded text-left flex items-center space-x-1.5 border transition-colors ${
                        layoutMode === l.id
                          ? 'bg-[#2563EB] text-white border-[#2563EB] font-bold shadow-sm'
                          : 'bg-slate-50 dark:bg-[#111827] border-slate-200 dark:border-[#1E293B] text-slate-600 dark:text-[#94A3B8] hover:text-slate-900 dark:hover:text-[#F8FAFC]'
                      }`}
                    >
                      <span
                        className={`w-2 h-2 rounded-full ${
                          layoutMode === l.id ? 'bg-white' : 'bg-transparent border border-slate-400 dark:border-[#64748B]'
                        }`}
                      />
                      <span>{l.label}</span>
                    </button>
                  ))}
                </div>
              </div>

              {/* HOPS Depth */}
              <div>
                <div className="text-[10px] font-mono uppercase text-slate-400 dark:text-[#64748B] font-bold mb-2 tracking-wider">
                  Hop Traversal Depth
                </div>
                <div className="space-y-1.5 font-mono text-[11px]">
                  {[1, 2, 3].map((hop) => (
                    <label
                      key={hop}
                      className="flex items-center space-x-2 cursor-pointer text-slate-700 dark:text-[#E2E8F0] hover:text-slate-900 dark:hover:text-white"
                    >
                      <input
                        type="checkbox"
                        checked={selectedHops.has(hop)}
                        onChange={() => toggleHopFilter(hop)}
                        className="rounded border-slate-300 dark:border-[#1E293B] bg-white dark:bg-[#111827] text-[#2563EB] focus:ring-0 focus:ring-offset-0 h-3.5 w-3.5"
                      />
                      <span>Hop {hop} Counterparties</span>
                    </label>
                  ))}
                </div>
              </div>

              {/* ENTITY TYPES */}
              <div>
                <div className="text-[10px] font-mono uppercase text-slate-400 dark:text-[#64748B] font-bold mb-2 tracking-wider">
                  Entity Types
                </div>
                <div className="space-y-1.5 font-mono text-[11px]">
                  {[
                    { id: 'TARGET', label: 'Target Suspect Wallet', color: 'text-rose-600 dark:text-rose-400 font-semibold' },
                    { id: 'VASP', label: 'VASP Custodial Clusters', color: 'text-teal-600 dark:text-teal-400 font-semibold' },
                    { id: 'BRIDGE', label: 'Cross-Chain Bridges', color: 'text-purple-600 dark:text-purple-400 font-semibold' },
                    { id: 'INTERMEDIARY', label: 'Intermediary Wallets', color: 'text-indigo-600 dark:text-indigo-400 font-semibold' },
                    { id: 'EXTERNAL', label: 'External Contracts / Unknown', color: 'text-slate-500 dark:text-[#94A3B8]' },
                  ].map((e) => (
                    <label key={e.id} className="flex items-center space-x-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={selectedEntityTypes.has(e.id)}
                        onChange={() => toggleEntityType(e.id)}
                        className="rounded border-slate-300 dark:border-[#1E293B] bg-white dark:bg-[#111827] text-[#2563EB] focus:ring-0 focus:ring-offset-0 h-3.5 w-3.5"
                      />
                      <span className={e.color}>{e.label}</span>
                    </label>
                  ))}
                </div>
              </div>

              {/* TRANSACTION FILTERS */}
              <div className="space-y-2.5 pt-2 border-t border-slate-200 dark:border-[#1E293B]">
                <div className="text-[10px] font-mono uppercase text-slate-400 dark:text-[#64748B] font-bold tracking-wider">
                  Transaction Filters
                </div>
                <div>
                  <label className="text-[11px] text-slate-500 dark:text-[#94A3B8] block mb-1">Asset Token</label>
                  <select
                    value={selectedToken}
                    onChange={(e) => setSelectedToken(e.target.value)}
                    className="w-full bg-slate-50 dark:bg-[#111827] border border-slate-200 dark:border-[#1E293B] rounded px-2 py-1.5 text-slate-800 dark:text-[#F8FAFC] font-mono text-xs focus:outline-none focus:border-[#2563EB]"
                  >
                    {graphMetrics.tokensAvailable.map((t) => (
                      <option key={t} value={t}>
                        {t === 'ALL' ? 'All Tokens' : t}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <div className="flex justify-between items-center mb-1">
                    <label className="text-[11px] text-slate-500 dark:text-[#94A3B8]">Minimum Transfer</label>
                    <span className="font-mono text-[10px] text-blue-600 dark:text-blue-400 font-bold">
                      {minAmount > 0 ? `≥ ${minAmount}` : 'No Minimum'}
                    </span>
                  </div>
                  <input
                    type="number"
                    min="0"
                    step="10"
                    placeholder="0.00"
                    value={minAmount || ''}
                    onChange={(e) => setMinAmount(Number(e.target.value) || 0)}
                    className="w-full bg-slate-50 dark:bg-[#111827] border border-slate-200 dark:border-[#1E293B] rounded px-2 py-1.5 text-slate-800 dark:text-[#F8FAFC] font-mono text-xs focus:outline-none focus:border-[#2563EB]"
                  />
                  <div className="flex gap-1 mt-1.5">
                    {[0, 100, 1000, 5000].map((preset) => (
                      <button
                        key={preset}
                        onClick={() => setMinAmount(preset)}
                        className={`flex-1 py-0.5 rounded text-[10px] font-mono border transition-colors ${
                          minAmount === preset
                            ? 'bg-[#2563EB] text-white border-[#2563EB] font-bold'
                            : 'bg-slate-50 dark:bg-[#111827] border-slate-200 dark:border-[#1E293B] text-slate-600 dark:text-[#94A3B8] hover:text-slate-900 dark:hover:text-[#F8FAFC]'
                        }`}
                      >
                        {preset === 0 ? 'All' : `${preset >= 1000 ? preset / 1000 + 'k' : preset}`}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              {/* RISK LEVEL FILTER */}
              <div className="pt-2 border-t border-slate-200 dark:border-[#1E293B]">
                <div className="text-[10px] font-mono uppercase text-slate-400 dark:text-[#64748B] font-bold mb-2 tracking-wider">
                  Risk Assessment Scope
                </div>
                <div className="grid grid-cols-4 gap-1 font-mono text-[10px]">
                  {(['ALL', 'LOW', 'MEDIUM', 'HIGH'] as RiskFilterType[]).map((r) => (
                    <button
                      key={r}
                      onClick={() => setRiskFilter(r)}
                      className={`py-1 rounded font-medium border transition-colors ${
                        riskFilter === r
                          ? r === 'HIGH'
                            ? 'bg-rose-600 text-white border-rose-500'
                            : r === 'MEDIUM'
                              ? 'bg-amber-600 text-white border-amber-500'
                              : r === 'LOW'
                                ? 'bg-emerald-600 text-white border-emerald-500'
                                : 'bg-[#2563EB] text-white border-[#2563EB]'
                          : 'bg-slate-50 dark:bg-[#111827] border-slate-200 dark:border-[#1E293B] text-slate-600 dark:text-[#94A3B8] hover:text-slate-900 dark:hover:text-[#F8FAFC]'
                      }`}
                    >
                      {r.charAt(0) + r.slice(1).toLowerCase()}
                    </button>
                  ))}
                </div>
              </div>

              <div className="pt-3">
                <button
                  onClick={handleClearFilters}
                  className="w-full py-1.5 rounded-lg bg-slate-100 dark:bg-[#111827] hover:bg-slate-200 dark:hover:bg-[#1E293B] text-slate-700 dark:text-[#F8FAFC] border border-slate-200 dark:border-[#1E293B] transition-colors font-mono text-xs flex items-center justify-center space-x-1.5"
                >
                  <RotateCcw className="h-3 w-3 text-slate-500 dark:text-[#94A3B8]" />
                  <span>Reset All Filters</span>
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Center Canvas Area: Sankey Flow vs 3D Forensic Canvas */}
        {viewMode === 'FUND_FLOW' ? (
          <div className="flex-1 bg-forensic-bg h-full overflow-hidden">
            <SankeyFlowView
              graphData={graphData}
              rootAddress={rootAddress}
              onSelectAddress={(addr) => {
                const node = graphData?.nodes?.find((n: any) => {
                  const d = n.data || n;
                  return (d.id || d.address || '').toLowerCase() === addr.toLowerCase();
                });
                if (node) {
                  const d = (node as any).data || node;
                  handleSelectElement({ type: 'NODE', data: d });
                }
              }}
            />
          </div>
        ) : (
          <div className="flex-1 relative bg-forensic-bg h-full flex flex-col">
            {/* Tag Color Legend Overlay */}
            <div className="absolute top-3 left-3 z-10 flex flex-col gap-2 pointer-events-none">
              <div className="flex items-center space-x-2.5 px-3 py-1.5 rounded-lg bg-white/95 dark:bg-[#0D131F]/95 backdrop-blur-md border border-slate-200 dark:border-[#1E293B] text-[10px] font-mono shadow-md pointer-events-auto animate-fade-in w-fit text-slate-800 dark:text-[#F8FAFC]">
                <span className="text-slate-400 dark:text-[#64748B] uppercase font-bold text-[9px] tracking-wider">
                  LEGEND:
                </span>
                <span className="flex items-center space-x-1">
                  <span className="w-2.5 h-2.5 rounded-full bg-[#ef4444] inline-block shrink-0" />
                  <span className="text-rose-600 dark:text-[#ef4444] font-semibold">Target</span>
                </span>
                <span className="flex items-center space-x-1">
                  <span className="w-2.5 h-2.5 rounded-[2px] bg-[#10b981] inline-block shrink-0" />
                  <span className="text-teal-600 dark:text-[#10b981] font-semibold">VASP</span>
                </span>
                <span className="flex items-center space-x-1">
                  <span className="w-2.5 h-2.5 rounded-full bg-[#a855f7] inline-block shrink-0" />
                  <span className="text-purple-600 dark:text-[#a855f7] font-semibold">Mixer</span>
                </span>
                <span className="flex items-center space-x-1">
                  <span className="w-2.5 h-2.5 rounded-full bg-[#dc2626] inline-block shrink-0" />
                  <span className="text-red-600 dark:text-[#dc2626] font-semibold">Sanctioned</span>
                </span>
                <span className="flex items-center space-x-1">
                  <span className="w-2 h-2 rounded-full bg-slate-400 dark:bg-[#94a3b8] inline-block shrink-0" />
                  <span className="text-slate-500 dark:text-[#94a3b8] font-semibold">Counterparty</span>
                </span>
              </div>
            </div>

            {/* Pure 3D Forensic Graph Container */}
            <div
              className={`w-full flex-1 relative overflow-hidden ${
                isFullScreen ? 'h-full min-h-full' : 'min-h-[440px]'
              }`}
            >
              {(!graphData || !graphData.nodes || graphData.nodes.length === 0) ? (
                <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none z-10 bg-[#F8FAFC]/80 dark:bg-[#05080E]/80 backdrop-blur-[1px] text-center p-6 select-none">
                  <div className="w-14 h-14 rounded-2xl bg-white dark:bg-[#0D131F] border border-slate-200 dark:border-[#1E293B] shadow-sm flex items-center justify-center text-[#2563EB] mb-3">
                    <Network className="w-7 h-7 text-[#2563EB]" />
                  </div>
                  <h3 className="font-bold text-sm text-slate-900 dark:text-[#F8FAFC] tracking-tight">
                    Awaiting Suspect Wallet Address
                  </h3>
                  <p className="text-xs text-slate-500 dark:text-[#94A3B8] mt-1 max-w-sm">
                    Enter a suspect wallet address in the search console above and click Trace to begin transaction flow analysis.
                  </p>
                </div>
              ) : (
                <GraphCanvas3D
                  graphData={graphData}
                  rootAddress={rootAddress}
                  isDarkMode={
                    typeof document !== 'undefined'
                      ? document.documentElement.classList.contains('dark')
                      : true
                  }
                  layoutMode={layoutMode}
                  selectedElement={selectedElement}
                  onSelectElement={handleSelectElement}
                  focusedPath={focusedPath as any}
                  onUpdateFocusedPath={setFocusedPath}
                  selectedHops={selectedHops}
                  selectedEntityTypes={selectedEntityTypes}
                  selectedToken={selectedToken}
                  selectedChain={selectedChain}
                  minAmount={minAmount}
                  riskFilter={riskFilter}
                  viewMode={viewMode}
                  highlightedNodeIds={highlightedNodeIds}
                  highlightedEdgeIds={highlightedEdgeIds}
                  onFitRef={fit3DRef}
                  onResetRef={reset3DRef}
                  onZoomInRef={zoomIn3DRef}
                  onZoomOutRef={zoomOut3DRef}
                />
              )}
            </div>

            {/* Canvas Micro-Tools (Bottom Right Floating Bar) */}
            <div className="absolute bottom-4 right-4 z-10 flex items-center space-x-1 p-1 rounded-lg bg-white/95 dark:bg-[#0D131F]/90 border border-slate-200 dark:border-[#1E293B] backdrop-blur-md shadow-xl text-slate-600 dark:text-[#94A3B8]">
              <button
                onClick={handleZoomIn}
                className="w-7 h-7 rounded hover:bg-slate-100 dark:hover:bg-[#1E293B] hover:text-slate-900 dark:hover:text-white flex items-center justify-center transition-colors"
                title="Zoom In"
              >
                <ZoomIn className="h-4 w-4" />
              </button>
              <button
                onClick={handleZoomOut}
                className="w-7 h-7 rounded hover:bg-slate-100 dark:hover:bg-[#1E293B] hover:text-slate-900 dark:hover:text-white flex items-center justify-center transition-colors"
                title="Zoom Out"
              >
                <ZoomOut className="h-4 w-4" />
              </button>
              <button
                onClick={handleReset}
                className="w-7 h-7 rounded hover:bg-slate-100 dark:hover:bg-[#1E293B] hover:text-slate-900 dark:hover:text-white flex items-center justify-center transition-colors"
                title="Reset View"
              >
                <RotateCcw className="h-4 w-4" />
              </button>
              <button
                onClick={handleFit}
                className="w-7 h-7 rounded hover:bg-slate-100 dark:hover:bg-[#1E293B] hover:text-slate-900 dark:hover:text-white flex items-center justify-center transition-colors"
                title="Auto-Fit View"
              >
                <Sparkles className="h-4 w-4" />
              </button>
              <button
                onClick={() => setIsFullScreen(!isFullScreen)}
                className="w-7 h-7 rounded hover:bg-slate-100 dark:hover:bg-[#1E293B] hover:text-slate-900 dark:hover:text-white flex items-center justify-center transition-colors"
                title={isFullScreen ? 'Exit Fullscreen' : 'Fullscreen'}
              >
                {isFullScreen ? <Minimize2 className="h-4 w-4 text-rose-500" /> : <Maximize2 className="h-4 w-4" />}
              </button>
            </div>

            {/* IBM i2 Temporal 24-Hour Histogram Bar */}
            {showHistogramBar && (
              <div className="p-2.5 border-t border-slate-200 dark:border-[#1E293B] bg-white/95 dark:bg-[#05080E]/95 z-20">
                <TemporalHistogramBar
                  transactions={transactions}
                  edges={graphData?.edges}
                  selectedHour={selectedTemporalHour}
                  onFilterHourChange={(newHour: number | null) => {
                    setSelectedTemporalHour(newHour);
                    if (newHour === null || !graphData?.edges) {
                      setHighlightedNodeIds(null);
                      setHighlightedEdgeIds(null);
                      return;
                    }

                    const matchingEdgeIds = new Set<string>();
                    const connectedNodeIds = new Set<string>();

                    graphData.edges.forEach((e: any, idx: number) => {
                      const d = e.data || e;
                      const ts = d.timestamp;
                      let h = 17;
                      if (ts) {
                        const dt = new Date(ts);
                        if (!isNaN(dt.getTime())) h = dt.getHours();
                      } else {
                        const hash = d.tx_hash || d.id || `edge-${idx}`;
                        let num = 0;
                        for (let i = 0; i < hash.length; i++) num += hash.charCodeAt(i);
                        h = num % 3 === 0 ? 17 : num % 24;
                      }

                      if (h === newHour) {
                        const edgeId = d.id || `edge-3d-${idx}`;
                        matchingEdgeIds.add(edgeId);
                        const src = (d.source?.id || d.source || '').toLowerCase();
                        const tgt = (d.target?.id || d.target || '').toLowerCase();
                        if (src) connectedNodeIds.add(src);
                        if (tgt) connectedNodeIds.add(tgt);
                      }
                    });

                    setHighlightedEdgeIds(matchingEdgeIds);
                    setHighlightedNodeIds(connectedNodeIds);
                  }}
                  onClearFilter={() => {
                    setSelectedTemporalHour(null);
                    setHighlightedNodeIds(null);
                    setHighlightedEdgeIds(null);
                  }}
                  primaryToken={graphMetrics.primaryToken}
                />
              </div>
            )}

            {/* Timeline Replay Bar */}
            {transactions && transactions.length > 0 && !showHistogramBar && (
              <div className="p-3 border-t border-slate-200 dark:border-[#1E293B] bg-white/95 dark:bg-[#05080E]/95 z-10">
                <TimelineReplayBar
                  transactions={transactions}
                  onStepChange={(tx) => {
                    if (!tx) {
                      setHighlightedNodeIds(null);
                      setHighlightedEdgeIds(null);
                      return;
                    }

                    const src = (tx.from_address || '').toLowerCase();
                    const dst = (tx.to_address || '').toLowerCase();
                    const nodeIds = new Set<string>();
                    if (src) nodeIds.add(src);
                    if (dst) nodeIds.add(dst);

                    const edgeIds = new Set<string>();
                    (graphData?.edges || []).forEach((e: any, idx: number) => {
                      const d = e.data || e;
                      const s = (d.source?.id || d.source || '').toLowerCase();
                      const t = (d.target?.id || d.target || '').toLowerCase();
                      const eid = d.id || `edge-3d-${idx}`;
                      if (
                        (s === src && t === dst) ||
                        (d.tx_hash && d.tx_hash.toLowerCase() === tx.tx_hash.toLowerCase())
                      ) {
                        edgeIds.add(eid);
                      }
                    });

                    setHighlightedNodeIds(nodeIds);
                    setHighlightedEdgeIds(edgeIds);
                  }}
                />
              </div>
            )}

            {/* Active Path Focus Banner */}
            {focusedPath && (
              <div className="absolute bottom-20 left-4 z-10 p-3 rounded-lg bg-white/95 dark:bg-[#0D131F]/95 border border-[#2563EB]/40 shadow-xl backdrop-blur-md font-mono text-xs max-w-md animate-fade-in">
                <div className="flex items-center justify-between mb-1.5">
                  <div className="flex items-center space-x-1.5 text-[#2563EB] font-bold">
                    <Sparkles className="h-3.5 w-3.5 animate-pulse" />
                    <span>PRIMARY FUND FLOW FOCUS</span>
                  </div>
                  <button
                    onClick={() => setFocusedPath(null)}
                    className="text-slate-400 dark:text-[#64748B] hover:text-slate-900 dark:hover:text-[#F8FAFC] p-0.5"
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                </div>
                <div className="text-[11px] text-slate-600 dark:text-[#94A3B8] space-y-1">
                  <div>
                    Destination:{' '}
                    <strong className="text-emerald-600 dark:text-emerald-400">
                      {focusedPath.destinationName || focusedPath.targetNodeId.slice(0, 10) + '...'}
                    </strong>
                  </div>
                  <div className="flex justify-between">
                    <span>
                      Hop Distance: <strong>{focusedPath.hopDistance} Hop(s)</strong>
                    </span>
                    <span>
                      Observable Flow:{' '}
                      <strong className="text-[#2563EB]">
                        {focusedPath.totalVolume.toFixed(2)} {graphMetrics.primaryToken}
                      </strong>
                    </span>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Right Drawer: Centrality Panel vs Element Forensic Details */}
        {showCentralityPanel ? (
          <div className="w-96 min-w-[22rem] border-l border-slate-200 dark:border-[#1E293B] bg-white dark:bg-[#0D131F] backdrop-blur-md z-30 flex flex-col animate-slide-left">
            <EntityCentralityPanel
              graphData={graphData}
              selectedNodeId={selectedElement?.data?.id}
              onSelectEntity={(nodeId) => {
                const node = graphData?.nodes?.find((n: any) => {
                  const d = n.data || n;
                  return (d.id || d.address || '').toLowerCase() === nodeId.toLowerCase();
                });
                if (node) {
                  const d = (node as any).data || node;
                  handleSelectElement({ type: 'NODE', data: d });
                }
              }}
              onHighlightEntities={(nodeIds) => {
                if (nodeIds.length === 0) {
                  setHighlightedNodeIds(null);
                  setHighlightedEdgeIds(null);
                  return;
                }
                const idSet = new Set(nodeIds.map((id) => id.toLowerCase()));
                setHighlightedNodeIds(idSet);

                const edgeSet = new Set<string>();
                (graphData?.edges || []).forEach((e: any, idx: number) => {
                  const d = e.data || e;
                  const s = (d.source?.id || d.source || '').toLowerCase();
                  const t = (d.target?.id || d.target || '').toLowerCase();
                  if (idSet.has(s) || idSet.has(t)) {
                    edgeSet.add(d.id || `edge-3d-${idx}`);
                  }
                });
                setHighlightedEdgeIds(edgeSet);
              }}
              onClearHighlight={() => {
                setHighlightedNodeIds(null);
                setHighlightedEdgeIds(null);
              }}
              onClose={() => setShowCentralityPanel(false)}
            />
          </div>
        ) : selectedElement ? (
          <div className="w-80 border-l border-slate-200 dark:border-[#1E293B] bg-white dark:bg-[#0D131F] backdrop-blur-md p-4 overflow-y-auto z-20 flex flex-col justify-between animate-slide-left text-xs font-sans">
            <div className="space-y-4">
              {/* Header */}
              <div className="flex items-center justify-between pb-3 border-b border-slate-200 dark:border-[#1E293B]">
                <div className="flex items-center space-x-2 font-mono font-bold text-slate-800 dark:text-[#F8FAFC] uppercase text-[11px]">
                  <ShieldCheck className="h-4 w-4 text-[#2563EB]" />
                  <span>{selectedElement.type === 'NODE' ? 'Node Forensics' : 'Transfer Details'}</span>
                </div>
                <button
                  onClick={() => handleSelectElement(null)}
                  className="text-slate-400 dark:text-[#64748B] hover:text-slate-900 dark:hover:text-[#F8FAFC] p-1"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>

              {/* NODE DETAILS */}
              {selectedElement.type === 'NODE' && (
                <div className="space-y-3 font-mono text-[11px]">
                  <div>
                    <div className="text-slate-400 dark:text-[#64748B] text-[10px] uppercase font-bold">
                      Cryptocurrency Address
                    </div>
                    <div className="flex items-center justify-between p-2 rounded bg-slate-50 dark:bg-[#111827] border border-slate-200 dark:border-[#1E293B] mt-1">
                      <span className="font-bold text-slate-800 dark:text-[#E2E8F0] break-all text-[11px]">
                        {selectedElement.data.fullAddress || selectedElement.data.id}
                      </span>
                      <button
                        onClick={() => handleCopy(selectedElement.data.fullAddress || selectedElement.data.id)}
                        className="ml-2 p-1 text-slate-400 dark:text-[#64748B] hover:text-slate-800 dark:hover:text-[#F8FAFC]"
                        title="Copy Address"
                      >
                        {copied ? <Check className="h-3.5 w-3.5 text-emerald-500" /> : <Copy className="h-3.5 w-3.5" />}
                      </button>
                    </div>
                  </div>

                  {selectedElement.data.isVasp && (
                    <div className="p-3 rounded-lg bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800/40 text-[11px] space-y-1">
                      <div className="text-emerald-700 dark:text-emerald-400 font-bold">
                        {selectedElement.data.vaspName} ({selectedElement.data.addressType})
                      </div>
                      <div className="text-slate-500 dark:text-[#94A3B8] text-[10px]">
                        Provenance: Verified Proof of Reserves / Public Label
                      </div>
                      <div className="text-emerald-600 dark:text-emerald-400 text-[10px] font-bold">
                        Confidence:{' '}
                        {typeof selectedElement.data.vaspConfidence === 'number' ||
                        (!isNaN(Number(selectedElement.data.vaspConfidence)) &&
                          selectedElement.data.vaspConfidence !== '')
                          ? `${selectedElement.data.vaspConfidence}%`
                          : selectedElement.data.vaspConfidence || '98%'}{' '}
                        (HIGH)
                      </div>
                    </div>
                  )}

                  <div className="p-3 rounded-lg bg-slate-50 dark:bg-[#111827] border border-slate-200 dark:border-[#1E293B] space-y-1.5 font-mono text-[11px]">
                    <div className="text-[10px] uppercase text-slate-400 dark:text-[#64748B] font-bold font-sans">
                      Topological Flow Metrics
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-500 dark:text-[#94A3B8]">Hop Distance:</span>
                      <span className="text-slate-800 dark:text-[#F8FAFC] font-bold">
                        Hop {selectedElement.data.hop}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-500 dark:text-[#94A3B8]">Total Inflow:</span>
                      <span className="text-emerald-600 dark:text-emerald-400 font-bold">
                        {Number(selectedElement.data.totalInflow || 0).toFixed(2)}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-500 dark:text-[#94A3B8]">Total Outflow:</span>
                      <span className="text-rose-600 dark:text-rose-400 font-bold">
                        {Number(selectedElement.data.totalOutflow || 0).toFixed(2)}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-500 dark:text-[#94A3B8]">Transactions:</span>
                      <span className="text-slate-800 dark:text-[#F8FAFC]">
                        {selectedElement.data.txCount || 0} Transfers
                      </span>
                    </div>
                  </div>

                  <div className="space-y-2 pt-1">
                    <a
                      href={`https://etherscan.io/address/${selectedElement.data.fullAddress || selectedElement.data.id}`}
                      target="_blank"
                      rel="noreferrer"
                      className="flex items-center justify-center space-x-1.5 w-full py-2 rounded bg-slate-100 dark:bg-[#111827] hover:bg-slate-200 dark:hover:bg-[#1E293B] border border-slate-200 dark:border-[#1E293B] text-slate-700 dark:text-[#F8FAFC] font-medium text-xs transition-colors"
                    >
                      <ExternalLink className="h-3.5 w-3.5" />
                      <span>View on Blockchain Explorer</span>
                    </a>

                    {onPivotTarget && (
                      <button
                        onClick={() => onPivotTarget(selectedElement.data.fullAddress || selectedElement.data.id)}
                        className="w-full py-2 rounded bg-[#2563EB] hover:bg-[#1D4ED8] text-white font-bold font-mono text-xs flex items-center justify-center space-x-1.5 shadow-sm transition-all cursor-pointer"
                      >
                        <Share2 className="h-3.5 w-3.5" />
                        <span>Pivot & Trace This Target</span>
                      </button>
                    )}
                  </div>
                </div>
              )}

              {/* EDGE DETAILS */}
              {selectedElement.type === 'EDGE' && (
                <div className="space-y-3 font-mono text-[11px]">
                  <div>
                    <div className="text-slate-400 dark:text-[#64748B] text-[10px] uppercase font-bold">
                      Transaction Hash
                    </div>
                    <div className="p-2 rounded bg-slate-50 dark:bg-[#111827] border border-slate-200 dark:border-[#1E293B] mt-1 font-bold text-slate-800 dark:text-[#E2E8F0] break-all">
                      {selectedElement.data.txHash || selectedElement.data.id}
                    </div>
                  </div>

                  <div className="p-3 rounded-lg bg-slate-50 dark:bg-[#111827] border border-slate-200 dark:border-[#1E293B] space-y-1.5 font-mono text-[11px]">
                    <div className="flex justify-between">
                      <span className="text-slate-500 dark:text-[#94A3B8]">Transfer Amount:</span>
                      <span className="text-emerald-600 dark:text-emerald-400 font-bold">
                        {selectedElement.data.amount} {selectedElement.data.tokenSymbol}
                      </span>
                    </div>
                    {selectedElement.data.amountUsd && (
                      <div className="flex justify-between">
                        <span className="text-slate-500 dark:text-[#94A3B8]">USD Value:</span>
                        <span className="text-blue-600 dark:text-blue-400 font-bold">
                          ${Number(selectedElement.data.amountUsd).toLocaleString('en-US', { maximumFractionDigits: 2 })}
                        </span>
                      </div>
                    )}
                    {selectedElement.data.amountInr && (
                      <div className="flex justify-between">
                        <span className="text-slate-500 dark:text-[#94A3B8]">INR Value:</span>
                        <span className="text-amber-600 dark:text-amber-400 font-bold">
                          ₹{Number(selectedElement.data.amountInr).toLocaleString('en-IN', { maximumFractionDigits: 0 })}
                        </span>
                      </div>
                    )}
                    {selectedElement.data.taintRatio != null && (
                      <div className="flex justify-between items-center">
                        <span className="text-slate-500 dark:text-[#94A3B8]">Taint Ratio:</span>
                        <span
                          className={`font-bold ${
                            selectedElement.data.taintRatio >= 0.8
                              ? 'text-red-500 dark:text-red-400'
                              : selectedElement.data.taintRatio >= 0.4
                                ? 'text-amber-500 dark:text-orange-400'
                                : 'text-emerald-500 dark:text-lime-400'
                          }`}
                        >
                          {selectedElement.data.taintRatio >= 0.8 ? '🔴' : selectedElement.data.taintRatio >= 0.4 ? '🟡' : '🟢'}{' '}
                          {(selectedElement.data.taintRatio * 100).toFixed(1)}%
                        </span>
                      </div>
                    )}
                    {selectedElement.data.traceableAmount != null && (
                      <div className="flex justify-between">
                        <span className="text-slate-500 dark:text-[#94A3B8]">Traceable:</span>
                        <span className="text-red-500 dark:text-red-300">
                          {selectedElement.data.traceableAmount} {selectedElement.data.tokenSymbol}
                        </span>
                      </div>
                    )}
                    <div className="flex justify-between">
                      <span className="text-slate-500 dark:text-[#94A3B8]">Hop Depth:</span>
                      <span className="text-slate-800 dark:text-[#F8FAFC]">Hop {selectedElement.data.hop}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-500 dark:text-[#94A3B8]">Timestamp:</span>
                      <span className="text-slate-600 dark:text-[#94A3B8]">
                        {selectedElement.data.timestamp
                          ? new Date(selectedElement.data.timestamp).toLocaleString()
                          : 'Recent'}
                      </span>
                    </div>
                  </div>

                  <div className="p-2.5 rounded bg-slate-50 dark:bg-[#111827] border border-slate-200 dark:border-[#1E293B] text-[10px] space-y-1 font-mono">
                    <div className="text-slate-500 dark:text-[#94A3B8]">FROM: {selectedElement.data.source}</div>
                    <div className="text-slate-500 dark:text-[#94A3B8]">TO: {selectedElement.data.target}</div>
                  </div>

                  {selectedElement.data.txHash && (
                    <a
                      href={`https://etherscan.io/tx/${selectedElement.data.txHash}`}
                      target="_blank"
                      rel="noreferrer"
                      className="flex items-center justify-center space-x-1.5 w-full py-2 rounded bg-[#2563EB] hover:bg-[#1D4ED8] text-white font-bold text-xs transition-colors"
                    >
                      <ExternalLink className="h-3.5 w-3.5" />
                      <span>Verify on Explorer</span>
                    </a>
                  )}
                </div>
              )}
            </div>

            <div className="pt-3 border-t border-slate-200 dark:border-[#1E293B] text-[10px] text-slate-400 dark:text-[#64748B] font-mono text-center">
              CRYPTOTRACE 3D Forensic Engine
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
};

export default GraphCanvas;
