'use client';

import React, { useState, useEffect } from 'react';
import { ShieldAlert, Filter, UploadCloud, ListFilter, RefreshCw } from 'lucide-react';
import { api } from '../lib/api';
import { NcrpBatchTriage } from './NcrpBatchTriage';

interface NCRPTriageViewProps {
  onSelectCase: (walletAddress: string, maxHops: number) => void;
}

export const NCRPTriageView: React.FC<NCRPTriageViewProps> = ({ onSelectCase }) => {
  const [subTab, setSubTab] = useState<'batch' | 'register'>('batch');
  const [cases, setCases] = useState<any[]>([]);
  const [loading, setLoading] = useState<boolean>(false);
  const [filterTypology, setFilterTypology] = useState<string>('ALL');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (subTab === 'register') {
      loadCases();
    }
  }, [subTab]);

  const loadCases = async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await api.getNCRPCases();
      setCases(data || []);
    } catch (err: any) {
      console.error('Failed loading NCRP complaints:', err);
      setError(err.message || 'Failed to load NCRP incidents from database.');
    } finally {
      setLoading(false);
    }
  };

  const filtered = cases.filter(
    (c) => filterTypology === 'ALL' || (c.scam_typology || '').toLowerCase().includes(filterTypology.toLowerCase())
  );

  return (
    <div className="space-y-4 font-mono text-xs">
      {/* Sub-Navigation Tabs */}
      <div className="flex items-center space-x-2 border-b border-[#2A2A2A] pb-3">
        <button
          onClick={() => setSubTab('batch')}
          className={`px-4 py-1.5 rounded-full font-bold transition-all flex items-center space-x-2 ${subTab === 'batch'
            ? 'bg-[#E5FF8F] text-[#0A0A0A] shadow-sm'
            : 'bg-[#161616] text-[#9A9A9A] hover:text-[#FFFFFF] border border-[#2A2A2A]'
            }`}
        >
          <UploadCloud className="h-3.5 w-3.5" />
          <span>Batch CSV Triage &amp; Flight-Risk Scoring</span>
        </button>

        <button
          onClick={() => setSubTab('register')}
          className={`px-4 py-1.5 rounded-full font-bold transition-all flex items-center space-x-2 ${subTab === 'register'
            ? 'bg-[#E5FF8F] text-[#0A0A0A] shadow-sm'
            : 'bg-[#161616] text-[#9A9A9A] hover:text-[#FFFFFF] border border-[#2A2A2A]'
            }`}
        >
          <ListFilter className="h-3.5 w-3.5" />
          <span>Registered Incidents Queue ({cases.length})</span>
        </button>
      </div>

      {/* Sub-Tab 1: Bulk CSV Batch Triage Component */}
      {subTab === 'batch' && (
        <NcrpBatchTriage onSelectCase={onSelectCase} />
      )}

      {/* Sub-Tab 2: Individual Registered Complaints Table */}
      {subTab === 'register' && (
        <div className="bg-[#161616] border border-[#2A2A2A] rounded-2xl shadow-sm text-xs font-mono transition-colors overflow-hidden">
          {/* Header */}
          <div className="p-4 border-b border-[#2A2A2A] bg-[#1A1A1A] flex flex-wrap items-center justify-between gap-3">
            <div>
              <div className="flex items-center space-x-2">
                <ShieldAlert className="h-4 w-4 text-[#FF5C5C]" />
                <h2 className="font-bold text-[#FFFFFF] uppercase text-xs tracking-wider">
                  NCRP Cyber Financial Crime Incident Queue
                </h2>
                <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-[#161616] text-[#9A9A9A] border border-[#2A2A2A]">
                  {filtered.length} INCIDENTS
                </span>
              </div>
              <p className="text-[11px] text-[#9A9A9A] font-sans mt-0.5">
                Registered complaints from Indian cybercrime law enforcement units
              </p>
            </div>

            <div className="flex items-center space-x-2">
              <button
                onClick={loadCases}
                className="p-1.5 rounded-full bg-[#161616] hover:bg-[#252525] text-[#9A9A9A] hover:text-[#FFFFFF] border border-[#2A2A2A] transition-colors"
                title="Refresh Complaints"
              >
                <RefreshCw className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} />
              </button>

              <Filter className="h-3.5 w-3.5 text-[#9A9A9A]" />
              <select
                value={filterTypology}
                onChange={(e) => setFilterTypology(e.target.value)}
                className="bg-[#161616] border border-[#2A2A2A] focus:border-[#E5FF8F] text-[#FFFFFF] text-[11px] rounded-full px-3 py-1 font-mono focus:outline-none"
              >
                <option value="ALL">All Fraud Typologies</option>
                <option value="Task">Part-Time Task Scam</option>
                <option value="Investment">Investment &amp; Forex App</option>
                <option value="Impersonation">Digital Arrest Scam</option>
                <option value="Courier">FedEx Parcel Extortion</option>
              </select>
            </div>
          </div>

          {error && (
            <div className="p-3 bg-[#FF5C5C]/10 border-b border-[#FF5C5C]/30 text-[#FF5C5C] text-xs font-mono flex items-center justify-between">
              <span>Failed to load live NCRP complaints: {error}</span>
              <button onClick={loadCases} className="underline hover:text-[#FFFFFF]">Retry</button>
            </div>
          )}

          {/* Incident Queue Table */}
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="border-b border-[#2A2A2A] bg-[#1A1A1A]/80 text-[10px] uppercase font-mono tracking-wider text-[#9A9A9A]">
                  <th className="py-3 px-4">Complaint Ref</th>
                  <th className="py-3 px-4">Law Enforcement Unit</th>
                  <th className="py-3 px-4">Scam Typology</th>
                  <th className="py-3 px-4 text-right">Victim Loss (INR)</th>
                  <th className="py-3 px-4">Suspect Target Wallet</th>
                  <th className="py-3 px-4">Detected VASP</th>
                  <th className="py-3 px-4">Priority</th>
                  <th className="py-3 px-4 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#2A2A2A] font-mono text-[11px]">
                {loading ? (
                  <tr>
                    <td colSpan={8} className="py-12 text-center text-[#9A9A9A]">
                      Loading incident dispatch queue...
                    </td>
                  </tr>
                ) : filtered.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="py-12 text-center text-[#9A9A9A]">
                      No complaints matching selected filter.
                    </td>
                  </tr>
                ) : (
                  filtered.map((c, idx) => (
                    <tr key={idx} className="hover:bg-[#1A1A1A]/60 transition-colors">
                      <td className="py-3 px-4 font-bold text-[#E5FF8F]">
                        {c.complaint_id}
                      </td>

                      <td className="py-3 px-4 text-[#9A9A9A] text-[10px]">
                        {c.district || 'Cyber Crime PS'}
                      </td>

                      <td className="py-3 px-4 text-[#FFFFFF] font-sans text-xs">
                        {c.scam_typology}
                      </td>

                      <td className="py-3 px-4 text-right font-bold text-[#7CFF6B]">
                        ₹ {(c.victim_loss_inr || 0).toLocaleString('en-IN')}
                      </td>

                      <td className="py-3 px-4 text-[#9A9A9A] font-mono truncate max-w-[140px]">
                        {c.suspect_wallet}
                      </td>

                      <td className="py-3 px-4 text-[#FFFFFF] font-semibold">
                        {c.suggested_vasp || 'Evaluating'}
                      </td>

                      <td className="py-3 px-4">
                        <span className={`px-2.5 py-0.5 rounded-full text-[9px] font-bold ${c.urgency_level === 'CRITICAL' ? 'bg-[#FF5C5C]/15 text-[#FF5C5C] border border-[#FF5C5C]/30' : 'bg-[#E5FF8F]/15 text-[#E5FF8F] border border-[#E5FF8F]/30'
                          }`}>
                          {c.urgency_level}
                        </span>
                      </td>

                      <td className="py-3 px-4 text-right">
                        <button
                          onClick={() => onSelectCase(c.suspect_wallet, 3)}
                          className="px-3 py-1 bg-[#E5FF8F] hover:bg-[#d8f575] text-[#0A0A0A] font-bold rounded-full text-[10px] transition-all shadow-sm"
                        >
                          Trace Target →
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
};
