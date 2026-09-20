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
} from 'lucide-react';
import { UserAuth } from '../lib/types';

export type ActiveTabType =
  | 'WORKSPACE'
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
  isExpanded?: boolean;
  onToggleExpanded?: () => void;
}

export const Navbar: React.FC<NavbarProps> = ({
  activeTab,
  onSelectTab,
  onOpenCaseIntake,
  currentUser,
  onSwitchRole,
  hasActiveTarget = false,
  recentAnalysesCount = 0,
  isExpanded = false,
  onToggleExpanded,
}) => {
  const [hoveredTab, setHoveredTab] = useState<string | null>(null);

  const navItems = [
    {
      id: 'WORKSPACE' as ActiveTabType,
      label: 'Target Workspace',
      description: 'On-chain multi-hop tracing & VASP attribution',
      icon: LayoutGrid,
      badge: hasActiveTarget ? 'Active' : null,
    },
    {
      id: 'CASES_AUDIT' as ActiveTabType,
      label: 'Cases & Audit Register',
      description: 'FIR case tracking & statutory notice records',
      icon: Briefcase,
      badge: null,
    },
    {
      id: 'RECENT_INVESTIGATIONS' as ActiveTabType,
      label: 'Recent Investigations',
      description: 'Cached analyses & historical wallet traces',
      icon: History,
      badge: recentAnalysesCount > 0 ? `${recentAnalysesCount}` : null,
    },
    {
      id: 'GRAPH_STUDIO' as ActiveTabType,
      label: 'Graph Studio',
      description: 'Interactive Cytoscape network visualization',
      icon: Network,
      badge: hasActiveTarget ? 'Live' : null,
    },
    {
      id: 'FORENSIC_LEDGER' as ActiveTabType,
      label: 'Forensic Location Ledger',
      description: 'Off-chain node locations & cluster logs',
      icon: MapPin,
      badge: null,
    },
    {
      id: 'NCRP_TRIAGE' as ActiveTabType,
      label: 'NCRP Cyber Crime Queue',
      description: 'National portal incident triage & intake',
      icon: ListFilter,
      badge: null,
    },
  ];

  return (
    <aside className={`fixed top-0 left-0 bottom-0 z-50 ${isExpanded ? 'w-[248px]' : 'w-[68px]'} bg-[#161616]/55 backdrop-blur-2xl border-r border-white/[0.08] shadow-[12px_0_40px_rgba(0,0,0,0.22)] flex flex-col justify-between py-4 select-none transition-[width] duration-300 ease-out`}>
      {/* Top: Brand Logo / Mark */}
      <div className={`flex flex-col space-y-5 ${isExpanded ? 'w-full px-3' : 'items-center'}`}>
        <button
          type="button"
          onClick={() => onSelectTab('WORKSPACE')}
          className={`relative group flex items-center ${isExpanded ? 'justify-start gap-3 px-2' : 'justify-center'}`}
          title="Netra Law Enforcement Console"
        >
          <div className="h-11 w-11 shrink-0 rounded-2xl bg-white/[0.04] border border-white/[0.10] group-hover:border-[#E5FF8F] flex items-center justify-center transition-all shadow-[0_0_20px_rgba(0,0,0,0.28)]">
            <Shield className="h-5 w-5 text-[#E5FF8F]" />
          </div>
          {isExpanded && <span className="text-white font-bold tracking-tight">Netra</span>}

          {/* Floating Brand Tooltip */}
          <div className="absolute left-[76px] top-1/2 -translate-y-1/2 hidden group-hover:flex items-center z-50 pointer-events-none">
            <div className="bg-[#1A1A1A] text-[#FFFFFF] text-xs font-mono px-3 py-1.5 rounded-lg border border-[#2A2A2A] shadow-xl whitespace-nowrap">
              <div className="font-sans font-bold text-sm text-[#FFFFFF] flex items-center gap-1.5">
                <span>Netra</span>
                <span className="text-[10px] px-1.5 py-0.2 rounded bg-[#2A2A2A] text-[#E5FF8F] font-mono font-bold">
                  v2.4
                </span>
              </div>
              <div className="text-[10px] text-[#9A9A9A]">Forensic Intelligence Console</div>
            </div>
          </div>
        </button>

        {/* Divider */}
        <div className={`${isExpanded ? 'w-full' : 'w-8'} h-px bg-white/[0.10]`} />

        {/* Center: Nav Icon Stack */}
        <nav className={`flex flex-col space-y-2.5 ${isExpanded ? 'w-full' : 'items-center'}`}>
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = activeTab === item.id;

            return (
              <div
                key={item.id}
                className={`relative ${isExpanded ? 'w-full' : ''}`}
                onMouseEnter={() => setHoveredTab(item.id)}
                onMouseLeave={() => setHoveredTab(null)}
              >
                <button
                  type="button"
                  onClick={() => onSelectTab(item.id)}
                  className={`h-11 rounded-xl flex items-center transition-all ${isExpanded ? 'w-full justify-start gap-3 px-3' : 'w-11 justify-center'} ${
                    isActive
                      ? 'bg-[#E5FF8F] text-[#0A0A0A] font-bold shadow-[0_0_18px_rgba(229,255,143,0.35)]'
                      : 'text-[#9A9A9A] hover:text-[#FFFFFF] hover:bg-[#1A1A1A] hover:border hover:border-[#2A2A2A]'
                  }`}
                  aria-label={item.label}
                >
                  <Icon className="h-5 w-5 stroke-[2.2]" />
                  {isExpanded && <span className="text-xs font-semibold tracking-tight">{item.label}</span>}

                  {item.badge && !isActive && (
                    <span className="absolute top-1 right-1 w-2 h-2 rounded-full bg-[#E5FF8F]"></span>
                  )}
                </button>

                {/* Floating Tooltip right of sidebar */}
                {hoveredTab === item.id && (
                  <div className="absolute left-[58px] top-1/2 -translate-y-1/2 z-50 pointer-events-none pl-3 animate-fade-in">
                    <div className="bg-[#1A1A1A] border border-[#2A2A2A] text-left p-2.5 rounded-xl shadow-2xl min-w-[200px] whitespace-nowrap">
                      <div className="flex items-center justify-between gap-2">
                        <span className="font-sans font-bold text-xs text-[#FFFFFF]">
                          {item.label}
                        </span>
                        {item.badge && (
                          <span className="text-[10px] font-mono px-1.5 py-0.5 rounded font-bold bg-[#E5FF8F] text-[#0A0A0A]">
                            {item.badge}
                          </span>
                        )}
                      </div>
                      <p className="text-[11px] font-sans text-[#9A9A9A] mt-0.5 leading-tight">
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
      <div className={`flex flex-col space-y-3 ${isExpanded ? 'w-full px-3' : 'items-center w-full px-2'}`}>
        {onToggleExpanded && (
          <button
            type="button"
            onClick={onToggleExpanded}
            className={`h-10 rounded-xl bg-white/[0.035] hover:bg-white/[0.08] text-[#9A9A9A] hover:text-[#FFFFFF] border border-white/[0.09] flex items-center transition-all ${isExpanded ? 'w-full justify-between px-3' : 'w-10 justify-center'}`}
            title={isExpanded ? 'Collapse navigation' : 'Expand navigation'}
            aria-label={isExpanded ? 'Collapse navigation' : 'Expand navigation'}
          >
            <span className="text-lg leading-none">{isExpanded ? '‹' : '›'}</span>
            {isExpanded && <span className="text-[11px] font-mono uppercase tracking-wider">Collapse panel</span>}
          </button>
        )}
        {onOpenCaseIntake && (
          <button
            type="button"
            onClick={onOpenCaseIntake}
            className="h-10 w-10 rounded-xl bg-[#1A1A1A] hover:bg-[#2A2A2A] text-[#E5FF8F] border border-[#2A2A2A] hover:border-[#E5FF8F]/50 flex items-center justify-center transition-all group relative"
            title="Create New Investigation Case"
          >
            <Plus className="h-4 w-4 stroke-[2.5]" />
            <div className="absolute left-[58px] top-1/2 -translate-y-1/2 hidden group-hover:flex items-center z-50 pointer-events-none pl-3">
              <div className="bg-[#1A1A1A] border border-[#2A2A2A] text-[#FFFFFF] text-xs font-sans font-bold px-2.5 py-1.5 rounded-lg shadow-xl whitespace-nowrap">
                + New Case Intake
              </div>
            </div>
          </button>
        )}

        {/* Live Engine Pulse */}
        <div
          className="h-7 w-7 rounded-lg bg-[#1A1A1A] border border-[#2A2A2A] flex items-center justify-center cursor-default group relative"
          title="Engine Status: Online (ETH, TRX, BTC, SOL)"
        >
          <span className="relative flex h-2 w-2">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[#7CFF6B] opacity-75"></span>
            <span className="relative inline-flex rounded-full h-2 w-2 bg-[#7CFF6B]"></span>
          </span>
          <div className="absolute left-[58px] top-1/2 -translate-y-1/2 hidden group-hover:flex items-center z-50 pointer-events-none pl-3">
            <div className="bg-[#1A1A1A] border border-[#2A2A2A] text-[#7CFF6B] text-[11px] font-mono font-bold px-2.5 py-1 rounded-lg shadow-xl whitespace-nowrap">
              ● Live Multi-Chain Kernel
            </div>
          </div>
        </div>
      </div>
    </aside>
  );
};
