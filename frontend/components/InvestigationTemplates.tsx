'use client';

import React from 'react';
import {
  Flame,
  ShieldAlert,
  ArrowRight,
  ExternalLink,
  Layers,
  Radio,
  Clock,
  Sparkles,
  Zap,
  Building2,
  Lock,
} from 'lucide-react';

interface ThreatScenario {
  id: string;
  name: string;
  category: string;
  severity: 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'INFO';
  address: string;
  chain: 'Ethereum' | 'Tron' | 'Bitcoin' | 'Solana';
  impact: string;
  description: string;
  hops: number;
}

const NOTABLE_SCENARIOS: ThreatScenario[] = [
  {
    id: 'wazirx-breach',
    name: 'WazirX $230M Multi-Sig Exploit',
    category: 'Exchange Exploit / Scam Recipient',
    severity: 'CRITICAL',
    address: '0x3d0246a49591A5462D42fF025b6a3F2169E66e2c',
    chain: 'Ethereum',
    impact: '₹1,900+ Cr Stolen',
    description: 'Complex multi-signature compromise routing stolen ERC-20 tokens through DEXs and Tornado Cash anonymizers.',
    hops: 3,
  },
  {
    id: 'tornado-router',
    name: 'Tornado Cash Sanctioned Router',
    category: 'OFAC Sanctioned Anonymizer',
    severity: 'CRITICAL',
    address: '0xd90e2f925DA726b50C4Ed8D0Fb90Ad053324F31b',
    chain: 'Ethereum',
    impact: 'High-Volume Layering',
    description: 'Zero-knowledge mixer smart contract utilized to break deterministic link between deposit and withdrawal addresses.',
    hops: 2,
  },
  {
    id: 'binance-hw-14',
    name: 'Binance Hot Wallet 14 Consolidation',
    category: 'Exchange Deposit / Inflow Hub',
    severity: 'INFO',
    address: '0x28C6c06298d514Db089934071355E5743bf21d60',
    chain: 'Ethereum',
    impact: '₹15,000+ Cr Custody',
    description: 'Institutional CEX sweeping wallet aggregating thousands of intermediary user deposit addresses.',
    hops: 2,
  },
  {
    id: 'tron-usdt-ring',
    name: 'Tron TRC-20 High-Velocity Sweep',
    category: 'Mule Account / Rapid Layering',
    severity: 'HIGH',
    address: 'TMuA6YMeL4nNFYWAnWUCtqnmEvrCfsugnR',
    chain: 'Tron',
    impact: 'USDT Cross-Border Sweep',
    description: 'High-frequency USDT transfer consolidation frequently observed in Southeast Asian cyber-fraud networks.',
    hops: 3,
  },
  {
    id: 'btc-cold-storage',
    name: 'Bitcoin Cold Storage Aggregator',
    category: 'UTXO Cold Storage Wallet',
    severity: 'INFO',
    address: '34xp4vRoCGJym3xR7yCVPFHoCNxv4Twseo',
    chain: 'Bitcoin',
    impact: 'Multi-Sig Custody',
    description: 'Deep UTXO network aggregation demonstrating multi-input peel-chain heuristics across Bitcoin core.',
    hops: 2,
  },
  {
    id: 'coinbase-hot-wallet',
    name: 'Coinbase Custody Settlement Node',
    category: 'Regulated VASP Settlement',
    severity: 'INFO',
    address: '0xA090e606E30bD747d4E6245a1517EbE430F0057e',
    chain: 'Ethereum',
    impact: 'FIU Compliant Node',
    description: 'Primary liquidity and customer off-ramp node supporting lawful disclosure under international MLAT treaties.',
    hops: 2,
  },
];

const LIVE_THREAT_FEED = [
  { time: '2m ago', alert: 'Tornado Cash 100 ETH Layering relay detected on Ethereum Mainnet', severity: 'CRITICAL' },
  { time: '8m ago', alert: 'Tron TRC-20 USDT sweep (540,000 USDT) routed to unhosted aggregator', severity: 'HIGH' },
  { time: '14m ago', alert: 'Intermediary peel chain hit Binance Deposit Address (Hop 2)', severity: 'INFO' },
  { time: '22m ago', alert: 'Cross-chain bridge relay: 42.5 ETH transferred to Arbitrum One', severity: 'HIGH' },
];

interface InvestigationTemplatesProps {
  onSelectScenario: (address: string, hops: number) => void;
  isLoading: boolean;
}

export const InvestigationTemplates: React.FC<InvestigationTemplatesProps> = ({
  onSelectScenario,
  isLoading,
}) => {
  return (
    <div className="space-y-4">
      {/* Section Header */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#3F3F3F] pb-3">
        <div>
          <div className="flex items-center space-x-2">
            <span className="p-1.5 rounded bg-[#FF5722]/15 border border-[#FF5722]/30 text-[#FF5722]">
              <Flame className="h-4 w-4" />
            </span>
            <h2 className="text-sm font-bold font-sans tracking-wide text-white uppercase">
              Mission Control & Active Investigation Scenarios
            </h2>
          </div>
          <p className="text-xs text-[#757575] font-mono mt-1">
            Production-grade benchmark datasets for multi-hop graph traversal, decay scoring, and lawful freeze notice generation.
          </p>
        </div>

        <div className="flex items-center space-x-2 text-[11px] font-mono text-[#B0B0B0]">
          <span className="flex items-center space-x-1.5 px-2.5 py-1 rounded bg-[#2D2D2D] border border-[#4F4F4F]">
            <Radio className="h-3 w-3 text-[#FF5722] animate-pulse" />
            <span>LIVE INTELLIGENCE STREAM</span>
          </span>
        </div>
      </div>

      {/* Grid of 6 High-Fidelity Threat Scenarios */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3.5">
        {NOTABLE_SCENARIOS.map((scenario) => {
          const isCritical = scenario.severity === 'CRITICAL';
          const isHigh = scenario.severity === 'HIGH';

          return (
            <div
              key={scenario.id}
              className={`glass-panel-interactive p-4 flex flex-col justify-between space-y-3 relative overflow-hidden group ${
                isCritical ? 'hover:border-[#FF5722]' : 'hover:border-[#FF8A65]'
              }`}
            >
              <div className="space-y-2">
                <div className="flex items-start justify-between gap-2">
                  <span
                    className={`badge-base ${
                      isCritical
                        ? 'badge-critical'
                        : isHigh
                        ? 'badge-warning'
                        : 'badge-safe'
                    }`}
                  >
                    {scenario.severity} RISK
                  </span>

                  <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-[#2D2D2D] border border-[#4F4F4F] text-[#E8E8E8] font-bold">
                    {scenario.chain}
                  </span>
                </div>

                <div>
                  <h3 className="font-bold text-sm text-white font-sans group-hover:text-[#FF5722] transition-colors line-clamp-1">
                    {scenario.name}
                  </h3>
                  <span className="text-[11px] font-mono text-[#FF8A65] block">
                    {scenario.category}
                  </span>
                </div>

                <p className="text-xs text-[#B0B0B0] leading-relaxed line-clamp-2">
                  {scenario.description}
                </p>

                <div className="p-2 rounded bg-[#1A1A1A]/80 border border-[#353535] font-mono text-[11px] text-[#757575] flex items-center justify-between">
                  <span className="truncate max-w-[200px] text-[#E8E8E8]">
                    {scenario.address.slice(0, 10)}...{scenario.address.slice(-8)}
                  </span>
                  <span className="text-[10px] font-bold text-[#FF5722] shrink-0">
                    {scenario.hops} HOPS DEPTH
                  </span>
                </div>
              </div>

              {/* Action Button */}
              <button
                type="button"
                disabled={isLoading}
                onClick={() => onSelectScenario(scenario.address, scenario.hops)}
                className="w-full btn-secondary text-xs py-2 hover:text-white"
              >
                <span>Launch Graph Traversal</span>
                <ArrowRight className="h-3.5 w-3.5 group-hover:translate-x-1 transition-transform" />
              </button>
            </div>
          );
        })}
      </div>

      {/* Real-Time Cyber Threat Ticker */}
      <div className="glass-panel p-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs font-mono">
        <div className="flex items-center space-x-2 shrink-0">
          <span className="w-2 h-2 rounded-full bg-[#FF5722] animate-ping" />
          <span className="font-bold uppercase tracking-wider text-white flex items-center space-x-1">
            <span>Threat Radar:</span>
          </span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-2 flex-1">
          {LIVE_THREAT_FEED.map((item, idx) => (
            <div
              key={idx}
              className="p-2 rounded bg-[#1A1A1A]/70 border border-[#353535] flex items-center space-x-2 text-[11px]"
            >
              <span className="text-[9px] text-[#757575] font-bold shrink-0">{item.time}</span>
              <span className="text-[#E8E8E8] truncate" title={item.alert}>
                {item.alert}
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
