'use client';

import React, { useState } from 'react';
import {
  Building2,
  ShieldCheck,
  ExternalLink,
  Copy,
  Check,
  FileText,
  Target,
  Scale,
  Percent,
  TrendingUp,
  Layers,
  Info,
} from 'lucide-react';
import { VaspEndpoint } from '../lib/types';

interface VaspAttributionPanelProps {
  endpoint: VaspEndpoint;
  totalHops: number;
  totalAmount: number;
  token: string;
  onFocusVasp?: () => void;
  onTriggerDisclosure?: (vaspName: string) => void;
}

export const VaspAttributionPanel: React.FC<VaspAttributionPanelProps> = ({
  endpoint,
  totalHops,
  totalAmount,
  token,
  onFocusVasp,
  onTriggerDisclosure,
}) => {
  const [copied, setCopied] = useState(false);

  const handleCopy = (text: string) => {
    if (typeof navigator !== 'undefined') {
      navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const truncate = (addr: string) => {
    if (!addr) return '0x...';
    if (addr.length <= 16) return addr;
    return `${addr.slice(0, 8)}...${addr.slice(-6)}`;
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'IDENTIFIED':
        return {
          bg: 'bg-emerald-950/60',
          text: 'text-emerald-400',
          border: 'border-emerald-500/40',
          label: 'IDENTIFIED VASP',
        };
      case 'PARTIAL':
        return {
          bg: 'bg-amber-950/60',
          text: 'text-amber-400',
          border: 'border-amber-500/40',
          label: 'PROBABLE CLUSTER',
        };
      default:
        return {
          bg: 'bg-zinc-900',
          text: 'text-zinc-400',
          border: 'border-zinc-700',
          label: 'UNRESOLVED',
        };
    }
  };

  const statusBadge = getStatusBadge(endpoint.association_status);
  // The trace API returns attribution confidence as a normalized value (0–1).
  // Preserve compatibility with an already-percent-valued response without
  // presenting 0.95 as 0.95% in the investigation UI.
  const rawConfidence = Number(endpoint.confidence) || 0;
  const confidence = Math.min(100, Math.max(0, rawConfidence <= 1 ? rawConfidence * 100 : rawConfidence));
  const confidenceLabel = `${Math.round(confidence)}%`;

  return (
    <div className="glass-panel p-4 space-y-4 font-mono select-none">
      {/* Panel Header */}
      <div className="flex items-center justify-between border-b border-[#2C2C2E] pb-3">
        <div className="flex items-center space-x-2">
          <Building2 className="h-4 w-4 text-emerald-400" />
          <h3 className="uppercase font-bold text-white text-xs tracking-wider">
            VASP Attribution & Legal Endpoint
          </h3>
        </div>
        <span className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded border ${statusBadge.border} ${statusBadge.bg} ${statusBadge.text}`}>
          {statusBadge.label}
        </span>
      </div>

      {/* Main Attribution Profile Card */}
      <div className="bg-[#181E19]/80 border border-emerald-500/30 rounded-lg p-3.5 space-y-3">
        <div className="flex items-start justify-between">
          <div>
            <span className="text-[10px] uppercase font-bold text-[#8E8E93] tracking-wider block mb-1">
              Terminal Entity Name
            </span>
            <div className="flex items-center space-x-2">
              <strong className="text-xl font-bold text-white tracking-tight">
                {endpoint.name}
              </strong>
              <span className="text-[10px] px-2 py-0.5 rounded bg-[#252528] border border-[#3E3E42] text-[#FF8A65] font-bold">
                {endpoint.category || 'CEX'}
              </span>
            </div>
          </div>

          {/* Confidence Gauge */}
          <div className="text-right">
            <span className="text-[10px] uppercase font-bold text-[#8E8E93] tracking-wider block mb-1">
              Attribution Score
            </span>
            <div className="flex items-baseline justify-end space-x-1">
              <span className="text-xl font-black text-emerald-400">{confidenceLabel}</span>
              <span className="text-[10px] text-[#8E8E93]">confidence</span>
            </div>
          </div>
        </div>

        {/* Confidence Progress Bar */}
        <div>
          <div className="w-full bg-[#2C2C2E] h-1.5 rounded-full overflow-hidden">
            <div
              className="bg-gradient-to-r from-emerald-500 to-teal-400 h-full rounded-full transition-all duration-500"
              style={{ width: `${confidence}%` }}
            />
          </div>
        </div>

        {/* Traced Value and Hop Trajectory Metrics */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-2 border-t border-[#28352A] text-xs">
          <div>
            <span className="text-[9px] uppercase font-bold text-[#8E8E93] block">Deposit Volume</span>
            <strong className="text-white font-bold">{totalAmount.toFixed(4)} {token}</strong>
          </div>
          <div>
            <span className="text-[9px] uppercase font-bold text-[#8E8E93] block">Terminal Distance</span>
            <strong className="text-white font-bold">{totalHops} Hop{totalHops !== 1 ? 's' : ''}</strong>
          </div>
          <div>
            <span className="text-[9px] uppercase font-bold text-[#8E8E93] block">Target Chain</span>
            <strong className="text-white capitalize">{endpoint.chain}</strong>
          </div>
          <div>
            <span className="text-[9px] uppercase font-bold text-[#8E8E93] block">Association status</span>
            <strong className={statusBadge.text}>{endpoint.association_status.replace('_', ' ')}</strong>
          </div>
        </div>
      </div>

      {/* Target Deposit Address */}
      <div className="bg-[#161618] border border-[#2C2C2E] rounded-md p-3 space-y-2">
        <div className="flex items-center justify-between text-[10px]">
          <span className="uppercase text-[#8E8E93] font-bold">Exchange Cluster Deposit Address</span>
          {endpoint.source_url && (
            <a
              href={endpoint.source_url}
              target="_blank"
              rel="noreferrer"
              className="text-[#8E8E93] hover:text-cyan-400 flex items-center space-x-1"
            >
              <span>Label Provenance</span>
              <ExternalLink className="h-3 w-3" />
            </a>
          )}
        </div>

        <div className="flex items-center justify-between bg-[#1C1C1E] p-2 rounded border border-[#2C2C2E]">
          <span className="text-xs text-white font-mono break-all select-all">
            {endpoint.address}
          </span>
          <button
            onClick={() => handleCopy(endpoint.address)}
            className="p-1.5 rounded hover:bg-[#2C2C2E] text-[#8E8E93] hover:text-white transition-colors ml-2 shrink-0"
            title="Copy address"
          >
            {copied ? <Check className="h-4 w-4 text-emerald-400" /> : <Copy className="h-4 w-4" />}
          </button>
        </div>
      </div>

      {/* Evidence stays separate from risk and is only shown when supplied by the backend. */}
      <div className="bg-[#161618] border border-[#2C2C2E] rounded-md p-3 space-y-2">
        <div className="flex items-center space-x-2">
          <FileText className="h-3.5 w-3.5 text-cyan-400" />
          <span className="text-[10px] uppercase text-[#8E8E93] font-bold">Association evidence</span>
        </div>
        {endpoint.source_url ? (
          <p className="text-[11px] leading-5 text-[#B0B0B0]">
            The endpoint matches a labeled entity record supplied by the trace service. Use the label provenance link above to inspect its source.
          </p>
        ) : (
          <p className="text-[11px] leading-5 text-[#8E8E93]">
            Association is based on available endpoint/entity data. No provenance URL was supplied for this record.
          </p>
        )}
      </div>

      {/* Legal & Investigation Actions */}
      <div className="flex flex-wrap gap-2 pt-1">
        {onFocusVasp && (
          <button
            onClick={onFocusVasp}
            className="flex-1 min-w-[140px] flex items-center justify-center space-x-1.5 py-2 px-3 rounded-md bg-[#252528] hover:bg-[#2E2E32] text-white border border-[#3E3E42] text-xs font-semibold transition-colors"
          >
            <Target className="h-3.5 w-3.5 text-cyan-400" />
            <span>Focus Node on Graph</span>
          </button>
        )}

        {onTriggerDisclosure && (
          <button
            onClick={() => onTriggerDisclosure(endpoint.name)}
            className="flex-1 min-w-[180px] flex items-center justify-center space-x-1.5 py-2 px-3 rounded-md bg-[#FF5722] hover:bg-[#F4511E] text-white text-xs font-semibold shadow-md shadow-orange-950/20 transition-colors"
          >
            <Scale className="h-3.5 w-3.5" />
            <span>Generate Sec 91 Disclosure</span>
          </button>
        )}
      </div>
    </div>
  );
};
