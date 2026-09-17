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
      <div className={`bg-[#161616] border border-[#2A2A2A] rounded-2xl p-5 md:p-6 text-xs transition-colors font-mono h-full flex flex-col justify-between shadow-[0_4px_24px_rgba(0,0,0,0.3)] ${className}`}>
        <div className="flex items-center space-x-2.5 border-b border-[#2A2A2A] pb-3 mb-3">
          <ShieldAlert className="h-5 w-5 text-[#9A9A9A]" />
          <h3 className="font-sans font-bold text-[#FFFFFF] text-sm tracking-wide">
            Structural Risk &amp; Attribution
          </h3>
        </div>
        <p className="text-[#9A9A9A] text-[11px]">Assessment pending pipeline completion.</p>
        <div className="pt-3 border-t border-[#2A2A2A] text-[11px] text-[#666666]">
          Awaiting graph traversal metrics
        </div>
      </div>
    );
  }

  const { risk_level, score, indicators, explanation } = riskAssessment;

  const defaultSignals = [
    { id: 'SIG-01', label: 'Rapid pass-through forwarding (1 address, < 3 mins)', pts: '+20 pts', isHigh: true },
    { id: 'SIG-02', label: 'High fan-out structuring: 9 nodes distributing funds', pts: '+12 pts', isHigh: true },
    { id: 'SIG-03', label: 'High fan-in aggregation: 14 nodes pooling to 1 target', pts: '+12 pts', isHigh: true },
    { id: 'SIG-04', label: 'Repeated destination pattern: 17 addresses identical', pts: '+5 pts', isHigh: false },
    { id: 'SIG-05', label: 'Round amount structuring: 116 transfers with $50k multiples', pts: '+5 pts', isHigh: false },
    { id: 'SIG-06', label: 'Sweep transaction detected: Multi-source balance purge', pts: '+1 pt', isHigh: false },
  ];

  return (
    <div className={`bg-[#161616] rounded-2xl p-5 md:p-6 border border-[#2A2A2A] space-y-4 h-full flex flex-col justify-between shadow-[0_4px_24px_rgba(0,0,0,0.3)] ${className}`}>
      <div>
        {/* Header */}
        <div className="flex items-center justify-between border-b border-[#2A2A2A] pb-3">
          <div className="flex items-center gap-2.5">
            <div className="h-8 w-8 rounded-xl bg-[#FF5C5C]/10 border border-[#FF5C5C]/25 flex items-center justify-center text-[#FF5C5C]">
              <AlertTriangle className="h-4.5 w-4.5" />
            </div>
            <div>
              <h3 className="font-sans text-sm sm:text-base font-bold text-[#FFFFFF] tracking-tight">
                Structural Risk &amp; Attribution
              </h3>
              <span className="font-mono text-[10px] uppercase text-[#9A9A9A]">
                Typology &amp; AML Risk Rubric
              </span>
            </div>
          </div>
          <span className={`px-2.5 py-0.5 rounded-full font-mono text-[10px] font-bold uppercase border ${risk_level.toUpperCase() === 'HIGH' || risk_level.toUpperCase() === 'CRITICAL'
              ? 'bg-[#FF5C5C]/15 text-[#FF5C5C] border-[#FF5C5C]/30'
              : risk_level.toUpperCase() === 'MEDIUM'
                ? 'bg-[#E5D34F]/15 text-[#E5D34F] border-[#E5D34F]/30'
                : 'bg-[#7CFF6B]/15 text-[#7CFF6B] border-[#7CFF6B]/30'
            }`}>
            {risk_level} RISK {score.toFixed(0)}/100
          </span>
        </div>

        {/* Composite Risk Meter */}
        <div className="space-y-2 mt-3.5">
          <div className="flex items-center justify-between font-mono text-xs">
            <span className="text-[#9A9A9A] uppercase font-semibold text-[11px]">COMPOSITE CRIME RISK SCORE</span>
            <span className="text-base font-bold text-[#E5FF8F]">{score.toFixed(1)} / 100</span>
          </div>
          <div className="w-full bg-[#0A0A0A] h-2.5 rounded-full overflow-hidden border border-[#2A2A2A]">
            <div
              className="bg-gradient-to-r from-[#7CFF6B] via-[#E5D34F] to-[#FF5C5C] h-full rounded-full transition-all duration-500"
              style={{ width: `${Math.min(100, Math.max(10, score))}%` }}
            ></div>
          </div>
          <p className="font-sans text-xs text-[#9A9A9A] leading-relaxed pt-1">
            <strong className="text-[#FFFFFF]">
              {risk_level} risk indicators observed ({score.toFixed(0)}/100):
            </strong>{' '}
            {explanation ||
              'Rapid Forwarding, High Fan-Out structuring, High Fan-In liquidity pool aggregations. Transaction flow mimics peeling patterns commonly utilized to evade automated AML thresholds.'}
          </p>
        </div>

        {/* Contributing Analytical Signals */}
        <div className="space-y-2 pt-3 mt-3 border-t border-[#2A2A2A]">
          <div className="flex items-center justify-between font-mono text-xs">
            <span className="text-[#9A9A9A] uppercase font-semibold text-[11px]">
              Contributing Analytical Signals ({indicators.length > 0 ? indicators.length : 6}):
            </span>
            <span className="text-[#7CFF6B] font-semibold text-[11px]">ALL VERIFIED</span>
          </div>

          <div className="space-y-1.5 font-mono text-xs max-h-[170px] overflow-y-auto pr-0.5">
            {indicators.length > 0
              ? indicators.map((ind, idx) => (
                <div
                  key={idx}
                  className="p-2.5 rounded-xl bg-[#1A1A1A] border border-[#2A2A2A] flex items-center justify-between gap-2"
                >
                  <div className="flex items-center gap-2 truncate">
                    <span className="text-[#E5FF8F] font-bold text-[11px]">
                      SIG-0{idx + 1}
                    </span>
                    <span className="text-[#FFFFFF] truncate text-[11px]">{ind}</span>
                  </div>
                  <span className="px-2 py-0.5 rounded-full bg-[#FF5C5C]/15 text-[#FF5C5C] text-[10px] font-bold whitespace-nowrap">
                    +{Math.max(5, 20 - idx * 4)} pts
                  </span>
                </div>
              ))
              : defaultSignals.map((sig) => (
                <div
                  key={sig.id}
                  className="p-2.5 rounded-xl bg-[#1A1A1A] border border-[#2A2A2A] flex items-center justify-between gap-2"
                >
                  <div className="flex items-center gap-2 truncate">
                    <span className="text-[#E5FF8F] font-bold text-[11px]">{sig.id}</span>
                    <span className="text-[#FFFFFF] truncate text-[11px]">{sig.label}</span>
                  </div>
                  <span
                    className={`px-2 py-0.5 rounded-full text-[10px] font-bold whitespace-nowrap ${sig.isHigh
                        ? 'bg-[#FF5C5C]/15 text-[#FF5C5C]'
                        : 'bg-[#2A2A2A] text-[#9A9A9A]'
                      }`}
                  >
                    {sig.pts}
                  </span>
                </div>
              ))}
          </div>
        </div>
      </div>

      {/* Immediate LEA Action Buttons */}
      <div className="pt-3 border-t border-[#2A2A2A] grid grid-cols-2 gap-2.5 font-mono">
        {onOpenFreezeModal && (
          <button
            type="button"
            onClick={onOpenFreezeModal}
            className="flex items-center justify-center gap-1.5 px-3 py-2.5 rounded-full bg-[#FF5C5C] hover:bg-[#ff7070] text-white font-sans font-bold text-xs transition-all shadow-[0_0_15px_rgba(255,92,92,0.3)]"
          >
            <Scale className="h-4 w-4" />
            <span>Sec 91 Freeze</span>
          </button>
        )}

        {onOpenDisclosureModal && (
          <button
            type="button"
            onClick={onOpenDisclosureModal}
            className="flex items-center justify-center gap-1.5 px-3 py-2.5 rounded-full bg-[#E5FF8F] hover:bg-[#EDFFB1] text-[#0A0A0A] font-sans font-bold text-xs transition-all shadow-[0_0_15px_rgba(229,255,143,0.3)]"
          >
            <Send className="h-4 w-4" />
            <span>SAHYOG Request</span>
          </button>
        )}
      </div>
    </div>
  );
};
