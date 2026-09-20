'use client';

import React, { useState } from 'react';
import {
  ShieldAlert,
  Building2,
  Shuffle,
  Copy,
  Check,
  ExternalLink,
  Scale,
  Activity,
  AlertTriangle,
  TrendingDown,
  TrendingUp,
  X,
  FileCheck2,
  Zap,
} from 'lucide-react';
import { ForensicsNode, SuspectNodeData, MixerNodeData, VaspNodeData } from './types';

interface EntityIntelligencePanelProps {
  selectedNode: ForensicsNode | null;
  onClose: () => void;
  onOpenSahyogModal: (node: ForensicsNode) => void;
}

export const EntityIntelligencePanel: React.FC<EntityIntelligencePanelProps> = ({
  selectedNode,
  onClose,
  onOpenSahyogModal,
}) => {
  const [copied, setCopied] = useState(false);

  if (!selectedNode) {
    return (
      <aside className="w-84 h-full bg-slate-950/90 border-l border-slate-800/80 p-5 flex flex-col items-center justify-center text-center font-sans text-xs text-slate-400 select-none z-20 backdrop-blur-xl shrink-0">
        <div className="w-12 h-12 rounded-2xl bg-slate-900 border border-slate-800 flex items-center justify-center text-slate-500 mb-3 shadow-inner">
          <Activity className="w-6 h-6 text-slate-600" />
        </div>
        <h4 className="font-bold text-sm text-slate-200">No Entity Inspected</h4>
        <p className="text-xs text-slate-500 mt-1 max-w-[200px] leading-relaxed">
          Click any suspect, mixer, or VASP node on the canvas to load cyber-forensics intelligence.
        </p>
      </aside>
    );
  }

  const { type, data } = selectedNode;
  const isSuspect = type === 'suspect';
  const isMixer = type === 'mixer';
  const isVasp = type === 'vasp';

  const suspectData = isSuspect ? (data as SuspectNodeData) : null;
  const mixerData = isMixer ? (data as MixerNodeData) : null;
  const vaspData = isVasp ? (data as VaspNodeData) : null;

  const address = (data.address as string) || '';
  const label = (data.label as string) || (data.entityName as string) || (data.exchangeName as string) || 'Unlabeled Entity';
  const chain = (data.chain as string) || 'ETH';

  const handleCopy = () => {
    if (!address) return;
    navigator.clipboard.writeText(address);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  // Typology flags dynamically determined
  const typologyFlags = [
    isSuspect && { name: 'FATF Red Flag: High-Velocity Liquidation', level: 'CRITICAL', color: 'text-rose-400 bg-rose-950/60 border-rose-800' },
    isSuspect && suspectData?.isSanctioned && { name: 'OFAC SDN Nexus: State-Sponsored Cybercrime', level: 'CRITICAL', color: 'text-rose-400 bg-rose-950/60 border-rose-800' },
    isMixer && { name: 'FATF Typology: Tumbler / Peel Obfuscation', level: 'HIGH', color: 'text-amber-400 bg-amber-950/60 border-amber-800' },
    isMixer && { name: 'Intermediary Hop Breaking On-Chain Heuristics', level: 'MEDIUM', color: 'text-amber-300 bg-amber-950/40 border-amber-800' },
    isVasp && { name: 'Regulated Off-Ramp Endpoint', level: 'ACTIONABLE', color: 'text-emerald-400 bg-emerald-950/60 border-emerald-800' },
    isVasp && vaspData?.fiuRegistered && { name: 'FIU-IND Registered Compliance Entity', level: 'STATUTORY', color: 'text-sky-400 bg-sky-950/60 border-sky-800' },
  ].filter(Boolean) as { name: string; level: string; color: string }[];

  const nativeSymbol = (data.nativeSymbol as string) || 'ETH';
  const inflow = suspectData?.inflowVolume ?? (isVasp ? (vaspData?.depositVolume ?? 0) : 15.2);
  const outflow = suspectData?.outflowVolume ?? (isMixer ? (mixerData?.volume ?? 0) : 0);

  return (
    <aside className="w-88 h-full bg-slate-950/95 border-l border-slate-800/80 flex flex-col font-sans select-none z-20 backdrop-blur-xl shadow-2xl shrink-0">
      {/* Header */}
      <div className="p-4 border-b border-slate-800/80 flex items-center justify-between">
        <div className="flex items-center space-x-2">
          <div
            className={`p-1.5 rounded-lg border shadow-sm ${
              isSuspect
                ? 'bg-rose-500/20 text-rose-400 border-rose-500/30'
                : isMixer
                ? 'bg-amber-500/20 text-amber-400 border-amber-500/30'
                : 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30'
            }`}
          >
            {isSuspect ? <ShieldAlert className="w-4 h-4" /> : isMixer ? <Shuffle className="w-4 h-4" /> : <Building2 className="w-4 h-4" />}
          </div>
          <div>
            <h3 className="font-bold text-xs text-white uppercase tracking-wider font-mono">
              Entity Intelligence
            </h3>
            <span className="text-[10px] text-slate-400 font-mono uppercase">
              {isSuspect ? 'Suspect Actor' : isMixer ? 'Obfuscation Node' : 'VASP Endpoint'}
            </span>
          </div>
        </div>

        <button
          type="button"
          onClick={onClose}
          className="p-1.5 rounded-lg hover:bg-slate-900 text-slate-400 hover:text-white transition-colors"
          title="Close Inspector"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-4 text-xs">
        {/* Entity Card */}
        <div className="p-3 bg-slate-900/80 rounded-xl border border-slate-800 space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-mono font-bold uppercase text-slate-400">
              Identity & Label
            </span>
            <span className="text-[10px] font-mono px-2 py-0.5 rounded font-bold bg-slate-800 text-sky-400 border border-slate-700 uppercase">
              {chain}
            </span>
          </div>

          <h4 className="font-bold text-sm text-white font-sans truncate">
            {label}
          </h4>

          <div className="flex items-center justify-between bg-slate-950/80 px-2.5 py-1.5 rounded-lg border border-slate-800/90 font-mono text-[11px]">
            <span className="text-slate-300 truncate mr-2 select-all">
              {address ? `${address.slice(0, 10)}...${address.slice(-8)}` : '0x00'}
            </span>
            <button
              type="button"
              onClick={handleCopy}
              className="p-1 rounded hover:bg-slate-800 text-slate-400 hover:text-white transition-colors shrink-0"
              title="Copy Address"
            >
              {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
            </button>
          </div>
        </div>

        {/* Volume Analytics 2x2 Grid */}
        <div className="space-y-1.5">
          <span className="text-[10px] font-mono font-bold uppercase tracking-wider text-slate-400 block">
            Volume & Flow Analytics
          </span>

          <div className="grid grid-cols-2 gap-2 font-mono">
            <div className="p-2.5 rounded-xl bg-slate-900/60 border border-slate-800">
              <span className="text-[9px] text-slate-400 uppercase block">Total Inflow</span>
              <strong className="text-xs text-emerald-400 block mt-0.5 truncate">
                {inflow > 0 ? `${inflow.toLocaleString()} ${nativeSymbol}` : '0.00'}
              </strong>
              <span className="text-[9px] text-slate-500 block">On-chain verified</span>
            </div>

            <div className="p-2.5 rounded-xl bg-slate-900/60 border border-slate-800">
              <span className="text-[9px] text-slate-400 uppercase block">Total Outflow</span>
              <strong className="text-xs text-rose-400 block mt-0.5 truncate">
                {outflow > 0 ? `${outflow.toLocaleString()} ${nativeSymbol}` : '0.00'}
              </strong>
              <span className="text-[9px] text-slate-500 block">Dispersed</span>
            </div>

            <div className="p-2.5 rounded-xl bg-slate-900/60 border border-slate-800">
              <span className="text-[9px] text-slate-400 uppercase block">Transactions</span>
              <strong className="text-xs text-sky-400 block mt-0.5">
                {(data.txCount as number) || 12} Txs
              </strong>
              <span className="text-[9px] text-slate-500 block">Indexed</span>
            </div>

            <div className="p-2.5 rounded-xl bg-slate-900/60 border border-slate-800">
              <span className="text-[9px] text-slate-400 uppercase block">Seizure Posture</span>
              <strong className="text-xs text-amber-400 block mt-0.5">
                {isVasp ? 'LE RECOVERY' : isSuspect ? 'FREEZE' : 'LAYERED'}
              </strong>
              <span className="text-[9px] text-slate-500 block">Sec 91/102</span>
            </div>
          </div>
        </div>

        {/* FATF Typology Flags */}
        <div className="space-y-2">
          <span className="text-[10px] font-mono font-bold uppercase tracking-wider text-slate-400 block">
            AML & FATF Typology Indicators
          </span>

          <div className="space-y-1.5">
            {typologyFlags.map((flag, idx) => (
              <div
                key={idx}
                className={`p-2 rounded-lg border text-[11px] font-mono flex items-start space-x-2 ${flag.color}`}
              >
                <AlertTriangle className="w-3.5 h-3.5 shrink-0 mt-0.5 opacity-90" />
                <div className="min-w-0 flex-1 leading-snug">
                  <span className="font-bold">{flag.name}</span>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Statutory Action Area */}
        <div className="pt-2 border-t border-slate-800/80 space-y-2">
          <button
            type="button"
            onClick={() => onOpenSahyogModal(selectedNode)}
            className="w-full py-2.5 px-4 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs shadow-[0_0_20px_rgba(16,185,129,0.35)] transition-all flex items-center justify-center space-x-2 group"
          >
            <Scale className="w-4 h-4 group-hover:rotate-12 transition-transform" />
            <span>Route Section 91 CrPC Request via SAHYOG</span>
          </button>

          <p className="text-[10px] text-slate-500 text-center font-mono leading-relaxed">
            Statutory notice pre-populates target VASP nodal officer &amp; FIU-IND credentials.
          </p>
        </div>
      </div>
    </aside>
  );
};
