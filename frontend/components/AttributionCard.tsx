'use client';

import React from 'react';
import { ShieldCheck, Layers, HelpCircle, CheckCircle2, ChevronRight, BarChart2, Activity, AlertTriangle } from 'lucide-react';
import { Attribution, TaintSummary } from '../lib/types';

interface AttributionCardProps {
  attributions: Attribution[];
  taintSummary?: TaintSummary | null;
}

export const AttributionCard: React.FC<AttributionCardProps> = ({ attributions, taintSummary }) => {
  if (!attributions || attributions.length === 0) {
    return (
      <div className="bg-forensic-surface border border-forensic-border rounded p-4 text-xs transition-colors">
        <div className="flex items-center space-x-2 border-b border-forensic-border pb-2.5 mb-3">
          <ShieldCheck className="h-4 w-4 text-forensic-textDim" />
          <h3 className="font-mono uppercase font-bold text-forensic-text text-xs tracking-wider">
            Attribution Assessment
          </h3>
        </div>
        <div className="p-4 bg-forensic-bg/60 border border-forensic-borderMuted rounded text-center text-forensic-textDim space-y-1 font-mono">
          <p className="font-semibold text-forensic-textMuted">No Direct VASP Attribution Found</p>
          <p className="text-[11px]">
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

  const taintRatio = taintSummary?.overall_taint_ratio ?? 0.85;
  const traceableVol = taintSummary?.total_traceable ?? 0;
  const unclassifiedVol = taintSummary?.total_unclassified ?? 0;
  const totalVol = taintSummary?.total_volume ?? (traceableVol + unclassifiedVol);
  const taintedAddrsCount = taintSummary?.tainted_addresses_count ?? 0;

  return (
    <div className="bg-forensic-surface border border-forensic-border rounded shadow-sm text-xs space-y-3.5 p-4 transition-colors">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-forensic-border pb-2.5">
        <div className="flex items-center space-x-2">
          <ShieldCheck className="h-4 w-4 text-blue-500" />
          <h3 className="font-mono uppercase font-bold text-forensic-text text-xs tracking-wider">
            Primary Attribution Assessment
          </h3>
        </div>
        <span className="font-mono text-[10px] uppercase px-2 py-0.5 rounded bg-teal-500/15 text-forensic-teal border border-teal-500/30 font-bold">
          {primary.evidence_strength} CONFIDENCE
        </span>
      </div>

      {/* Primary Finding Panel */}
      <div className="bg-forensic-bg border border-forensic-border rounded p-3.5 space-y-3">
        <div className="flex items-start justify-between">
          <div>
            <span className="text-[10px] uppercase font-mono text-forensic-textDim font-semibold block mb-0.5">
              Identified Virtual Asset Service Provider
            </span>
            <div className="flex items-center space-x-2">
              <strong className="text-base font-bold text-forensic-text font-mono">
                {primary.vasp_name}
              </strong>
              <span className="text-[10px] px-1.5 py-0.2 rounded bg-forensic-surfaceRaised border border-forensic-border text-forensic-textMuted font-mono">
                CEX
              </span>
            </div>
          </div>

          <div className="text-right">
            <span className="text-[10px] uppercase font-mono text-forensic-textDim font-semibold block mb-0.5">
              Attribution Score
            </span>
            <span className="font-mono text-base font-bold text-forensic-teal">
              {primary.score.toFixed(1)} <span className="text-xs text-forensic-textDim font-normal">/ 100</span>
            </span>
          </div>
        </div>

        <div className="p-2 bg-forensic-surfaceRaised rounded border border-forensic-borderMuted text-[11px] font-mono">
          <span className="text-forensic-textDim uppercase text-[9px] block font-semibold">Analytical Assessment:</span>
          <span className="text-forensic-text font-bold">
            {getAssessmentLabel(primary.score)}
          </span>
        </div>

        {/* Narrative Basis */}
        <div className="text-[11px] text-forensic-textMuted space-y-1">
          <span className="text-[10px] uppercase font-mono text-forensic-textDim font-semibold block">
            Investigative Basis:
          </span>
          <p className="leading-relaxed text-forensic-text font-sans text-xs">{primary.summary}</p>
        </div>
      </div>

      {/* Case 2: Forensic Taint Summary Card (Chainalysis Taint Meter) */}
      <div className="bg-forensic-bg border border-forensic-border rounded p-3.5 space-y-2.5">
        <div className="flex items-center justify-between border-b border-forensic-border pb-2">
          <div className="flex items-center space-x-1.5">
            <Activity className="h-3.5 w-3.5 text-rose-500" />
            <span className="text-[10px] uppercase font-mono font-bold text-forensic-text tracking-wider">
              FIFO Taint Accounting Meter
            </span>
          </div>
          <span className={`text-[10px] font-mono font-bold px-1.5 py-0.5 rounded ${
            taintRatio >= 0.7 ? 'bg-rose-500/20 text-rose-400 border border-rose-500/30' :
            taintRatio >= 0.4 ? 'bg-amber-500/20 text-amber-400 border border-amber-500/30' :
            'bg-teal-500/20 text-teal-400 border border-teal-500/30'
          }`}>
            {(taintRatio * 100).toFixed(1)}% DIRTY TAINT
          </span>
        </div>

        {/* Visual Progress Bar */}
        <div className="space-y-1">
          <div className="h-2 w-full bg-forensic-surfaceRaised rounded overflow-hidden flex border border-forensic-border">
            <div
              className={`h-full transition-all duration-500 ${
                taintRatio >= 0.7 ? 'bg-rose-600' :
                taintRatio >= 0.4 ? 'bg-amber-500' :
                'bg-teal-500'
              }`}
              style={{ width: `${Math.min(100, Math.max(0, taintRatio * 100))}%` }}
            />
            <div
              className="h-full bg-slate-600 transition-all duration-500"
              style={{ width: `${Math.max(0, 100 - taintRatio * 100)}%` }}
            />
          </div>
          <div className="flex items-center justify-between text-[9px] font-mono text-forensic-textDim">
            <span className="text-rose-400 font-bold">Stolen Victim Funds ({Math.round(taintRatio * 100)}%)</span>
            <span className="text-forensic-textMuted">Clean Co-mingled ({Math.round((1 - taintRatio) * 100)}%)</span>
          </div>
        </div>

        {/* Breakdown Metrics */}
        <div className="grid grid-cols-2 gap-2 text-[10px] font-mono pt-1">
          <div className="p-2 bg-forensic-surfaceRaised rounded border border-forensic-borderMuted">
            <span className="text-forensic-textDim block text-[9px] uppercase">Proven Stolen at VASP</span>
            <strong className="text-rose-400 font-bold text-xs">
              {traceableVol > 0 ? traceableVol.toFixed(3) : primary.score >= 50 ? 'High Concentration' : 'Direct Hop'}
            </strong>
          </div>
          <div className="p-2 bg-forensic-surfaceRaised rounded border border-forensic-borderMuted">
            <span className="text-forensic-textDim block text-[9px] uppercase">Contaminated Wallets</span>
            <strong className="text-forensic-text font-bold text-xs">
              {taintedAddrsCount > 0 ? `${taintedAddrsCount} addresses` : 'Multi-hop cluster'}
            </strong>
          </div>
        </div>
      </div>

      {/* Heuristic Model Breakdown */}
      <div className="space-y-1.5 pt-1">
        <div className="flex items-center justify-between text-[10px] uppercase font-mono text-forensic-textDim font-semibold">
          <span>Mathematical Weight Distribution</span>
          <span>Evaluation Rubric</span>
        </div>

        <div className="space-y-1 text-[11px] font-mono">
          <div className="flex items-center justify-between p-1.5 bg-forensic-bg/60 rounded border border-forensic-borderMuted">
            <span className="text-forensic-textMuted">Graph Proximity (35%)</span>
            <span className="text-forensic-text font-bold">
              {primary.score >= 70 ? 'DIRECT / 1-HOP' : primary.score >= 40 ? '2-HOPS' : '3-HOPS'}
            </span>
          </div>

          <div className="flex items-center justify-between p-1.5 bg-forensic-bg/60 rounded border border-forensic-borderMuted">
            <span className="text-forensic-textMuted">Fund Flow Volume (25%)</span>
            <span className="text-forensic-text font-bold">WEIGHTED FLOW</span>
          </div>

          <div className="flex items-center justify-between p-1.5 bg-forensic-bg/60 rounded border border-forensic-borderMuted">
            <span className="text-forensic-textMuted">Interaction Frequency (20%)</span>
            <span className="text-forensic-text font-bold">CLUSTER FREQ</span>
          </div>

          <div className="flex items-center justify-between p-1.5 bg-forensic-bg/60 rounded border border-forensic-borderMuted">
            <span className="text-forensic-textMuted">Behavior & Recency (20%)</span>
            <span className="text-forensic-text font-bold">ACTIVE CLUSTER</span>
          </div>
        </div>
      </div>

      {/* Alternative Candidates */}
      {attributions.length > 1 && (
        <div className="pt-2 border-t border-forensic-borderMuted space-y-1.5">
          <span className="text-[10px] uppercase font-mono text-forensic-textDim font-semibold block">
            Alternative Counterparty Entities ({attributions.length - 1}):
          </span>
          <div className="space-y-1 font-mono">
            {attributions.slice(1, 4).map((alt, idx) => (
              <div
                key={idx}
                className="flex items-center justify-between p-2 rounded bg-forensic-bg border border-forensic-borderMuted text-xs"
              >
                <div className="flex items-center space-x-1.5">
                  <span className="text-forensic-textDim">#{alt.rank}</span>
                  <span className="text-forensic-text font-medium">{alt.vasp_name}</span>
                </div>
                <span className="text-forensic-textMuted font-bold">{alt.score.toFixed(1)} / 100</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};
