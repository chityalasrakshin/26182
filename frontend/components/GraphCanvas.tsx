'use client';

import React, { useEffect, useRef, useState, useMemo, useCallback } from 'react';
import cytoscape from 'cytoscape';
import dagre from 'cytoscape-dagre';
import {
  Maximize2,
  Minimize2,
  PanelTop,
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
  AlertTriangle,
  Clock,
  Box,
} from 'lucide-react';
import dynamic from 'next/dynamic';
import { GraphData, GraphNode, GraphEdge, NormalizedTransaction } from '../lib/types';
import { SankeyFlowView } from './SankeyFlowView';
import { TimelineReplayBar } from './TimelineReplayBar';
import { EntityCentralityPanel } from './EntityCentralityPanel';
import { TemporalHistogramBar } from './TemporalHistogramBar';
import { getNodeIconGlyph, getNodeIconifyUrl } from '../src/components/graph/nodeIcons';
import { GraphLegend } from './GraphLegend';

const GraphCanvas3D = dynamic(() => import('./GraphCanvas3D'), { ssr: false });

// Register dagre layout plugin safely
if (typeof window !== 'undefined') {
  try {
    cytoscape.use(dagre);
  } catch (e) {
    // Already registered
  }
}

type LayoutType = 'flow' | 'force' | 'hierarchical' | 'radial' | 'timeline' | 'i2-peeling';
type ViewMode = 'NETWORK' | 'FUND_FLOW' | 'TIMELINE' | 'EVIDENCE';
type RiskFilterType = 'ALL' | 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';

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

function buildNodeElement(n: any): cytoscape.ElementDefinition {
  const d = n.data || n;
  const nodeId = d.id || d.address;
  const isRoot = d.role === 'INPUT_WALLET' || d.is_root || d.hop === 0;
  const isVasp = d.is_vasp || d.role === 'KNOWN_VASP';
  const isBridge = d.role === 'BRIDGE_PROTOCOL' || Boolean(d.bridge_protocol);
  const hop = d.hop ?? 1;
  const nodeChain = (d.chain || 'ethereum').toLowerCase();
  const normalizedRisk = d.risk_level ? String(d.risk_level).toLowerCase() : 'unknown';

  const rawCat = (d.category || d.entity || d.entity_type || d.entityType || d.label || d.role || d.vasp_name || '').toLowerCase();
  let nodeTag: 'target' | 'exchange' | 'mixer' | 'sanctioned' | 'bridge' | 'unknown' = 'unknown';
  if (isRoot) {
    nodeTag = 'target';
  } else if (isBridge) {
    nodeTag = 'bridge';
  } else if (d.is_contract || d.entity_type === 'contract' || d.entityType === 'contract') {
    nodeTag = 'unknown';
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

  // Select the asset from the final graph classification. The API often
  // omits entity_type, so using only that field made every node become wallet.
  const explicitEntityType = String(d.entity_type || d.entityType || '').toLowerCase();
  const semanticEntityType = isRoot
    ? 'target'
    : isBridge
      ? 'bridge'
      : nodeTag === 'exchange'
        ? (explicitEntityType === 'vasp' ? 'vasp' : 'exchange')
        : nodeTag === 'mixer'
          ? 'mixer'
          : nodeTag === 'sanctioned'
            ? 'sanctioned'
            : explicitEntityType === 'contract' || d.is_contract
              ? 'contract'
              : explicitEntityType === 'wallet'
                ? 'wallet'
                : explicitEntityType === 'unknown'
                  ? 'unknown'
                : 'wallet';

  const shortAddr = `${nodeId.slice(0, 6)}...${nodeId.slice(-4)}`;
  const chainBadge = nodeChain === 'solana' ? '[SOL] ' : nodeChain === 'tron' ? '[TRX] ' : nodeChain === 'bitcoin' ? '[BTC] ' : nodeChain === 'bsc' ? '[BSC] ' : '';

  const isTreasury = d.role === 'COLD_TREASURY' || rawCat.includes('treasury') || rawCat.includes('cold');
  const isLiquidity = d.role === 'EXCHANGE_LIQUIDITY' || rawCat.includes('liquidity');

  const confNum = typeof d.vasp_confidence === 'number'
    ? d.vasp_confidence
    : typeof d.vasp_confidence === 'string' && !isNaN(parseFloat(d.vasp_confidence))
      ? parseFloat(d.vasp_confidence)
      : null;
  const confDisplay = confNum !== null
    ? String(d.vasp_confidence)
    : d.vasp_confidence
      ? String(d.vasp_confidence)
      : null;

  const iconGlyph = getNodeIconGlyph(semanticEntityType);
  const label = isRoot
    ? `${iconGlyph}  TARGET\n${shortAddr}  ${chainBadge.trim() || '[ETH]'}`
    : isBridge
      ? `[Bridge: ${d.bridge_protocol || 'Bridge'}]\n${shortAddr}`
      : isTreasury
        ? `Cold Treasury\n${shortAddr}`
        : isLiquidity
          ? `Exchange Liquidity\n${shortAddr}`
          : nodeTag === 'exchange' || isVasp
            ? `${iconGlyph}  ${d.vasp_name || 'VASP'}${confDisplay ? `\nCONF: ${confDisplay}` : ''}`
            : nodeTag === 'mixer'
              ? `${iconGlyph}  MIXER\n${shortAddr}`
              : nodeTag === 'sanctioned'
                ? `${iconGlyph}  SANCTIONED\n${shortAddr}`
                : `${iconGlyph}  H${hop} · ${shortAddr}`;

  return {
    group: 'nodes',
    classes: `tag-${nodeTag} chain-${nodeChain} risk-${normalizedRisk} ${isRoot ? 'is-root tag-target' : ''} ${isVasp || nodeTag === 'exchange' ? 'is-vasp tag-exchange' : ''} ${isBridge ? 'is-bridge tag-bridge' : ''} ${isTreasury ? 'node-treasury' : ''} ${isLiquidity ? 'node-liquidity' : ''} ${hop === 1 ? 'hop-1' : ''}`.trim(),
    data: {
      id: nodeId,
      label: label,
      iconUrl: getNodeIconifyUrl(semanticEntityType, isRoot ? 'ef4444' : 'ffffff'),
      isRoot: isRoot,
      isVasp: isVasp || nodeTag === 'exchange',
      isBridge: isBridge,
      bridgeProtocol: d.bridge_protocol,
      chain: nodeChain,
      tag: nodeTag,
      category: nodeTag,
      vaspName: d.vasp_name,
      vaspConfidence: d.vasp_confidence ?? null,
      provenance: d.provenance || d.source_name || d.source || null,
      hop: hop,
      addressType: d.address_type || 'hot_wallet',
      fullAddress: nodeId,
      totalInflow: d.total_inflow || 0,
      totalOutflow: d.total_outflow || 0,
      txCount: d.tx_count || 0,
      role: d.role || (isRoot ? 'TARGET' : isVasp ? 'VASP' : isBridge ? 'BRIDGE' : hop <= 3 ? 'INTERMEDIARY' : 'EXTERNAL'),
      nodeOpacity: hopOpacity(hop),
      entityType: semanticEntityType,
      riskLevel: d.risk_level ?? null,
      riskScore: d.risk_score ?? null,
    },
  };
}

function buildEdgeElement(e: any, edgeId: string): cytoscape.ElementDefinition {
  const d = e.data || e;
  const src = d.source;
  const tgt = d.target;
  const amt = Number(d.amount || 0);
  const sym = (d.asset_symbol || d.token_symbol || 'ETH').toUpperCase();
  const isCrossChain = Boolean(d.is_cross_chain);
  const bridgeProto = d.bridge_protocol || '';

  const amountUsd = d.amount_usd ? Number(d.amount_usd) : null;
  const amountInr = d.amount_inr ? Number(d.amount_inr) : null;
  const taintRatio = d.taint_ratio != null ? Number(d.taint_ratio) : null;
  const traceableAmount = d.traceable_amount != null ? Number(d.traceable_amount) : null;

  const amtStr = amt > 0 ? `${amt >= 1000 ? (amt / 1000).toFixed(1) + 'k' : amt.toFixed(2)} ${sym}` : '';
  const inrStr = amountInr ? `₹${amountInr >= 100000 ? (amountInr / 100000).toFixed(1) + 'L' : amountInr.toFixed(0)}` : '';
  const label = isCrossChain
    ? `[Bridge: ${bridgeProto || 'Cross-Chain'}] ${amtStr}`
    : inrStr ? `${amtStr}\n${inrStr}` : amtStr;
  const transactionCount = Number(d.transaction_count || 1);
  const displayLabel = transactionCount > 1 ? `${label}\n${transactionCount} TX` : label;

  let taintClass = '';
  if (taintRatio !== null) {
    if (taintRatio >= 0.8) taintClass = 'taint-high';
    else if (taintRatio >= 0.4) taintClass = 'taint-medium';
    else if (taintRatio > 0) taintClass = 'taint-low';
  }

  return {
    group: 'edges',
    classes: `${isCrossChain ? 'is-cross-chain' : ''} ${taintClass}`.trim(),
    data: {
      id: edgeId,
      source: src,
      target: tgt,
      label: displayLabel,
      amount: amt,
      edgeWidth: isCrossChain ? 3.5 : edgeWidthFromAmount(amt),
      tokenSymbol: sym,
      transactionCount,
      direction: d.direction || 'outgoing',
      txHash: d.tx_hash || '',
      timestamp: d.timestamp || '',
      hop: d.hop || 1,
      isCrossChain: isCrossChain,
      bridgeProtocol: bridgeProto,
      sourceChain: d.source_chain,
      targetChain: d.target_chain,
      amountUsd: amountUsd,
      amountInr: amountInr,
      unitPriceUsd: d.unit_price_usd || null,
      unitPriceInr: d.unit_price_inr || null,
      taintRatio: taintRatio,
      traceableAmount: traceableAmount,
      unclassifiedAmount: d.unclassified_amount || null,
    },
  };
}

function getLayoutConfig(
  layoutMode: LayoutType,
  nodeCount: number,
  spacingScale: number,
  rootId?: string,
  fundFlow = false
) {
  switch (layoutMode) {
    case 'i2-peeling':
      return {
        name: 'dagre',
        rankDir: 'LR',
        nodeSep: nodeCount > 80 ? 60 : Math.round(90 * spacingScale),
        rankSep: nodeCount > 80 ? 180 : Math.round(260 * spacingScale),
        edgeSep: nodeCount > 80 ? 30 : 50,
        ranker: 'longest-path',
        animate: true,
        animationDuration: 400,
        animationEasing: 'ease-out-cubic' as any,
        fit: true,
        padding: 60,
      };
    case 'flow':
      if (fundFlow) {
        return { name: 'preset', fit: false, animate: false };
      }
      return {
        name: 'dagre',
        rankDir: 'LR',
        nodeSep: nodeCount > 80 ? 64 : Math.round((fundFlow ? 92 : 120) * spacingScale),
        rankSep: nodeCount > 80 ? 140 : Math.round((fundFlow ? 180 : 200) * spacingScale),
        edgeSep: nodeCount > 80 ? 25 : fundFlow ? 28 : 40,
        ranker: fundFlow ? 'tight-tree' : 'network-simplex',
        animate: true,
        animationDuration: 400,
        animationEasing: 'ease-out-cubic' as any,
        fit: true,
        padding: 50,
      };
    case 'force': {
      // Network view is relationship-first: let Cytoscape expose natural
      // neighborhoods instead of imposing the left-to-right flow hierarchy.
      // The small-graph values are intentionally generous so the validated
      // 2-node / 12-edge graph remains readable rather than collapsing.
      const densityGravity = nodeCount > 100 ? 0.65 : nodeCount > 50 ? 0.42 : 0.18;
      const densityRepulsion = nodeCount > 100 ? 85000 : nodeCount > 50 ? 150000 : 260000;
      const densityEdgeLen = nodeCount > 100 ? 120 : nodeCount > 50 ? 165 : 220;
      return {
        name: 'cose',
        animate: 'end',
        animationDuration: 500,
        animationEasing: 'ease-out-cubic' as any,
        randomize: true,
        componentSpacing: nodeCount > 100 ? 120 : 220,
        nodeOverlap: 24,
        idealEdgeLength: () => densityEdgeLen,
        nodeRepulsion: () => densityRepulsion,
        edgeElasticity: () => 55,
        gravity: densityGravity,
        gravityRange: 3.8,
        numIter: nodeCount > 100 ? 250 : 500,
        initialEnergyOnIncremental: 0.35,
        nestingFactor: 1.15,
        fit: true,
        padding: 50,
      };
    }
    case 'hierarchical':
      return {
        name: 'breadthfirst',
        directed: true,
        roots: rootId ? [`#${rootId}`] : undefined,
        spacingFactor: nodeCount > 80 ? 1.4 : 2.0 * spacingScale,
        avoidOverlap: true,
        animate: true,
        animationDuration: 400,
        fit: true,
        padding: 50,
        maximal: false,
      };
    case 'radial':
      return { name: 'preset', fit: false, animate: false };
    /*
      return {
        name: 'concentric',
        concentric: (node: any) => 4 - (node.data('hop') || 1),
        levelWidth: () => 1,
        minNodeSpacing: nodeCount > 80 ? 50 : Math.round(120 * spacingScale),
        animate: true,
        animationDuration: 400,
        fit: true,
        padding: 50,
        startAngle: 0,
        sweep: 2 * Math.PI,
        equidistant: false,
      };
    */
    case 'timeline':
      return {
        name: 'preset',
        fit: false,
        animate: false,
      };
  }
}

/** Deterministic, canvas-aware Fund Flow positioning. */
function applyFundFlowPositions(cy: cytoscape.Core) {
  const width = Math.max(cy.width(), 720);
  const height = Math.max(cy.height(), 520);
  const center = { x: width / 2, y: height / 2 };
  const nodes = cy.nodes();
  const root = nodes.filter((n) => Boolean(n.data('isRoot')) || Number(n.data('hop')) === 0).first() as cytoscape.NodeSingular;

  if (root.length) root.position(center);

  const groups = new Map<number, cytoscape.NodeCollection>();
  nodes.not(root).forEach((node) => {
    const hop = Math.max(1, Math.min(3, Number(node.data('hop')) || 1));
    if (!groups.has(hop)) groups.set(hop, cy.collection());
    groups.get(hop)!.merge(node);
  });

  groups.forEach((group, hop) => {
    const ordered = group.sort((a, b) => a.id().localeCompare(b.id()));
    const baseRadius = Math.min(width, height) * (0.19 + hop * 0.14);
    const maxPerRing = Math.max(6, Math.floor((2 * Math.PI * baseRadius) / 125));
    ordered.forEach((node, index) => {
      const ring = Math.floor(index / maxPerRing);
      const slot = index % maxPerRing;
      const count = Math.min(maxPerRing, ordered.length - ring * maxPerRing);
      const radius = baseRadius + ring * 82;
      const angle = -Math.PI / 2 + ((slot + 0.5) / Math.max(count, 1)) * Math.PI * 2 + hop * 0.23;
      node.position({
        x: center.x + Math.cos(angle) * radius,
        y: center.y + Math.sin(angle) * radius,
      });
    });
  });

  cy.fit(undefined, 55);
}

/** Deterministic concentric rings for the Radial investigation view. */
function applyRadialPositions(cy: cytoscape.Core) {
  const width = Math.max(cy.width(), 720);
  const height = Math.max(cy.height(), 520);
  const center = { x: width / 2, y: height / 2 };
  const nodes = cy.nodes(':visible');
  const root = nodes.filter((n) => Boolean(n.data('isRoot')) || Number(n.data('hop')) === 0).first() as cytoscape.NodeSingular;
  if (root.length) root.position(center);

  const groups = new Map<number, cytoscape.NodeCollection>();
  nodes.not(root).forEach((node) => {
    const hop = Math.max(1, Math.min(3, Number(node.data('hop')) || 1));
    if (!groups.has(hop)) groups.set(hop, cy.collection());
    groups.get(hop)!.merge(node);
  });

  const maxRadius = Math.max(150, Math.min(width, height) * 0.42);
  const hopLevels = Math.max(1, groups.size);
  const ringGap = Math.max(125, Math.min(220, maxRadius / hopLevels));

  groups.forEach((group, hop) => {
    const ordered = group.sort((a, b) => a.id().localeCompare(b.id()));
    const baseRadius = Math.min(maxRadius, Math.max(145, ringGap * hop));
    const maxPerRing = Math.max(8, Math.floor((2 * Math.PI * baseRadius) / 105));
    ordered.forEach((node, index) => {
      const ring = Math.floor(index / maxPerRing);
      const slot = index % maxPerRing;
      const count = Math.min(maxPerRing, ordered.length - ring * maxPerRing);
      const radius = Math.min(maxRadius, baseRadius + ring * 76);
      const angle = -Math.PI / 2 + ((slot + 0.5) / Math.max(count, 1)) * Math.PI * 2 + hop * 0.17;
      node.position({ x: center.x + Math.cos(angle) * radius, y: center.y + Math.sin(angle) * radius });
    });
  });

  cy.fit(undefined, 55);
}

/** Deterministic traversal-depth bands for Hop Order (not chronological). */
function applyHopOrderPositions(cy: cytoscape.Core) {
  const width = Math.max(cy.width(), 720);
  const height = Math.max(cy.height(), 520);
  const center = { x: width / 2, y: height / 2 };
  const visible = cy.nodes(':visible');
  const root = visible.filter((node) => Boolean(node.data('isRoot')) || Number(node.data('hop')) === 0).first() as cytoscape.NodeSingular;

  if (root.length) root.position(center);

  const groups = new Map<number, cytoscape.NodeSingular[]>();
  visible.not(root).forEach((node) => {
    const rawHop = Number(node.data('hop'));
    const band = Number.isFinite(rawHop) && rawHop >= 1 ? Math.min(rawHop, 3) : 3;
    if (!groups.has(band)) groups.set(band, []);
    groups.get(band)!.push(node);
  });

  const leftPadding = Math.max(56, width * 0.055);
  const rightPadding = leftPadding;
  const usableWidth = Math.max(240, width - leftPadding - rightPadding);
  const maxHop = Math.max(1, ...Array.from(groups.keys()));
  // Keep dense hops to a bounded number of rows so fit() cannot turn the
  // graph into a narrow strip. Smaller groups still use the full width.
  const maxRowsPerBand = 6;
  const bandGap = Math.max(110, (height * 0.70) / Math.max(maxHop, 1));
  const rowGap = Math.min(58, Math.max(30, bandGap / maxRowsPerBand));

  groups.forEach((nodes, band) => {
    nodes.sort((a, b) => a.id().localeCompare(b.id()));
    const columns = Math.max(1, Math.ceil(nodes.length / maxRowsPerBand));
    const rows = Math.ceil(nodes.length / columns);
    // H0 remains central; increasing hop distance moves toward the top.
    const y = center.y + (maxHop / 2 - band) * bandGap;
    nodes.forEach((node, index) => {
      const row = Math.floor(index / columns);
      const rowStart = row * columns;
      const count = Math.min(columns, nodes.length - rowStart);
      // Every row spans the available width, including one-node rows.
      const x = count === 1
        ? center.x
        : leftPadding + ((index - rowStart) / (count - 1)) * usableWidth;
      node.position({ x, y: y + (row - (rows - 1) / 2) * rowGap });
    });
  });

  // One fit after explicit positions; fit never participates in positioning.
  cy.fit(undefined, 55);
}

function applyFilters(
  cy: cytoscape.Core,
  selectedHops: Set<number>,
  selectedEntityTypes: Set<string>,
  selectedToken: string,
  selectedChain: string,
  minAmount: number,
  viewMode: ViewMode,
  riskFilter: RiskFilterType = 'ALL'
) {
  cy.batch(() => {
    const validNodeIds = new Set<string>();

    cy.nodes().forEach((n) => {
      const d = n.data();
      const isRoot = d.isRoot || d.role === 'INPUT_WALLET' || d.hop === 0;
      const hop = d.hop ?? 1;
      const nodeChain = (d.chain || 'ethereum').toLowerCase();
      const isBridge = d.isBridge || d.role === 'BRIDGE_PROTOCOL';
      const isVasp = d.isVasp;
      const riskLevel = d.riskLevel || d.risk_level
        ? String(d.riskLevel || d.risk_level).toUpperCase()
        : 'UNKNOWN';

      // Chain filter (root stays visible)
      if (selectedChain !== 'ALL' && nodeChain !== selectedChain.toLowerCase() && !isRoot) {
        n.addClass('filter-hidden');
        return;
      }

      // Hop filter
      if (!isRoot && !selectedHops.has(hop)) {
        n.addClass('filter-hidden');
        return;
      }

      // Entity type filter
      let entityType = 'EXTERNAL';
      if (isRoot) entityType = 'TARGET';
      else if (isVasp) entityType = 'VASP';
      else if (isBridge) entityType = 'BRIDGE';
      else if (hop >= 1 && hop <= 3) entityType = 'INTERMEDIARY';

      if (!selectedEntityTypes.has(entityType) && !isBridge) {
        n.addClass('filter-hidden');
        return;
      }

      if (riskFilter !== 'ALL' && riskLevel !== riskFilter) {
        n.addClass('filter-hidden');
        return;
      }

      // View Mode Filtering
      if (viewMode === 'EVIDENCE' && !isRoot && !isVasp && !isBridge && hop > 2) {
        n.addClass('filter-hidden');
        return;
      }

      validNodeIds.add(n.id());
      n.removeClass('filter-hidden');
    });

    cy.edges().forEach((e) => {
      const d = e.data();
      const src = e.source().id();
      const tgt = e.target().id();

      if (!validNodeIds.has(src) || !validNodeIds.has(tgt)) {
        e.addClass('filter-hidden');
        return;
      }

      const amt = Number(d.amount || 0);
      const sym = (d.tokenSymbol || 'ETH').toUpperCase();

      // Token filter
      if (selectedToken !== 'ALL' && sym !== selectedToken) {
        e.addClass('filter-hidden');
        return;
      }

      // Min amount filter
      if (minAmount > 0 && amt < minAmount) {
        e.addClass('filter-hidden');
        return;
      }

      e.removeClass('filter-hidden');
    });
  });
}

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
  const lastRootRef = useRef<string | null>(null);
  const streamingLayoutTimerRef = useRef<NodeJS.Timeout | null>(null);

  // View & Layout State
  const [layoutMode, setLayoutMode] = useState<LayoutType>('flow');
  const [viewMode, setViewMode] = useState<ViewMode>('NETWORK');
  const [dimensionMode, setDimensionMode] = useState<'2D' | '3D'>('2D');
  const [isSidebarOpen, setIsSidebarOpen] = useState<boolean>(false);
  const [isFullScreen, setIsFullScreen] = useState<boolean>(false);
  const [isTheaterMode, setIsTheaterMode] = useState<boolean>(false);

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

  // IBM i2 Enterprise Insight Analysis Tools State
  const [showCentralityPanel, setShowCentralityPanel] = useState<boolean>(false);
  const [selectedTemporalHour, setSelectedTemporalHour] = useState<number | null>(null);
  const [showHistogramBar, setShowHistogramBar] = useState<boolean>(true);

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
  const [runtimeCounts, setRuntimeCounts] = useState({ nodes: 0, edges: 0 });

  // Sync ref with state for use in closure-captured event handlers
  const updateFocusedPath = useCallback((val: typeof focusedPath) => {
    focusedPathRef.current = val !== null;
    setFocusedPath(val);
  }, []);

  // Fullscreen keyboard listener (Escape) and graph resize triggers
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isFullScreen) {
        setIsFullScreen(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isFullScreen, isTheaterMode]);

  useEffect(() => {
    const timer = setTimeout(() => {
      if (cyRef.current) {
        cyRef.current.resize();
        cyRef.current.fit(undefined, 30);
      }
    }, 150);
    return () => clearTimeout(timer);
  }, [isFullScreen, isTheaterMode]);

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
    const totalTransfers = graphData.stats?.taint_summary?.total_transactions
      ?? graphData.edges?.reduce((sum: number, edge: any) => {
        const count = Number(edge.data?.transaction_count ?? edge.data?.transactionCount ?? 1);
        return sum + (Number.isFinite(count) && count > 0 ? count : 1);
      }, 0)
      ?? 0;
    const vaspEndpoints = graphData.nodes.filter((n: any) => n.data?.is_vasp || n.data?.role === 'KNOWN_VASP').length;
    const maxHops = graphData.stats?.max_hop_reached
      ?? Math.max(...graphData.nodes.map((n: any) => n.data?.hop || 0), 0);

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

    const currentRoot = (graphData.stats?.root_wallet || graphData.nodes.find(
      (n: any) => (n.data?.role === 'INPUT_WALLET' || n.data?.is_root || n.data?.hop === 0)
    )?.data?.id || graphData.nodes[0]?.data?.id || '').toLowerCase();

    // Incremental streaming / update for existing active investigation target
    if (cyRef.current && lastRootRef.current === currentRoot) {
      const cy = cyRef.current;
      const existingNodeIds = new Set(cy.nodes().map((n) => n.id().toLowerCase()));
      const existingEdgeIds = new Set(cy.edges().map((e) => e.id()));
      const newElements: cytoscape.ElementDefinition[] = [];

      graphData.nodes.forEach((n: any) => {
        const d = n.data || n;
        const id = (d.id || d.address || '').toLowerCase();
        if (id && !existingNodeIds.has(id)) {
          newElements.push(buildNodeElement(n));
          existingNodeIds.add(id);
        }
      });

      graphData.edges?.forEach((e: any, idx: number) => {
        const d = e.data || e;
        const edgeId = d.id || `edge-${idx}`;
        const src = (d.source || '').toLowerCase();
        const tgt = (d.target || '').toLowerCase();
        if (edgeId && !existingEdgeIds.has(edgeId) && existingNodeIds.has(src) && existingNodeIds.has(tgt)) {
          newElements.push(buildEdgeElement(e, edgeId));
          existingEdgeIds.add(edgeId);
        }
      });

      if (newElements.length > 0) {
        cy.batch(() => {
          cy.add(newElements);
          applyFilters(cy, selectedHops, selectedEntityTypes, selectedToken, selectedChain, minAmount, viewMode, riskFilter);
        });
        setRuntimeCounts({ nodes: cy.nodes().length, edges: cy.edges().length });

        // Throttle layout during live streaming: 300ms debounce prevents UI freezing
        if (streamingLayoutTimerRef.current) clearTimeout(streamingLayoutTimerRef.current);
        streamingLayoutTimerRef.current = setTimeout(() => {
          if (!cyRef.current) return;
          const visibleCount = cyRef.current.nodes(':visible').length;
          const spacingScale = visibleCount > 40 ? 1.3 : visibleCount > 20 ? 1.1 : 1.0;
          if (viewMode === 'FUND_FLOW') applyFundFlowPositions(cyRef.current);
          else if (layoutMode === 'radial') applyRadialPositions(cyRef.current);
          else if (layoutMode === 'timeline') applyHopOrderPositions(cyRef.current);
          else cyRef.current.layout(getLayoutConfig(layoutMode, visibleCount, spacingScale, currentRoot, false)).run();
        }, 300);
      }
      return;
    }

    // New investigation target: full initialization
    if (cyRef.current) {
      cyRef.current.destroy();
      cyRef.current = null;
    }
    lastRootRef.current = currentRoot;

    const elements: cytoscape.ElementDefinition[] = [];

    graphData.nodes.forEach((n: any) => {
      elements.push(buildNodeElement(n));
    });

    graphData.edges?.forEach((e: any, idx: number) => {
      const edgeId = e.data?.id || `edge-${idx}`;
      elements.push(buildEdgeElement(e, edgeId));
    });

    const vaspNodeIds = new Set(elements.filter(el => el.group === 'nodes' && (el.data?.isVasp || el.classes?.includes('tag-exchange'))).map(el => el.data?.id));
    const riskNodeIds = new Set(elements.filter(el => el.group === 'nodes' && (el.data?.tag === 'mixer' || el.data?.tag === 'sanctioned')).map(el => el.data?.id));

    elements.forEach(el => {
      if (el.group === 'edges') {
        if (vaspNodeIds.has(el.data?.target)) {
          el.classes = (el.classes || '') + ' edge-to-vasp';
        }
        if (riskNodeIds.has(el.data?.target)) {
          el.classes = (el.classes || '') + ' edge-to-risk';
        }
      }
    });

    const nodeCount = elements.filter(el => el.group === 'nodes').length;
    const spacingScale = nodeCount > 40 ? 1.3 : nodeCount > 20 ? 1.1 : 1.0;
    const layoutConfig = getLayoutConfig(layoutMode, nodeCount, spacingScale, currentRoot, viewMode === 'FUND_FLOW');

    const isDarkMode = typeof document !== 'undefined' ? document.documentElement.classList.contains('dark') : true;
    const baseTextColor = isDarkMode ? '#FFFFFF' : '#0F172A';
    const dimTextColor = isDarkMode ? '#9A9A9A' : '#64748B';
    const surfaceColor = isDarkMode ? '#161616' : '#FFFFFF';
    const borderColor = isDarkMode ? '#2A2A2A' : '#CBD5E1';
    const canvasBg = isDarkMode ? '#0A0A0A' : '#FFFFFF';

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
        // ── Filter Hidden Style (0ms instant display toggle) ──
        {
          selector: '.filter-hidden',
          style: {
            'display': 'none',
          },
        },
        // ────────────────── BASE NODE ──────────────────
        {
          selector: 'node',
          style: {
            'label': 'data(label)',
            'color': baseTextColor,
            'font-family': 'JetBrains Mono, ui-monospace, SFMono-Regular, monospace',
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
        {
          selector: 'node.risk-low',
          style: { 'border-color': '#475569', 'border-width': 2 },
        },
        {
          selector: 'node.risk-medium',
          style: { 'border-color': '#f59e0b', 'border-width': 2 },
        },
        {
          selector: 'node.risk-high',
          style: { 'border-color': '#f97316', 'border-width': 3 },
        },
        {
          selector: 'node.risk-critical',
          style: {
            'border-color': '#ef4444',
            'border-width': 3.5,
            'overlay-color': '#ef4444',
            'overlay-opacity': 0.16,
            'overlay-padding': 8,
          },
        },
        {
          selector: 'node.risk-unknown',
          style: { 'border-color': '#475569', 'border-width': 2 },
        },
        // Risk is expressed as a ring so the node interior remains semantic.
        { selector: 'node.risk-medium', style: { 'border-color': '#f59e0b', 'border-width': 3 } },
        { selector: 'node.risk-high', style: { 'border-color': '#f97316', 'border-width': 3.5 } },
        { selector: 'node.risk-critical', style: { 'border-color': '#ef4444', 'border-width': 4, 'overlay-color': '#ef4444', 'overlay-opacity': 0.18, 'overlay-padding': 8 } },
        // ────────────────── TARGET / ROOT (Star) ──────────────────
        {
          selector: 'node[tag = "target"], node.tag-target, node.is-root',
          style: {
            'background-color': isDarkMode ? '#450a0a' : '#0F172A',
            'border-color': isDarkMode ? '#ef4444' : '#0F172A',
            'border-width': 3.5,
            'color': isDarkMode ? '#fca5a5' : '#0F172A',
            'width': sz(80),
            'height': sz(80),
            'font-weight': 'bold',
            'font-size': `${fs(10)}px`,
            'shape': 'star',
            'text-valign': 'bottom',
            'text-margin-y': sz(10),
            'opacity': 1,
            'overlay-color': isDarkMode ? '#ef4444' : '#E5FF8F',
            'overlay-opacity': 0.15,
            'overlay-padding': sz(12),
          },
        },
        // ────────────────── EXCHANGE / VASP (Roundrectangle) ──────────────────
        {
          selector: 'node[tag = "exchange"], node.tag-exchange, node.is-vasp',
          style: {
            'background-color': isDarkMode ? '#042f2e' : '#ECFDF5',
            'border-color': isDarkMode ? '#14b8a6' : '#059669',
            'border-width': 3,
            'color': isDarkMode ? '#5eead4' : '#047857',
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
        // ────────────────── MIXER / TUMBLER (Diamond) ──────────────────
        {
          selector: 'node[tag = "mixer"], node.tag-mixer',
          style: {
            'background-color': isDarkMode ? '#3b0764' : '#F3E8FF',
            'border-color': isDarkMode ? '#a855f7' : '#9333EA',
            'border-width': 3,
            'color': isDarkMode ? '#d8b4fe' : '#6B21A8',
            'width': sz(66),
            'height': sz(58),
            'shape': 'diamond',
            'font-weight': 'bold',
            'font-size': `${fs(10)}px`,
            'text-valign': 'bottom',
            'text-margin-y': sz(10),
          },
        },
        // ────────────────── SANCTIONED / OFAC (Octagon) ──────────────────
        {
          selector: 'node[tag = "sanctioned"], node.tag-sanctioned',
          style: {
            'background-color': isDarkMode ? '#450a0a' : '#FFF1F2',
            'border-color': isDarkMode ? '#dc2626' : '#B91C1C',
            'border-width': 3.5,
            'color': isDarkMode ? '#fca5a5' : '#B91C1C',
            'width': sz(66),
            'height': sz(58),
            'shape': 'octagon',
            'font-weight': 'bold',
            'font-size': `${fs(10)}px`,
            'text-valign': 'bottom',
            'text-margin-y': sz(10),
            'overlay-color': '#dc2626',
            'overlay-opacity': 0.1,
            'overlay-padding': sz(8),
          },
        },
        // ────────────────── BRIDGE PROTOCOL (Hexagon) ──────────────────
        {
          selector: 'node[tag = "bridge"], node.tag-bridge, node.is-bridge, node[role = "BRIDGE_PROTOCOL"]',
          style: {
            'background-color': '#2e1065',
            'border-color': '#a855f7',
            'border-width': 3,
            'border-style': 'dashed',
            'color': '#d8b4fe',
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
            'border-color': '#4cd6fb',
            'background-color': surfaceColor,
            'color': baseTextColor,
          },
        },
        {
          selector: 'node.chain-tron:not(.is-root):not(.is-vasp):not(.is-bridge)',
          style: {
            'border-color': '#ffb4ab',
            'background-color': surfaceColor,
            'color': baseTextColor,
          },
        },
        {
          selector: 'node.chain-bitcoin:not(.is-root):not(.is-vasp):not(.is-bridge)',
          style: {
            'border-color': '#ffd9dc',
            'background-color': surfaceColor,
            'color': baseTextColor,
          },
        },
        // ────────────────── HOP 1 NODES ──────────────────
        {
          selector: 'node.hop-1, node[hop = 1]:not(.is-root):not(.is-vasp):not([tag = "mixer"]):not([tag = "sanctioned"])',
          style: {
            'shape': 'ellipse',
            'border-color': '#3b82f6',
            'background-color': isDarkMode ? '#1e293b' : '#f1f5f9',
            'border-width': 2,
            'color': isDarkMode ? '#93c5fd' : '#1d4ed8',
            'width': sz(56),
            'height': sz(56),
            'font-size': `${fs(9)}px`,
            'text-valign': 'bottom',
            'text-margin-y': sz(8),
          },
        },
        // ────────────────── COLD TREASURY ──────────────────
        {
          selector: 'node.node-treasury',
          style: {
            'shape': 'ellipse',
            'border-color': '#14b8a6',
            'background-color': isDarkMode ? '#042f2e' : '#f0fdfa',
            'border-width': 2,
            'color': isDarkMode ? '#5eead4' : '#0f766e',
            'width': sz(52),
            'height': sz(52),
            'font-size': `${fs(9)}px`,
            'text-valign': 'bottom',
            'text-margin-y': sz(8),
          },
        },
        // ────────────────── EXCHANGE LIQUIDITY ──────────────────
        {
          selector: 'node.node-liquidity',
          style: {
            'shape': 'ellipse',
            'border-color': '#4cd6fb',
            'background-color': surfaceColor,
            'border-width': 2,
            'color': dimTextColor,
            'width': sz(52),
            'height': sz(52),
            'font-size': `${fs(9)}px`,
            'text-valign': 'bottom',
            'text-margin-y': sz(8),
          },
        },
        // ────────────────── UNKNOWN / INTERMEDIARY ──────────────────
        {
          selector: 'node[tag = "unknown"]:not(.hop-1), node.tag-unknown:not(.hop-1)',
          style: {
            'background-color': surfaceColor,
            'border-color': borderColor,
            'border-width': 2,
            'color': dimTextColor,
            'width': sz(54),
            'height': sz(54),
            'shape': 'ellipse',
            'font-size': `${fs(9)}px`,
            'text-valign': 'bottom',
            'text-margin-y': sz(8),
          },
        },
        // ── Hop 2 color accent ──
        {
          selector: 'node[hop = 2].tag-unknown',
          style: {
            'border-color': '#8b5cf6',
            'background-color': '#1e1b4b',
            'color': '#e0e2eb',
          },
        },
        // ── Hop 3 color accent ──
        {
          selector: 'node[hop = 3].tag-unknown',
          style: {
            'border-color': '#6366f1',
            'background-color': '#1e1e38',
            'color': '#bacbbf',
          },
        },

        // ────────────────── BASE EDGE ──────────────────
        {
          selector: 'edge',
          style: {
            'width': 1.25,
            'line-color': isDarkMode ? '#334155' : '#94A3B8',
            'target-arrow-color': isDarkMode ? '#64748B' : '#94A3B8',
            'target-arrow-shape': 'triangle',
            'arrow-scale': 0.65,
            'opacity': nodeCount > 100 ? 0.42 : 0.62,
            'curve-style': 'unbundled-bezier',
            'control-point-step-size': nodeCount > 80 ? 30 : 45,
            'label': '',
            'font-size': `${fs(8)}px`,
            'font-family': 'JetBrains Mono, ui-monospace, SFMono-Regular, monospace',
            'color': isDarkMode ? '#cbd5e1' : '#475569',
            'text-rotation': 'autorotate',
            'text-background-opacity': 0.95,
            'text-background-color': isDarkMode ? '#090D16' : '#FFFFFF',
            'text-background-padding': '3px',
            'text-background-shape': 'roundrectangle',
            'text-margin-y': -8,
            'overlay-opacity': 0,
            'transition-property': 'line-color, target-arrow-color, width, opacity',
            'transition-duration': 200,
          },
        },
        {
          selector: 'node.dense-label',
          style: { 'label': '' },
        },
        {
          selector: 'node',
          style: {
            // Semantic icons are the node mark; do not place them inside a
            // Cytoscape circle/shape. Risk remains a separate halo layer.
            'shape': 'rectangle',
            'background-color': 'transparent',
            'border-width': 0,
            'background-image': 'data(iconUrl)',
            'background-fit': 'contain',
            'background-width': '80%',
            'background-height': '80%',
            'background-clip': 'none',
            'background-opacity': 0.9,
          },
        },
        {
          selector: 'node.dense-label.is-root, node.dense-label.is-vasp, node.dense-label.node-hover, node.dense-label:selected',
          style: { 'label': 'data(label)' },
        },
        {
          selector: 'node.is-root',
          style: { 'z-index': 2000, 'overlay-opacity': 0.28, 'overlay-padding': 14, 'label': 'data(label)' },
        },
        // ── Hop-1 dashed lime curved edge (Target to Hop-1) ──
        {
          selector: 'edge[hop = 1], edge.hop-1',
          style: {
            'line-color': '#4cd6fb',
            'target-arrow-color': '#4cd6fb',
            'line-style': 'dashed',
            'line-dash-pattern': [6, 4] as any,
            'width': 2.5,
          },
        },
        // ── Flow into VASP (Cyber-Mint curve with arrow) ──
        {
          selector: 'edge.edge-to-vasp',
          style: {
            'line-color': '#6effc3',
            'target-arrow-color': '#6effc3',
            'width': 3,
            'z-index': 900,
          },
        },
        // ── Flow into High Risk / Mixer / Peeling (Coral curve with arrow) ──
        {
          selector: 'edge.edge-to-risk',
          style: {
            'line-color': '#ffb4ab',
            'target-arrow-color': '#ffb4ab',
            'width': 2.5,
            'z-index': 850,
          },
        },

        // ────────────────── FIFO TAINT EDGE COLORING ──────────
        {
          selector: 'edge.taint-high',
          style: {
            'line-color': '#ffb4ab',
            'target-arrow-color': '#ffb4ab',
            'width': 3.5,
            'z-index': 900,
          },
        },
        {
          selector: 'edge.taint-medium',
          style: {
            'line-color': '#ffd9dc',
            'target-arrow-color': '#ffd9dc',
            'width': 3,
            'z-index': 850,
          },
        },
        {
          selector: 'edge.taint-low',
          style: {
            'line-color': '#6effc3',
            'target-arrow-color': '#6effc3',
            'z-index': 800,
          },
        },

        // ────────────────── INTERACTIVE STATES ──────────────────

        // Hover: node scale + glow
        {
          selector: 'node:active',
          style: {
            'overlay-opacity': 0.15,
            'overlay-color': '#4cd6fb',
            'overlay-padding': 10,
          },
        },

        // Path Focus — highlighted path
        {
          selector: '.path-focused',
          style: {
            'line-color': '#6effc3',
            'target-arrow-color': '#6effc3',
            'width': 4,
            'opacity': 1,
            'z-index': 999,
            'label': 'data(label)',
            'font-size': '9px',
            'text-background-opacity': 0.95,
          },
        },
        {
          selector: 'node.path-focused',
          style: {
            'border-color': '#6effc3',
            'border-width': 4,
            'z-index': 999,
            'overlay-color': '#6effc3',
            'overlay-opacity': 0.15,
            'overlay-padding': 10,
          },
        },
        // Path Focus — dimmed elements
        {
          selector: '.path-dimmed',
          style: {
            'opacity': 0.15,
          },
        },
        // Timeline replay — active edge
        {
          selector: '.replay-active-edge',
          style: {
            'line-color': '#6effc3',
            'target-arrow-color': '#6effc3',
            'width': 4.5,
            'z-index': 1000,
          },
        },
        // Timeline replay — active node
        {
          selector: 'node.replay-active-node',
          style: {
            'border-color': '#6effc3',
            'border-width': 4,
            'z-index': 1000,
            'overlay-color': '#6effc3',
            'overlay-opacity': 0.2,
            'overlay-padding': 12,
          },
        },
        // Selection
        {
          selector: ':selected',
          style: {
            'border-color': '#4cd6fb',
            'border-width': 3.5,
            'line-color': '#4cd6fb',
            'target-arrow-color': '#4cd6fb',
            'overlay-color': '#4cd6fb',
            'overlay-opacity': 0.15,
          },
        },
        {
          selector: 'edge:selected',
          style: { 'label': 'data(label)', 'width': 3.5, 'opacity': 1, 'z-index': 1000 },
        },
        // Hover highlight class (applied via JS)
        {
          selector: '.node-hover',
          style: {
            'border-width': 3.5,
            'overlay-opacity': 0.15,
            'overlay-color': '#4cd6fb',
            'overlay-padding': 10,
          },
        },
        {
          selector: '.edge-hover',
          style: {
            'width': 3.5,
            'line-color': '#4cd6fb',
            'target-arrow-color': '#4cd6fb',
            'z-index': 500,
            'label': 'data(label)',
            'font-size': '9px',
            'text-background-opacity': 0.95,
          },
        },
        {
          selector: '.neighbor-dim',
          style: {
            'opacity': 0.12,
          },
        },
        // ── IBM i2 Centrality Highlighting Rules ──
        {
          selector: 'node.i2-highlighted-node',
          style: {
            'border-color': '#ffb4ab',
            'border-width': 4,
            'overlay-color': '#ffb4ab',
            'overlay-opacity': 0.25,
            'overlay-padding': 12,
            'z-index': 999,
            'font-weight': 'bold',
            'font-size': `${fs(11)}px`,
            'opacity': 1,
          },
        },
        {
          selector: 'node.i2-highlighted-consol',
          style: {
            'border-color': '#4cd6fb',
            'border-width': 4,
            'overlay-color': '#4cd6fb',
            'overlay-opacity': 0.25,
            'overlay-padding': 12,
            'z-index': 999,
            'font-weight': 'bold',
            'opacity': 1,
          },
        },
        {
          selector: 'edge.i2-highlighted-edge',
          style: {
            'line-color': '#ffb4ab',
            'target-arrow-color': '#ffb4ab',
            'width': 4,
            'z-index': 998,
            'opacity': 1,
            'label': 'data(label)',
            'font-size': '9px',
            'font-weight': 'bold',
            'text-background-opacity': 0.95,
            'text-background-color': '#0b0e14',
          },
        },
        {
          selector: '.i2-dimmed',
          style: {
            'opacity': 0.15,
          },
        },
        // ── Temporal Histogram Hour Active Rules ──
        {
          selector: 'edge.temporal-active-edge',
          style: {
            'line-color': '#6effc3',
            'target-arrow-color': '#6effc3',
            'width': 4.5,
            'z-index': 1000,
            'label': 'data(label)',
            'font-size': '10px',
            'font-weight': 'bold',
            'text-background-opacity': 0.98,
            'text-background-color': '#0b0e14',
          },
        },
        {
          selector: 'node.temporal-active-node',
          style: {
            'border-color': '#6effc3',
            'border-width': 4,
            'overlay-color': '#6effc3',
            'overlay-opacity': 0.25,
            'overlay-padding': 12,
            'z-index': 1000,
          },
        },
      ],
      layout: layoutConfig,
    });

    if (nodeCount > 100) {
      cy.nodes().addClass('dense-label');
    }

    if (viewMode === 'FUND_FLOW') applyFundFlowPositions(cy);
    else if (layoutMode === 'radial') applyRadialPositions(cy);
    else if (layoutMode === 'timeline') applyHopOrderPositions(cy);

    // QA-only runtime integrity counters: read directly from Cytoscape.
    setRuntimeCounts({ nodes: cy.nodes().length, edges: cy.edges().length });

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

    applyFilters(cy, selectedHops, selectedEntityTypes, selectedToken, selectedChain, minAmount, viewMode, riskFilter);
    cyRef.current = cy;

    return () => {
      if (streamingLayoutTimerRef.current) clearTimeout(streamingLayoutTimerRef.current);
    };
  }, [graphData, viewMode]);

  // 0ms Filter updates via batch class toggling — Zero canvas recreation, zero lag
  useEffect(() => {
    if (cyRef.current) {
      applyFilters(
        cyRef.current,
        selectedHops,
        selectedEntityTypes,
        selectedToken,
        selectedChain,
        minAmount,
        viewMode
      );
    }
  }, [
    selectedHops,
    selectedEntityTypes,
    selectedToken,
    selectedChain,
    minAmount,
    viewMode,
    riskFilter,
  ]);

  // Smooth layout animation on mode toggle
  useEffect(() => {
    if (cyRef.current) {
      const cy = cyRef.current;
      const visibleCount = cy.nodes(':visible').length;
      const spacingScale = visibleCount > 40 ? 1.3 : visibleCount > 20 ? 1.1 : 1.0;
      if (viewMode === 'FUND_FLOW') applyFundFlowPositions(cy);
      else if (layoutMode === 'radial') applyRadialPositions(cy);
      else if (layoutMode === 'timeline') applyHopOrderPositions(cy);
      else cy.layout(getLayoutConfig(layoutMode, visibleCount, spacingScale, rootAddress, false)).run();
    }
  }, [layoutMode, rootAddress, viewMode]);

  // Final fit and layout when streaming finishes
  useEffect(() => {
    if (!isStreaming && cyRef.current) {
      const cy = cyRef.current;
      const visibleCount = cy.nodes(':visible').length;
      if (visibleCount > 0) {
        const spacingScale = visibleCount > 40 ? 1.3 : visibleCount > 20 ? 1.1 : 1.0;
        if (viewMode === 'FUND_FLOW') applyFundFlowPositions(cy);
        else if (layoutMode === 'radial') applyRadialPositions(cy);
        else if (layoutMode === 'timeline') applyHopOrderPositions(cy);
        else cy.layout(getLayoutConfig(layoutMode, visibleCount, spacingScale, rootAddress, false)).run();
      }
    }
  }, [isStreaming, rootAddress, layoutMode, viewMode]);

  // Cleanup on component unmount
  useEffect(() => {
    return () => {
      setRuntimeCounts({ nodes: 0, edges: 0 });
      if (cyRef.current) {
        cyRef.current.destroy();
        cyRef.current = null;
      }
    };
  }, []);

  // ═══════════════════════════════════════════════════════════════════════════
  // CONTROLS
  // ═══════════════════════════════════════════════════════════════════════════
  const handleFit = () => {
    if (dimensionMode === '3D' && fit3DRef.current) fit3DRef.current();
    else cyRef.current?.fit(undefined, 60);
  };
  const handleZoomIn = () => {
    if (dimensionMode === '3D' && zoomIn3DRef.current) zoomIn3DRef.current();
    else {
      const cy = cyRef.current;
      if (cy) cy.animate({ zoom: { level: cy.zoom() * 1.3, position: cy.extent() as any }, duration: 200 });
    }
  };
  const handleZoomOut = () => {
    if (dimensionMode === '3D' && zoomOut3DRef.current) zoomOut3DRef.current();
    else {
      const cy = cyRef.current;
      if (cy) cy.animate({ zoom: { level: cy.zoom() * 0.75, position: cy.extent() as any }, duration: 200 });
    }
  };
  const handleReset = () => {
    if (dimensionMode === '3D' && reset3DRef.current) reset3DRef.current();
    else {
      const cy = cyRef.current;
      if (cy) {
        cy.elements().removeClass('path-focused path-dimmed neighbor-dim node-hover edge-hover');
        cy.animate({ fit: { eles: cy.elements(), padding: 60 }, duration: 300 });
      }
      updateFocusedPath(null);
      setSelectedElement(null);
    }
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
      className={`bg-[#0A0A0A] ${
        isFullScreen
          ? 'fixed inset-0 z-[9999] w-screen h-screen rounded-none border-none m-0 p-0 overflow-hidden flex flex-col'
          : isTheaterMode
          ? 'fixed left-[68px] top-16 right-0 bottom-0 z-[35] w-auto h-auto rounded-none border border-[#2A2A2A] m-0 p-0 overflow-hidden flex flex-col'
          : `border border-slate-200 dark:border-[#1E293B] rounded-xl shadow-sm dark:shadow-2xl flex flex-col relative text-xs overflow-hidden transition-all duration-300 ${
              isFullScreenView ? 'h-[85vh]' : 'h-auto min-h-[740px]'
            }`
      }`}
    >
      {/* ========================================================================= */}
      {/* 1. INVESTIGATION SUMMARY HEADER BAR */}
      {/* ========================================================================= */}
      <div className="p-3.5 border-b border-[#2A2A2A] bg-[#0A0A0A]/95 backdrop-blur-md flex flex-wrap items-center justify-between gap-3 text-xs shrink-0">
        {/* Left: Graph Studio + PRO ENGINE badge + Target address */}
        <div className="flex items-center space-x-3">
          <div className="w-10 h-10 rounded-lg bg-[#161616] border border-[#2A2A2A] flex items-center justify-center text-[#E5FF8F]">
            <Network className="h-5 w-5" />
          </div>
          <div>
            <div className="flex items-center space-x-2">
              <span className="font-bold text-[#FFFFFF] text-base tracking-wide font-sans">Graph Studio</span>
              <span className="text-[10px] px-2 py-0.5 rounded bg-[#E5FF8F]/10 text-[#E5FF8F] border border-[#E5FF8F]/20 font-mono font-bold tracking-wider uppercase">
                PRO ENGINE
              </span>
            </div>
            <div className="flex items-center space-x-1.5 text-xs font-mono text-slate-500 dark:text-[#94A3B8] mt-0.5">
              <span>Target:</span>
              <span className="text-slate-800 dark:text-[#E2E8F0] font-medium">{rootAddress ? `${rootAddress.slice(0, 8)}...${rootAddress.slice(-4)}` : '0x3f8702...aae3'}</span>
              <button
                onClick={() => handleCopy(rootAddress)}
                className="hover:text-slate-900 dark:hover:text-white transition-colors p-0.5 text-slate-400 dark:text-[#94A3B8]"
                title="Copy Target Wallet"
              >
                {copied ? <Check className="h-3.5 w-3.5 text-emerald-600" /> : <Copy className="h-3.5 w-3.5" />}
              </button>
            </div>
          </div>
        </div>

        {/* Center/Right: 2D / 3D Dimension Switcher & View Mode Tabs */}
        <div className="flex items-center space-x-2.5">
          {/* Dimension Selector: 2D vs 3D */}
          <div className="flex items-center bg-[#161616] border border-[#2A2A2A] rounded-lg p-1 font-mono text-xs">
            <button
              onClick={() => setDimensionMode('2D')}
              className={`px-2.5 py-1 rounded-md font-semibold transition-all flex items-center space-x-1 ${
                dimensionMode === '2D'
                  ? 'bg-[#E5FF8F] text-[#0A0A0A] shadow-sm font-bold'
                  : 'text-slate-600 dark:text-[#94A3B8] hover:text-slate-900 dark:hover:text-[#F8FAFC]'
              }`}
            >
              <span>2D</span>
            </button>
            <button
              onClick={() => setDimensionMode('3D')}
              className={`px-2.5 py-1 rounded-md font-semibold transition-all flex items-center space-x-1.5 ${
                dimensionMode === '3D'
                  ? 'bg-[#E5FF8F] text-[#0A0A0A] shadow-sm font-bold'
                  : 'text-slate-600 dark:text-[#94A3B8] hover:text-slate-900 dark:hover:text-[#F8FAFC]'
              }`}
            >
              <Box className="h-3.5 w-3.5" />
              <span>3D</span>
            </button>
          </div>

          {/* Right: View Mode Tabs */}
          <div className="flex items-center bg-[#161616] border border-[#2A2A2A] rounded-lg p-1 font-mono text-xs">
            {(['NETWORK', 'FUND_FLOW', 'TIMELINE', 'EVIDENCE'] as ViewMode[]).map((mode) => (
              <button
                key={mode}
                onClick={() => setViewMode(mode)}
                className={`px-3 py-1.5 rounded-md font-semibold transition-all ${
                  viewMode === mode
                    ? 'bg-[#E5FF8F] text-[#0A0A0A] shadow-sm font-bold'
                    : 'text-slate-600 dark:text-[#94A3B8] hover:text-slate-900 dark:hover:text-[#F8FAFC] hover:bg-slate-200 dark:hover:bg-[#1E293B]'
                }`}
              >
                {mode === 'FUND_FLOW' ? 'Fund Flow' : mode.charAt(0) + mode.slice(1).toLowerCase()}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* 2. SUB-STRIP: LAYOUT & CHAIN CONTROLS */}
      {/* ========================================================================= */}
      <div className="px-4 py-2.5 border-b border-[#2A2A2A] bg-[#101010]/95 backdrop-blur-md flex flex-wrap items-center justify-between gap-y-2 text-xs font-mono shrink-0">
        <div className="flex flex-wrap items-center gap-x-6 gap-y-2">
          {/* LAYOUT Engine Selector */}
          <div className="flex items-center space-x-2">
            <span className="text-slate-500 dark:text-[#94A3B8] font-bold text-[11px] tracking-wider">LAYOUT:</span>
            <div className="flex items-center space-x-1.5">
              {[
                { id: 'flow', label: 'Fund Flow' },
                { id: 'force', label: 'Network' },
                { id: 'radial', label: 'Radial' },
                { id: 'timeline', label: 'Hop Order' },
              ].map((l) => (
                <button
                  key={l.id}
                  onClick={() => setLayoutMode(l.id as LayoutType)}
                  className={`px-2.5 py-1 rounded text-[11px] font-semibold transition-all ${
                    layoutMode === l.id
                      ? 'bg-[#E5FF8F] text-[#0A0A0A] shadow-sm font-bold'
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
                        ? 'bg-[#E5FF8F] text-[#0A0A0A] shadow-sm font-bold'
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
                        ? 'bg-[#E5FF8F] text-[#0A0A0A] border-[#E5FF8F]'
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
                ? 'bg-[#E5FF8F] text-[#0A0A0A] border-[#E5FF8F]'
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
                ? 'bg-[#E5FF8F]/10 text-[#E5FF8F] border-[#E5FF8F]/40 shadow-sm'
                : 'hover:bg-slate-100 dark:hover:bg-[#1E293B] text-slate-600 dark:text-[#94A3B8] hover:text-slate-900 dark:hover:text-[#F8FAFC] border-slate-200 dark:border-[#1E293B]'
            }`}
            title={isFullScreen ? 'Exit Fullscreen (Esc)' : 'Enter Fullscreen'}
          >
            {isFullScreen ? <Minimize2 className="h-3.5 w-3.5 text-[#E5FF8F]" /> : <Maximize2 className="h-3.5 w-3.5" />}
          </button>
          <button
            onClick={() => { setIsTheaterMode(!isTheaterMode); setIsFullScreen(false); }}
            className={`px-2 py-1.5 rounded text-[11px] font-bold flex items-center gap-1.5 transition-colors border ${
              isTheaterMode
                ? 'bg-[#E5FF8F] text-[#0A0A0A] border-[#E5FF8F]'
                : 'hover:bg-[#1A1A1A] text-[#9A9A9A] hover:text-[#FFFFFF] border-[#2A2A2A]'
            }`}
            title={isTheaterMode ? 'Exit Theater Mode' : 'Open Theater Mode'}
          >
            <PanelTop className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">Theater</span>
          </button>
        </div>
      </div>

      {/* Compact graph summary */}
      <div className="flex flex-wrap items-center gap-x-5 gap-y-1 border-b border-[#2A2A2A] bg-[#0A0A0A] px-4 py-2 font-mono text-[10px] uppercase tracking-wider text-[#9A9A9A]">
        <span>Target <strong className="ml-1 text-[#FFFFFF] normal-case">{rootAddress.slice(0, 8)}...{rootAddress.slice(-4)}</strong></span>
        <span>Entities <strong className="ml-1 text-[#FFFFFF]">{graphMetrics.totalNodes}</strong></span>
        <span>Transactions <strong className="ml-1 text-[#FFFFFF]">{graphMetrics.totalTransfers}</strong></span>
        <span>VASPs <strong className="ml-1 text-[#E5FF8F]">{graphMetrics.vaspEndpoints}</strong></span>
        <span>Max Hop <strong className="ml-1 text-[#FFFFFF]">{graphMetrics.maxHops}</strong></span>
        {process.env.NODE_ENV !== 'production' && <span data-testid="cy-runtime-counts" title="Cytoscape runtime element counts">CY <strong className="ml-1 text-[#E5FF8F]">{runtimeCounts.nodes}N / {runtimeCounts.edges}E</strong></span>}
      </div>

      {/* ========================================================================= */}
      {/* MAIN WORKSPACE BODY: (Left Panel + Cytoscape Canvas + Right Drawer) */}
      {/* ========================================================================= */}
      <div className="flex-1 relative flex overflow-hidden w-full h-full">
        {/* ======================================================================= */}
        {/* 2. LEFT INVESTIGATION CONTROL PANEL (Slide-out) */}
        {/* ======================================================================= */}
        {isSidebarOpen && (
          <div
            className={`border-r border-[#2A2A2A] bg-[#0A0A0A]/95 backdrop-blur-md transition-all duration-300 flex flex-col z-20 overflow-y-auto ${
              isSidebarOpen ? 'w-64 min-w-[16rem]' : 'hidden'
            }`}
          >
          {/* Collapse Header */}
          <div className="p-2.5 border-b border-slate-200 dark:border-[#1E293B] flex items-center justify-between">
            {isSidebarOpen ? (
              <div className="flex items-center space-x-2 font-mono text-xs font-bold text-slate-800 dark:text-[#F8FAFC] uppercase">
                <SlidersHorizontal className="h-3.5 w-3.5 text-[#E5FF8F]" />
                <span>Investigation Filters</span>
              </div>
            ) : (
              <SlidersHorizontal className="h-4 w-4 text-slate-400 dark:text-[#64748B] mx-auto" />
            )}
            <button
              onClick={() => setIsSidebarOpen(!isSidebarOpen)}
              className="p-1 rounded hover:bg-slate-100 dark:hover:bg-[#1E293B] text-slate-500 dark:text-[#94A3B8] hover:text-slate-900 dark:hover:text-[#F8FAFC] transition-colors"
              title={isSidebarOpen ? 'Collapse Panel' : 'Expand Panel'}
            >
              {isSidebarOpen ? <ChevronLeft className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
            </button>
          </div>

          {isSidebarOpen && (
            <div className="p-3.5 space-y-4 text-xs">
              {/* LAYOUT Engine Selector */}
              <div>
                <div className="text-[10px] font-mono uppercase text-slate-400 dark:text-[#64748B] font-bold mb-2 tracking-wider">
                  Graph Layout
                </div>
                <div className="grid grid-cols-2 gap-1.5 font-mono text-[11px]">
                  {[
                    { id: 'flow', label: 'Fund Flow' },
                    { id: 'force', label: 'Network' },
                    { id: 'radial', label: 'Radial' },
                    { id: 'timeline', label: 'Hop Order' },
                  ].map((l) => (
                    <button
                      key={l.id}
                      onClick={() => setLayoutMode(l.id as LayoutType)}
                      className={`px-2 py-1.5 rounded text-left flex items-center space-x-1.5 border transition-colors ${layoutMode === l.id
                          ? 'bg-[#E5FF8F] text-[#0A0A0A] border-[#E5FF8F] font-bold shadow-sm'
                          : 'bg-slate-50 dark:bg-[#111827] border-slate-200 dark:border-[#1E293B] text-slate-600 dark:text-[#94A3B8] hover:text-slate-900 dark:hover:text-[#F8FAFC]'
                        }`}
                    >
                      <span className={`w-2 h-2 rounded-full ${layoutMode === l.id ? 'bg-white' : 'bg-transparent border border-slate-400 dark:border-[#64748B]'}`} />
                      <span>{l.label}</span>
                    </button>
                  ))}
                </div>
              </div>

              {/* HOPS Selection */}
              <div>
                <div className="text-[10px] font-mono uppercase text-slate-400 dark:text-[#64748B] font-bold mb-2 tracking-wider">
                  Hop Traversal Depth
                </div>
                <div className="space-y-1.5 font-mono text-[11px]">
                  {[1, 2, 3].map((hop) => (
                    <label key={hop} className="flex items-center space-x-2 cursor-pointer text-slate-700 dark:text-[#E2E8F0] hover:text-slate-900 dark:hover:text-white">
                      <input
                        type="checkbox"
                        checked={selectedHops.has(hop)}
                        onChange={() => toggleHopFilter(hop)}
                        className="rounded border-slate-300 dark:border-[#1E293B] bg-white dark:bg-[#111827] text-[#E5FF8F] focus:ring-0 focus:ring-offset-0 h-3.5 w-3.5"
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
                    { id: 'INTERMEDIARY', label: 'Intermediary Wallets', color: 'text-[#9A9A9A] font-semibold' },
                    { id: 'EXTERNAL', label: 'External Contracts / Unknown', color: 'text-slate-500 dark:text-[#94A3B8]' },
                  ].map((e) => (
                    <label key={e.id} className="flex items-center space-x-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={selectedEntityTypes.has(e.id)}
                        onChange={() => toggleEntityType(e.id)}
                        className="rounded border-slate-300 dark:border-[#1E293B] bg-white dark:bg-[#111827] text-[#E5FF8F] focus:ring-0 focus:ring-offset-0 h-3.5 w-3.5"
                      />
                      <span className={e.color}>{e.label}</span>
                    </label>
                  ))}
                </div>
              </div>

              {/* BLOCKCHAIN NETWORK */}
              <div>
                <div className="text-[10px] font-mono uppercase text-slate-400 dark:text-[#64748B] font-bold mb-2 tracking-wider">
                  Blockchain Network
                </div>
                <select
                  value={selectedChain}
                  onChange={(e) => setSelectedChain(e.target.value)}
                  className="w-full bg-slate-50 dark:bg-[#111827] border border-slate-200 dark:border-[#1E293B] rounded px-2 py-1.5 text-slate-800 dark:text-[#F8FAFC] font-mono text-xs focus:outline-none focus:border-[#E5FF8F]"
                >
                  {graphMetrics.chainsAvailable.map((c) => (
                    <option key={c} value={c}>
                      {c === 'ALL' ? 'All Networks' : c.toUpperCase()}
                    </option>
                  ))}
                </select>
              </div>

              {/* TRANSACTION FILTERS: Token & Min Amount */}
              <div className="space-y-2.5 pt-2 border-t border-slate-200 dark:border-[#1E293B]">
                <div className="text-[10px] font-mono uppercase text-slate-400 dark:text-[#64748B] font-bold tracking-wider">
                  Transaction Filters
                </div>
                <div>
                  <label className="text-[11px] text-slate-500 dark:text-[#94A3B8] block mb-1">Asset Token</label>
                  <select
                    value={selectedToken}
                    onChange={(e) => setSelectedToken(e.target.value)}
                  className="w-full bg-slate-50 dark:bg-[#111827] border border-slate-200 dark:border-[#1E293B] rounded px-2 py-1.5 text-slate-800 dark:text-[#F8FAFC] font-mono text-xs focus:outline-none focus:border-[#E5FF8F]"
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
                    <span className="font-mono text-[10px] text-[#E5FF8F] font-bold">
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
                    className="w-full bg-slate-50 dark:bg-[#111827] border border-slate-200 dark:border-[#1E293B] rounded px-2 py-1.5 text-slate-800 dark:text-[#F8FAFC] font-mono text-xs focus:outline-none focus:border-[#E5FF8F]"
                  />
                  <div className="flex gap-1 mt-1.5">
                    {[0, 100, 1000, 5000].map((preset) => (
                      <button
                        key={preset}
                        onClick={() => setMinAmount(preset)}
                        className={`flex-1 py-0.5 rounded text-[10px] font-mono border transition-colors ${minAmount === preset
                            ? 'bg-[#E5FF8F] text-[#0A0A0A] border-[#E5FF8F] font-bold'
                            : 'bg-slate-50 dark:bg-[#111827] border-slate-200 dark:border-[#1E293B] text-slate-600 dark:text-[#94A3B8] hover:text-slate-900 dark:hover:text-[#F8FAFC]'
                          }`}
                      >
                        {preset === 0 ? 'All' : `${preset >= 1000 ? preset / 1000 + 'k' : preset}`}
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <label className="text-[11px] text-slate-500 dark:text-[#94A3B8] block mb-1">Time Horizon</label>
                  <select
                    value={timeRange}
                    onChange={(e) => setTimeRange(e.target.value)}
                    className="w-full bg-slate-50 dark:bg-[#111827] border border-slate-200 dark:border-[#1E293B] rounded px-2 py-1.5 text-slate-800 dark:text-[#F8FAFC] font-mono text-xs focus:outline-none focus:border-[#E5FF8F]"
                  >
                    <option value="ALL">All Time</option>
                    <option value="24H">Last 24 Hours</option>
                    <option value="7D">Last 7 Days</option>
                    <option value="30D">Last 30 Days</option>
                  </select>
                </div>
              </div>

              {/* RISK LEVEL FILTER */}
              <div className="pt-2 border-t border-slate-200 dark:border-[#1E293B]">
                <div className="text-[10px] font-mono uppercase text-slate-400 dark:text-[#64748B] font-bold mb-2 tracking-wider">
                  Risk Assessment Scope
                </div>
                <div className="grid grid-cols-4 gap-1 font-mono text-[10px]">
                  {(['ALL', 'LOW', 'MEDIUM', 'HIGH', 'CRITICAL'] as RiskFilterType[]).map((r) => (
                    <button
                      key={r}
                      onClick={() => setRiskFilter(r)}
                      className={`py-1 rounded font-medium border transition-colors ${riskFilter === r
                          ? r === 'HIGH'
                            ? 'bg-rose-600 text-white border-rose-500'
                            : r === 'MEDIUM'
                              ? 'bg-amber-600 text-white border-amber-500'
                              : r === 'LOW'
                                ? 'bg-emerald-600 text-white border-emerald-500'
                                : 'bg-[#E5FF8F] text-[#0A0A0A] border-[#E5FF8F]'
                          : 'bg-slate-50 dark:bg-[#111827] border-slate-200 dark:border-[#1E293B] text-slate-600 dark:text-[#94A3B8] hover:text-slate-900 dark:hover:text-[#F8FAFC]'
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
                  className="w-full py-1.5 rounded-lg bg-slate-100 dark:bg-[#111827] hover:bg-slate-200 dark:hover:bg-[#1E293B] text-slate-700 dark:text-[#F8FAFC] border border-slate-200 dark:border-[#1E293B] transition-colors font-mono text-xs flex items-center justify-center space-x-1.5"
                >
                  <RotateCcw className="h-3 w-3 text-slate-500 dark:text-[#94A3B8]" />
                  <span>Reset All Filters</span>
                </button>
              </div>
              <div className="max-w-[250px] rounded-lg bg-white/95 dark:bg-[#0D131F]/95 backdrop-blur-md border border-slate-200 dark:border-[#1E293B] px-3 py-2 text-[9px] font-mono shadow-md pointer-events-auto text-slate-600 dark:text-[#CBD5E1]">
                <div className="font-bold uppercase tracking-wider text-slate-400 dark:text-[#64748B]">{layoutMode === 'timeline' ? 'Hop Order' : layoutMode === 'radial' ? 'Radial' : layoutMode === 'force' ? 'Network' : 'Fund Flow'}</div>
                <div className="mt-1">{layoutMode === 'timeline' ? 'Explore entities by traversal depth.' : layoutMode === 'radial' ? 'Explore entities by distance from the target.' : layoutMode === 'force' ? 'Explore relationships and connected entities.' : 'Trace movement of funds through connected entities.'}</div>
                <div className="mt-1 text-slate-500 dark:text-[#94A3B8]">Entity: target · wallet · VASP · bridge · contract · mixer · sanctioned</div>
                <div className="text-slate-500 dark:text-[#94A3B8]">Risk: unknown · low · medium · high · critical</div>
                <div className="text-slate-500 dark:text-[#94A3B8]">Hop: H0 target · H1 direct · H2 secondary · H3+ extended</div>
              </div>
              <GraphLegend />
            </div>
          )}
        </div>
      )}

        {/* ======================================================================= */}
        {/* 3. CYTOSCAPE GRAPH CANVAS */}
        {/* ======================================================================= */}
        {/* Fund Flow intentionally uses the same Cytoscape host as Network. */}
        {/* This keeps hop positioning, inspection, filtering, and 2D/3D       */}
        {/* switching in one graph lifecycle instead of hiding the canvas.      */}
        {
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
                <div className="flex items-center space-x-1.5 px-2.5 py-1 rounded-full bg-[#E5FF8F]/90 text-[#0A0A0A] font-mono text-[10px] font-bold shadow-lg animate-pulse pointer-events-auto border border-[#E5FF8F] w-fit">
                  <span className="w-2 h-2 rounded-full bg-white" />
                  <span>STREAMING HOP {streamingHop} VIA WEBSOCKET...</span>
                </div>
              )}

              {/* Overlay Legend */}
              <div className="flex items-center space-x-2.5 px-3 py-1.5 rounded-lg bg-white/95 dark:bg-[#0D131F]/95 backdrop-blur-md border border-slate-200 dark:border-[#1E293B] text-[10px] font-mono shadow-md pointer-events-auto animate-fade-in w-fit text-slate-800 dark:text-[#F8FAFC]">
                <span className="text-slate-400 dark:text-[#64748B] uppercase font-bold text-[9px] tracking-wider">LEGEND:</span>
                <span className="flex items-center space-x-1">
                  <span className="w-2.5 h-2.5 bg-[#ef4444] inline-block shrink-0" style={{ clipPath: 'polygon(50% 0%, 61% 35%, 98% 35%, 68% 57%, 79% 91%, 50% 70%, 21% 91%, 32% 57%, 2% 35%, 39% 35%)' }} />
                  <span className="text-rose-600 dark:text-[#ef4444] font-semibold">Target</span>
                </span>
                <span className="flex items-center space-x-1">
                  <span className="w-2.5 h-2 rounded-[2px] bg-[#14b8a6] inline-block shrink-0" />
                  <span className="text-teal-600 dark:text-[#14b8a6] font-semibold">Exchange</span>
                </span>
                <span className="flex items-center space-x-1">
                  <span className="w-2.5 h-2.5 bg-[#a855f7] inline-block shrink-0" style={{ clipPath: 'polygon(50% 0%, 100% 50%, 50% 100%, 0% 50%)' }} />
                  <span className="text-purple-600 dark:text-[#a855f7] font-semibold">Mixer</span>
                </span>
                <span className="flex items-center space-x-1">
                  <span className="w-2.5 h-2.5 bg-[#dc2626] inline-block shrink-0" style={{ clipPath: 'polygon(30% 0%, 70% 0%, 100% 30%, 100% 70%, 70% 100%, 30% 100%, 0% 70%, 0% 30%)' }} />
                  <span className="text-red-600 dark:text-[#dc2626] font-semibold">Sanctioned</span>
                </span>
                <span className="flex items-center space-x-1">
                  <span className="w-2 h-2 rounded-full bg-slate-400 dark:bg-[#94a3b8] inline-block shrink-0" />
                  <span className="text-slate-500 dark:text-[#94a3b8] font-semibold">Unknown</span>
                </span>
              </div>
            </div>

            {/* Cytoscape Container (2D) & ForceGraph3D Container (3D) */}
            <div
              ref={containerRef}
              className={`w-full flex-1 graph-canvas-grid relative ${
                isFullScreen ? 'h-full min-h-full' : 'min-h-[440px]'
              } ${dimensionMode === '2D' ? 'block' : 'hidden'}`}
            />

            {dimensionMode === '3D' && (
              <div
                className={`w-full flex-1 relative overflow-hidden ${
                  isFullScreen ? 'h-full min-h-full' : 'min-h-[440px]'
                }`}
              >
                <GraphCanvas3D
                  graphData={graphData}
                  rootAddress={rootAddress}
                  isDarkMode={typeof document !== 'undefined' ? document.documentElement.classList.contains('dark') : true}
                  layoutMode={layoutMode}
                  selectedElement={selectedElement}
                  onSelectElement={setSelectedElement}
                  focusedPath={focusedPath as any}
                  onUpdateFocusedPath={updateFocusedPath}
                  selectedHops={selectedHops}
                  selectedEntityTypes={selectedEntityTypes}
                  selectedToken={selectedToken}
                  selectedChain={selectedChain}
                  minAmount={minAmount}
                  riskFilter={riskFilter}
                  viewMode={viewMode}
                  onFitRef={fit3DRef}
                  onResetRef={reset3DRef}
                  onZoomInRef={zoomIn3DRef}
                  onZoomOutRef={zoomOut3DRef}
                />
              </div>
            )}

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
                title="Auto Layout / Fit"
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

            {/* IBM i2 Temporal 24-Hour Hour-of-Day Histogram Filter Bar */}
            {showHistogramBar && (
              <div className="p-2.5 border-t border-slate-200 dark:border-[#1E293B] bg-white/95 dark:bg-[#05080E]/95 z-20">
                <TemporalHistogramBar
                  transactions={transactions}
                  edges={graphData?.edges}
                  selectedHour={selectedTemporalHour}
                  onFilterHourChange={(newHour: number | null) => {
                    setSelectedTemporalHour(newHour);
                    if (!cyRef.current) return;
                    const cy = cyRef.current;

                    cy.elements().removeClass('temporal-active-edge temporal-active-node i2-dimmed');

                    if (newHour === null) {
                      return;
                    }

                    cy.elements().addClass('i2-dimmed');

                    const matchingEdges = cy.edges().filter((e: any) => {
                      const ts = e.data('timestamp');
                      let h = 17;
                      if (ts) {
                        const d = new Date(ts);
                        if (!isNaN(d.getTime())) h = d.getHours();
                      } else {
                        const hash = e.data('txHash') || e.id();
                        let num = 0;
                        for (let i = 0; i < hash.length; i++) num += hash.charCodeAt(i);
                        h = num % 3 === 0 ? 17 : num % 24;
                      }
                      return h === newHour;
                    });

                    matchingEdges.removeClass('i2-dimmed').addClass('temporal-active-edge');
                    const connectedNodes = matchingEdges.connectedNodes();
                    connectedNodes.removeClass('i2-dimmed').addClass('temporal-active-node');

                    if (matchingEdges.length > 0) {
                      cy.animate({
                        center: { eles: matchingEdges },
                        duration: 300,
                      });
                    }
                  }}
                  onClearFilter={() => {
                    setSelectedTemporalHour(null);
                    if (cyRef.current) {
                      cyRef.current.elements().removeClass('temporal-active-edge temporal-active-node i2-dimmed');
                    }
                  }}
                  primaryToken={graphMetrics.primaryToken}
                />
              </div>
            )}

            {/* Timeline Time-Machine Replay Bar */}
            {transactions && transactions.length > 0 && !showHistogramBar && (
              <div className="p-3 border-t border-slate-200 dark:border-[#1E293B] bg-white/95 dark:bg-[#05080E]/95 z-10">
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
              <div className="absolute bottom-20 left-4 z-10 p-3 rounded-lg bg-white/95 dark:bg-[#0D131F]/95 border border-[#E5FF8F]/40 shadow-xl backdrop-blur-md font-mono text-xs max-w-md animate-fade-in">
                <div className="flex items-center justify-between mb-1.5">
                  <div className="flex items-center space-x-1.5 text-[#E5FF8F] font-bold">
                    <Sparkles className="h-3.5 w-3.5 animate-pulse" />
                    <span>PRIMARY FUND FLOW FOCUS</span>
                  </div>
                  <button
                    onClick={() => {
                      cyRef.current?.elements().removeClass('path-focused path-dimmed');
                      updateFocusedPath(null);
                    }}
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
                    <span>Hop Distance: <strong>{focusedPath.hopDistance} Hop(s)</strong></span>
                    <span>Observable Flow: <strong className="text-[#E5FF8F]">{focusedPath.totalVolume.toFixed(2)} {graphMetrics.primaryToken}</strong></span>
                  </div>
                </div>
              </div>
            )}
          </div>
        }

        {/* ======================================================================= */}
        {/* 4. RIGHT FORENSIC INSPECTOR / CENTRALITY DRAWER */}
        {/* ======================================================================= */}
        {showCentralityPanel ? (
          <div className="w-96 min-w-[22rem] border-l border-slate-200 dark:border-[#1E293B] bg-white dark:bg-[#0D131F] backdrop-blur-md z-30 flex flex-col animate-slide-left">
            <EntityCentralityPanel
              graphData={graphData}
              selectedNodeId={selectedElement?.data?.id}
              onSelectEntity={(nodeId) => {
                const node = cyRef.current?.getElementById(nodeId);
                if (node && node.length > 0) {
                  cyRef.current?.animate({
                    center: { eles: node },
                    zoom: 1.5,
                    duration: 350,
                  });
                  node.select();
                  setSelectedElement({ type: 'NODE', data: node.data() });
                }
              }}
              onHighlightEntities={(nodeIds) => {
                if (!cyRef.current) return;
                const cy = cyRef.current;
                cy.elements().removeClass('i2-highlighted-node i2-highlighted-consol i2-highlighted-edge i2-dimmed');
                if (nodeIds.length === 0) return;

                const idSet = new Set(nodeIds.map((id) => id.toLowerCase()));
                cy.elements().addClass('i2-dimmed');

                const highlightedNodes = cy.nodes().filter((n: any) => idSet.has(n.id().toLowerCase()));
                highlightedNodes.removeClass('i2-dimmed').addClass('i2-highlighted-node');

                const highlightedEdges = cy.edges().filter((e: any) => {
                  const s = e.source().id().toLowerCase();
                  const t = e.target().id().toLowerCase();
                  return idSet.has(s) || idSet.has(t);
                });
                highlightedEdges.removeClass('i2-dimmed').addClass('i2-highlighted-edge');
              }}
              onClearHighlight={() => {
                if (!cyRef.current) return;
                cyRef.current.elements().removeClass('i2-highlighted-node i2-highlighted-consol i2-highlighted-edge i2-dimmed');
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
                  <ShieldCheck className="h-4 w-4 text-[#E5FF8F]" />
                  <span>{selectedElement.type === 'NODE' ? 'Node Forensics' : 'Transfer Details'}</span>
                </div>
                <button
                  onClick={() => setSelectedElement(null)}
                  className="text-slate-400 dark:text-[#64748B] hover:text-slate-900 dark:hover:text-[#F8FAFC] p-1"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>

              {/* NODE DETAILS */}
              {selectedElement.type === 'NODE' && (
                <div className="space-y-3 font-mono text-[11px]">
                  {/* Address Badge */}
                  <div>
                    <div className="text-slate-400 dark:text-[#64748B] text-[10px] uppercase font-bold">Cryptocurrency Address</div>
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

                  {/* Entity Provenance if VASP */}
                  {selectedElement.data.isVasp && (
                    <div className="p-3 rounded-lg bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800/40 text-[11px] space-y-1">
                      <div className="text-emerald-700 dark:text-emerald-400 font-bold">
                        {selectedElement.data.vaspName} ({selectedElement.data.addressType})
                      </div>
                      {selectedElement.data.provenance && (
                        <div className="text-slate-500 dark:text-[#94A3B8] text-[10px]">
                          Provenance: {selectedElement.data.provenance}
                        </div>
                      )}
                      {selectedElement.data.vaspConfidence != null && (
                        <div className="text-emerald-600 dark:text-emerald-400 text-[10px] font-bold">
                          Confidence: {typeof selectedElement.data.vaspConfidence === 'number' || (!isNaN(Number(selectedElement.data.vaspConfidence)) && selectedElement.data.vaspConfidence !== '') ? `${selectedElement.data.vaspConfidence}%` : selectedElement.data.vaspConfidence}
                        </div>
                      )}
                    </div>
                  )}

                  {/* Financial Flow Summary */}
                  <div className="p-3 rounded-lg bg-slate-50 dark:bg-[#111827] border border-slate-200 dark:border-[#1E293B] space-y-1.5 font-mono text-[11px]">
                    <div className="text-[10px] uppercase text-slate-400 dark:text-[#64748B] font-bold font-sans">
                      Topological Flow Metrics
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-500 dark:text-[#94A3B8]">Hop Distance:</span>
                      <span className="text-slate-800 dark:text-[#F8FAFC] font-bold">Hop {selectedElement.data.hop}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-500 dark:text-[#94A3B8]">Total Inflow:</span>
                      <span className="text-emerald-600 dark:text-emerald-400 font-bold">{Number(selectedElement.data.totalInflow || 0).toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-500 dark:text-[#94A3B8]">Total Outflow:</span>
                      <span className="text-rose-600 dark:text-rose-400 font-bold">{Number(selectedElement.data.totalOutflow || 0).toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-500 dark:text-[#94A3B8]">Transactions:</span>
                      <span className="text-slate-800 dark:text-[#F8FAFC]">{selectedElement.data.txCount || 0} Transfers</span>
                    </div>
                  </div>

                  {/* Action Link & Pivot Trigger */}
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
                        className="w-full py-2 rounded bg-[#E5FF8F] hover:bg-[#EDFFB1] text-[#0A0A0A] font-bold font-mono text-xs flex items-center justify-center space-x-1.5 shadow-sm transition-all cursor-pointer"
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
                    <div className="text-slate-400 dark:text-[#64748B] text-[10px] uppercase font-bold">Transaction Hash</div>
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
                    {/* Case 6: INR/USD Valuation */}
                    {selectedElement.data.amountUsd && (
                      <div className="flex justify-between">
                        <span className="text-slate-500 dark:text-[#94A3B8]">USD Value:</span>
                        <span className="text-[#E5FF8F] font-bold">
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
                    {/* Case 2: FIFO Taint Ratio */}
                    {selectedElement.data.taintRatio != null && (
                      <div className="flex justify-between items-center">
                        <span className="text-slate-500 dark:text-[#94A3B8]">Taint Ratio:</span>
                        <span className={`font-bold ${selectedElement.data.taintRatio >= 0.8 ? 'text-red-500 dark:text-red-400' :
                            selectedElement.data.taintRatio >= 0.4 ? 'text-amber-500 dark:text-orange-400' :
                              'text-emerald-500 dark:text-lime-400'
                          }`}>
                          {selectedElement.data.taintRatio >= 0.8 ? '🔴' : selectedElement.data.taintRatio >= 0.4 ? '🟡' : '🟢'}{' '}
                          {(selectedElement.data.taintRatio * 100).toFixed(1)}%
                        </span>
                      </div>
                    )}
                    {selectedElement.data.traceableAmount != null && (
                      <div className="flex justify-between">
                        <span className="text-slate-500 dark:text-[#94A3B8]">Traceable:</span>
                        <span className="text-red-500 dark:text-red-300">{selectedElement.data.traceableAmount} {selectedElement.data.tokenSymbol}</span>
                      </div>
                    )}
                    <div className="flex justify-between">
                      <span className="text-slate-500 dark:text-[#94A3B8]">Hop Depth:</span>
                      <span className="text-slate-800 dark:text-[#F8FAFC]">Hop {selectedElement.data.hop}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-500 dark:text-[#94A3B8]">Timestamp:</span>
                      <span className="text-slate-600 dark:text-[#94A3B8]">{selectedElement.data.timestamp ? new Date(selectedElement.data.timestamp).toLocaleString() : 'Recent'}</span>
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
                      className="flex items-center justify-center space-x-1.5 w-full py-2 rounded bg-[#E5FF8F] hover:bg-[#EDFFB1] text-[#0A0A0A] font-bold text-xs transition-colors"
                    >
                      <ExternalLink className="h-3.5 w-3.5" />
                      <span>Verify on Explorer</span>
                    </a>
                  )}
                </div>
              )}
            </div>

            <div className="pt-3 border-t border-slate-200 dark:border-[#1E293B] text-[10px] text-slate-400 dark:text-[#64748B] font-mono text-center">
              SETU.so Financial Intelligence Core
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
};
