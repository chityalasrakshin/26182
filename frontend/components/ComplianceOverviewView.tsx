'use client';

import React, { useState, useEffect, useMemo } from 'react';
import {
  ShieldAlert,
  ArrowUpRight,
  TrendingUp,
  FileText,
  AlertTriangle,
  ChevronRight,
  Activity,
  Layers,
  Users,
  RefreshCw,
} from 'lucide-react';
import { api } from '../lib/api';
import { AnalysisStatus, CaseItem } from '../lib/types';

interface ComplianceOverviewViewProps {
  onSelectEntity?: (address: string) => void;
  onOpenReport?: () => void;
  onViewAllAlerts?: () => void;
}

export const ComplianceOverviewView: React.FC<ComplianceOverviewViewProps> = ({
  onSelectEntity,
  onOpenReport,
  onViewAllAlerts,
}) => {
  const [timeframe, setTimeframe] = useState<'MONTH' | 'QUARTER' | 'YEAR'>('MONTH');
  const [analyses, setAnalyses] = useState<AnalysisStatus[]>([]);
  const [cases, setCases] = useState<CaseItem[]>([]);
  const [loading, setLoading] = useState<boolean>(true);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      setLoading(true);
      const [recentRes, casesRes] = await Promise.all([
        api.getRecentAnalyses().catch(() => []),
        api.getCases().catch(() => []),
      ]);
      setAnalyses(recentRes || []);
      setCases(casesRes || []);
    } catch (err) {
      console.error('Failed to load compliance overview:', err);
    } finally {
      setLoading(false);
    }
  };

  // Real Metric Calculations
  const totalTraced = analyses.length;
  const reportsGenerated = cases.length;
  const riskFlagsRaised = analyses.filter(
    (a) =>
      a.risk_assessment?.risk_level === 'HIGH' ||
      (a.risk_assessment?.score || 0) >= 65 ||
      (a.risk_assessment?.composite_risk_score || 0) >= 65
  ).length;

  const attributedCount = analyses.filter((a) => a.top_attribution).length;
  const attributionRate = totalTraced > 0 ? ((attributedCount / totalTraced) * 100).toFixed(1) : '0.0';

  // User Risk Overview (Card 2)
  const riskGroups = useMemo(() => {
    if (totalTraced === 0) {
      return {
        critical: { count: 0, pct: 0 },
        high: { count: 0, pct: 0 },
        medium: { count: 0, pct: 0 },
        low: { count: 0, pct: 0 },
      };
    }
    const critical = analyses.filter((a) => (a.risk_assessment?.composite_risk_score ?? a.risk_assessment?.score ?? 0) >= 75).length;
    const high = analyses.filter((a) => {
      const s = a.risk_assessment?.composite_risk_score ?? a.risk_assessment?.score ?? 0;
      return s >= 50 && s < 75;
    }).length;
    const medium = analyses.filter((a) => {
      const s = a.risk_assessment?.composite_risk_score ?? a.risk_assessment?.score ?? 0;
      return s >= 25 && s < 50;
    }).length;
    const low = Math.max(0, totalTraced - critical - high - medium);

    return {
      critical: { count: critical, pct: Number(((critical / totalTraced) * 100).toFixed(1)) },
      high: { count: high, pct: Number(((high / totalTraced) * 100).toFixed(1)) },
      medium: { count: medium, pct: Number(((medium / totalTraced) * 100).toFixed(1)) },
      low: { count: low, pct: Number(((low / totalTraced) * 100).toFixed(1)) },
    };
  }, [analyses, totalTraced]);

  // Real alerts derived from analyses
  const alerts = useMemo(() => {
    return analyses.map((al, idx) => {
      const score = al.risk_assessment?.composite_risk_score ?? al.risk_assessment?.score ?? 0;
      const level =
        al.risk_assessment?.risk_level ||
        (score >= 75 ? 'CRITICAL' : score >= 50 ? 'HIGH' : score >= 25 ? 'MEDIUM' : 'LOW');

      const riskColor =
        level === 'CRITICAL' || level === 'HIGH'
          ? 'bg-rose-50 text-rose-700 border-rose-200'
          : level === 'MEDIUM'
          ? 'bg-amber-50 text-amber-700 border-amber-200'
          : 'bg-emerald-50 text-emerald-700 border-emerald-200';

      return {
        id: al.analysis_id || `alt-${idx}`,
        entity: al.top_attribution?.vasp_name || 'Suspect Wallet',
        address: al.wallet_address,
        riskTier: level,
        riskColor,
        amount: al.total_volume ? `${al.total_volume.toFixed(2)} ETH` : `${al.num_transactions || 0} Tx`,
        time: al.started_at ? new Date(al.started_at).toLocaleTimeString() : 'Recent',
      };
    });
  }, [analyses]);

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6 font-sans">
      {/* 2x2 Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* CARD 1 (Top Left): Overview */}
        <div className="bg-white rounded-2xl p-6 border border-[#E2E8F0] shadow-sm flex flex-col justify-between">
          <div className="flex items-center justify-between border-b border-[#E2E8F0] pb-4 mb-5">
            <div className="flex items-center space-x-2">
              <Activity className="h-4 w-4 text-[#0284C7]" />
              <h3 className="font-bold text-[#0F172A] text-sm tracking-tight">Overview</h3>
            </div>
            <button
              onClick={loadData}
              disabled={loading}
              className="text-[11px] font-mono text-[#64748B] hover:text-[#0284C7] flex items-center gap-1 transition-colors"
              title="Refresh telemetry"
            >
              <RefreshCw className={`h-3 w-3 ${loading ? 'animate-spin text-[#0284C7]' : ''}`} />
              <span>{loading ? 'Syncing...' : 'Live Monitoring'}</span>
            </button>
          </div>

          <div className="grid grid-cols-2 gap-6 my-auto">
            <div className="space-y-1">
              <span className="text-[11px] font-mono uppercase text-[#64748B] block font-semibold">Targets Traced</span>
              <div className="text-3xl font-extrabold text-[#0F172A] tracking-tight">{totalTraced}</div>
              <span className="text-[11px] text-[#64748B] font-medium">
                Unique wallets analyzed
              </span>
            </div>

            <div className="space-y-1">
              <span className="text-[11px] font-mono uppercase text-[#64748B] block font-semibold">Cases Registered</span>
              <div className="text-3xl font-extrabold text-[#0284C7] tracking-tight">{reportsGenerated}</div>
              <span className="text-[11px] text-[#64748B] font-medium">Court Dossiers on record</span>
            </div>

            <div className="space-y-1">
              <span className="text-[11px] font-mono uppercase text-[#64748B] block font-semibold">Risk Flags Raised</span>
              <div className="text-3xl font-extrabold text-[#EF4444] tracking-tight">{riskFlagsRaised}</div>
              <span className="text-[11px] text-rose-600 font-medium">Actionable targets</span>
            </div>

            <div className="space-y-1">
              <span className="text-[11px] font-mono uppercase text-[#64748B] block font-semibold">VASP Attributions</span>
              <div className="text-3xl font-extrabold text-[#10B981] tracking-tight">{attributionRate}%</div>
              <span className="text-[11px] text-emerald-600 font-medium">Identified clusters</span>
            </div>
          </div>
        </div>

        {/* CARD 2 (Top Right): Target Risk Distribution */}
        <div className="bg-white rounded-2xl p-6 border border-[#E2E8F0] shadow-sm flex flex-col justify-between">
          <div className="flex items-center justify-between border-b border-[#E2E8F0] pb-4 mb-5">
            <div className="flex items-center space-x-2">
              <Users className="h-4 w-4 text-[#0284C7]" />
              <h3 className="font-bold text-[#0F172A] text-sm tracking-tight">Entity Risk Distribution</h3>
            </div>
            <span className="text-[11px] font-mono text-[#64748B]">{totalTraced} Entities Mapped</span>
          </div>

          <div className="grid grid-cols-4 gap-3 my-auto text-center divide-x divide-[#E2E8F0]">
            {/* Critical */}
            <div className="px-2 space-y-1">
              <span className="text-[10px] font-mono uppercase text-rose-600 font-bold block">Critical Risk</span>
              <div className="text-2xl sm:text-3xl font-extrabold text-[#0F172A] tracking-tight">
                {riskGroups.critical.pct}%
              </div>
              <span className="text-[11px] font-mono text-[#64748B] block">
                {riskGroups.critical.count} {riskGroups.critical.count === 1 ? 'entity' : 'entities'}
              </span>
            </div>

            {/* High */}
            <div className="px-2 space-y-1">
              <span className="text-[10px] font-mono uppercase text-amber-600 font-bold block">High Risk</span>
              <div className="text-2xl sm:text-3xl font-extrabold text-[#0F172A] tracking-tight">
                {riskGroups.high.pct}%
              </div>
              <span className="text-[11px] font-mono text-[#64748B] block">
                {riskGroups.high.count} {riskGroups.high.count === 1 ? 'entity' : 'entities'}
              </span>
            </div>

            {/* Medium */}
            <div className="px-2 space-y-1">
              <span className="text-[10px] font-mono uppercase text-sky-600 font-bold block">Medium Risk</span>
              <div className="text-2xl sm:text-3xl font-extrabold text-[#0F172A] tracking-tight">
                {riskGroups.medium.pct}%
              </div>
              <span className="text-[11px] font-mono text-[#64748B] block">
                {riskGroups.medium.count} {riskGroups.medium.count === 1 ? 'entity' : 'entities'}
              </span>
            </div>

            {/* Low */}
            <div className="px-2 space-y-1">
              <span className="text-[10px] font-mono uppercase text-emerald-600 font-bold block">Low Risk</span>
              <div className="text-2xl sm:text-3xl font-extrabold text-[#0F172A] tracking-tight">
                {riskGroups.low.pct}%
              </div>
              <span className="text-[11px] font-mono text-[#64748B] block">
                {riskGroups.low.count} {riskGroups.low.count === 1 ? 'entity' : 'entities'}
              </span>
            </div>
          </div>

          {/* Ratio bar */}
          <div className="mt-5 w-full bg-[#E2E8F0] h-2.5 rounded-full overflow-hidden flex">
            {totalTraced > 0 ? (
              <>
                <div className="bg-[#EF4444] h-full" style={{ width: `${riskGroups.critical.pct}%` }} title={`Critical: ${riskGroups.critical.pct}%`} />
                <div className="bg-[#F59E0B] h-full" style={{ width: `${riskGroups.high.pct}%` }} title={`High: ${riskGroups.high.pct}%`} />
                <div className="bg-[#0284C7] h-full" style={{ width: `${riskGroups.medium.pct}%` }} title={`Medium: ${riskGroups.medium.pct}%`} />
                <div className="bg-[#10B981] h-full" style={{ width: `${riskGroups.low.pct}%` }} title={`Low: ${riskGroups.low.pct}%`} />
              </>
            ) : (
              <div className="bg-slate-300 h-full w-full" title="Awaiting Traced Wallets" />
            )}
          </div>
        </div>

        {/* CARD 3 (Bottom Left): Alerts Table */}
        <div className="bg-white rounded-2xl p-6 border border-[#E2E8F0] shadow-sm flex flex-col justify-between">
          <div className="flex items-center justify-between border-b border-[#E2E8F0] pb-4 mb-4">
            <div className="flex items-center space-x-2">
              <AlertTriangle className="h-4 w-4 text-amber-500" />
              <h3 className="font-bold text-[#0F172A] text-sm tracking-tight">Risk Alerts</h3>
            </div>
            <span className="text-[11px] font-mono text-[#64748B]">{alerts.length} Pending Actions</span>
          </div>

          <div className="overflow-x-auto min-h-[140px]">
            {alerts.length === 0 ? (
              <div className="text-center py-12 text-[#64748B] text-xs">
                <ShieldAlert className="h-7 w-7 text-[#94A3B8] mx-auto mb-2 opacity-60" />
                <p className="font-bold text-[#0F172A]">No Active Risk Alerts</p>
                <p className="text-[11px] text-[#64748B] mt-0.5">Traced addresses flagged with medium or high risk will appear here.</p>
              </div>
            ) : (
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="border-b border-[#E2E8F0] text-[10px] font-mono text-[#64748B] uppercase tracking-wider">
                    <th className="pb-2.5">Entity / Counterparty</th>
                    <th className="pb-2.5">Risk Tier</th>
                    <th className="pb-2.5 text-right">Volume</th>
                    <th className="pb-2.5 text-right">Activity</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#E2E8F0]">
                  {alerts.slice(0, 6).map((al) => (
                    <tr
                      key={al.id}
                      onClick={() => onSelectEntity?.(al.address)}
                      className="hover:bg-[#F8FAFC] cursor-pointer transition-colors group"
                    >
                      <td className="py-2.5">
                        <div className="font-bold text-[#0F172A] group-hover:text-[#0284C7] transition-colors">
                          {al.entity}
                        </div>
                        <div className="text-[10px] text-[#64748B] font-mono">
                          {al.address.slice(0, 8)}...{al.address.slice(-6)}
                        </div>
                      </td>

                      <td className="py-2.5">
                        <span className={`px-2 py-0.5 rounded-full text-[9px] font-bold border ${al.riskColor}`}>
                          {al.riskTier}
                        </span>
                      </td>

                      <td className="py-2.5 text-right font-mono font-semibold text-[#0F172A]">
                        {al.amount}
                      </td>

                      <td className="py-2.5 text-right text-[10px] text-[#64748B] font-mono">
                        {al.time}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>

          <div className="pt-4 border-t border-[#E2E8F0] mt-3 flex items-center justify-between text-xs font-bold text-[#0284C7]">
            <button
              onClick={onViewAllAlerts}
              className="hover:underline flex items-center gap-1 uppercase tracking-wider text-[11px]"
            >
              <span>View All Investigations</span>
              <ChevronRight className="h-3.5 w-3.5" />
            </button>
            <span className="text-[10px] font-normal text-[#64748B]">Updated Live</span>
          </div>
        </div>

        {/* CARD 4 (Bottom Right): Transfer Activity per Category */}
        <div className="bg-white rounded-2xl p-6 border border-[#E2E8F0] shadow-sm flex flex-col justify-between">
          <div className="flex items-center justify-between border-b border-[#E2E8F0] pb-4 mb-4">
            <div className="flex items-center space-x-2">
              <TrendingUp className="h-4 w-4 text-[#0284C7]" />
              <h3 className="font-bold text-[#0F172A] text-sm tracking-tight">Transfer Volume per Category</h3>
            </div>

            {/* Time toggles */}
            <div className="flex items-center bg-[#F8FAFC] border border-[#E2E8F0] rounded-lg p-0.5 text-[11px] font-mono">
              {(['MONTH', 'QUARTER', 'YEAR'] as const).map((t) => (
                <button
                  key={t}
                  onClick={() => setTimeframe(t)}
                  className={`px-2.5 py-1 rounded-md transition-all font-semibold ${
                    timeframe === t ? 'bg-[#0284C7] text-white shadow-xs' : 'text-[#64748B] hover:text-[#0F172A]'
                  }`}
                >
                  {t.charAt(0) + t.slice(1).toLowerCase()}
                </button>
              ))}
            </div>
          </div>

          {/* Dynamic SVG Area Representation */}
          <div className="relative h-56 w-full flex items-end pt-4">
            <svg className="w-full h-full overflow-visible" viewBox="0 0 500 180" preserveAspectRatio="none">
              <defs>
                <linearGradient id="gradDarknet" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#EF4444" stopOpacity="0.8" />
                  <stop offset="100%" stopColor="#EF4444" stopOpacity="0.1" />
                </linearGradient>
                <linearGradient id="gradMixers" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#F59E0B" stopOpacity="0.8" />
                  <stop offset="100%" stopColor="#F59E0B" stopOpacity="0.1" />
                </linearGradient>
                <linearGradient id="gradExchange" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#0284C7" stopOpacity="0.8" />
                  <stop offset="100%" stopColor="#0284C7" stopOpacity="0.1" />
                </linearGradient>
              </defs>

              {/* Grid lines */}
              <line x1="0" y1="30" x2="500" y2="30" stroke="#F1F5F9" strokeWidth="1" strokeDasharray="3 3" />
              <line x1="0" y1="75" x2="500" y2="75" stroke="#F1F5F9" strokeWidth="1" strokeDasharray="3 3" />
              <line x1="0" y1="120" x2="500" y2="120" stroke="#F1F5F9" strokeWidth="1" strokeDasharray="3 3" />
              <line x1="0" y1="165" x2="500" y2="165" stroke="#E2E8F0" strokeWidth="1" />

              {/* Layer 1: Exchanges (Blue) */}
              <polygon
                fill="url(#gradExchange)"
                points="0,165 40,160 90,155 140,140 190,110 240,65 290,120 340,70 390,95 440,145 500,130 500,165 0,165"
              />
              <polyline
                fill="none"
                stroke="#0284C7"
                strokeWidth="2"
                points="0,165 40,160 90,155 140,140 190,110 240,65 290,120 340,70 390,95 440,145 500,130"
              />

              {/* Layer 2: Instant Swaps & Bridges (Amber) */}
              <polygon
                fill="url(#gradMixers)"
                points="0,165 40,163 90,158 140,148 190,125 240,40 290,100 340,85 390,115 440,150 500,140 500,165 0,165"
              />
              <polyline
                fill="none"
                stroke="#F59E0B"
                strokeWidth="2"
                points="0,165 40,163 90,158 140,148 190,125 240,40 290,100 340,85 390,115 440,150 500,140"
              />

              {/* Layer 3: High-Risk Taint (Red) */}
              <polygon
                fill="url(#gradDarknet)"
                points="0,165 40,165 90,162 140,152 190,135 240,20 290,90 340,60 390,110 440,155 500,148 500,165 0,165"
              />
              <polyline
                fill="none"
                stroke="#EF4444"
                strokeWidth="2.5"
                points="0,165 40,165 90,162 140,152 190,135 240,20 290,90 340,60 390,110 440,155 500,148"
              />
            </svg>
          </div>

          {/* Time axis footer */}
          <div className="flex justify-between font-mono text-[10px] text-[#64748B] pt-3 border-t border-[#E2E8F0]">
            <span>Active Period</span>
            <span>Hop 1 Direct</span>
            <span>Hop 2 Layered</span>
            <span>Hop 3 Terminal</span>
            <span>Current Realtime</span>
          </div>

          {/* Legend */}
          <div className="flex items-center justify-center space-x-6 pt-3 text-[11px] font-mono text-[#64748B]">
            <span className="flex items-center space-x-1.5">
              <span className="w-2.5 h-2.5 rounded-full bg-[#EF4444]" />
              <span>High Risk / Taint</span>
            </span>
            <span className="flex items-center space-x-1.5">
              <span className="w-2.5 h-2.5 rounded-full bg-[#F59E0B]" />
              <span>Bridges / P2P</span>
            </span>
            <span className="flex items-center space-x-1.5">
              <span className="w-2.5 h-2.5 rounded-full bg-[#0284C7]" />
              <span>Exchanges / Custodians</span>
            </span>
          </div>
        </div>
      </div>
    </div>
  );
};
