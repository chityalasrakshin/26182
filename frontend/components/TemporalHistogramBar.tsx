'use client';

import React, { useState, useMemo, useEffect, useRef } from 'react';
import {
  Clock,
  Play,
  Pause,
  X,
  ChevronUp,
  ChevronDown,
} from 'lucide-react';
import { NormalizedTransaction } from '../lib/types';

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
  const { hourData, maxCount, maxVolume, totalTxCount, totalVolume, peakHour, peakLabel } = useMemo(() => {
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
        return;
      }

      const h = d.getUTCHours();
      if (h >= 0 && h < 24) {
        hours[h].count += 1;
        hours[h].volume += amt;
        grandTotalCount += 1;
        grandTotalVol += amt;
        if (item.tx_hash || item.hash) {
          hours[h].txHashes.push(item.tx_hash || item.hash);
        }
      }
    });

    const mCount = Math.max(...hours.map((h) => h.count), 0);
    const mVol = Math.max(...hours.map((h) => h.volume), 0);

    const peakBucket = hours.reduce((best, cur) => (cur.count > best.count ? cur : best), hours[0]);
    const peakHour = peakBucket.count > 0 ? peakBucket.hour : -1;

    return {
      hourData: hours,
      maxCount: mCount > 0 ? mCount : 1,
      maxVolume: mVol > 0 ? mVol : 1,
      totalTxCount: grandTotalCount,
      totalVolume: grandTotalVol,
      peakHour,
      peakLabel: peakBucket.count > 0 ? `${peakBucket.label} (PEAK)` : null,
    };
  }, [transactions, edges]);

  // Selected hour stats
  const selectedStats = useMemo(() => {
    if (selectedHour === null) {
      return { selectedCount: totalTxCount, selectedVolume: totalVolume };
    }
    const bucket = hourData[selectedHour];
    return {
      selectedCount: bucket?.count || 0,
      selectedVolume: bucket?.volume || 0,
    };
  }, [selectedHour, hourData, totalTxCount, totalVolume]);

  // Animation player loop: iterates 0 -> 23
  useEffect(() => {
    if (isPlaying) {
      playIntervalRef.current = setInterval(() => {
        const next = selectedHour === null ? 0 : (selectedHour + 1) % 24;
        onFilterHourChange(next);
      }, 700);
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
    <div className="bg-white rounded-2xl p-4 space-y-3 border border-[#E2E8F0] font-mono text-xs select-none transition-all shadow-sm">
      {/* 1. TITLE & CONTROLS BAR */}
      <div className="flex flex-wrap items-center justify-between gap-2 pb-2.5 border-b border-[#E2E8F0]">
        <div className="flex items-center gap-2">
          <Clock className="h-4 w-4 text-[#0284C7]" />
          <span className="font-semibold text-xs text-[#0F172A] tracking-wide">
            TRANSACTION TEMPORAL DISTRIBUTION: HOUR OF DAY (UTC)
          </span>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={togglePlay}
            className={`py-1 px-3 rounded-full font-bold flex items-center gap-1.5 transition-colors ${
              isPlaying
                ? 'bg-[#0284C7] text-white shadow-sm'
                : 'bg-[#F8FAFC] hover:bg-[#F1F5F9] text-[#0F172A] border border-[#E2E8F0]'
            }`}
          >
            {isPlaying ? <Pause className="h-3.5 w-3.5" /> : <Play className="h-3.5 w-3.5 text-[#0284C7]" />}
            <span>{isPlaying ? 'Pause' : 'Play Timeline'}</span>
          </button>

          {selectedHour !== null && (
            <button
              onClick={() => {
                setIsPlaying(false);
                onClearFilter();
              }}
              className="py-1 px-2.5 rounded-full bg-white hover:bg-rose-50 border border-rose-200 text-rose-600 flex items-center gap-1 transition-colors"
            >
              <X className="h-3 w-3" />
              <span>Reset</span>
            </button>
          )}

          <span className="text-[11px] text-[#64748B]">
            Selected: <strong className="text-[#0F172A]">{selectedStats.selectedCount}/{totalTxCount} Tx</strong>
          </span>

          {/* Collapse Toggle */}
          <button
            onClick={() => setIsCollapsed(!isCollapsed)}
            className="p-1.5 rounded-full hover:bg-[#F1F5F9] text-[#64748B] hover:text-[#0F172A] transition-colors ml-1"
            title={isCollapsed ? 'Expand Histogram' : 'Collapse Histogram'}
          >
            {isCollapsed ? <ChevronDown className="h-4 w-4" /> : <ChevronUp className="h-4 w-4" />}
          </button>
        </div>
      </div>

      {!isCollapsed && (
        <div className="space-y-2">
          {/* 2. 24-HOUR INTERACTIVE BAR CHART */}
          <div className="h-24 flex items-end gap-1 pt-5 pb-1 px-2 bg-[#F8FAFC] rounded-xl border border-[#E2E8F0] relative">
            {hourData.map((bucket) => {
              const isSelected = selectedHour === bucket.hour;
              const hasSelection = selectedHour !== null;
              const val = mode === 'COUNT' ? bucket.count : bucket.volume;
              const maxVal = mode === 'COUNT' ? maxCount : maxVolume;
              const heightPercent = maxVal > 0 ? Math.max((val / maxVal) * 100, val > 0 ? 12 : 4) : 4;

              const isSpikeHour = peakHour !== -1 && bucket.hour === peakHour;

              return (
                <div
                  key={bucket.hour}
                  onClick={() => handleBarClick(bucket.hour)}
                  className="flex-1 flex flex-col items-center justify-end h-full group cursor-pointer relative z-10"
                >
                  {/* Tooltip on hover */}
                  <div className="absolute bottom-full mb-1 hidden group-hover:flex flex-col items-center bg-white border border-[#E2E8F0] text-[#0F172A] px-2.5 py-1 rounded-xl shadow-xl z-30 pointer-events-none text-[9px] whitespace-nowrap">
                    <span className="font-bold text-[#0284C7]">{bucket.label} Window</span>
                    <span>{bucket.count} Transfers</span>
                    <span className="text-[#64748B]">
                      {bucket.volume.toFixed(2)} {primaryToken}
                    </span>
                  </div>

                  {/* Top value indicator for dynamic peak hour */}
                  {isSpikeHour && !hasSelection && (
                    <div className="absolute -top-4 left-1/2 -translate-x-1/2 px-1.5 py-0.2 rounded-full bg-[#0284C7] text-white font-mono text-[8px] font-bold uppercase whitespace-nowrap shadow-sm">
                      PEAK
                    </div>
                  )}

                  {/* The Bar */}
                  <div
                    className={`w-full rounded-t transition-all duration-200 ${
                      isSelected
                        ? 'bg-[#0284C7] shadow-[0_0_12px_rgba(2,132,199,0.5)]'
                        : isSpikeHour
                        ? 'bg-[#0284C7]/70 hover:bg-[#0284C7]'
                        : val > 0
                        ? 'bg-[#CBD5E1] hover:bg-[#94A3B8]'
                        : 'bg-[#E2E8F0]'
                    }`}
                    style={{ height: `${heightPercent}%` }}
                  />
                </div>
              );
            })}
          </div>

          {/* Time axis footer */}
          <div className="flex justify-between font-mono text-[10px] text-[#64748B] pt-1 border-t border-[#E2E8F0]">
            <span>12A</span>
            <span>3A</span>
            <span>6A</span>
            <span>9A</span>
            <span>12P</span>
            <span>3P</span>
            <span className={peakHour !== -1 ? 'text-[#0284C7] font-bold' : ''}>
              {peakLabel || '6P'}
            </span>
            <span>9P</span>
            <span>11P</span>
          </div>
        </div>
      )}
    </div>
  );
};
