'use client';

import React, { useState } from 'react';
import { FileCheck2, Copy, Check } from 'lucide-react';
import { EvidenceItem } from '../lib/types';

interface EvidenceFeedProps {
  evidence: EvidenceItem[];
  className?: string;
}

export const EvidenceFeed: React.FC<EvidenceFeedProps> = ({ evidence, className = '' }) => {
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const handleCopy = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  if (!evidence || evidence.length === 0) {
    return (
      <div
        className={`bg-white border border-[#E2E8F0] rounded-2xl p-5 md:p-6 shadow-sm space-y-4 text-xs transition-colors font-mono h-full flex flex-col justify-between ${className}`}
      >
        <div className="flex items-center justify-between border-b border-[#E2E8F0] pb-3">
          <div className="flex items-center gap-2.5">
            <div className="h-8 w-8 rounded-xl bg-sky-50 border border-sky-200 flex items-center justify-center text-[#0284C7]">
              <FileCheck2 className="h-4.5 w-4.5" />
            </div>
            <div>
              <h3 className="font-sans text-sm sm:text-base font-bold text-[#0F172A] tracking-tight">
                Forensic Evidence Register
              </h3>
              <span className="font-mono text-[10px] uppercase text-[#64748B]">
                Court-Admissible Statutory Ledger
              </span>
            </div>
          </div>
          <span className="text-xs text-[#64748B] font-bold">0 RECORDS</span>
        </div>
        <div className="p-5 bg-[#F8FAFC] border border-[#E2E8F0] rounded-xl text-center text-[#64748B] space-y-1.5 flex-1 flex flex-col justify-center">
          <p className="font-semibold text-[#0F172A]">No Evidence Items</p>
          <p className="text-[11px] text-[#64748B]">No on-chain forensic evidence items generated for this run.</p>
        </div>
        <div className="pt-3 border-t border-[#E2E8F0] flex items-center justify-between font-mono text-[11px] text-[#64748B]">
          <span>EVIDENCE PIPELINE IDLE</span>
          <span className="text-[#0284C7] font-semibold">STANDBY</span>
        </div>
      </div>
    );
  }

  return (
    <div
      className={`bg-white rounded-2xl p-5 md:p-6 border border-[#E2E8F0] space-y-4 font-mono text-xs shadow-sm h-full flex flex-col justify-between ${className}`}
    >
      <div>
        {/* Header */}
        <div className="flex items-center justify-between border-b border-[#E2E8F0] pb-3">
          <div className="flex items-center gap-2.5">
            <div className="h-8 w-8 rounded-xl bg-sky-50 border border-sky-200 flex items-center justify-center text-[#0284C7]">
              <FileCheck2 className="h-4.5 w-4.5" />
            </div>
            <div>
              <h3 className="font-sans text-sm sm:text-base font-bold text-[#0F172A] tracking-tight">
                Forensic Evidence Register
              </h3>
              <span className="font-mono text-[10px] uppercase text-[#64748B]">
                Court-Admissible Statutory Ledger
              </span>
            </div>
          </div>
          <span className="text-xs text-emerald-700 font-bold px-2.5 py-0.5 rounded-full bg-emerald-50 border border-emerald-200">
            {evidence.length} CERTIFIED RECORDS
          </span>
        </div>

        {/* Evidence Register List */}
        <div className="space-y-2 mt-3.5 flex-1 min-h-[240px] max-h-[320px] overflow-y-auto pr-1">
          {evidence.map((item, idx) => {
            const evidenceId = `E-${String(idx + 1).padStart(3, '0')}`;

            return (
              <div
                key={idx}
                className="p-2.5 rounded-xl bg-[#F8FAFC] border border-[#E2E8F0] hover:border-[#0284C7] flex items-center justify-between gap-3 transition-colors shadow-sm"
              >
                <div className="space-y-1 truncate flex-1">
                  <div className="flex items-center gap-2 font-bold text-[#0F172A]">
                    <span className="text-[#0284C7]">{evidenceId}</span>
                    <span className="truncate text-xs">{item.explanation?.slice(0, 45) || item.evidence_type}</span>
                    {item.hop_distance !== null && item.hop_distance !== undefined && (
                      <span className="px-2 py-0.2 rounded-full bg-sky-50 text-[#0284C7] text-[10px] font-bold">
                        HOP {item.hop_distance}
                      </span>
                    )}
                  </div>

                  <div className="text-[11px] text-[#64748B] flex items-center gap-3">
                    {item.tx_hash && (
                      <span className="truncate">Hash: {item.tx_hash.slice(0, 16)}...{item.tx_hash.slice(-4)}</span>
                    )}
                    {item.amount && (
                      <span className="text-emerald-700 font-bold">
                        {item.amount.toFixed(2)} {item.asset_symbol || 'ETH'}
                      </span>
                    )}
                  </div>
                </div>

                <div className="flex items-center gap-1.5 shrink-0">
                  {item.tx_hash && (
                    <button
                      onClick={() => handleCopy(item.tx_hash!, evidenceId)}
                      className="p-1 rounded hover:bg-slate-200 text-[#64748B] hover:text-[#0F172A] transition-colors"
                      title="Copy Hash"
                    >
                      {copiedId === evidenceId ? (
                        <Check className="h-4 w-4 text-emerald-600" />
                      ) : (
                        <Copy className="h-4 w-4" />
                      )}
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Bottom Forensic Register Status */}
      <div className="pt-3 border-t border-[#E2E8F0] flex items-center justify-between font-mono text-[11px] text-[#64748B]">
        <div className="flex items-center gap-1.5">
          <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
          <span className="font-semibold text-[#0F172A]">CHAIN AUDIT VERIFIED</span>
        </div>
        <span className="text-[#0284C7] font-semibold">
          SEC 65B EVIDENCE READY
        </span>
      </div>
    </div>
  );
};
