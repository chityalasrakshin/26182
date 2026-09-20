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
  const primaryVasp = attributions.length > 0 ? attributions[0] : null;
  const riskLevel = riskAssessment?.risk_level || 'PENDING';
  const riskScore = riskAssessment?.composite_risk_score ?? riskAssessment?.score ?? null;

  const taintRatio = graphData?.stats?.taint_summary?.overall_taint_ratio ?? null;
  const inrVal = totalVolumeInr > 0 ? totalVolumeInr : (graphData?.stats?.total_amount_inr ?? null);

  const formatINR = (val: number) => {
    if (val >= 10000000) return '₹' + (val / 10000000).toFixed(2) + ' Cr';
    if (val >= 100000) return '₹' + (val / 100000).toFixed(2) + ' L';
    return '₹' + Math.round(val).toLocaleString('en-IN');
  };

  return (
    <section className="grid grid-cols-1 md:grid-cols-3 gap-5 font-sans select-none">
      {/* 1. Attributed VASP KPI Card */}
      <div className="bg-[#E5FF8F] text-[#0A0A0A] rounded-2xl p-6 flex flex-col justify-between shadow-[0_4px_24px_rgba(229,255,143,0.12)] transition-all hover:shadow-[0_8px_32px_rgba(229,255,143,0.22)]">
        <div>
          <div className="flex items-center justify-between">
            <div className="h-9 w-9 rounded-xl bg-[#0A0A0A]/10 flex items-center justify-center">
              <ShieldCheck className="h-5 w-5 text-[#0A0A0A] stroke-[2.3]" />
            </div>
            <span className="font-mono text-[10px] font-bold uppercase tracking-wider text-[#0A0A0A]/70">
              EXCHANGE DESTINATION
            </span>
          </div>

          <div className="mt-4">
            <span className="block text-xs font-bold uppercase tracking-wider text-[#0A0A0A]/70">
              Primary Attributed VASP
            </span>
            <div className="flex items-baseline justify-between gap-2 mt-1">
              <h3 className="text-2xl lg:text-3xl font-extrabold text-[#0A0A0A] tracking-tight truncate">
                {primaryVasp?.vasp_name || 'No VASP attributed'}
              </h3>
              <span className="shrink-0 bg-[#0A0A0A] text-[#E5FF8F] text-xs font-mono font-bold px-2.5 py-1 rounded-full">
                {primaryVasp ? `${primaryVasp.score.toFixed(0)}%` : '—'} MATCH
              </span>
            </div>
          </div>
        </div>

        <div className="mt-4 pt-3 border-t border-[#0A0A0A]/10 text-xs font-medium text-[#0A0A0A]/80 flex items-center justify-between">
          <span>{primaryVasp ? `${primaryVasp.evidence_strength} Confidence Cluster` : 'Awaiting attribution'}</span>
          <span className="font-mono text-[11px] font-bold">{primaryVasp?.metrics?.shortest_hop != null ? `${primaryVasp.metrics.shortest_hop}-HOP TRANSIT` : '—'}</span>
        </div>
      </div>

      {/* 2. Composite Risk KPI Card */}
      <div className="bg-[#E5FF8F] text-[#0A0A0A] rounded-2xl p-6 flex flex-col justify-between shadow-[0_4px_24px_rgba(229,255,143,0.12)] transition-all hover:shadow-[0_8px_32px_rgba(229,255,143,0.22)]">
        <div>
          <div className="flex items-center justify-between">
            <div className="h-9 w-9 rounded-xl bg-[#0A0A0A]/10 flex items-center justify-center">
              <AlertTriangle className="h-5 w-5 text-[#0A0A0A] stroke-[2.3]" />
            </div>
            <span className="font-mono text-[10px] font-bold uppercase tracking-wider text-[#0A0A0A]/70">
              CRIME SEVERITY
            </span>
          </div>

          <div className="mt-4">
            <span className="block text-xs font-bold uppercase tracking-wider text-[#0A0A0A]/70">
              Forensic Risk Rating
            </span>
            <div className="flex items-baseline justify-between gap-2 mt-1">
              <h3 className="text-2xl lg:text-3xl font-extrabold text-[#0A0A0A] tracking-tight">
                {riskScore != null ? riskScore.toFixed(0) : '—'}{' '}
                <span className="text-base font-semibold text-[#0A0A0A]/60">/ 100</span>
              </h3>
              <span className="shrink-0 bg-[#0A0A0A] text-[#E5FF8F] text-xs font-mono font-bold px-2.5 py-1 rounded-full">
                {riskLevel.toUpperCase()}
              </span>
            </div>
          </div>
        </div>

        <div className="mt-4 pt-3 border-t border-[#0A0A0A]/10 text-xs font-medium text-[#0A0A0A]/80 flex items-center justify-between">
          <span>{riskAssessment?.indicators?.[0] || 'Awaiting risk assessment'}</span>
          <span className="font-mono text-[11px] font-bold">{riskAssessment?.indicators?.length || 0} VERIFIED SIGNALS</span>
        </div>
      </div>

      {/* 3. Freeze & Seizure Value KPI Card */}
      <div className="bg-[#E5FF8F] text-[#0A0A0A] rounded-2xl p-6 flex flex-col justify-between shadow-[0_4px_24px_rgba(229,255,143,0.12)] transition-all hover:shadow-[0_8px_32px_rgba(229,255,143,0.22)]">
        <div>
          <div className="flex items-center justify-between">
            <div className="h-9 w-9 rounded-xl bg-[#0A0A0A]/10 flex items-center justify-center">
              <Scale className="h-5 w-5 text-[#0A0A0A] stroke-[2.3]" />
            </div>
            <span className="font-mono text-[10px] font-bold uppercase tracking-wider text-[#0A0A0A]/70">
              RECOVERY VALUATION
            </span>
          </div>

          <div className="mt-4">
            <span className="block text-xs font-bold uppercase tracking-wider text-[#0A0A0A]/70">
              Statutory Seizure Potential
            </span>
            <div className="flex items-baseline justify-between gap-2 mt-1">
              <h3 className="text-2xl lg:text-3xl font-extrabold text-[#0A0A0A] tracking-tight truncate">
                {inrVal != null ? formatINR(inrVal * (taintRatio != null ? taintRatio : 1)) : '—'}
              </h3>
              <span className="shrink-0 bg-[#0A0A0A] text-[#E5FF8F] text-xs font-mono font-bold px-2.5 py-1 rounded-full">
                SEC 91 READY
              </span>
            </div>
          </div>
        </div>

        <div className="mt-4 pt-3 border-t border-[#0A0A0A]/10 text-xs font-medium text-[#0A0A0A]/80 flex items-center justify-between">
          <span>{taintRatio != null ? `${(taintRatio * 100).toFixed(1)}% Proven FIFO Taint` : 'Taint analysis pending'}</span>
          <span className="font-mono text-[11px] font-bold">{graphData?.paths?.[0]?.nodeIds?.length ? `${Math.max(0, graphData.paths[0].nodeIds.length - 1)} DISCLOSURE HOPS` : '— DISCLOSURE HOPS'}</span>
        </div>
      </div>
    </section>
  );
};
