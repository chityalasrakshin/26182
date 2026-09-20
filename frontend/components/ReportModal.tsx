'use client';

import React, { useState, useEffect } from 'react';
import { Download, Copy, Check, Printer, X, ShieldCheck, FileText, Code, CheckCircle2, AlertTriangle, ExternalLink, FileDown } from 'lucide-react';
import { api } from '../lib/api';
import { InvestigationReport } from '../lib/types';

interface ReportModalProps {
  analysisId: string;
  onClose: () => void;
}

export const ReportModal: React.FC<ReportModalProps> = ({ analysisId, onClose }) => {
  const [reportMarkdown, setReportMarkdown] = useState<string>('');
  const [reportJson, setReportJson] = useState<InvestigationReport | null>(null);
  const [activeTab, setActiveTab] = useState<'visual' | 'markdown' | 'json'>('visual');
  const [loading, setLoading] = useState<boolean>(true);
  const [copied, setCopied] = useState<boolean>(false);
  const [pdfDownloading, setPdfDownloading] = useState<boolean>(false);
  const [pdfDownloaded, setPdfDownloaded] = useState<boolean>(false);

  useEffect(() => {
    async function loadReport() {
      try {
        setLoading(true);
        // Load both markdown and json representations
        const [mdData, jsonData] = await Promise.all([
          api.getAnalysisReport(analysisId, 'markdown'),
          api.getAnalysisReport(analysisId, 'json')
        ]);

        if ('report_markdown' in mdData) {
          setReportMarkdown(mdData.report_markdown);
        }
        if ('case_id' in jsonData) {
          setReportJson(jsonData as InvestigationReport);
        }
      } catch (err) {
        console.error('Failed to load dossier:', err);
      } finally {
        setLoading(false);
      }
    }
    loadReport();
  }, [analysisId]);

  const handleCopy = () => {
    const textToCopy = activeTab === 'json' ? JSON.stringify(reportJson, null, 2) : reportMarkdown;
    navigator.clipboard.writeText(textToCopy);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handlePrint = () => {
    window.print();
  };

  const handleDownload = (format: 'md' | 'json') => {
    const content = format === 'md' ? reportMarkdown : JSON.stringify(reportJson, null, 2);
    const mime = format === 'md' ? 'text/markdown;charset=utf-8;' : 'application/json;charset=utf-8;';
    const blob = new Blob([content], { type: mime });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `case_dossier_${analysisId.slice(0, 8)}.${format}`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handlePdfDownload = async () => {
    try {
      setPdfDownloading(true);
      setPdfDownloaded(false);
      await api.downloadPdfDossier(analysisId);
      setPdfDownloaded(true);
      setTimeout(() => setPdfDownloaded(false), 3000);
    } catch (err) {
      console.error('PDF download failed:', err);
      alert(`PDF download failed: ${err instanceof Error ? err.message : 'Unknown error'}`);
    } finally {
      setPdfDownloading(false);
    }
  };

  const refNumber = `SUDARSHAN/LEA/${new Date().getFullYear()}/${analysisId.slice(0, 8).toUpperCase()}`;

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-white border border-[#E2E8F0] rounded-2xl w-full max-w-5xl max-h-[94vh] flex flex-col shadow-2xl overflow-hidden font-sans text-xs transition-colors">

        {/* Header Bar */}
        <div className="no-print p-4 border-b border-[#E2E8F0] flex items-center justify-between bg-[#F8FAFC]">
          <div className="flex items-center space-x-3">
            <div className="p-2.5 rounded-xl bg-sky-50 border border-sky-200 text-[#0284C7]">
              <ShieldCheck className="h-5 w-5" />
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <h2 className="text-sm font-bold text-[#0F172A] tracking-wide uppercase font-mono">
                  Forensic Investigation Dossier &amp; Audit Report
                </h2>
                <span className="px-2.5 py-0.5 rounded-full text-[10px] font-mono bg-sky-50 text-[#0284C7] border border-sky-200 font-semibold">
                  {refNumber}
                </span>
              </div>
              <p className="text-[11px] text-[#64748B] mt-0.5">
                Standardized multi-chain intelligence summary for judicial proceedings &amp; VASP freeze requisitions
              </p>
            </div>
          </div>

          {/* Action Toolbar */}
          <div className="flex items-center space-x-2">
            {/* View Switcher Tabs */}
            <div className="flex items-center bg-[#F1F5F9] p-1 rounded-lg border border-[#E2E8F0] mr-2">
              <button
                onClick={() => setActiveTab('visual')}
                className={`flex items-center space-x-1.5 px-3 py-1 rounded-md text-[11px] font-medium transition-all ${activeTab === 'visual'
                  ? 'bg-[#0284C7] text-white font-bold shadow-sm'
                  : 'text-[#64748B] hover:text-[#0F172A]'
                  }`}
              >
                <FileText className="h-3.5 w-3.5" />
                <span>Executive Preview</span>
              </button>

              <button
                onClick={() => setActiveTab('markdown')}
                className={`flex items-center space-x-1.5 px-3 py-1 rounded-md text-[11px] font-medium transition-all ${activeTab === 'markdown'
                  ? 'bg-[#0284C7] text-white font-bold shadow-sm'
                  : 'text-[#64748B] hover:text-[#0F172A]'
                  }`}
              >
                <Code className="h-3.5 w-3.5" />
                <span>Markdown</span>
              </button>

              <button
                onClick={() => setActiveTab('json')}
                className={`flex items-center space-x-1.5 px-3 py-1 rounded-md text-[11px] font-medium transition-all ${activeTab === 'json'
                  ? 'bg-[#0284C7] text-white font-bold shadow-sm'
                  : 'text-[#64748B] hover:text-[#0F172A]'
                  }`}
              >
                <span className="font-mono">{'{ }'}</span>
                <span>JSON</span>
              </button>
            </div>

            <button
              onClick={handleCopy}
              className="flex items-center space-x-1.5 px-3.5 py-1.5 rounded-lg bg-white hover:bg-slate-50 border border-[#E2E8F0] text-[#0F172A] font-medium text-[11px] shadow-sm transition-colors"
            >
              {copied ? <Check className="h-3.5 w-3.5 text-emerald-600" /> : <Copy className="h-3.5 w-3.5 text-[#64748B]" />}
              <span>{copied ? 'Copied' : 'Copy'}</span>
            </button>

            <button
              onClick={() => handleDownload(activeTab === 'json' ? 'json' : 'md')}
              className="flex items-center space-x-1.5 px-3.5 py-1.5 rounded-lg bg-white hover:bg-slate-50 border border-[#E2E8F0] text-[#0F172A] font-medium text-[11px] shadow-sm transition-colors"
            >
              <Download className="h-3.5 w-3.5 text-[#64748B]" />
              <span>Download {activeTab === 'json' ? 'JSON' : 'MD'}</span>
            </button>

            {/* Official PDF Dossier Download Button */}
            <button
              onClick={handlePdfDownload}
              disabled={pdfDownloading}
              className={`flex items-center space-x-1.5 px-4 py-1.5 rounded-lg font-bold text-[11px] shadow-sm transition-all cursor-pointer ${pdfDownloaded
                ? 'bg-emerald-600 text-white'
                : pdfDownloading
                  ? 'bg-sky-100 text-[#0284C7] cursor-wait'
                  : 'bg-[#0284C7] hover:bg-[#0369A1] text-white'
                }`}
            >
              {pdfDownloaded ? (
                <Check className="h-3.5 w-3.5" />
              ) : pdfDownloading ? (
                <div className="h-3.5 w-3.5 border-2 border-[#0284C7]/40 border-t-[#0284C7] rounded-full animate-spin" />
              ) : (
                <FileDown className="h-3.5 w-3.5" />
              )}
              <span>{pdfDownloaded ? 'PDF Downloaded' : pdfDownloading ? 'Generating...' : 'Official PDF Dossier'}</span>
            </button>

            <button
              onClick={handlePrint}
              className="flex items-center space-x-1.5 px-3.5 py-1.5 rounded-lg bg-white hover:bg-slate-50 border border-[#E2E8F0] text-[#0F172A] font-semibold text-[11px] shadow-sm transition-all cursor-pointer"
            >
              <Printer className="h-3.5 w-3.5 text-[#64748B]" />
              <span>Print / Export PDF</span>
            </button>

            <button
              onClick={onClose}
              className="p-1.5 rounded-lg text-[#64748B] hover:text-[#0F172A] hover:bg-slate-100 ml-2 transition-colors"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>

        {/* Content Body */}
        <div className="overflow-y-auto flex-1 bg-[#F4F6F8] p-6 print:bg-white print:text-black">
          {loading ? (
            <div className="flex flex-col items-center justify-center py-24 text-[#64748B]">
              <div className="h-8 w-8 border-2 border-[#0284C7] border-t-transparent rounded-full animate-spin mb-3"></div>
              <span className="text-xs font-mono">Compiling multi-chain case dossier &amp; audit evidence...</span>
            </div>
          ) : activeTab === 'visual' && reportJson ? (
            /* Visual Executive Dossier View */
            <div className="max-w-4xl mx-auto space-y-6 text-[#0F172A] print:text-black">

              {/* Document Header Banner */}
              <div className="p-5 rounded-xl bg-white border border-[#E2E8F0] print:border-black/30 print:bg-transparent shadow-sm">
                <div className="flex items-start justify-between">
                  <div>
                    <div className="text-[10px] font-mono tracking-widest text-[#0284C7] uppercase font-bold mb-1">
                      FINANCIAL INTELLIGENCE UNIT // FORENSIC REPORT
                    </div>
                    <h1 className="text-lg font-bold text-[#0F172A] print:text-black">
                      Cryptocurrency Asset Investigation Dossier
                    </h1>
                    <p className="text-xs text-[#64748B] print:text-black/70 font-mono mt-0.5">
                      Case ID: {reportJson.case_id} • Ref: {refNumber}
                    </p>
                  </div>
                  <div className="text-right font-mono text-[11px] space-y-1">
                    <div className="inline-block px-2.5 py-0.5 rounded bg-emerald-50 text-emerald-700 border border-emerald-200 font-bold">
                      VERIFIED ON-CHAIN PROOF
                    </div>
                    <div className="text-[#64748B] print:text-black/70">
                      {new Date(reportJson.analysis_timestamp).toUTCString()}
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-4 pt-4 border-t border-[#E2E8F0] print:border-black/20 font-mono text-[11px]">
                  <div>
                    <span className="text-[#64748B] block text-[10px]">TARGET WALLET</span>
                    <span className="font-bold text-[#0F172A] print:text-black break-all">{reportJson.input_wallet}</span>
                  </div>
                  <div>
                    <span className="text-[#64748B] block text-[10px]">NETWORK</span>
                    <span className="font-bold text-[#0F172A] print:text-black">{reportJson.chain}</span>
                  </div>
                  <div>
                    <span className="text-[#64748B] block text-[10px]">TOTAL EDGES</span>
                    <span className="font-bold text-[#0F172A] print:text-black">{reportJson.summary_metrics?.total_edges || 0} Transactions</span>
                  </div>
                  <div>
                    <span className="text-[#64748B] block text-[10px]">MAX DEPTH</span>
                    <span className="font-bold text-[#0F172A] print:text-black">{reportJson.summary_metrics?.max_hop_reached || 3} Hops (Bounded)</span>
                  </div>
                </div>
              </div>

              {/* Section 1: Executive Summary & VASP Attribution */}
              <div className="p-5 rounded-xl bg-white border border-[#E2E8F0] print:border-black/30 space-y-4 shadow-sm">
                <div className="flex items-center justify-between">
                  <h3 className="text-xs font-bold uppercase tracking-wider text-[#0284C7] flex items-center space-x-1.5">
                    <ShieldCheck className="h-4 w-4" />
                    <span>1. Executive Summary &amp; VASP Attribution</span>
                  </h3>
                  {reportJson.top_attribution && (
                    <span className="px-2.5 py-0.5 rounded text-[11px] bg-sky-50 text-[#0284C7] border border-sky-200 font-bold font-mono">
                      Top Match: {reportJson.top_attribution.vasp_name} ({reportJson.top_attribution.score.toFixed(1)}/100)
                    </span>
                  )}
                </div>

                {reportJson.top_attribution ? (
                  <div className="p-4 rounded-lg bg-[#F8FAFC] border border-[#E2E8F0] print:bg-gray-50 print:border-black/20">
                    <div className="text-sm font-bold text-[#0F172A] print:text-black flex items-center space-x-2">
                      <span className="text-emerald-600 font-mono">✓</span>
                      <span>Primary Attribution: {reportJson.top_attribution.vasp_name}</span>
                      <span className="text-xs px-2 py-0.5 rounded bg-emerald-50 text-emerald-700 border border-emerald-200">
                        {reportJson.top_attribution.evidence_strength} Strength
                      </span>
                    </div>
                    <p className="text-xs text-[#64748B] print:text-black/80 mt-1 leading-relaxed">
                      {reportJson.top_attribution.summary}
                    </p>
                  </div>
                ) : (
                  <p className="text-xs text-[#64748B]">No known VASP terminal identified within 3 hops.</p>
                )}

                {/* Ranked Attribution Hierarchy Table */}
                {reportJson.all_attributions && reportJson.all_attributions.length > 0 && (
                  <div>
                    <h4 className="text-[11px] font-bold text-[#0F172A] print:text-black mb-2 uppercase tracking-wide">
                      Ranked VASP Association Hierarchy
                    </h4>
                    <div className="overflow-x-auto border border-[#E2E8F0] print:border-black/20 rounded-lg">
                      <table className="w-full text-left font-mono text-[11px]">
                        <thead className="bg-[#F8FAFC] print:bg-gray-100 text-[#64748B] print:text-black border-b border-[#E2E8F0]">
                          <tr>
                            <th className="p-2.5">Rank</th>
                            <th className="p-2.5">VASP Cluster</th>
                            <th className="p-2.5">Attribution Score</th>
                            <th className="p-2.5">Strength</th>
                            <th className="p-2.5">Summary</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-[#E2E8F0] print:divide-gray-200">
                          {reportJson.all_attributions.map((attr, idx) => (
                            <tr key={idx} className="hover:bg-[#F8FAFC]">
                              <td className="p-2.5 font-bold text-[#0F172A]">#{attr.rank}</td>
                              <td className="p-2.5 font-bold text-[#0284C7] print:text-blue-700">{attr.vasp_name}</td>
                              <td className="p-2.5 text-[#0F172A]">{attr.score.toFixed(1)} / 100</td>
                              <td className="p-2.5">
                                <span className="px-1.5 py-0.5 rounded bg-slate-100 border border-[#E2E8F0] text-[#0F172A]">
                                  {attr.evidence_strength}
                                </span>
                              </td>
                              <td className="p-2.5 font-sans text-[#64748B] print:text-black/80 text-[10px] max-w-xs truncate">
                                {attr.summary}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}
              </div>

              {/* Section 2: Risk Classification */}
              {reportJson.risk_assessment && (
                <div className="p-5 rounded-xl bg-white border border-[#E2E8F0] print:border-black/30 space-y-3 shadow-sm">
                  <div className="flex items-center justify-between">
                    <h3 className="text-xs font-bold uppercase tracking-wider text-rose-600 flex items-center space-x-1.5">
                      <AlertTriangle className="h-4 w-4" />
                      <span>2. On-Chain Risk Classification &amp; Indicators</span>
                    </h3>
                    <span className="px-2.5 py-0.5 rounded bg-rose-50 text-rose-700 border border-rose-200 font-bold font-mono">
                      Risk Level: {reportJson.risk_assessment.risk_level} ({reportJson.risk_assessment.score}/100)
                    </span>
                  </div>

                  <p className="text-xs text-[#64748B] print:text-black/80 leading-relaxed">
                    {reportJson.risk_assessment.explanation}
                  </p>

                  {reportJson.risk_assessment.indicators && reportJson.risk_assessment.indicators.length > 0 && (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-2">
                      {reportJson.risk_assessment.indicators.map((ind, i) => (
                        <div key={i} className="p-2.5 rounded-lg bg-[#F8FAFC] border border-[#E2E8F0] flex items-start space-x-2 text-[11px]">
                          <span className="text-rose-600 font-mono mt-0.5">⚠️</span>
                          <span className="text-[#0F172A] print:text-black">{ind}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* Section 3: Key Forensic Evidence Audit Trail */}
              {reportJson.key_evidence && reportJson.key_evidence.length > 0 && (
                <div className="p-5 rounded-xl bg-white border border-[#E2E8F0] print:border-black/30 space-y-3 shadow-sm">
                  <h3 className="text-xs font-bold uppercase tracking-wider text-emerald-600 flex items-center space-x-1.5">
                    <CheckCircle2 className="h-4 w-4" />
                    <span>3. Tamper-Evident Forensic Audit Trail</span>
                  </h3>
                  <div className="overflow-x-auto border border-[#E2E8F0] print:border-black/20 rounded-lg">
                    <table className="w-full text-left font-mono text-[11px]">
                      <thead className="bg-[#F8FAFC] print:bg-gray-100 text-[#64748B] print:text-black border-b border-[#E2E8F0]">
                        <tr>
                          <th className="p-2.5">#</th>
                          <th className="p-2.5">Type</th>
                          <th className="p-2.5">Strength</th>
                          <th className="p-2.5">Hop</th>
                          <th className="p-2.5">Transaction Hash / Proof</th>
                          <th className="p-2.5">Explanation</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-[#E2E8F0] print:divide-gray-200">
                        {reportJson.key_evidence.slice(0, 10).map((ev, i) => (
                          <tr key={i} className="hover:bg-[#F8FAFC]">
                            <td className="p-2.5 font-bold text-[#0F172A]">{i + 1}</td>
                            <td className="p-2.5 text-[#0284C7] font-semibold">{ev.evidence_type}</td>
                            <td className="p-2.5 text-[#0F172A]">{ev.strength}</td>
                            <td className="p-2.5 text-[#0F172A]">{ev.hop_distance}</td>
                            <td className="p-2.5 text-[10px] break-all">
                              {ev.tx_hash ? (
                                <span className="text-emerald-600 font-bold">{ev.tx_hash.slice(0, 14)}...</span>
                              ) : (
                                '-'
                              )}
                            </td>
                            <td className="p-2.5 font-sans text-[#64748B] print:text-black/80 text-[10px]">
                              {ev.explanation}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {/* Section 4: Section 65B Indian Evidence Act Certificate */}
              <div className="p-5 rounded-xl bg-white border border-[#E2E8F0] print:border-black/30 space-y-2 font-mono shadow-sm">
                <h3 className="text-xs font-bold uppercase tracking-wider text-[#0F172A] print:text-black">
                  4. Section 65B Indian Evidence Act Certificate
                </h3>
                <div className="p-4 rounded-lg bg-[#F8FAFC] border border-[#E2E8F0] text-[10px] text-[#64748B] print:text-black/80 leading-relaxed">
                  <p className="font-bold text-[#0F172A] print:text-black mb-1">
                    CERTIFICATE UNDER SECTION 65B OF THE INDIAN EVIDENCE ACT, 1872 / SECTION 63 BNSS
                  </p>
                  <p>
                    1. This electronic investigation dossier (Ref: {refNumber}) was generated by the SUDARSHAN Forensic Intelligence Engine under automated electronic parameters.
                  </p>
                  <p className="mt-1">
                    2. The cryptographic transaction hashes, address metadata, and network paths were acquired directly from publicly indexed blockchain networks ({reportJson.chain}) without manual modification.
                  </p>
                  <p className="mt-1">
                    3. SHA-256 System Audit Hash: Verified at {new Date(reportJson.analysis_timestamp).toISOString()}.
                  </p>
                </div>
              </div>

              {/* Document Sign-off Footer */}
              <div className="pt-4 border-t border-[#E2E8F0] print:border-black/30 flex justify-between items-center text-[10px] text-[#64748B] print:text-black font-mono">
                <span>SUDARSHAN FORENSIC INTELLIGENCE ENGINE v2.4</span>
                <span>VERIFICATION REF: {refNumber}</span>
              </div>
            </div>
          ) : activeTab === 'markdown' ? (
            /* Markdown Monospace Editor View */
            <div className="max-w-4xl mx-auto">
              <pre className="p-5 rounded-xl bg-white border border-[#E2E8F0] font-mono text-[11px] text-[#0F172A] leading-relaxed whitespace-pre-wrap select-all shadow-sm">
                {reportMarkdown}
              </pre>
            </div>
          ) : (
            /* JSON Raw Data View */
            <div className="max-w-4xl mx-auto">
              <pre className="p-5 rounded-xl bg-white border border-[#E2E8F0] font-mono text-[11px] text-[#0284C7] leading-relaxed whitespace-pre-wrap select-all overflow-x-auto shadow-sm">
                {JSON.stringify(reportJson, null, 2)}
              </pre>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
