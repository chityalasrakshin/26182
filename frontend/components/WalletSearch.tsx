'use client';

import React, { useState, useEffect } from 'react';
import { Search, AlertCircle, Radar, ArrowUpRight } from 'lucide-react';
import { api } from '../lib/api';
import { CandidateWallet } from '../lib/types';

interface WalletSearchProps {
  onAnalyze: (address: string, maxHops: number) => void;
  isLoading: boolean;
}

export const WalletSearch: React.FC<WalletSearchProps> = ({
  onAnalyze,
  isLoading,
}) => {
  const [address, setAddress] = useState('');
  const [maxHops, setMaxHops] = useState<number>(3);
  const [error, setError] = useState<string | null>(null);
  const [dynamicCandidates, setDynamicCandidates] = useState<CandidateWallet[]>([]);

  useEffect(() => {
    const fetchTopCandidates = async () => {
      try {
        const res = await api.getCandidates({ limit: 6, min_score: 40, sort_by: 'quality' });
        if (res?.candidates && res.candidates.length > 0) {
          setDynamicCandidates(res.candidates);
        }
      } catch (err) {
        console.warn('Failed to load top candidates for search leads:', err);
      }
    };
    fetchTopCandidates();
  }, []);

  const cleanAddr = address.trim();
  const isEth = /^0x[0-9a-fA-F]{40}$/.test(cleanAddr);
  const isTron = /^T[1-9A-HJ-NP-za-km-z]{33}$/.test(cleanAddr);
  const isBtc = /^(1[a-km-zA-HJ-NP-Z1-9]{25,34}|3[a-km-zA-HJ-NP-Z1-9]{25,34}|bc1[a-zA-HJ-NP-Z0-9]{25,90})$/.test(cleanAddr);
  const isSol = !isTron && !isBtc && /^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(cleanAddr);

  const detectedChain = isEth
    ? 'Ethereum Mainnet'
    : isTron
      ? 'Tron Network (TRC-20)'
      : isBtc
        ? 'Bitcoin Mainnet'
        : isSol
          ? 'Solana Mainnet'
          : null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!cleanAddr) {
      setError('Please input a valid target Ethereum (0x...), Tron (T...), Bitcoin (1/3/bc1), or Solana address.');
      return;
    }

    if (!isEth && !isTron && !isBtc && !isSol) {
      setError('Invalid format: Target must be an Ethereum hex address (0x...), Tron Base58 (T...), Bitcoin address (1/3/bc1), or Solana Base58 (32-44 chars).');
      return;
    }

    onAnalyze(cleanAddr, maxHops);
  };

  const handleSelectPreset = (addr: string) => {
    setAddress(addr);
    setError(null);
  };

  return (
    <section className="bg-white rounded-2xl p-5 md:p-6 border border-[#E2E8F0] space-y-4 shadow-sm">
      {/* Console Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-2 border-b border-[#E2E8F0] pb-3.5">
        <div className="flex items-center gap-2.5">
          <div className="h-8 w-8 rounded-xl bg-sky-50 border border-sky-200 flex items-center justify-center text-[#0284C7]">
            <Radar className="h-4.5 w-4.5" />
          </div>
          <div>
            <span className="font-sans text-sm font-bold text-[#0F172A] tracking-tight block">
              Search Target Wallet
            </span>
          </div>
        </div>
      </div>

      {/* Search Input Engine & Parameters */}
      <form onSubmit={handleSubmit} className="flex flex-col lg:flex-row items-stretch gap-3 pt-1">
        <div className="relative flex-1">
          <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
            <Search className="h-4.5 w-4.5 text-[#94A3B8]" />
          </div>
          <input
            type="text"
            value={address}
            onChange={(e) => {
              setAddress(e.target.value);
              if (error) setError(null);
            }}
            placeholder="Enter suspect wallet address (0x... EVM, T... Tron TRC-20, 1/3/bc1... Bitcoin, or Solana)"
            className="w-full pl-11 pr-28 py-3.5 bg-[#F8FAFC] text-[#0F172A] font-mono text-xs sm:text-sm rounded-full border border-[#CBD5E1] focus:bg-white focus:outline-none focus:border-[#0284C7] focus:ring-1 focus:ring-[#0284C7] transition-all placeholder:text-[#94A3B8]"
          />
          <div className="absolute inset-y-0 right-0 pr-3.5 flex items-center gap-1.5">
            {detectedChain ? (
              <span className="px-2.5 py-0.5 rounded-full bg-sky-50 text-sky-700 font-mono text-[10px] uppercase font-bold border border-sky-200">
                {isEth ? 'EVM / ETH' : isTron ? 'TRON / TRC-20' : isBtc ? 'BITCOIN UTXO' : 'SOLANA'}
              </span>
            ) : null}
            {address && (
              <button
                type="button"
                onClick={() => setAddress('')}
                className="text-[#94A3B8] hover:text-[#0F172A] p-1 text-xs"
                title="Clear input"
              >
                ✕
              </button>
            )}
          </div>
        </div>

        <div className="flex items-center gap-2">
          <div className="flex items-center bg-[#F8FAFC] border border-[#CBD5E1] rounded-full px-4 py-2.5">
            <span className="font-mono text-xs text-[#64748B] uppercase mr-2 whitespace-nowrap">Hop Depth:</span>
            <select
              value={maxHops}
              onChange={(e) => setMaxHops(Number(e.target.value))}
              className="bg-transparent text-[#0F172A] font-mono text-xs focus:outline-none cursor-pointer"
            >
              <option value={1} className="bg-white text-[#0F172A]">1 Hop (Direct Flow)</option>
              <option value={2} className="bg-white text-[#0F172A]">2 Hops (Rapid Layering)</option>
              <option value={3} className="bg-white text-[#0F172A]">3 Hops (Full Audit Traversal)</option>
              <option value={4} className="bg-white text-[#0F172A]">4 Hops (Deep Cluster Crawl)</option>
              <option value={5} className="bg-white text-[#0F172A]">5 Hops (Complex Synthetic Tree)</option>
            </select>
          </div>

          <button
            type="submit"
            disabled={isLoading}
            className="flex items-center justify-center gap-2 bg-[#0284C7] hover:bg-[#0369A1] text-white font-sans text-xs sm:text-sm font-bold px-6 py-3.5 rounded-full shadow-sm hover:shadow-md transition-all whitespace-nowrap disabled:opacity-50"
          >
            {isLoading ? (
              <>
                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                <span>Tracing...</span>
              </>
            ) : (
              <>
                <Radar className="h-4 w-4 stroke-[2.5]" />
                <span>Trace Target</span>
              </>
            )}
          </button>
        </div>
      </form>

      {error && (
        <div className="flex items-center gap-2 text-rose-700 font-mono text-xs p-3 bg-rose-50 border border-rose-200 rounded-xl">
          <AlertCircle className="h-4 w-4 shrink-0 text-rose-600" />
          <span>{error}</span>
        </div>
      )}

      {/* Auto-Discovered Suspect Off-Ramp Leads Strip */}
      {dynamicCandidates.length > 0 && (
        <div className="pt-2 border-t border-[#E2E8F0]">
          <div className="flex items-center justify-between mb-2.5 font-mono text-xs">
            <span className="text-[#64748B] flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 rounded-full bg-[#0284C7]"></span>
              <span className="font-semibold text-[11px] text-[#0F172A]">
                DISCOVERED SUSPECT LEADS ({dynamicCandidates.length})
              </span>
            </span>
            <span className="text-[#10B981] font-bold text-[11px]">
              ON-CHAIN COUNTERPARTIES
            </span>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-2.5 font-mono">
            {dynamicCandidates.map((cand, idx) => (
              <div
                key={idx}
                onClick={() => handleSelectPreset(cand.address)}
                className="cursor-pointer bg-[#F8FAFC] hover:bg-sky-50/50 border border-[#E2E8F0] hover:border-[#0284C7]/50 p-2.5 rounded-xl transition-all flex flex-col justify-between group shadow-xs"
              >
                <div className="flex items-center justify-between">
                  <span className="text-[12px] font-semibold text-[#0F172A] group-hover:text-[#0284C7] transition-colors">
                    {cand.address.slice(0, 6)}...{cand.address.slice(-4)}
                  </span>
                  <span className="px-1.5 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200 text-[10px] font-bold">
                    {cand.candidate_quality_score.toFixed(1)}
                  </span>
                </div>
                <div className="flex items-center justify-between text-[11px] text-[#64748B] mt-1.5">
                  <span>{cand.chain.toUpperCase()} • {cand.transaction_count} Tx</span>
                  <span className="text-[#0284C7] font-medium truncate ml-1">
                    → {cand.discovery_vasp_name}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </section>
  );
};
