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
      <div className="flex items-center space-x-2 border-b border-[#E2E8F0] pb-3">
        <button
          onClick={() => setSubTab('batch')}
          className={`px-4 py-1.5 rounded-full font-bold transition-all flex items-center space-x-2 ${subTab === 'batch'
            ? 'bg-[#0284C7] text-white shadow-sm'
            : 'bg-white text-[#64748B] hover:text-[#0F172A] border border-[#E2E8F0]'
            }`}
        >
          <UploadCloud className="h-3.5 w-3.5" />
          <span>Batch CSV Triage &amp; Flight-Risk Scoring</span>
        </button>

        <button
          onClick={() => setSubTab('register')}
          className={`px-4 py-1.5 rounded-full font-bold transition-all flex items-center space-x-2 ${subTab === 'register'
            ? 'bg-[#0284C7] text-white shadow-sm'
            : 'bg-white text-[#64748B] hover:text-[#0F172A] border border-[#E2E8F0]'
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
        <div className="bg-white border border-[#E2E8F0] rounded-2xl shadow-sm text-xs font-mono transition-colors overflow-hidden">
          {/* Header */}
          <div className="p-4 border-b border-[#E2E8F0] bg-[#F8FAFC] flex flex-wrap items-center justify-between gap-3">
            <div>
              <div className="flex items-center space-x-2">
                <ShieldAlert className="h-4 w-4 text-[#EF4444]" />
                <h2 className="font-bold text-[#0F172A] uppercase text-xs tracking-wider">
                  NCRP Cyber Financial Crime Incident Queue
                </h2>
                <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-white text-[#64748B] border border-[#E2E8F0]">
                  {filtered.length} INCIDENTS
                </span>
              </div>
              <p className="text-[11px] text-[#64748B] font-sans mt-0.5">
                Registered complaints from Indian cybercrime law enforcement units
              </p>
            </div>

            <div className="flex items-center space-x-2">
              <button
                onClick={loadCases}
                className="p-1.5 rounded-full bg-white hover:bg-[#F1F5F9] text-[#64748B] hover:text-[#0F172A] border border-[#E2E8F0] transition-colors"
                title="Refresh Complaints"
              >
                <RefreshCw className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} />
              </button>

              <Filter className="h-3.5 w-3.5 text-[#64748B]" />
              <select
                value={filterTypology}
                onChange={(e) => setFilterTypology(e.target.value)}
                className="bg-white border border-[#E2E8F0] focus:border-[#0284C7] text-[#0F172A] text-[11px] rounded-full px-3 py-1 font-mono focus:outline-none"
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
            <div className="p-3 bg-rose-50 border-b border-rose-200 text-rose-700 text-xs font-mono flex items-center justify-between">
              <span>Failed to load live NCRP complaints: {error}</span>
              <button onClick={loadCases} className="underline hover:text-rose-900">Retry</button>
            </div>
          )}

          {/* Incident Queue Table */}
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="border-b border-[#E2E8F0] bg-[#F8FAFC] text-[10px] uppercase font-mono tracking-wider text-[#64748B]">
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
              <tbody className="divide-y divide-[#E2E8F0] font-mono text-[11px]">
                {loading ? (
                  <tr>
                    <td colSpan={8} className="py-12 text-center text-[#64748B]">
                      Loading incident dispatch queue...
                    </td>
                  </tr>
                ) : filtered.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="py-12 text-center text-[#64748B]">
                      No complaints matching selected filter.
                    </td>
                  </tr>
                ) : (
                  filtered.map((c, idx) => (
                    <tr key={idx} className="hover:bg-[#F8FAFC] transition-colors">
                      <td className="py-3 px-4 font-bold text-[#0284C7]">
                        {c.complaint_id}
                      </td>

                      <td className="py-3 px-4 text-[#64748B] text-[10px]">
                        {c.district || 'Cyber Crime PS'}
                      </td>

                      <td className="py-3 px-4 text-[#0F172A] font-sans text-xs">
                        {c.scam_typology}
                      </td>

                      <td className="py-3 px-4 text-right font-bold text-[#10B981]">
                        ₹ {(c.victim_loss_inr || 0).toLocaleString('en-IN')}
                      </td>

                      <td className="py-3 px-4 text-[#64748B] font-mono truncate max-w-[140px]">
                        {c.suspect_wallet}
                      </td>

                      <td className="py-3 px-4 text-[#0F172A] font-semibold">
                        {c.suggested_vasp || 'Evaluating'}
                      </td>

                      <td className="py-3 px-4">
                        <span className={`px-2.5 py-0.5 rounded-full text-[9px] font-bold ${c.urgency_level === 'CRITICAL' ? 'bg-rose-50 text-rose-700 border border-rose-200' : 'bg-sky-50 text-sky-700 border border-sky-200'
                          }`}>
                          {c.urgency_level}
                        </span>
                      </td>

                      <td className="py-3 px-4 text-right">
                        <button
                          onClick={() => onSelectCase(c.suspect_wallet, 3)}
                          className="px-3 py-1 bg-[#0284C7] hover:bg-[#0369A1] text-white font-bold rounded-full text-[10px] transition-all shadow-sm"
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
