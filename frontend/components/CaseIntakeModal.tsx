'use client';

import React, { useState, useEffect } from 'react';
import {
  FolderPlus,
  X,
  Upload,
  FileSpreadsheet,
  AlertCircle,
  CheckCircle2,
  ArrowRight,
  Shield,
  Layers,
  Sparkles,
  FileText,
  DollarSign,
  Search,
} from 'lucide-react';
import { api } from '../lib/api';
import { CSVIntakeRecord, CaseItem } from '../lib/types';

interface CaseIntakeModalProps {
  isOpen: boolean;
  onClose: () => void;
  onCaseCreated: (createdCase: CaseItem, initialJobId?: string) => void;
}


export const CaseIntakeModal: React.FC<CaseIntakeModalProps> = ({
  isOpen,
  onClose,
  onCaseCreated,
}) => {
  const [activeTab, setActiveTab] = useState<'single' | 'csv'>('single');
  const [discoveredPresets, setDiscoveredPresets] = useState<any[]>([]);

  useEffect(() => {
    const fetchTopSeeds = async () => {
      try {
        const res = await api.getCandidates({ limit: 4, min_score: 40, sort_by: 'quality' });
        if (res?.candidates && res.candidates.length > 0) {
          setDiscoveredPresets(
            res.candidates.map((c: any) => ({
              name: c.discovery_vasp_name ? `${c.discovery_vasp_name} Counterparty` : 'Discovered Lead',
              address: c.address,
              chain: c.chain,
              priority: 'HIGH',
              title: `Suspect Lead (${c.chain.toUpperCase()}) - ${c.discovery_vasp_name || 'Counterparty'}`,
              loss_inr: Math.round((c.total_volume_usd || 10000) * 83),
              ncrp: `NCRP-2026-${c.id.toString().padStart(6, '0')}`,
              tag: c.discovery_vasp_name || 'Active Counterparty',
            }))
          );
        }
      } catch (e) {
        console.warn('Could not fetch candidate presets for intake:', e);
      }
    };
    fetchTopSeeds();
  }, []);

  // Single Case Form State
  const [suspectAddress, setSuspectAddress] = useState('');
  const [chain, setChain] = useState<'auto' | 'ethereum' | 'tron' | 'bitcoin'>('auto');
  const [maxDepth, setMaxDepth] = useState<number>(3);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [priority, setPriority] = useState<'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL'>('HIGH');
  const [victimLossInr, setVictimLossInr] = useState<number>(1000000);
  const [ncrpComplaintId, setNcrpComplaintId] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // CSV Batch State
  const [csvRecords, setCsvRecords] = useState<CSVIntakeRecord[]>([]);
  const [csvFileName, setCsvFileName] = useState<string | null>(null);
  const [batchSubmitting, setBatchSubmitting] = useState(false);

  if (!isOpen) return null;

  const validateAddress = (addr: string): { valid: boolean; detectedChain: string; error?: string } => {
    const clean = addr.trim();
    if (!clean) return { valid: false, detectedChain: 'unknown', error: 'Address is required' };
    if (/^0x[0-9a-fA-F]{40}$/.test(clean)) return { valid: true, detectedChain: 'ethereum' };
    if (/^T[1-9A-HJ-NP-za-km-z]{33}$/.test(clean)) return { valid: true, detectedChain: 'tron' };
    if (/^(1|3|bc1)[a-zA-HJ-NP-Z0-9]{25,59}$/.test(clean)) return { valid: true, detectedChain: 'bitcoin' };
    return { valid: false, detectedChain: 'unknown', error: 'Invalid crypto wallet address format' };
  };

  const handleApplyPreset = (preset: any) => {
    setSuspectAddress(preset.address);
    setChain(preset.chain as any);
    setTitle(preset.title);
    setPriority(preset.priority as any);
    setVictimLossInr(preset.loss_inr);
    setNcrpComplaintId(preset.ncrp);
    setDescription(`Suspect cryptocurrency wallet identified during NCRP triage for ${preset.title}. Tracing immediate VASP off-ramps.`);
    setError(null);
  };

  const handleSubmitSingle = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    const validation = validateAddress(suspectAddress);
    if (!validation.valid) {
      setError(validation.error || 'Invalid address');
      return;
    }

    const effectiveChain = chain === 'auto' ? validation.detectedChain : chain;
    const finalTitle = title.trim() || `Investigation of ${suspectAddress.slice(0, 8)}...${suspectAddress.slice(-6)}`;

    setIsSubmitting(true);
    try {
      // 1. Create Case
      const newCase = await api.createCase({
        title: finalTitle,
        description: description.trim() || 'Initiated via CryptoTrace LEA Workstation Intake.',
        suspect_address: suspectAddress.trim(),
        chain: effectiveChain,
        priority,
        victim_loss_inr: Number(victimLossInr) || 0,
        ncrp_complaint_id: ncrpComplaintId.trim() || undefined,
        tags: ['intake', effectiveChain, priority.toLowerCase()],
      });

      // 2. Start Multi-Hop Trace for Case
      let initialJobId: string | undefined;
      try {
        const traceRes = await api.startCaseTrace(newCase.id, maxDepth);
        initialJobId = traceRes.job_id;
      } catch (traceErr) {
        console.warn('Trace auto-launch notice (falling back to direct trace):', traceErr);
        try {
          const directTrace = await api.startTrace(suspectAddress.trim(), effectiveChain, maxDepth);
          initialJobId = directTrace.job_id;
        } catch {
          // Keep case created
        }
      }

      onCaseCreated(newCase, initialJobId);
      onClose();
    } catch (err: any) {
      setError(err.message || 'Failed to create investigation case.');
    } finally {
      setIsSubmitting(false);
    }
  };

  // CSV Parsing
  const handleFileUpload = (file: File) => {
    setCsvFileName(file.name);
    const reader = new FileReader();
    reader.onload = (e) => {
      const text = e.target?.result as string;
      parseCSV(text);
    };
    reader.readAsText(file);
  };

  const parseCSV = (content: string) => {
    const lines = content.split(/\r?\n/).filter((l) => l.trim().length > 0);
    if (lines.length < 1) return;

    // Detect header or treat as address list
    const firstLine = lines[0].toLowerCase();
    const hasHeader = firstLine.includes('address') || firstLine.includes('wallet');
    const dataLines = hasHeader ? lines.slice(1) : lines;

    const parsed: CSVIntakeRecord[] = dataLines.map((line, idx) => {
      const cols = line.split(',').map((c) => c.trim().replace(/^["']|["']$/g, ''));
      const addr = cols[0] || '';
      const customChain = cols[1] || 'auto';
      const label = cols[2] || `Suspect Lead #${idx + 1}`;
      const loss = parseFloat(cols[3]) || 500000;
      const prio = (cols[4]?.toUpperCase() as any) || 'HIGH';

      const validation = validateAddress(addr);
      return {
        id: `csv-${idx + 1}`,
        address: addr,
        chain: customChain !== 'auto' ? customChain : validation.detectedChain,
        label,
        victim_loss_inr: loss,
        priority: ['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'].includes(prio) ? prio : 'HIGH',
        status: validation.valid ? 'valid' : 'invalid',
        error: validation.error,
      };
    });

    setCsvRecords(parsed);
  };

  const loadSampleCSV = () => {
    const sample = `address,chain,label,loss_inr,priority
0x3f8702cfb1662195fcc98593789682da91dfaae3,ethereum,Task Scam Primary Off-Ramp,4500000,CRITICAL
0x0051cc1d8bbf0b3373b02e22ea5a2fe483266cea,ethereum,Gate.io Mule Account,1200000,HIGH
0xd90e2f925da726b50c4ed8d0fb90ad053324f31b,ethereum,Tornado Cash Router Pool,85000000,CRITICAL
TR7NHqjeKQxGTCi8q882bX1PNkWgk9379k,tron,Ponzi Tether Mule TRC20,3200000,HIGH
0x35465d7b8ec8f28b06c90ab562c85a012337f687,ethereum,Binance Deposit Layering Node,750000,MEDIUM`;
    setCsvFileName('sample_lea_suspects.csv');
    parseCSV(sample);
  };

  const handleTraceRecord = async (record: CSVIntakeRecord) => {
    setSuspectAddress(record.address);
    setChain(record.chain as any);
    setTitle(`Batch Intake: ${record.label || record.address.slice(0, 8)}`);
    setVictimLossInr(record.victim_loss_inr || 500000);
    setPriority(record.priority || 'HIGH');
    setActiveTab('single');
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-3 sm:p-4 animate-in fade-in duration-150">
      <div className="bg-[#161616] border border-[#2A2A2A] rounded-2xl w-full max-w-4xl max-h-[92vh] flex flex-col shadow-2xl overflow-hidden font-sans text-xs">
        {/* Modal Header */}
        <div className="px-5 py-4 border-b border-[#2A2A2A] flex items-center justify-between bg-[#1A1A1A]/90 backdrop-blur-md">
          <div className="flex items-center space-x-3">
            <div className="p-2.5 rounded-xl bg-[#E5FF8F]/10 border border-[#E5FF8F]/20 text-[#E5FF8F]">
              <FolderPlus className="h-5 w-5" />
            </div>
            <div>
              <h2 className="text-sm font-bold text-[#FFFFFF] tracking-wide uppercase flex items-center space-x-2 font-mono">
                <span>New Investigation Case Intake</span>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-mono bg-[#E5FF8F]/10 text-[#E5FF8F] border border-[#E5FF8F]/20">
                  LEA Direct Intake
                </span>
              </h2>
              <p className="text-[11px] text-[#9A9A9A] font-sans">
                Ingest suspect crypto wallets, attach NCRP fraud complaints, and dispatch multi-hop VASP traces.
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-[#9A9A9A] hover:text-[#FFFFFF] rounded-full hover:bg-[#2A2A2A] transition-colors"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Tab Switcher */}
        <div className="flex border-b border-[#2A2A2A] bg-[#161616] px-5 pt-2 text-xs font-mono gap-2">
          <button
            onClick={() => setActiveTab('single')}
            className={`pb-3 px-4 font-semibold border-b-2 transition-colors flex items-center space-x-2 ${activeTab === 'single'
              ? 'border-[#E5FF8F] text-[#E5FF8F]'
              : 'border-transparent text-[#9A9A9A] hover:text-[#FFFFFF]'
              }`}
          >
            <FileText className="h-3.5 w-3.5" />
            <span>Single Wallet Intake</span>
          </button>
          <button
            onClick={() => setActiveTab('csv')}
            className={`pb-3 px-4 font-semibold border-b-2 transition-colors flex items-center space-x-2 ${activeTab === 'csv'
              ? 'border-[#E5FF8F] text-[#E5FF8F]'
              : 'border-transparent text-[#9A9A9A] hover:text-[#FFFFFF]'
              }`}
          >
            <FileSpreadsheet className="h-3.5 w-3.5" />
            <span>Batch CSV Ingestion</span>
            {csvRecords.length > 0 && (
              <span className="px-2 py-0.5 rounded-full text-[10px] bg-[#E5FF8F]/10 text-[#E5FF8F] border border-[#E5FF8F]/20">
                {csvRecords.length}
              </span>
            )}
          </button>
        </div>

        {/* Modal Body */}
        <div className="flex-1 overflow-y-auto p-5 space-y-4">
          {error && (
            <div className="p-3 bg-[#FF5C5C]/10 border border-[#FF5C5C]/30 rounded-2xl flex items-center space-x-2.5 text-[#FF5C5C] font-mono text-xs">
              <AlertCircle className="h-4 w-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {activeTab === 'single' ? (
            <form onSubmit={handleSubmitSingle} className="space-y-4 font-mono">
              {/* Presets Bar */}
              <div className="p-3.5 bg-[#1A1A1A] border border-[#2A2A2A] rounded-2xl space-y-2">
                <div className="flex items-center justify-between text-[11px] text-[#9A9A9A]">
                  <span className="flex items-center space-x-1.5 font-bold uppercase tracking-wider text-[#FFFFFF]">
                    <Sparkles className="h-3.5 w-3.5 text-[#E5FF8F]" />
                    <span>Discovered Target Leads (Active Database Counterparties):</span>
                  </span>
                  <span className="text-[10px] text-[#666666]">Click to autofill</span>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2">
                  {discoveredPresets.length === 0 ? (
                    <div className="col-span-4 text-[10px] text-[#9A9A9A] py-1 italic">
                      No automated candidate leads in database yet. Enter suspect details manually below.
                    </div>
                  ) : discoveredPresets.map((p, idx) => (
                    <button
                      key={idx}
                      type="button"
                      onClick={() => handleApplyPreset(p)}
                      className="p-2.5 bg-[#161616] hover:bg-[#202020] border border-[#2A2A2A] hover:border-[#E5FF8F]/40 rounded-xl text-left transition-colors group space-y-1 shadow-sm"
                    >
                      <div className="flex items-center justify-between text-[11px]">
                        <span className="font-bold text-[#FFFFFF] group-hover:text-[#E5FF8F] truncate">
                          {p.name}
                        </span>
                        <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-[#E5FF8F]/10 text-[#E5FF8F] border border-[#E5FF8F]/20 uppercase font-semibold">
                          {p.chain}
                        </span>
                      </div>
                      <div className="text-[10px] text-[#9A9A9A] truncate font-mono">
                        {p.address.slice(0, 6)}...{p.address.slice(-4)}
                      </div>
                    </button>
                  ))}
                </div>
              </div>

              {/* Target Address & Blockchain Rail */}
              <div className="grid grid-cols-1 md:grid-cols-12 gap-3">
                <div className="md:col-span-8 space-y-1">
                  <label className="block text-[11px] font-bold text-[#FFFFFF] uppercase tracking-wider">
                    Suspect Target Wallet Address *
                  </label>
                  <input
                    type="text"
                    required
                    value={suspectAddress}
                    onChange={(e) => setSuspectAddress(e.target.value)}
                    placeholder="0x... (Ethereum/Polygon/BSC) or T... (Tron TRC-20) or 1.../bc1... (Bitcoin)"
                    className="w-full px-3.5 py-2.5 bg-[#1A1A1A] border border-[#2A2A2A] focus:border-[#E5FF8F] rounded-full text-[#FFFFFF] placeholder-[#666666] font-mono text-xs focus:outline-none transition-colors"
                  />
                </div>

                <div className="md:col-span-4 space-y-1">
                  <label className="block text-[11px] font-bold text-[#FFFFFF] uppercase tracking-wider">
                    Blockchain Rail
                  </label>
                  <select
                    value={chain}
                    onChange={(e) => setChain(e.target.value as any)}
                    className="w-full px-3.5 py-2.5 bg-[#1A1A1A] border border-[#2A2A2A] focus:border-[#E5FF8F] rounded-full text-[#FFFFFF] font-mono text-xs focus:outline-none transition-colors"
                  >
                    <option value="auto">Auto-Detect Blockchain</option>
                    <option value="ethereum">Ethereum Mainnet (0x...)</option>
                    <option value="tron">Tron Network TRC-20 (T...)</option>
                    <option value="bitcoin">Bitcoin Network (BTC)</option>
                  </select>
                </div>
              </div>

              {/* Case Title & NCRP Acknowledgment */}
              <div className="grid grid-cols-1 md:grid-cols-12 gap-3">
                <div className="md:col-span-8 space-y-1">
                  <label className="block text-[11px] font-bold text-[#FFFFFF] uppercase tracking-wider">
                    Investigation Title
                  </label>
                  <input
                    type="text"
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    placeholder="e.g. NCRP Complaint 948102 - Telegram Investment Scam"
                    className="w-full px-3.5 py-2.5 bg-[#1A1A1A] border border-[#2A2A2A] focus:border-[#E5FF8F] rounded-full text-[#FFFFFF] placeholder-[#666666] text-xs focus:outline-none transition-colors"
                  />
                </div>

                <div className="md:col-span-4 space-y-1">
                  <label className="block text-[11px] font-bold text-[#FFFFFF] uppercase tracking-wider">
                    NCRP Complaint ID
                  </label>
                  <input
                    type="text"
                    value={ncrpComplaintId}
                    onChange={(e) => setNcrpComplaintId(e.target.value)}
                    placeholder="e.g. NCRP-2026-994821"
                    className="w-full px-3.5 py-2.5 bg-[#1A1A1A] border border-[#2A2A2A] focus:border-[#E5FF8F] rounded-full text-[#FFFFFF] placeholder-[#666666] font-mono text-xs focus:outline-none transition-colors"
                  />
                </div>
              </div>

              {/* Priority, Victim Loss & Traversal Depth */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="space-y-1">
                  <label className="block text-[11px] font-bold text-[#FFFFFF] uppercase tracking-wider">
                    Case Priority
                  </label>
                  <select
                    value={priority}
                    onChange={(e) => setPriority(e.target.value as any)}
                    className="w-full px-3.5 py-2.5 bg-[#1A1A1A] border border-[#2A2A2A] focus:border-[#E5FF8F] rounded-full text-[#FFFFFF] text-xs focus:outline-none"
                  >
                    <option value="CRITICAL">CRITICAL (Active Off-Ramp)</option>
                    <option value="HIGH">HIGH (Major Loss)</option>
                    <option value="MEDIUM">MEDIUM (Standard Queue)</option>
                    <option value="LOW">LOW (Informational)</option>
                  </select>
                </div>

                <div className="space-y-1">
                  <label className="block text-[11px] font-bold text-[#FFFFFF] uppercase tracking-wider">
                    Reported Victim Loss (INR ₹)
                  </label>
                  <input
                    type="number"
                    value={victimLossInr}
                    onChange={(e) => setVictimLossInr(Number(e.target.value))}
                    className="w-full px-3.5 py-2.5 bg-[#1A1A1A] border border-[#2A2A2A] focus:border-[#E5FF8F] rounded-full text-[#FFFFFF] font-mono text-xs focus:outline-none"
                  />
                </div>

                <div className="space-y-1">
                  <label className="block text-[11px] font-bold text-[#FFFFFF] uppercase tracking-wider">
                    Traversal Depth (Max Hops)
                  </label>
                  <select
                    value={maxDepth}
                    onChange={(e) => setMaxDepth(Number(e.target.value))}
                    className="w-full px-3.5 py-2.5 bg-[#1A1A1A] border border-[#2A2A2A] focus:border-[#E5FF8F] rounded-full text-[#FFFFFF] text-xs focus:outline-none"
                  >
                    <option value={1}>1 Hop (Direct Interactions)</option>
                    <option value={2}>2 Hops (Layering Intermediaries)</option>
                    <option value={3}>3 Hops (Standard Audit Traversal)</option>
                    <option value={4}>4 Hops (Deep Penetration)</option>
                    <option value={6}>6 Hops (Exhaustive Trace)</option>
                  </select>
                </div>
              </div>

              {/* Case Brief Notes */}
              <div className="space-y-1">
                <label className="block text-[11px] font-bold text-[#FFFFFF] uppercase tracking-wider">
                  Investigative Narrative &amp; Case Notes
                </label>
                <textarea
                  rows={2}
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Provide incident context, complainant details, or specific exchange off-ramp hypotheses..."
                  className="w-full px-3.5 py-2.5 bg-[#1A1A1A] border border-[#2A2A2A] focus:border-[#E5FF8F] rounded-xl text-[#FFFFFF] placeholder-[#666666] text-xs focus:outline-none"
                />
              </div>

              {/* Action Buttons */}
              <div className="pt-2 flex items-center justify-end space-x-3">
                <button
                  type="button"
                  onClick={onClose}
                  className="px-4 py-2 bg-[#1A1A1A] hover:bg-[#252525] text-[#FFFFFF] font-medium rounded-full border border-[#2A2A2A] transition-colors text-xs"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="px-5 py-2 bg-[#E5FF8F] hover:bg-[#EDFFB1] disabled:opacity-50 text-[#0A0A0A] font-bold rounded-full shadow transition-all flex items-center space-x-2 text-xs"
                >
                  {isSubmitting ? (
                    <>
                      <div className="w-3.5 h-3.5 border-2 border-[#0A0A0A] border-t-transparent rounded-full animate-spin" />
                      <span>Creating &amp; Dispatching Trace...</span>
                    </>
                  ) : (
                    <>
                      <span>Open Case &amp; Start Multi-Hop Trace</span>
                      <ArrowRight className="h-4 w-4" />
                    </>
                  )}
                </button>
              </div>
            </form>
          ) : (
            <div className="space-y-4 font-mono">
              {/* File Upload Zone */}
              <div className="p-6 border-2 border-dashed border-[#2A2A2A] rounded-2xl text-center space-y-3 bg-[#1A1A1A] hover:border-[#E5FF8F]/50 transition-colors">
                <div className="mx-auto w-10 h-10 rounded-full bg-[#E5FF8F]/10 border border-[#E5FF8F]/20 flex items-center justify-center text-[#E5FF8F]">
                  <Upload className="h-5 w-5" />
                </div>
                <div className="space-y-1">
                  <p className="text-xs font-bold text-[#FFFFFF]">
                    Drop suspect wallets CSV file here, or browse local disk
                  </p>
                  <p className="text-[11px] text-[#9A9A9A]">
                    Format: <code className="text-[#E5FF8F]">address, chain, label, loss_inr, priority</code>
                  </p>
                </div>
                <div className="flex items-center justify-center gap-3 pt-1">
                  <label className="px-4 py-2 bg-[#E5FF8F] hover:bg-[#EDFFB1] text-[#0A0A0A] rounded-full font-bold cursor-pointer transition-all text-xs shadow-sm">
                    Select CSV File
                    <input
                      type="file"
                      accept=".csv,text/csv"
                      className="hidden"
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (file) handleFileUpload(file);
                      }}
                    />
                  </label>
                  <button
                    type="button"
                    onClick={loadSampleCSV}
                    className="px-4 py-2 bg-[#161616] hover:bg-[#252525] text-[#FFFFFF] border border-[#2A2A2A] rounded-full transition-colors text-xs"
                  >
                    Load Sample LEA Batch CSV
                  </button>
                </div>
              </div>

              {/* Parsed CSV Preview Table */}
              {csvRecords.length > 0 && (
                <div className="space-y-2">
                  <div className="flex items-center justify-between text-[11px] text-[#9A9A9A]">
                    <span className="font-bold uppercase tracking-wider text-[#FFFFFF]">
                      Parsed Suspect Wallets ({csvRecords.length} records in {csvFileName})
                    </span>
                    <span className="text-[#7CFF6B] font-semibold">
                      {csvRecords.filter((r) => r.status === 'valid').length} valid format
                    </span>
                  </div>

                  <div className="border border-[#2A2A2A] rounded-xl overflow-hidden max-h-64 overflow-y-auto">
                    <table className="w-full text-left text-[11px]">
                      <thead className="bg-[#1A1A1A] text-[#9A9A9A] uppercase text-[10px] border-b border-[#2A2A2A] sticky top-0">
                        <tr>
                          <th className="px-3.5 py-2.5">Status</th>
                          <th className="px-3.5 py-2.5">Wallet Address</th>
                          <th className="px-3.5 py-2.5">Chain</th>
                          <th className="px-3.5 py-2.5">Label / Complaint</th>
                          <th className="px-3.5 py-2.5">Loss (INR)</th>
                          <th className="px-3.5 py-2.5">Priority</th>
                          <th className="px-3.5 py-2.5 text-right">Action</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-[#2A2A2A]">
                        {csvRecords.map((rec) => (
                          <tr key={rec.id} className="hover:bg-[#1A1A1A]/60 transition-colors">
                            <td className="px-3.5 py-2.5">
                              {rec.status === 'valid' ? (
                                <span className="inline-flex items-center space-x-1 text-[#7CFF6B] text-[10px] font-bold">
                                  <CheckCircle2 className="h-3 w-3" />
                                  <span>VALID</span>
                                </span>
                              ) : (
                                <span className="inline-flex items-center space-x-1 text-[#FF5C5C] text-[10px] font-bold">
                                  <AlertCircle className="h-3 w-3" />
                                  <span>ERROR</span>
                                </span>
                              )}
                            </td>
                            <td className="px-3.5 py-2.5 font-mono text-[#FFFFFF] font-bold">
                              {rec.address.slice(0, 8)}...{rec.address.slice(-6)}
                            </td>
                            <td className="px-3.5 py-2.5 uppercase text-[10px] text-[#E5FF8F] font-semibold">
                              {rec.chain}
                            </td>
                            <td className="px-3.5 py-2.5 text-[#9A9A9A] max-w-[150px] truncate">
                              {rec.label}
                            </td>
                            <td className="px-3.5 py-2.5 text-[#FFFFFF] font-mono">
                              ₹{(rec.victim_loss_inr || 0).toLocaleString('en-IN')}
                            </td>
                            <td className="px-3.5 py-2.5">
                              <span className={`text-[9px] px-2 py-0.5 rounded-full font-bold uppercase ${rec.priority === 'CRITICAL' || rec.priority === 'HIGH' ? 'bg-[#FF5C5C]/10 text-[#FF5C5C] border border-[#FF5C5C]/30' : 'bg-[#E5FF8F]/10 text-[#E5FF8F] border border-[#E5FF8F]/20'
                                }`}>
                                {rec.priority}
                              </span>
                            </td>
                            <td className="px-3.5 py-2.5 text-right">
                              <button
                                onClick={() => handleTraceRecord(rec)}
                                className="px-3 py-1 rounded-full bg-[#E5FF8F] text-[#0A0A0A] hover:bg-[#EDFFB1] transition-colors text-[10px] font-bold"
                              >
                                Select &amp; Trace →
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
