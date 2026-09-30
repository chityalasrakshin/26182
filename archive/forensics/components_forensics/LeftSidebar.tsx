'use client';

import React, { useState } from 'react';
import {
  Search,
  Sliders,
  ArrowRight,
  ChevronLeft,
  ChevronRight,
  Shield,
  Layers,
  Sparkles,
  RotateCcw,
  Compass,
  Zap,
  SlidersHorizontal,
  Flame,
} from 'lucide-react';
import { ForensicsChain, LayoutDirection, CasePreset } from './types';

interface LeftSidebarProps {
  targetInput: string;
  onTargetInputChange: (val: string) => void;
  selectedChain: ForensicsChain;
  onChainChange: (chain: ForensicsChain) => void;
  hopDepth: number;
  onHopDepthChange: (hops: number) => void;
  layoutDirection: LayoutDirection;
  onLayoutDirectionToggle: () => void;
  onRunTrace: () => void;
  onSelectPreset: (preset: CasePreset) => void;
  presets: CasePreset[];
  isTracing?: boolean;
}

export const LeftSidebar: React.FC<LeftSidebarProps> = ({
  targetInput,
  onTargetInputChange,
  selectedChain,
  onChainChange,
  hopDepth,
  onHopDepthChange,
  layoutDirection,
  onLayoutDirectionToggle,
  onRunTrace,
  onSelectPreset,
  presets,
  isTracing = false,
}) => {
  const [isCollapsed, setIsCollapsed] = useState(false);

  const chains: ForensicsChain[] = ['BTC', 'ETH', 'Tron', 'Solana', 'Polygon'];

  if (isCollapsed) {
    return (
      <div className="absolute top-4 left-4 z-20">
        <button
          type="button"
          onClick={() => setIsCollapsed(false)}
          className="p-2.5 rounded-xl bg-slate-900/90 border border-slate-800 text-slate-300 hover:text-white shadow-xl hover:border-sky-500/50 backdrop-blur-md transition-all"
          title="Expand Investigation Controls"
        >
          <ChevronRight className="w-4 h-4" />
        </button>
      </div>
    );
  }

  return (
    <aside className="w-80 h-full bg-slate-950/95 border-r border-slate-800/80 flex flex-col font-sans select-none z-20 backdrop-blur-xl shadow-2xl shrink-0">
      {/* Header */}
      <div className="p-4 border-b border-slate-800/80 flex items-center justify-between">
        <div className="flex items-center space-x-2">
          <div className="w-8 h-8 rounded-lg bg-sky-500/10 border border-sky-500/30 flex items-center justify-center text-sky-400 shadow-sm">
            <Zap className="w-4 h-4" />
          </div>
          <div>
            <h3 className="font-bold text-xs text-white uppercase tracking-wider font-mono">
              Investigation Controls
            </h3>
            <p className="text-[10px] text-slate-400 font-mono">Reactor Forensics v2.4</p>
          </div>
        </div>

        <button
          type="button"
          onClick={() => setIsCollapsed(true)}
          className="p-1.5 rounded-lg hover:bg-slate-900 text-slate-400 hover:text-white transition-colors"
          title="Collapse Panel"
        >
          <ChevronLeft className="w-4 h-4" />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-5 text-xs">
        {/* Target Address / TxHash Input */}
        <div className="space-y-1.5">
          <label className="text-[10px] font-mono font-bold uppercase tracking-wider text-slate-300 flex items-center justify-between">
            <span>Target Wallet / TxHash</span>
            <span className="text-slate-500">LEA Hex / Base58</span>
          </label>
          <div className="relative">
            <Search className="absolute left-3 top-2.5 w-3.5 h-3.5 text-slate-500" />
            <input
              type="text"
              value={targetInput}
              onChange={(e) => onTargetInputChange(e.target.value)}
              placeholder="Enter 0x..., bc1..., Tron T..., or TxHash"
              className="w-full bg-slate-900/90 border border-slate-800 rounded-lg pl-9 pr-3 py-2 text-xs text-slate-100 placeholder-slate-500 font-mono focus:outline-none focus:border-sky-500 focus:ring-1 focus:ring-sky-500 transition-all"
            />
          </div>
        </div>

        {/* Multi-Chain Selector */}
        <div className="space-y-1.5">
          <label className="text-[10px] font-mono font-bold uppercase tracking-wider text-slate-300 block">
            Target Blockchain Network
          </label>
          <div className="grid grid-cols-3 gap-1.5">
            {chains.map((chain) => {
              const active = selectedChain === chain;
              return (
                <button
                  key={chain}
                  type="button"
                  onClick={() => onChainChange(chain)}
                  className={`py-1.5 px-2 rounded-lg text-[10px] font-mono font-bold uppercase transition-all border ${
                    active
                      ? 'bg-sky-500/20 text-sky-300 border-sky-500/60 shadow-[0_0_10px_rgba(14,165,233,0.3)]'
                      : 'bg-slate-900/60 text-slate-400 border-slate-800 hover:text-slate-200 hover:bg-slate-900'
                  }`}
                >
                  {chain}
                </button>
              );
            })}
          </div>
        </div>

        {/* Hop Depth Slider (1 to 5) */}
        <div className="space-y-2 bg-slate-900/60 p-3 rounded-xl border border-slate-800/80">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-mono font-bold uppercase tracking-wider text-slate-300">
              Trace Hop Depth
            </span>
            <span className="px-2 py-0.5 rounded font-mono font-bold text-[10px] bg-sky-950 text-sky-400 border border-sky-800">
              {hopDepth} {hopDepth === 1 ? 'Hop' : 'Hops'}
            </span>
          </div>

          <input
            type="range"
            min={1}
            max={5}
            step={1}
            value={hopDepth}
            onChange={(e) => onHopDepthChange(Number(e.target.value))}
            className="w-full accent-sky-400 bg-slate-800 h-1.5 rounded-lg cursor-pointer"
          />

          <div className="flex justify-between text-[9px] font-mono text-slate-500 px-0.5">
            <span>Direct</span>
            <span>2 Hops</span>
            <span>3 Hops</span>
            <span>4 Hops</span>
            <span>5 (Deep)</span>
          </div>
        </div>

        {/* Layout Orientation Toggle */}
        <div className="space-y-1.5">
          <label className="text-[10px] font-mono font-bold uppercase tracking-wider text-slate-300 block">
            Auto-Layout Orientation (Dagre)
          </label>
          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={onLayoutDirectionToggle}
              className={`py-2 px-3 rounded-lg text-xs font-mono font-semibold flex items-center justify-center space-x-1.5 border transition-all ${
                layoutDirection === 'LR'
                  ? 'bg-sky-500/20 text-sky-300 border-sky-500/50 shadow-sm'
                  : 'bg-slate-900/60 text-slate-400 border-slate-800 hover:bg-slate-900'
              }`}
            >
              <span>Horizontal (LR)</span>
            </button>
            <button
              type="button"
              onClick={onLayoutDirectionToggle}
              className={`py-2 px-3 rounded-lg text-xs font-mono font-semibold flex items-center justify-center space-x-1.5 border transition-all ${
                layoutDirection === 'TB'
                  ? 'bg-sky-500/20 text-sky-300 border-sky-500/50 shadow-sm'
                  : 'bg-slate-900/60 text-slate-400 border-slate-800 hover:bg-slate-900'
              }`}
            >
              <span>Vertical (TB)</span>
            </button>
          </div>
        </div>

        {/* Primary Action Button */}
        <button
          type="button"
          onClick={onRunTrace}
          disabled={isTracing}
          className="w-full py-2.5 px-4 rounded-xl bg-gradient-to-r from-sky-500 to-blue-600 hover:from-sky-400 hover:to-blue-500 text-white font-bold text-xs shadow-[0_0_20px_rgba(14,165,233,0.4)] transition-all flex items-center justify-center space-x-2 disabled:opacity-50"
        >
          {isTracing ? (
            <>
              <span className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin"></span>
              <span>Tracing Multi-Hop Nodes...</span>
            </>
          ) : (
            <>
              <Compass className="w-4 h-4" />
              <span>Execute Forensics Trace</span>
            </>
          )}
        </button>

        {/* High-Profile LEA Case Presets */}
        <div className="pt-3 border-t border-slate-800/80 space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-mono font-bold uppercase tracking-wider text-slate-400">
              High-Profile LEA Presets
            </span>
            <Sparkles className="w-3 h-3 text-sky-400" />
          </div>

          <div className="space-y-1.5">
            {presets.map((p) => (
              <button
                key={p.id}
                type="button"
                onClick={() => onSelectPreset(p)}
                className="w-full text-left p-2.5 rounded-lg bg-slate-900/60 hover:bg-slate-800/80 border border-slate-800 hover:border-slate-700 transition-all group"
              >
                <div className="flex items-center justify-between">
                  <span className="font-bold text-xs text-slate-200 group-hover:text-sky-300 transition-colors truncate">
                    {p.title}
                  </span>
                  <span className="text-[9px] font-mono px-1.5 py-0.5 rounded bg-slate-800 text-slate-400 border border-slate-700">
                    {p.chain}
                  </span>
                </div>
                <p className="text-[10px] text-slate-400 mt-1 leading-snug truncate">
                  {p.description}
                </p>
              </button>
            ))}
          </div>
        </div>
      </div>
    </aside>
  );
};
