'use client';

import React, { useState, useMemo } from 'react';
import {
  FolderOpen,
  Search,
  RefreshCw,
  ExternalLink,
  Copy,
  Check,
  ArrowRight,
  Shield,
  Activity,
  Calendar,
  Layers,
  LayoutGrid,
  List,
  Clock,
  Sparkles,
  AlertCircle,
  Database,
} from 'lucide-react';
import { AnalysisStatus } from '../lib/types';

interface RecentInvestigationsViewProps {
  recentAnalyses: AnalysisStatus[];
  onSelectInvestigation: (walletAddress: string, maxHops?: number) => void;
  onRefresh?: () => Promise<void> | void;
}

function detectChain(address: string): 'ethereum' | 'tron' | 'bitcoin' | 'solana' {
  if (address.startsWith('0x')) return 'ethereum';
  if (address.startsWith('T') && address.length === 34) return 'tron';
  if (address.startsWith('1') || address.startsWith('3') || address.startsWith('bc1')) return 'bitcoin';
  return 'solana';
}

function getExplorerUrl(address: string): string {
  const chain = detectChain(address);
  switch (chain) {
    case 'ethereum':
      return `https://etherscan.io/address/${address}`;
    case 'tron':
      return `https://tronscan.org/#/address/${address}`;
    case 'bitcoin':
      return `https://mempool.space/address/${address}`;
    case 'solana':
      return `https://solscan.io/account/${address}`;
  }
}

export const RecentInvestigationsView: React.FC<RecentInvestigationsViewProps> = ({
  recentAnalyses,
  onSelectInvestigation,
  onRefresh,
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('ALL');
  const [chainFilter, setChainFilter] = useState<string>('ALL');
  const [viewMode, setViewMode] = useState<'grid' | 'table'>('grid');
  const [copiedAddress, setCopiedAddress] = useState<string | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);

  const handleCopy = (addr: string) => {
    navigator.clipboard.writeText(addr);
    setCopiedAddress(addr);
    setTimeout(() => setCopiedAddress(null), 2000);
  };

  const handleRefreshClick = async () => {
    if (!onRefresh) return;
    setIsRefreshing(true);
    try {
      await onRefresh();
    } finally {
      setTimeout(() => setIsRefreshing(false), 500);
    }
  };

  const filteredAnalyses = useMemo(() => {
    return recentAnalyses.filter((run) => {
      const q = searchQuery.toLowerCase().trim();
      const addr = (run.wallet_address || '').toLowerCase();
      const status = (run.status || '').toLowerCase();
      const chain = detectChain(run.wallet_address);

      const matchesQuery = !q || addr.includes(q) || status.includes(q);
      const matchesStatus = statusFilter === 'ALL' || run.status === statusFilter;
      const matchesChain = chainFilter === 'ALL' || chain === chainFilter.toLowerCase();

      return matchesQuery && matchesStatus && matchesChain;
    });
  }, [recentAnalyses, searchQuery, statusFilter, chainFilter]);

  // Aggregate Metrics
  const metrics = useMemo(() => {
    const total = recentAnalyses.length;
    const completed = recentAnalyses.filter((r) => r.status === 'COMPLETED').length;
    let totalTx = 0;
    let totalNodes = 0;
    const uniqueChains = new Set<string>();

    recentAnalyses.forEach((r) => {
      totalTx += r.num_transactions || 0;
      totalNodes += r.num_nodes || 0;
      uniqueChains.add(detectChain(r.wallet_address));
    });

    return { total, completed, totalTx, totalNodes, chainsCovered: uniqueChains.size };
  }, [recentAnalyses]);

  return (
    <div className="space-y-5 animate-fade-in font-sans pb-10">
      {/* 1. Header Banner */}
      <div className="bg-white border border-[#E2E8F0] rounded-2xl p-5 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center space-x-3.5">
          <div className="w-11 h-11 rounded-xl bg-sky-50 border border-sky-200 flex items-center justify-center text-[#0284C7] shrink-0 shadow-sm">
            <FolderOpen className="h-6 w-6" />
          </div>
          <div>
            <div className="flex items-center space-x-2.5">
              <h1 className="font-bold text-[#0F172A] text-lg tracking-wide font-mono">
                Recent Investigations
              </h1>
              <span className="text-[10px] px-2.5 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200 font-mono font-bold">
                {recentAnalyses.length} RUNS
              </span>
            </div>
            <p className="text-xs text-[#64748B] font-sans mt-0.5">
              Cached multi-hop graph states, on-chain transaction snapshots, and forensic runs
            </p>
          </div>
        </div>

        {/* View Toggle & Refresh */}
        <div className="flex items-center space-x-2 shrink-0 font-mono">
          <div className="flex items-center bg-[#F1F5F9] border border-[#E2E8F0] rounded-lg p-1 text-xs">
            <button
              onClick={() => setViewMode('grid')}
              className={`px-3 py-1 rounded-md flex items-center space-x-1.5 transition-colors ${
                viewMode === 'grid'
                  ? 'bg-[#0284C7] text-white font-bold shadow-sm'
                  : 'text-[#64748B] hover:text-[#0F172A]'
              }`}
              title="Grid View"
            >
              <LayoutGrid className="h-3.5 w-3.5" />
              <span className="hidden sm:inline text-[11px]">Grid</span>
            </button>
            <button
              onClick={() => setViewMode('table')}
              className={`px-3 py-1 rounded-md flex items-center space-x-1.5 transition-colors ${
                viewMode === 'table'
                  ? 'bg-[#0284C7] text-white font-bold shadow-sm'
                  : 'text-[#64748B] hover:text-[#0F172A]'
              }`}
              title="Table View"
            >
              <List className="h-3.5 w-3.5" />
              <span className="hidden sm:inline text-[11px]">Table</span>
            </button>
          </div>

          {onRefresh && (
            <button
              onClick={handleRefreshClick}
              disabled={isRefreshing}
              className="p-2 rounded-lg bg-white hover:bg-slate-50 text-[#0F172A] border border-[#E2E8F0] shadow-sm transition-all flex items-center space-x-1.5 text-xs"
              title="Refresh Recent Investigations"
            >
              <RefreshCw className={`h-4 w-4 ${isRefreshing ? 'animate-spin text-[#0284C7]' : 'text-[#64748B]'}`} />
              <span className="hidden sm:inline text-[11px]">Sync</span>
            </button>
          )}
        </div>
      </div>

      {/* 2. Metrics Strip */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 font-mono text-xs">
        <div className="p-4 rounded-xl bg-white border border-[#E2E8F0] shadow-sm">
          <div className="flex items-center justify-between text-[#64748B] text-[10px] uppercase font-bold tracking-wider">
            <span>Total Investigated</span>
            <Database className="h-3.5 w-3.5 text-[#0284C7]" />
          </div>
          <div className="text-xl font-bold text-[#0F172A] mt-1.5">{metrics.total}</div>
          <span className="text-[10px] text-[#0284C7] block mt-0.5">Cached in SQLite &amp; Memory</span>
        </div>

        <div className="p-4 rounded-xl bg-white border border-[#E2E8F0] shadow-sm">
          <div className="flex items-center justify-between text-[#64748B] text-[10px] uppercase font-bold tracking-wider">
            <span>Completed Traces</span>
            <Shield className="h-3.5 w-3.5 text-emerald-600" />
          </div>
          <div className="text-xl font-bold text-emerald-700 mt-1.5">{metrics.completed}</div>
          <span className="text-[10px] text-[#64748B] block mt-0.5">
            {metrics.total > 0 ? `${((metrics.completed / metrics.total) * 100).toFixed(0)}% completion rate` : '0%'}
          </span>
        </div>

        <div className="p-4 rounded-xl bg-white border border-[#E2E8F0] shadow-sm">
          <div className="flex items-center justify-between text-[#64748B] text-[10px] uppercase font-bold tracking-wider">
            <span>Observed Transfers</span>
            <Activity className="h-3.5 w-3.5 text-rose-600" />
          </div>
          <div className="text-xl font-bold text-[#0F172A] mt-1.5">{metrics.totalTx.toLocaleString()}</div>
          <span className="text-[10px] text-[#64748B] block mt-0.5">Across all hops</span>
        </div>

        <div className="p-4 rounded-xl bg-white border border-[#E2E8F0] shadow-sm">
          <div className="flex items-center justify-between text-[#64748B] text-[10px] uppercase font-bold tracking-wider">
            <span>Chains Covered</span>
            <Layers className="h-3.5 w-3.5 text-amber-600" />
          </div>
          <div className="text-xl font-bold text-[#0F172A] mt-1.5">
            {metrics.chainsCovered} <span className="text-xs font-normal text-[#64748B]">Rail(s)</span>
          </div>
          <span className="text-[10px] text-[#64748B] block mt-0.5">ETH • BTC • TRX • SOL</span>
        </div>
      </div>

      {/* 3. Filter & Search Controls */}
      <div className="p-3 rounded-xl bg-white border border-[#E2E8F0] flex flex-wrap items-center justify-between gap-3 text-xs font-mono shadow-sm">
        <div className="flex-1 min-w-[220px] relative">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-[#64748B]" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Filter by suspect address or status..."
            className="w-full bg-[#F8FAFC] border border-[#E2E8F0] rounded-lg pl-10 pr-4 py-2 text-xs text-[#0F172A] placeholder-[#94A3B8] focus:outline-none focus:border-[#0284C7]"
          />
        </div>

        <div className="flex items-center space-x-2">
          {/* Status Filter */}
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="bg-[#F8FAFC] border border-[#E2E8F0] rounded-lg px-3 py-2 text-xs text-[#0F172A] focus:outline-none focus:border-[#0284C7]"
          >
            <option value="ALL">All Statuses</option>
            <option value="COMPLETED">Completed</option>
            <option value="QUEUED">Queued</option>
            <option value="ANALYZING">Analyzing</option>
            <option value="FAILED">Failed</option>
          </select>

          {/* Chain Filter */}
          <select
            value={chainFilter}
            onChange={(e) => setChainFilter(e.target.value)}
            className="bg-[#F8FAFC] border border-[#E2E8F0] rounded-lg px-3 py-2 text-xs text-[#0F172A] focus:outline-none focus:border-[#0284C7]"
          >
            <option value="ALL">All Blockchains</option>
            <option value="ETH">Ethereum (ETH)</option>
            <option value="TRX">Tron (TRX)</option>
            <option value="BTC">Bitcoin (BTC)</option>
            <option value="SOL">Solana (SOL)</option>
          </select>
        </div>
      </div>

      {/* 4. Main Listing */}
      {filteredAnalyses.length === 0 ? (
        <div className="p-12 rounded-xl bg-white border border-[#E2E8F0] text-center space-y-3 font-mono shadow-sm">
          <AlertCircle className="h-8 w-8 text-[#64748B] mx-auto" />
          <div className="text-sm font-bold text-[#0F172A]">No Recent Investigations Found</div>
          <p className="text-xs text-[#64748B] max-w-md mx-auto">
            {searchQuery || statusFilter !== 'ALL' || chainFilter !== 'ALL'
              ? 'No investigations match your active filters. Try clearing search keywords.'
              : 'There are no recent target wallet investigations cached yet. Execute a trace in the workspace to populate this register.'}
          </p>
        </div>
      ) : viewMode === 'grid' ? (
        /* GRID VIEW */
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 font-mono">
          {filteredAnalyses.map((run, idx) => {
            const chain = detectChain(run.wallet_address);
            const chainBadge =
              chain === 'ethereum'
                ? { label: 'ETH', color: 'bg-blue-50 text-blue-700 border-blue-200' }
                : chain === 'tron'
                ? { label: 'TRX', color: 'bg-red-50 text-red-700 border-red-200' }
                : chain === 'bitcoin'
                ? { label: 'BTC', color: 'bg-amber-50 text-amber-700 border-amber-200' }
                : { label: 'SOL', color: 'bg-purple-50 text-purple-700 border-purple-200' };

            const isCompleted = run.status === 'COMPLETED';

            return (
              <div
                key={idx}
                className="p-5 rounded-xl bg-white hover:border-[#0284C7] border border-[#E2E8F0] transition-all shadow-sm flex flex-col justify-between space-y-4 group"
              >
                {/* Card Header: Address + Status */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between gap-2">
                    <span className={`text-[9px] px-2 py-0.5 rounded-full font-bold uppercase border ${chainBadge.color}`}>
                      {chainBadge.label}
                    </span>
                    <span
                      className={`text-[9px] px-2.5 py-0.5 rounded-full font-bold uppercase border ${
                        isCompleted
                          ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                          : run.status === 'FAILED'
                          ? 'bg-rose-50 text-rose-700 border-rose-200'
                          : 'bg-amber-50 text-amber-700 border-amber-200 animate-pulse'
                      }`}
                    >
                      {run.status}
                    </span>
                  </div>

                  <div className="flex items-center justify-between pt-1">
                    <span className="font-bold text-[#0F172A] text-xs truncate max-w-[210px] tracking-tight font-mono">
                      {run.wallet_address.slice(0, 10)}...{run.wallet_address.slice(-8)}
                    </span>
                    <div className="flex items-center space-x-1 shrink-0">
                      <button
                        onClick={() => handleCopy(run.wallet_address)}
                        className="p-1.5 rounded-lg hover:bg-slate-100 text-[#64748B] hover:text-[#0F172A] transition-colors"
                        title="Copy Wallet Address"
                      >
                        {copiedAddress === run.wallet_address ? (
                          <Check className="h-3.5 w-3.5 text-emerald-600" />
                        ) : (
                          <Copy className="h-3.5 w-3.5" />
                        )}
                      </button>
                      <a
                        href={getExplorerUrl(run.wallet_address)}
                        target="_blank"
                        rel="noreferrer"
                        className="p-1.5 rounded-lg hover:bg-slate-100 text-[#64748B] hover:text-[#0284C7] transition-colors"
                        title="Inspect on Public Explorer"
                      >
                        <ExternalLink className="h-3.5 w-3.5" />
                      </a>
                    </div>
                  </div>
                </div>

                {/* Metrics Details */}
                <div className="grid grid-cols-3 gap-2 py-2 px-3 rounded-lg bg-[#F8FAFC] border border-[#E2E8F0] text-center text-[10px]">
                  <div>
                    <span className="text-[#64748B] block text-[9px] uppercase font-semibold">Transfers</span>
                    <span className="font-bold text-[#0F172A] mt-0.5 block">
                      {run.num_transactions ?? 0}
                    </span>
                  </div>
                  <div>
                    <span className="text-[#64748B] block text-[9px] uppercase font-semibold">Nodes</span>
                    <span className="font-bold text-[#0F172A] mt-0.5 block">
                      {run.num_nodes ?? 0}
                    </span>
                  </div>
                  <div>
                    <span className="text-[#64748B] block text-[9px] uppercase font-semibold">Edges</span>
                    <span className="font-bold text-[#0F172A] mt-0.5 block">
                      {run.num_edges ?? 0}
                    </span>
                  </div>
                </div>

                {/* Footer Action */}
                <button
                  onClick={() => onSelectInvestigation(run.wallet_address, 3)}
                  className="w-full py-2 px-4 rounded-lg bg-[#0284C7] hover:bg-[#0369A1] text-white font-bold text-xs flex items-center justify-center space-x-1.5 transition-all cursor-pointer shadow-sm"
                >
                  <span>Open in Workspace &amp; Trace</span>
                  <ArrowRight className="h-3.5 w-3.5 transition-transform group-hover:translate-x-0.5" />
                </button>
              </div>
            );
          })}
        </div>
      ) : (
        /* TABLE VIEW */
        <div className="bg-white border border-[#E2E8F0] rounded-xl overflow-hidden shadow-sm font-mono text-xs">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-[#E2E8F0] bg-[#F8FAFC] text-[#64748B] text-[10px] uppercase tracking-wider">
                  <th className="py-3.5 px-4">Chain</th>
                  <th className="py-3.5 px-4">Suspect Target Address</th>
                  <th className="py-3.5 px-4">Status</th>
                  <th className="py-3.5 px-4 text-center">Transfers</th>
                  <th className="py-3.5 px-4 text-center">Nodes</th>
                  <th className="py-3.5 px-4 text-center">Edges</th>
                  <th className="py-3.5 px-4 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#E2E8F0]">
                {filteredAnalyses.map((run, idx) => {
                  const chain = detectChain(run.wallet_address);
                  const isCompleted = run.status === 'COMPLETED';

                  return (
                    <tr key={idx} className="hover:bg-[#F8FAFC] transition-colors">
                      <td className="py-3.5 px-4">
                        <span className="text-[10px] px-2 py-0.5 rounded-full bg-[#F1F5F9] text-[#0F172A] border border-[#E2E8F0] font-bold uppercase">
                          {chain.slice(0, 3)}
                        </span>
                      </td>
                      <td className="py-3.5 px-4">
                        <div className="flex items-center space-x-2">
                          <span className="font-bold text-[#0F172A] select-all">
                            {run.wallet_address.slice(0, 14)}...{run.wallet_address.slice(-10)}
                          </span>
                          <button
                            onClick={() => handleCopy(run.wallet_address)}
                            className="p-1 rounded hover:bg-slate-200 text-[#64748B] hover:text-[#0F172A] transition-colors"
                            title="Copy Wallet Address"
                          >
                            {copiedAddress === run.wallet_address ? (
                              <Check className="h-3 w-3 text-emerald-600" />
                            ) : (
                              <Copy className="h-3 w-3" />
                            )}
                          </button>
                          <a
                            href={getExplorerUrl(run.wallet_address)}
                            target="_blank"
                            rel="noreferrer"
                            className="p-1 rounded hover:bg-slate-200 text-[#64748B] hover:text-[#0284C7] transition-colors"
                            title="Inspect on Explorer"
                          >
                            <ExternalLink className="h-3 w-3" />
                          </a>
                        </div>
                      </td>
                      <td className="py-3.5 px-4">
                        <span
                          className={`text-[9px] px-2.5 py-0.5 rounded-full font-bold uppercase border ${
                            isCompleted
                              ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                              : run.status === 'FAILED'
                              ? 'bg-rose-50 text-rose-700 border-rose-200'
                              : 'bg-amber-50 text-amber-700 border-amber-200'
                          }`}
                        >
                          {run.status}
                        </span>
                      </td>
                      <td className="py-3.5 px-4 text-center font-bold text-[#0F172A]">
                        {run.num_transactions ?? 0}
                      </td>
                      <td className="py-3.5 px-4 text-center text-[#64748B]">
                        {run.num_nodes ?? 0}
                      </td>
                      <td className="py-3.5 px-4 text-center text-[#64748B]">
                        {run.num_edges ?? 0}
                      </td>
                      <td className="py-3.5 px-4 text-right">
                        <button
                          onClick={() => onSelectInvestigation(run.wallet_address, 3)}
                          className="px-3.5 py-1.5 rounded-lg bg-[#0284C7] hover:bg-[#0369A1] text-white font-bold text-[11px] transition-colors inline-flex items-center space-x-1 shadow-sm"
                        >
                          <span>Trace</span>
                          <ArrowRight className="h-3 w-3" />
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
};
