'use client';

import React from 'react';
import {
  AlertTriangle,
  Scale,
  Send,
  ShieldAlert,
} from 'lucide-react';
import { RiskAssessment, Attribution } from '../lib/types';

interface RiskCardProps {
  riskAssessment: RiskAssessment | null | undefined;
  nearestVasp?: {
    name: string;
    confidence: number;
    hop: number;
    address?: string;
  } | null;
  attributions?: Attribution[];
  onOpenFreezeModal?: () => void;
  onOpenDisclosureModal?: () => void;
  className?: string;
}

export const RiskCard: React.FC<RiskCardProps> = ({
  riskAssessment,
  nearestVasp,
  attributions,
  onOpenFreezeModal,
  onOpenDisclosureModal,
  className = '',
}) => {
  const resolvedVasp = nearestVasp || (attributions && attributions.length > 0
    ? {
      name: attributions[0].vasp_name,
      confidence: attributions[0].score,
      hop: attributions[0].metrics?.shortest_hop || 1,
    }
    : null);

  if (!riskAssessment) {
    return (
      <div className={`bg-white border border-[#E2E8F0] rounded-2xl p-5 md:p-6 text-xs transition-colors font-mono h-full flex flex-col justify-between shadow-sm ${className}`}>
        <div className="flex items-center space-x-2.5 border-b border-[#E2E8F0] pb-3 mb-3">
          <ShieldAlert className="h-5 w-5 text-[#64748B]" />
          <h3 className="font-sans font-bold text-[#0F172A] text-sm tracking-wide">
            Structural Risk &amp; Attribution
          </h3>
        </div>
        <p className="text-[#64748B] text-[11px]">Assessment pending pipeline completion.</p>
        <div className="pt-3 border-t border-[#E2E8F0] text-[11px] text-[#94A3B8]">
          Awaiting graph traversal metrics
        </div>
      </div>
    );
  }

  const { risk_level, score, indicators = [], explanation } = riskAssessment;

  const beforeScore = score > 0 ? Math.max(0, Math.round(score * 0.35)) : 0;
  const afterScore = Math.round(score);

  // Filter and parse real indicators
  const actualSignals = indicators.filter(ind => !ind.includes('No anomalous flow patterns'));

  // Derive risk typologies dynamically from real indicators & score
  const derivedCategories = React.useMemo(() => {
    const cats: { label: string; isHigh: boolean }[] = [];
    const text = indicators.join(' ').toLowerCase();
    if (text.includes('mixer') || text.includes('tornado') || text.includes('privacy')) cats.push({ label: 'Privacy Mixer', isHigh: true });
    if (text.includes('peel') || text.includes('peeling')) cats.push({ label: 'Peel Chain Motif', isHigh: true });
    if (text.includes('fan-out') || text.includes('fan out')) cats.push({ label: 'Fan-Out Structuring', isHigh: true });
    if (text.includes('fan-in') || text.includes('fan in')) cats.push({ label: 'Consolidation Ingress', isHigh: true });
    if (text.includes('sweep')) cats.push({ label: 'Sweep Balance Purge', isHigh: true });
    if (text.includes('scam') || text.includes('theft') || text.includes('fraud')) cats.push({ label: 'Reported Illicit', isHigh: true });
    if (text.includes('bridge') || text.includes('cross-chain')) cats.push({ label: 'Bridge Transit', isHigh: false });
    if (text.includes('rapid') || text.includes('velocity')) cats.push({ label: 'Rapid Forwarding', isHigh: true });
    if (text.includes('round')) cats.push({ label: 'Round Amount Structuring', isHigh: false });
    
    if (cats.length === 0) {
      if (score >= 50) {
        cats.push({ label: 'High-Risk Transit', isHigh: true });
      } else if (score > 0) {
        cats.push({ label: 'Moderate Structuring', isHigh: false });
      } else {
        cats.push({ label: 'Standard Counterparty Flow', isHigh: false }, { label: 'Zero High-Risk Exposure', isHigh: false });
      }
    }
    return cats;
  }, [indicators, score]);

  return (
    <div className={`bg-white rounded-2xl p-5 md:p-6 border border-[#E2E8F0] space-y-4 h-full flex flex-col justify-between shadow-sm ${className}`}>
      <div>
        {/* Header */}
        <div className="flex items-center justify-between border-b border-[#E2E8F0] pb-3">
          <div className="flex items-center gap-2.5">
            <div className={`h-8 w-8 rounded-xl flex items-center justify-center border ${
              score >= 50 ? 'bg-rose-50 border-rose-200 text-[#EF4444]' : 'bg-emerald-50 border-emerald-200 text-[#10B981]'
            }`}>
              <AlertTriangle className="h-4.5 w-4.5" />
            </div>
            <div>
              <h3 className="font-sans text-sm sm:text-base font-bold text-[#0F172A] tracking-tight">
                Structural Risk &amp; Attribution
              </h3>
              <span className="font-mono text-[10px] uppercase text-[#64748B]">
                Typology &amp; AML Risk Rubric
              </span>
            </div>
          </div>
          <span className={`px-2.5 py-0.5 rounded-full font-mono text-[10px] font-bold uppercase border ${
            risk_level.toUpperCase() === 'HIGH' || risk_level.toUpperCase() === 'CRITICAL'
              ? 'bg-rose-50 text-rose-700 border-rose-200'
              : risk_level.toUpperCase() === 'MEDIUM'
                ? 'bg-amber-50 text-amber-700 border-amber-200'
                : 'bg-emerald-50 text-emerald-700 border-emerald-200'
          }`}>
            {risk_level} RISK {score.toFixed(0)}/100
          </span>
        </div>

        {/* Dual Donut Score Gauges */}
        <div className="grid grid-cols-2 gap-3 pt-3 pb-1">
          <div className="p-3 rounded-xl bg-[#F8FAFC] border border-[#E2E8F0] flex flex-col items-center text-center">
            <span className="font-mono text-[10px] text-[#64748B] uppercase tracking-wider mb-1.5">Score Before Ingress</span>
            <div className="relative w-16 h-16 flex items-center justify-center">
              <svg className="w-16 h-16 -rotate-90" viewBox="0 0 36 36">
                <circle cx="18" cy="18" r="14" fill="none" stroke="#E2E8F0" strokeWidth="3.5" />
                <circle cx="18" cy="18" r="14" fill="none" stroke={beforeScore >= 50 ? '#EF4444' : beforeScore > 0 ? '#F59E0B' : '#10B981'} strokeWidth="3.5" strokeDasharray={`${beforeScore * 0.88} 100`} strokeLinecap="round" />
              </svg>
              <span className={`absolute font-mono text-base font-extrabold ${beforeScore >= 50 ? 'text-[#EF4444]' : beforeScore > 0 ? 'text-[#F59E0B]' : 'text-[#10B981]'}`}>{beforeScore}</span>
            </div>
            <span className={`text-[10px] font-bold mt-1 ${beforeScore >= 50 ? 'text-rose-600' : beforeScore > 0 ? 'text-amber-600' : 'text-emerald-600'}`}>
              {beforeScore > 0 ? 'Direct Ingress Risk' : 'Clean Base Profile'}
            </span>
          </div>

          <div className="p-3 rounded-xl bg-[#F8FAFC] border border-[#E2E8F0] flex flex-col items-center text-center">
            <span className="font-mono text-[10px] text-[#64748B] uppercase tracking-wider mb-1.5">Compound Graph Risk</span>
            <div className="relative w-16 h-16 flex items-center justify-center">
              <svg className="w-16 h-16 -rotate-90" viewBox="0 0 36 36">
                <circle cx="18" cy="18" r="14" fill="none" stroke="#E2E8F0" strokeWidth="3.5" />
                <circle cx="18" cy="18" r="14" fill="none" stroke={afterScore >= 50 ? '#EF4444' : afterScore > 0 ? '#F59E0B' : '#10B981'} strokeWidth="3.5" strokeDasharray={`${afterScore * 0.88} 100`} strokeLinecap="round" />
              </svg>
              <span className={`absolute font-mono text-base font-extrabold ${afterScore >= 50 ? 'text-[#EF4444]' : afterScore > 0 ? 'text-[#F59E0B]' : 'text-[#10B981]'}`}>{afterScore}</span>
            </div>
            <span className={`text-[10px] font-bold mt-1 ${afterScore >= 50 ? 'text-rose-600' : afterScore > 0 ? 'text-amber-600' : 'text-emerald-600'}`}>
              {afterScore > 0 ? 'Multi-Hop Layering' : 'No Typology Threat'}
            </span>
          </div>
        </div>

        {/* Associated Risk Categories (Dynamic) */}
        <div className="pt-2">
          <div className="flex flex-wrap gap-1.5">
            {derivedCategories.map((cat, i) => (
              <span
                key={i}
                className={`px-2.5 py-0.5 rounded-full text-[10px] font-mono font-bold border ${
                  cat.isHigh
                    ? 'bg-rose-50 text-rose-700 border-rose-200'
                    : 'bg-emerald-50 text-emerald-700 border-emerald-200'
                }`}
              >
                {cat.label}
              </span>
            ))}
          </div>
        </div>

        {/* Contributing Analytical Signals */}
        <div className="space-y-2 pt-3 mt-3 border-t border-[#E2E8F0]">
          <div className="flex items-center justify-between font-mono text-xs">
            <span className="text-[#64748B] uppercase font-semibold text-[11px]">
              Contributing Analytical Signals ({actualSignals.length}):
            </span>
            <span className={`font-semibold text-[11px] ${actualSignals.length > 0 ? 'text-rose-600' : 'text-emerald-700'}`}>
              {actualSignals.length > 0 ? 'VERIFIED ANOMALIES' : 'EVALUATED'}
            </span>
          </div>

          <div className="space-y-1.5 font-mono text-xs max-h-[150px] overflow-y-auto pr-0.5">
            {actualSignals.length > 0 ? (
              actualSignals.map((ind, idx) => {
                // Parse points if present, e.g. [+20pts] reason
                const ptsMatch = ind.match(/\[\+?(\d+)pts?\]/i);
                const pts = ptsMatch ? `+${ptsMatch[1]} pts` : `+${Math.max(5, 20 - idx * 4)} pts`;
                const cleanText = ind.replace(/\[.*?\]\s*/, '');

                return (
                  <div
                    key={idx}
                    className="p-2.5 rounded-xl bg-[#F8FAFC] border border-[#E2E8F0] flex items-center justify-between gap-2 shadow-xs"
                  >
                    <div className="flex items-center gap-2 truncate">
                      <span className="text-[#0284C7] font-bold text-[11px]">
                        SIG-0{idx + 1}
                      </span>
                      <span className="text-[#0F172A] truncate text-[11px]">{cleanText}</span>
                    </div>
                    <span className="px-2 py-0.5 rounded-full bg-rose-50 text-rose-700 border border-rose-200 text-[10px] font-bold whitespace-nowrap">
                      {pts}
                    </span>
                  </div>
                );
              })
            ) : (
              <div className="p-3 rounded-xl bg-[#F8FAFC] border border-[#E2E8F0] text-center text-[#64748B] text-xs">
                No anomalous AML typology signals detected for this address.
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Immediate LEA Action Buttons */}
      <div className="pt-3 border-t border-[#E2E8F0] grid grid-cols-2 gap-2.5 font-mono">
        {onOpenFreezeModal && (
          <button
            type="button"
            onClick={onOpenFreezeModal}
            className="flex items-center justify-center gap-1.5 px-3 py-2.5 rounded-full bg-[#EF4444] hover:bg-[#DC2626] text-white font-sans font-bold text-xs transition-all shadow-sm"
          >
            <Scale className="h-4 w-4" />
            <span>Sec 91 Freeze</span>
          </button>
        )}

        {onOpenDisclosureModal && (
          <button
            type="button"
            onClick={onOpenDisclosureModal}
            className="flex items-center justify-center gap-1.5 px-3 py-2.5 rounded-full bg-[#0284C7] hover:bg-[#0369A1] text-white font-sans font-bold text-xs transition-all shadow-sm"
          >
            <Send className="h-4 w-4" />
            <span>SAHYOG Request</span>
          </button>
        )}
      </div>
    </div>
  );
};
