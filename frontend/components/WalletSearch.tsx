'use client';

import React, { useState, useEffect } from 'react';
import { Search, AlertCircle, ArrowRight, Radar, Sparkles } from 'lucide-react';
import { api } from '../lib/api';
import { CandidateWallet } from '../lib/types';

interface WalletSearchProps {
  onAnalyze: (address: string, maxHops: number) => void;
  isLoading: boolean;
}

const BENCHMARK_PRESETS = [
  {
    name: 'Binance Hot Wallet 14',
    address: '0x28C6c06298d514Db089934071355E5743bf21d60',
    chain: 'Ethereum',
    type: 'VASP Deposit Node',
    badge: 'Exchange',
    badgeColor: 'bg-blue-500/20 text-blue-300 border-blue-500/30'
  },
  {
    name: 'Coinbase Hot Wallet 2',
    address: '0xA090e606E30bD747d4E6245a1517EbE430F0057e',
    chain: 'Ethereum',
    type: 'Custody Settlement',
    badge: 'Exchange',
    badgeColor: 'bg-purple-500/20 text-purple-300 border-purple-500/30'
  },
  {
    name: 'Tornado Cash Router',
    address: '0xd90e2f925DA726b50C4Ed8D0Fb90Ad053324F31b',
    chain: 'Ethereum',
    type: 'Sanctioned Mixing Contract',
    badge: 'OFAC Mixer',
    badgeColor: 'bg-red-500/20 text-red-300 border-red-500/30'
  },
  {
    name: 'WazirX $230M Hacker',
    address: '0x3d0246a49591A5462D42fF025b6a3F2169E66e2c',
    chain: 'Ethereum',
    type: 'Scam / Exploit Recipient',
    badge: 'High Risk',
    badgeColor: 'bg-rose-500/20 text-rose-300 border-rose-500/30'
  },
  {
    name: 'Binance Tron Hot Wallet',
    address: 'TMuA6YMeL4nNFYWAnWUCtqnmEvrCfsugnR',
    chain: 'Tron TRC-20',
    type: 'USDT Sweep Consolidation',
    badge: 'TRC-20',
    badgeColor: 'bg-amber-500/20 text-amber-300 border-amber-500/30'
  },
  {
    name: 'Binance Cold Storage BTC',
    address: '34xp4vRoCGJym3xR7yCVPFHoCNxv4Twseo',
    chain: 'Bitcoin',
    type: 'UTXO Cold Storage Wallet',
    badge: 'Bitcoin',
    badgeColor: 'bg-orange-500/20 text-orange-300 border-orange-500/30'
  }
];


export const WalletSearch: React.FC<WalletSearchProps> = ({
  onAnalyze,
  isLoading,
}) => {
  const [address, setAddress] = useState('');
  const [maxHops, setMaxHops] = useState<number>(3);
  const [error, setError] = useState<string | null>(null);
  const [dynamicCandidates, setDynamicCandidates] = useState<CandidateWallet[]>([]);

  useEffect(() => {
    // Load top discovered candidates dynamically from database
    const fetchTopCandidates = async () => {
      try {
        const res = await api.getCandidates({ limit: 6, min_score: 40, sort_by: 'quality' });
        if (res?.candidates && res.candidates.length > 0) {
          setDynamicCandidates(res.candidates);
        }
      } catch (err) {
        console.warn('Failed to load top candidates for search presets:', err);
      }
    };
    fetchTopCandidates();
  }, []);

  const cleanAddr = address.trim();
  const detectedChain = cleanAddr.startsWith('0x')
    ? 'Ethereum Mainnet'
    : cleanAddr.startsWith('T')
    ? 'Tron Network (TRC-20)'
    : (cleanAddr.startsWith('1') || cleanAddr.startsWith('3') || cleanAddr.startsWith('bc1'))
    ? 'Bitcoin Mainnet'
    : null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!cleanAddr) {
      setError('Please input a valid target Ethereum (0x...), Tron (T...), or Bitcoin wallet address.');
      return;
    }

    const isEth = /^0x[0-9a-fA-F]{40}$/.test(cleanAddr);
    const isTron = /^T[1-9A-HJ-NP-za-km-z]{33}$/.test(cleanAddr);
    const isBtc = /^(1[a-km-zA-HJ-NP-Z1-9]{25,34}|3[a-km-zA-HJ-NP-Z1-9]{25,34}|bc1[a-zA-HJ-NP-Z0-9]{25,90})$/.test(cleanAddr);

    if (!isEth && !isTron && !isBtc) {
      setError('Invalid format: Target must be an Ethereum hex address (0x...), Tron Base58 (T...), or Bitcoin address (1/3/bc1).');
      return;
    }

    onAnalyze(cleanAddr, maxHops);
  };

  const handleSelectPreset = (addr: string) => {
    setAddress(addr);
    setError(null);
  };

  return (
    <div className="bg-forensic-surface border border-forensic-border rounded shadow-sm text-xs transition-colors">
      <div className="px-4 py-2 border-b border-forensic-border bg-forensic-bg flex items-center justify-between flex-wrap gap-2">
        <div className="flex items-center space-x-2">
          <span className="font-mono text-[11px] uppercase tracking-wider text-forensic-textDim font-semibold">
            Target Wallet Acquisition & Depth Parameters
          </span>
          {detectedChain && (
            <span className="font-mono text-[10px] px-2 py-0.5 rounded bg-blue-500/15 text-blue-600 dark:text-blue-300 border border-blue-500/30">
              Detected: {detectedChain}
            </span>
          )}
        </div>
      </div>

      <form onSubmit={handleSubmit} className="p-4 space-y-3">
        {/* Curated Benchmark Scenarios (Phase 8 Evaluator Presets) */}
        <div className="p-2.5 rounded bg-forensic-surfaceRaised/60 border border-forensic-border space-y-2">
          <div className="flex items-center justify-between text-[10px] uppercase font-mono">
            <span className="flex items-center space-x-1 text-forensic-textMuted font-bold">
              <Sparkles className="h-3 w-3 text-amber-400" />
              <span>Notable Target Wallets (Live On-Chain Analysis):</span>
            </span>
            <span className="text-[9px] text-forensic-teal font-semibold">
              🌐 Live Explorer Query
            </span>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-1.5">
            {BENCHMARK_PRESETS.map((preset, idx) => (
              <button
                key={idx}
                type="button"
                onClick={() => handleSelectPreset(preset.address)}
                className={`p-1.5 text-left rounded border transition-all text-[11px] font-mono flex flex-col justify-between ${
                  address.toLowerCase() === preset.address.toLowerCase()
                    ? 'bg-blue-600/20 border-blue-500 text-forensic-text shadow-sm ring-1 ring-blue-500/40'
                    : 'bg-forensic-bg hover:bg-forensic-surface border-forensic-border text-forensic-textMuted hover:text-forensic-text'
                }`}
              >
                <div className="font-bold text-[10px] truncate text-forensic-text">
                  {preset.name}
                </div>
                <div className="flex items-center justify-between mt-1 text-[9px]">
                  <span className="text-forensic-textDim">{preset.chain}</span>
                  <span className={`px-1 py-0.2 rounded border ${preset.badgeColor}`}>
                    {preset.badge}
                  </span>
                </div>
              </button>
            ))}
          </div>
        </div>

        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
          <div className="relative flex-1">
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-forensic-textDim">
              <Search className="h-4 w-4" />
            </div>
            <input
              type="text"
              value={address}
              onChange={(e) => {
                setAddress(e.target.value);
                if (error) setError(null);
              }}
              placeholder="Enter suspect target wallet address (0x... ETH, T... Tron TRC-20, or 1/3/bc1... BTC)"
              className="w-full pl-9 pr-3 py-2 bg-forensic-bg border border-forensic-border rounded text-forensic-text placeholder-forensic-textDim font-mono text-xs focus:outline-none focus:border-blue-500 transition-colors"
            />
          </div>

          <div className="flex items-center space-x-2">
            <div className="flex items-center space-x-1 bg-forensic-surfaceRaised px-2 py-1.5 border border-forensic-border rounded">
              <span className="text-[10px] text-forensic-textMuted uppercase font-semibold">Depth:</span>
              <select
                value={maxHops}
                onChange={(e) => setMaxHops(Number(e.target.value))}
                className="bg-transparent text-forensic-text font-mono text-xs focus:outline-none cursor-pointer"
              >
                <option value={1} className="bg-forensic-surface text-forensic-text">1 Hop (Direct Interaction)</option>
                <option value={2} className="bg-forensic-surface text-forensic-text">2 Hops (Intermediary Layering)</option>
                <option value={3} className="bg-forensic-surface text-forensic-text">3 Hops (Full Audit Traversal)</option>
              </select>
            </div>

            <button
              type="submit"
              disabled={isLoading}
              className="px-4 py-2 bg-blue-700 hover:bg-blue-600 disabled:opacity-50 text-white font-medium rounded transition-colors flex items-center space-x-1.5 shadow-sm"
            >
              {isLoading ? (
                <>
                  <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  <span>Tracing...</span>
                </>
              ) : (
                <>
                  <span>Trace Target</span>
                  <ArrowRight className="h-3.5 w-3.5" />
                </>
              )}
            </button>
          </div>
        </div>

        {error && (
          <div className="flex items-center space-x-2 text-red-600 dark:text-red-400 font-mono text-xs p-2 bg-red-500/10 border border-red-500/20 rounded">
            <AlertCircle className="h-4 w-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {/* Dynamic Real On-Chain Candidate Leads */}
        <div className="pt-2 border-t border-forensic-border space-y-1.5">
          <div className="flex items-center justify-between text-[10px] text-forensic-textDim uppercase font-mono">
            <span className="flex items-center space-x-1">
              <Radar className="h-3 w-3 text-blue-400" />
              <span>Auto-Discovered High-Quality Target Leads ({dynamicCandidates.length}):</span>
            </span>
            <span className="text-[9px] text-forensic-teal font-semibold">Real Blockchain Counterparties</span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2 font-mono">
            {dynamicCandidates.length > 0 ? (
              dynamicCandidates.map((cand, idx) => (
                <button
                  key={idx}
                  type="button"
                  onClick={() => handleSelectPreset(cand.address)}
                  className="p-2 text-left bg-forensic-bg hover:bg-forensic-surfaceRaised border border-forensic-border rounded transition-colors group flex flex-col justify-between space-y-1"
                >
                  <div className="flex items-center justify-between text-[11px]">
                    <span className="font-bold text-forensic-text group-hover:text-blue-400 transition-colors truncate max-w-[160px]">
                      {cand.address.slice(0, 8)}...{cand.address.slice(-6)}
                    </span>
                    <span className="text-[10px] font-bold text-emerald-400 bg-emerald-500/10 px-1.5 py-0.2 rounded border border-emerald-500/20">
                      Score: {cand.candidate_quality_score.toFixed(1)}
                    </span>
                  </div>

                  <div className="flex items-center justify-between text-[10px] text-forensic-textDim">
                    <span>{cand.chain.toUpperCase()} • {cand.transaction_count} Tx</span>
                    <span className="text-forensic-textMuted group-hover:text-forensic-text">
                      → {cand.discovery_vasp_name}
                    </span>
                  </div>
                </button>
              ))
            ) : (
              <div className="col-span-3 text-[11px] text-forensic-textDim py-1 italic">
                Discovery pipeline populating candidates from VASP transaction history...
              </div>
            )}
          </div>
        </div>
      </form>
    </div>
  );
};
