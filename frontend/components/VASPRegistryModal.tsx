'use client';

import React, { useState, useEffect } from 'react';
import {
  Database,
  Search,
  ExternalLink,
  Copy,
  Check,
  X,
  Building,
  Globe,
  Clock,
  ShieldCheck,
  Mail,
  Send,
  Layers,
} from 'lucide-react';
import { api } from '../lib/api';
import { VASPDirectoryItem } from '../lib/types';

interface VASPRegistryModalProps {
  onClose?: () => void;
  isFullPageView?: boolean;
}

export const VASPRegistryModal: React.FC<VASPRegistryModalProps> = ({ onClose, isFullPageView = false }) => {
  const [activeTab, setActiveTab] = useState<'ADDRESSES' | 'SAHYOG_DIRECTORY'>('SAHYOG_DIRECTORY');
  const [stats, setStats] = useState<any>(null);
  const [addresses, setAddresses] = useState<any[]>([]);
  const [totalMatches, setTotalMatches] = useState<number>(0);
  const [loading, setLoading] = useState<boolean>(true);

  // Directory state
  const [directoryItems, setDirectoryItems] = useState<VASPDirectoryItem[]>([]);
  const [directoryLoading, setDirectoryLoading] = useState<boolean>(false);
  const [fiuOnly, setFiuOnly] = useState<boolean>(false);

  // Filters & Pagination
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [selectedChain, setSelectedChain] = useState<string>('ALL');
  const [selectedVasp, setSelectedVasp] = useState<string>('ALL');
  const [selectedType, setSelectedType] = useState<string>('ALL');
  const [page, setPage] = useState<number>(0);
  const pageSize = 25;

  const [copiedAddr, setCopiedAddr] = useState<string | null>(null);

  useEffect(() => {
    loadStats();
    loadDirectory();
  }, []);

  useEffect(() => {
    if (activeTab === 'ADDRESSES') {
      loadAddresses();
    } else {
      loadDirectory();
    }
  }, [activeTab, searchQuery, selectedChain, selectedVasp, selectedType, page, fiuOnly]);

  const loadDirectory = async () => {
    try {
      setDirectoryLoading(true);
      const items = await api.getVASPDirectory(searchQuery || undefined, fiuOnly);
      setDirectoryItems(items || []);
    } catch (e) {
      console.error('Failed to load VASP directory:', e);
    } finally {
      setDirectoryLoading(false);
    }
  };

  const loadStats = async () => {
    try {
      const s = await api.getVASPStats();
      setStats(s);
    } catch (e) {
      console.error('Failed to load VASP stats:', e);
    }
  };

  const loadAddresses = async () => {
    try {
      setLoading(true);
      const res = await api.getVASPAddresses({
        query: searchQuery || undefined,
        chain: selectedChain !== 'ALL' ? selectedChain : undefined,
        vasp_name: selectedVasp !== 'ALL' ? selectedVasp : undefined,
        address_type: selectedType !== 'ALL' ? selectedType : undefined,
        limit: pageSize,
        offset: page * pageSize,
      });
      setAddresses(res.addresses || []);
      setTotalMatches(res.total || 0);
    } catch (e) {
      console.error('Failed to load VASP addresses:', e);
    } finally {
      setLoading(false);
    }
  };

  const handleCopy = (addr: string) => {
    navigator.clipboard.writeText(addr);
    setCopiedAddr(addr);
    setTimeout(() => setCopiedAddr(null), 2000);
  };

  const totalPages = Math.ceil(totalMatches / pageSize) || 1;

  const content = (
    <div className={`bg-white border border-[#E2E8F0] rounded-2xl w-full flex flex-col font-mono text-xs overflow-hidden transition-colors ${isFullPageView ? 'shadow-sm' : 'max-w-6xl max-h-[92vh] shadow-2xl'
      }`}>
      {/* Header */}
      <div className="p-4 border-b border-[#E2E8F0] flex items-center justify-between bg-[#F8FAFC]">
        <div className="flex items-center space-x-3">
          <div className="p-2.5 rounded-xl bg-[#0284C7]/10 border border-[#0284C7]/20 text-[#0284C7]">
            <Database className="h-5 w-5" />
          </div>
          <div>
            <div className="flex items-center space-x-2">
              <h2 className="text-sm font-bold text-[#0F172A] uppercase tracking-wider">
                VASPs &amp; Entity Intelligence Registry
              </h2>
              <span className="px-2.5 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200 text-[10px] font-bold">
                {stats ? `${stats.total_addresses.toLocaleString()} VERIFIED ADDRESSES` : 'LOADING...'}
              </span>
            </div>
            <p className="text-[11px] text-[#64748B] font-sans mt-0.5">
              Curated public Proof-of-Reserves, Etherscan verified labels, Tronscan tags &amp; FIU-IND registrations
            </p>
          </div>
        </div>

        {onClose && (
          <button
            onClick={onClose}
            className="p-1.5 rounded-full text-[#64748B] hover:text-[#0F172A] hover:bg-[#F1F5F9] transition-colors"
          >
            <X className="h-4 w-4" />
          </button>
        )}
      </div>

      {/* High-Level Stat Counters */}
      {stats && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 p-4 bg-[#F8FAFC] border-b border-[#E2E8F0] text-xs">
          <div className="p-3.5 bg-white rounded-xl border border-[#E2E8F0]">
            <span className="text-[10px] uppercase text-[#64748B] block">Registered Entities</span>
            <strong className="text-base text-[#0284C7] font-bold">{stats.total_vasps} VASPs</strong>
          </div>
          <div className="p-3.5 bg-white rounded-xl border border-[#E2E8F0]">
            <span className="text-[10px] uppercase text-[#64748B] block">Known Addresses</span>
            <strong className="text-base text-[#10B981] font-bold">
              {stats.total_addresses.toLocaleString()}
            </strong>
          </div>
          <div className="p-3.5 bg-white rounded-xl border border-[#E2E8F0]">
            <span className="text-[10px] uppercase text-[#64748B] block">ETH Addresses</span>
            <strong className="text-base text-[#0F172A] font-bold">
              {stats.by_chain?.ETHEREUM || 0}
            </strong>
          </div>
          <div className="p-3.5 bg-white rounded-xl border border-[#E2E8F0]">
            <span className="text-[10px] uppercase text-[#64748B] block">TRON Addresses</span>
            <strong className="text-base text-[#EF4444] font-bold">
              {stats.by_chain?.TRON || 0}
            </strong>
          </div>
        </div>
      )}

      {/* Sub-Tab Navigation */}
      <div className="flex items-center justify-between px-4 py-3 bg-white border-b border-[#E2E8F0] text-xs">
        <div className="flex items-center space-x-2">
          <button
            onClick={() => setActiveTab('SAHYOG_DIRECTORY')}
            className={`flex items-center space-x-1.5 px-4 py-1.5 rounded-full font-bold transition-all ${activeTab === 'SAHYOG_DIRECTORY'
              ? 'bg-[#0284C7] text-white shadow-sm'
              : 'text-[#64748B] hover:text-[#0F172A] hover:bg-[#F1F5F9]'
              }`}
          >
            <Building className="h-3.5 w-3.5" />
            <span>SAHYOG Law Enforcement Directory</span>
          </button>

          <button
            onClick={() => setActiveTab('ADDRESSES')}
            className={`flex items-center space-x-1.5 px-4 py-1.5 rounded-full font-bold transition-all ${activeTab === 'ADDRESSES'
              ? 'bg-[#0284C7] text-white shadow-sm'
              : 'text-[#64748B] hover:text-[#0F172A] hover:bg-[#F1F5F9]'
              }`}
          >
            <Database className="h-3.5 w-3.5" />
            <span>Verified Cluster Addresses</span>
          </button>
        </div>

        {activeTab === 'SAHYOG_DIRECTORY' && (
          <label className="flex items-center space-x-2 cursor-pointer text-[#64748B] hover:text-[#0F172A]">
            <input
              type="checkbox"
              checked={fiuOnly}
              onChange={(e) => setFiuOnly(e.target.checked)}
              className="rounded border-[#CBD5E1] text-[#0284C7] focus:ring-[#0284C7]"
            />
            <span className="text-[11px]">FIU-IND Registered Only</span>
          </label>
        )}
      </div>

      {/* Content Area */}
      <div className="p-4 flex-1 overflow-y-auto space-y-4">
        {activeTab === 'SAHYOG_DIRECTORY' ? (
          <div className="space-y-4">
            {/* Search and Filters */}
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex-1 min-w-[240px] relative">
                <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-[#64748B]" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search VASP name, jurisdiction, or routing code..."
                  className="w-full bg-white border border-[#E2E8F0] rounded-full pl-10 pr-4 py-2 text-xs text-[#0F172A] placeholder-[#94A3B8] focus:outline-none focus:border-[#0284C7]"
                />
              </div>

              <select
                value={selectedType}
                onChange={(e) => setSelectedType(e.target.value)}
                className="bg-white border border-[#E2E8F0] rounded-full px-3 py-2 text-xs text-[#0F172A] focus:outline-none focus:border-[#0284C7]"
              >
                <option value="ALL">All Categories</option>
                <option value="Centralized Exchange (CEX)">Centralized Exchange (CEX)</option>
                <option value="Custodian / Prime Broker">Custodian / Prime Broker</option>
                <option value="Payment Gateway">Payment Gateway</option>
              </select>
            </div>

            {directoryLoading ? (
              <div className="flex items-center justify-center py-20 text-[#64748B]">
                <span>Loading verified VASP compliance directory...</span>
              </div>
            ) : directoryItems.length === 0 ? (
              <div className="text-center py-16 text-[#64748B]">
                No VASP entities match your search criteria.
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {directoryItems.map((vasp) => (
                  <div
                    key={vasp.id}
                    className="p-5 rounded-2xl bg-white border border-[#E2E8F0] hover:border-[#0284C7]/40 transition-colors space-y-3 shadow-sm"
                  >
                    <div className="flex items-start justify-between">
                      <div>
                        <div className="flex items-center space-x-2">
                          <strong className="text-sm font-bold text-[#0F172A]">{vasp.name}</strong>
                          {vasp.is_fiu_registered ? (
                            <span className="px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200 text-[9px] font-bold">
                              FIU-IND REGISTERED
                            </span>
                          ) : (
                            <span className="px-2 py-0.5 rounded-full bg-sky-50 text-sky-700 border border-sky-200 text-[9px] font-bold">
                              FOREIGN VASP
                            </span>
                          )}
                        </div>
                        <span className="text-[10px] text-[#64748B] block mt-0.5 font-mono">
                          {vasp.category} • {vasp.country} ({vasp.jurisdiction})
                        </span>
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-2 text-[10px] bg-[#F8FAFC] p-3 rounded-xl border border-[#E2E8F0] font-mono">
                      <div>
                        <span className="text-[#64748B] block text-[9px]">SAHYOG ROUTING CODE</span>
                        <div className="flex items-center space-x-1 pt-0.5">
                          <span className="text-[#0284C7] font-bold truncate">{vasp.sahyog_routing_code}</span>
                          <button
                            onClick={() => handleCopy(vasp.sahyog_routing_code || '')}
                            title="Copy routing code"
                            className="hover:text-[#0F172A] text-[#64748B]"
                          >
                            <Copy className="h-2.5 w-2.5" />
                          </button>
                        </div>
                      </div>

                      <div>
                        <span className="text-[#64748B] block text-[9px]">RESPONSE SLA</span>
                        <span className="text-[#10B981] font-bold block pt-0.5 truncate">{vasp.response_sla || vasp.mock_response_sla}</span>
                      </div>

                      <div>
                        <span className="text-[#64748B] block text-[9px]">FIU REGISTRATION</span>
                        <span className="text-[#0F172A] truncate block pt-0.5">{vasp.fiu_registration_number || 'N/A'}</span>
                      </div>

                      <div>
                        <span className="text-[#64748B] block text-[9px]">NODAL OFFICER</span>
                        <span className="text-[#0F172A] truncate block pt-0.5">{vasp.nodal_officer || 'Compliance Desk'}</span>
                      </div>
                    </div>

                    <div className="text-[10px] space-y-1 font-mono text-[#64748B]">
                      <div className="flex items-center justify-between">
                        <span>LEA Contact:</span>
                        <span className="text-[#0284C7] font-medium">{vasp.designated_lea_email || vasp.compliance_email}</span>
                      </div>
                      {vasp.compliance_portal && (
                        <div className="flex items-center justify-between">
                          <span>Compliance Portal:</span>
                          <a href={vasp.compliance_portal} target="_blank" rel="noreferrer" className="text-[#0284C7] hover:underline truncate max-w-[200px]">
                            {vasp.compliance_portal.replace(/^https?:\/\//, '')}
                          </a>
                        </div>
                      )}
                    </div>

                    {vasp.known_deposit_cluster_labels && vasp.known_deposit_cluster_labels.length > 0 && (
                      <div className="pt-1 flex flex-wrap gap-1">
                        {vasp.known_deposit_cluster_labels.map((lbl, idx) => (
                          <span key={idx} className="px-2 py-0.5 rounded-full bg-white border border-[#E2E8F0] text-[#64748B] text-[9px] font-mono">
                            {lbl}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        ) : (
          <div className="space-y-4">
            {/* Filters Toolbar */}
            <div className="p-3 bg-[#F8FAFC] border border-[#E2E8F0] rounded-2xl flex flex-wrap items-center justify-between gap-3 text-xs">
              <div className="flex-1 min-w-[220px] relative">
                <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-[#64748B]" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => {
                    setSearchQuery(e.target.value);
                    setPage(0);
                  }}
                  placeholder="Search by address (0x... or T...), VASP, or notes..."
                  className="w-full pl-10 pr-4 py-2 bg-white border border-[#E2E8F0] focus:border-[#0284C7] rounded-full text-[#0F172A] placeholder-[#94A3B8] font-mono text-[11px] focus:outline-none transition-colors"
                />
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <select
                  value={selectedChain}
                  onChange={(e) => {
                    setSelectedChain(e.target.value);
                    setPage(0);
                  }}
                  className="bg-white border border-[#E2E8F0] focus:border-[#0284C7] text-[#0F172A] rounded-full px-3 py-1.5 text-[11px] font-mono focus:outline-none"
                >
                  <option value="ALL">All Chains</option>
                  <option value="ethereum">Ethereum</option>
                  <option value="tron">Tron (TRC-20)</option>
                </select>

                <select
                  value={selectedVasp}
                  onChange={(e) => {
                    setSelectedVasp(e.target.value);
                    setPage(0);
                  }}
                  className="bg-white border border-[#E2E8F0] focus:border-[#0284C7] text-[#0F172A] rounded-full px-3 py-1.5 text-[11px] font-mono focus:outline-none"
                >
                  <option value="ALL">All VASPs</option>
                  {stats?.by_vasp &&
                    Object.keys(stats.by_vasp).map((vname) => (
                      <option key={vname} value={vname}>
                        {vname} ({stats.by_vasp[vname]})
                      </option>
                    ))}
                </select>

                <select
                  value={selectedType}
                  onChange={(e) => {
                    setSelectedType(e.target.value);
                    setPage(0);
                  }}
                  className="bg-white border border-[#E2E8F0] focus:border-[#0284C7] text-[#0F172A] rounded-full px-3 py-1.5 text-[11px] font-mono focus:outline-none"
                >
                  <option value="ALL">All Types</option>
                  <option value="hot_wallet">Hot Wallet</option>
                  <option value="cold_storage">Cold Storage</option>
                  <option value="deposit">Deposit Collector</option>
                  <option value="withdrawal">Withdrawal Hub</option>
                  <option value="treasury">Treasury</option>
                </select>
              </div>
            </div>

            {/* Address Records Table */}
            <div className={`overflow-y-auto p-1 ${isFullPageView ? 'min-h-[400px]' : 'flex-1'}`}>
              {loading ? (
                <div className="flex items-center justify-center py-20 text-[#64748B]">
                  <span>Querying verified entity registry...</span>
                </div>
              ) : addresses.length === 0 ? (
                <div className="text-center py-16 text-[#64748B]">
                  No verified VASP addresses match your filters.
                </div>
              ) : (
                <div className="overflow-x-auto border border-[#E2E8F0] rounded-2xl">
                  <table className="w-full text-left text-xs border-collapse">
                    <thead>
                      <tr className="border-b border-[#E2E8F0] bg-[#F8FAFC] text-[10px] uppercase font-mono tracking-wider text-[#64748B]">
                        <th className="py-3 px-3.5">Entity Name</th>
                        <th className="py-3 px-3.5">Blockchain Address</th>
                        <th className="py-3 px-3.5">Chain</th>
                        <th className="py-3 px-3.5">Cluster Role</th>
                        <th className="py-3 px-3.5">Provenance Authority</th>
                        <th className="py-3 px-3.5">Confidence</th>
                        <th className="py-3 px-3.5">Status</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[#E2E8F0] font-mono text-[11px]">
                      {addresses.map((item, idx) => (
                        <tr key={idx} className="hover:bg-[#F8FAFC] transition-colors">
                          <td className="py-2.5 px-3.5">
                            <strong className="text-[#0F172A]">{item.vasp_name}</strong>
                          </td>

                          <td className="py-2.5 px-3.5">
                            <div className="flex items-center space-x-1.5">
                              <span className="text-[#64748B] truncate max-w-[220px]">
                                {item.address}
                              </span>
                              <button
                                onClick={() => handleCopy(item.address)}
                                title="Copy address"
                                className="p-1 hover:text-[#0F172A] text-[#64748B]"
                              >
                                {copiedAddr === item.address ? (
                                  <Check className="h-3 w-3 text-[#10B981]" />
                                ) : (
                                  <Copy className="h-3 w-3" />
                                )}
                              </button>
                              <a
                                href={
                                  item.chain === 'ethereum'
                                    ? `https://etherscan.io/address/${item.address}`
                                    : `https://tronscan.org/#/address/${item.address}`
                                }
                                target="_blank"
                                rel="noreferrer"
                                className="p-1 text-[#0284C7] hover:underline"
                              >
                                <ExternalLink className="h-3 w-3" />
                              </a>
                            </div>
                          </td>

                          <td className="py-2.5 px-3.5">
                            <span className={`px-2 py-0.5 rounded-full text-[9px] font-bold ${item.chain === 'ethereum' ? 'bg-sky-50 text-sky-700 border border-sky-200' : 'bg-rose-50 text-rose-700 border border-rose-200'
                              }`}>
                              {item.chain?.toUpperCase()}
                            </span>
                          </td>

                          <td className="py-2.5 px-3.5 text-[#64748B] text-[10px]">
                            {item.address_type?.replace('_', ' ')}
                          </td>

                          <td className="py-2.5 px-3.5">
                            {item.source_url ? (
                              <a
                                href={item.source_url}
                                target="_blank"
                                rel="noreferrer"
                                className="text-[#0284C7] hover:underline inline-flex items-center space-x-1 text-[10px]"
                              >
                                <span>{item.source_name || item.source}</span>
                                <ExternalLink className="h-2.5 w-2.5 ml-0.5" />
                              </a>
                            ) : (
                              <span className="text-[#64748B] text-[10px]">{item.source_name || item.source}</span>
                            )}
                          </td>

                          <td className="py-2.5 px-3.5 text-[#10B981] font-bold text-[10px]">
                            {item.confidence_score ? `${item.confidence_score}%` : '95%'}
                          </td>

                          <td className="py-2.5 px-3.5">
                            <span className="px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200 text-[10px] font-bold">
                              VERIFIED
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            {/* Pagination Bar */}
            <div className="p-3 bg-[#F8FAFC] border border-[#E2E8F0] rounded-2xl flex items-center justify-between text-[11px] text-[#64748B] font-mono">
              <div>
                Showing {addresses.length} of {totalMatches.toLocaleString()} records
              </div>

              <div className="flex items-center space-x-2">
                <button
                  onClick={() => setPage((p) => Math.max(p - 1, 0))}
                  disabled={page === 0}
                  className="px-3 py-1 rounded-full bg-white border border-[#E2E8F0] disabled:opacity-40 hover:bg-[#F1F5F9] text-[#0F172A] transition-colors"
                >
                  Prev
                </button>
                <span>
                  Page {page + 1} of {totalPages}
                </span>
                <button
                  onClick={() => setPage((p) => Math.min(p + 1, totalPages - 1))}
                  disabled={page >= totalPages - 1}
                  className="px-3 py-1 rounded-full bg-white border border-[#E2E8F0] disabled:opacity-40 hover:bg-[#F1F5F9] text-[#0F172A] transition-colors"
                >
                  Next
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );

  if (isFullPageView) {
    return content;
  }

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
      {content}
    </div>
  );
};
