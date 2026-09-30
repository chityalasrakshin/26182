'use client';

import React, { useState, useEffect } from 'react';
import { Shield, Bell, Calendar, UserCheck, ChevronLeft, ChevronRight, Activity, Terminal } from 'lucide-react';
import { UserAuth } from '../lib/types';
import { ActiveTabType } from './Navbar';

interface TopBarProps {
  activeTab: ActiveTabType;
  currentUser?: UserAuth | null;
  onSwitchRole?: (role: 'supervisor' | 'investigator') => void;
  onOpenCaseIntake?: () => void;
}

export const TopBar: React.FC<TopBarProps> = ({
  activeTab,
  currentUser,
  onSwitchRole,
  onOpenCaseIntake,
}) => {
  const [currentDateStr, setCurrentDateStr] = useState<string>('');

  useEffect(() => {
    const d = new Date();
    const formatted = d.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
    setCurrentDateStr(`Today, ${formatted}`);
  }, []);

  const getTabTitle = (tab: ActiveTabType) => {
    switch (tab) {
      case 'WORKSPACE':
        return 'Target Case Workspace';
      case 'CASES_AUDIT':
        return 'Cases & Statutory Register';
      case 'RECENT_INVESTIGATIONS':
        return 'Recent Investigations & Cache';
      case 'GRAPH_STUDIO':
        return 'Full-Screen Graph Studio';
      case 'FORENSIC_LEDGER':
        return 'Forensic Geolocation Ledger';
      case 'NCRP_TRIAGE':
        return 'NCRP Cyber Crime Incident Queue';
      default:
        return 'Operations Dashboard';
    }
  };

  return (
    <header className="h-16 border-b border-[#2A2A2A] bg-[#0A0A0A]/95 backdrop-blur-md flex items-center justify-between px-6 sticky top-0 z-40 text-xs font-mono select-none">
      {/* Left: Section Breadcrumb */}
      <div className="flex items-center space-x-3">
        <span className="text-[#9A9A9A] uppercase tracking-wider text-[11px] font-semibold">
          SETU CONSOLE
        </span>
        <span className="text-[#2A2A2A]">/</span>
        <h2 className="text-[#FFFFFF] font-sans font-bold text-sm tracking-tight">
          {getTabTitle(activeTab)}
        </h2>
      </div>

      {/* Center: Date Navigator & Live Engine Indicator */}
      <div className="hidden md:flex items-center space-x-4">
        <div className="flex items-center space-x-2 px-3 py-1.5 rounded-full bg-[#161616] border border-[#2A2A2A] text-[11px] text-[#9A9A9A]">
          <span className="relative flex h-2 w-2">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[#7CFF6B] opacity-75"></span>
            <span className="relative inline-flex rounded-full h-2 w-2 bg-[#7CFF6B]"></span>
          </span>
          <span className="text-[#FFFFFF] font-semibold">FIU-LEA KERNEL SYNCED</span>
          <span className="text-[#2A2A2A]">•</span>
          <span>ETH • TRX • BTC • SOL</span>
        </div>

        <div className="flex items-center space-x-1.5 px-3 py-1.5 rounded-full bg-[#161616] border border-[#2A2A2A] text-[11px] text-[#FFFFFF]">
          <Calendar className="h-3.5 w-3.5 text-[#E5FF8F]" />
          <span>{currentDateStr || 'Today'}</span>
        </div>
      </div>

      {/* Right: Actions, Notifications & Officer Profile */}
      <div className="flex items-center space-x-3">
        {onOpenCaseIntake && (
          <button
            type="button"
            onClick={onOpenCaseIntake}
            className="hidden sm:inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full bg-[#E5FF8F] hover:bg-[#EDFFB1] text-[#0A0A0A] font-sans font-bold text-xs shadow-[0_0_12px_rgba(229,255,143,0.3)] transition-all"
          >
            <span>+ New Case</span>
          </button>
        )}

        {/* Officer Profile & Authority Pill */}
        <div className="flex items-center space-x-2 pl-2 border-l border-[#2A2A2A]">
          <div className="h-8 w-8 rounded-full bg-[#1A1A1A] border border-[#2A2A2A] flex items-center justify-center text-[#E5FF8F] font-bold text-xs">
            {currentUser?.username ? currentUser.username.slice(0, 2).toUpperCase() : 'LE'}
          </div>

          <div className="hidden lg:block text-left">
            <div className="text-[12px] font-sans font-bold text-[#FFFFFF] leading-tight">
              {currentUser?.username || 'Officer'}
            </div>
            <div className="text-[10px] text-[#9A9A9A] uppercase tracking-wider flex items-center gap-1">
              <span className="w-1.5 h-1.5 rounded-full bg-[#E5FF8F]"></span>
              {currentUser?.role || 'Investigator'}
            </div>
          </div>

          {onSwitchRole && (
            <button
              type="button"
              onClick={() => onSwitchRole(currentUser?.role === 'supervisor' ? 'investigator' : 'supervisor')}
              className="p-1.5 rounded-lg bg-[#161616] hover:bg-[#1A1A1A] text-[#9A9A9A] hover:text-[#FFFFFF] border border-[#2A2A2A] transition-colors"
              title={`Switch authority role (Current: ${currentUser?.role || 'investigator'})`}
            >
              <UserCheck className="h-3.5 w-3.5" />
            </button>
          )}
        </div>
      </div>
    </header>
  );
};
