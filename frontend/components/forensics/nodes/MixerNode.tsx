'use client';

import React, { useState } from 'react';
import { Handle, Position, NodeProps } from '@xyflow/react';
import { Layers, Copy, Check, Shuffle, ExternalLink } from 'lucide-react';
import { MixerNodeData } from '../types';

export const MixerNode: React.FC<NodeProps<any>> = ({ data, selected, targetPosition = Position.Left, sourcePosition = Position.Right }) => {
  const nodeData = data as MixerNodeData;
  const [copied, setCopied] = useState(false);

  const handleCopy = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!nodeData.address) return;
    navigator.clipboard.writeText(nodeData.address);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const truncated = nodeData.address
    ? `${nodeData.address.slice(0, 6)}...${nodeData.address.slice(-4)}`
    : '0x00...0000';

  const taint = Math.min(100, Math.max(0, nodeData.taintPercentage ?? 85));

  return (
    <div
      className={`relative w-[280px] h-[160px] rounded-xl bg-slate-950/95 border-2 text-slate-100 p-3.5 transition-all duration-200 select-none backdrop-blur-md ${
        selected
          ? 'border-amber-400 shadow-[0_0_24px_rgba(245,158,11,0.65)] ring-2 ring-amber-500/50'
          : 'border-amber-500/80 shadow-[0_0_15px_rgba(245,158,11,0.35)] hover:shadow-[0_0_20px_rgba(245,158,11,0.5)]'
      }`}
    >
      {/* Target input handle */}
      <Handle
        type="target"
        position={targetPosition}
        className="!w-3 !h-3 !bg-amber-500 !border-2 !border-slate-950 !rounded-full transition-transform hover:scale-125"
      />

      {/* Header: Typology badge & Hop Indicator */}
      <div className="flex items-center justify-between pb-2 border-b border-amber-500/20">
        <div className="flex items-center space-x-1.5 min-w-0">
          <div className="p-1 rounded bg-amber-500/20 text-amber-400 border border-amber-500/30 shrink-0">
            <Shuffle className="w-3.5 h-3.5 text-amber-400" />
          </div>
          <span className="font-mono text-[10px] uppercase font-bold tracking-wider text-amber-400 truncate">
            {nodeData.typologyBadge || 'Tornado Intermediary'}
          </span>
        </div>

        <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold uppercase bg-amber-500/10 text-amber-300 border border-amber-500/30 shrink-0">
          Hop {nodeData.hopNumber ?? 1}
        </span>
      </div>

      {/* Node Address / Identifier */}
      <div className="mt-2.5">
        <div className="flex items-center justify-between">
          <h4 className="font-bold text-xs text-white truncate font-sans tracking-tight" title={nodeData.label || 'Obfuscation Node'}>
            {nodeData.label || 'Tumbler / Peel Address'}
          </h4>
          <span className="text-[10px] font-mono text-slate-400">
            {nodeData.chain || 'ETH'}
          </span>
        </div>

        <div className="flex items-center justify-between mt-1 bg-slate-900/80 px-2 py-1 rounded border border-slate-800">
          <span className="font-mono text-[11px] text-amber-300 font-medium tracking-tight">
            {truncated}
          </span>
          <button
            type="button"
            onClick={handleCopy}
            className="p-1 rounded hover:bg-slate-800 text-slate-400 hover:text-white transition-colors"
            title="Copy address"
          >
            {copied ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
          </button>
        </div>
      </div>

      {/* Taint Percentage Bar */}
      <div className="mt-2.5 space-y-1">
        <div className="flex items-center justify-between text-[10px] font-mono">
          <span className="text-slate-400">FIFO Taint Meter:</span>
          <strong className="text-amber-400 font-bold">{taint}% Tainted</strong>
        </div>

        <div className="w-full h-2 rounded-full bg-slate-800 overflow-hidden flex border border-slate-700/50">
          <div
            style={{ width: `${taint}%` }}
            className="h-full bg-gradient-to-r from-amber-500 to-rose-500 transition-all duration-300"
          />
          <div
            style={{ width: `${100 - taint}%` }}
            className="h-full bg-slate-700/50"
          />
        </div>
      </div>

      {/* Source output handle */}
      <Handle
        type="source"
        position={sourcePosition}
        className="!w-3 !h-3 !bg-amber-500 !border-2 !border-slate-950 !rounded-full transition-transform hover:scale-125"
      />
    </div>
  );
};
