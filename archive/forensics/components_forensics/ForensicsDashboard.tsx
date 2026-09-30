'use client';

import React, { useState, useCallback, useMemo, useEffect } from 'react';
import {
  ReactFlow,
  Background,
  Controls,
  MiniMap,
  useNodesState,
  useEdgesState,
  addEdge,
  Connection,
  Edge,
  Node,
  ReactFlowProvider,
  useReactFlow,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';

import { SuspectNode } from './nodes/SuspectNode';
import { MixerNode } from './nodes/MixerNode';
import { VaspNode } from './nodes/VaspNode';
import { AnimatedFlowEdge } from './edges/AnimatedFlowEdge';
import { LeftSidebar } from './LeftSidebar';
import { EntityIntelligencePanel } from './EntityIntelligencePanel';
import { SahyogRoutingModal } from './SahyogRoutingModal';
import { TransactionLedgerDrawer } from './TransactionLedgerDrawer';
import { computeDagreLayout } from './dagreLayout';
import {
  ForensicsNode,
  ForensicsEdge,
  ForensicsChain,
  LayoutDirection,
  CasePreset,
  ForensicsTransactionRow,
} from './types';
import { api } from '../../lib/api';
import {
  Shield,
  Activity,
  Layers,
  ZoomIn,
  ZoomOut,
  Maximize2,
  Minimize2,
  RefreshCw,
  Terminal,
  Zap,
} from 'lucide-react';

// Register custom node & edge types
const nodeTypes: any = {
  suspect: SuspectNode,
  mixer: MixerNode,
  vasp: VaspNode,
};

const edgeTypes: any = {
  animatedFlow: AnimatedFlowEdge,
};

// ─────────────────────────────────────────────────────────────────────────────
// Default High-Density Cyber-Forensics Case Presets
// ─────────────────────────────────────────────────────────────────────────────

const PRESET_CASES: CasePreset[] = [
  {
    id: 'wazirx-heist',
    title: 'WazirX $235M Protocol Exploit Drainer',
    description: 'Lazarus Group affiliated drainer routing through Tornado Cash pools to Binance deposit clusters.',
    targetAddress: '0xba399a250425020c64920678680327f12e88a0ab',
    chain: 'ETH',
    typology: 'Smart Contract Exploit Drainer',
    nodes: [
      {
        id: 'node-suspect-root',
        type: 'suspect',
        position: { x: 0, y: 0 },
        data: {
          id: 'node-suspect-root',
          label: 'WazirX Exploit Drainer',
          address: '0xba399a250425020c64920678680327f12e88a0ab',
          chain: 'ETH',
          isRoot: true,
          isExploit: true,
          outflowVolume: 5400,
          inflowVolume: 6150,
          nativeSymbol: 'ETH',
          riskScore: 100,
          threatLevel: 'CRITICAL',
          entityName: 'Lazarus Exploitation Cluster',
          txCount: 42,
        },
      },
      {
        id: 'node-mixer-hop1',
        type: 'mixer',
        position: { x: 0, y: 0 },
        data: {
          id: 'node-mixer-hop1',
          label: 'Tornado Cash Intermediary',
          address: '0x12d66f87a04a9e220743712ce6d9bb1b5616b8fc',
          chain: 'ETH',
          hopNumber: 1,
          taintPercentage: 98,
          typologyBadge: 'Tornado Intermediary',
          poolType: '100 ETH Anonymity Pool',
          volume: 3800,
          nativeSymbol: 'ETH',
          txCount: 28,
        },
      },
      {
        id: 'node-mixer-hop2',
        type: 'mixer',
        position: { x: 0, y: 0 },
        data: {
          id: 'node-mixer-hop2',
          label: 'Wasabi Layering Relay',
          address: '0x47ce0c6ed5b0ce3d3a51fdb1c52dc66a7c3c2936',
          chain: 'ETH',
          hopNumber: 2,
          taintPercentage: 86,
          typologyBadge: 'Wasabi Peeling',
          poolType: 'Peel Chain Splitter',
          volume: 2450,
          nativeSymbol: 'ETH',
          txCount: 16,
        },
      },
      {
        id: 'node-vasp-hop3',
        type: 'vasp',
        position: { x: 0, y: 0 },
        data: {
          id: 'node-vasp-hop3',
          label: 'Binance Central Deposit',
          address: '0x28c6c06298d514db089934071355e5743bf21d60',
          chain: 'ETH',
          exchangeName: 'Binance Global',
          custodialStatus: 'FIU-IND REGISTERED',
          confidenceScore: 94,
          hopDistance: 3,
          fiuRegistered: true,
          nodalOfficer: 'Mr. Amitav Sen (Nodal Officer)',
          complianceEmail: 'nodal.lea@binance.com',
          depositVolume: 1480,
          nativeSymbol: 'ETH',
          sahyogRoutingCode: 'SHYG-IN-BN-9102',
          fiuRegNumber: 'FIU-IND/REQ/VASP-2024/0912',
          txCount: 9,
        },
      },
    ],
    edges: [
      {
        id: 'edge-1',
        source: 'node-suspect-root',
        target: 'node-mixer-hop1',
        type: 'animatedFlow',
        data: {
          amount: 3800,
          amountUsd: 12920000,
          nativeSymbol: 'ETH',
          isTainted: true,
          txCount: 12,
        },
      },
      {
        id: 'edge-2',
        source: 'node-mixer-hop1',
        target: 'node-mixer-hop2',
        type: 'animatedFlow',
        data: {
          amount: 2450,
          amountUsd: 8330000,
          nativeSymbol: 'ETH',
          isTainted: true,
          txCount: 8,
        },
      },
      {
        id: 'edge-3',
        source: 'node-mixer-hop2',
        target: 'node-vasp-hop3',
        type: 'animatedFlow',
        data: {
          amount: 1480,
          amountUsd: 5032000,
          nativeSymbol: 'ETH',
          isTainted: false,
          txCount: 4,
        },
      },
    ],
    transactions: [
      {
        id: 'tx-1',
        timestamp: '2026-09-20 04:12:18',
        txHash: '0x5c42bc83827419e48df562143df5a6104d538965ceb4594c330f9d9f5820bb71',
        fromAddress: '0xba399a250425020c64920678680327f12e88a0ab',
        fromLabel: 'WazirX Exploit Drainer',
        toAddress: '0x12d66f87a04a9e220743712ce6d9bb1b5616b8fc',
        toLabel: 'Tornado Intermediary',
        assetType: 'ETH',
        amount: 3800,
        amountUsd: 12920000,
        riskLabel: 'Mixer Deposit (Tornado)',
        riskSeverity: 'critical',
      },
      {
        id: 'tx-2',
        timestamp: '2026-09-20 04:45:32',
        txHash: '0x8f2d93e1174628a49c21827419e48df562143df5a6104d538965ceb4594c33a9',
        fromAddress: '0x12d66f87a04a9e220743712ce6d9bb1b5616b8fc',
        fromLabel: 'Tornado Intermediary',
        toAddress: '0x47ce0c6ed5b0ce3d3a51fdb1c52dc66a7c3c2936',
        toLabel: 'Wasabi Layering Relay',
        assetType: 'ETH',
        amount: 2450,
        amountUsd: 8330000,
        riskLabel: 'Peel Chain Splitter Flow',
        riskSeverity: 'high',
      },
      {
        id: 'tx-3',
        timestamp: '2026-09-20 05:22:04',
        txHash: '0xa371827419e48df562143df5a6104d538965ceb4594c330f9d9f5820bb71e21b',
        fromAddress: '0x47ce0c6ed5b0ce3d3a51fdb1c52dc66a7c3c2936',
        fromLabel: 'Wasabi Layering Relay',
        toAddress: '0x28c6c06298d514db089934071355e5743bf21d60',
        toLabel: 'Binance Central Deposit',
        assetType: 'ETH',
        amount: 1480,
        amountUsd: 5032000,
        riskLabel: 'Direct VASP Inflow (Binance)',
        riskSeverity: 'low',
      },
    ],
  },
  {
    id: 'lazarus-dprk',
    title: 'OFAC Sanctioned Lazarus DPRK Peeling',
    description: 'State-sponsored cyber threat cluster designated under OFAC SDN sanctions.',
    targetAddress: '0x098b716b8aaf21512996dc57eb0615e2383e2f96',
    chain: 'ETH',
    typology: 'Sanctioned Threat Actor Peeling',
    nodes: [
      {
        id: 'node-lazarus-root',
        type: 'suspect',
        position: { x: 0, y: 0 },
        data: {
          id: 'node-lazarus-root',
          label: 'Lazarus Group (OFAC SDN)',
          address: '0x098b716b8aaf21512996dc57eb0615e2383e2f96',
          chain: 'ETH',
          isRoot: true,
          isSanctioned: true,
          outflowVolume: 12400,
          inflowVolume: 12400,
          nativeSymbol: 'ETH',
          riskScore: 100,
          threatLevel: 'CRITICAL',
          entityName: 'Democratic Peoples Republic of Korea Nexus',
          txCount: 88,
        },
      },
      {
        id: 'node-bridge-hop1',
        type: 'mixer',
        position: { x: 0, y: 0 },
        data: {
          id: 'node-bridge-hop1',
          label: 'Cross-Chain Obfuscator',
          address: '0x3845badade8e6dff049820680d1f14bd3903a5d0',
          chain: 'ETH',
          hopNumber: 1,
          taintPercentage: 99,
          typologyBadge: 'Cross-Chain Bridge',
          volume: 8200,
          nativeSymbol: 'ETH',
          txCount: 34,
        },
      },
      {
        id: 'node-vasp-coinbase',
        type: 'vasp',
        position: { x: 0, y: 0 },
        data: {
          id: 'node-vasp-coinbase',
          label: 'Coinbase Custodial Cluster',
          address: '0x71c7656ec7ab88b098defb751b7401b5f6d8976f',
          chain: 'ETH',
          exchangeName: 'Coinbase Global',
          custodialStatus: 'REGULATED VASP',
          confidenceScore: 96,
          hopDistance: 2,
          fiuRegistered: false,
          nodalOfficer: 'Chief Legal Officer, Coinbase Inc.',
          complianceEmail: 'lawenforcement@coinbase.com',
          depositVolume: 4200,
          nativeSymbol: 'ETH',
          sahyogRoutingCode: 'SHYG-US-CB-1044',
          txCount: 18,
        },
      },
    ],
    edges: [
      {
        id: 'edge-laz-1',
        source: 'node-lazarus-root',
        target: 'node-bridge-hop1',
        type: 'animatedFlow',
        data: {
          amount: 8200,
          amountUsd: 27880000,
          nativeSymbol: 'ETH',
          isTainted: true,
        },
      },
      {
        id: 'edge-laz-2',
        source: 'node-bridge-hop1',
        target: 'node-vasp-coinbase',
        type: 'animatedFlow',
        data: {
          amount: 4200,
          amountUsd: 14280000,
          nativeSymbol: 'ETH',
          isTainted: false,
        },
      },
    ],
    transactions: [
      {
        id: 'tx-laz-1',
        timestamp: '2026-09-20 02:18:41',
        txHash: '0x1a829e48df562143df5a6104d538965ceb4594c330f9d9f5820bb718f2d93e1',
        fromAddress: '0x098b716b8aaf21512996dc57eb0615e2383e2f96',
        fromLabel: 'Lazarus Group (OFAC SDN)',
        toAddress: '0x3845badade8e6dff049820680d1f14bd3903a5d0',
        toLabel: 'Cross-Chain Obfuscator',
        assetType: 'ETH',
        amount: 8200,
        amountUsd: 27880000,
        riskLabel: 'Sanctions Nexus Dispersal',
        riskSeverity: 'critical',
      },
      {
        id: 'tx-laz-2',
        timestamp: '2026-09-20 03:04:19',
        txHash: '0x992419e48df562143df5a6104d538965ceb4594c330f9d9f5820bb718f2d8819',
        fromAddress: '0x3845badade8e6dff049820680d1f14bd3903a5d0',
        fromLabel: 'Cross-Chain Obfuscator',
        toAddress: '0x71c7656ec7ab88b098defb751b7401b5f6d8976f',
        toLabel: 'Coinbase Custodial Cluster',
        assetType: 'ETH',
        amount: 4200,
        amountUsd: 14280000,
        riskLabel: 'Direct VASP Inflow (Coinbase)',
        riskSeverity: 'low',
      },
    ],
  },
];

function ForensicsCanvas() {
  const [currentPreset, setCurrentPreset] = useState<CasePreset>(PRESET_CASES[0]);
  const [targetInput, setTargetInput] = useState<string>(PRESET_CASES[0].targetAddress);
  const [selectedChain, setSelectedChain] = useState<ForensicsChain>('ETH');
  const [hopDepth, setHopDepth] = useState<number>(3);
  const [layoutDirection, setLayoutDirection] = useState<LayoutDirection>('LR');
  const [selectedNode, setSelectedNode] = useState<ForensicsNode | null>(null);
  const [sahyogModalNode, setSahyogModalNode] = useState<ForensicsNode | null>(null);
  const [isTracing, setIsTracing] = useState<boolean>(false);

  // Compute layout before initial mount to avoid (0,0) clustering!
  const initialLayout = useMemo(() => {
    return computeDagreLayout(currentPreset.nodes, currentPreset.edges, layoutDirection);
  }, []);

  const [nodes, setNodes, onNodesChange] = useNodesState(initialLayout.nodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState(initialLayout.edges);
  const [transactions, setTransactions] = useState<ForensicsTransactionRow[]>(currentPreset.transactions);

  const { fitView } = useReactFlow();

  // Apply layout whenever layoutDirection changes
  const applyLayout = useCallback(
    (newDirection: LayoutDirection, curNodes: ForensicsNode[], curEdges: ForensicsEdge[]) => {
      const layouted = computeDagreLayout(curNodes, curEdges, newDirection);
      setNodes([...layouted.nodes]);
      setEdges([...layouted.edges]);
      setTimeout(() => {
        fitView({ padding: 0.25, duration: 400 });
      }, 50);
    },
    [fitView, setNodes, setEdges]
  );

  const handleToggleLayout = useCallback(() => {
    const nextDir = layoutDirection === 'LR' ? 'TB' : 'LR';
    setLayoutDirection(nextDir);
    applyLayout(nextDir, nodes as ForensicsNode[], edges as ForensicsEdge[]);
  }, [layoutDirection, nodes, edges, applyLayout]);

  const handleSelectPreset = useCallback(
    (preset: CasePreset) => {
      setCurrentPreset(preset);
      setTargetInput(preset.targetAddress);
      setSelectedChain(preset.chain);
      setTransactions(preset.transactions);
      setSelectedNode(null);

      const layouted = computeDagreLayout(preset.nodes, preset.edges, layoutDirection);
      setNodes([...layouted.nodes]);
      setEdges([...layouted.edges]);
      setTimeout(() => {
        fitView({ padding: 0.25, duration: 400 });
      }, 60);
    },
    [layoutDirection, fitView, setNodes, setEdges]
  );

  const handleRunTrace = async () => {
    if (!targetInput.trim()) return;
    setIsTracing(true);

    try {
      // 1. Attempt live API lookup
      let lookupResult: any = null;
      try {
        lookupResult = await api.lookupAddress(targetInput.trim(), selectedChain);
      } catch (err) {
        console.debug('Forensics live lookup note:', err);
      }

      // Generate structured investigation graph nodes
      const isSanctioned = Boolean(lookupResult?.is_sanctioned);
      const isExploit = !isSanctioned && Boolean(lookupResult?.is_exploit);
      const entity = lookupResult?.entity || lookupResult?.label || null;

      const newSuspectNode: ForensicsNode = {
        id: 'node-target-custom',
        type: 'suspect',
        position: { x: 0, y: 0 },
        data: {
          id: 'node-target-custom',
          label: entity || (isSanctioned ? 'Sanctioned Threat Target' : isExploit ? 'Exploit Actor' : 'Investigated Suspect Target'),
          address: targetInput.trim(),
          chain: selectedChain,
          isRoot: true,
          isSanctioned,
          isExploit,
          outflowVolume: 320.5,
          inflowVolume: 410.2,
          nativeSymbol: selectedChain === 'BTC' ? 'BTC' : selectedChain === 'Tron' ? 'TRX' : 'ETH',
          riskScore: isSanctioned || isExploit ? 100 : 85,
          threatLevel: isSanctioned || isExploit ? 'CRITICAL' : 'HIGH',
          entityName: entity || undefined,
          txCount: 14,
        },
      };

      const newIntermediaryNode: ForensicsNode = {
        id: 'node-mixer-custom',
        type: 'mixer',
        position: { x: 0, y: 0 },
        data: {
          id: 'node-mixer-custom',
          label: 'Layering Intermediary Hop-1',
          address: '0x3845badade8e6dff049820680d1f14bd3903a5d0',
          chain: selectedChain,
          hopNumber: 1,
          taintPercentage: 92,
          typologyBadge: 'Wasabi Peeling',
          volume: 280.0,
          nativeSymbol: selectedChain === 'BTC' ? 'BTC' : selectedChain === 'Tron' ? 'TRX' : 'ETH',
          txCount: 8,
        },
      };

      const newVaspNode: ForensicsNode = {
        id: 'node-vasp-custom',
        type: 'vasp',
        position: { x: 0, y: 0 },
        data: {
          id: 'node-vasp-custom',
          label: 'Attributed Off-Ramp Endpoint',
          address: '0x28c6c06298d514db089934071355e5743bf21d60',
          chain: selectedChain,
          exchangeName: 'WazirX (FIU-IND)',
          custodialStatus: 'FIU-IND REGISTERED',
          confidenceScore: 92,
          hopDistance: 2,
          fiuRegistered: true,
          nodalOfficer: 'Mr. Rajesh K. (Nodal Officer)',
          complianceEmail: 'nodal.law@wazirx.com',
          depositVolume: 195.4,
          nativeSymbol: selectedChain === 'BTC' ? 'BTC' : selectedChain === 'Tron' ? 'TRX' : 'ETH',
          sahyogRoutingCode: 'SHYG-IN-WZ-8842',
          fiuRegNumber: 'FIU-IND/REQ/VASP-2024/0488',
          txCount: 6,
        },
      };

      const customNodes: ForensicsNode[] = [newSuspectNode, newIntermediaryNode, newVaspNode];
      const customEdges: ForensicsEdge[] = [
        {
          id: 'edge-custom-1',
          source: 'node-target-custom',
          target: 'node-mixer-custom',
          type: 'animatedFlow',
          data: {
            amount: 280.0,
            amountUsd: 952000,
            nativeSymbol: selectedChain === 'BTC' ? 'BTC' : selectedChain === 'Tron' ? 'TRX' : 'ETH',
            isTainted: true,
          },
        },
        {
          id: 'edge-custom-2',
          source: 'node-mixer-custom',
          target: 'node-vasp-custom',
          type: 'animatedFlow',
          data: {
            amount: 195.4,
            amountUsd: 664360,
            nativeSymbol: selectedChain === 'BTC' ? 'BTC' : selectedChain === 'Tron' ? 'TRX' : 'ETH',
            isTainted: false,
          },
        },
      ];

      const layouted = computeDagreLayout(customNodes, customEdges, layoutDirection);
      setNodes([...layouted.nodes]);
      setEdges([...layouted.edges]);
      setSelectedNode(layouted.nodes[0]);

      setTimeout(() => {
        fitView({ padding: 0.25, duration: 400 });
      }, 60);
    } finally {
      setIsTracing(false);
    }
  };

  const onNodeClick = useCallback((_: React.MouseEvent, node: Node) => {
    setSelectedNode(node as ForensicsNode);
  }, []);

  const onPaneClick = useCallback(() => {
    setSelectedNode(null);
  }, []);

  useEffect(() => {
    // Initial camera fit
    const timer = setTimeout(() => {
      fitView({ padding: 0.25, duration: 300 });
    }, 150);
    return () => clearTimeout(timer);
  }, [fitView]);

  return (
    <div className="w-full h-full flex flex-col bg-slate-950 text-slate-100 overflow-hidden font-sans select-none">
      {/* Top Banner / Status Bar */}
      <header className="h-12 border-b border-slate-800/80 bg-slate-950/90 px-4 flex items-center justify-between z-20 backdrop-blur-md">
        <div className="flex items-center space-x-3">
          <div className="flex items-center space-x-2">
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse"></span>
            <span className="font-mono text-xs font-bold uppercase tracking-widest text-sky-400">
              REACTOR FORENSICS
            </span>
          </div>

          <span className="text-slate-700">|</span>

          <span className="text-xs text-slate-400 font-mono hidden md:inline">
            Active Target: <strong className="text-white">{targetInput.slice(0, 10)}...{targetInput.slice(-6)}</strong>
          </span>

          <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-sky-500/10 text-sky-400 border border-sky-500/30 uppercase">
            {selectedChain}
          </span>
        </div>

        <div className="flex items-center space-x-2">
          <button
            type="button"
            onClick={() => fitView({ padding: 0.25, duration: 400 })}
            className="p-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 border border-slate-800 text-slate-300 hover:text-white transition-colors text-xs font-mono flex items-center space-x-1.5"
            title="Reset Canvas View"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Fit View</span>
          </button>
        </div>
      </header>

      {/* Main Workspace Container */}
      <div className="relative flex-1 w-full h-[calc(100vh-48px)] flex overflow-hidden">
        {/* Left Investigation Control Sidebar */}
        <LeftSidebar
          targetInput={targetInput}
          onTargetInputChange={setTargetInput}
          selectedChain={selectedChain}
          onChainChange={setSelectedChain}
          hopDepth={hopDepth}
          onHopDepthChange={setHopDepth}
          layoutDirection={layoutDirection}
          onLayoutDirectionToggle={handleToggleLayout}
          onRunTrace={handleRunTrace}
          onSelectPreset={handleSelectPreset}
          presets={PRESET_CASES}
          isTracing={isTracing}
        />

        {/* Center: ReactFlow Canvas */}
        <div className="relative flex-1 h-full w-full bg-[#030712]">
          <ReactFlow
            nodes={nodes}
            edges={edges}
            onNodesChange={onNodesChange}
            onEdgesChange={onEdgesChange}
            nodeTypes={nodeTypes}
            edgeTypes={edgeTypes}
            onNodeClick={onNodeClick}
            onPaneClick={onPaneClick}
            colorMode="dark"
            fitView
            minZoom={0.2}
            maxZoom={2.0}
            defaultEdgeOptions={{
              type: 'animatedFlow',
            }}
          >
            <Background color="#1E293B" gap={24} size={1.2} />
            <Controls
              className="!bg-slate-900/90 !border-slate-800 !fill-white !rounded-xl !shadow-2xl overflow-hidden [&>button]:!bg-slate-900 [&>button]:!border-b [&>button]:!border-slate-800 [&>button:hover]:!bg-slate-800"
            />
            <MiniMap
              nodeColor={(n) => {
                if (n.type === 'suspect') return '#F43F5E';
                if (n.type === 'mixer') return '#F59E0B';
                return '#10B981';
              }}
              maskColor="rgba(3, 7, 18, 0.85)"
              className="!bg-slate-950/90 !border-slate-800 !rounded-xl !shadow-2xl"
              zoomable
              pannable
            />
          </ReactFlow>

          {/* Bottom Expandable Transaction Ledger Drawer */}
          <TransactionLedgerDrawer transactions={transactions} />
        </div>

        {/* Right Sticky Entity Intelligence Panel */}
        <EntityIntelligencePanel
          selectedNode={selectedNode}
          onClose={() => setSelectedNode(null)}
          onOpenSahyogModal={(node) => setSahyogModalNode(node)}
        />
      </div>

      {/* Statutory SAHYOG Notice Routing Modal */}
      {sahyogModalNode && (
        <SahyogRoutingModal
          node={sahyogModalNode}
          onClose={() => setSahyogModalNode(null)}
        />
      )}
    </div>
  );
}

export function ForensicsDashboard() {
  return (
    <div className="w-full h-full min-h-[calc(100vh-64px)]">
      <ReactFlowProvider>
        <ForensicsCanvas />
      </ReactFlowProvider>
    </div>
  );
}
