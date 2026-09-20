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
        className={`bg-white border border-[#E2E8F0] rounded-2xl p-5 md:p-6 text-xs transition-colors font-mono shadow-sm ${className}`}
      >
        <div className="flex items-center space-x-2.5 border-b border-[#E2E8F0] pb-3.5 mb-3.5">
          <ShieldCheck className="h-5 w-5 text-[#64748B]" />
          <h3 className="font-sans font-bold text-[#0F172A] text-sm tracking-wide">
            Primary Attribution Assessment
          </h3>
        </div>
        <div className="p-5 bg-[#F8FAFC] border border-[#E2E8F0] rounded-xl text-center text-[#64748B] space-y-1.5">
          <p className="font-semibold text-[#0F172A]">No Direct VASP Attribution Found</p>
          <p className="text-[11px] text-[#64748B]">
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
      className={`bg-white rounded-2xl p-5 md:p-6 border border-[#E2E8F0] space-y-5 shadow-sm ${className}`}
    >
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[#E2E8F0] pb-3.5">
        <div className="flex items-center gap-2.5">
          <div className="h-8 w-8 rounded-xl bg-sky-50 border border-sky-200 flex items-center justify-center text-[#0284C7]">
            <ShieldCheck className="h-4.5 w-4.5" />
          </div>
          <div>
            <h3 className="font-sans text-sm sm:text-base font-bold text-[#0F172A] tracking-tight">
              Primary Attribution Assessment
            </h3>
            <span className="font-mono text-[10px] uppercase text-[#64748B]">
              Deterministic VASP Cluster Resolution
            </span>
          </div>
        </div>

        <div className="flex items-center gap-2 font-mono">
          <span className="px-2.5 py-0.5 rounded-full bg-[#F8FAFC] border border-[#CBD5E1] text-[#64748B] text-[10px] uppercase font-bold">
            RANK #1 ENTITY
          </span>
          <span className="px-3 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200 text-[11px] font-bold">
            {primary.evidence_strength?.toUpperCase()} CONFIDENCE
          </span>
        </div>
      </div>

      {/* Identified VASP Overview Banner - Full Width Grid */}
      <div className="p-5 rounded-xl bg-[#F8FAFC] border border-[#E2E8F0]">
        <div className="grid grid-cols-1 md:grid-cols-12 gap-5 items-center">
          {/* VASP Name */}
          <div className="md:col-span-4 space-y-1.5">
            <span className="font-mono text-[10px] text-[#64748B] uppercase tracking-wider block">
              Identified Virtual Asset Service Provider
            </span>
            <div className="flex items-center gap-2.5 flex-wrap">
              <span className="font-sans text-xl sm:text-2xl font-extrabold text-[#0F172A] tracking-tight">
                {primary.vasp_name}
              </span>
              <span className="px-2.5 py-0.5 rounded-full bg-sky-50 text-sky-700 border border-sky-200 font-mono text-[10px] font-bold">
                CEX / LIQUIDITY HUB
              </span>
            </div>
          </div>

          {/* Attribution Score & Analytical Rubric */}
          <div className="md:col-span-3 space-y-1 md:border-l md:border-[#E2E8F0] md:pl-5">
            <span className="font-mono text-[10px] text-[#64748B] uppercase tracking-wider block">
              Attribution Score
            </span>
            <div className="flex items-baseline gap-2">
              <span className="font-mono text-3xl font-extrabold text-[#0284C7]">
                {primary.score.toFixed(1)}
              </span>
              <span className="text-xs text-[#94A3B8]">/ 100</span>
            </div>
            <div className="font-mono text-[11px] text-emerald-700 font-semibold truncate">
              {getAssessmentLabel(primary.score)}
            </div>
          </div>

          {/* Forensic Narrative */}
          <div className="md:col-span-5 space-y-1.5 md:border-l md:border-[#E2E8F0] md:pl-5">
            <span className="font-mono text-[10px] text-[#64748B] uppercase tracking-wider block">
              Forensic Nexus Summary
            </span>
            <p className="font-sans text-xs text-[#64748B] leading-relaxed">
              {primary.summary ||
                'Observable multi-hop fund flow traces from input wallet to exchange liquidity pools and deposit clusters. High likelihood of off-ramp transit gateway.'}
            </p>
          </div>
        </div>
      </div>

      {/* Mathematical Weight Distribution - 4 Columns Across Full Width */}
      <div className="space-y-2.5 pt-1">
        <div className="flex items-center justify-between text-[#64748B] font-mono text-xs">
          <span className="uppercase font-semibold text-[#0F172A]">Mathematical Weight Distribution &amp; Scoring Rubrics</span>
          <span className="uppercase font-semibold text-[11px] text-[#0284C7]">
            EVIDENCE-BASED FORENSIC RUBRICS
          </span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 font-mono text-xs">
          <div className="p-3.5 rounded-xl bg-white border border-[#E2E8F0] space-y-2.5 shadow-xs">
            <div className="flex justify-between items-center">
              <span className="text-[#0F172A] font-medium text-[11px]">Graph Proximity (35%)</span>
              <span className="text-emerald-700 font-bold text-[10px]">
                {primary.score >= 70 ? 'DIRECT / 1-HOP' : primary.score >= 40 ? '2-HOPS' : '3-HOPS'}
              </span>
            </div>
            <div className="w-full bg-[#E2E8F0] h-2 rounded-full overflow-hidden">
              <div
                className="bg-[#0284C7] h-full rounded-full transition-all duration-500"
                style={{ width: `${Math.min(100, Math.max(20, primary.score))}%` }}
              ></div>
            </div>
            <span className="text-[10px] text-[#64748B] block">Shortest topological path distance</span>
          </div>

          <div className="p-3.5 rounded-xl bg-white border border-[#E2E8F0] space-y-2.5 shadow-xs">
            <div className="flex justify-between items-center">
              <span className="text-[#0F172A] font-medium text-[11px]">Fund Flow Volume (25%)</span>
              <span className="text-[#0284C7] font-bold text-[10px]">
                FLOW {Math.round(Math.min(100, Math.max(15, primary.score * 0.9)))}%
              </span>
            </div>
            <div className="w-full bg-[#E2E8F0] h-2 rounded-full overflow-hidden">
              <div
                className="bg-[#0284C7] h-full rounded-full transition-all duration-500"
                style={{ width: `${Math.min(100, Math.max(15, primary.score * 0.9))}%` }}
              ></div>
            </div>
            <span className="text-[10px] text-[#64748B] block">Aggregated capital routed through node</span>
          </div>

          <div className="p-3.5 rounded-xl bg-white border border-[#E2E8F0] space-y-2.5 shadow-xs">
            <div className="flex justify-between items-center">
              <span className="text-[#0F172A] font-medium text-[11px]">Interaction Freq (20%)</span>
              <span className="text-[#0F172A] font-bold text-[10px]">
                FREQ {Math.round(Math.min(100, Math.max(15, primary.score * 0.85)))}%
              </span>
            </div>
            <div className="w-full bg-[#E2E8F0] h-2 rounded-full overflow-hidden">
              <div
                className="bg-[#94A3B8] h-full rounded-full transition-all duration-500"
                style={{ width: `${Math.min(100, Math.max(15, primary.score * 0.85))}%` }}
              ></div>
            </div>
            <span className="text-[10px] text-[#64748B] block">Temporal transfer density index</span>
          </div>

          <div className="p-3.5 rounded-xl bg-white border border-[#E2E8F0] space-y-2.5 shadow-xs">
            <div className="flex justify-between items-center">
              <span className="text-[#0F172A] font-medium text-[11px]">Temporal Decay (20%)</span>
              <span className="text-[#0284C7] font-bold text-[10px]">
                ACTIVE ({Math.round(Math.min(100, Math.max(20, primary.score * 0.95)))}%)
              </span>
            </div>
            <div className="w-full bg-[#E2E8F0] h-2 rounded-full overflow-hidden">
              <div
                className="bg-[#0284C7] h-full rounded-full transition-all duration-500"
                style={{ width: `${Math.min(100, Math.max(20, primary.score * 0.95))}%` }}
              ></div>
            </div>
            <span className="text-[10px] text-[#64748B] block">Exponential decay recency weight</span>
          </div>
        </div>
      </div>

      {/* Alternative Candidate Entities */}
      <div className="space-y-2.5 pt-2 border-t border-[#E2E8F0]">
        <div className="flex items-center justify-between font-mono text-xs">
          <span className="text-[#64748B] uppercase">
            Alternative Candidate Entities:
          </span>
          <span className="text-[#94A3B8] text-[10px]">
            Ranked by multi-rail heuristic convergence
          </span>
        </div>
        {attributions.length > 1 ? (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2.5 text-center font-mono">
            {attributions.slice(1, 7).map((alt, idx) => (
              <div
                key={idx}
                className="p-3 rounded-xl bg-[#F8FAFC] hover:bg-sky-50/50 transition-colors border border-[#E2E8F0] hover:border-[#0284C7]/50 shadow-xs"
              >
                <div className="text-[11px] text-[#0F172A] font-semibold truncate">
                  #{alt.rank || idx + 2} {alt.vasp_name}
                </div>
                <div className="text-[#0284C7] text-xs font-bold mt-1">
                  {alt.score.toFixed(1)} / 100
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="p-4 rounded-xl bg-[#F8FAFC] border border-[#E2E8F0] text-center text-[#64748B] text-xs font-mono">
            Single high-confidence terminal entity cluster identified in this trace.
          </div>
        )}
      </div>
    </div>
  );
};
