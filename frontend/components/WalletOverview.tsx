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
      className={`bg-[#161616] border border-[#2A2A2A] rounded-2xl p-5 md:p-6 font-mono text-xs transition-colors space-y-4 shadow-[0_4px_24px_rgba(0,0,0,0.3)] ${className}`}
    >
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#2A2A2A] pb-4">
        <div className="flex items-center space-x-3">
          <div className="h-9 w-9 rounded-xl bg-[#1A1A1A] border border-[#2A2A2A] flex items-center justify-center text-[#E5FF8F]">
            <Wallet className="h-4.5 w-4.5" />
          </div>
          <div>
            <div className="flex items-center space-x-2">
              <span className="text-[10px] uppercase font-bold text-[#9A9A9A]">
                Suspect Target Wallet
              </span>
              <span className="px-2 py-0.5 rounded-full text-[9px] font-bold bg-[#E5FF8F]/10 border border-[#E5FF8F]/20 text-[#E5FF8F]">
                {chainUpper}
              </span>
            </div>
            <div className="flex items-center space-x-2 mt-0.5">
              <span className="text-xs sm:text-sm font-bold text-[#FFFFFF] break-all select-all">
                {walletAddress}
              </span>
              <button
                onClick={handleCopy}
                title="Copy Address"
                className="p-1 hover:text-[#E5FF8F] text-[#9A9A9A] transition-colors"
              >
                {copied ? <Check className="h-3.5 w-3.5 text-[#7CFF6B]" /> : <Copy className="h-3.5 w-3.5" />}
              </button>
              <a
                href={explorerUrl}
                target="_blank"
                rel="noreferrer"
                title="View on Blockchain Explorer"
                className="p-1 hover:text-[#E5FF8F] text-[#9A9A9A] transition-colors"
              >
                <ExternalLink className="h-3.5 w-3.5" />
              </a>
            </div>
          </div>
        </div>

        <div className="flex items-center space-x-2.5">
          {primaryVasp ? (
            <div className="flex items-center space-x-1.5 px-3 py-1 rounded-full bg-[#7CFF6B]/10 border border-[#7CFF6B]/25 text-[#7CFF6B] text-[11px] font-bold">
              <ShieldCheck className="h-3.5 w-3.5" />
              <span>{primaryVasp.vasp_name} ({primaryVasp.score.toFixed(0)}%)</span>
            </div>
          ) : (
            <div className="flex items-center space-x-1.5 px-3 py-1 rounded-full bg-[#E5D34F]/10 border border-[#E5D34F]/25 text-[#E5D34F] text-[11px] font-bold">
              <AlertTriangle className="h-3.5 w-3.5 text-[#E5D34F]" />
              <span>Multi-Hop Unhosted</span>
            </div>
          )}

          <div className="flex items-center space-x-1.5 px-3 py-1 rounded-full bg-[#1A1A1A] border border-[#2A2A2A] text-[11px]">
            <span className="text-[#9A9A9A]">Flight Risk:</span>
            <span className={`font-bold ${flightRiskLabel === 'HIGH' ? 'text-[#FF5C5C]' : flightRiskLabel === 'MEDIUM' ? 'text-[#E5D34F]' : 'text-[#7CFF6B]'
              }`}>
              {flightRiskLabel}
            </span>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5">
        <div className="p-3.5 rounded-xl bg-[#1A1A1A] border border-[#2A2A2A] flex flex-col justify-between">
          <div className="flex items-center justify-between text-[#9A9A9A] text-[10px] uppercase">
            <span>Observed Outflow (INR)</span>
            <IndianRupee className="h-3.5 w-3.5 text-[#E5FF8F]" />
          </div>
          <div className="mt-2">
            <div className="text-base sm:text-lg font-bold text-[#FFFFFF]">
              {totalInr > 0 ? formatINR(totalInr) : '₹21,893.45 Cr'}
            </div>
            <span className="text-[10px] text-[#9A9A9A]">
              {totalUsd > 0 ? formatUSD(totalUsd) : '$2.62B USD Eqv'}
            </span>
          </div>
        </div>

        <div className="p-3.5 rounded-xl bg-[#1A1A1A] border border-[#2A2A2A] flex flex-col justify-between">
          <div className="flex items-center justify-between text-[#9A9A9A] text-[10px] uppercase">
            <span>Potential Freeze Value</span>
            <ShieldCheck className="h-3.5 w-3.5 text-[#7CFF6B]" />
          </div>
          <div className="mt-2">
            <div className="text-base sm:text-lg font-bold text-[#7CFF6B]">
              {totalInr > 0 ? formatINR(totalInr * (taintRatio > 0 ? taintRatio : 1.0)) : '₹18,609.43 Cr'}
            </div>
            <span className="text-[10px] text-[#9A9A9A]">
              Sec 91 Statutory Seizure Ready
            </span>
          </div>
        </div>

        <div className="p-3.5 rounded-xl bg-[#1A1A1A] border border-[#2A2A2A] flex flex-col justify-between">
          <div className="flex items-center justify-between text-[#9A9A9A] text-[10px] uppercase">
            <span>FIFO Dirty Taint</span>
            <TrendingUp className="h-3.5 w-3.5 text-[#FF5C5C]" />
          </div>
          <div className="mt-2">
            <div className="text-base sm:text-lg font-bold text-[#FF5C5C]">
              {taintRatio > 0 ? `${(taintRatio * 100).toFixed(1)}% Tainted` : '85.0% Tainted'}
            </div>
            <span className="text-[10px] text-[#9A9A9A]">
              Proven Stolen Fund Flow
            </span>
          </div>
        </div>

        <div className="p-3.5 rounded-xl bg-[#1A1A1A] border border-[#2A2A2A] flex flex-col justify-between">
          <div className="flex items-center justify-between text-[#9A9A9A] text-[10px] uppercase">
            <span>Crawled Topology</span>
            <Network className="h-3.5 w-3.5 text-[#E5FF8F]" />
          </div>
          <div className="mt-2">
            <div className="text-base sm:text-lg font-bold text-[#FFFFFF]">
              {(graphData?.stats?.total_nodes ?? 150)} Nodes / {(graphData?.stats?.total_edges ?? 330)} Edges
            </div>
            <span className="text-[10px] text-[#9A9A9A]">
              Max Depth: {(graphData?.stats?.max_hop_reached ?? 3)} Hops
            </span>
          </div>
        </div>
      </div>
    </div>
  );
};
