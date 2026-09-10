'use client';

import React, { useEffect, useRef, useState, useMemo, useCallback } from 'react';
import cytoscape from 'cytoscape';
import dagre from 'cytoscape-dagre';
import {
  Maximize2,
  Minimize2,
  ZoomIn,
  ZoomOut,
  RotateCcw,
  SlidersHorizontal,
  ChevronLeft,
  ChevronRight,
  ShieldCheck,
  ExternalLink,
  Copy,
  Check,
  X,
  Layers,
  ArrowRight,
  TrendingUp,
  Activity,
  Filter,
  Eye,
  Network,
  Share2,
  Coins,
  Scale,
  Sparkles,
  AlertTriangle
} from 'lucide-react';
import { GraphData, GraphNode, GraphEdge, NormalizedTransaction } from '../lib/types';
import { SankeyFlowView } from './SankeyFlowView';
import { TimelineReplayBar } from './TimelineReplayBar';

// Register dagre layout plugin safely
if (typeof window !== 'undefined') {
  try {
    cytoscape.use(dagre);
  } catch (e) {
    // Already registered
  }
}

type LayoutType = 'flow' | 'force' | 'hierarchical' | 'radial';
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
}

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

/** Compute proportional edge width from transaction amount */
const edgeWidthFromAmount = (amount: number): number =>
  Math.max(1.5, Math.min(6, Math.log10(amount + 1) * 1.8));

/** Opacity by hop (farther = more transparent) */
const hopOpacity = (hop: number): number => {
  if (hop <= 0) return 1;
  if (hop === 1) return 1;
  if (hop === 2) return 0.85;
  return 0.7;
};

// ─────────────────────────────────────────────────────────────────────────────
// Component
// ─────────────────────────────────────────────────────────────────────────────

export const GraphCanvas: React.FC<GraphCanvasProps> = ({
  graphData,
  isFullScreenView = false,
  transactions,
  onPivotTarget,
  activeJobId,
  isStreaming = false,
  streamingHop = 1,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const cyRef = useRef<cytoscape.Core | null>(null);
  const focusedPathRef = useRef<boolean>(false);

  // View & Layout State
  const [layoutMode, setLayoutMode] = useState<LayoutType>('flow');
  const [viewMode, setViewMode] = useState<ViewMode>('NETWORK');
  const [isSidebarOpen, setIsSidebarOpen] = useState<boolean>(true);
  const [isFullScreen, setIsFullScreen] = useState<boolean>(isFullScreenView);

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

  // Sync ref with state for use in closure-captured event handlers
  const updateFocusedPath = useCallback((val: typeof focusedPath) => {
    focusedPathRef.current = val !== null;
    setFocusedPath(val);
  }, []);

  // Compute Root Target Wallet from data
  const rootNode = useMemo(() => {
    if (!graphData?.nodes) return null;
    return graphData.nodes.find(
      (n: any) => (n.data?.role === 'INPUT_WALLET' || n.data?.is_root || n.data?.hop === 0)
    )?.data || null;
  }, [graphData]);

  const rootAddress = rootNode?.address || rootNode?.id || graphData?.stats?.root_wallet || '0x...';

  // Compute Aggregate Live Metrics from Graph Data
  const graphMetrics = useMemo(() => {
    if (!graphData?.nodes) {
      return {
        totalNodes: 0,
        totalTransfers: 0,
        maxHops: 3,
        vaspEndpoints: 0,
        totalObservedVolume: 0,
        primaryToken: 'USDT',
        tokensAvailable: ['ALL'],
        chainsAvailable: ['ALL'],
      };
    }

    const totalNodes = graphData.nodes.length;
    const totalTransfers = graphData.edges?.length || 0;
    const vaspEndpoints = graphData.nodes.filter((n: any) => n.data?.is_vasp || n.data?.role === 'KNOWN_VASP').length;
    const maxHops = Math.max(...graphData.nodes.map((n: any) => n.data?.hop || 0), 3);

    let totalVolume = 0;
    const tokens = new Set<string>(['ALL']);
    const chains = new Set<string>(['ALL']);

    graphData.nodes?.forEach((n: any) => {
      const c = n.data?.chain;
      if (c) chains.add(c.toLowerCase());
    });

    graphData.edges?.forEach((e: any) => {
      const amt = Number(e.data?.amount || 0);
      totalVolume += amt;
      const sym = e.data?.asset_symbol || e.data?.token_symbol || 'ETH';
      if (sym) tokens.add(sym.toUpperCase());
    });

    return {
      totalNodes,
      totalTransfers,
      maxHops,
      vaspEndpoints,
      totalObservedVolume: totalVolume,
      primaryToken: tokens.has('USDT') ? 'USDT' : 'ETH',
      tokensAvailable: Array.from(tokens),
      chainsAvailable: Array.from(chains),
    };
  }, [graphData]);

  // ═══════════════════════════════════════════════════════════════════════════
  // CYTOSCAPE GRAPH LIFECYCLE — REDESIGNED
  // ═══════════════════════════════════════════════════════════════════════════
  useEffect(() => {
    if (!containerRef.current || !graphData || !graphData.nodes || graphData.nodes.length === 0) {
      return;
    }

    if (cyRef.current) {
      cyRef.current.destroy();
    }

    const isDarkMode = document.documentElement.classList.contains('dark');
    const elements: cytoscape.ElementDefinition[] = [];
    const validNodeIds = new Set<string>();

    // ─────────────────────────────────────────────────────────────────────
    // 1. BUILD NODES with Filtering & Tag Classification
    // ─────────────────────────────────────────────────────────────────────
    // 1. BUILD NODES with Filtering & Tag Classification
    // ─────────────────────────────────────────────────────────────────────
    graphData.nodes.forEach((n: any) => {
      const d = n.data || n;
      const nodeId = d.id || d.address;
      const isRoot = d.role === 'INPUT_WALLET' || d.is_root || d.hop === 0;
      const isVasp = d.is_vasp || d.role === 'KNOWN_VASP';
      const isBridge = d.role === 'BRIDGE_PROTOCOL' || Boolean(d.bridge_protocol);
      const hop = d.hop ?? 1;
      const nodeChain = (d.chain || 'ethereum').toLowerCase();

      // Chain filter (root stays visible)
      if (selectedChain !== 'ALL' && nodeChain !== selectedChain.toLowerCase() && !isRoot) {
        return;
      }

      // Hop filter
      if (!isRoot && !selectedHops.has(hop)) return;

      // Entity type filter
      let entityType = 'EXTERNAL';
      if (isRoot) entityType = 'TARGET';
      else if (isVasp) entityType = 'VASP';
      else if (isBridge) entityType = 'BRIDGE';
      else if (hop >= 1 && hop <= 3) entityType = 'INTERMEDIARY';

      if (!selectedEntityTypes.has(entityType) && !isBridge) return;

      // View Mode Filtering
      if (viewMode === 'EVIDENCE' && !isRoot && !isVasp && !isBridge && hop > 2) return;

      validNodeIds.add(nodeId);

      // Tag classification (target, exchange, mixer, sanctioned, bridge, unknown)
      const rawCat = (d.category || d.entity || d.label || d.role || d.vasp_name || '').toLowerCase();
      let nodeTag: 'target' | 'exchange' | 'mixer' | 'sanctioned' | 'bridge' | 'unknown' = 'unknown';
      if (isRoot) {
        nodeTag = 'target';
      } else if (isBridge) {
        nodeTag = 'bridge';
      } else if (
        isVasp ||
        rawCat.includes('exchange') ||
        rawCat.includes('binance') ||
        rawCat.includes('okx') ||
        rawCat.includes('vasp') ||
        rawCat.includes('coinbase') ||
        rawCat.includes('wazirx') ||
        rawCat.includes('bybit') ||
        rawCat.includes('kraken') ||
        rawCat.includes('gate.io')
      ) {
        nodeTag = 'exchange';
      } else if (
        rawCat.includes('mixer') ||
        rawCat.includes('tornado') ||
        rawCat.includes('tumbler') ||
        rawCat.includes('anonymizer')
      ) {
        nodeTag = 'mixer';
      } else if (
        rawCat.includes('sanction') ||
        rawCat.includes('ofac') ||
        rawCat.includes('illicit') ||
        rawCat.includes('crime') ||
        d.risk_level === 'CRITICAL' ||
        d.risk_level === 'SANCTIONED'
      ) {
        nodeTag = 'sanctioned';
      }

      const shortAddr = `${nodeId.slice(0, 6)}…${nodeId.slice(-4)}`;
      const chainBadge = nodeChain === 'solana' ? '[SOL] ' : nodeChain === 'tron' ? '[TRX] ' : nodeChain === 'bitcoin' ? '[BTC] ' : nodeChain === 'bsc' ? '[BSC] ' : '';

      const label = isRoot
        ? `⊕ TARGET\n${chainBadge}${shortAddr}`
        : isBridge
        ? `[Bridge: ${d.bridge_protocol || 'Bridge'}]\n${shortAddr}`
        : nodeTag === 'exchange'
        ? `${d.vasp_name?.toUpperCase() || 'EXCHANGE'}\n${chainBadge}${shortAddr}`
        : nodeTag === 'mixer'
        ? `⚠ MIXER\n${shortAddr}`
        : nodeTag === 'sanctioned'
        ? `✖ SANCTIONED\n${shortAddr}`
        : `${chainBadge}${shortAddr}\nHop ${hop}`;

      elements.push({
        group: 'nodes',
        classes: `tag-${nodeTag} chain-${nodeChain} ${isRoot ? 'is-root tag-target' : ''} ${isVasp || nodeTag === 'exchange' ? 'is-vasp tag-exchange' : ''} ${isBridge ? 'is-bridge tag-bridge' : ''}`.trim(),
        data: {
          id: nodeId,
          label: label,
          isRoot: isRoot,
          isVasp: isVasp || nodeTag === 'exchange',
          isBridge: isBridge,
          bridgeProtocol: d.bridge_protocol,
          chain: nodeChain,
          tag: nodeTag,
          category: nodeTag,
          vaspName: d.vasp_name,
          vaspConfidence: d.vasp_confidence || 95,
          hop: hop,
          addressType: d.address_type || 'hot_wallet',
          fullAddress: nodeId,
          totalInflow: d.total_inflow || 0,
          totalOutflow: d.total_outflow || 0,
          txCount: d.tx_count || 0,
          role: d.role || entityType,
          nodeOpacity: hopOpacity(hop),
        },
      });
    });

    // ─────────────────────────────────────────────────────────────────────
    // 2. BUILD EDGES with Filtering & Proportional Width
    // ─────────────────────────────────────────────────────────────────────
    graphData.edges?.forEach((e: any, idx: number) => {
      const d = e.data || e;
      const src = d.source;
      const tgt = d.target;
      const amt = Number(d.amount || 0);
      const sym = (d.asset_symbol || d.token_symbol || 'ETH').toUpperCase();
      const edgeId = d.id || `edge-${idx}`;
      const isCrossChain = Boolean(d.is_cross_chain);
      const bridgeProto = d.bridge_protocol || '';

      // INR/USD valuation fields (Case 6)
      const amountUsd = d.amount_usd ? Number(d.amount_usd) : null;
      const amountInr = d.amount_inr ? Number(d.amount_inr) : null;

      // FIFO taint fields (Case 2)
      const taintRatio = d.taint_ratio != null ? Number(d.taint_ratio) : null;
      const traceableAmount = d.traceable_amount != null ? Number(d.traceable_amount) : null;

      if (!validNodeIds.has(src) || !validNodeIds.has(tgt)) return;

      // Token filter
      if (selectedToken !== 'ALL' && sym !== selectedToken) return;

      // Min amount filter
      if (minAmount > 0 && amt < minAmount) return;

      // Build edge label with INR if available
      const amtStr = amt > 0 ? `${amt >= 1000 ? (amt / 1000).toFixed(1) + 'k' : amt.toFixed(2)} ${sym}` : '';
      const inrStr = amountInr ? `₹${amountInr >= 100000 ? (amountInr / 100000).toFixed(1) + 'L' : amountInr.toFixed(0)}` : '';
      const label = isCrossChain
        ? `[Bridge: ${bridgeProto || 'Cross-Chain'}] ${amtStr}`
        : inrStr ? `${amtStr}\n${inrStr}` : amtStr;

      // Taint-based CSS class
      let taintClass = '';
      if (taintRatio !== null) {
        if (taintRatio >= 0.8) taintClass = 'taint-high';
        else if (taintRatio >= 0.4) taintClass = 'taint-medium';
        else if (taintRatio > 0) taintClass = 'taint-low';
      }

      elements.push({
        group: 'edges',
        classes: `${isCrossChain ? 'is-cross-chain' : ''} ${taintClass}`.trim(),
        data: {
          id: edgeId,
          source: src,
          target: tgt,
          label: label,
          amount: amt,
          edgeWidth: isCrossChain ? 3.5 : edgeWidthFromAmount(amt),
          tokenSymbol: sym,
          txHash: d.tx_hash || '',
          timestamp: d.timestamp || '',
          hop: d.hop || 1,
          isCrossChain: isCrossChain,
          bridgeProtocol: bridgeProto,
          sourceChain: d.source_chain,
          targetChain: d.target_chain,
          // Case 6: INR/USD
          amountUsd: amountUsd,
          amountInr: amountInr,
          unitPriceUsd: d.unit_price_usd || null,
          unitPriceInr: d.unit_price_inr || null,
          // Case 2: Taint
          taintRatio: taintRatio,
          traceableAmount: traceableAmount,
          unclassifiedAmount: d.unclassified_amount || null,
        },
      });
    });

    // ─────────────────────────────────────────────────────────────────────
    // 3. LAYOUT CONFIGURATIONS — REDESIGNED for clean spacing
    // ─────────────────────────────────────────────────────────────────────
    const nodeCount = elements.filter(el => el.group === 'nodes').length;
    const spacingScale = nodeCount > 40 ? 1.3 : nodeCount > 20 ? 1.1 : 1.0;

    let layoutConfig: any;

    switch (layoutMode) {
      case 'flow':
        layoutConfig = {
          name: 'dagre',
          rankDir: 'LR',
          nodeSep: nodeCount > 80 ? 80 : Math.round(120 * spacingScale),
          rankSep: nodeCount > 80 ? 140 : Math.round(200 * spacingScale),
          edgeSep: nodeCount > 80 ? 25 : 40,
          ranker: 'network-simplex',
          animate: true,
          animationDuration: 500,
          animationEasing: 'ease-out-cubic' as any,
          fit: true,
          padding: 50,
        };
        break;
      case 'force': {
        // Adaptive CoSE parameters: higher gravity + lower repulsion for dense graphs
        const densityGravity = nodeCount > 100 ? 0.8 : nodeCount > 50 ? 0.5 : 0.25;
        const densityRepulsion = nodeCount > 100 ? 600000 : nodeCount > 50 ? 1000000 : 2000000;
        const densityEdgeLen = nodeCount > 100 ? 100 : nodeCount > 50 ? 140 : 180;
        layoutConfig = {
          name: 'cose',
          animate: 'end',
          animationDuration: 600,
          animationEasing: 'ease-out-cubic' as any,
          randomize: true,
          componentSpacing: nodeCount > 100 ? 80 : 160,
          nodeOverlap: 50,
          idealEdgeLength: (edge: any) => densityEdgeLen,
          nodeRepulsion: (node: any) => densityRepulsion,
          edgeElasticity: (edge: any) => 80,
          gravity: densityGravity,
          numIter: nodeCount > 100 ? 300 : 500,
          fit: true,
          padding: 50,
          nestingFactor: 1.2,
        };
        break;
      }
      case 'hierarchical':
        layoutConfig = {
          name: 'breadthfirst',
          directed: true,
          roots: rootNode?.id ? [`#${rootNode.id}`] : undefined,
          spacingFactor: nodeCount > 80 ? 1.4 : 2.0 * spacingScale,
          avoidOverlap: true,
          animate: true,
          animationDuration: 500,
          fit: true,
          padding: 50,
          maximal: false,
        };
        break;
      case 'radial':
        layoutConfig = {
          name: 'concentric',
          concentric: (node: any) => 4 - (node.data('hop') || 1),
          levelWidth: () => 1,
          minNodeSpacing: nodeCount > 80 ? 50 : Math.round(120 * spacingScale),
          animate: true,
          animationDuration: 500,
          fit: true,
          padding: 50,
          startAngle: 0,
          sweep: 2 * Math.PI,
          equidistant: false,
        };
        break;
    }

    // ─────────────────────────────────────────────────────────────────────
    // 4. STYLESHEET — PRODUCTION-GRADE VISUAL DESIGN
    // ─────────────────────────────────────────────────────────────────────
    const baseTextColor = isDarkMode ? '#cbd5e1' : '#1e293b';
    const dimTextColor = isDarkMode ? '#64748b' : '#94a3b8';
    const surfaceColor = isDarkMode ? '#0f172a' : '#f1f5f9';
    const borderColor = isDarkMode ? '#334155' : '#cbd5e1';
    const canvasBg = isDarkMode ? '#090d16' : '#ffffff';

    // Adaptive node sizing: scale down for dense graphs
    const sizeScale = nodeCount > 120 ? 0.65 : nodeCount > 80 ? 0.75 : nodeCount > 40 ? 0.85 : 1.0;
    const sz = (base: number) => Math.round(base * sizeScale);
    const fs = (base: number) => Math.round(base * Math.max(sizeScale, 0.8) * 10) / 10;

    const cy = cytoscape({
      container: containerRef.current,
      elements: elements,

      // ── Global interaction config ──
      minZoom: 0.15,
      maxZoom: 4.0,
      wheelSensitivity: 0.3,
      boxSelectionEnabled: true,
      selectionType: 'additive',
      autoungrabify: false,

      style: [
        // ────────────────── BASE NODE ──────────────────
        {
          selector: 'node',
          style: {
            'label': 'data(label)',
            'color': baseTextColor,
            'font-family': 'ui-monospace, SFMono-Regular, Menlo, monospace',
            'font-size': `${fs(9)}px`,
            'text-wrap': 'wrap',
            'text-max-width': `${sz(110)}px`,
            'text-valign': 'bottom',
            'text-halign': 'center',
            'text-margin-y': sz(8),
            'background-color': surfaceColor,
            'border-width': 2,
            'border-color': borderColor,
            'width': sz(56),
            'height': sz(56),
            'shape': 'ellipse',
            'opacity': 'data(nodeOpacity)' as any,
            'overlay-opacity': 0,
            'overlay-padding': 6,
            'transition-property': 'background-color, border-color, width, height, opacity, overlay-opacity',
            'transition-duration': 200,
          },
        },
        // ────────────────── TARGET / ROOT ──────────────────
        {
          selector: 'node[tag = "target"], node.tag-target, node.is-root',
          style: {
            'background-color': isDarkMode ? '#450a0a' : '#fee2e2',
            'border-color': '#ef4444',
            'border-width': 4,
            'color': isDarkMode ? '#fca5a5' : '#991b1b',
            'width': sz(80),
            'height': sz(80),
            'font-weight': 'bold',
            'font-size': `${fs(10)}px`,
            'shape': 'star',
            'text-valign': 'bottom',
            'text-margin-y': sz(10),
            'opacity': 1,
            'overlay-color': '#ef4444',
            'overlay-opacity': 0.08,
            'overlay-padding': sz(12),
          },
        },
        // ────────────────── EXCHANGE / VASP ──────────────────
        {
          selector: 'node[tag = "exchange"], node.tag-exchange, node.is-vasp',
          style: {
            'background-color': isDarkMode ? '#042f2e' : '#ccfbf1',
            'border-color': '#14b8a6',
            'border-width': 3,
            'color': isDarkMode ? '#5eead4' : '#0f766e',
            'width': sz(72),
            'height': sz(60),
            'shape': 'roundrectangle',
            'font-weight': 'bold',
            'font-size': `${fs(10)}px`,
            'text-valign': 'bottom',
            'text-margin-y': sz(8),
            'opacity': 1,
          },
        },
        // ────────────────── MIXER / TUMBLER ──────────────────
        {
          selector: 'node[tag = "mixer"], node.tag-mixer',
          style: {
            'background-color': isDarkMode ? '#3b0764' : '#f3e8ff',
            'border-color': '#a855f7',
            'border-width': 3,
            'color': isDarkMode ? '#d8b4fe' : '#6b21a8',
            'width': sz(66),
            'height': sz(58),
            'shape': 'diamond',
            'font-weight': 'bold',
            'font-size': `${fs(10)}px`,
            'text-valign': 'bottom',
            'text-margin-y': sz(10),
          },
        },
        // ────────────────── SANCTIONED / OFAC ──────────────────
        {
          selector: 'node[tag = "sanctioned"], node.tag-sanctioned',
          style: {
            'background-color': isDarkMode ? '#450a0a' : '#fef2f2',
            'border-color': '#dc2626',
            'border-width': 3.5,
            'color': isDarkMode ? '#fca5a5' : '#b91c1c',
            'width': sz(66),
            'height': sz(58),
            'shape': 'octagon',
            'font-weight': 'bold',
            'font-size': `${fs(10)}px`,
            'text-valign': 'bottom',
            'text-margin-y': sz(10),
            'overlay-color': '#dc2626',
            'overlay-opacity': 0.06,
            'overlay-padding': sz(8),
          },
        },
        // ────────────────── BRIDGE PROTOCOL ──────────────────
        {
          selector: 'node[tag = "bridge"], node.tag-bridge, node.is-bridge, node[role = "BRIDGE_PROTOCOL"]',
          style: {
            'background-color': isDarkMode ? '#2e1065' : '#ede9fe',
            'border-color': '#a855f7',
            'border-width': 3,
            'border-style': 'dashed',
            'color': isDarkMode ? '#d8b4fe' : '#6b21a8',
            'width': sz(70),
            'height': sz(60),
            'shape': 'hexagon',
            'font-weight': 'bold',
            'font-size': `${fs(10)}px`,
            'text-valign': 'bottom',
            'text-margin-y': sz(8),
            'overlay-color': '#a855f7',
            'overlay-opacity': 0.08,
            'overlay-padding': sz(8),
          },
        },
        // ── Chain Accents ──
        {
          selector: 'node.chain-solana:not(.is-root):not(.is-vasp):not(.is-bridge)',
          style: {
            'border-color': '#8b5cf6',
            'background-color': isDarkMode ? '#1e1b4b' : '#f5f3ff',
            'color': isDarkMode ? '#c4b5fd' : '#6d28d9',
          },
        },
        {
          selector: 'node.chain-tron:not(.is-root):not(.is-vasp):not(.is-bridge)',
          style: {
            'border-color': '#ef4444',
            'background-color': isDarkMode ? '#450a0a' : '#fef2f2',
            'color': isDarkMode ? '#fca5a5' : '#b91c1c',
          },
        },
        {
          selector: 'node.chain-bitcoin:not(.is-root):not(.is-vasp):not(.is-bridge)',
          style: {
            'border-color': '#f59e0b',
            'background-color': isDarkMode ? '#451a03' : '#fffbeb',
            'color': isDarkMode ? '#fcd34d' : '#b45309',
          },
        },
        {
          selector: 'node.chain-bsc:not(.is-root):not(.is-vasp):not(.is-bridge)',
          style: {
            'border-color': '#eab308',
            'background-color': isDarkMode ? '#422006' : '#fefce8',
            'color': isDarkMode ? '#fef08a' : '#a16207',
          },
        },
        // ────────────────── UNKNOWN / INTERMEDIARY ──────────────────
        {
          selector: 'node[tag = "unknown"], node.tag-unknown',
          style: {
            'background-color': isDarkMode ? '#0f172a' : '#f1f5f9',
            'border-color': isDarkMode ? '#475569' : '#94a3b8',
            'border-width': 2,
            'color': isDarkMode ? '#cbd5e1' : '#334155',
            'width': sz(56),
            'height': sz(56),
            'shape': 'ellipse',
            'font-size': `${fs(9)}px`,
          },
        },
        // ── Hop 1 color accent ──
        {
          selector: 'node[hop = 1].tag-unknown',
          style: {
            'border-color': '#3b82f6',
            'background-color': isDarkMode ? '#1e293b' : '#dbeafe',
            'color': isDarkMode ? '#93c5fd' : '#1d4ed8',
          },
        },
        // ── Hop 2 color accent ──
        {
          selector: 'node[hop = 2].tag-unknown',
          style: {
            'border-color': '#8b5cf6',
            'background-color': isDarkMode ? '#1e1b4b' : '#ede9fe',
            'color': isDarkMode ? '#c4b5fd' : '#6d28d9',
          },
        },
        // ── Hop 3 color accent ──
        {
          selector: 'node[hop = 3].tag-unknown',
          style: {
            'border-color': '#6366f1',
            'background-color': isDarkMode ? '#1e1e38' : '#e0e7ff',
            'color': isDarkMode ? '#a5b4fc' : '#4338ca',
          },
        },

        // ────────────────── BASE EDGE ──────────────────
        {
          selector: 'edge',
          style: {
            'width': 'data(edgeWidth)' as any,
            'line-color': isDarkMode ? '#334155' : '#94a3b8',
            'target-arrow-color': isDarkMode ? '#64748b' : '#64748b',
            'target-arrow-shape': 'triangle',
            'arrow-scale': sizeScale < 0.8 ? 0.8 : 1.0,
            'curve-style': 'unbundled-bezier',
            'control-point-step-size': nodeCount > 80 ? 30 : 45,
            'label': nodeCount > 100 ? '' : 'data(label)',
            'font-size': `${fs(8)}px`,
            'font-family': 'ui-monospace, SFMono-Regular, monospace',
            'color': isDarkMode ? '#94a3b8' : '#475569',
            'text-rotation': 'autorotate',
            'text-background-opacity': 0.9,
            'text-background-color': isDarkMode ? '#0e1524' : '#ffffff',
            'text-background-padding': '3px',
            'text-background-shape': 'roundrectangle',
            'text-margin-y': -10,
            'overlay-opacity': 0,
            'transition-property': 'line-color, target-arrow-color, width, opacity',
            'transition-duration': 200,
          },
        },
        // ── Edge hop color coding ──
        {
          selector: 'edge[hop = 1]',
          style: {
            'line-color': isDarkMode ? '#1e40af' : '#93c5fd',
            'target-arrow-color': isDarkMode ? '#2563eb' : '#60a5fa',
          },
        },
        {
          selector: 'edge[hop = 2]',
          style: {
            'line-color': isDarkMode ? '#5b21b6' : '#c4b5fd',
            'target-arrow-color': isDarkMode ? '#7c3aed' : '#a78bfa',
          },
        },
        {
          selector: 'edge[hop = 3]',
          style: {
            'line-color': isDarkMode ? '#3730a3' : '#a5b4fc',
            'target-arrow-color': isDarkMode ? '#4f46e5' : '#818cf8',
          },
        },
        // ────────────────── CROSS-CHAIN BRIDGED EDGES ──────────────────
        {
          selector: 'edge[?isCrossChain], edge.is-cross-chain',
          style: {
            'line-color': '#c084fc',
            'target-arrow-color': '#a855f7',
            'target-arrow-shape': 'triangle',
            'line-style': 'dashed',
            'line-dash-pattern': [7, 4] as any,
            'width': 3.5,
            'label': 'data(label)',
            'color': isDarkMode ? '#f3e8ff' : '#581c87',
            'font-weight': 'bold',
            'font-size': `${fs(9)}px`,
            'text-background-color': isDarkMode ? '#1e1035' : '#ede9fe',
            'text-background-opacity': 0.95,
            'text-background-padding': '4px',
            'text-background-shape': 'roundrectangle',
            'z-index': 800,
          },
        },

        // ────────────────── FIFO TAINT EDGE COLORING (Case 2) ──────────
        {
          selector: 'edge.taint-high',
          style: {
            'line-color': '#ef4444',
            'target-arrow-color': '#dc2626',
            'width': 4,
            'z-index': 900,
          },
        },
        {
          selector: 'edge.taint-medium',
          style: {
            'line-color': '#f97316',
            'target-arrow-color': '#ea580c',
            'width': 3,
            'z-index': 850,
          },
        },
        {
          selector: 'edge.taint-low',
          style: {
            'line-color': '#84cc16',
            'target-arrow-color': '#65a30d',
            'z-index': 800,
          },
        },

        // ────────────────── INTERACTIVE STATES ──────────────────

        // Hover: node scale + glow
        {
          selector: 'node:active',
          style: {
            'overlay-opacity': 0.12,
            'overlay-color': '#38bdf8',
            'overlay-padding': 10,
          },
        },

        // Path Focus — highlighted path
        {
          selector: '.path-focused',
          style: {
            'line-color': '#06b6d4',
            'target-arrow-color': '#06b6d4',
            'width': 4,
            'z-index': 999,
            'label': 'data(label)',
            'font-size': '9px',
            'text-background-opacity': 0.95,
          },
        },
        {
          selector: 'node.path-focused',
          style: {
            'border-color': '#06b6d4',
            'border-width': 4,
            'z-index': 999,
            'overlay-color': '#06b6d4',
            'overlay-opacity': 0.1,
            'overlay-padding': 10,
          },
        },
        // Path Focus — dimmed elements
        {
          selector: '.path-dimmed',
          style: {
            'opacity': 0.12,
          },
        },
        // Timeline replay — active edge
        {
          selector: '.replay-active-edge',
          style: {
            'line-color': '#f59e0b',
            'target-arrow-color': '#f59e0b',
            'width': 5,
            'z-index': 1000,
          },
        },
        // Timeline replay — active node
        {
          selector: 'node.replay-active-node',
          style: {
            'border-color': '#f59e0b',
            'border-width': 4,
            'z-index': 1000,
            'overlay-color': '#f59e0b',
            'overlay-opacity': 0.15,
            'overlay-padding': 12,
          },
        },
        // Selection
        {
          selector: ':selected',
          style: {
            'border-color': '#38bdf8',
            'border-width': 4,
            'line-color': '#38bdf8',
            'target-arrow-color': '#38bdf8',
            'overlay-color': '#38bdf8',
            'overlay-opacity': 0.1,
          },
        },
        // Hover highlight class (applied via JS)
        {
          selector: '.node-hover',
          style: {
            'border-width': 4,
            'overlay-opacity': 0.1,
            'overlay-color': '#38bdf8',
            'overlay-padding': 10,
          },
        },
        {
          selector: '.edge-hover',
          style: {
            'width': 4,
            'line-color': '#38bdf8',
            'target-arrow-color': '#38bdf8',
            'z-index': 500,
            'label': 'data(label)',
            'font-size': '9px',
            'text-background-opacity': 0.95,
          },
        },
        {
          selector: '.neighbor-dim',
          style: {
            'opacity': 0.25,
          },
        },
      ],
      layout: layoutConfig,
    });

    // ─────────────────────────────────────────────────────────────────────
    // 5. AUTO-FIT on layout completion
    // ─────────────────────────────────────────────────────────────────────
    cy.on('layoutstop', () => {
      cy.fit(undefined, 60);
    });

    // ─────────────────────────────────────────────────────────────────────
    // 6. HOVER EFFECTS — Highlight node + connected edges on hover
    // ─────────────────────────────────────────────────────────────────────
    cy.on('mouseover', 'node', (evt) => {
      const node = evt.target;
      // Don't interfere with path focus mode
      if (focusedPathRef.current) return;
      node.addClass('node-hover');
      node.connectedEdges().addClass('edge-hover');
      // Dim all other elements
      cy.elements().not(node).not(node.connectedEdges()).not(node.neighborhood('node')).addClass('neighbor-dim');
    });

    cy.on('mouseout', 'node', (evt) => {
      const node = evt.target;
      node.removeClass('node-hover');
      node.connectedEdges().removeClass('edge-hover');
      cy.elements().removeClass('neighbor-dim');
    });

    cy.on('mouseover', 'edge', (evt) => {
      if (focusedPathRef.current) return;
      const edge = evt.target;
      edge.addClass('edge-hover');
    });

    cy.on('mouseout', 'edge', (evt) => {
      evt.target.removeClass('edge-hover');
    });

    // ─────────────────────────────────────────────────────────────────────
    // 7. PATH FOCUS — Dijkstra shortest path from root to clicked node
    // ─────────────────────────────────────────────────────────────────────
    const highlightPathToNode = (targetNode: cytoscape.NodeSingular) => {
      const targetId = targetNode.id();
      const rootId = rootNode?.id || rootAddress;

      if (!rootId || targetId === rootId) {
        cy.elements().removeClass('path-focused path-dimmed');
        updateFocusedPath(null);
        return;
      }

      // Find shortest directed path using Dijkstra
      const dijkstra = cy.elements().dijkstra({
        root: `#${rootId}`,
        directed: true,
      });

      const pathToTarget = dijkstra.pathTo(targetNode);

      if (pathToTarget && pathToTarget.length > 0) {
        cy.elements().addClass('path-dimmed').removeClass('path-focused');
        pathToTarget.removeClass('path-dimmed').addClass('path-focused');

        const nodeIds = new Set<string>();
        const edgeIds = new Set<string>();
        let volume = 0;

        pathToTarget.forEach((el: any) => {
          if (el.isNode && el.isNode()) {
            nodeIds.add(el.id());
          } else if (el.isEdge && el.isEdge()) {
            edgeIds.add(el.id());
            volume += Number(el.data('amount') || 0);
          }
        });

        updateFocusedPath({
          targetNodeId: targetId,
          nodeIds,
          edgeIds,
          totalVolume: volume,
          hopDistance: targetNode.data('hop') || 1,
          destinationName: targetNode.data('vaspName'),
        });
      }
    };

    // ─────────────────────────────────────────────────────────────────────
    // 8. EVENT HANDLERS
    // ─────────────────────────────────────────────────────────────────────
    cy.on('tap', 'node', (evt) => {
      const node = evt.target;
      setSelectedElement({
        type: 'NODE',
        data: node.data(),
      });
      highlightPathToNode(node);
    });

    cy.on('tap', 'edge', (evt) => {
      const edge = evt.target;
      setSelectedElement({
        type: 'EDGE',
        data: edge.data(),
      });
    });

    cy.on('tap', (evt) => {
      if (evt.target === cy) {
        setSelectedElement(null);
        cy.elements().removeClass('path-focused path-dimmed neighbor-dim node-hover edge-hover');
        updateFocusedPath(null);
      }
    });

    // Auto-focus primary fund flow in FUND_FLOW view
    if (viewMode === 'FUND_FLOW') {
      const topVaspNode = cy.nodes('.is-vasp, .tag-exchange, [tag = "exchange"]').first();
      if (topVaspNode.length > 0) {
        highlightPathToNode(topVaspNode);
      }
    }

    cyRef.current = cy;
  }, [
    graphData,
    layoutMode,
    viewMode,
    selectedHops,
    selectedEntityTypes,
    selectedToken,
    selectedChain,
    minAmount,
    timeRange,
    riskFilter,
  ]);

  // ═══════════════════════════════════════════════════════════════════════════
  // CONTROLS
  // ═══════════════════════════════════════════════════════════════════════════
  const handleFit = () => cyRef.current?.fit(undefined, 60);
  const handleZoomIn = () => {
    const cy = cyRef.current;
    if (cy) cy.animate({ zoom: { level: cy.zoom() * 1.3, position: cy.extent() as any }, duration: 200 });
  };
  const handleZoomOut = () => {
    const cy = cyRef.current;
    if (cy) cy.animate({ zoom: { level: cy.zoom() * 0.75, position: cy.extent() as any }, duration: 200 });
  };
  const handleReset = () => {
    const cy = cyRef.current;
    if (cy) {
      cy.elements().removeClass('path-focused path-dimmed neighbor-dim node-hover edge-hover');
      cy.animate({ fit: { eles: cy.elements(), padding: 60 }, duration: 300 });
    }
    updateFocusedPath(null);
    setSelectedElement(null);
  };

  const toggleHopFilter = (hop: number) => {
    const next = new Set(selectedHops);
    if (next.has(hop)) next.delete(hop);
    else next.add(hop);
    setSelectedHops(next);
  };

  const toggleEntityType = (type: string) => {
    const next = new Set(selectedEntityTypes);
    if (next.has(type)) next.delete(type);
    else next.add(type);
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
    setViewMode('NETWORK');
    setLayoutMode('flow');
    handleReset();
  };

  const handleCopy = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  // ═══════════════════════════════════════════════════════════════════════════
  // RENDER
  // ═══════════════════════════════════════════════════════════════════════════
  return (
    <div
      className={`bg-forensic-surface border border-forensic-border rounded-xl shadow-lg flex flex-col relative text-xs overflow-hidden transition-all duration-300 ${
        isFullScreen ? 'fixed inset-4 z-50 h-[calc(100vh-2rem)]' : isFullScreenView ? 'h-[80vh]' : 'h-[620px]'
      }`}
    >
      {/* ========================================================================= */}
      {/* 1. INVESTIGATION SUMMARY HEADER BAR */}
      {/* ========================================================================= */}
      <div className="p-3 border-b border-forensic-border bg-forensic-surfaceRaised/80 backdrop-blur-md flex flex-wrap items-center justify-between gap-3 text-xs">
        {/* Left: Target & Core Stats */}
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center space-x-2 pr-3 border-r border-forensic-border">
            <div className="p-1.5 rounded bg-blue-600/15 border border-blue-500/30 text-blue-400">
              <Network className="h-4 w-4" />
            </div>
            <div>
              <div className="flex items-center space-x-1.5 font-mono text-[11px] font-bold text-forensic-text uppercase">
                <span>GRAPH STUDIO</span>
                <span className="text-[9px] px-1.5 py-0.2 rounded bg-blue-500/10 text-blue-400 border border-blue-500/20 font-normal">
                  PRO
                </span>
              </div>
              <div className="flex items-center space-x-1 text-[11px] font-mono text-forensic-textDim">
                <span>Target:</span>
                <span className="text-forensic-text font-medium">{rootAddress ? `${rootAddress.slice(0, 8)}...${rootAddress.slice(-4)}` : 'N/A'}</span>
                <button
                  onClick={() => handleCopy(rootAddress)}
                  className="hover:text-forensic-text transition-colors p-0.5"
                  title="Copy Target Wallet"
                >
                  {copied ? <Check className="h-3 w-3 text-emerald-400" /> : <Copy className="h-3 w-3" />}
                </button>
              </div>
            </div>
          </div>

          {/* Genuine Response Metrics Badges */}
          <div className="hidden sm:flex items-center space-x-2 font-mono text-[11px]">
            <span className="px-2.5 py-1 rounded bg-forensic-surface border border-forensic-border text-forensic-text font-medium">
              <strong className="text-blue-400">{graphMetrics.totalNodes}</strong> Nodes
            </span>
            <span className="px-2.5 py-1 rounded bg-forensic-surface border border-forensic-border text-forensic-text font-medium">
              <strong className="text-teal-400">{graphMetrics.totalTransfers}</strong> Transfers
            </span>
            <span className="px-2.5 py-1 rounded bg-forensic-surface border border-forensic-border text-forensic-text font-medium">
              <strong className="text-purple-400">{graphMetrics.maxHops}</strong> Hops
            </span>
            <span className="px-2.5 py-1 rounded bg-forensic-surface border border-forensic-border text-emerald-400 font-medium">
              <strong className="text-emerald-400">{graphMetrics.vaspEndpoints}</strong> VASP Endpoints
            </span>
            {graphMetrics.totalObservedVolume > 0 && (
              <span className="px-2.5 py-1 rounded bg-forensic-surface border border-forensic-border text-amber-400 font-medium">
                {graphMetrics.totalObservedVolume >= 1000
                  ? (graphMetrics.totalObservedVolume / 1000).toFixed(1) + 'k'
                  : graphMetrics.totalObservedVolume.toFixed(2)}{' '}
                {graphMetrics.primaryToken} Observed
              </span>
            )}
          </div>
        </div>

        {/* Right: View Modes & Canvas Actions */}
        <div className="flex items-center space-x-2">
          {/* View Switcher: [Network] [Fund Flow] [Timeline] [Evidence] */}
          <div className="flex items-center bg-forensic-surface border border-forensic-border rounded p-0.5 font-mono text-[10px]">
            {(['NETWORK', 'FUND_FLOW', 'TIMELINE', 'EVIDENCE'] as ViewMode[]).map((mode) => (
              <button
                key={mode}
                onClick={() => setViewMode(mode)}
                className={`px-2 py-1 rounded font-medium transition-colors ${
                  viewMode === mode
                    ? 'bg-blue-600 text-white font-bold'
                    : 'text-forensic-textMuted hover:text-forensic-text hover:bg-forensic-surfaceRaised'
                }`}
              >
                {mode === 'FUND_FLOW' ? 'Fund Flow' : mode.charAt(0) + mode.slice(1).toLowerCase()}
              </button>
            ))}
          </div>

          {/* Quick Hop Filters */}
          <div className="hidden xl:flex items-center bg-forensic-surface border border-forensic-border rounded p-0.5 font-mono text-[10px]">
            <button
              onClick={() => setSelectedHops(new Set([1, 2, 3]))}
              className={`px-2 py-1 rounded transition-colors ${
                selectedHops.size === 3 ? 'bg-forensic-surfaceRaised text-forensic-text font-bold' : 'text-forensic-textMuted'
              }`}
            >
              All Hops
            </button>
            {[1, 2, 3].map((hop) => (
              <button
                key={hop}
                onClick={() => toggleHopFilter(hop)}
                className={`px-2 py-1 rounded transition-colors ${
                  selectedHops.has(hop) && selectedHops.size < 3
                    ? 'bg-blue-600 text-white font-bold'
                    : 'text-forensic-textMuted hover:text-forensic-text'
                }`}
              >
                Hop {hop}
              </button>
            ))}
          </div>

          {/* Quick Chain Filters */}
          {graphMetrics.chainsAvailable.length > 1 && (
            <div className="hidden lg:flex items-center bg-forensic-surface border border-forensic-border rounded p-0.5 font-mono text-[10px]">
              {graphMetrics.chainsAvailable.map((c) => (
                <button
                  key={c}
                  onClick={() => setSelectedChain(c)}
                  className={`px-2 py-1 rounded transition-colors uppercase font-mono ${
                    selectedChain.toLowerCase() === c.toLowerCase()
                      ? 'bg-purple-600 text-white font-bold'
                      : 'text-forensic-textMuted hover:text-forensic-text'
                  }`}
                >
                  {c === 'ALL' ? 'All Networks' : c}
                </button>
              ))}
            </div>
          )}

          {/* Canvas Actions */}
          <div className="flex items-center space-x-1 border-l border-forensic-border pl-2">
            <button
              onClick={handleReset}
              className="p-1.5 rounded hover:bg-forensic-surfaceRaised text-forensic-textMuted hover:text-forensic-text border border-transparent hover:border-forensic-border transition-colors"
              title="Reset View & Clear Path Focus"
            >
              <RotateCcw className="h-3.5 w-3.5" />
            </button>
            <button
              onClick={handleFit}
              className="p-1.5 rounded hover:bg-forensic-surfaceRaised text-forensic-textMuted hover:text-forensic-text border border-transparent hover:border-forensic-border transition-colors"
              title="Fit Graph"
            >
              <Eye className="h-3.5 w-3.5" />
            </button>
            <button
              onClick={handleZoomIn}
              className="p-1.5 rounded hover:bg-forensic-surfaceRaised text-forensic-textMuted hover:text-forensic-text border border-transparent hover:border-forensic-border transition-colors"
              title="Zoom In"
            >
              <ZoomIn className="h-3.5 w-3.5" />
            </button>
            <button
              onClick={handleZoomOut}
              className="p-1.5 rounded hover:bg-forensic-surfaceRaised text-forensic-textMuted hover:text-forensic-text border border-transparent hover:border-forensic-border transition-colors"
              title="Zoom Out"
            >
              <ZoomOut className="h-3.5 w-3.5" />
            </button>
            <button
              onClick={() => setIsFullScreen(!isFullScreen)}
              className="p-1.5 rounded hover:bg-forensic-surfaceRaised text-forensic-textMuted hover:text-forensic-text border border-transparent hover:border-forensic-border transition-colors"
              title={isFullScreen ? 'Exit Fullscreen' : 'Fullscreen'}
            >
              {isFullScreen ? <Minimize2 className="h-3.5 w-3.5" /> : <Maximize2 className="h-3.5 w-3.5" />}
            </button>
          </div>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* MAIN WORKSPACE BODY: (Left Panel + Cytoscape Canvas + Right Drawer) */}
      {/* ========================================================================= */}
      <div className="flex-1 relative flex overflow-hidden">
        {/* ======================================================================= */}
        {/* 2. LEFT INVESTIGATION CONTROL PANEL */}
        {/* ======================================================================= */}
        <div
          className={`border-r border-forensic-border bg-forensic-surfaceRaised/95 backdrop-blur-md transition-all duration-300 flex flex-col z-20 overflow-y-auto ${
            isSidebarOpen ? 'w-64 min-w-[16rem]' : 'w-10 min-w-[2.5rem]'
          }`}
        >
          {/* Collapse Header */}
          <div className="p-2.5 border-b border-forensic-border flex items-center justify-between">
            {isSidebarOpen ? (
              <div className="flex items-center space-x-2 font-mono text-xs font-bold text-forensic-text uppercase">
                <SlidersHorizontal className="h-3.5 w-3.5 text-teal-400" />
                <span>Investigation Filters</span>
              </div>
            ) : (
              <SlidersHorizontal className="h-4 w-4 text-forensic-textDim mx-auto" />
            )}
            <button
              onClick={() => setIsSidebarOpen(!isSidebarOpen)}
              className="p-1 rounded hover:bg-forensic-surface text-forensic-textMuted hover:text-forensic-text transition-colors"
              title={isSidebarOpen ? 'Collapse Panel' : 'Expand Panel'}
            >
              {isSidebarOpen ? <ChevronLeft className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
            </button>
          </div>

          {isSidebarOpen && (
            <div className="p-3.5 space-y-4 text-xs">
              {/* LAYOUT Engine Selector */}
              <div>
                <div className="text-[10px] font-mono uppercase text-forensic-textDim font-bold mb-2 tracking-wider">
                  Graph Layout
                </div>
                <div className="grid grid-cols-2 gap-1.5 font-mono text-[11px]">
                  {[
                    { id: 'flow', label: 'Flow (DAG)' },
                    { id: 'force', label: 'Force (CoSE)' },
                    { id: 'hierarchical', label: 'Hierarchical' },
                    { id: 'radial', label: 'Radial' },
                  ].map((l) => (
                    <button
                      key={l.id}
                      onClick={() => setLayoutMode(l.id as LayoutType)}
                      className={`px-2 py-1.5 rounded text-left flex items-center space-x-1.5 border transition-colors ${
                        layoutMode === l.id
                          ? 'bg-blue-600/15 border-blue-500/40 text-blue-400 font-bold'
                          : 'bg-forensic-surface border-forensic-border text-forensic-textMuted hover:text-forensic-text'
                      }`}
                    >
                      <span className={`w-2 h-2 rounded-full ${layoutMode === l.id ? 'bg-blue-400' : 'bg-transparent border border-forensic-border'}`} />
                      <span>{l.label}</span>
                    </button>
                  ))}
                </div>
              </div>

              {/* HOPS Selection */}
              <div>
                <div className="text-[10px] font-mono uppercase text-forensic-textDim font-bold mb-2 tracking-wider">
                  Hop Traversal Depth
                </div>
                <div className="space-y-1.5 font-mono text-[11px]">
                  {[1, 2, 3].map((hop) => (
                    <label key={hop} className="flex items-center space-x-2 cursor-pointer text-forensic-text hover:text-white">
                      <input
                        type="checkbox"
                        checked={selectedHops.has(hop)}
                        onChange={() => toggleHopFilter(hop)}
                        className="rounded border-forensic-border bg-forensic-surface text-blue-600 focus:ring-0 focus:ring-offset-0 h-3.5 w-3.5"
                      />
                      <span>Hop {hop} Counterparties</span>
                    </label>
                  ))}
                </div>
              </div>

              {/* ENTITY TYPES */}
              <div>
                <div className="text-[10px] font-mono uppercase text-forensic-textDim font-bold mb-2 tracking-wider">
                  Entity Types
                </div>
                <div className="space-y-1.5 font-mono text-[11px]">
                  {[
                    { id: 'TARGET', label: 'Target Suspect Wallet', color: 'text-rose-400' },
                    { id: 'VASP', label: 'VASP Custodial Clusters', color: 'text-teal-400' },
                    { id: 'BRIDGE', label: 'Cross-Chain Bridges', color: 'text-purple-400' },
                    { id: 'INTERMEDIARY', label: 'Intermediary Wallets', color: 'text-indigo-400' },
                    { id: 'EXTERNAL', label: 'External Contracts / Unknown', color: 'text-forensic-textDim' },
                  ].map((e) => (
                    <label key={e.id} className="flex items-center space-x-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={selectedEntityTypes.has(e.id)}
                        onChange={() => toggleEntityType(e.id)}
                        className="rounded border-forensic-border bg-forensic-surface text-blue-600 focus:ring-0 focus:ring-offset-0 h-3.5 w-3.5"
                      />
                      <span className={e.color}>{e.label}</span>
                    </label>
                  ))}
                </div>
              </div>

              {/* BLOCKCHAIN NETWORK */}
              <div>
                <div className="text-[10px] font-mono uppercase text-forensic-textDim font-bold mb-2 tracking-wider">
                  Blockchain Network
                </div>
                <select
                  value={selectedChain}
                  onChange={(e) => setSelectedChain(e.target.value)}
                  className="w-full bg-forensic-surface border border-forensic-border rounded px-2 py-1.5 text-forensic-text font-mono text-xs focus:outline-none focus:border-purple-500"
                >
                  {graphMetrics.chainsAvailable.map((c) => (
                    <option key={c} value={c}>
                      {c === 'ALL' ? 'All Networks' : c.toUpperCase()}
                    </option>
                  ))}
                </select>
              </div>

              {/* TRANSACTION FILTERS: Token & Min Amount */}
              <div className="space-y-2.5 pt-2 border-t border-forensic-border">
                <div className="text-[10px] font-mono uppercase text-forensic-textDim font-bold tracking-wider">
                  Transaction Filters
                </div>
                <div>
                  <label className="text-[11px] text-forensic-textDim block mb-1">Asset Token</label>
                  <select
                    value={selectedToken}
                    onChange={(e) => setSelectedToken(e.target.value)}
                    className="w-full bg-forensic-surface border border-forensic-border rounded px-2 py-1.5 text-forensic-text font-mono text-xs focus:outline-none focus:border-blue-500"
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
                    <label className="text-[11px] text-forensic-textDim">Minimum Transfer</label>
                    <span className="font-mono text-[10px] text-teal-400">
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
                    className="w-full bg-forensic-surface border border-forensic-border rounded px-2 py-1.5 text-forensic-text font-mono text-xs focus:outline-none focus:border-blue-500"
                  />
                  <div className="flex gap-1 mt-1.5">
                    {[0, 100, 1000, 5000].map((preset) => (
                      <button
                        key={preset}
                        onClick={() => setMinAmount(preset)}
                        className={`flex-1 py-0.5 rounded text-[10px] font-mono border transition-colors ${
                          minAmount === preset
                            ? 'bg-blue-600 text-white border-blue-500'
                            : 'bg-forensic-surface border-forensic-border text-forensic-textDim hover:text-forensic-text'
                        }`}
                      >
                        {preset === 0 ? 'All' : `${preset >= 1000 ? preset / 1000 + 'k' : preset}`}
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <label className="text-[11px] text-forensic-textDim block mb-1">Time Horizon</label>
                  <select
                    value={timeRange}
                    onChange={(e) => setTimeRange(e.target.value)}
                    className="w-full bg-forensic-surface border border-forensic-border rounded px-2 py-1.5 text-forensic-text font-mono text-xs focus:outline-none focus:border-blue-500"
                  >
                    <option value="ALL">All Time</option>
                    <option value="24H">Last 24 Hours</option>
                    <option value="7D">Last 7 Days</option>
                    <option value="30D">Last 30 Days</option>
                  </select>
                </div>
              </div>

              {/* RISK LEVEL FILTER */}
              <div className="pt-2 border-t border-forensic-border">
                <div className="text-[10px] font-mono uppercase text-forensic-textDim font-bold mb-2 tracking-wider">
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
                            : 'bg-blue-600 text-white border-blue-500'
                          : 'bg-forensic-surface border-forensic-border text-forensic-textDim hover:text-forensic-text'
                      }`}
                    >
                      {r.charAt(0) + r.slice(1).toLowerCase()}
                    </button>
                  ))}
                </div>
              </div>

              {/* Clear Filters Action */}
              <div className="pt-3">
                <button
                  onClick={handleClearFilters}
                  className="w-full py-1.5 rounded-lg bg-forensic-surface hover:bg-forensic-border text-forensic-text border border-forensic-border transition-colors font-mono text-xs flex items-center justify-center space-x-1.5"
                >
                  <RotateCcw className="h-3 w-3 text-forensic-textDim" />
                  <span>Reset All Filters</span>
                </button>
              </div>
            </div>
          )}
        </div>

        {/* ======================================================================= */}
        {/* 3. CYTOSCAPE GRAPH CANVAS / SANKEY DUAL VIEW */}
        {/* ======================================================================= */}
        {viewMode === 'FUND_FLOW' ? (
          <div className="flex-1 bg-forensic-bg h-full overflow-hidden">
            <SankeyFlowView
              graphData={graphData}
              rootAddress={rootAddress}
              onSelectAddress={(addr) => {
                const node = cyRef.current?.getElementById(addr);
                if (node && node.length > 0) {
                  node.select();
                  setSelectedElement({ type: 'NODE', data: node.data() });
                }
              }}
            />
          </div>
        ) : (
          <div className="flex-1 relative bg-forensic-bg h-full flex flex-col">
            {/* Live Streaming Indicator & Tag Color Legend Overlay */}
            <div className="absolute top-3 left-3 z-10 flex flex-col gap-2 pointer-events-none">
              {/* Case 3: Active Cross-Chain Bridge Continuity Alert Banner */}
              {(() => {
                const bEdges = (graphData?.edges || []).filter(
                  (e: any) => e.data?.is_cross_chain || Boolean(e.data?.bridge_protocol)
                );
                const bNodes = (graphData?.nodes || []).filter(
                  (n: any) => n.data?.role === 'BRIDGE_PROTOCOL'
                );
                if (bEdges.length === 0 && bNodes.length === 0) return null;
                const primaryEdge = bEdges[0]?.data;
                const protoName = primaryEdge?.bridge_protocol || bNodes[0]?.data?.bridge_protocol || 'Cross-Chain Bridge';
                const srcChain = primaryEdge?.source_chain || 'Ethereum';
                const dstChain = primaryEdge?.target_chain || 'Destination Chain';
                const txHash = primaryEdge?.tx_hash || '';

                return (
                  <div className="flex items-center justify-between gap-3 px-3 py-2 rounded-lg bg-purple-950/90 backdrop-blur-md border border-purple-500/50 text-purple-200 text-xs font-mono shadow-xl pointer-events-auto animate-fade-in max-w-xl">
                    <div className="flex items-center space-x-2">
                      <div className="p-1 rounded bg-purple-600 text-white animate-pulse">
                        <Network className="h-4 w-4" />
                      </div>
                      <div>
                        <div className="flex items-center space-x-1.5">
                          <span className="font-bold text-white uppercase text-[11px] tracking-wide">
                            Bridge Continuity: {protoName}
                          </span>
                          <span className="px-1.5 py-0.2 rounded text-[9px] bg-purple-800 text-purple-200 uppercase font-bold">
                            Active Hop
                          </span>
                        </div>
                        <div className="text-[10px] text-purple-300 mt-0.5">
                          {srcChain.toUpperCase()} → <strong className="text-white">{dstChain.toUpperCase()}</strong>
                          {txHash ? ` • Tx: ${txHash.slice(0, 10)}...` : ''}
                        </div>
                      </div>
                    </div>
                    <button
                      onClick={() => {
                        if (!cyRef.current) return;
                        const cy = cyRef.current;
                        const bEls = cy.$('.is-cross-chain, [role = "BRIDGE_PROTOCOL"]');
                        if (bEls.length > 0) {
                          cy.animate({ center: { eles: bEls }, zoom: 1.3, duration: 400 });
                          bEls.select();
                        }
                      }}
                      className="px-2.5 py-1 rounded bg-purple-600 hover:bg-purple-500 text-white text-[10px] font-bold uppercase transition-colors shrink-0 shadow"
                    >
                      Focus Rail →
                    </button>
                  </div>
                );
              })()}

              {isStreaming && (
                <div className="flex items-center space-x-1.5 px-2.5 py-1 rounded-full bg-blue-600/90 text-white font-mono text-[10px] font-bold shadow-lg animate-pulse pointer-events-auto border border-blue-400 w-fit">
                  <span className="w-2 h-2 rounded-full bg-white" />
                  <span>STREAMING HOP {streamingHop} VIA WEBSOCKET...</span>
                </div>
              )}

              {/* Tag Color Legend */}
              <div className="flex items-center space-x-2 px-2.5 py-1.5 rounded-lg bg-forensic-surface/90 backdrop-blur-md border border-forensic-border text-[10px] font-mono shadow-md pointer-events-auto animate-fade-in w-fit">
                <span className="text-forensic-textDim uppercase font-bold text-[9px]">Legend:</span>
                <span className="flex items-center space-x-1">
                  <span className="w-2.5 h-2.5 bg-red-500" style={{ clipPath: 'polygon(50% 0%, 61% 35%, 98% 35%, 68% 57%, 79% 91%, 50% 70%, 21% 91%, 32% 57%, 2% 35%, 39% 35%)' }} />
                  <span className="text-red-400 font-semibold">Target</span>
                </span>
                <span className="flex items-center space-x-1">
                  <span className="w-2.5 h-2 rounded-sm bg-teal-400" />
                  <span className="text-teal-400 font-semibold">Exchange</span>
                </span>
                <span className="flex items-center space-x-1">
                  <span className="w-2.5 h-2.5 bg-purple-400" style={{ clipPath: 'polygon(50% 0%, 100% 50%, 50% 100%, 0% 50%)' }} />
                  <span className="text-purple-400 font-semibold">Mixer</span>
                </span>
                <span className="flex items-center space-x-1">
                  <span className="w-2.5 h-2.5 bg-rose-600" style={{ clipPath: 'polygon(30% 0%, 70% 0%, 100% 30%, 100% 70%, 70% 100%, 30% 100%, 0% 70%, 0% 30%)' }} />
                  <span className="text-rose-400 font-semibold">Sanctioned</span>
                </span>
                <span className="flex items-center space-x-1">
                  <span className="w-2.5 h-2.5 rounded-full bg-slate-400" />
                  <span className="text-slate-300 font-semibold">Unknown</span>
                </span>
              </div>
            </div>

            {/* Cytoscape Container with dot-grid background */}
            <div ref={containerRef} className="w-full flex-1 graph-canvas-grid" />

            {/* Timeline Time-Machine Replay Bar */}
            {transactions && transactions.length > 0 && (
              <div className="p-3 border-t border-forensic-border bg-forensic-bg/95 z-10">
                <TimelineReplayBar
                  transactions={transactions}
                  onStepChange={(tx) => {
                    if (!cyRef.current || !tx) return;
                    const cy = cyRef.current;
                    cy.elements().removeClass('replay-active-edge replay-active-node path-dimmed');

                    const src = (tx.from_address || '').toLowerCase();
                    const dst = (tx.to_address || '').toLowerCase();

                    cy.elements().addClass('path-dimmed');

                    const matchingNodes = cy.nodes().filter((n: any) => {
                      const nid = n.id().toLowerCase();
                      return nid === src || nid === dst;
                    });

                    const matchingEdges = cy.edges().filter((e: any) => {
                      const s = e.source().id().toLowerCase();
                      const t = e.target().id().toLowerCase();
                      return (s === src && t === dst) || (e.data('txHash') && e.data('txHash').toLowerCase() === tx.tx_hash.toLowerCase());
                    });

                    matchingNodes.removeClass('path-dimmed').addClass('replay-active-node');
                    matchingEdges.removeClass('path-dimmed').addClass('replay-active-edge');

                    if (matchingEdges.length > 0) {
                      cy.animate({
                        center: { eles: matchingEdges },
                        duration: 250,
                      });
                    }
                  }}
                />
              </div>
            )}

            {/* Active Path Focus Banner (Bottom Left of Canvas) */}
            {focusedPath && (
              <div className="absolute bottom-20 left-4 z-10 p-3 rounded-lg bg-forensic-surface/95 border border-cyan-500/40 shadow-xl backdrop-blur-md font-mono text-xs max-w-md animate-fade-in">
                <div className="flex items-center justify-between mb-1.5">
                  <div className="flex items-center space-x-1.5 text-cyan-400 font-bold">
                    <Sparkles className="h-3.5 w-3.5 animate-pulse" />
                    <span>PRIMARY FUND FLOW FOCUS</span>
                  </div>
                  <button
                    onClick={() => {
                      cyRef.current?.elements().removeClass('path-focused path-dimmed');
                      updateFocusedPath(null);
                    }}
                    className="text-forensic-textDim hover:text-forensic-text p-0.5"
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                </div>
                <div className="text-[11px] text-forensic-textDim space-y-1">
                  <div>
                    Destination:{' '}
                    <strong className="text-emerald-400">
                      {focusedPath.destinationName || focusedPath.targetNodeId.slice(0, 10) + '...'}
                    </strong>
                  </div>
                  <div className="flex justify-between">
                    <span>Hop Distance: <strong>{focusedPath.hopDistance} Hop(s)</strong></span>
                    <span>Observable Flow: <strong className="text-cyan-400">{focusedPath.totalVolume.toFixed(2)} {graphMetrics.primaryToken}</strong></span>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* ======================================================================= */}
        {/* 4. RIGHT FORENSIC INSPECTOR DRAWER */}
        {/* ======================================================================= */}
        {selectedElement && (
          <div className="w-80 border-l border-forensic-border bg-forensic-surfaceRaised/95 backdrop-blur-md p-4 overflow-y-auto z-20 flex flex-col justify-between animate-slide-left text-xs font-sans">
            <div className="space-y-4">
              {/* Header */}
              <div className="flex items-center justify-between pb-3 border-b border-forensic-border">
                <div className="flex items-center space-x-2 font-mono font-bold text-forensic-text uppercase text-[11px]">
                  <ShieldCheck className="h-4 w-4 text-teal-400" />
                  <span>{selectedElement.type === 'NODE' ? 'Node Forensics' : 'Transfer Details'}</span>
                </div>
                <button
                  onClick={() => setSelectedElement(null)}
                  className="text-forensic-textDim hover:text-forensic-text p-1"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>

              {/* NODE DETAILS */}
              {selectedElement.type === 'NODE' && (
                <div className="space-y-3 font-mono text-[11px]">
                  {/* Address Badge */}
                  <div>
                    <div className="text-forensic-textDim text-[10px] uppercase">Cryptocurrency Address</div>
                    <div className="flex items-center justify-between p-2 rounded bg-forensic-surface border border-forensic-border mt-1">
                      <span className="font-bold text-forensic-text break-all text-[11px]">
                        {selectedElement.data.fullAddress || selectedElement.data.id}
                      </span>
                      <button
                        onClick={() => handleCopy(selectedElement.data.fullAddress || selectedElement.data.id)}
                        className="ml-2 p-1 text-forensic-textDim hover:text-forensic-text"
                        title="Copy Address"
                      >
                        {copied ? <Check className="h-3.5 w-3.5 text-emerald-400" /> : <Copy className="h-3.5 w-3.5" />}
                      </button>
                    </div>
                  </div>

                  {/* Entity Provenance if VASP */}
                  {selectedElement.data.isVasp && (
                    <div className="p-3 rounded-lg bg-teal-950/30 border border-teal-800/40 text-[11px] space-y-1">
                      <div className="text-teal-400 font-bold">
                        {selectedElement.data.vaspName} ({selectedElement.data.addressType})
                      </div>
                      <div className="text-forensic-textDim text-[10px]">
                        Provenance: Verified Proof of Reserves / Etherscan Public Label
                      </div>
                      <div className="text-emerald-400 text-[10px]">
                        Confidence: {selectedElement.data.vaspConfidence || 98}% (HIGH)
                      </div>
                    </div>
                  )}

                  {/* Financial Flow Summary */}
                  <div className="p-3 rounded-lg bg-forensic-surface border border-forensic-border space-y-1.5 font-mono text-[11px]">
                    <div className="text-[10px] uppercase text-forensic-textDim font-bold font-sans">
                      Topological Flow Metrics
                    </div>
                    <div className="flex justify-between">
                      <span className="text-forensic-textDim">Hop Distance:</span>
                      <span className="text-forensic-text font-bold">Hop {selectedElement.data.hop}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-forensic-textDim">Total Inflow:</span>
                      <span className="text-emerald-400 font-bold">{Number(selectedElement.data.totalInflow || 0).toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-forensic-textDim">Total Outflow:</span>
                      <span className="text-rose-400 font-bold">{Number(selectedElement.data.totalOutflow || 0).toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-forensic-textDim">Transactions:</span>
                      <span className="text-forensic-text">{selectedElement.data.txCount || 0} Transfers</span>
                    </div>
                  </div>

                  {/* Action Link & Pivot Trigger */}
                  <div className="space-y-2 pt-1">
                    <a
                      href={`https://etherscan.io/address/${selectedElement.data.fullAddress || selectedElement.data.id}`}
                      target="_blank"
                      rel="noreferrer"
                      className="flex items-center justify-center space-x-1.5 w-full py-2 rounded bg-forensic-surfaceRaised hover:bg-forensic-border border border-forensic-border text-forensic-text font-medium text-xs transition-colors"
                    >
                      <ExternalLink className="h-3.5 w-3.5" />
                      <span>View on Blockchain Explorer</span>
                    </a>

                    {onPivotTarget && (
                      <button
                        onClick={() => onPivotTarget(selectedElement.data.fullAddress || selectedElement.data.id)}
                        className="w-full py-2 rounded bg-blue-600 hover:bg-blue-500 text-white font-bold font-mono text-xs flex items-center justify-center space-x-1.5 shadow-sm transition-all cursor-pointer"
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
                    <div className="text-forensic-textDim text-[10px] uppercase">Transaction Hash</div>
                    <div className="p-2 rounded bg-forensic-surface border border-forensic-border mt-1 font-bold text-forensic-text break-all">
                      {selectedElement.data.txHash || selectedElement.data.id}
                    </div>
                  </div>

                  <div className="p-3 rounded-lg bg-forensic-surface border border-forensic-border space-y-1.5 font-mono text-[11px]">
                    <div className="flex justify-between">
                      <span className="text-forensic-textDim">Transfer Amount:</span>
                      <span className="text-emerald-400 font-bold">
                        {selectedElement.data.amount} {selectedElement.data.tokenSymbol}
                      </span>
                    </div>
                    {/* Case 6: INR/USD Valuation */}
                    {selectedElement.data.amountUsd && (
                      <div className="flex justify-between">
                        <span className="text-forensic-textDim">USD Value:</span>
                        <span className="text-sky-400 font-bold">
                          ${Number(selectedElement.data.amountUsd).toLocaleString('en-US', { maximumFractionDigits: 2 })}
                        </span>
                      </div>
                    )}
                    {selectedElement.data.amountInr && (
                      <div className="flex justify-between">
                        <span className="text-forensic-textDim">INR Value:</span>
                        <span className="text-amber-400 font-bold">
                          ₹{Number(selectedElement.data.amountInr).toLocaleString('en-IN', { maximumFractionDigits: 0 })}
                        </span>
                      </div>
                    )}
                    {/* Case 2: FIFO Taint Ratio */}
                    {selectedElement.data.taintRatio != null && (
                      <div className="flex justify-between items-center">
                        <span className="text-forensic-textDim">Taint Ratio:</span>
                        <span className={`font-bold ${
                          selectedElement.data.taintRatio >= 0.8 ? 'text-red-400' :
                          selectedElement.data.taintRatio >= 0.4 ? 'text-orange-400' :
                          'text-lime-400'
                        }`}>
                          {selectedElement.data.taintRatio >= 0.8 ? '🔴' : selectedElement.data.taintRatio >= 0.4 ? '🟡' : '🟢'}{' '}
                          {(selectedElement.data.taintRatio * 100).toFixed(1)}%
                        </span>
                      </div>
                    )}
                    {selectedElement.data.traceableAmount != null && (
                      <div className="flex justify-between">
                        <span className="text-forensic-textDim">Traceable:</span>
                        <span className="text-red-300">{selectedElement.data.traceableAmount} {selectedElement.data.tokenSymbol}</span>
                      </div>
                    )}
                    <div className="flex justify-between">
                      <span className="text-forensic-textDim">Hop Depth:</span>
                      <span className="text-forensic-text">Hop {selectedElement.data.hop}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-forensic-textDim">Timestamp:</span>
                      <span className="text-forensic-textDim">{selectedElement.data.timestamp ? new Date(selectedElement.data.timestamp).toLocaleString() : 'Recent'}</span>
                    </div>
                  </div>

                  <div className="p-2.5 rounded bg-forensic-surface border border-forensic-border text-[10px] space-y-1 font-mono">
                    <div className="text-forensic-textDim">FROM: {selectedElement.data.source}</div>
                    <div className="text-forensic-textDim">TO: {selectedElement.data.target}</div>
                  </div>

                  {selectedElement.data.txHash && (
                    <a
                      href={`https://etherscan.io/tx/${selectedElement.data.txHash}`}
                      target="_blank"
                      rel="noreferrer"
                      className="flex items-center justify-center space-x-1.5 w-full py-2 rounded bg-blue-600 hover:bg-blue-500 text-white font-medium text-xs transition-colors"
                    >
                      <ExternalLink className="h-3.5 w-3.5" />
                      <span>Verify on Explorer</span>
                    </a>
                  )}
                </div>
              )}
            </div>

            <div className="pt-3 border-t border-forensic-border text-[10px] text-forensic-textDim font-mono text-center">
              SUDARSHAN Financial Intelligence Core
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
