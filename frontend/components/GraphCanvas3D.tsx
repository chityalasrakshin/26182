'use client';

import React, { useEffect, useRef, useState, useMemo, useCallback } from 'react';
import dynamic from 'next/dynamic';
import * as THREE from 'three';
import { GraphData } from '../lib/types';
import { RotateCcw, Sparkles, Lock, Unlock, Play, Pause } from 'lucide-react';

// Dynamically import react-force-graph-3d to disable SSR
const ForceGraph3D = dynamic(() => import('react-force-graph-3d'), {
  ssr: false,
  loading: () => (
    <div className="w-full h-full flex items-center justify-center font-mono text-xs text-slate-500 dark:text-slate-400">
      <div className="flex items-center space-x-2">
        <div className="w-2 h-2 rounded-full bg-blue-500 animate-ping" />
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
  onFitRef?: React.MutableRefObject<(() => void) | null>;
  onResetRef?: React.MutableRefObject<(() => void) | null>;
  onZoomInRef?: React.MutableRefObject<(() => void) | null>;
  onZoomOutRef?: React.MutableRefObject<(() => void) | null>;
}

// ─────────────────────────────────────────────────────────────────────────────
// Deterministic 3D Spatial Layout Engine (Zero Jitter, Pure Stationary Nodes)
// ─────────────────────────────────────────────────────────────────────────────
function applyDeterministicLayout(nodes: any[], layoutMode: string) {
  if (nodes.length === 0) return;

  if (layoutMode === 'flow') {
    // True Left-to-Right Directional Flow
    // Hop 0 (Target) on the far left, cascading rightward to Hop 1, Hop 2, and VASP endpoints
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
          // Spread in an open ellipse across Y and Z
          const angle = (i / count) * 2 * Math.PI;
          const y = Math.sin(angle) * radius;
          const z = Math.cos(angle) * (radius * 0.7);
          node.x = x;
          node.y = y;
          node.z = z;
          // Pin coordinates so nodes stay 100% stationary!
          node.fx = x;
          node.fy = y;
          node.fz = z;
        });
      }
    });
  } else if (layoutMode === 'radial') {
    // Concentric 3D Spheres Expanding from Center
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
          // Golden ratio spherical distribution
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
    // Top-to-Bottom Peeling Chain Waterfall
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
      // Fixed so they don't wander endlessly
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
  viewMode,
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
  const [isPhysicsActive, setIsPhysicsActive] = useState<boolean>(false);

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
  const { nodes3D, links3D } = useMemo(() => {
    if (!graphData?.nodes || graphData.nodes.length === 0) {
      return { nodes3D: [], links3D: [] };
    }

    const rawNodes = graphData.nodes;
    const rawEdges = graphData.edges || [];

    // Map & normalize nodes
    const nodeMap = new Map<string, any>();
    rawNodes.forEach((n: any) => {
      const d = n.data || n;
      const nodeId = (d.id || d.address || '').toLowerCase();
      if (!nodeId) return;

      const isRoot =
        d.role === 'INPUT_WALLET' ||
        d.is_root ||
        d.hop === 0 ||
        nodeId === rootAddress.toLowerCase();
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
        // Payload preserved exactly for inspector drawer
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
        // Edge data payload preserved for inspector drawer
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
    // Apply deterministic initial coordinates and pin them so nodes stay stationary!
    applyDeterministicLayout(nodeArray, layoutMode);

    return {
      nodes3D: nodeArray,
      links3D: validLinks,
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
  // Damped OrbitControls & Auto-Fit Camera Framing
  // ─────────────────────────────────────────────────────────────────────────────
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

    // Auto-fit camera framing with comfortable margin
    const timer = setTimeout(() => {
      fg.zoomToFit(500, 85);
    }, 250);

    return () => clearTimeout(timer);
  }, [nodes3D, layoutMode]);

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

      // Smooth camera transition to focus node
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

  // Handle Dragging: updates pinned coordinates so node stays where user moves it
  const handleNodeDrag = useCallback((node: any) => {
    node.fx = node.x;
    node.fy = node.y;
    node.fz = node.z;
  }, []);

  const handleNodeDragEnd = useCallback((node: any) => {
    // Lock in new position
    node.fx = node.x;
    node.fy = node.y;
    node.fz = node.z;
  }, []);

  // ─────────────────────────────────────────────────────────────────────────────
  // Custom 3D Node Mesh & Clean Billboarding Labels (Mind Map Constellation Style)
  // ─────────────────────────────────────────────────────────────────────────────
  const nodeThreeObject = useCallback(
    (node: any) => {
      const group = new THREE.Group();
      const isPathActive = focusedPath !== null;
      const isInPath = isPathActive ? focusedPath.nodeIds.has(node.id) : true;
      const opacity = isInPath ? 1.0 : 0.15;
      const isDimmed = isPathActive && !isInPath;
      const isHovered = hoveredNodeId === node.id;
      const isSelected = selectedElement?.type === 'NODE' && selectedElement.data?.id === node.id;

      let primaryMesh: THREE.Mesh;
      let haloColor = 0x3b82f6;
      let nodeRadius = 4.5;

      switch (node.tag) {
        case 'target': {
          nodeRadius = 6.2; // Modest, elegant size (1.4x of regular nodes)
          haloColor = 0xef4444;
          const geo = new THREE.SphereGeometry(nodeRadius, 24, 24);
          const mat = new THREE.MeshStandardMaterial({
            color: isDimmed ? 0x475569 : 0xef4444,
            emissive: isDimmed ? 0x000000 : 0xb91c1c,
            emissiveIntensity: isDimmed ? 0 : 0.9,
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
            emissive: isDimmed ? 0x000000 : 0x059669,
            emissiveIntensity: isDimmed ? 0 : 0.8,
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
            emissive: isDimmed ? 0x000000 : 0x581c87,
            emissiveIntensity: isDimmed ? 0 : 0.85,
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
            emissive: isDimmed ? 0x000000 : 0x7f1d1d,
            emissiveIntensity: isDimmed ? 0 : 0.95,
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
            emissive: isDimmed ? 0x000000 : 0x4338ca,
            emissiveIntensity: isDimmed ? 0 : 0.85,
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
              : isHop1
                ? 0x1d4ed8
                : isDarkMode
                  ? 0x1e293b
                  : 0x475569,
            emissiveIntensity: isDimmed ? 0 : isHop1 ? 0.6 : 0.25,
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

      // Luminous celestial glow halo (matching reference Mind Map aesthetic)
      if (!isDimmed) {
        const auraGeo = new THREE.SphereGeometry(nodeRadius * 1.45, 16, 16);
        const auraMat = new THREE.MeshBasicMaterial({
          color: haloColor,
          transparent: true,
          opacity: isSelected ? 0.45 : isHovered ? 0.35 : 0.22,
          side: THREE.BackSide,
          blending: THREE.AdditiveBlending,
        });
        group.add(new THREE.Mesh(auraGeo, auraMat));
      }

      // Minimal, clean label (single-word badge, no giant white boxes)
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

        // If hovered or selected, show address snippet as well
        if (isHovered || isSelected) {
          const shortAddr = `${node.rawAddress.slice(0, 5)}...${node.rawAddress.slice(-3)}`;
          labelText = `${labelText} (${shortAddr})`;
        }

        const sprite = new SpriteTextClass(labelText);
        sprite.color = isDarkMode ? '#F8FAFC' : '#0F172A';
        sprite.textHeight = 2.4;
        sprite.fontFace = 'JetBrains Mono, monospace';
        sprite.fontWeight = '700';
        sprite.backgroundColor = isDarkMode ? 'rgba(5, 8, 14, 0.8)' : 'rgba(255, 255, 255, 0.9)';
        sprite.borderColor = isDarkMode ? 'rgba(30, 41, 59, 0.8)' : 'rgba(203, 213, 225, 0.85)';
        sprite.borderWidth = 0.3;
        sprite.borderRadius = 2.5;
        sprite.padding = 1.2;
        sprite.position.y = -(nodeRadius + 3.2);
        group.add(sprite);
      }

      return group;
    },
    [SpriteTextClass, focusedPath, isDarkMode, hoveredNodeId, selectedElement]
  );

  // ─────────────────────────────────────────────────────────────────────────────
  // Dynamic Link Color & Width Mapping (Taint & Path Highlighting)
  // ─────────────────────────────────────────────────────────────────────────────
  const linkColor = useCallback(
    (link: any) => {
      const isPathActive = focusedPath !== null;
      if (isPathActive) {
        const inPath = focusedPath.edgeIds.has(link.id);
        return inPath ? '#6EFFC3' : isDarkMode ? 'rgba(51, 65, 85, 0.12)' : 'rgba(148, 163, 184, 0.12)';
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
    [focusedPath, isDarkMode]
  );

  const linkWidth = useCallback(
    (link: any) => {
      const isPathActive = focusedPath !== null;
      const inPath = isPathActive && focusedPath.edgeIds.has(link.id);
      return inPath ? 2.2 : 1.4;
    },
    [focusedPath]
  );

  const linkDirectionalParticles = useCallback(
    (link: any) => {
      const isPathActive = focusedPath !== null;
      if (isPathActive) {
        return focusedPath.edgeIds.has(link.id) ? 3 : 0;
      }
      if (link.isCrossChain || (link.taintRatio && link.taintRatio >= 0.5)) {
        return 2;
      }
      return 1;
    },
    [focusedPath]
  );

  return (
    <div ref={containerRef} className="w-full h-full relative overflow-hidden bg-white dark:bg-[#05080E]">
      {/* Floating Action Strip (Mind Map Controls) */}
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
          <span className="text-[10px] uppercase font-bold text-emerald-600 dark:text-emerald-400">Fixed Nodes</span>
        </div>
      </div>

      <ForceGraph3D
        ref={fgRef}
        width={dimensions.width}
        height={dimensions.height}
        graphData={{ nodes: nodes3D, links: links3D }}
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
        // Explicit 3D Directional Arrows pointing from source to target
        linkDirectionalArrowLength={4.2}
        linkDirectionalArrowRelPos={0.92}
        linkDirectionalArrowColor={linkColor}
        // Animated photon particles traveling in direction of fund flow
        linkDirectionalParticles={linkDirectionalParticles}
        linkDirectionalParticleSpeed={0.007}
        linkDirectionalParticleWidth={1.8}
        linkDirectionalParticleColor={(link: any) =>
          link.isCrossChain
            ? '#A855F7'
            : link.taintRatio >= 0.8
              ? '#F43F5E'
              : link.taintRatio >= 0.4
                ? '#F59E0B'
                : '#6EFFC3'
        }
        cooldownTicks={0} // Zero ongoing physics drift: nodes are locked solid!
        enableNodeDrag={true}
        showNavInfo={false}
      />
    </div>
  );
};
export default GraphCanvas3D;
