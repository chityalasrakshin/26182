'use client';

import React, { useState } from 'react';
import {
  Wallet,
  IndianRupee,
  DollarSign,
  TrendingUp,
  ShieldCheck,
  AlertTriangle,
  Copy,
  Check,
  ExternalLink,
  Flame,
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
  const flightRiskLabel = (graphData?.stats?.total_edges ?? 0) === 0 ? 'LOW' : isHighRisk ? 'HIGH' : 'MODERATE';
  const flightRiskColor = flightRiskLabel === 'HIGH' ? 'bg-rose-500/15 border-rose-500/30 text-rose-400' : flightRiskLabel === 'MODERATE' ? 'bg-amber-500/15 border-amber-500/30 text-amber-400' : 'bg-teal-500/15 border-teal-500/30 text-teal-400';

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
      className={'bg-forensic-surface border border-forensic-border rounded shadow-sm p-4 font-mono text-xs transition-colors space-y-3 ' + className}
    >
      <div className='flex flex-wrap items-center justify-between gap-2 border-b border-forensic-border pb-3'>
        <div className='flex items-center space-x-2'>
          <div className='p-1.5 rounded bg-blue-500/10 border border-blue-500/30 text-blue-400'>
            <Wallet className='h-4 w-4' />
          </div>
          <div>
            <div className='flex items-center space-x-2'>
              <span className='text-[10px] uppercase font-bold text-forensic-textDim'>
                Suspect Target Wallet
              </span>
              <span className='px-1.5 py-0.2 rounded text-[9px] font-bold bg-forensic-surfaceRaised border border-forensic-border text-forensic-text'>
                {chainUpper}
              </span>
            </div>
            <div className='flex items-center space-x-1.5 mt-0.5'>
              <span className='text-xs font-bold text-forensic-text break-all'>
                {walletAddress}
              </span>
              <button
                onClick={handleCopy}
                title='Copy Address'
                className='p-1 hover:text-white text-forensic-textDim transition-colors'
              >
                {copied ? <Check className='h-3 w-3 text-emerald-400' /> : <Copy className='h-3 w-3' />}
              </button>
              <a
                href={explorerUrl}
                target='_blank'
                rel='noreferrer'
                title='View on Blockchain Explorer'
                className='p-1 hover:text-white text-forensic-textDim transition-colors'
              >
                <ExternalLink className='h-3 w-3' />
              </a>
            </div>
          </div>
        </div>

        <div className='flex items-center space-x-2'>
          {primaryVasp ? (
            <div className='flex items-center space-x-1.5 px-2.5 py-1 rounded bg-teal-500/15 border border-teal-500/30 text-forensic-teal text-[11px] font-bold'>
              <ShieldCheck className='h-3.5 w-3.5' />
              <span>{primaryVasp.vasp_name} ({primaryVasp.score.toFixed(0)}%)</span>
            </div>
          ) : (
            <div className='flex items-center space-x-1.5 px-2.5 py-1 rounded bg-amber-500/15 border border-amber-500/30 text-amber-400 text-[11px] font-bold'>
              <AlertTriangle className='h-3.5 w-3.5' />
              <span>Multi-Hop Unhosted</span>
            </div>
          )}

          <div className={`flex items-center space-x-1 px-2 py-1 rounded border text-[11px] font-bold ${flightRiskColor}`}>
            <Flame className='h-3.5 w-3.5' />
            <span>Flight Risk: {flightRiskLabel}</span>
          </div>
        </div>
      </div>

      <div className='grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3'>
        <div className='p-3 rounded bg-forensic-bg border border-forensic-border flex flex-col justify-between'>
          <div className='flex items-center justify-between text-forensic-textDim text-[10px] uppercase'>
            <span>Observed Outflow (INR)</span>
            <IndianRupee className='h-3.5 w-3.5 text-amber-400' />
          </div>
          <div className='mt-1.5'>
            <div className='text-base font-bold text-amber-400'>
              {totalInr > 0 ? formatINR(totalInr) : '₹0.00 INR'}
            </div>
            <span className='text-[10px] text-forensic-textDim'>
              {totalUsd > 0 ? formatUSD(totalUsd) : '$0.00 USD'}
            </span>
          </div>
        </div>

        <div className='p-3 rounded bg-forensic-bg border border-forensic-border flex flex-col justify-between'>
          <div className='flex items-center justify-between text-forensic-textDim text-[10px] uppercase'>
            <span>Potential Freeze Value</span>
            <ShieldCheck className='h-3.5 w-3.5 text-emerald-400' />
          </div>
          <div className='mt-1.5'>
            <div className='text-base font-bold text-emerald-400'>
              {totalInr > 0 ? formatINR(totalInr * (taintRatio > 0 ? taintRatio : 1.0)) : '₹0.00 INR'}
            </div>
            <span className='text-[10px] text-forensic-textDim'>
              {totalInr > 0 ? 'Sec 91 Statutory Seizure Ready' : 'Awaiting transfer detection'}
            </span>
          </div>
        </div>

        <div className='p-3 rounded bg-forensic-bg border border-forensic-border flex flex-col justify-between'>
          <div className='flex items-center justify-between text-forensic-textDim text-[10px] uppercase'>
            <span>FIFO Dirty Taint</span>
            <TrendingUp className='h-3.5 w-3.5 text-rose-400' />
          </div>
          <div className='mt-1.5'>
            <div className='text-base font-bold text-rose-400'>
              {taintRatio > 0 ? `${(taintRatio * 100).toFixed(1)}% Tainted` : '0.0% Taint'}
            </div>
            <span className='text-[10px] text-forensic-textDim'>
              {taintRatio > 0 ? 'Proven Stolen Fund Flow' : 'No dirty flow identified'}
            </span>
          </div>
        </div>

        <div className='p-3 rounded bg-forensic-bg border border-forensic-border flex flex-col justify-between'>
          <div className='flex items-center justify-between text-forensic-textDim text-[10px] uppercase'>
            <span>Crawled Topology</span>
            <span className='text-[10px] text-forensic-textDim font-bold'>HOPS</span>
          </div>
          <div className='mt-1.5'>
            <div className='text-base font-bold text-forensic-text'>
              {(graphData?.stats?.total_nodes ?? 0)} Nodes / {(graphData?.stats?.total_edges ?? 0)} Edges
            </div>
            <span className='text-[10px] text-forensic-textDim'>
              Max Depth: {(graphData?.stats?.max_hop_reached ?? 3)} Hops
            </span>
          </div>
        </div>
      </div>
    </div>
  );
};
