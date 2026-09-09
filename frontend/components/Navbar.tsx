'use client';

import React, { useEffect, useState } from 'react';
import {
  Shield,
  Search,
  Sun,
  Moon,
  Network,
  ListFilter,
  Briefcase,
  Plus,
} from 'lucide-react';
import { UserAuth } from '../lib/types';

export type ActiveTabType =
  | 'WORKSPACE'
  | 'CASES_AUDIT'
  | 'GRAPH_STUDIO'
  | 'NCRP_TRIAGE';

interface NavbarProps {
  activeTab: ActiveTabType;
  onSelectTab: (tab: ActiveTabType) => void;
  onOpenCaseIntake?: () => void;
  currentUser?: UserAuth | null;
  onSwitchRole?: (role: 'supervisor' | 'investigator') => void;
  hasActiveTarget?: boolean;
}

export const Navbar: React.FC<NavbarProps> = ({
  activeTab,
  onSelectTab,
  onOpenCaseIntake,
  currentUser,
  onSwitchRole,
  hasActiveTarget = false,
}) => {
  const [theme, setTheme] = useState<'dark' | 'light'>('dark');

  useEffect(() => {
    // Check initial preference from localStorage or default dark
    const stored = localStorage.getItem('sudarshan_theme');
    if (stored === 'light') {
      setTheme('light');
      document.documentElement.classList.remove('dark');
    } else {
      setTheme('dark');
      document.documentElement.classList.add('dark');
    }
  }, []);

  const toggleTheme = () => {
    if (theme === 'dark') {
      setTheme('light');
      localStorage.setItem('sudarshan_theme', 'light');
      document.documentElement.classList.remove('dark');
    } else {
      setTheme('dark');
      localStorage.setItem('sudarshan_theme', 'dark');
      document.documentElement.classList.add('dark');
    }
  };

  const tabClass = (tab: ActiveTabType) =>
    `px-3 py-1.5 rounded font-medium transition-colors flex items-center space-x-1.5 ${
      activeTab === tab
        ? 'bg-forensic-surfaceRaised text-forensic-text border border-forensic-border font-bold shadow-sm'
        : 'text-forensic-textMuted hover:text-forensic-text hover:bg-forensic-surfaceRaised/50'
    }`;

  return (
    <header className="border-b border-forensic-border bg-forensic-surface sticky top-0 z-40 text-xs select-none transition-colors">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 flex items-center justify-between py-2.5">
        {/* Left: Branding & Core Navigation */}
        <div className="flex items-center space-x-5">
          <div className="flex items-center space-x-2.5 pr-4 border-r border-forensic-border">
            <div className="h-7 w-7 rounded bg-blue-600/15 border border-blue-500/30 flex items-center justify-center text-blue-500">
              <Shield className="h-4 w-4" />
            </div>
            <div>
              <div className="flex items-center space-x-1.5 leading-none">
                <span className="font-bold text-forensic-text tracking-wider text-sm">
                  CRYPTO<span className="text-blue-500">TRACE</span>
                </span>
                <span className="text-[9px] px-1 py-0.2 rounded bg-forensic-surfaceRaised border border-forensic-border text-forensic-textMuted font-mono uppercase">
                  v2.4
                </span>
              </div>
              <span className="text-[10px] text-forensic-textDim tracking-tight block mt-0.5">
                Financial Intelligence Workstation
              </span>
            </div>
          </div>

          {/* 4 Core Tabs */}
          <nav className="flex items-center space-x-1 font-mono text-xs">
            <button onClick={() => onSelectTab('WORKSPACE')} className={tabClass('WORKSPACE')}>
              <Search className="h-3.5 w-3.5 text-blue-500" />
              <span>Workspace</span>
            </button>

            <button onClick={() => onSelectTab('CASES_AUDIT')} className={tabClass('CASES_AUDIT')}>
              <Briefcase className="h-3.5 w-3.5 text-purple-400" />
              <span>Cases</span>
            </button>

            <button onClick={() => onSelectTab('GRAPH_STUDIO')} className={tabClass('GRAPH_STUDIO')}>
              <Network className="h-3.5 w-3.5 text-forensic-teal" />
              <span>Graph Studio</span>
              {hasActiveTarget && (
                <span className="w-1.5 h-1.5 rounded-full bg-forensic-teal animate-pulse" />
              )}
            </button>

            <button onClick={() => onSelectTab('NCRP_TRIAGE')} className={tabClass('NCRP_TRIAGE')}>
              <ListFilter className="h-3.5 w-3.5 text-forensic-amber" />
              <span>NCRP Queue</span>
            </button>
          </nav>
        </div>

        {/* Right: New Case, Role Switcher & Theme Toggle */}
        <div className="flex items-center space-x-2.5">
          {onOpenCaseIntake && (
            <button
              onClick={onOpenCaseIntake}
              className="flex items-center space-x-1 px-2.5 py-1 rounded bg-blue-600 hover:bg-blue-500 text-white font-mono text-[11px] font-bold shadow transition-colors"
              title="Open New Investigation Case Intake"
            >
              <Plus className="h-3.5 w-3.5" />
              <span>New Case</span>
            </button>
          )}

          {onSwitchRole && (
            <div className="hidden sm:flex items-center bg-forensic-surfaceRaised border border-forensic-border rounded p-0.5 font-mono text-[10px]">
              <button
                onClick={() => onSwitchRole('supervisor')}
                className={`px-2 py-0.5 rounded transition-colors ${
                  currentUser?.role === 'supervisor'
                    ? 'bg-purple-600 text-white font-bold'
                    : 'text-forensic-textMuted hover:text-forensic-text'
                }`}
                title="Switch to Supervisor Mode (All Cases & Global Audit Logs)"
              >
                Supervisor
              </button>
              <button
                onClick={() => onSwitchRole('investigator')}
                className={`px-2 py-0.5 rounded transition-colors ${
                  currentUser?.role !== 'supervisor'
                    ? 'bg-blue-600 text-white font-bold'
                    : 'text-forensic-textMuted hover:text-forensic-text'
                }`}
                title="Switch to Investigator Mode (Assigned Cases)"
              >
                Investigator
              </button>
            </div>
          )}

          {/* Dark / Light Mode Toggle */}
          <button
            onClick={toggleTheme}
            title={theme === 'dark' ? 'Switch to Light Mode' : 'Switch to Dark Mode'}
            className="flex items-center space-x-1.5 px-2.5 py-1 rounded bg-forensic-surfaceRaised hover:bg-forensic-border text-forensic-text border border-forensic-border transition-colors font-sans text-xs"
          >
            {theme === 'dark' ? (
              <>
                <Sun className="h-3.5 w-3.5 text-amber-400" />
                <span className="font-medium">Light</span>
              </>
            ) : (
              <>
                <Moon className="h-3.5 w-3.5 text-blue-600" />
                <span className="font-medium">Dark</span>
              </>
            )}
          </button>
        </div>
      </div>
    </header>
  );
};
