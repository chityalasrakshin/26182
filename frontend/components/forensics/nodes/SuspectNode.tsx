'use client';

import React, { useState } from 'react';
import { Handle, Position, NodeProps } from '@xyflow/react';
import { ShieldAlert, AlertTriangle, Copy, Check, ExternalLink, ArrowUpRight, Flame } from 'lucide-react';
import { SuspectNodeData } from '../types';

export const SuspectNode: React.FC<NodeProps<any>> = ({ data, selected, targetPosition = Position.Left, sourcePosition = Position.Right }) => {
  const nodeData = data as SuspectNodeData;
  const [copied, setCopied] = useState(false);

  const handleCopy = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!nodeData.address) return;
    navigator.clipboard.writeText(nodeData.address);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const getExplorerUrl = (address: string, chain: string) => {
    switch (chain?.toUpperCase()) {
      case 'BTC':
        return `https://mempool.space/address/${address}`;
      case 'TRON':
        return `https://tronscan.org/#/address/${address}`;
      case 'SOLANA':
        return `https://solscan.io/account/${address}`;
      case 'POLYGON':
        return `https://polygonscan.com/address/${address}`;
      default:
        return `https://etherscan.io/address/${address}`;
    }
  };

  const truncated = nodeData.address
    ? `${nodeData.address.slice(0, 6)}...${nodeData.address.slice(-4)}`
    : '0x00...0000';

  const chainBadgeColor: Record<string, string> = {
    BTC: 'bg-amber-500/10 text-amber-400 border-amber-500/30',
    ETH: 'bg-sky-500/10 text-sky-400 border-sky-500/30',
    TRON: 'bg-red-500/10 text-red-400 border-red-500/30',
    SOLANA: 'bg-purple-500/10 text-purple-400 border-purple-500/30',
    POLYGON: 'bg-indigo-500/10 text-indigo-400 border-indigo-500/30',
  };

  const chainKey = (nodeData.chain || 'ETH').toUpperCase();
  const badgeCls = chainBadgeColor[chainKey] || chainBadgeColor.ETH;

  return (
    <div
      className={`relative w-[280px] h-[160px] rounded-xl bg-slate-950/95 border-2 text-slate-100 p-3.5 transition-all duration-200 select-none backdrop-blur-md ${
        selected
          ? 'border-rose-400 shadow-[0_0_24px_rgba(244,63,94,0.65)] ring-2 ring-rose-500/50'
          : 'border-rose-500/80 shadow-[0_0_15px_rgba(244,63,94,0.35)] hover:shadow-[0_0_20px_rgba(244,63,94,0.5)]'
      }`}
    >
      {/* Target input handle */}
      <Handle
        type="target"
        position={targetPosition}
        className="!w-3 !h-3 !bg-rose-500 !border-2 !border-slate-950 !rounded-full transition-transform hover:scale-125"
      />

      {/* Header with threat indicator & Chain pill */}
      <div className="flex items-center justify-between pb-2 border-b border-rose-500/20">
        <div className="flex items-center space-x-1.5 min-w-0">
          <div className="p-1 rounded bg-rose-500/20 text-rose-400 border border-rose-500/30 shrink-0">
            {nodeData.isSanctioned ? (
              <Flame className="w-3.5 h-3.5 text-rose-500 animate-pulse" />
            ) : (
              <ShieldAlert className="w-3.5 h-3.5 text-rose-400" />
            )}
          </div>
          <div className="min-w-0">
            <span className="font-mono text-[10px] uppercase font-bold tracking-wider text-rose-400 block truncate">
              {nodeData.isSanctioned
                ? 'SDN SANCTIONED'
                : nodeData.isExploit
                ? 'EXPLOIT DRAINER'
                : 'TARGET SUSPECT'}
            </span>
          </div>
        </div>

        <span
          className={`px-2 py-0.5 rounded text-[10px] font-mono font-bold uppercase tracking-wider border shrink-0 ${badgeCls}`}
        >
          {nodeData.chain || 'ETH'}
        </span>
      </div>

      {/* Entity Title / Address */}
      <div className="mt-2.5">
        <h4 className="font-bold text-xs text-white truncate font-sans tracking-tight" title={nodeData.entityName || nodeData.label || 'Suspect Target'}>
          {nodeData.entityName || nodeData.label || (nodeData.isRoot ? 'Target Drainer Wallet' : 'Suspect Wallet')}
        </h4>

        {/* Address with one-click copy & explorer */}
        <div className="flex items-center justify-between mt-1 bg-slate-900/80 px-2 py-1 rounded border border-slate-800">
          <span className="font-mono text-[11px] text-rose-300 font-medium tracking-tight">
            {truncated}
          </span>
          <div className="flex items-center space-x-1">
            <button
              type="button"
              onClick={handleCopy}
              className="p-1 rounded hover:bg-slate-800 text-slate-400 hover:text-white transition-colors"
              title="Copy address"
            >
              {copied ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
            </button>
            <a
              href={getExplorerUrl(nodeData.address, nodeData.chain)}
              target="_blank"
              rel="noreferrer"
              onClick={(e) => e.stopPropagation()}
              className="p-1 rounded hover:bg-slate-800 text-slate-400 hover:text-sky-400 transition-colors"
              title="Open Explorer"
            >
              <ExternalLink className="w-3 h-3" />
            </a>
          </div>
        </div>
      </div>

      {/* Outflow Volume & Risk Score */}
      <div className="flex items-center justify-between mt-2.5 pt-2 border-t border-slate-800/80 text-[10px] font-mono">
        <div className="flex items-center space-x-1 text-slate-400">
          <ArrowUpRight className="w-3 h-3 text-rose-400 shrink-0" />
          <span>Outflow:</span>
          <strong className="text-white font-bold">
            {nodeData.outflowVolume > 0 ? `${nodeData.outflowVolume.toLocaleString()} ${nodeData.nativeSymbol || 'ETH'}` : '0.00'}
          </strong>
        </div>

        <div className="flex items-center space-x-1">
          <span className="w-1.5 h-1.5 rounded-full bg-rose-500 animate-ping inline-block"></span>
          <span className="text-rose-400 font-bold uppercase">{nodeData.threatLevel || 'CRITICAL'}</span>
        </div>
      </div>

      {/* Source output handle */}
      <Handle
        type="source"
        position={sourcePosition}
        className="!w-3 !h-3 !bg-rose-500 !border-2 !border-slate-950 !rounded-full transition-transform hover:scale-125"
      />
    </div>
  );
};
