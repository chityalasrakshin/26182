'use client';

import React, { useState } from 'react';
import { Handle, Position, NodeProps } from '@xyflow/react';
import { Building2, Copy, Check, ShieldCheck } from 'lucide-react';
import { VaspNodeData } from '../types';

export const VaspNode: React.FC<NodeProps<any>> = ({ data, selected, targetPosition = Position.Left, sourcePosition = Position.Right }) => {
  const nodeData = data as VaspNodeData;
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

  const score = Math.round(nodeData.confidenceScore ?? 94);

  // SVG Circular progress ring calculations (radius 18, circumference 2 * PI * 18 ~ 113.1)
  const radius = 16;
  const circumference = 2 * Math.PI * radius;
  const strokeDashoffset = circumference - (score / 100) * circumference;

  return (
    <div
      className={`relative w-[280px] h-[160px] rounded-xl bg-slate-950/95 border-2 text-slate-100 p-3.5 transition-all duration-200 select-none backdrop-blur-md ${
        selected
          ? 'border-emerald-400 shadow-[0_0_24px_rgba(16,185,129,0.7)] ring-2 ring-emerald-500/50'
          : 'border-emerald-500/80 shadow-[0_0_18px_rgba(16,185,129,0.35)] hover:shadow-[0_0_22px_rgba(16,185,129,0.55)]'
      }`}
    >
      {/* Target input handle */}
      <Handle
        type="target"
        position={targetPosition}
        className="!w-3 !h-3 !bg-emerald-500 !border-2 !border-slate-950 !rounded-full transition-transform hover:scale-125"
      />

      {/* Header: VASP Exchange & Custodial Status Pill */}
      <div className="flex items-center justify-between pb-2 border-b border-emerald-500/20">
        <div className="flex items-center space-x-1.5 min-w-0">
          <div className="p-1 rounded bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 shrink-0">
            <Building2 className="w-3.5 h-3.5 text-emerald-400" />
          </div>
          <span className="font-mono text-[10px] uppercase font-bold tracking-wider text-emerald-400 truncate">
            {nodeData.fiuRegistered ? 'FIU-IND REGISTERED' : 'REGULATED VASP'}
          </span>
        </div>

        <span className="px-2 py-0.5 rounded text-[9px] font-mono font-bold uppercase bg-emerald-500/10 text-emerald-300 border border-emerald-500/30 shrink-0">
          {nodeData.custodialStatus || 'CUSTODIAL VASP'}
        </span>
      </div>

      {/* Main Body: Exchange Name, Address & Circular Match Ring */}
      <div className="flex items-center justify-between mt-2.5">
        <div className="min-w-0 flex-1 pr-2">
          <h4 className="font-bold text-sm text-white truncate font-sans tracking-tight" title={nodeData.exchangeName || 'Exchange Node'}>
            {nodeData.exchangeName || 'Binance Global'}
          </h4>

          <div className="flex items-center justify-between mt-1 bg-slate-900/80 px-2 py-1 rounded border border-slate-800">
            <span className="font-mono text-[11px] text-emerald-300 font-medium tracking-tight">
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

        {/* Inline SVG Circular Confidence Match Ring */}
        <div className="relative w-12 h-12 flex items-center justify-center shrink-0">
          <svg className="w-12 h-12 transform -rotate-90" viewBox="0 0 40 40">
            {/* Background circle */}
            <circle
              cx="20"
              cy="20"
              r={radius}
              className="text-slate-800"
              strokeWidth="3.5"
              stroke="currentColor"
              fill="none"
            />
            {/* Animated match circle */}
            <circle
              cx="20"
              cy="20"
              r={radius}
              className="text-emerald-400 transition-all duration-700 ease-out"
              strokeWidth="3.5"
              strokeDasharray={circumference}
              strokeDashoffset={strokeDashoffset}
              strokeLinecap="round"
              stroke="currentColor"
              fill="none"
            />
          </svg>
          <div className="absolute flex flex-col items-center justify-center">
            <span className="font-mono text-[10px] font-bold text-white leading-none">
              {score}%
            </span>
            <span className="text-[7px] font-mono text-emerald-400 uppercase tracking-tighter">
              MATCH
            </span>
          </div>
        </div>
      </div>

      {/* Bottom Metadata: Deposit volume & Hop */}
      <div className="flex items-center justify-between mt-2.5 pt-2 border-t border-slate-800/80 text-[10px] font-mono">
        <div className="flex items-center space-x-1 text-slate-400">
          <span>Deposit Nexus:</span>
          <strong className="text-white font-bold">
            {nodeData.depositVolume > 0 ? `${nodeData.depositVolume.toLocaleString()} ${nodeData.nativeSymbol || 'ETH'}` : 'Direct Flow'}
          </strong>
        </div>

        <span className="text-emerald-400 font-semibold">
          Hop {nodeData.hopDistance ?? 2}
        </span>
      </div>

      {/* Source output handle */}
      <Handle
        type="source"
        position={sourcePosition}
        className="!w-3 !h-3 !bg-emerald-500 !border-2 !border-slate-950 !rounded-full transition-transform hover:scale-125"
      />
    </div>
  );
};
