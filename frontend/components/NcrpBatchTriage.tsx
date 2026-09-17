'use client';

import React, { useState, useRef, useEffect } from 'react';
import {
  UploadCloud,
  FileSpreadsheet,
  Download,
  AlertOctagon,
  ShieldCheck,
  ArrowRight,
  Filter,
  Copy,
  Check,
  RefreshCw,
  TrendingUp,
  AlertTriangle
} from 'lucide-react';
import { api } from '../lib/api';

interface NcrpBatchTriageProps {
  onSelectCase: (walletAddress: string, maxHops: number) => void;
}

export const NcrpBatchTriage: React.FC<NcrpBatchTriageProps> = ({ onSelectCase }) => {
  const [file, setFile] = useState<File | null>(null);
  const [isUploading, setIsUploading] = useState<boolean>(false);
  const [batchId, setBatchId] = useState<string | null>(null);
  const [batchStatus, setBatchStatus] = useState<any | null>(null);
  const [triagedResults, setTriagedResults] = useState<any[]>([]);
  const [priorityFilter, setPriorityFilter] = useState<string>('ALL');
  const [copiedAddress, setCopiedAddress] = useState<string | null>(null);
  const [dragOver, setDragOver] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const pollTimerRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    return () => {
      if (pollTimerRef.current) clearInterval(pollTimerRef.current);
    };
  }, []);

  const handleDownloadTemplate = () => {
    const csvContent =
      "Acknowledgement_Number,Complainant_Name,Incident_Date,Defrauded_Amount_INR,Suspect_Crypto_Address,Crime_Subcategory\n" +
      "NCRP-2026-908123,Ramesh Kumar,2026-06-12,1850000,0x28c6c06298d514db089934071355e5743bf21d60,Part-Time Telegram Task Scam\n" +
      "NCRP-2026-908124,Priya Sharma,2026-06-14,750000,0x53d28326dda7303e43b2b2158be0c71a0447fb9c,Digital Arrest Impersonation\n" +
      "NCRP-2026-908125,Amit Verma,2026-06-15,3500000,0x0d0707963952f2fba59dd06f2b425ace40b492fe,Forex Investment Trading App\n" +
      "NCRP-2026-908126,Sunil Rao,2026-06-15,450000,0x2b5ad5c4795c026514f8317c7a215e218dccd6cf,FedEx Parcel Extortion\n" +
      "NCRP-2026-908127,Deepak Nair,2026-06-15,1200000,0x742d35cc6634c0532925a3b844bc454e4438f44e,Crypto Ponzi Scheme\n";

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', 'NCRP_1930_Complaints_Template.csv');
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setFile(e.target.files[0]);
      setError(null);
    }
  };

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setDragOver(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      const droppedFile = e.dataTransfer.files[0];
      if (!droppedFile.name.endsWith('.csv')) {
        setError('Please upload a valid .CSV file exported from NCRP / I4C.');
        return;
      }
      setFile(droppedFile);
      setError(null);
    }
  };

  const handleUploadAndTriage = async () => {
    if (!file) {
      setError('Please select or drop an NCRP CSV file first.');
      return;
    }

    try {
      setIsUploading(true);
      setError(null);
      const res = await api.uploadNcrpCsvBatchTriage(file);
      setBatchId(res.batch_id);

      // Start polling status
      pollBatchStatus(res.batch_id);
    } catch (err: any) {
      console.error('Failed uploading NCRP batch:', err);
      setError(err.message || 'Error occurred while processing batch triage.');
      setIsUploading(false);
    }
  };

  const pollBatchStatus = (id: string) => {
    if (pollTimerRef.current) clearInterval(pollTimerRef.current);

    pollTimerRef.current = setInterval(async () => {
      try {
        const statusRes = await api.getNcrpBatchStatus(id);
        setBatchStatus(statusRes);

        if (statusRes.status === 'COMPLETED') {
          if (pollTimerRef.current) clearInterval(pollTimerRef.current);
          setIsUploading(false);
          const resultsRes = await api.getNcrpBatchResults(id);
          setTriagedResults(resultsRes.complaints || []);
        } else if (statusRes.status === 'FAILED') {
          if (pollTimerRef.current) clearInterval(pollTimerRef.current);
          setIsUploading(false);
          setError('Batch triage failed during flight-risk evaluation.');
        }
      } catch (pollErr: any) {
        console.warn('Error polling batch status:', pollErr);
      }
    }, 1500);
  };

  const handleCopy = (addr: string) => {
    navigator.clipboard.writeText(addr);
    setCopiedAddress(addr);
    setTimeout(() => setCopiedAddress(null), 2000);
  };

  const handleExportTriagedCsv = () => {
    if (triagedResults.length === 0) return;

    const headers = [
      "Complaint_ID",
      "Complainant_Name",
      "Priority_Tier",
      "Flight_Risk_Score",
      "Defrauded_INR",
      "Identified_VASP",
      "Target_Wallet",
      "Chain",
      "Recommended_Action"
    ];

    const rows = triagedResults.map(r => [
      r.complaint_id,
      `"${r.complainant_name || ''}"`,
      r.priority_tier,
      r.flight_risk_score,
      r.defrauded_amount_inr,
      `"${r.target_vasp || ''}"`,
      r.suspect_crypto_address,
      r.chain,
      `"${r.recommended_action || ''}"`
    ]);

    const csvContent = [headers.join(','), ...rows.map(e => e.join(','))].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `NCRP_Triaged_Batch_${batchId || 'Export'}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const filteredResults = triagedResults.filter(
    r => priorityFilter === 'ALL' || r.priority_tier === priorityFilter
  );

  const criticalCount = triagedResults.filter(r => r.priority_tier === 'CRITICAL').length;
  const highCount = triagedResults.filter(r => r.priority_tier === 'HIGH').length;
  const totalInr = triagedResults.reduce((sum, r) => sum + (r.defrauded_amount_inr || 0), 0);

  return (
    <div className="space-y-4 font-mono text-xs">
      {/* Upload Zone & Batch Control Card */}
      <div className="bg-[#161616] border border-[#2A2A2A] rounded-2xl p-5 shadow-sm space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#2A2A2A] pb-4">
          <div>
            <div className="flex items-center space-x-2">
              <FileSpreadsheet className="h-4 w-4 text-[#E5FF8F]" />
              <h2 className="font-bold text-[#FFFFFF] uppercase text-xs tracking-wider">
                NCRP 1930 Bulk CSV Batch Triage &amp; Golden-Hour Scoring
              </h2>
            </div>
            <p className="text-[11px] text-[#9A9A9A] font-sans mt-0.5">
              Automated high-throughput flight-risk evaluation: Indian FIU VASPs, International CEXs &amp; Instant Swaps
            </p>
          </div>

          <div className="flex items-center space-x-2">
            <button
              onClick={handleDownloadTemplate}
              className="flex items-center space-x-1.5 px-3 py-1.5 bg-[#1A1A1A] hover:bg-[#252525] text-[#E5FF8F] border border-[#2A2A2A] rounded-full text-[11px] transition-colors font-bold"
            >
              <Download className="h-3.5 w-3.5 text-[#E5FF8F]" />
              <span>Download CSV Template</span>
            </button>
          </div>
        </div>

        {/* Drag and Drop Zone */}
        <div
          onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
          onDragLeave={() => setDragOver(false)}
          onDrop={handleDrop}
          onClick={() => fileInputRef.current?.click()}
          className={`border-2 border-dashed rounded-2xl p-6 text-center cursor-pointer transition-all ${dragOver
            ? 'border-[#E5FF8F] bg-[#E5FF8F]/10'
            : 'border-[#2A2A2A] hover:border-[#E5FF8F]/60 bg-[#1A1A1A]/50'
            }`}
        >
          <input
            type="file"
            ref={fileInputRef}
            onChange={handleFileChange}
            accept=".csv"
            className="hidden"
          />
          <UploadCloud className="h-8 w-8 mx-auto text-[#E5FF8F] mb-2" />
          <p className="text-xs font-bold text-[#FFFFFF]">
            {file ? file.name : 'Drop NCRP 1930 / I4C CSV export file here or click to browse'}
          </p>
          <p className="text-[10px] text-[#9A9A9A] mt-1 font-sans">
            Supported columns: Acknowledgement_Number, Complainant_Name, Defrauded_Amount_INR, Suspect_Crypto_Address, Crime_Subcategory
          </p>
        </div>

        {/* Action Bar */}
        <div className="flex flex-wrap items-center justify-between gap-3 pt-1">
          <div className="text-[11px] text-[#9A9A9A]">
            {file && (
              <span>Selected: <strong className="text-[#FFFFFF]">{file.name}</strong> ({(file.size / 1024).toFixed(1)} KB)</span>
            )}
          </div>

          <button
            onClick={handleUploadAndTriage}
            disabled={!file || isUploading}
            className={`flex items-center space-x-2 px-5 py-2 rounded-full font-bold text-xs transition-all ${!file || isUploading
              ? 'bg-[#1A1A1A] text-[#666666] border border-[#2A2A2A] cursor-not-allowed'
              : 'bg-[#E5FF8F] hover:bg-[#d8f575] text-[#0A0A0A] shadow-sm'
              }`}
          >
            {isUploading ? (
              <>
                <RefreshCw className="h-3.5 w-3.5 animate-spin" />
                <span>Evaluating Flight Risk...</span>
              </>
            ) : (
              <>
                <TrendingUp className="h-3.5 w-3.5" />
                <span>Run Batch Flight-Risk Triage</span>
              </>
            )}
          </button>
        </div>

        {/* Error Alert */}
        {error && (
          <div className="p-3 bg-[#FF5C5C]/10 border border-[#FF5C5C]/30 rounded-xl text-[#FF5C5C] text-xs flex items-center space-x-2">
            <AlertTriangle className="h-4 w-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {/* Live Progress Bar when Processing */}
        {batchStatus && batchStatus.status === 'PROCESSING' && (
          <div className="space-y-1.5 p-3.5 bg-[#1A1A1A] border border-[#2A2A2A] rounded-xl">
            <div className="flex items-center justify-between text-[11px]">
              <span className="text-[#E5FF8F] font-bold flex items-center space-x-1.5">
                <RefreshCw className="h-3 w-3 animate-spin" />
                <span>Triaging batch {batchStatus.batch_id}...</span>
              </span>
              <span className="text-[#9A9A9A] font-bold">
                {batchStatus.processed_complaints} / {batchStatus.total_complaints} ({batchStatus.progress_percent}%)
              </span>
            </div>
            <div className="w-full bg-[#161616] h-2 rounded-full overflow-hidden border border-[#2A2A2A]">
              <div
                className="bg-[#E5FF8F] h-full transition-all duration-300"
                style={{ width: `${batchStatus.progress_percent}%` }}
              />
            </div>
          </div>
        )}
      </div>

      {/* Summary KPI Cards when Results Available */}
      {triagedResults.length > 0 && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <div className="bg-[#161616] border border-[#2A2A2A] rounded-2xl p-4 space-y-1 shadow-sm">
            <span className="text-[10px] text-[#9A9A9A] uppercase block font-bold">Total Complaints</span>
            <div className="text-base font-bold text-[#FFFFFF]">{triagedResults.length} Cases</div>
            <span className="text-[9px] text-[#666666] font-mono">Ref: {batchId?.slice(0, 8)}</span>
          </div>

          <div className="bg-[#161616] border border-[#FF5C5C]/30 rounded-2xl p-4 space-y-1 shadow-sm">
            <span className="text-[10px] text-[#FF5C5C] uppercase font-bold block flex items-center space-x-1">
              <AlertOctagon className="h-3 w-3" />
              <span>Critical Freeze Targets</span>
            </span>
            <div className="text-base font-bold text-[#FF5C5C]">{criticalCount} Wallets</div>
            <span className="text-[9px] text-[#9A9A9A] font-sans">Indian FIU Registered VASPs</span>
          </div>

          <div className="bg-[#161616] border border-[#E5D34F]/30 rounded-2xl p-4 space-y-1 shadow-sm">
            <span className="text-[10px] text-[#E5D34F] uppercase font-bold block">High Priority Off-Ramps</span>
            <div className="text-base font-bold text-[#E5D34F]">{highCount} Wallets</div>
            <span className="text-[9px] text-[#9A9A9A] font-sans">Foreign CEX / Instant Swaps</span>
          </div>

          <div className="bg-[#161616] border border-[#7CFF6B]/30 rounded-2xl p-4 space-y-1 shadow-sm">
            <span className="text-[10px] text-[#7CFF6B] uppercase font-bold block">Total Reported Loss</span>
            <div className="text-base font-bold text-[#7CFF6B]">₹{totalInr.toLocaleString('en-IN')}</div>
            <span className="text-[9px] text-[#9A9A9A] font-sans">Combined Cyber Defraudment</span>
          </div>
        </div>
      )}

      {/* Priority Table */}
      {triagedResults.length > 0 && (
        <div className="bg-[#161616] border border-[#2A2A2A] rounded-2xl shadow-sm overflow-hidden">
          <div className="p-4 border-b border-[#2A2A2A] bg-[#1A1A1A] flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center space-x-2">
              <ShieldCheck className="h-4 w-4 text-[#E5FF8F]" />
              <h3 className="font-bold text-[#FFFFFF] uppercase text-xs">
                Triaged Complaints Priority Queue ({filteredResults.length})
              </h3>
            </div>

            <div className="flex items-center space-x-2">
              <div className="flex items-center space-x-1">
                <Filter className="h-3 w-3 text-[#9A9A9A]" />
                <select
                  value={priorityFilter}
                  onChange={(e) => setPriorityFilter(e.target.value)}
                  className="bg-[#161616] border border-[#2A2A2A] text-[#FFFFFF] text-[11px] rounded-full px-3 py-1 font-mono focus:outline-none"
                >
                  <option value="ALL">All Priority Tiers</option>
                  <option value="CRITICAL">🔴 Critical (Urgent Freeze)</option>
                  <option value="HIGH">🟡 High (Active Trace)</option>
                  <option value="MEDIUM">🔵 Medium (Transit)</option>
                  <option value="COLD">⚪ Cold / Inactive</option>
                </select>
              </div>

              <button
                onClick={handleExportTriagedCsv}
                className="flex items-center space-x-1.5 px-3 py-1 bg-[#1A1A1A] hover:bg-[#252525] text-[#7CFF6B] border border-[#2A2A2A] rounded-full text-[11px] transition-colors font-bold"
              >
                <Download className="h-3 w-3 text-[#7CFF6B]" />
                <span>Export Triaged CSV</span>
              </button>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="border-b border-[#2A2A2A] bg-[#1A1A1A]/80 text-[10px] uppercase font-mono tracking-wider text-[#9A9A9A]">
                  <th className="py-3 px-4">Priority Tier</th>
                  <th className="py-3 px-4">Flight Score</th>
                  <th className="py-3 px-4">Complaint Ref</th>
                  <th className="py-3 px-4">Complainant / Typology</th>
                  <th className="py-3 px-4 text-right">Defrauded Loss</th>
                  <th className="py-3 px-4">Suspect Target Wallet</th>
                  <th className="py-3 px-4">Identified VASP</th>
                  <th className="py-3 px-4">Recommended Action</th>
                  <th className="py-3 px-4 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#2A2A2A] font-mono text-[11px]">
                {filteredResults.map((item, idx) => (
                  <tr key={idx} className="hover:bg-[#1A1A1A]/60 transition-colors">
                    {/* Priority Tier */}
                    <td className="py-3 px-4">
                      <span className={`px-2.5 py-0.5 rounded-full font-bold text-[9px] uppercase border ${item.priority_tier === 'CRITICAL'
                        ? 'bg-[#FF5C5C]/15 text-[#FF5C5C] border-[#FF5C5C]/30'
                        : item.priority_tier === 'HIGH'
                          ? 'bg-[#E5D34F]/15 text-[#E5D34F] border-[#E5D34F]/30'
                          : item.priority_tier === 'MEDIUM'
                            ? 'bg-[#E5FF8F]/15 text-[#E5FF8F] border-[#E5FF8F]/30'
                            : 'bg-[#1A1A1A] text-[#9A9A9A] border-[#2A2A2A]'
                        }`}>
                        {item.priority_tier === 'CRITICAL' ? '🔴 URGENT FREEZE' : item.priority_tier === 'HIGH' ? '🟡 ACTIVE TRACE' : item.priority_tier}
                      </span>
                    </td>

                    {/* Flight Score */}
                    <td className="py-3 px-4 font-bold text-[#FFFFFF]">
                      <div className="flex items-center space-x-1.5">
                        <span className={item.flight_risk_score >= 90 ? 'text-[#FF5C5C]' : item.flight_risk_score >= 70 ? 'text-[#E5D34F]' : 'text-[#E5FF8F]'}>
                          {item.flight_risk_score}/100
                        </span>
                      </div>
                    </td>

                    {/* Complaint Ref */}
                    <td className="py-3 px-4 font-bold text-[#E5FF8F] truncate max-w-[130px]">
                      {item.complaint_id}
                    </td>

                    {/* Complainant */}
                    <td className="py-3 px-4">
                      <div className="font-semibold text-[#FFFFFF] truncate max-w-[140px]">
                        {item.complainant_name || 'Anonymous'}
                      </div>
                      <div className="text-[10px] text-[#9A9A9A] truncate max-w-[140px]">
                        {item.crime_subcategory || 'Cyber Financial Fraud'}
                      </div>
                    </td>

                    {/* Loss */}
                    <td className="py-3 px-4 text-right font-bold text-[#7CFF6B]">
                      ₹{(item.defrauded_amount_inr || 0).toLocaleString('en-IN')}
                    </td>

                    {/* Suspect Wallet */}
                    <td className="py-3 px-4">
                      <div className="flex items-center space-x-1.5">
                        <span className="text-[#FFFFFF] font-bold font-mono">
                          {item.suspect_crypto_address.slice(0, 6)}...{item.suspect_crypto_address.slice(-4)}
                        </span>
                        <button
                          onClick={() => handleCopy(item.suspect_crypto_address)}
                          className="p-0.5 text-[#9A9A9A] hover:text-[#FFFFFF]"
                          title="Copy address"
                        >
                          {copiedAddress === item.suspect_crypto_address ? (
                            <Check className="h-3 w-3 text-[#7CFF6B]" />
                          ) : (
                            <Copy className="h-3 w-3" />
                          )}
                        </button>
                      </div>
                      <span className="text-[9px] uppercase text-[#E5FF8F] font-semibold">
                        {item.chain || 'ethereum'}
                      </span>
                    </td>

                    {/* Identified VASP */}
                    <td className="py-3 px-4">
                      <div className="font-bold text-[#FFFFFF]">
                        {item.target_vasp || 'Unknown Custody'}
                      </div>
                      {item.vasp_type && (
                        <span className="text-[9px] px-2 py-0.5 rounded-full bg-[#1A1A1A] text-[#9A9A9A] border border-[#2A2A2A] uppercase">
                          {item.vasp_type}
                        </span>
                      )}
                    </td>

                    {/* Recommended Action */}
                    <td className="py-3 px-4 text-[11px] text-[#9A9A9A] max-w-[180px]">
                      {item.recommended_action || 'Proceed with on-chain tracing'}
                    </td>

                    {/* Action Button */}
                    <td className="py-3 px-4 text-right">
                      <button
                        onClick={() => onSelectCase(item.suspect_crypto_address, 3)}
                        className="px-3.5 py-1.5 bg-[#E5FF8F] hover:bg-[#d8f575] text-[#0A0A0A] font-bold rounded-full text-[10px] transition-all shadow-sm flex items-center space-x-1 ml-auto"
                      >
                        <span>Escalate to Canvas</span>
                        <ArrowRight className="h-3 w-3" />
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
  );
};
