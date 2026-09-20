'use client';

import React, { useState } from 'react';
import {
  Wallet,
  IndianRupee,
  ShieldCheck,
  AlertTriangle,
  Copy,
  Check,
  ExternalLink,
  TrendingUp,
  Network,
} from 'lucide-react';
import { GraphData, Attribution } from '../lib/types';

interface WalletOverviewProps {
  walletAddress: string;
  chain?: string;
  graphData?: GraphData | null;
  attributions?: Attribution[];
  className?: string;
}

export const WalletOverview: React.FC<WalletOverviewProps> = ({
  walletAddress,
  chain = 'ethereum',
  graphData,
  attributions = [],
  className = '',
}) => {
  const [copied, setCopied] = useState(false);

  if (!walletAddress) return null;

  const handleCopy = () => {
    navigator.clipboard.writeText(walletAddress);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const chainUpper = (chain || 'ethereum').toUpperCase();
  const explorerUrl =
    chain.toLowerCase() === 'tron'
      ? 'https://tronscan.org/#/address/' + walletAddress
      : 'https://etherscan.io/address/' + walletAddress;

  const totalInr = graphData?.stats?.total_amount_inr ?? 0;
  const totalUsd = graphData?.stats?.total_amount_usd ?? 0;
  const taintRatio = graphData?.stats?.taint_summary?.overall_taint_ratio ?? 0.0;
  const primaryVasp = attributions.length > 0 ? attributions[0] : null;

  const isHighRisk = primaryVasp !== null || taintRatio >= 0.5 || totalInr >= 1000000;
  const flightRiskLabel = (graphData?.stats?.total_edges ?? 0) === 0 ? 'LOW' : isHighRisk ? 'HIGH' : 'MEDIUM';

  const formatINR = (val: number) => {
    if (val >= 10000000) return '₹' + (val / 10000000).toFixed(2) + ' Cr';
    if (val >= 100000) return '₹' + (val / 100000).toFixed(2) + ' Lakh';
    return '₹' + Math.round(val).toLocaleString('en-IN');
  };

  const formatUSD = (val: number) => {
    return '$' + Math.round(val).toLocaleString('en-US');
  };

  return (
    <div
      className={`bg-white border border-[#E2E8F0] rounded-2xl p-5 md:p-6 font-mono text-xs space-y-4 shadow-sm text-[#0F172A] ${className}`}
    >
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#E2E8F0] pb-4">
        <div className="flex items-center space-x-3">
          <div className="h-9 w-9 rounded-xl bg-sky-50 border border-sky-200 flex items-center justify-center text-[#0284C7]">
            <Wallet className="h-4.5 w-4.5" />
          </div>
          <div>
            <div className="flex items-center space-x-2">
              <span className="text-[10px] uppercase font-bold text-[#64748B]">
                Suspect Target Wallet
              </span>
              <span className="px-2 py-0.5 rounded-full text-[9px] font-bold bg-sky-50 border border-sky-200 text-sky-700">
                {chainUpper}
              </span>
            </div>
            <div className="flex items-center space-x-2 mt-0.5">
              <span className="text-xs sm:text-sm font-bold text-[#0F172A] break-all select-all">
                {walletAddress}
              </span>
              <button
                onClick={handleCopy}
                title="Copy Address"
                className="p-1 hover:text-[#0284C7] text-[#64748B] transition-colors"
              >
                {copied ? <Check className="h-3.5 w-3.5 text-emerald-600" /> : <Copy className="h-3.5 w-3.5" />}
              </button>
              <a
                href={explorerUrl}
                target="_blank"
                rel="noreferrer"
                title="View on Blockchain Explorer"
                className="p-1 hover:text-[#0284C7] text-[#64748B] transition-colors"
              >
                <ExternalLink className="h-3.5 w-3.5" />
              </a>
            </div>
          </div>
        </div>

        <div className="flex items-center space-x-2.5">
          {primaryVasp ? (
            <div className="flex items-center space-x-1.5 px-3 py-1 rounded-full bg-emerald-50 border border-emerald-200 text-emerald-700 text-[11px] font-bold">
              <ShieldCheck className="h-3.5 w-3.5" />
              <span>{primaryVasp.vasp_name} ({primaryVasp.score.toFixed(0)}%)</span>
            </div>
          ) : (
            <div className="flex items-center space-x-1.5 px-3 py-1 rounded-full bg-amber-50 border border-amber-200 text-amber-700 text-[11px] font-bold">
              <AlertTriangle className="h-3.5 w-3.5 text-amber-600" />
              <span>Multi-Hop Unhosted</span>
            </div>
          )}

          <div className="flex items-center space-x-1.5 px-3 py-1 rounded-full bg-[#F8FAFC] border border-[#CBD5E1] text-[11px]">
            <span className="text-[#64748B]">Flight Risk:</span>
            <span className={`font-bold ${flightRiskLabel === 'HIGH' ? 'text-rose-600' : flightRiskLabel === 'MEDIUM' ? 'text-amber-600' : 'text-emerald-600'}`}>
              {flightRiskLabel}
            </span>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5">
        <div className="p-3.5 rounded-xl bg-[#F8FAFC] border border-[#E2E8F0] flex flex-col justify-between shadow-xs">
          <div className="flex items-center justify-between text-[#64748B] text-[10px] uppercase">
            <span>Observed Outflow (INR)</span>
            <IndianRupee className="h-3.5 w-3.5 text-[#0284C7]" />
          </div>
          <div className="mt-2">
            <div className="text-base sm:text-lg font-bold text-[#0F172A]">
              {totalInr > 0 ? formatINR(totalInr) : '₹0.00'}
            </div>
            <span className="text-[10px] text-[#64748B]">
              {totalUsd > 0 ? formatUSD(totalUsd) : '$0.00 USD Eqv'}
            </span>
          </div>
        </div>

        <div className="p-3.5 rounded-xl bg-[#F8FAFC] border border-[#E2E8F0] flex flex-col justify-between shadow-xs">
          <div className="flex items-center justify-between text-[#64748B] text-[10px] uppercase">
            <span>Potential Freeze Value</span>
            <ShieldCheck className="h-3.5 w-3.5 text-emerald-600" />
          </div>
          <div className="mt-2">
            <div className="text-base sm:text-lg font-bold text-emerald-700">
              {totalInr > 0 ? formatINR(totalInr * (taintRatio > 0 ? taintRatio : 1.0)) : '₹0.00'}
            </div>
            <span className="text-[10px] text-[#64748B]">
              {totalInr > 0 ? 'Sec 91 Statutory Seizure Ready' : 'Standby for Capital Transit'}
            </span>
          </div>
        </div>

        <div className="p-3.5 rounded-xl bg-[#F8FAFC] border border-[#E2E8F0] flex flex-col justify-between shadow-xs">
          <div className="flex items-center justify-between text-[#64748B] text-[10px] uppercase">
            <span>FIFO Dirty Taint</span>
            <TrendingUp className="h-3.5 w-3.5 text-rose-600" />
          </div>
          <div className="mt-2">
            <div className={`text-base sm:text-lg font-bold ${taintRatio > 0 ? 'text-rose-600' : 'text-emerald-700'}`}>
              {taintRatio > 0 ? `${(taintRatio * 100).toFixed(1)}% Tainted` : '0.0% Clean'}
            </div>
            <span className="text-[10px] text-[#64748B]">
              {taintRatio > 0 ? 'Proven Stolen Fund Flow' : 'No Taint Exposure'}
            </span>
          </div>
        </div>

        <div className="p-3.5 rounded-xl bg-[#F8FAFC] border border-[#E2E8F0] flex flex-col justify-between shadow-xs">
          <div className="flex items-center justify-between text-[#64748B] text-[10px] uppercase">
            <span>Crawled Topology</span>
            <Network className="h-3.5 w-3.5 text-[#0284C7]" />
          </div>
          <div className="mt-2">
            <div className="text-base sm:text-lg font-bold text-[#0F172A]">
              {(graphData?.stats?.total_nodes ?? 1)} Nodes / {(graphData?.stats?.total_edges ?? 0)} Edges
            </div>
            <span className="text-[10px] text-[#64748B]">
              Max Depth: {(graphData?.stats?.max_hop_reached ?? 0)} Hops
            </span>
          </div>
        </div>
      </div>
    </div>
  );
};
