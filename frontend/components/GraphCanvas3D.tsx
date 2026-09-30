'use client';

import React, { useEffect, useRef, useState, useMemo, useCallback } from 'react';
import dynamic from 'next/dynamic';
import * as THREE from 'three';
import { GraphData } from '../lib/types';
import {
  RotateCcw,
  Sparkles,
  Lock,
  CheckCircle2,
} from 'lucide-react';

// Dynamically import react-force-graph-3d to disable SSR
const ForceGraph3D = dynamic(() => import('react-force-graph-3d'), {
  ssr: false,
  loading: () => (
    <div className="w-full h-full flex items-center justify-center font-mono text-xs text-slate-500 dark:text-slate-400 bg-white dark:bg-[#05080E]">
      <div className="flex items-center space-x-2">
        <div className="w-2.5 h-2.5 rounded-full bg-blue-500 animate-ping" />
        <span>Initializing 3D Forensic Engine...</span>
      </div>
    </div>
  ),
});

export interface FocusedPath3D {
  targetNodeId: string;
  nodeIds: Set<string>;
  edgeIds: Set<string>;
  totalVolume: number;
  hopDistance: number;
  destinationName?: string;
}

interface BuildStep {
  type: 'REVEAL_ROOT' | 'FLOW_EDGE_AND_NODE' | 'FLOW_EDGE_ONLY' | 'REVEAL_NODE';
  nodeId?: string;
  edgeId?: string;
  sourceId?: string;
  targetId?: string;
  amount?: number;
  token?: string;
  label?: string;
  hop?: number;
  description: string;
}

interface GraphCanvas3DProps {
  graphData: GraphData | null | undefined;
  rootAddress: string;
  isDarkMode: boolean;
  layoutMode: 'flow' | 'force' | 'hierarchical' | 'radial' | 'i2-peeling';
  selectedElement: { type: 'NODE' | 'EDGE'; data: any } | null;
  onSelectElement: (el: { type: 'NODE' | 'EDGE'; data: any } | null) => void;
  focusedPath: FocusedPath3D | null;
  onUpdateFocusedPath: (path: FocusedPath3D | null) => void;
  selectedHops: Set<number>;
  selectedEntityTypes: Set<string>;
  selectedToken: string;
  selectedChain: string;
  minAmount: number;
  riskFilter: 'ALL' | 'LOW' | 'MEDIUM' | 'HIGH';
  viewMode: 'NETWORK' | 'FUND_FLOW' | 'TIMELINE' | 'EVIDENCE';
  highlightedNodeIds?: Set<string> | null;
  highlightedEdgeIds?: Set<string> | null;
  onFitRef?: React.MutableRefObject<(() => void) | null>;
  onResetRef?: React.MutableRefObject<(() => void) | null>;
  onZoomInRef?: React.MutableRefObject<(() => void) | null>;
  onZoomOutRef?: React.MutableRefObject<(() => void) | null>;
}

// ─────────────────────────────────────────────────────────────────────────────
// Deterministic 3D Spatial Layout Engine (Zero Jitter, Stationary Nodes)
// ─────────────────────────────────────────────────────────────────────────────
function applyDeterministicLayout(nodes: any[], layoutMode: string) {
  if (nodes.length === 0) return;

  if (layoutMode === 'flow') {
    // True Left-to-Right Directional Flow
    const hopGroups = new Map<number, any[]>();
    nodes.forEach((n) => {
      const h = n.isRoot ? 0 : Math.min(Math.max(n.hop ?? 1, 1), 3);
      if (!hopGroups.has(h)) hopGroups.set(h, []);
      hopGroups.get(h)!.push(n);
    });

    const colX: Record<number, number> = {
      0: -240, // Target on the far left
      1: -70,  // Hop 1 counterparties
      2: 90,   // Hop 2 intermediaries
      3: 250,  // Hop 3 & VASP destination clusters
    };

    hopGroups.forEach((group, hop) => {
      const x = colX[hop] ?? (hop * 110 - 100);
      const count = group.length;

      if (count === 1) {
        group[0].x = x;
        group[0].y = 0;
        group[0].z = 0;
        group[0].fx = x;
        group[0].fy = 0;
        group[0].fz = 0;
      } else {
        const radius = Math.min(170, 35 + count * 10);
        group.forEach((node, i) => {
          const angle = (i / count) * 2 * Math.PI;
          const y = Math.sin(angle) * radius;
          const z = Math.cos(angle) * (radius * 0.7);
          node.x = x;
          node.y = y;
          node.z = z;
          node.fx = x;
          node.fy = y;
          node.fz = z;
        });
      }
    });
  } else if (layoutMode === 'radial') {
    const hopRadii: Record<number, number> = {
      0: 0,
      1: 120,
      2: 230,
      3: 340,
    };
    const hopGroups = new Map<number, any[]>();
    nodes.forEach((n) => {
      const h = n.isRoot ? 0 : Math.min(Math.max(n.hop ?? 1, 1), 3);
      if (!hopGroups.has(h)) hopGroups.set(h, []);
      hopGroups.get(h)!.push(n);
    });

    hopGroups.forEach((group, hop) => {
      if (hop === 0) {
        group.forEach((n) => {
          n.x = 0; n.y = 0; n.z = 0;
          n.fx = 0; n.fy = 0; n.fz = 0;
        });
      } else {
        const r = hopRadii[hop] || 250;
        const count = group.length;
        group.forEach((node, i) => {
          const phi = Math.acos(-1 + (2 * i) / count);
          const theta = Math.sqrt(count * Math.PI) * phi;
          const x = r * Math.sin(phi) * Math.cos(theta);
          const y = r * Math.sin(phi) * Math.sin(theta);
          const z = r * Math.cos(phi);
          node.x = x; node.y = y; node.z = z;
          node.fx = x; node.fy = y; node.fz = z;
        });
      }
    });
  } else if (layoutMode === 'i2-peeling') {
    const hopGroups = new Map<number, any[]>();
    nodes.forEach((n) => {
      const h = n.isRoot ? 0 : Math.min(Math.max(n.hop ?? 1, 1), 3);
      if (!hopGroups.has(h)) hopGroups.set(h, []);
      hopGroups.get(h)!.push(n);
    });

    const rowY: Record<number, number> = {
      0: 180,
      1: 60,
      2: -60,
      3: -180,
    };

    hopGroups.forEach((group, hop) => {
      const y = rowY[hop] ?? (-hop * 100);
      const count = group.length;
      const spreadX = Math.min(300, count * 35);
      group.forEach((node, i) => {
        const x = count === 1 ? 0 : -spreadX / 2 + (i / (count - 1)) * spreadX;
        const z = (i % 2 === 0 ? 1 : -1) * (15 + (i % 3) * 10);
        node.x = x; node.y = y; node.z = z;
        node.fx = x; node.fy = y; node.fz = z;
      });
    });
  } else {
    // Force mode: Organic spread initialized around hop shells
    nodes.forEach((node, idx) => {
      const hop = node.hop ?? 1;
      const angle = (idx / nodes.length) * 2 * Math.PI;
      const dist = hop * 80 + 30;
      const x = Math.cos(angle) * dist;
      const y = Math.sin(angle) * dist;
      const z = ((idx % 5) - 2) * 25;
      node.x = x; node.y = y; node.z = z;
      node.fx = x; node.fy = y; node.fz = z;
    });
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Shortest Path Finder (Breadth-First Search on directed multigraph)
// ─────────────────────────────────────────────────────────────────────────────
function findShortestPath(
  rootId: string,
  targetId: string,
  edges: any[]
): { nodeIds: Set<string>; edgeIds: Set<string>; totalVolume: number; hops: number } | null {
  if (!rootId || !targetId || rootId.toLowerCase() === targetId.toLowerCase()) {
    return null;
  }

  const adj = new Map<string, Array<{ to: string; edgeId: string; amount: number }>>();
  edges.forEach((e) => {
    const src = (e.source?.id || e.source || '').toLowerCase();
    const tgt = (e.target?.id || e.target || '').toLowerCase();
    const eid = e.id || `${src}-${tgt}`;
    const amt = Number(e.amount || e.data?.amount || 0);

    if (!adj.has(src)) adj.set(src, []);
    adj.get(src)!.push({ to: tgt, edgeId: eid, amount: amt });
  });

  const queue: Array<{ current: string; pathNodes: string[]; pathEdges: string[]; volume: number }> = [
    { current: rootId.toLowerCase(), pathNodes: [rootId.toLowerCase()], pathEdges: [], volume: 0 },
  ];
  const visited = new Set<string>([rootId.toLowerCase()]);

  while (queue.length > 0) {
    const { current, pathNodes, pathEdges, volume } = queue.shift()!;
    if (current === targetId.toLowerCase()) {
      return {
        nodeIds: new Set(pathNodes),
        edgeIds: new Set(pathEdges),
        totalVolume: volume,
        hops: pathNodes.length - 1,
      };
    }

    const neighbors = adj.get(current) || [];
    for (const edge of neighbors) {
      if (!visited.has(edge.to)) {
        visited.add(edge.to);
        queue.push({
          current: edge.to,
          pathNodes: [...pathNodes, edge.to],
          pathEdges: [...pathEdges, edge.edgeId],
          volume: volume + edge.amount,
        });
      }
    }
  }

  return null;
}

export const GraphCanvas3D: React.FC<GraphCanvas3DProps> = ({
  graphData,
  rootAddress,
  isDarkMode,
  layoutMode,
  selectedElement,
  onSelectElement,
  focusedPath,
  onUpdateFocusedPath,
  selectedHops,
  selectedEntityTypes,
  selectedToken,
  selectedChain,
  minAmount,
  riskFilter,
  highlightedNodeIds,
  highlightedEdgeIds,
  onFitRef,
  onResetRef,
  onZoomInRef,
  onZoomOutRef,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const fgRef = useRef<any>(null);
  const [dimensions, setDimensions] = useState({ width: 800, height: 600 });
  const [SpriteTextClass, setSpriteTextClass] = useState<any>(null);
  const [hoveredNodeId, setHoveredNodeId] = useState<string | null>(null);

  // Progressive Animation Engine States
  const [visibleNodeIds, setVisibleNodeIds] = useState<Set<string>>(new Set());
  const [visibleLinkIds, setVisibleLinkIds] = useState<Set<string>>(new Set());
  const [activeEdgeId, setActiveEdgeId] = useState<string | null>(null);
  const [activeNodeId, setActiveNodeId] = useState<string | null>(null);
  const [isAnimating, setIsAnimating] = useState<boolean>(false);
  const [showFinishedToast, setShowFinishedToast] = useState<boolean>(false);
  const [currentStepIndex, setCurrentStepIndex] = useState<number>(0);
  const [totalStepsCount, setTotalStepsCount] = useState<number>(0);
  const [currentStepDescription, setCurrentStepDescription] = useState<string>('');

  const animTimerRef = useRef<NodeJS.Timeout | null>(null);
  const toastTimerRef = useRef<NodeJS.Timeout | null>(null);

  // Tracks the wallet address for which the graph build animation was already completed
  const builtAddressRef = useRef<string | null>(null);

  // Dynamically load SpriteText on client
  useEffect(() => {
    import('three-spritetext').then((mod) => {
      setSpriteTextClass(() => mod.default || mod);
    });
  }, []);

  // Responsive container observer
  useEffect(() => {
    if (!containerRef.current) return;
    const observer = new ResizeObserver((entries) => {
      for (const entry of entries) {
        const { width, height } = entry.contentRect;
        if (width > 0 && height > 0) {
          setDimensions({ width, height });
        }
      }
    });
    observer.observe(containerRef.current);
    return () => observer.disconnect();
  }, []);

  // ─────────────────────────────────────────────────────────────────────────────
  // Transform, Layout & Filter Data into 3D Stationary Format
  // ─────────────────────────────────────────────────────────────────────────────
  const { nodes3D, links3D, rootNodeId } = useMemo(() => {
    if (!graphData?.nodes || graphData.nodes.length === 0) {
      return { nodes3D: [], links3D: [], rootNodeId: null };
    }

    const rawNodes = graphData.nodes;
    const rawEdges = graphData.edges || [];

    // Map & normalize nodes
    const nodeMap = new Map<string, any>();
    let detectedRootId: string | null = null;

    rawNodes.forEach((n: any) => {
      const d = n.data || n;
      const nodeId = (d.id || d.address || '').toLowerCase();
      if (!nodeId) return;

      const isRoot =
        d.role === 'INPUT_WALLET' ||
        d.is_root ||
        d.hop === 0 ||
        (rootAddress && nodeId === rootAddress.toLowerCase());

      if (isRoot) {
        detectedRootId = nodeId;
      }

      const isVasp = d.is_vasp || d.role === 'KNOWN_VASP';
      const isBridge = d.role === 'BRIDGE_PROTOCOL' || Boolean(d.bridge_protocol);
      const hop = d.hop ?? (isRoot ? 0 : 1);
      const chain = (d.chain || 'ethereum').toLowerCase();

      const rawCat = (d.category || d.entity || d.label || d.role || d.vasp_name || '').toLowerCase();
      let tag: 'target' | 'exchange' | 'mixer' | 'sanctioned' | 'bridge' | 'unknown' = 'unknown';

      if (isRoot) {
        tag = 'target';
      } else if (isBridge) {
        tag = 'bridge';
      } else if (
        isVasp ||
        rawCat.includes('exchange') ||
        rawCat.includes('binance') ||
        rawCat.includes('okx') ||
        rawCat.includes('vasp') ||
        rawCat.includes('coinbase') ||
        rawCat.includes('wazirx')
      ) {
        tag = 'exchange';
      } else if (
        rawCat.includes('mixer') ||
        rawCat.includes('tornado') ||
        rawCat.includes('tumbler') ||
        rawCat.includes('anonymizer')
      ) {
        tag = 'mixer';
      } else if (
        rawCat.includes('sanction') ||
        rawCat.includes('ofac') ||
        rawCat.includes('illicit') ||
        d.risk_level === 'CRITICAL' ||
        d.risk_level === 'SANCTIONED'
      ) {
        tag = 'sanctioned';
      }

      const roleType = isRoot
        ? 'TARGET'
        : isVasp || tag === 'exchange'
          ? 'VASP'
          : isBridge
            ? 'BRIDGE'
            : hop <= 3
              ? 'INTERMEDIARY'
              : 'EXTERNAL';

      // Apply Filters
      if (!isRoot) {
        if (!selectedHops.has(Math.min(hop, 3))) return;
        if (!selectedEntityTypes.has(roleType)) return;
        if (selectedChain !== 'ALL' && chain !== selectedChain.toLowerCase()) return;
        if (riskFilter !== 'ALL') {
          const rLevel = (d.risk_level || 'LOW').toUpperCase();
          if (riskFilter === 'HIGH' && (rLevel !== 'HIGH' && rLevel !== 'CRITICAL' && tag !== 'sanctioned')) return;
          if (riskFilter === 'MEDIUM' && rLevel !== 'MEDIUM') return;
          if (riskFilter === 'LOW' && (rLevel !== 'LOW' && rLevel !== 'UNKNOWN')) return;
        }
      }

      nodeMap.set(nodeId, {
        id: nodeId,
        rawAddress: d.id || d.address,
        isRoot,
        isVasp: isVasp || tag === 'exchange',
        isBridge,
        bridgeProtocol: d.bridge_protocol,
        chain,
        tag,
        category: tag,
        vaspName: d.vasp_name,
        vaspConfidence: d.vasp_confidence ?? 95,
        hop,
        addressType: d.address_type || 'hot_wallet',
        totalInflow: d.total_inflow || 0,
        totalOutflow: d.total_outflow || 0,
        txCount: d.tx_count || 0,
        role: d.role || roleType,
        riskLevel: d.risk_level || (tag === 'sanctioned' ? 'CRITICAL' : 'LOW'),
        data: {
          id: d.id || d.address,
          label: d.label || d.id || d.address,
          isRoot,
          isVasp: isVasp || tag === 'exchange',
          isBridge,
          bridgeProtocol: d.bridge_protocol,
          chain,
          tag,
          category: tag,
          vaspName: d.vasp_name,
          vaspConfidence: d.vasp_confidence ?? 95,
          hop,
          addressType: d.address_type || 'hot_wallet',
          fullAddress: d.id || d.address,
          totalInflow: d.total_inflow || 0,
          totalOutflow: d.total_outflow || 0,
          txCount: d.tx_count || 0,
          role: d.role || roleType,
        },
      });
    });

    // Process Edges
    const validLinks: any[] = [];
    rawEdges.forEach((e: any, idx: number) => {
      const d = e.data || e;
      const srcId = (d.source?.id || d.source || '').toLowerCase();
      const tgtId = (d.target?.id || d.target || '').toLowerCase();

      if (!nodeMap.has(srcId) || !nodeMap.has(tgtId)) return;

      const amt = Number(d.amount || 0);
      if (minAmount > 0 && amt < minAmount) return;

      const sym = (d.asset_symbol || d.token_symbol || 'ETH').toUpperCase();
      if (selectedToken !== 'ALL' && sym !== selectedToken.toUpperCase()) return;

      const edgeId = d.id || `edge-3d-${idx}`;
      const isCrossChain = Boolean(d.is_cross_chain || d.bridge_protocol);
      const taintRatio = d.taint_ratio != null ? Number(d.taint_ratio) : null;

      validLinks.push({
        id: edgeId,
        source: srcId,
        target: tgtId,
        amount: amt,
        tokenSymbol: sym,
        txHash: d.tx_hash || '',
        timestamp: d.timestamp || '',
        hop: d.hop || 1,
        isCrossChain,
        bridgeProtocol: d.bridge_protocol || '',
        sourceChain: d.source_chain,
        targetChain: d.target_chain,
        amountUsd: d.amount_usd ? Number(d.amount_usd) : null,
        amountInr: d.amount_inr ? Number(d.amount_inr) : null,
        taintRatio,
        traceableAmount: d.traceable_amount ? Number(d.traceable_amount) : null,
        unclassifiedAmount: d.unclassified_amount ? Number(d.unclassified_amount) : null,
        data: {
          id: edgeId,
          source: d.source,
          target: d.target,
          amount: amt,
          tokenSymbol: sym,
          txHash: d.tx_hash || '',
          timestamp: d.timestamp || '',
          hop: d.hop || 1,
          isCrossChain,
          bridgeProtocol: d.bridge_protocol || '',
          sourceChain: d.source_chain,
          targetChain: d.target_chain,
          amountUsd: d.amount_usd,
          amountInr: d.amount_inr,
          taintRatio,
          traceableAmount: d.traceable_amount,
          unclassifiedAmount: d.unclassified_amount,
        },
      });
    });

    const nodeArray = Array.from(nodeMap.values());
    applyDeterministicLayout(nodeArray, layoutMode);

    return {
      nodes3D: nodeArray,
      links3D: validLinks,
      rootNodeId: detectedRootId,
    };
  }, [
    graphData,
    rootAddress,
    layoutMode,
    selectedHops,
    selectedEntityTypes,
    selectedChain,
    selectedToken,
    minAmount,
    riskFilter,
  ]);

  // ─────────────────────────────────────────────────────────────────────────────
  // Topological BFS Flow Sequence Generator
  // ─────────────────────────────────────────────────────────────────────────────
  const generateFlowSteps = useCallback((nodes: any[], links: any[], rId: string | null): BuildStep[] => {
    if (nodes.length === 0) return [];

    const steps: BuildStep[] = [];
    const root = (rId || (rootAddress ? rootAddress.toLowerCase() : null) || nodes[0].id).toLowerCase();
    const nodeMap = new Map<string, any>();
    nodes.forEach((n) => nodeMap.set(n.id, n));

    const discoveredNodes = new Set<string>();
    const discoveredEdges = new Set<string>();

    // Step 0: Target Wallet Initialized
    if (nodeMap.has(root)) {
      discoveredNodes.add(root);
      const rn = nodeMap.get(root);
      steps.push({
        type: 'REVEAL_ROOT',
        nodeId: root,
        label: rn.rawAddress,
        description: `Target Wallet: ${rn.rawAddress.slice(0, 6)}...${rn.rawAddress.slice(-4)}`,
      });
    }

    const queue: string[] = Array.from(discoveredNodes);
    const outgoing = new Map<string, any[]>();
    links.forEach((l) => {
      const s = (l.source?.id || l.source || '').toLowerCase();
      if (!outgoing.has(s)) outgoing.set(s, []);
      outgoing.get(s)!.push(l);
    });

    while (queue.length > 0) {
      const current = queue.shift()!;
      const edges = outgoing.get(current) || [];
      edges.sort((a, b) => (b.amount || 0) - (a.amount || 0));

      for (const e of edges) {
        if (discoveredEdges.has(e.id)) continue;
        discoveredEdges.add(e.id);

        const targetId = (e.target?.id || e.target || '').toLowerCase();
        const tgtNode = nodeMap.get(targetId);
        const amtStr = `${Number(e.amount || 0).toFixed(2)} ${e.tokenSymbol || 'ETH'}`;

        if (tgtNode && !discoveredNodes.has(targetId)) {
          discoveredNodes.add(targetId);
          queue.push(targetId);

          const destName = tgtNode.vaspName || (tgtNode.isRoot ? 'TARGET' : `Hop ${tgtNode.hop || 1}`);
          steps.push({
            type: 'FLOW_EDGE_AND_NODE',
            nodeId: targetId,
            edgeId: e.id,
            sourceId: current,
            targetId,
            amount: e.amount,
            token: e.tokenSymbol,
            hop: tgtNode.hop,
            description: `${current.slice(0, 6)}... ➔ ${tgtNode.rawAddress.slice(0, 6)}... (${amtStr}) [${destName}]`,
          });
        } else {
          steps.push({
            type: 'FLOW_EDGE_ONLY',
            edgeId: e.id,
            sourceId: current,
            targetId,
            amount: e.amount,
            token: e.tokenSymbol,
            description: `Connecting ${current.slice(0, 6)}... ➔ ${targetId.slice(0, 6)}... (${amtStr})`,
          });
        }
      }
    }

    nodes.forEach((n) => {
      if (!discoveredNodes.has(n.id)) {
        discoveredNodes.add(n.id);
        steps.push({
          type: 'REVEAL_NODE',
          nodeId: n.id,
          label: n.rawAddress,
          hop: n.hop,
          description: `Discovered Counterparty: ${n.rawAddress.slice(0, 6)}...${n.rawAddress.slice(-4)}`,
        });
      }
    });

    links.forEach((l) => {
      if (!discoveredEdges.has(l.id)) {
        discoveredEdges.add(l.id);
        const s = (l.source?.id || l.source || '').toLowerCase();
        const t = (l.target?.id || l.target || '').toLowerCase();
        steps.push({
          type: 'FLOW_EDGE_ONLY',
          edgeId: l.id,
          sourceId: s,
          targetId: t,
          amount: l.amount,
          token: l.tokenSymbol,
          description: `Inter-hop flow: ${s.slice(0, 6)}... ➔ ${t.slice(0, 6)}...`,
        });
      }
    });

    return steps;
  }, [rootAddress]);

  // Execute Animation Step
  const runNextStep = useCallback((stepIdx: number, allSteps: BuildStep[]) => {
    if (stepIdx >= allSteps.length) {
      // Completed animation
      setIsAnimating(false);
      setActiveEdgeId(null);
      setActiveNodeId(null);
      setShowFinishedToast(true);

      if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
      toastTimerRef.current = setTimeout(() => {
        setShowFinishedToast(false);
      }, 1800);

      setTimeout(() => {
        fgRef.current?.zoomToFit(500, 75);
      }, 150);
      return;
    }

    const step = allSteps[stepIdx];
    setCurrentStepIndex(stepIdx);
    setCurrentStepDescription(step.description);

    // Natural real-time step speed (~260ms) so each connection is clearly visible
    const stepDelay = 260;

    if (step.type === 'REVEAL_ROOT' && step.nodeId) {
      setVisibleNodeIds(new Set([step.nodeId]));
      setActiveNodeId(step.nodeId);
      setActiveEdgeId(null);

      animTimerRef.current = setTimeout(() => {
        runNextStep(stepIdx + 1, allSteps);
      }, stepDelay);
    } else if (step.type === 'FLOW_EDGE_AND_NODE' && step.edgeId && step.nodeId) {
      // 1. Edge connection animates with bright photon particles
      setVisibleLinkIds((prev) => new Set([...Array.from(prev), step.edgeId!]));
      setActiveEdgeId(step.edgeId);

      // 2. Target node materializes with glowing halo
      const subDelay = 110;
      animTimerRef.current = setTimeout(() => {
        setVisibleNodeIds((prev) => new Set([...Array.from(prev), step.nodeId!]));
        setActiveNodeId(step.nodeId!);

        if (stepIdx % 4 === 0) {
          fgRef.current?.zoomToFit(400, 80);
        }

        animTimerRef.current = setTimeout(() => {
          runNextStep(stepIdx + 1, allSteps);
        }, stepDelay - subDelay);
      }, subDelay);
    } else if (step.type === 'FLOW_EDGE_ONLY' && step.edgeId) {
      setVisibleLinkIds((prev) => new Set([...Array.from(prev), step.edgeId!]));
      setActiveEdgeId(step.edgeId);

      animTimerRef.current = setTimeout(() => {
        runNextStep(stepIdx + 1, allSteps);
      }, stepDelay);
    } else if (step.type === 'REVEAL_NODE' && step.nodeId) {
      setVisibleNodeIds((prev) => new Set([...Array.from(prev), step.nodeId!]));
      setActiveNodeId(step.nodeId);

      animTimerRef.current = setTimeout(() => {
        runNextStep(stepIdx + 1, allSteps);
      }, stepDelay);
    }
  }, []);

  // ─────────────────────────────────────────────────────────────────────────────
  // Trigger Real-Time Animation ONLY when a new wallet address is entered
  // ─────────────────────────────────────────────────────────────────────────────
  useEffect(() => {
    const currentTarget =
      rootAddress && rootAddress !== '0x...' ? rootAddress.toLowerCase() : '';

    if (!currentTarget || nodes3D.length === 0) {
      if (!currentTarget) builtAddressRef.current = null;
      return;
    }

    // If this exact wallet address has already been built:
    // DO NOT animate again! Keep all nodes visible immediately!
    if (builtAddressRef.current === currentTarget) {
      setVisibleNodeIds(new Set(nodes3D.map((n) => n.id)));
      setVisibleLinkIds(new Set(links3D.map((l) => l.id)));
      setIsAnimating(false);
      return;
    }

    // A NEW wallet address was entered!
    builtAddressRef.current = currentTarget;

    if (animTimerRef.current) clearTimeout(animTimerRef.current);
    if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
    setShowFinishedToast(false);

    const steps = generateFlowSteps(nodes3D, links3D, rootNodeId);
    setTotalStepsCount(steps.length);

    if (steps.length <= 1) {
      setVisibleNodeIds(new Set(nodes3D.map((n) => n.id)));
      setVisibleLinkIds(new Set(links3D.map((l) => l.id)));
      setIsAnimating(false);
      return;
    }

    // Begin animated step-by-step real-time construction
    setIsAnimating(true);
    setCurrentStepIndex(0);
    setVisibleNodeIds(new Set());
    setVisibleLinkIds(new Set());

    animTimerRef.current = setTimeout(() => {
      runNextStep(0, steps);
    }, 180);

    return () => {
      if (animTimerRef.current) clearTimeout(animTimerRef.current);
    };
  }, [rootAddress, nodes3D, links3D, rootNodeId, generateFlowSteps, runNextStep]);

  // When changing layout modes (e.g. to Radial, Flow, Force, i2-peeling):
  // Re-fit the camera cleanly without re-running any building animations!
  useEffect(() => {
    if (!fgRef.current) return;
    const timer = setTimeout(() => {
      fgRef.current?.zoomToFit(500, 80);
    }, 150);
    return () => clearTimeout(timer);
  }, [layoutMode]);

  // Orbit controls setup
  useEffect(() => {
    if (!fgRef.current) return;
    const fg = fgRef.current;
    const controls = fg.controls();
    if (controls) {
      controls.enableDamping = true;
      controls.dampingFactor = 0.06;
      controls.rotateSpeed = 0.85;
      controls.zoomSpeed = 1.0;
      controls.panSpeed = 0.85;
      controls.minDistance = 25;
      controls.maxDistance = 3500;
    }
  }, []);

  // Compute active nodes & links currently revealed
  const displayNodes = useMemo(() => {
    if (!isAnimating) {
      return nodes3D;
    }
    return nodes3D.filter((n) => visibleNodeIds.has(n.id));
  }, [nodes3D, visibleNodeIds, isAnimating]);

  const displayLinks = useMemo(() => {
    if (!isAnimating) {
      return links3D;
    }
    return links3D.filter((l) => visibleLinkIds.has(l.id));
  }, [links3D, visibleLinkIds, isAnimating]);

  // ─────────────────────────────────────────────────────────────────────────────
  // Expose Micro-tools (Zoom In, Zoom Out, Reset, Fit) to Floating Controls
  // ─────────────────────────────────────────────────────────────────────────────
  useEffect(() => {
    if (onFitRef) {
      onFitRef.current = () => {
        fgRef.current?.zoomToFit(500, 80);
      };
    }
    if (onResetRef) {
      onResetRef.current = () => {
        onUpdateFocusedPath(null);
        onSelectElement(null);
        fgRef.current?.cameraPosition({ x: 0, y: 0, z: 420 }, { x: 0, y: 0, z: 0 }, 600);
      };
    }
    if (onZoomInRef) {
      onZoomInRef.current = () => {
        const cam = fgRef.current?.camera();
        if (cam) {
          fgRef.current.cameraPosition(
            { x: cam.position.x * 0.75, y: cam.position.y * 0.75, z: cam.position.z * 0.75 },
            undefined,
            300
          );
        }
      };
    }
    if (onZoomOutRef) {
      onZoomOutRef.current = () => {
        const cam = fgRef.current?.camera();
        if (cam) {
          fgRef.current.cameraPosition(
            { x: cam.position.x * 1.35, y: cam.position.y * 1.35, z: cam.position.z * 1.35 },
            undefined,
            300
          );
        }
      };
    }
  }, [onFitRef, onResetRef, onZoomInRef, onZoomOutRef, onUpdateFocusedPath, onSelectElement]);

  // ─────────────────────────────────────────────────────────────────────────────
  // Click Handler: Shortest Path Highlighting + Inspector Drawer Activation
  // ─────────────────────────────────────────────────────────────────────────────
  const handleNodeClick = useCallback(
    (node: any) => {
      onSelectElement({
        type: 'NODE',
        data: node.data,
      });

      const pathResult = findShortestPath(rootAddress, node.id, links3D);
      if (pathResult) {
        onUpdateFocusedPath({
          targetNodeId: node.id,
          nodeIds: pathResult.nodeIds,
          edgeIds: pathResult.edgeIds,
          totalVolume: pathResult.totalVolume,
          hopDistance: pathResult.hops,
          destinationName: node.vaspName,
        });
      } else {
        onUpdateFocusedPath(null);
      }

      const distance = 140;
      const distRatio = 1 + distance / Math.hypot(node.x || 1, node.y || 1, node.z || 1);
      fgRef.current?.cameraPosition(
        { x: (node.x || 0) * distRatio, y: (node.y || 0) * distRatio, z: (node.z || 0) * distRatio },
        node,
        800
      );
    },
    [rootAddress, links3D, onSelectElement, onUpdateFocusedPath]
  );

  const handleLinkClick = useCallback(
    (link: any) => {
      onSelectElement({
        type: 'EDGE',
        data: link.data,
      });
    },
    [onSelectElement]
  );

  const handleBackgroundClick = useCallback(() => {
    onSelectElement(null);
    onUpdateFocusedPath(null);
  }, [onSelectElement, onUpdateFocusedPath]);

  const handleNodeDrag = useCallback((node: any) => {
    node.fx = node.x;
    node.fy = node.y;
    node.fz = node.z;
  }, []);

  const handleNodeDragEnd = useCallback((node: any) => {
    node.fx = node.x;
    node.fy = node.y;
    node.fz = node.z;
  }, []);

  // ─────────────────────────────────────────────────────────────────────────────
  // Custom 3D Node Mesh & Billboarding Labels
  // ─────────────────────────────────────────────────────────────────────────────
  const nodeThreeObject = useCallback(
    (node: any) => {
      const group = new THREE.Group();
      const isPathActive = focusedPath !== null;
      const isInPath = isPathActive ? focusedPath.nodeIds.has(node.id) : true;
      const isHighlighted = highlightedNodeIds ? highlightedNodeIds.has(node.id) : true;
      const isDimmed = (isPathActive && !isInPath) || (highlightedNodeIds && !isHighlighted);
      const opacity = isDimmed ? 0.15 : 1.0;
      const isHovered = hoveredNodeId === node.id;
      const isSelected = selectedElement?.type === 'NODE' && selectedElement.data?.id === node.id;
      const isJustSpawned = isAnimating && activeNodeId === node.id;

      let primaryMesh: THREE.Mesh;
      let haloColor = 0x3b82f6;
      let nodeRadius = 4.5;

      switch (node.tag) {
        case 'target': {
          nodeRadius = 6.2;
          haloColor = 0xef4444;
          const geo = new THREE.SphereGeometry(nodeRadius, 24, 24);
          const mat = new THREE.MeshStandardMaterial({
            color: isDimmed ? 0x475569 : 0xef4444,
            emissive: isDimmed ? 0x000000 : isJustSpawned ? 0xff4444 : 0xb91c1c,
            emissiveIntensity: isDimmed ? 0 : isJustSpawned ? 1.5 : 0.9,
            roughness: 0.2,
            metalness: 0.7,
            transparent: true,
            opacity,
          });
          primaryMesh = new THREE.Mesh(geo, mat);
          break;
        }

        case 'exchange': {
          nodeRadius = 5.2;
          haloColor = 0x10b981;
          const geo = new THREE.SphereGeometry(nodeRadius, 22, 22);
          const mat = new THREE.MeshStandardMaterial({
            color: isDimmed ? 0x475569 : 0x10b981,
            emissive: isDimmed ? 0x000000 : isJustSpawned ? 0x10f9a1 : 0x059669,
            emissiveIntensity: isDimmed ? 0 : isJustSpawned ? 1.4 : 0.8,
            roughness: 0.25,
            metalness: 0.6,
            transparent: true,
            opacity,
          });
          primaryMesh = new THREE.Mesh(geo, mat);
          break;
        }

        case 'mixer': {
          nodeRadius = 4.8;
          haloColor = 0xa855f7;
          const geo = new THREE.SphereGeometry(nodeRadius, 20, 20);
          const mat = new THREE.MeshStandardMaterial({
            color: isDimmed ? 0x475569 : 0xa855f7,
            emissive: isDimmed ? 0x000000 : isJustSpawned ? 0xd875ff : 0x581c87,
            emissiveIntensity: isDimmed ? 0 : isJustSpawned ? 1.4 : 0.85,
            roughness: 0.15,
            metalness: 0.8,
            transparent: true,
            opacity,
          });
          primaryMesh = new THREE.Mesh(geo, mat);
          break;
        }

        case 'sanctioned': {
          nodeRadius = 5.0;
          haloColor = 0xdc2626;
          const geo = new THREE.SphereGeometry(nodeRadius, 20, 20);
          const mat = new THREE.MeshStandardMaterial({
            color: isDimmed ? 0x475569 : 0xdc2626,
            emissive: isDimmed ? 0x000000 : isJustSpawned ? 0xff2222 : 0x7f1d1d,
            emissiveIntensity: isDimmed ? 0 : isJustSpawned ? 1.5 : 0.95,
            roughness: 0.35,
            metalness: 0.6,
            transparent: true,
            opacity,
          });
          primaryMesh = new THREE.Mesh(geo, mat);
          break;
        }

        case 'bridge': {
          nodeRadius = 4.8;
          haloColor = 0x818cf8;
          const geo = new THREE.SphereGeometry(nodeRadius, 20, 20);
          const mat = new THREE.MeshStandardMaterial({
            color: isDimmed ? 0x475569 : 0x818cf8,
            emissive: isDimmed ? 0x000000 : isJustSpawned ? 0xa1aaff : 0x4338ca,
            emissiveIntensity: isDimmed ? 0 : isJustSpawned ? 1.4 : 0.85,
            roughness: 0.3,
            metalness: 0.6,
            transparent: true,
            opacity,
          });
          primaryMesh = new THREE.Mesh(geo, mat);
          break;
        }

        default: {
          const isHop1 = node.hop === 1;
          nodeRadius = isHop1 ? 4.0 : node.hop === 2 ? 3.3 : 2.7;
          haloColor = isHop1 ? 0x3b82f6 : 0x64748b;
          const geo = new THREE.SphereGeometry(nodeRadius, 16, 16);
          const mat = new THREE.MeshStandardMaterial({
            color: isDimmed
              ? 0x334155
              : isHop1
                ? 0x3b82f6
                : isDarkMode
                  ? 0x64748b
                  : 0x94a3b8,
            emissive: isDimmed
              ? 0x000000
              : isJustSpawned
                ? 0x60a5fa
                : isHop1
                  ? 0x1d4ed8
                  : isDarkMode
                    ? 0x1e293b
                    : 0x475569,
            emissiveIntensity: isDimmed ? 0 : isJustSpawned ? 1.4 : isHop1 ? 0.6 : 0.25,
            roughness: 0.35,
            metalness: 0.4,
            transparent: true,
            opacity,
          });
          primaryMesh = new THREE.Mesh(geo, mat);
          break;
        }
      }

      group.add(primaryMesh);

      // Active Node Spawn Beacon Flare (ring ripple when node is created)
      if (isJustSpawned) {
        const beaconGeo = new THREE.RingGeometry(nodeRadius * 1.3, nodeRadius * 2.1, 24);
        const beaconMat = new THREE.MeshBasicMaterial({
          color: 0x00ff9d,
          side: THREE.DoubleSide,
          transparent: true,
          opacity: 0.85,
        });
        const beaconMesh = new THREE.Mesh(beaconGeo, beaconMat);
        group.add(beaconMesh);
      }

      // Luminous celestial glow halo
      if (!isDimmed) {
        const auraGeo = new THREE.SphereGeometry(nodeRadius * 1.45, 16, 16);
        const auraMat = new THREE.MeshBasicMaterial({
          color: isJustSpawned ? 0x00ff9d : haloColor,
          transparent: true,
          opacity: isJustSpawned ? 0.6 : isSelected ? 0.45 : isHovered ? 0.35 : 0.22,
          side: THREE.BackSide,
          blending: THREE.AdditiveBlending,
        });
        group.add(new THREE.Mesh(auraGeo, auraMat));
      }

      // Billboarding labels
      if (SpriteTextClass && !isDimmed) {
        let labelText = '';

        if (node.isRoot) {
          labelText = 'TARGET';
        } else if (node.tag === 'exchange' || node.isVasp) {
          labelText = (node.vaspName || 'VASP').toUpperCase();
        } else if (node.tag === 'mixer') {
          labelText = 'MIXER';
        } else if (node.tag === 'sanctioned') {
          labelText = 'OFAC ALERT';
        } else if (node.tag === 'bridge') {
          labelText = 'BRIDGE';
        } else if (node.hop === 1) {
          labelText = 'HOP 1';
        } else {
          labelText = `H${node.hop}`;
        }

        if (isHovered || isSelected || isJustSpawned) {
          const shortAddr = `${node.rawAddress.slice(0, 5)}...${node.rawAddress.slice(-3)}`;
          labelText = `${labelText} (${shortAddr})`;
        }

        const sprite = new SpriteTextClass(labelText);
        sprite.color = isDarkMode ? '#F8FAFC' : '#0F172A';
        sprite.textHeight = 2.4;
        sprite.fontFace = 'JetBrains Mono, monospace';
        sprite.fontWeight = '700';
        sprite.backgroundColor = isJustSpawned
          ? 'rgba(0, 255, 157, 0.25)'
          : isDarkMode
            ? 'rgba(5, 8, 14, 0.8)'
            : 'rgba(255, 255, 255, 0.9)';
        sprite.borderColor = isJustSpawned
          ? '#00FF9D'
          : isDarkMode
            ? 'rgba(30, 41, 59, 0.8)'
            : 'rgba(203, 213, 225, 0.85)';
        sprite.borderWidth = 0.3;
        sprite.borderRadius = 2.5;
        sprite.padding = 1.2;
        sprite.position.y = -(nodeRadius + 3.2);
        group.add(sprite);
      }

      return group;
    },
    [SpriteTextClass, focusedPath, highlightedNodeIds, isDarkMode, hoveredNodeId, selectedElement, activeNodeId, isAnimating]
  );

  // ─────────────────────────────────────────────────────────────────────────────
  // Dynamic Link Color & Width Mapping (Real-Time Flow Highlight)
  // ─────────────────────────────────────────────────────────────────────────────
  const linkColor = useCallback(
    (link: any) => {
      if (link.id === activeEdgeId) {
        return '#00FF9D';
      }

      const isPathActive = focusedPath !== null;
      if (isPathActive) {
        const inPath = focusedPath.edgeIds.has(link.id);
        return inPath ? '#6EFFC3' : isDarkMode ? 'rgba(51, 65, 85, 0.12)' : 'rgba(148, 163, 184, 0.12)';
      }

      if (highlightedEdgeIds && !highlightedEdgeIds.has(link.id)) {
        return isDarkMode ? 'rgba(51, 65, 85, 0.12)' : 'rgba(148, 163, 184, 0.12)';
      }

      if (link.isCrossChain) return '#A855F7';

      const taint = link.taintRatio;
      if (taint !== null && taint !== undefined) {
        if (taint >= 0.8) return '#F43F5E';
        if (taint >= 0.4) return '#F59E0B';
        if (taint > 0) return '#10B981';
      }

      return isDarkMode ? '#475569' : '#94A3B8';
    },
    [activeEdgeId, focusedPath, highlightedEdgeIds, isDarkMode]
  );

  const linkWidth = useCallback(
    (link: any) => {
      if (link.id === activeEdgeId) return 3.8;
      const isPathActive = focusedPath !== null;
      const inPath = isPathActive && focusedPath.edgeIds.has(link.id);
      return inPath ? 2.4 : 1.4;
    },
    [activeEdgeId, focusedPath]
  );

  const linkDirectionalParticles = useCallback(
    (link: any) => {
      if (link.id === activeEdgeId) {
        return 8;
      }
      const isPathActive = focusedPath !== null;
      if (isPathActive) {
        return focusedPath.edgeIds.has(link.id) ? 3 : 0;
      }
      if (link.isCrossChain || (link.taintRatio && link.taintRatio >= 0.5)) {
        return 2;
      }
      return 1;
    },
    [activeEdgeId, focusedPath]
  );

  const linkDirectionalParticleSpeed = useCallback(
    (link: any) => {
      if (link.id === activeEdgeId) return 0.035;
      return 0.007;
    },
    [activeEdgeId]
  );

  return (
    <div ref={containerRef} className="w-full h-full relative overflow-hidden bg-white dark:bg-[#05080E]">
      {/* ───────────────────────────────────────────────────────────────────────────── */}
      {/* REAL-TIME INITIAL GRAPH BUILDING POP-UP (Only when wallet address is entered)  */}
      {/* ───────────────────────────────────────────────────────────────────────────── */}
      {isAnimating && (
        <div className="absolute top-4 left-1/2 -translate-x-1/2 z-20 flex items-center space-x-3 px-4 py-2 rounded-xl bg-white/95 dark:bg-[#0D131F]/95 border border-blue-500/40 dark:border-blue-500/30 backdrop-blur-md shadow-2xl text-xs font-mono">
          <span className="relative flex h-2.5 w-2.5 shrink-0">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-blue-400 opacity-75" />
            <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-blue-500" />
          </span>
          <span className="font-bold text-blue-600 dark:text-blue-400 uppercase tracking-wide text-[11px] shrink-0">
            Building Graph
          </span>
          <span className="text-slate-300 dark:text-[#334155] shrink-0">|</span>
          <span className="text-slate-700 dark:text-[#E2E8F0] font-medium truncate max-w-sm shrink-0">
            {currentStepDescription}
          </span>
          <span className="text-[10px] px-1.5 py-0.5 rounded bg-slate-100 dark:bg-[#1E293B] text-slate-500 dark:text-[#94A3B8] font-bold shrink-0">
            {currentStepIndex + 1}/{totalStepsCount}
          </span>
        </div>
      )}

      {/* Completion Toast (Shows briefly for 1.8s, then fades away completely) */}
      {showFinishedToast && !isAnimating && (
        <div className="absolute top-4 left-1/2 -translate-x-1/2 z-20 flex items-center space-x-2 px-4 py-2 rounded-xl bg-white/95 dark:bg-[#0D131F]/95 border border-emerald-500/40 backdrop-blur-md shadow-xl text-xs font-mono animate-fade-out">
          <CheckCircle2 className="h-4 w-4 text-emerald-500 shrink-0" />
          <span className="font-semibold text-slate-800 dark:text-[#F8FAFC]">
            Graph Built · {nodes3D.length} Nodes · {links3D.length} Transfers
          </span>
        </div>
      )}

      {/* Floating Action Strip (Camera Controls) */}
      <div className="absolute top-3 right-3 z-10 flex items-center space-x-1.5 p-1 rounded-lg bg-white/95 dark:bg-[#0D131F]/90 border border-slate-200 dark:border-[#1E293B] backdrop-blur-md shadow-lg text-[11px] font-mono text-slate-600 dark:text-[#94A3B8]">
        <button
          onClick={() => {
            onUpdateFocusedPath(null);
            onSelectElement(null);
            fgRef.current?.cameraPosition({ x: 0, y: 0, z: 420 }, { x: 0, y: 0, z: 0 }, 600);
          }}
          className="px-2 py-1 rounded hover:bg-slate-100 dark:hover:bg-[#1E293B] hover:text-slate-900 dark:hover:text-white flex items-center space-x-1 transition-colors"
          title="Reset Camera View"
        >
          <RotateCcw className="h-3 w-3" />
          <span>Reset</span>
        </button>

        <button
          onClick={() => fgRef.current?.zoomToFit(500, 80)}
          className="px-2 py-1 rounded hover:bg-slate-100 dark:hover:bg-[#1E293B] hover:text-slate-900 dark:hover:text-white flex items-center space-x-1 transition-colors"
          title="Auto-Fit Constellation"
        >
          <Sparkles className="h-3 w-3" />
          <span>Fit View</span>
        </button>

        <div className="h-3.5 w-px bg-slate-200 dark:bg-[#1E293B] mx-0.5" />

        <div className="px-2 py-1 flex items-center space-x-1 text-slate-500 dark:text-[#64748B]">
          <Lock className="h-3 w-3 text-emerald-500" />
          <span className="text-[10px] uppercase font-bold text-emerald-600 dark:text-emerald-400">Fixed Layout</span>
        </div>
      </div>

      <ForceGraph3D
        ref={fgRef}
        width={dimensions.width}
        height={dimensions.height}
        graphData={{ nodes: displayNodes, links: displayLinks }}
        backgroundColor={isDarkMode ? '#05080E' : '#FFFFFF'}
        nodeThreeObject={nodeThreeObject}
        nodeThreeObjectExtend={false}
        nodeLabel={(n: any) =>
          `<div style="font-family: monospace; font-size: 11px; padding: 4px 8px; background: rgba(13,19,31,0.92); border: 1px solid #1e293b; border-radius: 6px; color: #f8fafc;">
            <strong>${n.role}</strong><br/>
            <span style="color: #94a3b8;">${n.rawAddress}</span>
            ${n.vaspName ? `<br/><span style="color: #10b981;">VASP: ${n.vaspName}</span>` : ''}
          </div>`
        }
        onNodeHover={(node: any) => setHoveredNodeId(node ? node.id : null)}
        onNodeClick={handleNodeClick}
        onLinkClick={handleLinkClick}
        onBackgroundClick={handleBackgroundClick}
        onNodeDrag={handleNodeDrag}
        onNodeDragEnd={handleNodeDragEnd}
        linkColor={linkColor}
        linkWidth={linkWidth}
        linkDirectionalArrowLength={4.2}
        linkDirectionalArrowRelPos={0.92}
        linkDirectionalArrowColor={linkColor}
        linkDirectionalParticles={linkDirectionalParticles}
        linkDirectionalParticleSpeed={linkDirectionalParticleSpeed}
        linkDirectionalParticleWidth={2.0}
        linkDirectionalParticleColor={(link: any) =>
          link.id === activeEdgeId
            ? '#00FF9D'
            : link.isCrossChain
              ? '#A855F7'
              : link.taintRatio >= 0.8
                ? '#F43F5E'
                : link.taintRatio >= 0.4
                  ? '#F59E0B'
                  : '#6EFFC3'
        }
        cooldownTicks={0}
        enableNodeDrag={true}
        showNavInfo={false}
      />
    </div>
  );
};

export default GraphCanvas3D;
