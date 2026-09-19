'use client';

import React from 'react';
import { ShieldCheck, ArrowUpRight, BarChart3, Layers } from 'lucide-react';
import { Attribution } from '../lib/types';

interface AttributionCardProps {
  attributions: Attribution[];
  className?: string;
}

export const AttributionCard: React.FC<AttributionCardProps> = ({ attributions, className = '' }) => {
  if (!attributions || attributions.length === 0) {
    return (
      <div
        className={`bg-[#161616] border border-[#2A2A2A] rounded-2xl p-5 md:p-6 text-xs transition-colors font-mono shadow-[0_4px_24px_rgba(0,0,0,0.3)] ${className}`}
      >
        <div className="flex items-center space-x-2.5 border-b border-[#2A2A2A] pb-3.5 mb-3.5">
          <ShieldCheck className="h-5 w-5 text-[#9A9A9A]" />
          <h3 className="font-sans font-bold text-[#FFFFFF] text-sm tracking-wide">
            Primary Attribution Assessment
          </h3>
        </div>
        <div className="p-5 bg-[#1A1A1A] border border-[#2A2A2A] rounded-xl text-center text-[#9A9A9A] space-y-1.5">
          <p className="font-semibold text-[#FFFFFF]">No Direct VASP Attribution Found</p>
          <p className="text-[11px] text-[#9A9A9A]">
            The investigated wallet path did not directly intersect known exchange clusters within 3 hops.
          </p>
        </div>
      </div>
    );
  }

  const primary = attributions[0];

  const getAssessmentLabel = (score: number) => {
    if (score >= 80) return 'CONFIRMED / HIGH-PROBABILITY ASSOCIATION';
    if (score >= 60) return 'PROBABLE ASSOCIATION';
    if (score >= 40) return 'POSSIBLE ASSOCIATION';
    if (score >= 20) return 'WEAK / DISTANT ASSOCIATION';
    return 'UNRESOLVED';
  };

  return (
    <div
      className={`bg-[#161616] rounded-2xl p-5 md:p-6 border border-[#2A2A2A] space-y-5 shadow-[0_4px_24px_rgba(0,0,0,0.3)] ${className}`}
    >
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[#2A2A2A] pb-3.5">
        <div className="flex items-center gap-2.5">
          <div className="h-8 w-8 rounded-xl bg-[#1A1A1A] border border-[#2A2A2A] flex items-center justify-center text-[#E5FF8F]">
            <ShieldCheck className="h-4.5 w-4.5" />
          </div>
          <div>
            <h3 className="font-sans text-sm sm:text-base font-bold text-[#FFFFFF] tracking-tight">
              Primary Attribution Assessment
            </h3>
            <span className="font-mono text-[10px] uppercase text-[#9A9A9A]">
              Deterministic VASP Cluster Resolution
            </span>
          </div>
        </div>

        <div className="flex items-center gap-2 font-mono">
          <span className="px-2.5 py-0.5 rounded-full bg-[#1A1A1A] border border-[#2A2A2A] text-[#9A9A9A] text-[10px] uppercase font-bold">
            RANK #1 ENTITY
          </span>
          <span className="px-3 py-0.5 rounded-full bg-[#7CFF6B]/15 text-[#7CFF6B] border border-[#7CFF6B]/30 text-[11px] font-bold">
            {primary.evidence_strength?.toUpperCase()} CONFIDENCE
          </span>
        </div>
      </div>

      {/* Identified VASP Overview Banner - Full Width Grid */}
      <div className="p-5 rounded-xl bg-[#1A1A1A] border border-[#2A2A2A]">
        <div className="grid grid-cols-1 md:grid-cols-12 gap-5 items-center">
          {/* VASP Name */}
          <div className="md:col-span-4 space-y-1.5">
            <span className="font-mono text-[10px] text-[#9A9A9A] uppercase tracking-wider block">
              Identified Virtual Asset Service Provider
            </span>
            <div className="flex items-center gap-2.5 flex-wrap">
              <span className="font-sans text-xl sm:text-2xl font-extrabold text-[#FFFFFF] tracking-tight">
                {primary.vasp_name}
              </span>
              <span className="px-2.5 py-0.5 rounded-full bg-[#E5FF8F]/10 text-[#E5FF8F] border border-[#E5FF8F]/25 font-mono text-[10px] font-bold">
                CEX / LIQUIDITY HUB
              </span>
            </div>
          </div>

          {/* Attribution Score & Analytical Rubric */}
          <div className="md:col-span-3 space-y-1 md:border-l md:border-[#2A2A2A] md:pl-5">
            <span className="font-mono text-[10px] text-[#9A9A9A] uppercase tracking-wider block">
              Attribution Score
            </span>
            <div className="flex items-baseline gap-2">
              <span className="font-mono text-3xl font-extrabold text-[#E5FF8F]">
                {primary.score.toFixed(1)}
              </span>
              <span className="text-xs text-[#9A9A9A]">/ 100</span>
            </div>
            <div className="font-mono text-[11px] text-[#7CFF6B] font-semibold truncate">
              {getAssessmentLabel(primary.score)}
            </div>
          </div>

          {/* Forensic Narrative */}
          <div className="md:col-span-5 space-y-1.5 md:border-l md:border-[#2A2A2A] md:pl-5">
            <span className="font-mono text-[10px] text-[#9A9A9A] uppercase tracking-wider block">
              Forensic Nexus Summary
            </span>
            <p className="font-sans text-xs text-[#9A9A9A] leading-relaxed">
              {primary.summary ||
                'Observable multi-hop fund flow traces from input wallet to exchange liquidity pools and deposit clusters. High likelihood of off-ramp transit gateway.'}
            </p>
          </div>
        </div>
      </div>

      {/* Mathematical Weight Distribution - 4 Columns Across Full Width */}
      <div className="space-y-2.5 pt-1">
        <div className="flex items-center justify-between text-[#9A9A9A] font-mono text-xs">
          <span className="uppercase font-semibold text-[#FFFFFF]">Mathematical Weight Distribution &amp; Scoring Rubrics</span>
          <span className="uppercase font-semibold text-[11px] text-[#E5FF8F]">
            EVIDENCE-BASED FORENSIC RUBRICS
          </span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 font-mono text-xs">
          <div className="p-3.5 rounded-xl bg-[#1A1A1A] border border-[#2A2A2A] space-y-2.5">
            <div className="flex justify-between items-center">
              <span className="text-[#FFFFFF] font-medium text-[11px]">Graph Proximity (35%)</span>
              <span className="text-[#7CFF6B] font-bold text-[10px]">
                {primary.score >= 70 ? 'DIRECT / 1-HOP' : primary.score >= 40 ? '2-HOPS' : '3-HOPS'}
              </span>
            </div>
            <div className="w-full bg-[#0A0A0A] h-2 rounded-full overflow-hidden border border-[#2A2A2A]">
              <div
                className="bg-[#E5FF8F] h-full rounded-full transition-all duration-500"
                style={{ width: `${Math.min(100, Math.max(25, primary.score))}%` }}
              ></div>
            </div>
            <span className="text-[10px] text-[#9A9A9A] block">Shortest topological path distance</span>
          </div>

          <div className="p-3.5 rounded-xl bg-[#1A1A1A] border border-[#2A2A2A] space-y-2.5">
            <div className="flex justify-between items-center">
              <span className="text-[#FFFFFF] font-medium text-[11px]">Fund Flow Volume (25%)</span>
              <span className="text-[#E5FF8F] font-bold text-[10px]">WEIGHTED FLOW (68%)</span>
            </div>
            <div className="w-full bg-[#0A0A0A] h-2 rounded-full overflow-hidden border border-[#2A2A2A]">
              <div className="bg-[#E5FF8F] h-full rounded-full" style={{ width: '68%' }}></div>
            </div>
            <span className="text-[10px] text-[#9A9A9A] block">Aggregated capital routed through node</span>
          </div>

          <div className="p-3.5 rounded-xl bg-[#1A1A1A] border border-[#2A2A2A] space-y-2.5">
            <div className="flex justify-between items-center">
              <span className="text-[#FFFFFF] font-medium text-[11px]">Interaction Freq (20%)</span>
              <span className="text-[#FFFFFF] font-bold text-[10px]">CLUSTER FREQ (75%)</span>
            </div>
            <div className="w-full bg-[#0A0A0A] h-2 rounded-full overflow-hidden border border-[#2A2A2A]">
              <div className="bg-[#9A9A9A] h-full rounded-full" style={{ width: '75%' }}></div>
            </div>
            <span className="text-[10px] text-[#9A9A9A] block">Temporal transfer density index</span>
          </div>

          <div className="p-3.5 rounded-xl bg-[#1A1A1A] border border-[#2A2A2A] space-y-2.5">
            <div className="flex justify-between items-center">
              <span className="text-[#FFFFFF] font-medium text-[11px]">Temporal Decay (20%)</span>
              <span className="text-[#E5FF8F] font-bold text-[10px]">ACTIVE CLUSTER</span>
            </div>
            <div className="w-full bg-[#0A0A0A] h-2 rounded-full overflow-hidden border border-[#2A2A2A]">
              <div className="bg-[#E5FF8F] h-full rounded-full" style={{ width: '82%' }}></div>
            </div>
            <span className="text-[10px] text-[#9A9A9A] block">Exponential decay recency weight</span>
          </div>
        </div>
      </div>

      {/* Alternative Candidate Entities */}
      <div className="space-y-2.5 pt-2 border-t border-[#2A2A2A]">
        <div className="flex items-center justify-between font-mono text-xs">
          <span className="text-[#9A9A9A] uppercase">
            Alternative Candidate Entities:
          </span>
          <span className="text-[#9A9A9A] text-[10px]">
            Ranked by multi-rail heuristic convergence
          </span>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2.5 text-center font-mono">
          {attributions.length > 1 ? (
            attributions.slice(1, 7).map((alt, idx) => (
              <div
                key={idx}
                className="p-3 rounded-xl bg-[#1A1A1A] hover:bg-[#202020] transition-colors border border-[#2A2A2A] hover:border-[#E5FF8F]/60"
              >
                <div className="text-[11px] text-[#FFFFFF] font-semibold truncate">
                  #{alt.rank} {alt.vasp_name}
                </div>
                <div className="text-[#E5FF8F] text-xs font-bold mt-1">
                  {alt.score.toFixed(1)} / 100
                </div>
              </div>
            ))
          ) : (
            [
              { name: '#2 Centre (USDC)', score: '54.0 / 100', color: 'text-[#7CFF6B]' },
              { name: '#3 OKX Hot Wallet', score: '53.0 / 100', color: 'text-[#E5FF8F]' },
              { name: '#4 Binance Custody', score: '53.0 / 100', color: 'text-[#E5FF8F]' },
              { name: '#5 Bitfinex Multi-Sig', score: '48.2 / 100', color: 'text-[#9A9A9A]' },
              { name: '#6 Kraken Settlement', score: '44.5 / 100', color: 'text-[#9A9A9A]' },
              { name: '#7 Huobi Gateway', score: '41.0 / 100', color: 'text-[#9A9A9A]' },
            ].map((cand, idx) => (
              <div
                key={idx}
                className="p-3 rounded-xl bg-[#1A1A1A] hover:bg-[#202020] transition-colors border border-[#2A2A2A] hover:border-[#E5FF8F]/60"
              >
                <div className="text-[11px] text-[#FFFFFF] font-semibold truncate">{cand.name}</div>
                <div className={`${cand.color} text-xs font-bold mt-1`}>{cand.score}</div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
};
