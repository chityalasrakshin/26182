'use client';

import React, { useState } from 'react';
import {
  ArrowRight,
  ExternalLink,
  Copy,
  Check,
  Building2,
  ShieldAlert,
  Layers,
  Clock,
  Coins,
  Share2,
  Zap,
} from 'lucide-react';
import { OrderedPath, PathHop } from '../lib/types';

interface PathTimelineProps {
  path: OrderedPath;
  selectedHop: number | null;
  onSelectHop: (hopNumber: number | null) => void;
  onSelectAddress?: (address: string) => void;
  onSelectTx?: (txHash: string) => void;
}

const HOP_COLORS: Record<number, { border: string; bg: string; text: string; ring: string }> = {
  1: {
    border: 'border-cyan-500/50',
    bg: 'bg-cyan-950/20',
    text: 'text-cyan-400',
    ring: 'ring-cyan-500/40',
  },
  2: {
    border: 'border-blue-500/50',
    bg: 'bg-blue-950/20',
    text: 'text-blue-400',
    ring: 'ring-blue-500/40',
  },
  3: {
    border: 'border-violet-500/50',
    bg: 'bg-violet-950/20',
    text: 'text-violet-400',
    ring: 'ring-violet-500/40',
  },
  4: {
    border: 'border-orange-500/50',
    bg: 'bg-orange-950/20',
    text: 'text-orange-400',
    ring: 'ring-orange-500/40',
  },
};

export const PathTimeline: React.FC<PathTimelineProps> = ({
  path,
  selectedHop,
  onSelectHop,
  onSelectAddress,
  onSelectTx,
}) => {
  const [copiedKey, setCopiedKey] = useState<string | null>(null);

  const copyToClipboard = (text: string, key: string, e?: React.MouseEvent) => {
    e?.stopPropagation();
    if (typeof navigator !== 'undefined') {
      navigator.clipboard.writeText(text);
      setCopiedKey(key);
      setTimeout(() => setCopiedKey(null), 1800);
    }
  };

  const truncate = (addr: string, start = 6, end = 4) => {
    if (!addr) return '0x...';
    if (addr.length <= start + end) return addr;
    return `${addr.slice(0, start)}...${addr.slice(-end)}`;
  };

  const formatTimestamp = (ts: string | null) => {
    if (!ts) return 'Recent';
    try {
      const d = new Date(ts);
      if (isNaN(d.getTime())) return ts;
      return d.toISOString().replace('T', ' ').slice(0, 19) + ' UTC';
    } catch {
      return ts;
    }
  };

  const getHopStyle = (hopNum: number) => {
    return HOP_COLORS[hopNum] || HOP_COLORS[4];
  };

  const confidencePercent = Math.round(Math.min(100, Math.max(0,
    (Number(path.endpoint.confidence) || 0) <= 1
      ? (Number(path.endpoint.confidence) || 0) * 100
      : Number(path.endpoint.confidence) || 0,
  )));

  return (
    <div className="w-full space-y-3 font-mono">
      {/* Path overview progress track */}
      <div className="flex items-center justify-between text-xs px-1 text-[#8E8E93]">
        <div className="flex items-center space-x-2">
          <span className="flex h-2 w-2 rounded-full bg-cyan-400 animate-ping" />
          <span className="text-[11px] uppercase tracking-wider font-semibold text-white">
            Trace Trajectory: {path.total_hops} Hop{path.total_hops !== 1 ? 's' : ''} to {path.endpoint.name}
          </span>
        </div>
        <div className="flex items-center space-x-3 text-[11px]">
          <span>Net Tracked: <strong className="text-white font-bold">{path.total_amount.toFixed(4)} {path.token}</strong></span>
          {selectedHop !== null && (
            <button
              onClick={() => onSelectHop(null)}
              className="text-[10px] uppercase text-[#FF5722] hover:underline cursor-pointer"
            >
              Clear Filter
            </button>
          )}
        </div>
      </div>

      {/* Horizontal timeline cards scroll container */}
      <div className="overflow-x-auto pb-3 pt-1 scrollbar-thin scrollbar-thumb-[#333] scrollbar-track-transparent">
        <div className="flex items-stretch space-x-3 min-w-max px-1">
          {/* Origin / Suspect Node */}
          <div className="w-56 shrink-0 rounded-lg p-3 bg-[#161618] border border-[#2C2C2E] flex flex-col justify-between select-none">
            <div>
              <div className="flex items-center justify-between mb-2">
                <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded bg-red-950/40 text-red-400 border border-red-800/40 flex items-center space-x-1">
                  <ShieldAlert className="h-3 w-3" />
                  <span>SUSPECT WALLET</span>
                </span>
                <span className="text-[10px] text-[#636366] uppercase">HOP 0</span>
              </div>
              <div className="mt-1">
                <span className="text-[10px] text-[#8E8E93] uppercase block">Origin Address</span>
                <div className="flex items-center justify-between bg-[#1C1C1E] px-2 py-1.5 rounded border border-[#2C2C2E] mt-1">
                  <span
                    onClick={() => onSelectAddress?.(path.address_path[0])}
                    className="text-xs text-white hover:text-cyan-400 cursor-pointer font-semibold transition-colors"
                    title={path.address_path[0]}
                  >
                    {truncate(path.address_path[0])}
                  </span>
                  <button
                    onClick={(e) => copyToClipboard(path.address_path[0], 'origin', e)}
                    className="text-[#8E8E93] hover:text-white transition-colors ml-1"
                    title="Copy origin address"
                  >
                    {copiedKey === 'origin' ? <Check className="h-3.5 w-3.5 text-emerald-400" /> : <Copy className="h-3.5 w-3.5" />}
                  </button>
                </div>
              </div>
            </div>

            <div className="mt-3 pt-2 border-t border-[#2C2C2E] text-[10px] text-[#8E8E93] flex justify-between items-center">
              <span>Chain: <span className="text-white capitalize">{path.endpoint.chain}</span></span>
              <span className="text-emerald-400 font-semibold">Taint Source</span>
            </div>
          </div>

          {/* Sequential Hops */}
          {path.hops.map((hop: PathHop) => {
            const isSelected = selectedHop === hop.hop;
            const style = getHopStyle(hop.hop);

            return (
              <React.Fragment key={`hop-fragment-${hop.hop}`}>
                {/* Connector Arrow */}
                <div className="flex flex-col items-center justify-center shrink-0 px-0.5">
                  <div className="flex items-center space-x-1 text-[#636366]">
                    <div className="w-4 h-[2px] bg-[#3A3A3C]" />
                    <ArrowRight className="h-4 w-4 text-[#8E8E93]" />
                    <div className="w-4 h-[2px] bg-[#3A3A3C]" />
                  </div>
                  <span className="text-[9px] uppercase tracking-wider text-[#636366] mt-1 font-bold">
                    HOP {hop.hop}
                  </span>
                </div>

                {/* Hop Card */}
                <div
                  onClick={() => onSelectHop(isSelected ? null : hop.hop)}
                  className={`w-72 shrink-0 rounded-lg p-3.5 transition-all cursor-pointer select-none flex flex-col justify-between border ${
                    isSelected
                      ? `${style.border} ${style.bg} ring-2 ${style.ring} shadow-lg shadow-cyan-950/30`
                      : 'bg-[#161618] border-[#2C2C2E] hover:border-[#3A3A3C] hover:bg-[#1C1C1E]'
                  }`}
                >
                  {/* Card Header */}
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <span className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded border ${style.border} ${style.bg} ${style.text}`}>
                        HOP #{hop.hop} TRANSFER
                      </span>

                      {hop.is_cross_chain && (
                        <span className="text-[10px] font-bold uppercase px-2 py-0.5 rounded bg-purple-950/40 text-purple-400 border border-purple-800/40 flex items-center space-x-1">
                          <Zap className="h-3 w-3" />
                          <span>{hop.bridge_protocol || 'BRIDGE'}</span>
                        </span>
                      )}
                    </div>

                    {/* Amount Highlight */}
                    <div className="bg-[#1C1C1E]/80 rounded p-2 border border-[#2C2C2E] mb-2.5">
                      <div className="flex items-center justify-between">
                        <span className="text-[10px] text-[#8E8E93] uppercase flex items-center space-x-1">
                          <Coins className="h-3 w-3 text-amber-400" />
                          <span>Transferred Value</span>
                        </span>
                        <span className="text-[10px] text-[#8E8E93]" suppressHydrationWarning>
                          {formatTimestamp(hop.timestamp)}
                        </span>
                      </div>
                      <div className="text-sm font-bold text-white mt-0.5">
                        {hop.amount.toFixed(4)} <span className="text-cyan-400">{hop.token}</span>
                      </div>
                    </div>

                    {/* Addresses */}
                    <div className="space-y-1.5 text-[11px]">
                      <div className="flex items-center justify-between">
                        <span className="text-[10px] text-[#8E8E93] uppercase">Sender:</span>
                        <div className="flex items-center space-x-1">
                          <span
                            onClick={(e) => {
                              e.stopPropagation();
                              onSelectAddress?.(hop.from_address);
                            }}
                            className="text-white hover:text-cyan-400 font-semibold transition-colors"
                            title={hop.from_address}
                          >
                            {truncate(hop.from_address)}
                          </span>
                          <button
                            onClick={(e) => copyToClipboard(hop.from_address, `from-${hop.hop}`, e)}
                            className="text-[#636366] hover:text-white"
                          >
                            {copiedKey === `from-${hop.hop}` ? (
                              <Check className="h-3 w-3 text-emerald-400" />
                            ) : (
                              <Copy className="h-3 w-3" />
                            )}
                          </button>
                        </div>
                      </div>

                      <div className="flex items-center justify-between">
                        <span className="text-[10px] text-[#8E8E93] uppercase">Receiver:</span>
                        <div className="flex items-center space-x-1">
                          <span
                            onClick={(e) => {
                              e.stopPropagation();
                              onSelectAddress?.(hop.to_address);
                            }}
                            className="text-white hover:text-cyan-400 font-semibold transition-colors"
                            title={hop.to_address}
                          >
                            {truncate(hop.to_address)}
                          </span>
                          <button
                            onClick={(e) => copyToClipboard(hop.to_address, `to-${hop.hop}`, e)}
                            className="text-[#636366] hover:text-white"
                          >
                            {copiedKey === `to-${hop.hop}` ? (
                              <Check className="h-3 w-3 text-emerald-400" />
                            ) : (
                              <Copy className="h-3 w-3" />
                            )}
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Card Footer: Tx Hash & Explorer */}
                  <div className="mt-3 pt-2 border-t border-[#2C2C2E] flex items-center justify-between text-[10px]">
                    <div className="flex items-center space-x-1">
                      <span className="text-[#8E8E93]">Tx:</span>
                      <span
                        onClick={(e) => {
                          e.stopPropagation();
                          onSelectTx?.(hop.tx_hash);
                        }}
                        className="text-cyan-400 hover:underline cursor-pointer"
                        title={hop.tx_hash}
                      >
                        {truncate(hop.tx_hash, 5, 4)}
                      </span>
                      <button
                        onClick={(e) => copyToClipboard(hop.tx_hash, `tx-${hop.hop}`, e)}
                        className="text-[#636366] hover:text-white ml-0.5"
                      >
                        {copiedKey === `tx-${hop.hop}` ? (
                          <Check className="h-2.5 w-2.5 text-emerald-400" />
                        ) : (
                          <Copy className="h-2.5 w-2.5" />
                        )}
                      </button>
                    </div>

                    {hop.tx_hash && hop.tx_hash.startsWith('0x') && (
                      <a
                        href={`https://etherscan.io/tx/${hop.tx_hash}`}
                        target="_blank"
                        rel="noreferrer"
                        onClick={(e) => e.stopPropagation()}
                        className="text-[#8E8E93] hover:text-cyan-400 flex items-center space-x-0.5 transition-colors"
                        title="Verify on Blockchain Explorer"
                      >
                        <span>Verify</span>
                        <ExternalLink className="h-2.5 w-2.5" />
                      </a>
                    )}
                  </div>
                </div>
              </React.Fragment>
            );
          })}

          {/* Terminal / Target VASP Node */}
          <div className="flex flex-col items-center justify-center shrink-0 px-0.5">
            <div className="flex items-center space-x-1 text-[#636366]">
              <div className="w-4 h-[2px] bg-[#3A3A3C]" />
              <ArrowRight className="h-4 w-4 text-emerald-400" />
              <div className="w-4 h-[2px] bg-[#3A3A3C]" />
            </div>
            <span className="text-[9px] uppercase tracking-wider text-emerald-400 mt-1 font-bold">
              DESTINATION
            </span>
          </div>

          <div className="w-64 shrink-0 rounded-lg p-3 bg-gradient-to-b from-[#18201a] to-[#141a16] border border-emerald-500/40 flex flex-col justify-between select-none shadow-md shadow-emerald-950/20">
            <div>
              <div className="flex items-center justify-between mb-2">
                <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded bg-emerald-950/60 text-emerald-400 border border-emerald-500/50 flex items-center space-x-1">
                  <Building2 className="h-3 w-3" />
                  <span>ATTRIBUTED VASP</span>
                </span>
                <span className="text-[10px] px-1.5 py-0.5 rounded bg-emerald-500/10 text-emerald-400 font-bold border border-emerald-500/30">
                  {confidencePercent}% CONF
                </span>
              </div>

              <div className="mt-1">
                <div className="text-base font-bold text-white flex items-center space-x-1.5">
                  <span>{path.endpoint.name}</span>
                  <span className="text-[9px] font-semibold px-1.5 py-0.5 rounded bg-[#2D2D2D] text-[#FF8A65] border border-[#444]">
                    {path.endpoint.category || 'CEX'}
                  </span>
                </div>
                <span className="text-[10px] text-[#8E8E93] uppercase block mt-1.5">Deposit Address</span>
                <div className="flex items-center justify-between bg-[#1C1C1E] px-2 py-1.5 rounded border border-[#2C2C2E] mt-1">
                  <span
                    onClick={() => onSelectAddress?.(path.endpoint.address)}
                    className="text-xs text-white hover:text-emerald-400 cursor-pointer font-semibold transition-colors"
                    title={path.endpoint.address}
                  >
                    {truncate(path.endpoint.address)}
                  </span>
                  <button
                    onClick={(e) => copyToClipboard(path.endpoint.address, 'endpoint', e)}
                    className="text-[#8E8E93] hover:text-white transition-colors ml-1"
                  >
                    {copiedKey === 'endpoint' ? (
                      <Check className="h-3.5 w-3.5 text-emerald-400" />
                    ) : (
                      <Copy className="h-3.5 w-3.5" />
                    )}
                  </button>
                </div>
              </div>
            </div>

            <div className="mt-3 pt-2 border-t border-emerald-900/40 text-[10px] text-[#8E8E93] flex justify-between items-center">
              <span>Status: <strong className="text-emerald-400">{path.endpoint.association_status}</strong></span>
              <span className="text-[#8E8E93]">Hop {path.total_hops}</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
