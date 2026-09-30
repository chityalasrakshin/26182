'use client';

import React, { useState, useEffect } from 'react';
import { Shield, Bell, Calendar, UserCheck, ChevronLeft, ChevronRight, Activity, Terminal } from 'lucide-react';
import { UserAuth } from '../lib/types';
import { ActiveTabType } from './Navbar';

interface TopBarProps {
  activeTab: ActiveTabType;
  onSelectTab?: (tab: ActiveTabType) => void;
  currentUser?: UserAuth | null;
  onSwitchRole?: (role: 'supervisor' | 'investigator') => void;
  onOpenCaseIntake?: () => void;
}

export const TopBar: React.FC<TopBarProps> = ({
  activeTab,
  onSelectTab,
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
        return 'Investigate';
      case 'COMPLIANCE':
        return 'Compliance';
      case 'CASES_AUDIT':
        return 'Cases';
      case 'RECENT_INVESTIGATIONS':
        return 'Recent Investigations';
      case 'GRAPH_STUDIO':
        return 'Graph Studio';
      case 'FORENSIC_LEDGER':
        return 'Forensic Ledger';
      case 'NCRP_TRIAGE':
        return 'NCRP Triage';
      default:
        return 'Dashboard';
    }
  };

  return (
    <header className="h-14 border-b border-[#E2E8F0] bg-white flex items-center justify-between px-5 sticky top-0 z-40 text-xs font-mono select-none shadow-xs">
      {/* Left: Section Breadcrumb */}
      <div className="flex items-center space-x-2.5">
        <span className="text-[#64748B] font-bold text-xs uppercase tracking-wider">
          FORENSIC INTELLIGENCE
        </span>
        <span className="text-[#CBD5E1]">/</span>
        <h2 className="text-[#0F172A] font-sans font-bold text-sm">
          {getTabTitle(activeTab)}
        </h2>
      </div>

      {/* Center: Mode Switching Quick Tabs */}
      {onSelectTab && (
        <div className="hidden lg:flex items-center bg-[#F1F5F9] p-1 rounded-lg border border-[#E2E8F0] gap-1">
          <button
            type="button"
            onClick={() => onSelectTab('WORKSPACE')}
            className={`px-3 py-1 rounded-md font-sans text-xs font-semibold transition-all ${
              activeTab === 'WORKSPACE'
                ? 'bg-white text-[#0284C7] shadow-xs border border-[#E2E8F0]'
                : 'text-[#64748B] hover:text-[#0F172A]'
            }`}
          >
            Investigate
          </button>
          <button
            type="button"
            onClick={() => onSelectTab('COMPLIANCE')}
            className={`px-3 py-1 rounded-md font-sans text-xs font-semibold transition-all ${
              activeTab === 'COMPLIANCE'
                ? 'bg-white text-[#0284C7] shadow-xs border border-[#E2E8F0]'
                : 'text-[#64748B] hover:text-[#0F172A]'
            }`}
          >
            Compliance
          </button>
          <button
            type="button"
            onClick={() => onSelectTab('CASES_AUDIT')}
            className={`px-3 py-1 rounded-md font-sans text-xs font-semibold transition-all ${
              activeTab === 'CASES_AUDIT'
                ? 'bg-white text-[#0284C7] shadow-xs border border-[#E2E8F0]'
                : 'text-[#64748B] hover:text-[#0F172A]'
            }`}
          >
            Cases
          </button>
          <button
            type="button"
            onClick={() => onSelectTab('NCRP_TRIAGE')}
            className={`px-3 py-1 rounded-md font-sans text-xs font-semibold transition-all ${
              activeTab === 'NCRP_TRIAGE'
                ? 'bg-white text-[#0284C7] shadow-xs border border-[#E2E8F0]'
                : 'text-[#64748B] hover:text-[#0F172A]'
            }`}
          >
            NCRP Triage
          </button>
          <button
            type="button"
            onClick={() => onSelectTab('FORENSIC_LEDGER')}
            className={`px-3 py-1 rounded-md font-sans text-xs font-semibold transition-all ${
              activeTab === 'FORENSIC_LEDGER'
                ? 'bg-white text-[#0284C7] shadow-xs border border-[#E2E8F0]'
                : 'text-[#64748B] hover:text-[#0F172A]'
            }`}
          >
            Forensic Ledger
          </button>
        </div>
      )}

      {/* Right: Actions, Notifications & Officer Profile */}
      <div className="flex items-center space-x-3">
        {onOpenCaseIntake && (
          <button
            type="button"
            onClick={onOpenCaseIntake}
            className="hidden sm:inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full bg-[#0284C7] hover:bg-[#0369A1] text-white font-sans font-bold text-xs shadow-sm transition-all"
          >
            <span>+ New Case</span>
          </button>
        )}

        {/* Officer Profile & Authority Pill */}
        <div className="flex items-center space-x-2 pl-2 border-l border-[#E2E8F0]">
          <div className="h-8 w-8 rounded-full bg-sky-50 border border-sky-200 flex items-center justify-center text-[#0284C7] font-bold text-xs">
            {currentUser?.username ? currentUser.username.slice(0, 2).toUpperCase() : 'LE'}
          </div>

          <div className="hidden lg:block text-left">
            <div className="text-[12px] font-sans font-bold text-[#0F172A] leading-tight">
              {currentUser?.username || 'Officer'}
            </div>
            <div className="text-[10px] text-[#64748B] uppercase tracking-wider flex items-center gap-1">
              <span className="w-1.5 h-1.5 rounded-full bg-[#0284C7]"></span>
              {currentUser?.role || 'Investigator'}
            </div>
          </div>

          {onSwitchRole && (
            <button
              type="button"
              onClick={() => onSwitchRole(currentUser?.role === 'supervisor' ? 'investigator' : 'supervisor')}
              className="p-1.5 rounded-lg bg-[#F8FAFC] hover:bg-[#F1F5F9] text-[#64748B] hover:text-[#0F172A] border border-[#CBD5E1] transition-colors"
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
