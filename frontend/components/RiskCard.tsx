'use client';

import React from 'react';
import {
  ShieldAlert,
  Building2,
  ExternalLink,
  ShieldCheck,
  Scale,
  Send,
  CheckCircle2,
  AlertTriangle,
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
}

export const RiskCard: React.FC<RiskCardProps> = ({
  riskAssessment,
  nearestVasp,
  attributions,
  onOpenFreezeModal,
  onOpenDisclosureModal,
}) => {
  // Derive nearest VASP from props or attributions
  const resolvedVasp = nearestVasp || (attributions && attributions.length > 0
    ? {
        name: attributions[0].vasp_name,
        confidence: attributions[0].score,
        hop: attributions[0].metrics?.shortest_hop || 1,
      }
    : null);

  if (!riskAssessment) {
    return (
      <div className="bg-forensic-surface border border-forensic-border rounded p-4 text-xs transition-colors font-mono">
        <div className="flex items-center space-x-2 border-b border-forensic-border pb-2.5 mb-2">
          <ShieldAlert className="h-4 w-4 text-forensic-textDim" />
          <h3 className="uppercase font-bold text-forensic-text text-xs tracking-wider">
            Risk & Attribution Panel
          </h3>
        </div>
        <p className="text-forensic-textDim text-[11px]">Assessment pending pipeline completion.</p>
      </div>
    );
  }

  const { risk_level, score, indicators, explanation } = riskAssessment;

  const getRiskBadge = (level: string) => {
    switch (level.toUpperCase()) {
      case 'CRITICAL':
      case 'HIGH':
        return 'bg-red-500/15 text-forensic-rose border-red-500/30';
      case 'MEDIUM':
        return 'bg-amber-500/15 text-forensic-amber border-amber-500/30';
      default:
        return 'bg-teal-500/15 text-forensic-teal border-teal-500/30';
    }
  };

  const getScoreColor = (val: number) => {
    if (val >= 75) return 'text-red-400';
    if (val >= 45) return 'text-amber-400';
    return 'text-teal-400';
  };

  return (
    <div className="bg-forensic-surface border border-forensic-border rounded shadow-sm text-xs space-y-3.5 p-4 transition-colors">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-forensic-border pb-2.5">
        <div className="flex items-center space-x-2">
          <ShieldAlert className="h-4 w-4 text-amber-400" />
          <h3 className="font-mono uppercase font-bold text-forensic-text text-xs tracking-wider">
            Structural Risk & Attribution Panel
          </h3>
        </div>
        <span className={`px-2 py-0.5 rounded font-mono font-bold text-[10px] border uppercase ${getRiskBadge(risk_level)}`}>
          {risk_level} RISK RATING
        </span>
      </div>

      {/* Composite Risk Index & Progress Meter */}
      <div className="p-3 bg-forensic-bg border border-forensic-border rounded space-y-2 font-mono text-[11px]">
        <div className="flex items-center justify-between">
          <span className="text-forensic-textDim uppercase text-[10px] font-semibold">Composite Risk Score</span>
          <span className={`font-bold text-sm ${getScoreColor(score)}`}>
            {score.toFixed(1)} <span className="text-[10px] text-forensic-textDim">/ 100</span>
          </span>
        </div>

        {/* Linear Risk Gauge */}
        <div className="w-full bg-forensic-surfaceRaised h-2 rounded-full overflow-hidden border border-forensic-border">
          <div
            className={`h-full rounded-full transition-all duration-500 ${
              score >= 75 ? 'bg-red-500' : score >= 45 ? 'bg-amber-400' : 'bg-teal-400'
            }`}
            style={{ width: `${Math.min(100, Math.max(5, score))}%` }}
          />
        </div>

        <p className="text-forensic-textMuted font-sans text-xs leading-relaxed pt-1">
          {explanation}
        </p>
      </div>

      {/* Nearest Labeled VASP Section (Acceptance Criteria Requirement) */}
      <div className="p-3 bg-gradient-to-r from-teal-950/20 to-blue-950/20 border border-teal-500/30 rounded space-y-2 font-mono">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-1.5 text-teal-400">
            <Building2 className="h-4 w-4" />
            <span className="text-[10px] uppercase font-bold tracking-wider">Nearest Labeled VASP Endpoint</span>
          </div>
          <span className="text-[9px] px-1.5 py-0.2 rounded bg-teal-500/10 text-teal-400 border border-teal-500/20 uppercase font-semibold">
            Off-Ramp Target
          </span>
        </div>

        {resolvedVasp ? (
          <div className="flex items-center justify-between pt-1">
            <div>
              <div className="text-sm font-bold text-forensic-text flex items-center space-x-2">
                <span className="text-teal-400">{resolvedVasp.name}</span>
                <span className="text-[10px] text-forensic-textDim font-normal">
                  ({resolvedVasp.hop} {resolvedVasp.hop === 1 ? 'hop away' : 'hops away'})
                </span>
              </div>
              <div className="text-[10px] text-forensic-textDim pt-0.5">
                FIU-IND Registered • Lawful Disclosure Route Ready
              </div>
            </div>

            <div className="text-right">
              <div className="text-sm font-bold text-teal-400">
                {resolvedVasp.confidence.toFixed(1)}%
              </div>
              <span className="text-[9px] text-forensic-textDim uppercase">Confidence</span>
            </div>
          </div>
        ) : (
          <div className="text-[11px] text-forensic-textDim italic pt-1">
            Evaluating nearest exchange counterparty...
          </div>
        )}
      </div>

      {/* Observed Behavioral Signals Matrix */}
      <div className="space-y-1.5 font-mono">
        <span className="text-[10px] uppercase text-forensic-textDim font-semibold block">
          Contributing Analytical Signals ({indicators.length}):
        </span>

        <div className="space-y-1 text-[11px]">
          {indicators.map((ind, idx) => (
            <div
              key={idx}
              className="flex items-center justify-between p-2 rounded bg-forensic-bg/60 border border-forensic-borderMuted hover:border-forensic-border transition-colors"
            >
              <div className="flex items-center space-x-2 truncate">
                <span className="text-amber-400/80 text-[10px] font-bold">SIG-0{idx + 1}</span>
                <span className="text-forensic-text truncate">{ind}</span>
              </div>
              <span className="text-[9px] px-1.5 py-0.2 rounded bg-red-500/10 text-red-400 border border-red-500/20 font-bold flex-shrink-0">
                ACTIVE
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* Immediate LEA Action Buttons */}
      <div className="pt-2 border-t border-forensic-border grid grid-cols-2 gap-2 font-mono">
        {onOpenFreezeModal && (
          <button
            type="button"
            onClick={onOpenFreezeModal}
            className="flex items-center justify-center space-x-1.5 px-2.5 py-1.5 rounded bg-red-700 hover:bg-red-600 text-white font-medium text-[11px] transition-colors shadow-sm"
          >
            <Scale className="h-3.5 w-3.5" />
            <span>Sec 91 Freeze</span>
          </button>
        )}

        {onOpenDisclosureModal && (
          <button
            type="button"
            onClick={onOpenDisclosureModal}
            className="flex items-center justify-center space-x-1.5 px-2.5 py-1.5 rounded bg-teal-700 hover:bg-teal-600 text-white font-medium text-[11px] transition-colors shadow-sm"
          >
            <Send className="h-3.5 w-3.5" />
            <span>SAHYOG Request</span>
          </button>
        )}
      </div>
    </div>
  );
};
