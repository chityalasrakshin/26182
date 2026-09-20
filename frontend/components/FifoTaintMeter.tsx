'use client';

import React from 'react';
import { Activity, Layers, Scale } from 'lucide-react';
import { TaintSummary } from '../lib/types';

interface FifoTaintMeterProps {
  taintSummary?: TaintSummary | null;
  totalVolumeInr?: number;
  totalVolumeUsd?: number;
  className?: string;
}

export const FifoTaintMeter: React.FC<FifoTaintMeterProps> = ({
  taintSummary,
  totalVolumeInr = 0,
  totalVolumeUsd = 0,
  className = '',
}) => {
  const taintRatio = taintSummary?.overall_taint_ratio ?? 0.0;
  const traceableVol = taintSummary?.total_traceable ?? 0;
  const unclassifiedVol = taintSummary?.total_unclassified ?? 0;
  const totalVol = taintSummary?.total_volume ?? (traceableVol + unclassifiedVol);
  const taintedAddrsCount = taintSummary?.tainted_addresses_count ?? 0;
  const txCount = taintSummary?.total_transactions ?? 0;

  const formatINR = (val: number) => {
    if (val >= 10000000) return '₹' + (val / 10000000).toFixed(2) + ' Cr';
    if (val >= 100000) return '₹' + (val / 100000).toFixed(2) + ' Lakh';
    return '₹' + Math.round(val).toLocaleString('en-IN');
  };

  const stolenInr = totalVolumeInr > 0 ? totalVolumeInr * (taintRatio > 0 ? taintRatio : 1.0) : 0;

  return (
    <div
      className={`bg-white rounded-2xl p-5 md:p-6 border border-[#E2E8F0] space-y-4 font-mono text-xs shadow-sm h-full flex flex-col justify-between ${className}`}
    >
      <div>
        {/* Header */}
        <div className="flex items-center justify-between border-b border-[#E2E8F0] pb-3">
          <div className="flex items-center gap-2.5">
            <div className="h-8 w-8 rounded-xl bg-sky-50 border border-sky-200 flex items-center justify-center text-[#0284C7]">
              <Activity className="h-4.5 w-4.5" />
            </div>
            <div>
              <h3 className="font-sans text-sm sm:text-base font-bold text-[#0F172A] tracking-tight">
                FIFO Taint Accounting Meter
              </h3>
              <span className="font-mono text-[10px] uppercase text-[#64748B]">
                First-In-First-Out Haircut Model
              </span>
            </div>
          </div>
          <span
            className={`px-2.5 py-0.5 rounded-full font-mono text-[10px] font-bold uppercase border ${taintRatio >= 0.5
                ? 'bg-rose-50 text-rose-700 border-rose-200'
                : taintRatio > 0
                ? 'bg-amber-50 text-amber-700 border-amber-200'
                : 'bg-emerald-50 text-emerald-700 border-emerald-200'
              }`}
          >
            {(taintRatio * 100).toFixed(1)}% DIRTY TAINT
          </span>
        </div>

        {/* Visual Taint Meter Bar */}
        <div className="space-y-2 mt-3.5 font-mono">
          <div className="flex items-center justify-between text-xs">
            <span className="text-rose-600 flex items-center gap-1.5 font-semibold">
              <span className="w-2 h-2 rounded-full bg-rose-600"></span>
              Stolen Victim Funds ({Math.round(taintRatio * 100)}%)
            </span>
            <span className="text-emerald-600 flex items-center gap-1.5 font-semibold">
              <span className="w-2 h-2 rounded-full bg-emerald-600"></span>
              Clean ({Math.round((1 - taintRatio) * 100)}%)
            </span>
          </div>

          <div className="w-full h-3 bg-[#F1F5F9] rounded-full overflow-hidden flex border border-[#CBD5E1]">
            <div
              className="bg-[#EF4444] h-full transition-all duration-500"
              style={{ width: `${Math.min(100, Math.max(taintRatio > 0 ? 5 : 0, taintRatio * 100))}%` }}
            ></div>
            <div
              className="bg-[#10B981] h-full transition-all duration-500"
              style={{ width: `${Math.max(0, 100 - taintRatio * 100)}%` }}
            ></div>
          </div>

          <div className="flex justify-between text-[10px] text-[#64748B]">
            <span>Frozen: {formatINR(stolenInr)}</span>
            <span>Total: {totalVolumeInr > 0 ? formatINR(totalVolumeInr) : '₹0.00'}</span>
          </div>
        </div>

        {/* Core Forensic Taint Tiles */}
        <div className="grid grid-cols-2 gap-2.5 mt-3.5 font-mono">
          <div className="p-3 rounded-xl bg-[#F8FAFC] border border-[#E2E8F0]">
            <span className="text-[10px] text-[#64748B] uppercase block font-semibold">Proven Stolen at VASP</span>
            <div className="text-xs sm:text-sm font-bold text-rose-600 mt-1">
              {traceableVol > 0 ? `${traceableVol.toFixed(2)} Vol` : (taintSummary ? '0.00 Vol' : '—')}
            </div>
            <span className="text-[11px] text-[#64748B] font-normal block mt-0.5">
              {txCount > 0 ? `${txCount} direct transfers to pool` : '0 transfers recorded'}
            </span>
          </div>

          <div className="p-3 rounded-xl bg-[#F8FAFC] border border-[#E2E8F0]">
            <span className="text-[10px] text-[#64748B] uppercase block font-semibold">Contaminated Nodes</span>
            <div className="text-xs sm:text-sm font-bold text-[#0F172A] mt-1">
              {taintedAddrsCount > 0 ? `${taintedAddrsCount} nodes` : '0 nodes'}
            </div>
            <span className="text-[11px] text-[#64748B] font-normal block mt-0.5">
              {taintedAddrsCount > 0 ? 'Layering across cluster' : 'No taint propagation'}
            </span>
          </div>
        </div>

        {/* Methodological Propagation & Statutory Readiness */}
        <div className="p-3 rounded-xl bg-[#F8FAFC] border border-[#E2E8F0] space-y-1.5 mt-3">
          <div className="flex items-center justify-between text-[11px]">
            <span className="text-[#0F172A] font-bold flex items-center gap-1.5">
              <Layers className="h-3.5 w-3.5 text-[#0284C7]" />
              FIFO Taint Attribution Standard
            </span>
            <span className={`font-bold text-[10px] px-2 py-0.5 rounded-full border ${
              taintRatio > 0 ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : 'bg-slate-50 text-slate-600 border-slate-200'
            }`}>
              {taintRatio > 0 ? 'EVIDENCE CERTIFIED' : 'STANDBY'}
            </span>
          </div>
          <p className="font-sans text-[11px] text-[#64748B] leading-relaxed">
            First-In-First-Out haircut algorithm traces illicit capital chronologically through unhosted hops to exchange liquidity pools, segregating co-mingled balances.
          </p>
        </div>
      </div>

      {/* Bottom Statutory Seizure Status */}
      <div className="pt-3 border-t border-[#E2E8F0] flex items-center justify-between font-mono text-[11px] text-[#64748B]">
        <div className="flex items-center gap-1.5">
          <Scale className="h-3.5 w-3.5 text-emerald-600" />
          <span className="font-semibold text-[#0F172A]">Sec 91 Freeze Potential:</span>
        </div>
        <span className="text-emerald-700 font-bold">
          {formatINR(stolenInr)} READY
        </span>
      </div>
    </div>
  );
};
