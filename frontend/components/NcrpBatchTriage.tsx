'use client';

import React, { useState, useRef, useEffect } from 'react';
import {
  UploadCloud,
  FileSpreadsheet,
  Download,
  AlertOctagon,
  ShieldCheck,
  CheckCircle2,
  Clock,
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
      setError(err.message || 'Failed to upload and submit batch for triage.');
      setIsUploading(false);
    }
  };

  const pollBatchStatus = (id: string) => {
    if (pollTimerRef.current) clearInterval(pollTimerRef.current);

    pollTimerRef.current = setInterval(async () => {
      try {
        const statusRes = await api.getNcrpBatchStatus(id);
        setBatchStatus(statusRes);

        if (statusRes.status === 'COMPLETED' || statusRes.status === 'PARTIAL_SUCCESS') {
          if (pollTimerRef.current) clearInterval(pollTimerRef.current);
          setIsUploading(false);
          // Fetch full results
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
      <div className="bg-forensic-surface border border-forensic-border rounded p-4 shadow-sm space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-forensic-border pb-3">
          <div>
            <div className="flex items-center space-x-2">
              <FileSpreadsheet className="h-4 w-4 text-forensic-amber" />
              <h2 className="font-bold text-forensic-text uppercase text-xs tracking-wider">
                NCRP 1930 Bulk CSV Batch Triage &amp; Golden-Hour Scoring
              </h2>
            </div>
            <p className="text-[10px] text-forensic-textDim font-sans mt-0.5">
              Automated high-throughput flight-risk evaluation: Indian FIU VASPs, International CEXs &amp; Instant Swaps
            </p>
          </div>

          <div className="flex items-center space-x-2">
            <button
              onClick={handleDownloadTemplate}
              className="flex items-center space-x-1.5 px-3 py-1.5 bg-forensic-surfaceRaised hover:bg-forensic-border text-forensic-text border border-forensic-border rounded text-[11px] transition-colors"
            >
              <Download className="h-3.5 w-3.5 text-blue-400" />
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
          className={`border-2 border-dashed rounded-lg p-6 text-center cursor-pointer transition-all ${
            dragOver
              ? 'border-blue-500 bg-blue-500/10'
              : 'border-forensic-border hover:border-forensic-textDim bg-forensic-bg/60'
          }`}
        >
          <input
            type="file"
            ref={fileInputRef}
            onChange={handleFileChange}
            accept=".csv"
            className="hidden"
          />
          <UploadCloud className="h-8 w-8 mx-auto text-blue-400 mb-2" />
          <p className="text-xs font-bold text-forensic-text">
            {file ? file.name : 'Drop NCRP 1930 / I4C CSV export file here or click to browse'}
          </p>
          <p className="text-[10px] text-forensic-textDim mt-1 font-sans">
            Supported columns: Acknowledgement_Number, Complainant_Name, Defrauded_Amount_INR, Suspect_Crypto_Address, Crime_Subcategory
          </p>
        </div>

        {/* Action Bar */}
        <div className="flex flex-wrap items-center justify-between gap-3 pt-1">
          <div className="text-[11px] text-forensic-textDim">
            {file && (
              <span>Selected: <strong className="text-forensic-text">{file.name}</strong> ({(file.size / 1024).toFixed(1)} KB)</span>
            )}
          </div>

          <button
            onClick={handleUploadAndTriage}
            disabled={!file || isUploading}
            className={`flex items-center space-x-2 px-4 py-2 rounded font-bold text-xs transition-colors ${
              !file || isUploading
                ? 'bg-forensic-surfaceRaised text-forensic-textDim border border-forensic-border cursor-not-allowed'
                : 'bg-blue-600 hover:bg-blue-500 text-white shadow-sm'
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
          <div className="p-3 bg-red-500/10 border border-red-500/30 rounded text-red-400 text-xs flex items-center space-x-2">
            <AlertTriangle className="h-4 w-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {/* Live Progress Bar when Processing */}
        {batchStatus && batchStatus.status === 'PROCESSING' && (
          <div className="space-y-1.5 p-3 bg-forensic-bg border border-forensic-border rounded">
            <div className="flex items-center justify-between text-[11px]">
              <span className="text-blue-400 font-bold flex items-center space-x-1.5">
                <RefreshCw className="h-3 w-3 animate-spin" />
                <span>Triaging batch {batchStatus.batch_id}...</span>
              </span>
              <span className="text-forensic-textDim font-bold">
                {batchStatus.processed_complaints} / {batchStatus.total_complaints} ({batchStatus.progress_percent}%)
              </span>
            </div>
            <div className="w-full bg-forensic-surfaceRaised h-2 rounded-full overflow-hidden border border-forensic-border">
              <div
                className="bg-blue-500 h-full transition-all duration-300"
                style={{ width: `${batchStatus.progress_percent}%` }}
              />
            </div>
          </div>
        )}
      </div>

      {/* Summary KPI Cards when Results Available */}
      {triagedResults.length > 0 && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <div className="bg-forensic-surface border border-forensic-border rounded p-3 space-y-1">
            <span className="text-[10px] text-forensic-textDim uppercase block">Total Complaints</span>
            <div className="text-base font-bold text-forensic-text">{triagedResults.length} Cases</div>
            <span className="text-[9px] text-forensic-textDim font-sans">Batch Ref: {batchId?.slice(0, 8)}</span>
          </div>

          <div className="bg-forensic-surface border border-red-500/30 rounded p-3 space-y-1 bg-red-500/5">
            <span className="text-[10px] text-red-400 uppercase font-bold block flex items-center space-x-1">
              <AlertOctagon className="h-3 w-3" />
              <span>Critical Freeze Targets</span>
            </span>
            <div className="text-base font-bold text-red-400">{criticalCount} Wallets</div>
            <span className="text-[9px] text-forensic-textDim font-sans">Indian FIU Registered VASPs</span>
          </div>

          <div className="bg-forensic-surface border border-amber-500/30 rounded p-3 space-y-1 bg-amber-500/5">
            <span className="text-[10px] text-amber-400 uppercase font-bold block">High Priority Off-Ramps</span>
            <div className="text-base font-bold text-amber-400">{highCount} Wallets</div>
            <span className="text-[9px] text-forensic-textDim font-sans">Foreign CEX / Instant Swaps</span>
          </div>

          <div className="bg-forensic-surface border border-teal-500/30 rounded p-3 space-y-1 bg-teal-500/5">
            <span className="text-[10px] text-forensic-teal uppercase font-bold block">Total Reported Loss</span>
            <div className="text-base font-bold text-forensic-teal">₹{totalInr.toLocaleString('en-IN')}</div>
            <span className="text-[9px] text-forensic-textDim font-sans">Combined Cyber Defraudment</span>
          </div>
        </div>
      )}

      {/* Priority Table */}
      {triagedResults.length > 0 && (
        <div className="bg-forensic-surface border border-forensic-border rounded shadow-sm overflow-hidden">
          <div className="p-3.5 border-b border-forensic-border bg-forensic-bg flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center space-x-2">
              <ShieldCheck className="h-4 w-4 text-blue-400" />
              <h3 className="font-bold text-forensic-text uppercase text-xs">
                Triaged Complaints Priority Queue ({filteredResults.length})
              </h3>
            </div>

            <div className="flex items-center space-x-2">
              <div className="flex items-center space-x-1">
                <Filter className="h-3 w-3 text-forensic-textDim" />
                <select
                  value={priorityFilter}
                  onChange={(e) => setPriorityFilter(e.target.value)}
                  className="bg-forensic-surfaceRaised border border-forensic-border text-forensic-text text-[11px] rounded px-2 py-1 font-mono focus:outline-none"
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
                className="flex items-center space-x-1.5 px-3 py-1 bg-forensic-surfaceRaised hover:bg-forensic-border text-forensic-text border border-forensic-border rounded text-[11px] transition-colors"
              >
                <Download className="h-3 w-3 text-teal-400" />
                <span>Export Triaged CSV</span>
              </button>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="border-b border-forensic-border bg-forensic-surface text-[10px] uppercase font-mono tracking-wider text-forensic-textDim">
                  <th className="py-2.5 px-3">Priority Tier</th>
                  <th className="py-2.5 px-3">Flight Score</th>
                  <th className="py-2.5 px-3">Complaint Ref</th>
                  <th className="py-2.5 px-3">Complainant / Typology</th>
                  <th className="py-2.5 px-3 text-right">Defrauded Loss</th>
                  <th className="py-2.5 px-3">Suspect Target Wallet</th>
                  <th className="py-2.5 px-3">Identified VASP</th>
                  <th className="py-2.5 px-3">Recommended Action</th>
                  <th className="py-2.5 px-3 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-forensic-border font-mono text-[11px]">
                {filteredResults.map((item, idx) => (
                  <tr key={idx} className="hover:bg-forensic-surfaceRaised/50 transition-colors">
                    {/* Priority Tier */}
                    <td className="py-2.5 px-3">
                      <span className={`px-2 py-0.5 rounded font-bold text-[9px] uppercase border ${
                        item.priority_tier === 'CRITICAL'
                          ? 'bg-red-500/15 text-red-400 border-red-500/30'
                          : item.priority_tier === 'HIGH'
                          ? 'bg-amber-500/15 text-amber-400 border-amber-500/30'
                          : item.priority_tier === 'MEDIUM'
                          ? 'bg-blue-500/15 text-blue-400 border-blue-500/30'
                          : 'bg-slate-500/15 text-slate-400 border-slate-500/30'
                      }`}>
                        {item.priority_tier === 'CRITICAL' ? '🔴 URGENT FREEZE' : item.priority_tier === 'HIGH' ? '🟡 ACTIVE TRACE' : item.priority_tier}
                      </span>
                    </td>

                    {/* Flight Score */}
                    <td className="py-2.5 px-3 font-bold text-forensic-text">
                      <div className="flex items-center space-x-1.5">
                        <span className={item.flight_risk_score >= 90 ? 'text-red-400' : item.flight_risk_score >= 70 ? 'text-amber-400' : 'text-blue-400'}>
                          {item.flight_risk_score}/100
                        </span>
                      </div>
                    </td>

                    {/* Complaint Ref */}
                    <td className="py-2.5 px-3 font-bold text-blue-400 truncate max-w-[130px]">
                      {item.complaint_id}
                    </td>

                    {/* Complainant */}
                    <td className="py-2.5 px-3">
                      <div className="font-semibold text-forensic-text truncate max-w-[140px]">
                        {item.complainant_name || 'Anonymous'}
                      </div>
                      <div className="text-[10px] text-forensic-textDim truncate max-w-[140px]">
                        {item.crime_subcategory || 'Cyber Financial Fraud'}
                      </div>
                    </td>

                    {/* Loss */}
                    <td className="py-2.5 px-3 text-right font-bold text-forensic-teal">
                      ₹{(item.defrauded_amount_inr || 0).toLocaleString('en-IN')}
                    </td>

                    {/* Suspect Wallet */}
                    <td className="py-2.5 px-3">
                      <div className="flex items-center space-x-1.5">
                        <span className="text-forensic-text font-bold">
                          {item.suspect_crypto_address.slice(0, 6)}...{item.suspect_crypto_address.slice(-4)}
                        </span>
                        <button
                          onClick={() => handleCopy(item.suspect_crypto_address)}
                          className="p-0.5 text-forensic-textDim hover:text-forensic-text"
                          title="Copy address"
                        >
                          {copiedAddress === item.suspect_crypto_address ? (
                            <Check className="h-3 w-3 text-teal-400" />
                          ) : (
                            <Copy className="h-3 w-3" />
                          )}
                        </button>
                      </div>
                      <span className="text-[9px] uppercase text-blue-400/80">
                        {item.chain || 'ethereum'}
                      </span>
                    </td>

                    {/* Identified VASP */}
                    <td className="py-2.5 px-3">
                      <div className="font-bold text-forensic-text">
                        {item.target_vasp || 'Unknown Custody'}
                      </div>
                      {item.vasp_type && (
                        <span className="text-[9px] px-1 py-0.2 rounded bg-forensic-surfaceRaised text-forensic-textDim border border-forensic-border uppercase">
                          {item.vasp_type}
                        </span>
                      )}
                    </td>

                    {/* Recommended Action */}
                    <td className="py-2.5 px-3 text-[10px] text-forensic-textDim max-w-[180px]">
                      {item.recommended_action || 'Proceed with on-chain tracing'}
                    </td>

                    {/* Action Button */}
                    <td className="py-2.5 px-3 text-right">
                      <button
                        onClick={() => onSelectCase(item.suspect_crypto_address, 3)}
                        className="px-2.5 py-1 bg-blue-600 hover:bg-blue-500 text-white font-bold rounded text-[10px] transition-colors shadow-sm flex items-center space-x-1 ml-auto"
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
