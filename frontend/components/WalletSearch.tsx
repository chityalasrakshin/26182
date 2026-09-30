'use client';

import React, { useState } from 'react';
import { AlertCircle, ArrowUpRight, Radar, Search } from 'lucide-react';

interface WalletSearchProps { onAnalyze: (address: string, maxHops: number) => void; isLoading: boolean; compact?: boolean; }
const networkOptions = [
  { value: 'ethereum', label: 'Ethereum', hint: '0x… EVM address' },
  { value: 'tron', label: 'Tron', hint: 'T… TRC-20 address' },
  { value: 'bitcoin', label: 'Bitcoin', hint: '1, 3, or bc1… address' },
  { value: 'solana', label: 'Solana', hint: 'Base58 address' },
];

export const WalletSearch: React.FC<WalletSearchProps> = ({ onAnalyze, isLoading, compact = false }) => {
  const [address, setAddress] = useState('');
  const [network, setNetwork] = useState('ethereum');
  const [maxHops, setMaxHops] = useState(3);
  const [error, setError] = useState<string | null>(null);
  const cleanAddr = address.trim();
  const isEth = /^0x[0-9a-fA-F]{40}$/.test(cleanAddr);
  const isTron = /^T[1-9A-HJ-NP-za-km-z]{33}$/.test(cleanAddr);
  const isBtc = /^(1[a-km-zA-HJ-NP-Z1-9]{25,34}|3[a-km-zA-HJ-NP-Z1-9]{25,34}|bc1[a-zA-HJ-NP-Z0-9]{25,90})$/.test(cleanAddr);
  const isSol = !isTron && !isBtc && /^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(cleanAddr);
  const selectedNetwork = networkOptions.find((item) => item.value === network)!;
  const handleSubmit = (event: React.FormEvent) => {
    event.preventDefault(); setError(null);
    if (!cleanAddr) { setError('Enter a target Ethereum, Tron, Bitcoin, or Solana wallet address to begin tracing.'); return; }
    if (!isEth && !isTron && !isBtc && !isSol) { setError('Invalid wallet format. Use an Ethereum (0x…), Tron (T…), Bitcoin (1/3/bc1…), or Solana address.'); return; }
    onAnalyze(cleanAddr, maxHops);
  };
  return <section className={compact ? 'flex justify-end border-b border-[#2A2A2A] bg-transparent py-2' : 'border-y border-[#2A2A2A] bg-[#080808] py-8 md:py-12'}>
    <div className={compact ? 'w-full' : 'grid grid-cols-1 items-center gap-10 lg:grid-cols-[minmax(0,1.18fr)_minmax(380px,0.82fr)] lg:gap-16'}>
      {!compact && <div className="max-w-2xl">
        <p className="mb-7 flex items-center gap-2 font-mono text-[11px] font-semibold uppercase tracking-[0.16em] text-[#9A9A9A]"><span className="h-1.5 w-1.5 rounded-full bg-[#7CFF6B]" />Evidence-led attribution</p>
        <h2 className="max-w-xl text-4xl font-bold leading-[0.98] tracking-[-0.055em] text-[#FFFFFF] sm:text-5xl xl:text-6xl">Follow the crypto trail.<span className="block text-[#E5FF8F]">Identify the VASP.</span></h2>
        <p className="mt-6 max-w-xl text-sm leading-6 text-[#9A9A9A] sm:text-base">Turn a wallet address into an explainable transaction path, connecting on-chain movement to known exchanges, custodians, and risk signals.</p>
        <a href="/app?tab=RECENT_INVESTIGATIONS" className="mt-6 inline-flex items-center gap-1.5 border-b border-[#9A9A9A] pb-1 text-xs font-medium text-[#D6D6D6] transition-colors hover:border-[#E5FF8F] hover:text-[#E5FF8F] focus:outline-none focus:ring-1 focus:ring-[#E5FF8F]">Review case history <ArrowUpRight className="h-3.5 w-3.5" /></a>
        <div className="mt-12 grid max-w-xl grid-cols-[1fr_auto_1fr_auto_1fr] border-t border-[#2A2A2A] pt-5 font-mono"><div><span className="block text-xl font-bold text-[#FFFFFF]">01</span><span className="mt-1 block text-[10px] uppercase tracking-wide text-[#666666]">Wallet in</span></div><span className="pt-1 text-[#9A9A9A]">→</span><div className="pl-4"><span className="block text-xl font-bold text-[#FFFFFF]">Path</span><span className="mt-1 block text-[10px] uppercase tracking-wide text-[#666666]">Traced flow</span></div><span className="pt-1 text-[#9A9A9A]">→</span><div className="pl-4"><span className="block text-xl font-bold text-[#E5FF8F]">VASP</span><span className="mt-1 block text-[10px] uppercase tracking-wide text-[#666666]">Attribution out</span></div></div>
      </div>}
      <form onSubmit={handleSubmit} className={compact ? 'ml-auto flex w-full max-w-3xl items-center justify-end gap-1 rounded-full border border-white/[0.10] bg-white/[0.035] p-1 backdrop-blur-md [&>div.mt-5]:hidden [&>button]:mt-0 [&>button]:w-auto [&>button]:rounded-full [&>button]:px-3.5 [&>button]:py-2 [&>button]:text-xs [&>p]:hidden' : 'border border-[#2A2A2A] bg-[#161616] p-5 shadow-[0_18px_45px_rgba(0,0,0,0.28)] sm:p-7'}>
        <div className={compact ? 'hidden' : 'mb-6 flex items-start justify-between gap-4'}><div className="flex items-start gap-3"><div className="mt-0.5 flex h-8 w-8 items-center justify-center border border-[#2A2A2A] bg-[#101010] text-[#E5FF8F]"><Radar className="h-4 w-4" /></div><div><p className="font-mono text-[10px] uppercase tracking-[0.18em] text-[#9A9A9A]">New investigation</p><h3 className="mt-1 text-lg font-semibold text-[#FFFFFF]">Start a wallet trace</h3></div></div><span className="mt-1 inline-flex items-center gap-1.5 border border-[#7CFF6B]/25 bg-[#7CFF6B]/10 px-2 py-1 font-mono text-[10px] font-semibold uppercase text-[#7CFF6B]"><span className="h-1.5 w-1.5 rounded-full bg-[#7CFF6B]" />API ready</span></div>
        <label htmlFor="wallet-address" className={compact ? 'sr-only' : 'mb-2 block font-mono text-[10px] font-semibold uppercase tracking-wider text-[#9A9A9A]'}>Wallet address</label><div className={compact ? 'relative flex-1' : 'relative'}><Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#666666]" /><input id="wallet-address" type="text" value={address} onChange={(event) => { setAddress(event.target.value); if (error) setError(null); }} placeholder="0x... or bc1..." className={compact ? 'w-full rounded-full border border-[#2A2A2A] bg-[#101010] py-2 pl-9 pr-3 font-mono text-xs text-[#FFFFFF] outline-none transition-colors placeholder:text-[#666666] focus:border-[#E5FF8F] focus:ring-1 focus:ring-[#E5FF8F]' : 'w-full border border-[#2A2A2A] bg-[#101010] py-3 pl-10 pr-3 font-mono text-sm text-[#FFFFFF] outline-none transition-colors placeholder:text-[#666666] focus:border-[#E5FF8F] focus:ring-1 focus:ring-[#E5FF8F]'} /></div>
        <div className="mt-5 grid grid-cols-1 gap-4 sm:grid-cols-2"><div><label htmlFor="network" className="mb-2 block font-mono text-[10px] font-semibold uppercase tracking-wider text-[#9A9A9A]">Network</label><select id="network" value={network} onChange={(event) => setNetwork(event.target.value)} className="w-full border border-[#2A2A2A] bg-[#101010] px-3 py-3 text-sm text-[#FFFFFF] outline-none focus:border-[#E5FF8F] focus:ring-1 focus:ring-[#E5FF8F]">{networkOptions.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}</select><p className="mt-1.5 font-mono text-[10px] text-[#666666]">{selectedNetwork.hint}</p></div><div><label htmlFor="hop-depth" className="mb-2 block font-mono text-[10px] font-semibold uppercase tracking-wider text-[#9A9A9A]">Traversal depth</label><select id="hop-depth" value={maxHops} onChange={(event) => setMaxHops(Number(event.target.value))} className="w-full border border-[#2A2A2A] bg-[#101010] px-3 py-3 text-sm text-[#FFFFFF] outline-none focus:border-[#E5FF8F] focus:ring-1 focus:ring-[#E5FF8F]"><option value={1}>1 hop · Direct flow</option><option value={2}>2 hops · Rapid layering</option><option value={3}>3 hops · Full audit</option><option value={4}>4 hops · Deep crawl</option><option value={5}>5 hops · Complex tree</option></select><p className="mt-1.5 font-mono text-[10px] text-[#666666]">Bounded graph traversal</p></div></div>
        {error && <div role="alert" className="mt-5 flex items-start gap-2 border border-[#FF5C5C]/30 bg-[#FF5C5C]/10 p-3 font-mono text-xs leading-5 text-[#FF8A8A]"><AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />{error}</div>}
        <button type="submit" disabled={isLoading} className="mt-6 flex w-full items-center justify-center gap-2 bg-[#E5FF8F] px-4 py-3.5 text-sm font-bold text-[#0A0A0A] transition-colors hover:bg-[#EDFFB1] focus:outline-none focus:ring-2 focus:ring-[#E5FF8F] focus:ring-offset-2 focus:ring-offset-[#161616] disabled:cursor-not-allowed disabled:opacity-50">{isLoading ? <><span className="h-4 w-4 animate-spin rounded-full border-2 border-[#0A0A0A] border-t-transparent" />Tracing wallet…</> : <><Radar className="h-4 w-4" />Trace wallet <span aria-hidden="true">→</span></>}</button><p className="mt-4 text-center font-mono text-[10px] leading-4 text-[#666666]">Read-only attribution lookup. The selected rail records investigator intent; address format determines trace routing.</p>
      </form>
    </div>
  </section>;
};
