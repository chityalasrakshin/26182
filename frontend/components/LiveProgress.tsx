'use client';

import React, { useState, useEffect } from 'react';
import { CheckCircle2, Activity, AlertCircle, RotateCcw } from 'lucide-react';
import { AnalysisStatus } from '../lib/types';

interface LiveProgressProps {
  status: AnalysisStatus;
  compact?: boolean;
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

export const LiveProgress: React.FC<LiveProgressProps> = ({ status, compact = false }) => {
  // Simulation / replay state for demoing the synchronized 1 -> 2 -> 3 -> 4 sequence
  const [simulatedStage, setSimulatedStage] = useState<number | null>(null);

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

  const actualIndex = getStageIndex(status.status);
  const currentIndex = simulatedStage !== null ? simulatedStage : actualIndex;
  const isFailed = status.status === 'FAILED' && simulatedStage === null;
  const isCompleted = (status.status === 'COMPLETED' && simulatedStage === null) || simulatedStage === 3;

  // Handle demo replay animation
  const handleReplay = () => {
    setSimulatedStage(0);
  };

  useEffect(() => {
    if (simulatedStage === null) return;
    if (simulatedStage < 3) {
      const timer = setTimeout(() => {
        setSimulatedStage((prev) => (prev !== null && prev < 3 ? prev + 1 : null));
      }, 1500);
      return () => clearTimeout(timer);
    } else {
      // Stay on completed for 3 seconds then return to live status
      const endTimer = setTimeout(() => {
        setSimulatedStage(null);
      }, 3500);
      return () => clearTimeout(endTimer);
    }
  }, [simulatedStage]);

  return (
    <div className={`${compact ? 'bg-[#161616] border-t border-[#2A2A2A] p-2.5 md:p-3 space-y-2' : 'bg-[#161616] border border-[#2A2A2A] rounded-2xl p-5 md:p-6 shadow-[0_8px_30px_rgba(0,0,0,0.5)] space-y-6'} transition-all`}>
      {/* Top Header Bar */}
      <div className={`flex flex-wrap items-center justify-between gap-2 border-b border-[#2A2A2A] ${compact ? 'pb-2' : 'pb-4'}`}>
        <div className="flex items-center gap-3">
          <div className={`${compact ? 'w-6 h-6' : 'w-7 h-7'} rounded-lg bg-[#E5FF8F]/10 border border-[#E5FF8F]/20 flex items-center justify-center`}>
            <Activity className={`${compact ? 'h-3.5 w-3.5' : 'h-4 w-4'} text-[#E5FF8F]`} />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className={`${compact ? 'text-[10px]' : 'text-xs'} font-mono uppercase font-bold text-[#FFFFFF] tracking-wider`}>
                Investigation Pipeline Status
              </span>
              <span
                className={`px-2.5 py-0.5 rounded-full text-[10px] font-mono font-bold flex items-center gap-1.5 uppercase transition-colors ${
                  isFailed
                    ? 'bg-[#FF5C5C]/20 text-[#FF5C5C] border border-[#FF5C5C]/30'
                    : isCompleted
                      ? 'bg-[#E5FF8F]/15 text-[#E5FF8F] border border-[#E5FF8F]/30'
                      : 'bg-[#E5FF8F]/10 text-[#E5FF8F] border border-[#E5FF8F]/20'
                }`}
              >
                <span
                  className={`w-1.5 h-1.5 rounded-full ${
                    isFailed
                      ? 'bg-[#FF5C5C]'
                      : isCompleted
                        ? 'bg-[#E5FF8F]'
                        : 'bg-[#E5FF8F] animate-ping'
                  }`}
                />
                {isFailed
                  ? 'ANALYSIS FAILED'
                  : isCompleted
                    ? 'COMPLETED & SYNCED'
                    : simulatedStage !== null
                      ? `STEP ${simulatedStage + 1} ACTIVE`
                      : status.status}
              </span>
            </div>
          </div>
        </div>

        <div className={`flex items-center font-mono text-[#9A9A9A] ${compact ? 'gap-2 text-[10px]' : 'gap-4 text-xs'}`}>
          <div className="hidden sm:flex items-center gap-3">
            <span>
              Observed Tx: <strong className="text-[#FFFFFF]">{status.num_transactions || 0}</strong>
            </span>
            <span className="text-[#2A2A2A]">•</span>
            <span>
              Network Nodes: <strong className="text-[#FFFFFF]">{status.num_nodes || 1}</strong>
            </span>
            <span className="text-[#2A2A2A]">•</span>
            <span>
              Edges: <strong className="text-[#FFFFFF]">{status.num_edges || 0}</strong>
            </span>
            <span className="text-[#2A2A2A]">•</span>
            <span>
              Heuristic Pass:{' '}
              <strong className="text-[#E5FF8F]">
                {currentIndex + 1}/4
              </strong>
            </span>
          </div>

          {/* Replay Sequence Button for testing/demoing the synchronized animation */}
          {!compact && <button
            onClick={handleReplay}
            title="Replay 4-step pipeline synchronization animation"
            className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-[#1A1A1A] hover:bg-[#222222] border border-[#2A2A2A] hover:border-[#E5FF8F]/50 text-[#9A9A9A] hover:text-[#E5FF8F] text-[11px] transition-all"
          >
            <RotateCcw className="w-3 h-3" />
            <span>{simulatedStage !== null ? 'Replaying...' : 'Replay Animation'}</span>
          </button>}
        </div>
      </div>

      {/* 
        SYNCHRONIZED 4-STEP PROGRESS BAR 
        Matches 4 Step ProgressBar.webm aesthetic:
        - Numbers 1 2 3 4 appear synchronized with each step
        - Connecting horizontal track fills smoothly between nodes
        - Active step features pulsing halo ring + glowing number
        - Completed step pops into solid accent fill with bold dark number
        - Geometrically aligned with the 4 pipeline steps below
      */}
      <div className={`w-full ${compact ? 'pt-0 pb-0' : 'pt-2 pb-1'}`}>
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
                    {/* Background track (dark line) */}
                    <div className="w-full h-1.5 bg-[#2A2A2A] rounded-full overflow-hidden relative">
                      {/* Active fill line (neon accent fill) */}
                      <div
                        className={`h-full bg-[#E5FF8F] rounded-full transition-all duration-700 ease-out relative ${
                          isDone ? 'shadow-[0_0_12px_rgba(229,255,143,0.7)]' : ''
                        }`}
                        style={{
                          width: isDone ? '100%' : '0%',
                        }}
                      >
                        {/* Flowing shimmer beam when this segment just completed */}
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
                    className={`${compact ? 'w-7 h-7 sm:w-8 sm:h-8' : 'w-9 h-9 sm:w-10 sm:h-10'} relative rounded-full flex items-center justify-center transition-all duration-300 ${
                      isStepFailed
                        ? 'bg-[#93000a]/20 border-2 border-[#FF5C5C] text-[#FF5C5C] shadow-[0_0_18px_rgba(255,92,92,0.4)]'
                        : isDone
                          ? 'bg-[#E5FF8F] border-2 border-[#E5FF8F] text-[#0A0A0A] shadow-[0_0_16px_rgba(229,255,143,0.45)] animate-stepper-pop'
                          : isCurrent
                            ? 'bg-[#161616] border-2 border-[#E5FF8F] text-[#E5FF8F] shadow-[0_0_22px_rgba(229,255,143,0.5)]'
                            : 'bg-[#161616] border-2 border-[#2A2A2A] text-[#9A9A9A] hover:border-[#383838]'
                    }`}
                  >
                    {/* Active Step: Rotating dash ring matching the video animation */}
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
                            stroke="#E5FF8F"
                            strokeWidth="2"
                            strokeDasharray="32 75"
                            strokeLinecap="round"
                          />
                        </svg>
                        {/* Outer expanding ping halo */}
                        <span className="absolute -inset-1 rounded-full border border-[#E5FF8F] animate-ping opacity-40 pointer-events-none" />
                      </>
                    )}

                    {/* Step Number (1, 2, 3, 4) */}
                    <span
                      className={`${compact ? 'text-xs' : 'text-sm'} font-mono select-none transition-all ${
                        isDone
                          ? 'font-black text-[#0A0A0A]'
                          : isCurrent
                            ? 'font-black text-[#E5FF8F] drop-shadow-[0_0_8px_rgba(229,255,143,0.8)]'
                            : 'font-extrabold text-[#9A9A9A]'
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

      {/* 
        PIPELINE STEP CARDS 
        Aligned 1:1 with the 4 nodes above in matching grid columns.
      */}
      <div className={`grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 font-mono ${compact ? 'gap-1.5' : 'gap-3'}`}>
        {STAGES.map((stage, idx) => {
          const isDone = currentIndex > idx || isCompleted;
          const isCurrent = currentIndex === idx && !isCompleted && !isFailed;
          const isPending = currentIndex < idx && !isCompleted;
          const isStepFailed = isFailed && currentIndex === idx;

          return (
            <div
              key={stage.key}
              className={`${compact ? 'p-2 rounded-lg' : 'p-3.5 rounded-xl'} border text-left transition-all duration-300 relative flex flex-col justify-between ${
                isStepFailed
                  ? 'bg-[#1A1A1A] border-[#FF5C5C]/60 shadow-[0_0_16px_rgba(255,92,92,0.15)] text-[#FFFFFF]'
                  : isDone
                    ? 'bg-[#161616] border-[#2A2A2A] hover:border-[#383838] text-[#FFFFFF]'
                    : isCurrent
                      ? 'bg-[#1A1A1A] border-[#E5FF8F] shadow-[0_0_18px_rgba(229,255,143,0.12)] text-[#FFFFFF]'
                      : 'bg-[#121212] border-[#2A2A2A]/40 text-[#9A9A9A]/60 opacity-60'
              }`}
            >
              <div>
                {/* Step Header Badge & Status Tag */}
                <div className={`flex items-center justify-between ${compact ? 'mb-1' : 'mb-2'}`}>
                  <span
                    className={`text-[10px] font-bold px-2 py-0.5 rounded ${
                      isDone
                        ? 'bg-[#E5FF8F]/15 text-[#E5FF8F] border border-[#E5FF8F]/30'
                        : isCurrent
                          ? 'bg-[#E5FF8F]/20 text-[#E5FF8F] border border-[#E5FF8F]/40 animate-pulse'
                          : 'bg-[#2A2A2A]/60 text-[#9A9A9A] border border-[#2A2A2A]'
                    }`}
                  >
                    STEP 0{stage.stepNum}
                  </span>

                  {isDone ? (
                    <span className="flex items-center gap-1 text-[10px] text-[#E5FF8F] font-semibold">
                      <CheckCircle2 className="h-3.5 w-3.5" />
                      <span>SYNCED</span>
                    </span>
                  ) : isCurrent ? (
                    <span className="flex items-center gap-1.5 text-[10px] text-[#E5FF8F] font-semibold">
                      <span className="w-1.5 h-1.5 rounded-full bg-[#E5FF8F] animate-ping" />
                      <span>RUNNING</span>
                    </span>
                  ) : (
                    <span className="text-[10px] text-[#9A9A9A]/50">PENDING</span>
                  )}
                </div>

                {/* Title and Subtitle */}
                <div className={`${compact ? 'text-[11px]' : 'text-xs'} font-bold text-[#FFFFFF] tracking-tight`}>
                  {stage.title}
                </div>
                {!compact && <div className="text-[10px] text-[#E5FF8F]/80 font-medium mb-1">
                  {stage.subtitle}
                </div>}

                {/* Description */}
                {!compact && <div className="text-[11px] text-[#9A9A9A] leading-tight mt-1">
                  {stage.desc}
                </div>}
              </div>

              {/* Progress Bottom Bar Indicator on the card */}
              <div className={`${compact ? 'mt-1 pt-1' : 'mt-3 pt-2'} border-t border-[#2A2A2A]/60 flex items-center justify-between text-[10px]`}>
                <span className="text-[#9A9A9A]/80">Status:</span>
                <span
                  className={`font-semibold ${
                    isDone
                      ? 'text-[#E5FF8F]'
                      : isCurrent
                        ? 'text-[#E5FF8F] animate-pulse'
                        : 'text-[#9A9A9A]/60'
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
        <div className="p-3 bg-[#93000a]/20 border border-[#FF5C5C]/40 text-[#FF5C5C] rounded-xl text-xs font-mono flex items-center space-x-2.5 shadow-[0_0_14px_rgba(255,92,92,0.15)]">
          <AlertCircle className="h-4 w-4 flex-shrink-0" />
          <span>
            Pipeline Analysis Exception: {status.error_message || 'Forensic verification failed for target wallet.'}
          </span>
        </div>
      )}
    </div>
  );
};
