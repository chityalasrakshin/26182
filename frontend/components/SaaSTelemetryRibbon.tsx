'use client';

import React from 'react';
import {
  IndianRupee,
  ShieldCheck,
  ShieldAlert,
  Scale,
  TrendingUp,
} from 'lucide-react';

interface SaaSTelemetryRibbonProps {
  totalTransfers?: number;
  totalNodes?: number;
  activeAttributionVasp?: string | null;
  riskLevel?: string | null;
}

export const SaaSTelemetryRibbon: React.FC<SaaSTelemetryRibbonProps> = ({
  totalTransfers,
  totalNodes,
  activeAttributionVasp,
  riskLevel,
}) => {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5 select-none">

      {/* 1. Tracked Capital Volume */}
      <div className="glass-panel-interactive p-4 flex flex-col justify-between space-y-2 relative overflow-hidden group">
        <div className="absolute top-0 right-0 w-24 h-24 bg-gradient-to-bl from-[#FF5722]/10 to-transparent pointer-events-none" />
        <div className="flex items-center justify-between">
          <span className="text-[11px] uppercase font-mono font-bold tracking-wider flex items-center space-x-1.5" style={{ color: 'var(--cyber-text-muted)' }}>
            <IndianRupee className="h-3.5 w-3.5" style={{ color: 'var(--threat-orange-muted)' }} />
            <span>Monitored Capital Flow</span>
          </span>
          <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded flex items-center space-x-1"
            style={{ color: 'var(--semantic-success)', background: 'rgba(22,163,74,0.12)', border: '1px solid rgba(22,163,74,0.25)' }}
          >
            <TrendingUp className="h-3 w-3" />
            <span>+14.2% Vol</span>
          </span>
        </div>
        <div>
          <div className="text-2xl font-bold font-mono tracking-tight transition-colors" style={{ color: 'var(--cyber-text)' }}>
            ₹842.60 <span className="text-sm font-normal" style={{ color: 'var(--threat-orange-muted)' }}>Cr</span>
          </div>
          <div className="flex items-center justify-between text-[11px] font-mono mt-1">
            <span style={{ color: 'var(--cyber-text-dim)' }}>~$101.4M USD Cross-Chain</span>
            <span style={{ color: 'var(--cyber-text-muted)' }}>EVM · Tron · BTC</span>
          </div>
        </div>
      </div>

      {/* 2. VASP Attribution Matrix */}
      <div className="glass-panel-interactive p-4 flex flex-col justify-between space-y-2 relative overflow-hidden group">
        <div className="absolute top-0 right-0 w-24 h-24 bg-gradient-to-bl from-[#16A34A]/10 to-transparent pointer-events-none" />
        <div className="flex items-center justify-between">
          <span className="text-[11px] uppercase font-mono font-bold tracking-wider flex items-center space-x-1.5" style={{ color: 'var(--cyber-text-muted)' }}>
            <ShieldCheck className="h-3.5 w-3.5" style={{ color: 'var(--semantic-success)' }} />
            <span>Attribution Index</span>
          </span>
          <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded"
            style={{ color: 'var(--threat-orange-muted)', background: 'rgba(230,74,25,0.12)', border: '1px solid rgba(230,74,25,0.25)' }}
          >
            {activeAttributionVasp ? 'RESOLVED' : '48 VASPs'}
          </span>
        </div>
        <div>
          <div className="text-2xl font-bold font-mono tracking-tight transition-colors" style={{ color: 'var(--cyber-text)' }}>
            {activeAttributionVasp ? (
              <span className="text-xl truncate block" style={{ color: 'var(--semantic-success)' }}>{activeAttributionVasp}</span>
            ) : (
              <>88.5% <span className="text-sm font-normal" style={{ color: 'var(--cyber-text-muted)' }}>Confidence</span></>
            )}
          </div>
          <div className="flex items-center justify-between text-[11px] font-mono mt-1">
            <span style={{ color: 'var(--cyber-text-dim)' }}>FIU-IND Registered Custody</span>
            <span style={{ color: 'var(--semantic-success)' }}>Direct / Hop ≤ 3</span>
          </div>
        </div>
      </div>

      {/* 3. Sanction & Mixer Intercepts */}
      <div className="glass-panel-interactive p-4 flex flex-col justify-between space-y-2 relative overflow-hidden group">
        <div className="absolute top-0 right-0 w-24 h-24 bg-gradient-to-bl from-[#DC2626]/10 to-transparent pointer-events-none" />
        <div className="flex items-center justify-between">
          <span className="text-[11px] uppercase font-mono font-bold tracking-wider flex items-center space-x-1.5" style={{ color: 'var(--cyber-text-muted)' }}>
            <ShieldAlert className="h-3.5 w-3.5" style={{ color: 'var(--semantic-critical)' }} />
            <span>Mixer / OFAC Traversal</span>
          </span>
          <span className="badge-base badge-critical">
            {riskLevel || 'ELEVATED'}
          </span>
        </div>
        <div>
          <div className="text-2xl font-bold font-mono tracking-tight transition-colors" style={{ color: 'var(--cyber-text)' }}>
            1,429 <span className="text-sm font-normal" style={{ color: 'var(--semantic-critical)' }}>Hits</span>
          </div>
          <div className="flex items-center justify-between text-[11px] font-mono mt-1">
            <span style={{ color: 'var(--cyber-text-dim)' }}>Tornado · Blender · Railgun</span>
            <span style={{ color: 'var(--semantic-critical)' }}>OFAC Tainted</span>
          </div>
        </div>
      </div>

      {/* 4. Statutory Freeze Directives */}
      <div className="glass-panel-interactive p-4 flex flex-col justify-between space-y-2 relative overflow-hidden group">
        <div className="absolute top-0 right-0 w-24 h-24 bg-gradient-to-bl from-[#2563EB]/10 to-transparent pointer-events-none" />
        <div className="flex items-center justify-between">
          <span className="text-[11px] uppercase font-mono font-bold tracking-wider flex items-center space-x-1.5" style={{ color: 'var(--cyber-text-muted)' }}>
            <Scale className="h-3.5 w-3.5" style={{ color: 'var(--semantic-info)' }} />
            <span>Sec 91 Freeze Ledger</span>
          </span>
          <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded"
            style={{ color: 'var(--semantic-info)', background: 'rgba(37,99,235,0.12)', border: '1px solid rgba(37,99,235,0.25)' }}
          >
            ENFORCEABLE
          </span>
        </div>
        <div>
          <div className="text-2xl font-bold font-mono tracking-tight transition-colors" style={{ color: 'var(--cyber-text)' }}>
            ₹48.30 <span className="text-sm font-normal" style={{ color: 'var(--semantic-info)' }}>Cr</span>
          </div>
          <div className="flex items-center justify-between text-[11px] font-mono mt-1">
            <span style={{ color: 'var(--cyber-text-dim)' }}>89 Notices Dispatched</span>
            <span style={{ color: 'var(--semantic-info)' }}>Court-Admissible</span>
          </div>
        </div>
      </div>
    </div>
  );
};
