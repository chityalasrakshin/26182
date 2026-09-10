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
    <div className="bg-forensic-surface/95 backdrop-blur-md border border-forensic-border rounded-lg shadow-2xl flex flex-col h-full text-xs font-mono select-none overflow-hidden transition-all">
      {/* ─────────────────────────────────────────────────────────────────── */}
      {/* 1. HEADER (Styled like IBM i2 Analyst's Notebook) */}
      {/* ─────────────────────────────────────────────────────────────────── */}
      <div className="p-3 bg-forensic-surfaceRaised border-b border-forensic-border flex items-center justify-between">
        <div className="flex items-center space-x-2">
          <div className="p-1 rounded bg-blue-500/10 border border-blue-500/30 text-blue-400">
            <Network className="h-4 w-4" />
          </div>
          <div>
            <h3 className="font-bold text-forensic-text text-[12px] tracking-wide uppercase flex items-center space-x-1.5">
              <span>List Most Connected</span>
              <span className="text-[10px] px-1.5 py-0.2 rounded bg-forensic-bg border border-forensic-border text-forensic-textDim font-normal">
                EIA Intelligence
              </span>
            </h3>
            <span className="text-[10px] text-forensic-textDim block">
              Links of type: <strong className="text-forensic-text">Transaction</strong>
            </span>
          </div>
        </div>

        <div className="flex items-center space-x-1">
          {onClose && (
            <button
              onClick={onClose}
              className="p-1 rounded hover:bg-forensic-border text-forensic-textMuted hover:text-forensic-text transition-colors"
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
      <div className="grid grid-cols-2 p-1.5 bg-forensic-bg border-b border-forensic-border gap-1 text-[11px]">
        <button
          onClick={() => setActiveTab('VALUES')}
          className={`py-1.5 px-3 rounded font-bold transition-all flex items-center justify-center space-x-1.5 ${
            activeTab === 'VALUES'
              ? 'bg-blue-600 text-white shadow'
              : 'text-forensic-textMuted hover:text-forensic-text hover:bg-forensic-surfaceRaised'
          }`}
        >
          <Activity className="h-3.5 w-3.5" />
          <span>Values (Volume)</span>
        </button>
        <button
          onClick={() => setActiveTab('COUNTS')}
          className={`py-1.5 px-3 rounded font-bold transition-all flex items-center justify-center space-x-1.5 ${
            activeTab === 'COUNTS'
              ? 'bg-blue-600 text-white shadow'
              : 'text-forensic-textMuted hover:text-forensic-text hover:bg-forensic-surfaceRaised'
          }`}
        >
          <Layers className="h-3.5 w-3.5" />
          <span>Counts (Degree)</span>
        </button>
      </div>

      {/* ─────────────────────────────────────────────────────────────────── */}
      {/* 3. METRIC SUMMARY CARDS (Inbound / Outbound / Pass-Through) */}
      {/* ─────────────────────────────────────────────────────────────────── */}
      <div className="p-2.5 bg-forensic-surfaceRaised/40 border-b border-forensic-border grid grid-cols-3 gap-2 text-[10px]">
        <div className="p-2 rounded bg-forensic-bg border border-forensic-border space-y-0.5">
          <div className="flex items-center space-x-1 text-emerald-400">
            <ArrowDownLeft className="h-3 w-3" />
            <span className="uppercase tracking-wider font-semibold">Inbound</span>
          </div>
          <div className="font-bold text-forensic-text text-[11px]">
            {formatAmount(totals.totalInboundVol)} {primaryToken}
          </div>
          <div className="text-forensic-textDim text-[9px]">Total Received</div>
        </div>

        <div className="p-2 rounded bg-forensic-bg border border-forensic-border space-y-0.5">
          <div className="flex items-center space-x-1 text-red-400">
            <ArrowUpRight className="h-3 w-3" />
            <span className="uppercase tracking-wider font-semibold">Outbound</span>
          </div>
          <div className="font-bold text-forensic-text text-[11px]">
            {formatAmount(totals.totalOutboundVol)} {primaryToken}
          </div>
          <div className="text-forensic-textDim text-[9px]">Total Dispersed</div>
        </div>

        <div
          onClick={() => setShowLowNetChangeOnly(!showLowNetChangeOnly)}
          className={`p-2 rounded border cursor-pointer transition-all space-y-0.5 ${
            showLowNetChangeOnly
              ? 'bg-amber-500/15 border-amber-500/50 text-amber-400'
              : 'bg-forensic-bg border-forensic-border hover:border-amber-500/40 text-forensic-text'
          }`}
          title="Filter wallets that pass through funds without holding (Smurfing / Layering mules)"
        >
          <div className="flex items-center space-x-1 text-amber-400">
            <TrendingDown className="h-3 w-3" />
            <span className="uppercase tracking-wider font-semibold">Low Net</span>
          </div>
          <div className="font-bold text-[11px] flex items-center justify-between">
            <span>{totals.lowNetCount} Mules</span>
            {showLowNetChangeOnly && <Check className="h-3 w-3 text-amber-400" />}
          </div>
          <div className="text-forensic-textDim text-[9px]">Rapid Transit</div>
        </div>
      </div>

      {/* ─────────────────────────────────────────────────────────────────── */}
      {/* 4. SEARCH & LIMIT FILTER */}
      {/* ─────────────────────────────────────────────────────────────────── */}
      <div className="p-2 border-b border-forensic-border flex items-center space-x-2 bg-forensic-surface">
        <div className="relative flex-1">
          <Search className="h-3 w-3 absolute left-2 top-2 text-forensic-textDim" />
          <input
            type="text"
            placeholder="Filter by wallet or tag..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full bg-forensic-bg border border-forensic-border rounded pl-7 pr-2 py-1 text-[11px] text-forensic-text placeholder-forensic-textDim focus:outline-none focus:border-blue-500"
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery('')}
              className="absolute right-2 top-1.5 text-forensic-textDim hover:text-forensic-text"
            >
              <X className="h-3 w-3" />
            </button>
          )}
        </div>

        <div className="flex items-center space-x-1 text-[10px] text-forensic-textDim">
          <span>Show:</span>
          {[50, 100, 250].map((lim) => (
            <button
              key={lim}
              onClick={() => setDisplayLimit(lim)}
              className={`px-1.5 py-0.5 rounded ${
                displayLimit === lim
                  ? 'bg-blue-600 text-white font-bold'
                  : 'bg-forensic-surfaceRaised hover:text-forensic-text'
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
      <div className="p-2.5 bg-forensic-surfaceRaised/50 border-b border-forensic-border space-y-2">
        <div className="flex items-center justify-between text-[11px]">
          <span className="text-forensic-text font-semibold flex items-center space-x-1">
            <Sliders className="h-3.5 w-3.5 text-blue-400" />
            <span>Entities with Highest {activeTab === 'VALUES' ? 'Volume' : 'Connections'}</span>
          </span>
          <span className="text-blue-400 font-bold">Top {percentileCutoff}%</span>
        </div>

        {/* Range Slider matching IBM i2 Frame 180s */}
        <div className="flex items-center space-x-2">
          <span className="text-[10px] text-forensic-textDim">Top 5%</span>
          <input
            type="range"
            min="5"
            max="100"
            step="5"
            value={percentileCutoff}
            onChange={(e) => handleSliderChange(Number(e.target.value))}
            className="w-full accent-blue-500 cursor-pointer h-1.5 bg-forensic-border rounded-lg"
          />
          <span className="text-[10px] text-forensic-textDim">100%</span>
        </div>

        {/* Quick Highlight Buttons */}
        <div className="flex items-center space-x-1.5 pt-1">
          <button
            onClick={() => handleHighlightTopN(10)}
            className="flex-1 py-1 px-2 rounded bg-blue-600/20 hover:bg-blue-600/30 border border-blue-500/40 text-blue-400 font-bold text-[10px] flex items-center justify-center space-x-1 transition-colors"
          >
            <Sparkles className="h-3 w-3 text-amber-400" />
            <span>Highlight Top 10</span>
          </button>

          <button
            onClick={() => handleHighlightTopN(25)}
            className="flex-1 py-1 px-2 rounded bg-purple-600/20 hover:bg-purple-600/30 border border-purple-500/40 text-purple-300 font-bold text-[10px] flex items-center justify-center space-x-1 transition-colors"
          >
            <Eye className="h-3 w-3" />
            <span>Top 25</span>
          </button>

          <button
            onClick={handleResetHighlight}
            className="py-1 px-2.5 rounded bg-forensic-bg hover:bg-forensic-surfaceRaised border border-forensic-border text-forensic-textMuted hover:text-forensic-text font-medium text-[10px] flex items-center space-x-1 transition-colors"
            title="Undo Canvas Highlighting"
          >
            <RotateCcw className="h-3 w-3" />
            <span>Reset</span>
          </button>
        </div>

        {highlightedCount > 0 && (
          <div className="text-[10px] text-amber-400 flex items-center justify-between pt-0.5">
            <span>Currently illuminating {highlightedCount} key entities on canvas</span>
            <button onClick={handleResetHighlight} className="underline hover:text-amber-300">
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
          <div className="p-6 text-center text-forensic-textDim text-xs">
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
                className={`p-2 rounded border transition-all cursor-pointer group ${
                  isSelected
                    ? 'bg-blue-600/20 border-blue-500 shadow-md'
                    : 'bg-forensic-bg hover:bg-forensic-surfaceRaised border-forensic-border'
                }`}
              >
                {/* Header: Rank + Address / Label + Tags */}
                <div className="flex items-center justify-between mb-1">
                  <div className="flex items-center space-x-1.5 truncate">
                    <span className="text-[10px] font-bold text-forensic-textDim w-5">
                      #{idx + 1}
                    </span>
                    <span className="font-bold text-forensic-text truncate max-w-[140px]" title={entity.address}>
                      {entity.vaspName ? (
                        <span className="text-blue-400 font-bold">{entity.vaspName}</span>
                      ) : (
                        `${entity.address.slice(0, 6)}...${entity.address.slice(-4)}`
                      )}
                    </span>
                  </div>

                  <div className="flex items-center space-x-1">
                    {entity.isFlaggedAml && (
                      <span className="text-[9px] px-1 py-0.2 rounded bg-red-500/20 text-red-400 border border-red-500/40 font-bold uppercase">
                        FLAGGED
                      </span>
                    )}
                    {entity.isConsolidation && !entity.isFlaggedAml && (
                      <span className="text-[9px] px-1 py-0.2 rounded bg-amber-500/20 text-amber-400 border border-amber-500/40 font-bold uppercase">
                        CONSOL
                      </span>
                    )}
                    {entity.isLowNetChange && (
                      <span className="text-[9px] px-1 py-0.2 rounded bg-purple-500/20 text-purple-300 border border-purple-500/40 font-bold uppercase" title="Mule wallet: rapid pass-through">
                        MULE
                      </span>
                    )}
                    <span className="text-[9px] text-forensic-textDim">
                      Hop {entity.hop}
                    </span>
                  </div>
                </div>

                {/* Progress Bar (Visualizing Volume / Degree Dominance) */}
                <div className="w-full bg-forensic-surfaceRaised h-1 rounded-full overflow-hidden my-1">
                  <div
                    className={`h-full transition-all ${
                      entity.isFlaggedAml
                        ? 'bg-red-500'
                        : entity.isConsolidation
                        ? 'bg-amber-500'
                        : 'bg-blue-500'
                    }`}
                    style={{ width: `${Math.max(activeTab === 'VALUES' ? volumeShare : linkShare, 4)}%` }}
                  />
                </div>

                {/* Detail Breakdown */}
                <div className="grid grid-cols-3 gap-1 text-[10px] text-forensic-textDim pt-0.5">
                  <div>
                    <span className="block text-[9px] uppercase">Inbound</span>
                    <span className="text-emerald-400 font-semibold">
                      {formatAmount(entity.inboundVolume)}
                    </span>
                    <span className="text-[8px] block">({entity.inboundLinks} tx)</span>
                  </div>

                  <div>
                    <span className="block text-[9px] uppercase">Outbound</span>
                    <span className="text-red-400 font-semibold">
                      {formatAmount(entity.outboundVolume)}
                    </span>
                    <span className="text-[8px] block">({entity.outboundLinks} tx)</span>
                  </div>

                  <div className="text-right">
                    <span className="block text-[9px] uppercase">Net Flow</span>
                    <span
                      className={`font-semibold ${
                        entity.netVolume > 0
                          ? 'text-emerald-400'
                          : entity.netVolume < 0
                          ? 'text-red-400'
                          : 'text-forensic-text'
                      }`}
                    >
                      {entity.netVolume > 0 ? '+' : ''}
                      {formatAmount(entity.netVolume)}
                    </span>
                    <span className="text-[8px] block text-forensic-textMuted">
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
      <div className="p-2 bg-forensic-surfaceRaised border-t border-forensic-border text-[10px] text-forensic-textDim flex items-center justify-between">
        <span>Showing {displayedEntities.length} of {sortedEntities.length} entities</span>
        <span className="font-semibold text-forensic-text">
          {totals.totalLinks} Transaction Links
        </span>
      </div>
    </div>
  );
};
