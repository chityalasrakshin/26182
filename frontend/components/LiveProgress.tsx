'use client';

import React, { useState, useEffect } from 'react';
import { CheckCircle2, Activity, AlertCircle, RotateCcw } from 'lucide-react';
import { AnalysisStatus } from '../lib/types';

interface LiveProgressProps {
  status: AnalysisStatus;
}

interface PipelineStage {
  key: string;
  stepNum: number;
  title: string;
  subtitle: string;
  desc: string;
}

const STAGES: PipelineStage[] = [
  {
    key: 'FETCHING_DATA',
    stepNum: 1,
    title: 'Blockchain Ingestion',
    subtitle: 'Block Explorer Query',
    desc: 'Extracting live EVM / Tron counterparties & token transfers',
  },
  {
    key: 'BUILDING_GRAPH',
    stepNum: 2,
    title: 'Graph Construction',
    subtitle: 'Directed Multi-Hop',
    desc: 'Synthesizing multi-hop counterparty network & peeling chains',
  },
  {
    key: 'ANALYZING',
    stepNum: 3,
    title: 'VASP Attribution',
    subtitle: 'Cluster Heuristics',
    desc: 'Evaluating decay, sweep consolidation & institutional wallets',
  },
  {
    key: 'COMPLETED',
    stepNum: 4,
    title: 'Dossier Synthesized',
    subtitle: 'Evidence Ready',
    desc: 'Section 91 CrPC notice & forensic dossier compiled',
  },
];

export const LiveProgress: React.FC<LiveProgressProps> = ({ status }) => {
  const getStageIndex = (st: string) => {
    switch (st) {
      case 'QUEUED':
      case 'FETCHING_DATA':
        return 0;
      case 'BUILDING_GRAPH':
        return 1;
      case 'ANALYZING':
        return 2;
      case 'COMPLETED':
        return 3;
      default:
        return 0;
    }
  };

  const currentIndex = getStageIndex(status.status);
  const isFailed = status.status === 'FAILED';
  const isCompleted = status.status === 'COMPLETED';

  return (
    <div className="bg-[#F8FAFC] border border-[#E2E8F0] rounded-2xl p-5 md:p-6 shadow-sm space-y-6 transition-all">
      {/* Top Header Bar */}
      <div className="flex flex-wrap items-center justify-between gap-3 pb-4 border-b border-[#E2E8F0]">
        <div className="flex items-center gap-3">
          <div className="w-7 h-7 rounded-lg bg-sky-50 border border-sky-200 flex items-center justify-center">
            <Activity className="h-4 w-4 text-[#0284C7]" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="font-mono text-xs uppercase font-bold text-[#0F172A] tracking-wider">
                Investigation Pipeline Status
              </span>
              <span
                className={`px-2.5 py-0.5 rounded-full text-[10px] font-mono font-bold flex items-center gap-1.5 uppercase transition-colors ${
                  isFailed
                    ? 'bg-rose-50 text-rose-700 border border-rose-200'
                    : isCompleted
                      ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                      : 'bg-sky-50 text-sky-700 border border-sky-200'
                }`}
              >
                <span
                  className={`w-1.5 h-1.5 rounded-full ${
                    isFailed
                      ? 'bg-[#EF4444]'
                      : isCompleted
                        ? 'bg-[#10B981]'
                        : 'bg-[#0284C7] animate-ping'
                  }`}
                />
                {isFailed
                  ? 'ANALYSIS FAILED'
                  : isCompleted
                    ? 'COMPLETED & SYNCED'
                    : status.status}
              </span>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-4 font-mono text-xs text-[#64748B]">
          <div className="hidden sm:flex items-center gap-3">
            <span>
              Observed Tx: <strong className="text-[#0F172A]">{status.num_transactions || 0}</strong>
            </span>
            <span className="text-[#CBD5E1]">•</span>
            <span>
              Network Nodes: <strong className="text-[#0F172A]">{status.num_nodes || 1}</strong>
            </span>
            <span className="text-[#CBD5E1]">•</span>
            <span>
              Edges: <strong className="text-[#0F172A]">{status.num_edges || 0}</strong>
            </span>
            <span className="text-[#CBD5E1]">•</span>
            <span>
              Heuristic Pass:{' '}
              <strong className="text-[#0284C7]">
                {currentIndex + 1}/4
              </strong>
            </span>
          </div>
        </div>
      </div>

      {/* SYNCHRONIZED 4-STEP PROGRESS BAR */}
      <div className="w-full pt-2 pb-1">
        <div className="grid grid-cols-4 gap-3 relative items-center">
          {STAGES.map((stage, idx) => {
            const isDone = currentIndex > idx || isCompleted;
            const isCurrent = currentIndex === idx && !isCompleted && !isFailed;
            const isPending = currentIndex < idx && !isCompleted;
            const isStepFailed = isFailed && currentIndex === idx;

            return (
              <div key={stage.key} className="relative flex items-center justify-center">
                {/* Connecting Track between this Node and the next Node */}
                {idx < 3 && (
                  <div
                    className="absolute top-1/2 -translate-y-1/2 left-1/2 z-0 pointer-events-none"
                    style={{ width: 'calc(100% + 0.75rem)' }}
                  >
                    {/* Background track */}
                    <div className="w-full h-1.5 bg-[#E2E8F0] rounded-full overflow-hidden relative">
                      {/* Active fill line */}
                      <div
                        className={`h-full bg-[#0284C7] rounded-full transition-all duration-700 ease-out relative ${
                          isDone ? 'shadow-sm' : ''
                        }`}
                        style={{
                          width: isDone ? '100%' : '0%',
                        }}
                      >
                        {isDone && (
                          <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/40 to-transparent animate-stepper-shimmer opacity-75" />
                        )}
                      </div>
                    </div>
                  </div>
                )}

                {/* Circular Numbered Node (1, 2, 3, 4) */}
                <div className="relative z-10 flex flex-col items-center group">
                  <div
                    className={`relative w-9 h-9 sm:w-10 sm:h-10 rounded-full flex items-center justify-center transition-all duration-300 ${
                      isStepFailed
                        ? 'bg-rose-50 border-2 border-[#EF4444] text-[#EF4444] shadow-sm'
                        : isDone
                          ? 'bg-[#10B981] border-2 border-[#10B981] text-white shadow-sm animate-stepper-pop'
                          : isCurrent
                            ? 'bg-white border-2 border-[#0284C7] text-[#0284C7] shadow-md'
                            : 'bg-white border-2 border-[#CBD5E1] text-[#94A3B8] hover:border-[#94A3B8]'
                    }`}
                  >
                    {/* Active Step dash ring */}
                    {isCurrent && (
                      <>
                        <svg
                          className="absolute -inset-1.5 w-[calc(100%+12px)] h-[calc(100%+12px)] animate-stepper-spin pointer-events-none"
                          viewBox="0 0 44 44"
                        >
                          <circle
                            cx="22"
                            cy="22"
                            r="19"
                            fill="none"
                            stroke="#0284C7"
                            strokeWidth="2"
                            strokeDasharray="32 75"
                            strokeLinecap="round"
                          />
                        </svg>
                        <span className="absolute -inset-1 rounded-full border border-[#0284C7] animate-ping opacity-40 pointer-events-none" />
                      </>
                    )}

                    {/* Step Number */}
                    <span
                      className={`font-mono text-sm select-none transition-all ${
                        isDone
                          ? 'font-black text-white'
                          : isCurrent
                            ? 'font-black text-[#0284C7]'
                            : 'font-extrabold text-[#94A3B8]'
                      }`}
                    >
                      {stage.stepNum}
                    </span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* PIPELINE STEP CARDS */}
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3 font-mono">
        {STAGES.map((stage, idx) => {
          const isDone = currentIndex > idx || isCompleted;
          const isCurrent = currentIndex === idx && !isCompleted && !isFailed;
          const isPending = currentIndex < idx && !isCompleted;
          const isStepFailed = isFailed && currentIndex === idx;

          return (
            <div
              key={stage.key}
              className={`p-3.5 rounded-xl border text-left transition-all duration-300 relative flex flex-col justify-between ${
                isStepFailed
                  ? 'bg-white border-rose-300 shadow-sm text-[#0F172A]'
                  : isDone
                    ? 'bg-white border-[#E2E8F0] hover:border-[#CBD5E1] text-[#0F172A] shadow-xs'
                    : isCurrent
                      ? 'bg-white border-[#0284C7] shadow-sm text-[#0F172A]'
                      : 'bg-[#F8FAFC] border-[#E2E8F0] text-[#64748B] opacity-75'
              }`}
            >
              <div>
                {/* Step Header Badge & Status Tag */}
                <div className="flex items-center justify-between mb-2">
                  <span
                    className={`text-[10px] font-bold px-2 py-0.5 rounded ${
                      isDone
                        ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                        : isCurrent
                          ? 'bg-sky-50 text-sky-700 border border-sky-200'
                          : 'bg-[#F1F5F9] text-[#64748B] border border-[#E2E8F0]'
                    }`}
                  >
                    STEP 0{stage.stepNum}
                  </span>

                  {isDone ? (
                    <span className="flex items-center gap-1 text-[10px] text-emerald-700 font-semibold">
                      <CheckCircle2 className="h-3.5 w-3.5" />
                      <span>SYNCED</span>
                    </span>
                  ) : isCurrent ? (
                    <span className="flex items-center gap-1.5 text-[10px] text-[#0284C7] font-semibold">
                      <span className="w-1.5 h-1.5 rounded-full bg-[#0284C7] animate-ping" />
                      <span>RUNNING</span>
                    </span>
                  ) : (
                    <span className="text-[10px] text-[#94A3B8]">PENDING</span>
                  )}
                </div>

                {/* Title and Subtitle */}
                <div className="font-bold text-xs text-[#0F172A] tracking-tight">
                  {stage.title}
                </div>
                <div className="text-[10px] text-[#0284C7] font-medium mb-1">
                  {stage.subtitle}
                </div>

                {/* Description */}
                <div className="text-[11px] text-[#64748B] leading-tight mt-1">
                  {stage.desc}
                </div>
              </div>

              {/* Progress Bottom Bar Indicator */}
              <div className="mt-3 pt-2 border-t border-[#F1F5F9] flex items-center justify-between text-[10px]">
                <span className="text-[#64748B]">Status:</span>
                <span
                  className={`font-semibold ${
                    isDone
                      ? 'text-emerald-700'
                      : isCurrent
                        ? 'text-[#0284C7]'
                        : 'text-[#94A3B8]'
                  }`}
                >
                  {isDone
                    ? '100% Attributed'
                    : isCurrent
                      ? 'In Progress...'
                      : 'Awaiting Pipeline'}
                </span>
              </div>
            </div>
          );
        })}
      </div>

      {/* Failure Diagnostic Alert */}
      {isFailed && (
        <div className="p-3 bg-rose-50 border border-rose-200 text-rose-700 rounded-xl text-xs font-mono flex items-center space-x-2.5 shadow-xs">
          <AlertCircle className="h-4 w-4 flex-shrink-0 text-rose-600" />
          <span>
            Pipeline Analysis Exception: {status.error_message || 'Forensic verification failed for target wallet.'}
          </span>
        </div>
      )}
    </div>
  );
};
