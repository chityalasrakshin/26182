'use client';

import React, { useState } from 'react';
import {
  Shield,
  LayoutGrid,
  Briefcase,
  History,
  Network,
  MapPin,
  ListFilter,
  Plus,
  Lock,
  Unlock,
  Activity,
} from 'lucide-react';
import { UserAuth } from '../lib/types';

export type ActiveTabType =
  | 'WORKSPACE'
  | 'COMPLIANCE'
  | 'CASES_AUDIT'
  | 'RECENT_INVESTIGATIONS'
  | 'GRAPH_STUDIO'
  | 'FORENSIC_LEDGER'
  | 'NCRP_TRIAGE';

interface NavbarProps {
  activeTab: ActiveTabType;
  onSelectTab: (tab: ActiveTabType) => void;
  onOpenCaseIntake?: () => void;
  currentUser?: UserAuth | null;
  onSwitchRole?: (role: 'supervisor' | 'investigator') => void;
  hasActiveTarget?: boolean;
  recentAnalysesCount?: number;
}

export const Navbar: React.FC<NavbarProps> = ({
  activeTab,
  onSelectTab,
  onOpenCaseIntake,
  currentUser,
  onSwitchRole,
  hasActiveTarget = false,
  recentAnalysesCount = 0,
}) => {
  const [hoveredTab, setHoveredTab] = useState<string | null>(null);

  const navItems = [
    {
      id: 'WORKSPACE' as ActiveTabType,
      label: 'Investigate',
      description: 'Graph canvas and target inspection panel',
      icon: LayoutGrid,
      badge: null,
    },
    {
      id: 'COMPLIANCE' as ActiveTabType,
      label: 'Compliance',
      description: 'Transaction and entity risk screening',
      icon: Activity,
      badge: null,
    },
    {
      id: 'CASES_AUDIT' as ActiveTabType,
      label: 'Cases',
      description: 'Case records and statutory notices',
      icon: Briefcase,
      badge: null,
    },
    {
      id: 'RECENT_INVESTIGATIONS' as ActiveTabType,
      label: 'Recent Cases',
      description: 'Historical investigations and cached analyses',
      icon: History,
      badge: null,
    },
    {
      id: 'GRAPH_STUDIO' as ActiveTabType,
      label: 'Graph Studio',
      description: 'Interactive network visualizer',
      icon: Network,
      badge: null,
    },
    {
      id: 'FORENSIC_LEDGER' as ActiveTabType,
      label: 'Forensic Ledger',
      description: 'Off-chain locations and cluster data',
      icon: MapPin,
      badge: null,
    },
    {
      id: 'NCRP_TRIAGE' as ActiveTabType,
      label: 'NCRP Triage',
      description: 'Cyber crime incident intake and review',
      icon: ListFilter,
      badge: null,
    },
  ];

  return (
    <aside className="fixed top-0 left-0 bottom-0 w-[68px] z-50 bg-white border-r border-[#E2E8F0] flex flex-col justify-between items-center py-4 select-none shadow-sm">
      {/* Top: Brand Logo / Mark */}
      <div className="flex flex-col items-center space-y-5">
        <button
          type="button"
          onClick={() => onSelectTab('WORKSPACE')}
          className="relative group flex items-center justify-center"
          title="CryptoTrace Forensic Intelligence Console"
        >
          <div className="h-11 w-11 rounded-2xl bg-sky-50 border border-sky-200 group-hover:border-[#0284C7] flex items-center justify-center transition-all shadow-sm">
            <Shield className="h-5 w-5 text-[#0284C7]" />
          </div>

          {/* Floating Brand Tooltip */}
          <div className="absolute left-[76px] top-1/2 -translate-y-1/2 hidden group-hover:flex items-center z-50 pointer-events-none">
            <div className="bg-[#0F172A] text-[#FFFFFF] text-xs font-mono px-3 py-1.5 rounded-lg border border-slate-800 shadow-xl whitespace-nowrap">
              <div className="font-sans font-bold text-sm text-[#FFFFFF] flex items-center gap-1.5">
                <span>CryptoTrace</span>
                <span className="text-[10px] px-1.5 py-0.2 rounded bg-sky-900 text-[#38BDF8] font-mono font-bold">
                  v2.4
                </span>
              </div>
              <div className="text-[10px] text-slate-400">Forensic Intelligence Console</div>
            </div>
          </div>
        </button>

        {/* Divider */}
        <div className="w-8 h-[1px] bg-[#E2E8F0]" />

        {/* Center: Nav Icon Stack */}
        <nav className="flex flex-col items-center space-y-2.5">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = activeTab === item.id;

            return (
              <div
                key={item.id}
                className="relative"
                onMouseEnter={() => setHoveredTab(item.id)}
                onMouseLeave={() => setHoveredTab(null)}
              >
                <button
                  type="button"
                  onClick={() => onSelectTab(item.id)}
                  className={`h-11 w-11 rounded-xl flex items-center justify-center transition-all ${
                    isActive
                      ? 'bg-[#0284C7] text-white font-bold shadow-[0_2px_10px_rgba(2,132,199,0.35)]'
                      : 'text-[#64748B] hover:text-[#0F172A] hover:bg-[#F1F5F9]'
                  }`}
                  aria-label={item.label}
                >
                  <Icon className="h-5 w-5 stroke-[2.2]" />

                  {item.badge && !isActive && (
                    <span className="absolute top-1 right-1 w-2 h-2 rounded-full bg-[#0284C7]"></span>
                  )}
                </button>

                {/* Floating Tooltip right of sidebar */}
                {hoveredTab === item.id && (
                  <div className="absolute left-[58px] top-1/2 -translate-y-1/2 z-50 pointer-events-none pl-3 animate-fade-in">
                    <div className="bg-[#0F172A] border border-slate-800 text-left p-2.5 rounded-xl shadow-2xl min-w-[200px] whitespace-nowrap">
                      <div className="flex items-center justify-between gap-2">
                        <span className="font-sans font-bold text-xs text-[#FFFFFF]">
                          {item.label}
                        </span>
                        {item.badge && (
                          <span className="text-[10px] font-mono px-1.5 py-0.5 rounded font-bold bg-[#0284C7] text-white">
                            {item.badge}
                          </span>
                        )}
                      </div>
                      <p className="text-[11px] font-sans text-slate-400 mt-0.5 leading-tight">
                        {item.description}
                      </p>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </nav>
      </div>

      {/* Bottom Pinned Controls */}
      <div className="flex flex-col items-center space-y-3 w-full px-2">
        {onOpenCaseIntake && (
          <button
            type="button"
            onClick={onOpenCaseIntake}
            className="h-10 w-10 rounded-xl bg-[#F8FAFC] hover:bg-sky-50 text-[#0284C7] border border-[#CBD5E1] hover:border-[#0284C7] flex items-center justify-center transition-all group relative shadow-sm"
            title="Create New Investigation Case"
          >
            <Plus className="h-4 w-4 stroke-[2.5]" />
            <div className="absolute left-[58px] top-1/2 -translate-y-1/2 hidden group-hover:flex items-center z-50 pointer-events-none pl-3">
              <div className="bg-[#0F172A] border border-slate-800 text-[#FFFFFF] text-xs font-sans font-bold px-2.5 py-1.5 rounded-lg shadow-xl whitespace-nowrap">
                + New Case Intake
              </div>
            </div>
          </button>
        )}

        {/* System Status */}
        <div
          className="h-7 w-7 rounded-lg bg-[#F8FAFC] border border-[#E2E8F0] flex items-center justify-center cursor-default group relative shadow-xs"
          title="System Online (ETH, TRX, BTC, SOL)"
        >
          <span className="h-2 w-2 rounded-full bg-[#10B981]"></span>
          <div className="absolute left-[58px] top-1/2 -translate-y-1/2 hidden group-hover:flex items-center z-50 pointer-events-none pl-3">
            <div className="bg-[#0F172A] border border-slate-800 text-[#10B981] text-[11px] font-mono font-bold px-2.5 py-1 rounded-lg shadow-xl whitespace-nowrap">
              System Online
            </div>
          </div>
        </div>
      </div>
    </aside>
  );
};
