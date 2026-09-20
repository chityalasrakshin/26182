'use client';

import React, { useMemo, useState } from 'react';
import { GraphData, Attribution } from '../lib/types';
import { Layers, Building2, TrendingUp, ShieldCheck, Wallet } from 'lucide-react';

interface SankeyFlowViewProps {
  graphData?: GraphData | null;
  rootAddress: string;
  attributions?: Attribution[];
  onSelectAddress?: (address: string) => void;
}

interface FlowColumnNode {
  id: string;
  label: string;
  role: string;
  vaspName?: string;
  hop: number;
  inflow: number;
  outflow: number;
  totalVolume: number;
  percentage: number;
}

export const SankeyFlowView: React.FC<SankeyFlowViewProps> = ({
  graphData,
  rootAddress,
  attributions,
  onSelectAddress
}) => {
  const [hoveredNode, setHoveredNode] = useState<string | null>(null);

  const { columns, flows, totalRootVolume } = useMemo(() => {
    if (!graphData || !graphData.nodes || graphData.nodes.length === 0) {
      return { columns: [], flows: [], totalRootVolume: 0 };
    }

    const hop0Nodes: FlowColumnNode[] = [];
    const hop1Nodes: FlowColumnNode[] = [];
    const hop2Nodes: FlowColumnNode[] = [];
    const vaspNodes: FlowColumnNode[] = [];

    // Calculate total root outflow
    let rootOutflow = 0;
    (graphData.edges || []).forEach((edgeItem: any) => {
      const e = edgeItem.data || edgeItem;
      const src = (e.source || '').toLowerCase();
      if (src === rootAddress.toLowerCase()) {
        rootOutflow += Number(e.amount_usd) || Number(e.amount) || 1;
      }
    });
    if (rootOutflow === 0) rootOutflow = 100;

    (graphData.nodes || []).forEach((nodeItem: any) => {
      const n = nodeItem.data || nodeItem;
      const nid = n.id || n.address || '';
      const isRoot = nid.toLowerCase() === rootAddress.toLowerCase() || n.role === 'INPUT_WALLET' || n.is_root;
      const isVasp = n.role === 'KNOWN_VASP' || !!n.vasp_name;
      const hop = Number(n.hop ?? n.hop_distance ?? (isRoot ? 0 : 1));

      // Calculate node inflows and outflows
      let inflow = 0;
      let outflow = 0;
      (graphData.edges || []).forEach((edgeItem: any) => {
        const e = edgeItem.data || edgeItem;
        const amt = Number(e.amount_usd) || Number(e.amount) || 0;
        if ((e.target || '').toLowerCase() === nid.toLowerCase()) inflow += amt;
        if ((e.source || '').toLowerCase() === nid.toLowerCase()) outflow += amt;
      });

      const totalVolume = Math.max(inflow, outflow);

      const nodeObj: FlowColumnNode = {
        id: nid,
        label: n.label || nid.slice(0, 8),
        role: n.role || (isVasp ? 'KNOWN_VASP' : 'INTERMEDIARY'),
        vaspName: n.vasp_name,
        hop,
        inflow,
        outflow,
        totalVolume,
        percentage: 0
      };

      if (isRoot) {
        nodeObj.percentage = 100;
        hop0Nodes.push(nodeObj);
      } else if (isVasp) {
        nodeObj.percentage = Math.min(100, (inflow / rootOutflow) * 100);
        vaspNodes.push(nodeObj);
      } else if (hop === 1) {
        nodeObj.percentage = Math.min(100, (totalVolume / rootOutflow) * 100);
        hop1Nodes.push(nodeObj);
      } else {
        nodeObj.percentage = Math.min(100, (totalVolume / rootOutflow) * 100);
        hop2Nodes.push(nodeObj);
      }
    });

    // Prepare flow lines
    const flowList = (graphData.edges || []).map((edgeItem: any, idx: number) => {
      const e = edgeItem.data || edgeItem;
      const amount = Number(e.amount_usd) || Number(e.amount) || 0;
      return {
        id: `flow-${idx}`,
        source: e.source,
        target: e.target,
        amount,
        symbol: e.asset_symbol || e.token_symbol || 'ETH',
        txHash: e.tx_hash
      };
    });

    const cols = [
      { title: 'ROOT SUSPECT', nodes: hop0Nodes, color: 'border-rose-400 text-rose-600' },
      { title: 'HOP 1 DIRECT', nodes: hop1Nodes.slice(0, 6), color: 'border-sky-400 text-sky-600' },
      { title: 'HOP 2 LAYERING', nodes: hop2Nodes.slice(0, 6), color: 'border-purple-400 text-purple-600' },
      { title: 'DESTINATION VASPS', nodes: vaspNodes, color: 'border-emerald-400 text-emerald-600' }
    ].filter(c => c.nodes.length > 0);

    return { columns: cols, flows: flowList, totalRootVolume: rootOutflow };
  }, [graphData, rootAddress]);

  return (
    <div className="flex flex-col h-full bg-[#F4F6F8] p-5 overflow-y-auto space-y-6 text-[#0F172A]">
      {/* Top Intelligence Metrics Banner */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="p-4 rounded-2xl bg-white border border-[#E2E8F0] flex items-center space-x-3 shadow-sm">
          <div className="p-2 rounded-xl bg-rose-50 text-rose-600 border border-rose-200">
            <Wallet className="h-4 w-4" />
          </div>
          <div>
            <span className="text-[10px] text-[#64748B] uppercase font-mono block">Root Origin</span>
            <span className="text-xs font-bold font-mono text-[#0F172A] truncate block max-w-[140px]">
              {rootAddress.slice(0, 10)}...
            </span>
          </div>
        </div>

        <div className="p-4 rounded-2xl bg-white border border-[#E2E8F0] flex items-center space-x-3 shadow-sm">
          <div className="p-2 rounded-xl bg-sky-50 text-sky-600 border border-sky-200">
            <TrendingUp className="h-4 w-4" />
          </div>
          <div>
            <span className="text-[10px] text-[#64748B] uppercase font-mono block">Observed Flow</span>
            <span className="text-xs font-bold font-mono text-[#0284C7]">
              ${totalRootVolume > 1000 ? totalRootVolume.toLocaleString('en-US', { maximumFractionDigits: 0 }) : totalRootVolume.toFixed(2)}
            </span>
          </div>
        </div>

        <div className="p-4 rounded-2xl bg-white border border-[#E2E8F0] flex items-center space-x-3 shadow-sm">
          <div className="p-2 rounded-xl bg-purple-50 text-purple-600 border border-purple-200">
            <Layers className="h-4 w-4" />
          </div>
          <div>
            <span className="text-[10px] text-[#64748B] uppercase font-mono block">Layering Depth</span>
            <span className="text-xs font-bold font-mono text-purple-600">
              {columns.length} Topological Stages
            </span>
          </div>
        </div>

        <div className="p-4 rounded-2xl bg-white border border-[#E2E8F0] flex items-center space-x-3 shadow-sm">
          <div className="p-2 rounded-xl bg-emerald-50 text-emerald-600 border border-emerald-200">
            <Building2 className="h-4 w-4" />
          </div>
          <div>
            <span className="text-[10px] text-[#64748B] uppercase font-mono block">Top Attributed VASP</span>
            <span className="text-xs font-bold font-mono text-emerald-600">
              {attributions && attributions[0] ? `${attributions[0].vasp_name} (${attributions[0].score.toFixed(0)}%)` : 'Scanning...'}
            </span>
          </div>
        </div>
      </div>

      {/* Multi-Column Sankey Flow Canvas */}
      <div className="p-5 rounded-2xl bg-white border border-[#E2E8F0] flex-1 flex flex-col justify-between shadow-sm">
        <div className="flex items-center justify-between border-b border-[#E2E8F0] pb-3 mb-6">
          <div className="flex items-center space-x-2">
            <ShieldCheck className="h-4 w-4 text-[#0284C7]" />
            <h3 className="text-xs font-bold text-[#0F172A] uppercase tracking-wider">
              Volumetric Fund Flow &amp; Entity Distribution Waterfall
            </h3>
          </div>
          <span className="text-[10px] font-mono text-[#64748B]">
            Left-to-Right Topological Fund Transit
          </span>
        </div>

        {/* Columns Grid */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6 relative">
          {columns.map((col, colIdx) => (
            <div key={colIdx} className="flex flex-col space-y-3">
              <div className={`text-[10px] font-bold font-mono uppercase tracking-widest pb-1 border-b ${col.color}`}>
                {col.title} ({col.nodes.length})
              </div>

              <div className="flex flex-col space-y-3">
                {col.nodes.map((node, nodeIdx) => {
                  const isHovered = hoveredNode === node.id;
                  const isVasp = node.role === 'KNOWN_VASP' || !!node.vaspName;
                  const isRoot = node.hop === 0;

                  return (
                    <div
                      key={nodeIdx}
                      onMouseEnter={() => setHoveredNode(node.id)}
                      onMouseLeave={() => setHoveredNode(null)}
                      onClick={() => onSelectAddress?.(node.id)}
                      className={`p-3.5 rounded-xl border transition-all cursor-pointer relative overflow-hidden ${isHovered
                          ? 'border-[#0284C7] bg-[#0284C7]/10 shadow-lg scale-[1.02]'
                          : isVasp
                            ? 'border-emerald-200 bg-emerald-50/50 hover:border-emerald-400'
                            : isRoot
                              ? 'border-rose-200 bg-rose-50/50 hover:border-rose-400'
                              : 'border-[#E2E8F0] bg-white hover:border-[#CBD5E1]'
                        }`}
                    >
                      {/* Flow percentage bar background */}
                      <div
                        className={`absolute left-0 bottom-0 top-0 opacity-15 transition-all ${isVasp ? 'bg-emerald-500' : isRoot ? 'bg-rose-500' : 'bg-sky-500'
                          }`}
                        style={{ width: `${Math.max(8, node.percentage)}%` }}
                      />

                      <div className="relative z-10 flex flex-col space-y-1.5">
                        <div className="flex items-center justify-between">
                          <span className="font-bold text-[11px] font-mono text-[#0F172A] truncate max-w-[150px]">
                            {node.vaspName ? (
                              <span className="text-emerald-700 font-bold flex items-center space-x-1">
                                <Building2 className="h-3 w-3 inline" />
                                <span>{node.vaspName}</span>
                              </span>
                            ) : (
                              `${node.id.slice(0, 6)}...${node.id.slice(-4)}`
                            )}
                          </span>

                          <span className="text-[10px] font-mono font-bold text-[#64748B]">
                            {node.percentage > 0 ? `${node.percentage.toFixed(0)}%` : ''}
                          </span>
                        </div>

                        <div className="flex items-center justify-between text-[10px] font-mono text-[#64748B]">
                          <span>Vol: ${node.totalVolume > 1000 ? node.totalVolume.toLocaleString('en-US', { maximumFractionDigits: 0 }) : node.totalVolume.toFixed(2)}</span>
                          <span className="text-[9px] px-2 py-0.5 rounded-full bg-[#F8FAFC] border border-[#E2E8F0] text-[#64748B]">
                            Hop {node.hop}
                          </span>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>

        {/* Bottom Flow Insights */}
        <div className="mt-8 pt-4 border-t border-[#E2E8F0] flex flex-wrap items-center justify-between text-[11px] font-mono text-[#64748B] gap-3">
          <div className="flex items-center space-x-4">
            <span className="flex items-center space-x-1.5">
              <span className="h-2 w-2 rounded-full bg-rose-500" />
              <span>Input Suspect</span>
            </span>
            <span className="flex items-center space-x-1.5">
              <span className="h-2 w-2 rounded-full bg-sky-500" />
              <span>Direct Hop 1</span>
            </span>
            <span className="flex items-center space-x-1.5">
              <span className="h-2 w-2 rounded-full bg-purple-500" />
              <span>Layering Hop 2</span>
            </span>
            <span className="flex items-center space-x-1.5">
              <span className="h-2 w-2 rounded-full bg-emerald-500" />
              <span>VASP Endpoint</span>
            </span>
          </div>

          <div className="text-right">
            <span>Click any node to pivot investigation or view ledger details</span>
          </div>
        </div>
      </div>
    </div>
  );
};
