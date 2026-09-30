'use client';

import React, { useState, useMemo } from 'react';
import {
  Network,
  ArrowDownLeft,
  ArrowUpRight,
  Activity,
  Sliders,
  Sparkles,
  RotateCcw,
  Search,
  Filter,
  Eye,
  AlertTriangle,
  ChevronDown,
  ChevronUp,
  X,
  Layers,
  TrendingDown,
  Check
} from 'lucide-react';
import { GraphData, GraphNode, GraphEdge } from '../lib/types';

export interface EntityMetrics {
  id: string;
  address: string;
  label: string;
  role: string;
  isVasp: boolean;
  vaspName?: string | null;
  hop: number;
  inboundLinks: number;
  outboundLinks: number;
  totalLinks: number;
  inboundVolume: number;
  outboundVolume: number;
  totalVolume: number;
  netVolume: number;
  isLowNetChange: boolean; // Pass-through / mule indicator
  primaryToken: string;
  isFlaggedAml?: boolean;
  isConsolidation?: boolean;
}

interface EntityCentralityPanelProps {
  graphData: GraphData | null | undefined;
  onSelectEntity: (nodeId: string) => void;
  onHighlightEntities: (nodeIds: string[]) => void;
  onClearHighlight: () => void;
  selectedNodeId?: string | null;
  onClose?: () => void;
}

export const EntityCentralityPanel: React.FC<EntityCentralityPanelProps> = ({
  graphData,
  onSelectEntity,
  onHighlightEntities,
  onClearHighlight,
  selectedNodeId,
  onClose,
}) => {
  const [activeTab, setActiveTab] = useState<'VALUES' | 'COUNTS'>('VALUES');
  const [searchQuery, setSearchQuery] = useState('');
  const [percentileCutoff, setPercentileCutoff] = useState<number>(50);
  const [showLowNetChangeOnly, setShowLowNetChangeOnly] = useState<boolean>(false);
  const [highlightedCount, setHighlightedCount] = useState<number>(0);
  const [displayLimit, setDisplayLimit] = useState<number>(50);

  // Compute all entity metrics from graph data
  const { entityMetrics, totals, maxVolume, maxLinks, primaryToken } = useMemo(() => {
    if (!graphData?.nodes || graphData.nodes.length === 0) {
      return {
        entityMetrics: [],
        totals: {
          totalInboundVol: 0,
          totalOutboundVol: 0,
          netFlow: 0,
          totalVolume: 0,
          lowNetCount: 0,
          totalLinks: 0,
        },
        maxVolume: 1,
        maxLinks: 1,
        primaryToken: 'BTC',
      };
    }

    const nodeMap = new Map<string, EntityMetrics>();
    let detectedToken = 'BTC';

    graphData.nodes.forEach((n: any) => {
      const d = n.data || n;
      const id = d.id || d.address;
      const isRoot = d.role === 'INPUT_WALLET' || d.is_root || d.hop === 0;
      const isVasp = Boolean(d.is_vasp || d.role === 'KNOWN_VASP');

      nodeMap.set(id, {
        id,
        address: d.address || id,
        label: d.label || `${id.slice(0, 8)}...`,
        role: d.role || 'INTERMEDIARY',
        isVasp,
        vaspName: d.vasp_name || null,
        hop: d.hop ?? 1,
        inboundLinks: 0,
        outboundLinks: 0,
        totalLinks: 0,
        inboundVolume: 0,
        outboundVolume: 0,
        totalVolume: 0,
        netVolume: 0,
        isLowNetChange: false,
        primaryToken: 'BTC',
        isFlaggedAml: isRoot || d.risk_level === 'CRITICAL' || d.tag === 'sanctioned',
        isConsolidation: isVasp || d.role === 'CONSOLIDATION_HUB',
      });
    });

    // Tally from edges
    graphData.edges?.forEach((e: any) => {
      const d = e.data || e;
      const src = d.source;
      const tgt = d.target;
      const amt = Number(d.amount || 0);
      const sym = d.asset_symbol || d.token_symbol || 'BTC';
      if (sym) detectedToken = sym.toUpperCase();

      const srcEntity = nodeMap.get(src);
      if (srcEntity) {
        srcEntity.outboundLinks += 1;
        srcEntity.outboundVolume += amt;
      }

      const tgtEntity = nodeMap.get(tgt);
      if (tgtEntity) {
        tgtEntity.inboundLinks += 1;
        tgtEntity.inboundVolume += amt;
      }
    });

    let totalInboundVol = 0;
    let totalOutboundVol = 0;
    let lowNetCount = 0;
    let totalGraphLinks = graphData.edges?.length || 0;

    const list: EntityMetrics[] = [];

    nodeMap.forEach((ent) => {
      ent.totalLinks = ent.inboundLinks + ent.outboundLinks;
      ent.totalVolume = ent.inboundVolume + ent.outboundVolume;
      ent.netVolume = ent.inboundVolume - ent.outboundVolume;
      ent.primaryToken = detectedToken;

      // Low net change: wallet that rapidly passes through > 80% of funds (classic layering mule)
      if (ent.totalVolume > 0 && ent.inboundVolume > 0 && ent.outboundVolume > 0) {
        const turnoverRatio = Math.abs(ent.netVolume) / ent.totalVolume;
        if (turnoverRatio < 0.2) {
          ent.isLowNetChange = true;
          lowNetCount += 1;
        }
      }

      totalInboundVol += ent.inboundVolume;
      totalOutboundVol += ent.outboundVolume;
      list.push(ent);
    });

    const maxVol = Math.max(...list.map((m) => m.totalVolume), 1);
    const maxLk = Math.max(...list.map((m) => m.totalLinks), 1);

    return {
      entityMetrics: list,
      totals: {
        totalInboundVol,
        totalOutboundVol,
        netFlow: totalInboundVol - totalOutboundVol,
        totalVolume: (totalInboundVol + totalOutboundVol) / 2,
        lowNetCount,
        totalLinks: totalGraphLinks,
      },
      maxVolume: maxVol,
      maxLinks: maxLk,
      primaryToken: detectedToken,
    };
  }, [graphData]);

  // Sort and filter entities
  const sortedEntities = useMemo(() => {
    let result = [...entityMetrics];

    // Search query filter
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      result = result.filter(
        (e) =>
          e.address.toLowerCase().includes(q) ||
          e.label.toLowerCase().includes(q) ||
          (e.vaspName && e.vaspName.toLowerCase().includes(q))
      );
    }

    // Low net change filter (Layering mule focus)
    if (showLowNetChangeOnly) {
      result = result.filter((e) => e.isLowNetChange);
    }

    // Sort by Tab selection
    if (activeTab === 'VALUES') {
      result.sort((a, b) => b.totalVolume - a.totalVolume);
    } else {
      result.sort((a, b) => b.totalLinks - a.totalLinks);
    }

    return result;
  }, [entityMetrics, activeTab, searchQuery, showLowNetChangeOnly]);

  const displayedEntities = useMemo(() => {
    return sortedEntities.slice(0, displayLimit);
  }, [sortedEntities, displayLimit]);

  // Format currency helpers
  const formatAmount = (num: number) => {
    if (num >= 1000000) return (num / 1000000).toFixed(2) + 'M';
    if (num >= 1000) return (num / 1000).toFixed(2) + 'k';
    if (num > 0 && num < 0.01) return num.toFixed(6);
    return num.toFixed(3);
  };

  // One-click Top N highlight
  const handleHighlightTopN = (n: number) => {
    const topIds = sortedEntities.slice(0, n).map((e) => e.id);
    onHighlightEntities(topIds);
    setHighlightedCount(topIds.length);
  };

  // Highlight by percentile slider
  const handleSliderChange = (percent: number) => {
    setPercentileCutoff(percent);
    const count = Math.max(1, Math.round((percent / 100) * sortedEntities.length));
    const topIds = sortedEntities.slice(0, count).map((e) => e.id);
    onHighlightEntities(topIds);
    setHighlightedCount(topIds.length);
  };

  const handleResetHighlight = () => {
    onClearHighlight();
    setHighlightedCount(0);
  };

  return (
    <div className="bg-[#0A0A0A]/95 backdrop-blur-md border border-[#2A2A2A] rounded-lg shadow-2xl flex flex-col h-full text-xs font-mono select-none overflow-hidden transition-all text-[#FFFFFF]">
      {/* ─────────────────────────────────────────────────────────────────── */}
      {/* 1. HEADER (Styled like IBM i2 Analyst's Notebook) */}
      {/* ─────────────────────────────────────────────────────────────────── */}
      <div className="p-3 bg-slate-50 dark:bg-[#090D16] border-b border-slate-200 dark:border-[#1E293B] flex items-center justify-between">
        <div className="flex items-center space-x-2">
          <div className="p-1 rounded bg-[#E5FF8F]/10 border border-[#E5FF8F]/30 text-[#E5FF8F]">
            <Network className="h-4 w-4" />
          </div>
          <div>
            <h3 className="font-bold text-slate-800 dark:text-[#F8FAFC] text-[12px] tracking-wide uppercase flex items-center space-x-1.5">
              <span>List Most Connected</span>
              <span className="text-[10px] px-1.5 py-0.2 rounded bg-slate-100 dark:bg-[#111827] border border-slate-200 dark:border-[#1E293B] text-slate-600 dark:text-[#94A3B8] font-normal">
                EIA Intelligence
              </span>
            </h3>
            <span className="text-[10px] text-slate-500 dark:text-[#94A3B8] block">
              Links of type: <strong className="text-slate-800 dark:text-[#F8FAFC]">Transaction</strong>
            </span>
          </div>
        </div>

        <div className="flex items-center space-x-1">
          {onClose && (
            <button
              onClick={onClose}
              className="p-1 rounded hover:bg-slate-100 dark:hover:bg-[#1E293B] text-slate-400 dark:text-[#94A3B8] hover:text-slate-800 dark:hover:text-[#F8FAFC] transition-colors"
              title="Close Panel"
            >
              <X className="h-4 w-4" />
            </button>
          )}
        </div>
      </div>

      {/* ─────────────────────────────────────────────────────────────────── */}
      {/* 2. MODE TABS: Counts vs Values */}
      {/* ─────────────────────────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 p-1.5 bg-slate-100 dark:bg-[#090D16] border-b border-slate-200 dark:border-[#1E293B] gap-1 text-[11px]">
        <button
          onClick={() => setActiveTab('VALUES')}
          className={`py-1.5 px-3 rounded font-bold transition-all flex items-center justify-center space-x-1.5 ${activeTab === 'VALUES'
            ? 'bg-[#E5FF8F] text-[#0A0A0A] shadow'
            : 'text-slate-600 dark:text-[#94A3B8] hover:text-slate-900 dark:hover:text-[#F8FAFC] hover:bg-slate-200 dark:hover:bg-[#111827]'
            }`}
        >
          <Activity className="h-3.5 w-3.5" />
          <span>Values (Volume)</span>
        </button>
        <button
          onClick={() => setActiveTab('COUNTS')}
          className={`py-1.5 px-3 rounded font-bold transition-all flex items-center justify-center space-x-1.5 ${activeTab === 'COUNTS'
            ? 'bg-[#E5FF8F] text-[#0A0A0A] shadow'
            : 'text-slate-600 dark:text-[#94A3B8] hover:text-slate-900 dark:hover:text-[#F8FAFC] hover:bg-slate-200 dark:hover:bg-[#111827]'
            }`}
        >
          <Layers className="h-3.5 w-3.5" />
          <span>Counts (Degree)</span>
        </button>
      </div>

      {/* ─────────────────────────────────────────────────────────────────── */}
      {/* 3. METRIC SUMMARY CARDS (Inbound / Outbound / Pass-Through) */}
      {/* ─────────────────────────────────────────────────────────────────── */}
      <div className="p-2.5 bg-slate-50/50 dark:bg-[#090D16]/40 border-b border-slate-200 dark:border-[#1E293B] grid grid-cols-3 gap-2 text-[10px]">
        <div className="p-2 rounded bg-white dark:bg-[#0D131F] border border-slate-200 dark:border-[#1E293B] space-y-0.5">
          <div className="flex items-center space-x-1 text-emerald-600 dark:text-emerald-400">
            <ArrowDownLeft className="h-3 w-3" />
            <span className="uppercase tracking-wider font-semibold">Inbound</span>
          </div>
          <div className="font-bold text-slate-800 dark:text-[#F8FAFC] text-[11px]">
            {formatAmount(totals.totalInboundVol)} {primaryToken}
          </div>
          <div className="text-slate-400 dark:text-[#94A3B8] text-[9px]">Total Received</div>
        </div>

        <div className="p-2 rounded bg-white dark:bg-[#0D131F] border border-slate-200 dark:border-[#1E293B] space-y-0.5">
          <div className="flex items-center space-x-1 text-rose-600 dark:text-rose-400">
            <ArrowUpRight className="h-3 w-3" />
            <span className="uppercase tracking-wider font-semibold">Outbound</span>
          </div>
          <div className="font-bold text-slate-800 dark:text-[#F8FAFC] text-[11px]">
            {formatAmount(totals.totalOutboundVol)} {primaryToken}
          </div>
          <div className="text-slate-400 dark:text-[#94A3B8] text-[9px]">Total Dispersed</div>
        </div>

        <div
          onClick={() => setShowLowNetChangeOnly(!showLowNetChangeOnly)}
          className={`p-2 rounded border cursor-pointer transition-all space-y-0.5 ${showLowNetChangeOnly
            ? 'bg-[#E5FF8F]/15 border-[#E5FF8F]/50 text-[#E5FF8F]'
            : 'bg-white dark:bg-[#0D131F] border-slate-200 dark:border-[#1E293B] hover:border-[#E5FF8F]/40 text-slate-800 dark:text-[#F8FAFC]'
            }`}
          title="Filter wallets that pass through funds without holding (Smurfing / Layering mules)"
        >
          <div className="flex items-center space-x-1 text-[#E5FF8F]">
            <TrendingDown className="h-3 w-3" />
            <span className="uppercase tracking-wider font-semibold">Low Net</span>
          </div>
          <div className="font-bold text-[11px] flex items-center justify-between">
            <span>{totals.lowNetCount} Mules</span>
            {showLowNetChangeOnly && <Check className="h-3 w-3 text-[#E5FF8F]" />}
          </div>
          <div className="text-slate-400 dark:text-[#94A3B8] text-[9px]">Rapid Transit</div>
        </div>
      </div>

      {/* ─────────────────────────────────────────────────────────────────── */}
      {/* 4. SEARCH & LIMIT FILTER */}
      {/* ─────────────────────────────────────────────────────────────────── */}
      <div className="p-2 border-b border-slate-200 dark:border-[#1E293B] flex items-center space-x-2 bg-white dark:bg-[#0D131F]">
        <div className="relative flex-1">
          <Search className="h-3 w-3 absolute left-2 top-2 text-slate-400 dark:text-[#64748B]" />
          <input
            type="text"
            placeholder="Filter by wallet or tag..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full bg-slate-50 dark:bg-[#111827] border border-slate-200 dark:border-[#1E293B] rounded pl-7 pr-2 py-1 text-[11px] text-slate-800 dark:text-[#F8FAFC] placeholder-slate-400 dark:placeholder-[#64748B] focus:outline-none focus:border-[#E5FF8F]"
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery('')}
              className="absolute right-2 top-1.5 text-slate-400 hover:text-slate-800 dark:hover:text-[#F8FAFC]"
            >
              <X className="h-3 w-3" />
            </button>
          )}
        </div>

        <div className="flex items-center space-x-1 text-[10px] text-slate-500 dark:text-[#94A3B8]">
          <span>Show:</span>
          {[50, 100, 250].map((lim) => (
            <button
              key={lim}
              onClick={() => setDisplayLimit(lim)}
              className={`px-1.5 py-0.5 rounded transition-colors ${displayLimit === lim
                ? 'bg-[#E5FF8F] text-[#0A0A0A] font-bold'
                : 'bg-slate-100 dark:bg-[#111827] text-slate-600 dark:text-[#94A3B8] hover:text-slate-900 dark:hover:text-[#F8FAFC]'
                }`}
            >
              {lim}
            </button>
          ))}
        </div>
      </div>

      {/* ─────────────────────────────────────────────────────────────────── */}
      {/* 5. INTERACTIVE RANKING SLIDER & ACTION BUTTONS (from IBM i2) */}
      {/* ─────────────────────────────────────────────────────────────────── */}
      <div className="p-2.5 bg-slate-50 dark:bg-[#090D16] border-b border-slate-200 dark:border-[#1E293B] space-y-2">
        <div className="flex items-center justify-between text-[11px]">
          <span className="text-slate-800 dark:text-[#F8FAFC] font-semibold flex items-center space-x-1">
            <Sliders className="h-3.5 w-3.5 text-[#E5FF8F]" />
            <span>Entities with Highest {activeTab === 'VALUES' ? 'Volume' : 'Connections'}</span>
          </span>
          <span className="text-[#E5FF8F] font-bold">Top {percentileCutoff}%</span>
        </div>

        {/* Range Slider matching IBM i2 Frame 180s */}
        <div className="flex items-center space-x-2">
          <span className="text-[10px] text-slate-500 dark:text-[#94A3B8]">Top 5%</span>
          <input
            type="range"
            min="5"
            max="100"
            step="5"
            value={percentileCutoff}
            onChange={(e) => handleSliderChange(Number(e.target.value))}
            className="w-full accent-[#E5FF8F] cursor-pointer h-1.5 bg-slate-200 dark:bg-[#1E293B] rounded-lg"
          />
          <span className="text-[10px] text-slate-500 dark:text-[#94A3B8]">100%</span>
        </div>

        {/* Quick Highlight Buttons */}
        <div className="flex items-center space-x-1.5 pt-1">
          <button
            onClick={() => handleHighlightTopN(10)}
            className="flex-1 py-1 px-2 rounded bg-[#E5FF8F] hover:bg-[#EDFFB1] text-[#0A0A0A] font-bold text-[10px] flex items-center justify-center space-x-1 transition-colors"
          >
            <Sparkles className="h-3 w-3 text-white" />
            <span>Highlight Top 10</span>
          </button>

          <button
            onClick={() => handleHighlightTopN(25)}
            className="flex-1 py-1 px-2 rounded bg-slate-100 dark:bg-[#111827] hover:bg-slate-200 dark:hover:bg-[#1E293B] border border-slate-200 dark:border-[#1E293B] text-slate-700 dark:text-[#F8FAFC] font-bold text-[10px] flex items-center justify-center space-x-1 transition-colors"
          >
            <Eye className="h-3 w-3" />
            <span>Top 25</span>
          </button>

          <button
            onClick={handleResetHighlight}
            className="py-1 px-2.5 rounded bg-slate-100 dark:bg-[#111827] hover:bg-slate-200 dark:hover:bg-[#1E293B] border border-slate-200 dark:border-[#1E293B] text-slate-600 dark:text-[#94A3B8] hover:text-slate-900 dark:hover:text-[#F8FAFC] font-medium text-[10px] flex items-center space-x-1 transition-colors"
            title="Undo Canvas Highlighting"
          >
            <RotateCcw className="h-3 w-3" />
            <span>Reset</span>
          </button>
        </div>

        {highlightedCount > 0 && (
          <div className="text-[10px] text-emerald-600 dark:text-emerald-400 flex items-center justify-between pt-0.5">
            <span>Currently illuminating {highlightedCount} key entities on canvas</span>
            <button onClick={handleResetHighlight} className="underline hover:text-emerald-700 dark:hover:text-emerald-300">
              Clear
            </button>
          </div>
        )}
      </div>

      {/* ─────────────────────────────────────────────────────────────────── */}
      {/* 6. ENTITY RANKING LIST */}
      {/* ─────────────────────────────────────────────────────────────────── */}
      <div className="flex-1 overflow-y-auto p-2 space-y-1.5">
        {displayedEntities.length === 0 ? (
          <div className="p-6 text-center text-slate-400 dark:text-[#64748B] text-xs">
            No entities match current filters
          </div>
        ) : (
          displayedEntities.map((entity, idx) => {
            const isSelected = selectedNodeId === entity.id;
            const volumeShare = (entity.totalVolume / maxVolume) * 100;
            const linkShare = (entity.totalLinks / maxLinks) * 100;

            return (
              <div
                key={entity.id}
                onClick={() => onSelectEntity(entity.id)}
                className={`p-2 rounded border transition-all cursor-pointer group ${isSelected
                  ? 'bg-[#E5FF8F]/10 border-[#E5FF8F] shadow-md'
                  : 'bg-white dark:bg-[#0D131F] hover:bg-slate-50 dark:hover:bg-[#111827] border-slate-200 dark:border-[#1E293B]'
                  }`}
              >
                {/* Header: Rank + Address / Label + Tags */}
                <div className="flex items-center justify-between mb-1">
                  <div className="flex items-center space-x-1.5 truncate">
                    <span className="text-[10px] font-bold text-slate-400 dark:text-[#64748B] w-5">
                      #{idx + 1}
                    </span>
                    <span className="font-bold text-slate-800 dark:text-[#E2E8F0] truncate max-w-[140px]" title={entity.address}>
                      {entity.vaspName ? (
                        <span className="text-[#E5FF8F] font-bold">{entity.vaspName}</span>
                      ) : (
                        `${entity.address.slice(0, 6)}...${entity.address.slice(-4)}`
                      )}
                    </span>
                  </div>

                  <div className="flex items-center space-x-1">
                    {entity.isFlaggedAml && (
                      <span className="text-[9px] px-1 py-0.2 rounded bg-rose-50 dark:bg-rose-950/40 text-rose-700 dark:text-rose-400 border border-rose-200 dark:border-rose-800/50 font-bold uppercase">
                        FLAGGED
                      </span>
                    )}
                    {entity.isConsolidation && !entity.isFlaggedAml && (
                      <span className="text-[9px] px-1 py-0.2 rounded bg-[#E5FF8F]/10 text-[#E5FF8F] border border-[#E5FF8F]/30 font-bold uppercase">
                        CONSOL
                      </span>
                    )}
                    {entity.isLowNetChange && (
                      <span className="text-[9px] px-1 py-0.2 rounded bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-400 border border-amber-200 dark:border-amber-800/50 font-bold uppercase" title="Mule wallet: rapid pass-through">
                        MULE
                      </span>
                    )}
                    <span className="text-[9px] text-slate-400 dark:text-[#64748B]">
                      Hop {entity.hop}
                    </span>
                  </div>
                </div>

                {/* Progress Bar (Visualizing Volume / Degree Dominance) */}
                <div className="w-full bg-slate-100 dark:bg-[#111827] h-1 rounded-full overflow-hidden my-1">
                  <div
                    className={`h-full transition-all ${entity.isFlaggedAml
                      ? 'bg-rose-500'
                      : entity.isConsolidation
                        ? 'bg-[#E5FF8F]'
                        : 'bg-emerald-500'
                      }`}
                    style={{ width: `${Math.max(activeTab === 'VALUES' ? volumeShare : linkShare, 4)}%` }}
                  />
                </div>

                {/* Detail Breakdown */}
                <div className="grid grid-cols-3 gap-1 text-[10px] text-slate-500 dark:text-[#94A3B8] pt-0.5">
                  <div>
                    <span className="block text-[9px] uppercase">Inbound</span>
                    <span className="text-emerald-600 dark:text-emerald-400 font-semibold">
                      {formatAmount(entity.inboundVolume)}
                    </span>
                    <span className="text-[8px] block">({entity.inboundLinks} tx)</span>
                  </div>

                  <div>
                    <span className="block text-[9px] uppercase">Outbound</span>
                    <span className="text-rose-600 dark:text-rose-400 font-semibold">
                      {formatAmount(entity.outboundVolume)}
                    </span>
                    <span className="text-[8px] block">({entity.outboundLinks} tx)</span>
                  </div>

                  <div className="text-right">
                    <span className="block text-[9px] uppercase">Net Flow</span>
                    <span
                      className={`font-semibold ${entity.netVolume > 0
                        ? 'text-emerald-600 dark:text-emerald-400'
                        : entity.netVolume < 0
                          ? 'text-rose-600 dark:text-rose-400'
                          : 'text-slate-800 dark:text-[#F8FAFC]'
                        }`}
                    >
                      {entity.netVolume > 0 ? '+' : ''}
                      {formatAmount(entity.netVolume)}
                    </span>
                    <span className="text-[8px] block text-slate-400 dark:text-[#64748B]">
                      Tot: {formatAmount(entity.totalVolume)}
                    </span>
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* ─────────────────────────────────────────────────────────────────── */}
      {/* 7. FOOTER STATUS */}
      {/* ─────────────────────────────────────────────────────────────────── */}
      <div className="p-2 bg-slate-50 dark:bg-[#090D16] border-t border-slate-200 dark:border-[#1E293B] text-[10px] text-slate-500 dark:text-[#94A3B8] flex items-center justify-between">
        <span>Showing {displayedEntities.length} of {sortedEntities.length} entities</span>
        <span className="font-semibold text-slate-800 dark:text-[#F8FAFC]">
          {totals.totalLinks} Transaction Links
        </span>
      </div>
    </div>
  );
};
