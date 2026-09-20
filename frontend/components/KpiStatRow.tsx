'use client';

import React from 'react';
import { ShieldCheck, AlertTriangle, Scale, ArrowUpRight } from 'lucide-react';
import { Attribution, RiskAssessment, GraphData } from '../lib/types';

interface KpiStatRowProps {
  attributions?: Attribution[];
  riskAssessment?: RiskAssessment | null;
  graphData?: GraphData | null;
  totalVolumeInr?: number;
}

export const KpiStatRow: React.FC<KpiStatRowProps> = ({
  attributions = [],
  riskAssessment,
  graphData,
  totalVolumeInr = 0,
}) => {
  const hasData = Boolean(graphData || riskAssessment || attributions.length > 0 || totalVolumeInr > 0);
  const primaryVasp = attributions.length > 0 ? attributions[0] : null;

  const riskScore = riskAssessment?.composite_risk_score ?? riskAssessment?.score ?? (hasData ? 0 : null);
  const riskLevel = riskAssessment?.risk_level || (riskScore !== null ? (riskScore >= 70 ? 'CRITICAL' : riskScore >= 50 ? 'HIGH' : riskScore >= 25 ? 'MEDIUM' : 'LOW') : 'STANDBY');

  const taintRatio = graphData?.stats?.taint_summary?.overall_taint_ratio ?? 0.0;
  const inrVal = totalVolumeInr > 0 ? totalVolumeInr : (graphData?.stats?.total_amount_inr ?? 0);
  const maxHops = graphData?.stats?.max_hop_reached ?? (primaryVasp?.metrics?.shortest_hop || 0);

  const formatINR = (val: number) => {
    if (val >= 10000000) return '₹' + (val / 10000000).toFixed(2) + ' Cr';
    if (val >= 100000) return '₹' + (val / 100000).toFixed(2) + ' L';
    return '₹' + Math.round(val).toLocaleString('en-IN');
  };

  const seizureValue = inrVal * (taintRatio > 0 ? taintRatio : 1.0);

  // Indicators summary
  const signalsCount = riskAssessment?.indicators?.filter(i => !i.includes('No anomalous')).length || 0;
  const topSignal = riskAssessment?.indicators?.[0]?.replace(/\[.*?\]\s*/, '') || (hasData ? 'Standard on-chain activity' : 'Awaiting target wallet trace');

  return (
    <section className="grid grid-cols-1 md:grid-cols-3 gap-5 font-sans select-none">
      {/* 1. Attributed VASP KPI Card */}
      <div className="bg-white text-[#0F172A] border border-[#E2E8F0] rounded-2xl p-6 flex flex-col justify-between shadow-sm hover:shadow-md transition-all">
        <div>
          <div className="flex items-center justify-between">
            <div className="h-9 w-9 rounded-xl bg-sky-50 border border-sky-200 flex items-center justify-center">
              <ShieldCheck className="h-5 w-5 text-[#0284C7] stroke-[2.3]" />
            </div>
            <span className="font-mono text-[10px] font-bold uppercase tracking-wider text-[#64748B]">
              EXCHANGE DESTINATION
            </span>
          </div>

          <div className="mt-4">
            <span className="block text-xs font-bold uppercase tracking-wider text-[#64748B]">
              Primary Attributed VASP
            </span>
            <div className="flex items-baseline justify-between gap-2 mt-1">
              <h3 className="text-2xl lg:text-3xl font-extrabold text-[#0F172A] tracking-tight truncate">
                {primaryVasp?.vasp_name || (hasData ? 'Direct Unhosted Wallet' : 'Awaiting Target')}
              </h3>
              <span className={`shrink-0 text-xs font-mono font-bold px-2.5 py-1 rounded-full border ${
                primaryVasp ? 'bg-sky-50 text-sky-700 border-sky-200' : 'bg-slate-50 text-slate-600 border-slate-200'
              }`}>
                {primaryVasp ? `${primaryVasp.score.toFixed(0)}% MATCH` : hasData ? 'UNATTRIBUTED' : '—'}
              </span>
            </div>
          </div>
        </div>

        <div className="mt-4 pt-3 border-t border-[#F1F5F9] text-xs font-medium text-[#64748B] flex items-center justify-between">
          <span>
            {primaryVasp ? `${primaryVasp.evidence_strength || 'EVIDENCE'} Confidence Cluster` : hasData ? 'Self-Custody Cluster' : 'Standby for input'}
          </span>
          <span className="font-mono text-[11px] font-bold text-[#0F172A]">
            {primaryVasp ? `${primaryVasp.metrics?.shortest_hop || 1}-HOP TRANSIT` : `${maxHops} HOPS EVALUATED`}
          </span>
        </div>
      </div>

      {/* 2. Composite Risk KPI Card */}
      <div className="bg-white text-[#0F172A] border border-[#E2E8F0] rounded-2xl p-6 flex flex-col justify-between shadow-sm hover:shadow-md transition-all">
        <div>
          <div className="flex items-center justify-between">
            <div className={`h-9 w-9 rounded-xl flex items-center justify-center border ${
              riskScore && riskScore >= 50 ? 'bg-rose-50 border-rose-200' : 'bg-emerald-50 border-emerald-200'
            }`}>
              <AlertTriangle className={`h-5 w-5 stroke-[2.3] ${
                riskScore && riskScore >= 50 ? 'text-[#EF4444]' : 'text-[#10B981]'
              }`} />
            </div>
            <span className="font-mono text-[10px] font-bold uppercase tracking-wider text-[#64748B]">
              CRIME SEVERITY
            </span>
          </div>

          <div className="mt-4">
            <span className="block text-xs font-bold uppercase tracking-wider text-[#64748B]">
              Forensic Risk Rating
            </span>
            <div className="flex items-baseline justify-between gap-2 mt-1">
              <h3 className="text-2xl lg:text-3xl font-extrabold text-[#0F172A] tracking-tight">
                {riskScore !== null ? Math.round(riskScore) : '—'}{' '}
                <span className="text-base font-semibold text-[#94A3B8]">/ 100</span>
              </h3>
              <span className={`shrink-0 text-xs font-mono font-bold px-2.5 py-1 rounded-full border ${
                riskLevel === 'CRITICAL' || riskLevel === 'HIGH'
                  ? 'bg-rose-50 text-rose-700 border-rose-200'
                  : riskLevel === 'MEDIUM'
                  ? 'bg-amber-50 text-amber-700 border-amber-200'
                  : 'bg-emerald-50 text-emerald-700 border-emerald-200'
              }`}>
                {riskLevel.toUpperCase()}
              </span>
            </div>
          </div>
        </div>

        <div className="mt-4 pt-3 border-t border-[#F1F5F9] text-xs font-medium text-[#64748B] flex items-center justify-between">
          <span className="truncate max-w-[210px]">{topSignal}</span>
          <span className="font-mono text-[11px] font-bold text-[#0F172A]">
            {signalsCount > 0 ? `${signalsCount} VERIFIED SIGNALS` : hasData ? 'NO RISK SIGNALS' : 'AWAITING TRACE'}
          </span>
        </div>
      </div>

      {/* 3. Freeze & Seizure Value KPI Card */}
      <div className="bg-white text-[#0F172A] border border-[#E2E8F0] rounded-2xl p-6 flex flex-col justify-between shadow-sm hover:shadow-md transition-all">
        <div>
          <div className="flex items-center justify-between">
            <div className="h-9 w-9 rounded-xl bg-emerald-50 border border-emerald-200 flex items-center justify-center">
              <Scale className="h-5 w-5 text-[#10B981] stroke-[2.3]" />
            </div>
            <span className="font-mono text-[10px] font-bold uppercase tracking-wider text-[#64748B]">
              RECOVERY VALUATION
            </span>
          </div>

          <div className="mt-4">
            <span className="block text-xs font-bold uppercase tracking-wider text-[#64748B]">
              Statutory Seizure Potential
            </span>
            <div className="flex items-baseline justify-between gap-2 mt-1">
              <h3 className="text-2xl lg:text-3xl font-extrabold text-[#0284C7] tracking-tight truncate">
                {seizureValue > 0 ? formatINR(seizureValue) : (hasData ? '₹0.00' : '—')}
              </h3>
              <span className={`shrink-0 text-xs font-mono font-bold px-2.5 py-1 rounded-full border ${
                seizureValue > 0 ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : 'bg-slate-50 text-slate-600 border-slate-200'
              }`}>
                {seizureValue > 0 ? 'SEC 91 READY' : hasData ? 'CLEAN / 0 VOL' : 'STANDBY'}
              </span>
            </div>
          </div>
        </div>

        <div className="mt-4 pt-3 border-t border-[#F1F5F9] text-xs font-medium text-[#64748B] flex items-center justify-between">
          <span>{hasData ? `${(taintRatio * 100).toFixed(1)}% Proven FIFO Taint` : '0.0% Taint Recorded'}</span>
          <span className="font-mono text-[11px] font-bold text-[#0F172A]">
            {maxHops > 0 ? `${maxHops} DISCLOSURE HOPS` : '0 HOPS REACHED'}
          </span>
        </div>
      </div>
    </section>
  );
};
