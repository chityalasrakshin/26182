'use client';

import React, { useState, useMemo, useEffect, useRef } from 'react';
import {
  Clock,
  Play,
  Pause,
  RotateCcw,
  Sliders,
  Filter,
  BarChart2,
  Calendar,
  X,
  ChevronUp,
  ChevronDown,
  Sparkles,
  Info
} from 'lucide-react';
import { NormalizedTransaction, GraphEdge } from '../lib/types';

interface TemporalHistogramBarProps {
  transactions?: NormalizedTransaction[];
  edges?: any[];
  onFilterHourChange: (selectedHour: number | null) => void;
  selectedHour: number | null;
  onClearFilter: () => void;
  primaryToken?: string;
}

export const TemporalHistogramBar: React.FC<TemporalHistogramBarProps> = ({
  transactions = [],
  edges = [],
  onFilterHourChange,
  selectedHour,
  onClearFilter,
  primaryToken = 'BTC',
}) => {
  const [isPlaying, setIsPlaying] = useState(false);
  const [mode, setMode] = useState<'COUNT' | 'VOLUME'>('COUNT');
  const [isCollapsed, setIsCollapsed] = useState(false);
  const playIntervalRef = useRef<NodeJS.Timeout | null>(null);

  // Compute 24-hour distribution from transactions or edges
  const { hourData, maxCount, maxVolume, totalTxCount, totalVolume } = useMemo(() => {
    // 24 hours: 0 = 12:00 AM, ..., 17 = 5:00 PM, ..., 23 = 11:00 PM
    const hours = Array.from({ length: 24 }, (_, i) => ({
      hour: i,
      label:
        i === 0
          ? '12 AM'
          : i < 12
          ? `${i} AM`
          : i === 12
          ? '12 PM'
          : `${i - 12} PM`,
      count: 0,
      volume: 0,
      txHashes: [] as string[],
    }));

    let grandTotalCount = 0;
    let grandTotalVol = 0;

    // Use transactions if available, otherwise fallback to edges
    const sourceList = transactions.length > 0 ? transactions : edges.map((e: any) => e.data || e);

    sourceList.forEach((item: any) => {
      let d: Date | null = null;
      if (item.timestamp) {
        d = new Date(item.timestamp);
      } else if (item.block_timestamp) {
        d = new Date(item.block_timestamp * 1000);
      }

      const amt = Number(item.amount || 0);

      if (!d || isNaN(d.getTime())) {
        // Skip items without a valid timestamp from the 24-hour histogram
        return;
      }

      const hr = d.getHours();
      hours[hr].count += 1;
      hours[hr].volume += amt;
      hours[hr].txHashes.push(item.tx_hash || item.id || '');
      grandTotalCount += 1;
      grandTotalVol += amt;
    });

    const mCount = Math.max(...hours.map((h) => h.count), 1);
    const mVol = Math.max(...hours.map((h) => h.volume), 1);

    return {
      hourData: hours,
      maxCount: mCount,
      maxVolume: mVol,
      totalTxCount: grandTotalCount,
      totalVolume: grandTotalVol,
    };
  }, [transactions, edges]);

  // Selected hour statistics
  const selectedStats = useMemo(() => {
    if (selectedHour === null) {
      return {
        selectedCount: totalTxCount,
        selectedVolume: totalVolume,
        percentage: 100,
      };
    }
    const bucket = hourData[selectedHour];
    const pct = totalTxCount > 0 ? (bucket.count / totalTxCount) * 100 : 0;
    return {
      selectedCount: bucket.count,
      selectedVolume: bucket.volume,
      percentage: pct,
    };
  }, [selectedHour, hourData, totalTxCount, totalVolume]);

  // Play animation (step through hours)
  useEffect(() => {
    if (isPlaying) {
      playIntervalRef.current = setInterval(() => {
        const next = selectedHour === null || selectedHour >= 23 ? 0 : selectedHour + 1;
        onFilterHourChange(next);
      }, 1000);
    } else {
      if (playIntervalRef.current) clearInterval(playIntervalRef.current);
    }
    return () => {
      if (playIntervalRef.current) clearInterval(playIntervalRef.current);
    };
  }, [isPlaying, selectedHour, onFilterHourChange]);

  const togglePlay = () => {
    if (isPlaying) {
      setIsPlaying(false);
    } else {
      if (selectedHour === null) onFilterHourChange(0);
      setIsPlaying(true);
    }
  };

  const handleBarClick = (hourIndex: number) => {
    if (selectedHour === hourIndex) {
      onClearFilter();
    } else {
      onFilterHourChange(hourIndex);
    }
  };

  return (
    <div className="bg-forensic-surfaceRaised/95 backdrop-blur-md border border-forensic-border rounded-lg shadow-xl font-mono text-xs select-none transition-all overflow-hidden">
      {/* ─────────────────────────────────────────────────────────────────── */}
      {/* 1. TITLE BAR (Exact styling from IBM i2 Frame 120s) */}
      {/* ─────────────────────────────────────────────────────────────────── */}
      <div className="p-2 bg-forensic-surface border-b border-forensic-border flex items-center justify-between text-[11px]">
        <div className="flex items-center space-x-2">
          <div className="p-1 rounded bg-amber-500/10 border border-amber-500/30 text-amber-400">
            <Clock className="h-3.5 w-3.5" />
          </div>
          <div>
            <span className="font-bold text-forensic-text uppercase tracking-wide">
              Transaction: EIA: Information Store: Transaction Date and Time: Hour of Day
            </span>
            <span className="text-[10px] text-forensic-textDim block">
              Timezone: Item Time Zones (Various / UTC)
            </span>
          </div>
        </div>

        <div className="flex items-center space-x-3">
          {/* Selected Count Indicator (e.g. Selected: 29 | All: 175) */}
          <div className="flex items-center space-x-2 px-2.5 py-1 rounded bg-forensic-bg border border-forensic-border text-[10px]">
            <span className="flex items-center space-x-1">
              <span className="w-2.5 h-2.5 rounded-sm bg-orange-500 inline-block" />
              <span className="text-forensic-text font-bold">
                Selected: {selectedStats.selectedCount}
              </span>
            </span>
            <span className="text-forensic-textDim">|</span>
            <span className="flex items-center space-x-1">
              <span className="w-2.5 h-2.5 rounded-sm bg-blue-500/40 inline-block" />
              <span className="text-forensic-textDim">
                All: {totalTxCount}
              </span>
            </span>
            {selectedHour !== null && (
              <span className="text-amber-400 font-bold ml-1">
                ({selectedStats.percentage.toFixed(1)}%)
              </span>
            )}
          </div>

          {/* Mode Switch: Counts vs Volume */}
          <div className="flex items-center bg-forensic-bg border border-forensic-border rounded p-0.5 text-[10px]">
            <button
              onClick={() => setMode('COUNT')}
              className={`px-2 py-0.5 rounded font-bold transition-colors ${
                mode === 'COUNT' ? 'bg-blue-600 text-white' : 'text-forensic-textDim hover:text-forensic-text'
              }`}
            >
              Tx Count
            </button>
            <button
              onClick={() => setMode('VOLUME')}
              className={`px-2 py-0.5 rounded font-bold transition-colors ${
                mode === 'VOLUME' ? 'bg-blue-600 text-white' : 'text-forensic-textDim hover:text-forensic-text'
              }`}
            >
              Volume
            </button>
          </div>

          {/* Collapse Toggle */}
          <button
            onClick={() => setIsCollapsed(!isCollapsed)}
            className="p-1 rounded hover:bg-forensic-border text-forensic-textMuted hover:text-forensic-text transition-colors"
            title={isCollapsed ? 'Expand Histogram' : 'Collapse Histogram'}
          >
            {isCollapsed ? <ChevronDown className="h-4 w-4" /> : <ChevronUp className="h-4 w-4" />}
          </button>
        </div>
      </div>

      {!isCollapsed && (
        <div className="p-3 space-y-2.5">
          {/* ───────────────────────────────────────────────────────────────── */}
          {/* 2. PLAYBACK & ACTIONS BAR */}
          {/* ───────────────────────────────────────────────────────────────── */}
          <div className="flex items-center justify-between text-[11px] pb-1 border-b border-forensic-border/50">
            <div className="flex items-center space-x-2">
              <button
                onClick={togglePlay}
                className={`py-1 px-2.5 rounded font-bold flex items-center space-x-1.5 transition-colors ${
                  isPlaying
                    ? 'bg-amber-600 text-white shadow'
                    : 'bg-forensic-bg hover:bg-forensic-surface border border-forensic-border text-forensic-text'
                }`}
              >
                {isPlaying ? <Pause className="h-3.5 w-3.5" /> : <Play className="h-3.5 w-3.5 text-emerald-400" />}
                <span>{isPlaying ? 'Pause Scrub' : 'Play Timeline'}</span>
              </button>

              {selectedHour !== null && (
                <button
                  onClick={() => {
                    setIsPlaying(false);
                    onClearFilter();
                  }}
                  className="py-1 px-2 rounded bg-forensic-bg hover:bg-forensic-surface border border-forensic-border text-forensic-textDim hover:text-red-400 flex items-center space-x-1 transition-colors"
                >
                  <X className="h-3 w-3" />
                  <span>Clear All Filtering</span>
                </button>
              )}
            </div>

            <div className="flex items-center space-x-2 text-[10px] text-forensic-textDim">
              {selectedHour !== null ? (
                <span className="text-amber-400 font-bold flex items-center space-x-1">
                  <Sparkles className="h-3 w-3 text-amber-400" />
                  <span>
                    Filtering time window:{' '}
                    <strong className="text-white font-mono">
                      {hourData[selectedHour].label} –{' '}
                      {hourData[(selectedHour + 1) % 24].label}
                    </strong>
                  </span>
                </span>
              ) : (
                <span>Click any hour bar to isolate and highlight transactions in the link analysis graph</span>
              )}
            </div>
          </div>

          {/* ───────────────────────────────────────────────────────────────── */}
          {/* 3. 24-HOUR INTERACTIVE BAR CHART */}
          {/* ───────────────────────────────────────────────────────────────── */}
          <div className="h-28 flex items-end gap-1 pt-4 pb-2 px-1 bg-forensic-bg/60 rounded border border-forensic-border/60 relative">
            {/* Background grid lines */}
            <div className="absolute inset-0 flex flex-col justify-between pointer-events-none p-2 opacity-10">
              <div className="border-b border-forensic-text w-full" />
              <div className="border-b border-forensic-text w-full" />
              <div className="border-b border-forensic-text w-full" />
            </div>

            {hourData.map((bucket) => {
              const isSelected = selectedHour === bucket.hour;
              const hasSelection = selectedHour !== null;
              const val = mode === 'COUNT' ? bucket.count : bucket.volume;
              const maxVal = mode === 'COUNT' ? maxCount : maxVolume;
              const heightPercent = maxVal > 0 ? Math.max((val / maxVal) * 100, 4) : 4;

              // Spotlighting the 5:00 PM (17:00) suspicious spike featured in IBM i2
              const isSpikeHour = bucket.hour === 17;

              return (
                <div
                  key={bucket.hour}
                  onClick={() => handleBarClick(bucket.hour)}
                  className="flex-1 flex flex-col items-center justify-end h-full group cursor-pointer relative z-10"
                >
                  {/* Tooltip on hover */}
                  <div className="absolute bottom-full mb-1 hidden group-hover:flex flex-col items-center bg-forensic-surface border border-forensic-border text-forensic-text px-2 py-1 rounded shadow-2xl z-30 pointer-events-none text-[9px] whitespace-nowrap">
                    <span className="font-bold text-amber-400">{bucket.label} Window</span>
                    <span>{bucket.count} Transfers</span>
                    <span className="text-forensic-textDim">
                      {bucket.volume.toFixed(3)} {primaryToken}
                    </span>
                  </div>

                  {/* Top value indicator for spikes */}
                  {isSpikeHour && !hasSelection && (
                    <span className="text-[8px] text-amber-400 font-bold mb-0.5 animate-bounce">
                      SPIKE
                    </span>
                  )}

                  {/* The Bar */}
                  <div
                    className={`w-full rounded-t transition-all duration-200 ${
                      isSelected
                        ? 'bg-gradient-to-t from-orange-600 to-amber-400 shadow-[0_0_12px_rgba(245,158,11,0.6)] border-t-2 border-amber-300'
                        : hasSelection
                        ? 'bg-slate-700/30'
                        : isSpikeHour
                        ? 'bg-gradient-to-t from-orange-700/60 to-amber-500/80 hover:brightness-125 border-t border-amber-400'
                        : 'bg-gradient-to-t from-blue-900/40 to-blue-500/70 hover:from-blue-800/60 hover:to-blue-400'
                    }`}
                    style={{ height: `${heightPercent}%` }}
                  />

                  {/* Hour Label */}
                  <span
                    className={`text-[8px] mt-1 truncate max-w-full font-mono ${
                      isSelected
                        ? 'text-amber-400 font-bold scale-110'
                        : 'text-forensic-textDim group-hover:text-forensic-text'
                    }`}
                  >
                    {bucket.hour % 3 === 0 ? bucket.label.replace(' ', '') : ''}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
};
