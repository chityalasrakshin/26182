'use client';

import React, { useState, useEffect } from 'react';
import { Scale, Copy, Check, Printer, X, Mail, ShieldCheck, QrCode, FileText, Code, CheckCircle2, Send, AlertTriangle, Download } from 'lucide-react';
import QRCode from 'qrcode';
import { api } from '../lib/api';

interface FreezeNoticeModalProps {
  analysisId: string;
  onClose?: () => void;
  isFullPageView?: boolean;
}

export const FreezeNoticeModal: React.FC<FreezeNoticeModalProps> = ({
  analysisId,
  onClose,
  isFullPageView = false,
}) => {
  const [officerName, setOfficerName] = useState('Inspector R. K. Sharma');
  const [policeStation, setPoliceStation] = useState('Cyber Crime Police Station, CID');
  const [crimeNumber, setCrimeNumber] = useState('NCRP/2026/CYBER-FIN/8842');

  const [noticeData, setNoticeData] = useState<any>(null);
  const [qrDataUrl, setQrDataUrl] = useState<string>('');
  const [activeTab, setActiveTab] = useState<'visual' | 'markdown'>('visual');
  const [loading, setLoading] = useState(true);
  const [copied, setCopied] = useState(false);
  const [dispatchResult, setDispatchResult] = useState<any>(null);
  const [dispatching, setDispatching] = useState(false);
  const [dispatchError, setDispatchError] = useState<string | null>(null);

  const fetchNotice = async () => {
    if (!analysisId) return;
    try {
      setLoading(true);
      const data = await api.getFreezeNotice(analysisId, officerName, policeStation, crimeNumber);
      setNoticeData(data);

      // Generate Verification QR Code
      const verificationPayload = JSON.stringify({
        statutory_authority: 'Section 91 CrPC / Section 94 BNSS',
        ref_no: data.ref_number || `SUDARSHAN/LEA/2026/${analysisId.slice(0, 8)}`,
        target_vasp: data.vasp_name,
        compliance_email: data.compliance_email,
        crime_ack: crimeNumber,
        investigating_officer: officerName,
        police_unit: policeStation,
        verified_tx_count: data.critical_txs?.length || 1,
        timestamp: new Date().toISOString()
      });

      const qrUrl = await QRCode.toDataURL(verificationPayload, {
        width: 140,
        margin: 1,
        color: { dark: '#000000', light: '#ffffff' }
      });
      setQrDataUrl(qrUrl);
    } catch (err) {
      console.error('Failed to fetch freeze notice:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (analysisId) {
      fetchNotice();
    }
  }, [analysisId]);

  const handleCopy = () => {
    if (noticeData?.notice_markdown) {
      navigator.clipboard.writeText(noticeData.notice_markdown);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const handlePrint = () => {
    window.print();
  };

  const handleDispatchSahyog = async () => {
    if (!analysisId) return;
    try {
      setDispatching(true);
      setDispatchError(null);
      const res = await api.dispatchDisclosureRequest(analysisId, {
        officer_name: officerName,
        police_station: policeStation,
        crime_reference: crimeNumber,
        target_vasp: noticeData?.vasp_name,
        urgency: 'CRITICAL_24H'
      });
      setDispatchResult(res);
    } catch (err: any) {
      setDispatchError(err.message || 'Failed to dispatch simulated disclosure request.');
    } finally {
      setDispatching(false);
    }
  };

  const content = (
    <div className={`print-document-container bg-white border border-[#E2E8F0] rounded-2xl w-full flex flex-col font-sans text-xs overflow-hidden transition-colors ${isFullPageView ? 'shadow-sm' : 'max-w-5xl max-h-[94vh] shadow-2xl'
      }`}>
      {/* On-Screen Header (Hidden during Print) */}
      <div className="no-print p-4 border-b border-[#E2E8F0] flex items-center justify-between bg-[#F8FAFC]">
        <div className="flex items-center space-x-3">
          <div className="p-2.5 rounded-xl bg-rose-50 border border-rose-200 text-rose-600">
            <Scale className="h-5 w-5" />
          </div>
          <div>
            <div className="flex items-center space-x-2">
              <h2 className="text-sm font-bold text-[#0F172A] tracking-wide uppercase font-mono">
                Section 91 CrPC / Section 94 BNSS Statutory Freeze Requisition
              </h2>
              <span className="px-2.5 py-0.5 rounded-full text-[10px] font-mono bg-rose-50 text-rose-700 border border-rose-200 font-semibold">
                {noticeData?.ref_number || 'STATUTORY ORDER'}
              </span>
            </div>
            <p className="text-[11px] text-[#64748B] mt-0.5">
              Official legal requisition for immediate asset freezing, KYC disclosure, and Section 65B preservation
            </p>
          </div>
        </div>

        {/* Action Controls */}
        <div className="flex items-center space-x-2">
          {/* Tab switchers */}
          <div className="flex items-center bg-[#F1F5F9] p-1 rounded-lg border border-[#E2E8F0] mr-2">
            <button
              onClick={() => setActiveTab('visual')}
              className={`flex items-center space-x-1.5 px-3 py-1 rounded-md text-[11px] font-medium transition-all ${activeTab === 'visual'
                ? 'bg-[#0284C7] text-white font-bold shadow-sm'
                : 'text-[#64748B] hover:text-[#0F172A]'
                }`}
            >
              <FileText className="h-3.5 w-3.5" />
              <span>Official Order Form</span>
            </button>

            <button
              onClick={() => setActiveTab('markdown')}
              className={`flex items-center space-x-1.5 px-3 py-1 rounded-md text-[11px] font-medium transition-all ${activeTab === 'markdown'
                ? 'bg-[#0284C7] text-white font-bold shadow-sm'
                : 'text-[#64748B] hover:text-[#0F172A]'
                }`}
            >
              <Code className="h-3.5 w-3.5" />
              <span>Plain Text</span>
            </button>
          </div>

          <button
            onClick={handleCopy}
            className="flex items-center space-x-1.5 px-3.5 py-1.5 rounded-lg bg-white hover:bg-slate-50 border border-[#E2E8F0] text-[#0F172A] font-medium text-[11px] shadow-sm transition-colors"
          >
            {copied ? <Check className="h-3.5 w-3.5 text-emerald-600" /> : <Copy className="h-3.5 w-3.5 text-[#64748B]" />}
            <span>{copied ? 'Copied' : 'Copy Notice'}</span>
          </button>

          <button
            onClick={handleDispatchSahyog}
            disabled={dispatching}
            className="flex items-center space-x-1.5 px-3.5 py-1.5 rounded-lg bg-white hover:bg-slate-50 border border-[#E2E8F0] text-[#0284C7] font-bold text-[11px] shadow-sm cursor-pointer transition-colors"
            title="Dispatch lawful disclosure request to external electronic gateway"
          >
            <Send className="h-3.5 w-3.5" />
            <span>{dispatching ? 'Dispatching...' : 'Dispatch SAHYOG Electronic'}</span>
          </button>

          <button
            onClick={handlePrint}
            className="flex items-center space-x-1.5 px-3.5 py-1.5 rounded-lg bg-white hover:bg-slate-50 border border-[#E2E8F0] text-[#0F172A] font-semibold text-[11px] shadow-sm cursor-pointer transition-colors"
          >
            <Printer className="h-3.5 w-3.5 text-[#64748B]" />
            <span>Print Notice</span>
          </button>

          <button
            onClick={async () => {
              try {
                await api.downloadCourtDossier(analysisId, officerName, policeStation);
              } catch (err: any) {
                alert(`Court dossier export failed: ${err.message}`);
              }
            }}
            className="flex items-center space-x-1.5 px-4 py-1.5 rounded-lg bg-[#0284C7] hover:bg-[#0369A1] text-white font-bold text-[11px] shadow-sm cursor-pointer transition-all"
            title="Download full 5-asset court dossier ZIP with Section 91 PDF, Section 65B PDF, Graph Topography SVG, Ledger CSV and SHA-256 manifest"
          >
            <Download className="h-3.5 w-3.5" />
            <span>Court Dossier (.ZIP)</span>
          </button>

          {onClose && (
            <button
              onClick={onClose}
              className="p-1.5 rounded-lg text-[#64748B] hover:text-[#0F172A] hover:bg-slate-100 ml-2 transition-colors"
            >
              <X className="h-4 w-4" />
            </button>
          )}
        </div>
      </div>

      {/* SAHYOG Dispatch Acknowledgment Card */}
      {dispatchResult && (
        <div className="no-print p-3.5 bg-emerald-50 border-b border-emerald-200 text-xs font-mono space-y-2">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center space-x-2 text-emerald-800 font-bold text-xs">
              <CheckCircle2 className="h-4 w-4 text-emerald-600" />
              <span>STATUTORY ELECTRONIC DISPATCH ACKNOWLEDGED</span>
              <span className="px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 border border-emerald-300 text-[9px]">
                OFFICIAL ROUTING
              </span>
            </div>
            <span className="text-[10px] px-2.5 py-0.5 rounded-full bg-white text-emerald-800 border border-emerald-200 font-bold">
              REF: {dispatchResult.dispatch_id}
            </span>
          </div>
          <p className="text-[#0F172A] text-[11px] leading-relaxed">
            {dispatchResult.acknowledgment_message}
          </p>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-1 text-[10px] text-[#64748B] border-t border-emerald-200">
            <div>TARGET VASP: <strong className="text-rose-600">{dispatchResult.target_vasp}</strong></div>
            <div>ROUTING CODE: <strong className="text-[#0284C7]">{dispatchResult.sahyog_routing_code}</strong></div>
            <div>RESPONSE SLA: <strong className="text-emerald-700">{dispatchResult.response_sla || dispatchResult.mock_response_sla}</strong></div>
            <div>AUDIT STATUS: <strong className="text-emerald-700">{dispatchResult.status}</strong></div>
          </div>
        </div>
      )}

      {dispatchError && (
        <div className="no-print p-3 bg-rose-50 border-b border-rose-200 text-xs text-rose-700 flex items-center space-x-2">
          <AlertTriangle className="h-4 w-4 text-rose-600 flex-shrink-0" />
          <span>{dispatchError}</span>
        </div>
      )}

      {/* Input Parameters Bar (Hidden during Print) */}
      <div className="no-print p-4 bg-[#F8FAFC] border-b border-[#E2E8F0] grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
        <div>
          <label className="text-[10px] uppercase text-[#64748B] font-semibold block mb-1">
            Investigating Officer Name
          </label>
          <input
            type="text"
            value={officerName}
            onChange={(e) => setOfficerName(e.target.value)}
            onBlur={fetchNotice}
            className="w-full bg-white border border-[#E2E8F0] focus:border-[#0284C7] rounded-lg px-3 py-1.5 text-[#0F172A] font-mono text-[11px] focus:outline-none transition-colors shadow-sm"
          />
        </div>
        <div>
          <label className="text-[10px] uppercase text-[#64748B] font-semibold block mb-1">
            Police Unit / Cyber Cell
          </label>
          <input
            type="text"
            value={policeStation}
            onChange={(e) => setPoliceStation(e.target.value)}
            onBlur={fetchNotice}
            className="w-full bg-white border border-[#E2E8F0] focus:border-[#0284C7] rounded-lg px-3 py-1.5 text-[#0F172A] font-mono text-[11px] focus:outline-none transition-colors shadow-sm"
          />
        </div>
        <div>
          <label className="text-[10px] uppercase text-[#64748B] font-semibold block mb-1">
            NCRP Ack / Crime Reference Number
          </label>
          <input
            type="text"
            value={crimeNumber}
            onChange={(e) => setCrimeNumber(e.target.value)}
            onBlur={fetchNotice}
            className="w-full bg-white border border-[#E2E8F0] focus:border-[#0284C7] rounded-lg px-3 py-1.5 text-[#0F172A] font-mono text-[11px] focus:outline-none transition-colors shadow-sm"
          />
        </div>
      </div>

      {/* Target VASP Direct Contact Bar (Hidden during Print) */}
      {noticeData && (
        <div className="no-print px-4 py-2.5 bg-white border-b border-[#E2E8F0] flex flex-wrap items-center justify-between text-[11px] gap-2">
          <div className="flex items-center space-x-2">
            <span className="text-[#64748B] uppercase text-[10px]">Addressed VASP:</span>
            <strong className="text-rose-600 font-bold font-mono">{noticeData.vasp_name}</strong>
          </div>
          <div className="flex items-center space-x-3 text-[#64748B] font-mono">
            <span className="flex items-center space-x-1">
              <Mail className="h-3 w-3 text-emerald-600" />
              <span className="text-[#0F172A]">{noticeData.compliance_email}</span>
            </span>
            <span>•</span>
            <span>{noticeData.ref_number}</span>
          </div>
        </div>
      )}

      {/* Official Requisition Content */}
      <div className={`overflow-y-auto bg-[#F4F6F8] p-6 print:bg-white print:text-black ${isFullPageView ? 'min-h-[500px]' : 'flex-1'
        }`}>
        {!analysisId ? (
          <div className="flex items-center justify-center py-24 text-slate-500 dark:text-[#94A3B8] text-center">
            <span>Please execute a wallet trace in the Target Workspace first to generate a Section 91 statutory requisition.</span>
          </div>
        ) : loading ? (
          <div className="flex flex-col items-center justify-center py-24 text-[#64748B]">
            <div className="h-8 w-8 border-2 border-[#0284C7] border-t-transparent rounded-full animate-spin mb-3"></div>
            <span className="text-xs font-mono">Generating formal statutory order &amp; cryptographic QR verification seal...</span>
          </div>
        ) : activeTab === 'visual' && noticeData ? (
          /* Official Legal Order Visual Form */
          <div className="max-w-4xl mx-auto space-y-6 text-[#0F172A] print:text-black font-serif">

            {/* Official Legal Order Header */}
            <div className="p-6 rounded-xl bg-white border border-[#E2E8F0] print:border-black/40 print:bg-transparent text-center relative shadow-sm">
              <div className="text-[11px] font-sans font-bold tracking-widest text-[#64748B] uppercase mb-1">
                GOVERNMENT OF INDIA // LAW ENFORCEMENT &amp; CYBER CRIME INVESTIGATION
              </div>
              <h1 className="text-base font-bold uppercase tracking-wider text-[#0F172A] print:text-black">
                LEGAL NOTICE UNDER SECTION 91 Cr.P.C. / SECTION 94 BNSS
              </h1>
              <p className="text-xs font-sans text-[#64748B] print:text-black/70 mt-1">
                REQUISITION FOR IMMEDIATE ASSET PRESERVATION, FREEZE &amp; BENEFICIAL KYC DISCLOSURE
              </p>

              {/* QR Verification Seal Top-Right */}
              {qrDataUrl && (
                <div className="absolute right-5 top-5 hidden sm:flex flex-col items-center p-1.5 rounded-lg bg-white border border-[#E2E8F0] shadow-sm print:flex">
                  <img src={qrDataUrl} alt="Verification QR" className="h-16 w-16" />
                  <span className="text-[8px] font-mono text-[#0F172A] font-bold mt-0.5">SCAN TO VERIFY</span>
                </div>
              )}
            </div>

            {/* Recipient & Metadata Grid */}
            <div className="p-5 rounded-xl bg-white border border-[#E2E8F0] print:border-black/30 font-mono text-[11px] space-y-3 shadow-sm">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <span className="text-[10px] text-[#64748B] block uppercase">TO (COMPLIANCE OFFICER):</span>
                  <div className="font-bold text-[#0F172A] print:text-black text-xs">{noticeData.vasp_name} Compliance Department</div>
                  <div className="text-[#0284C7] print:text-blue-700">{noticeData.compliance_email}</div>
                </div>

                <div>
                  <span className="text-[10px] text-[#64748B] block uppercase">FROM (INVESTIGATING AUTHORITY):</span>
                  <div className="font-bold text-[#0F172A] print:text-black text-xs">{officerName}</div>
                  <div className="text-[#64748B] print:text-black/80">{policeStation}</div>
                </div>
              </div>

              <div className="pt-3 border-t border-[#E2E8F0] print:border-black/20 grid grid-cols-2 sm:grid-cols-3 gap-3 text-[10px]">
                <div>
                  <span className="text-[#64748B] block">REFERENCE NUMBER:</span>
                  <span className="font-bold text-[#0F172A] print:text-black">{noticeData.ref_number}</span>
                </div>
                <div>
                  <span className="text-[#64748B] block">CRIME / NCRP NUMBER:</span>
                  <span className="font-bold text-[#0F172A] print:text-black">{crimeNumber}</span>
                </div>
                <div>
                  <span className="text-[#64748B] block">DATE OF ORDER:</span>
                  <span className="font-bold text-[#0F172A] print:text-black">{new Date().toLocaleDateString('en-GB')}</span>
                </div>
              </div>
            </div>

            {/* Legal Requisition Mandates */}
            <div className="p-5 rounded-xl bg-white border border-[#E2E8F0] print:border-black/30 space-y-4 font-sans text-xs leading-relaxed shadow-sm">
              <h3 className="font-bold uppercase tracking-wide text-rose-600 print:text-rose-700 text-xs">
                Statutory Directives to Virtual Asset Service Provider (VASP):
              </h3>

              <ol className="list-decimal pl-5 space-y-2 text-[#0F172A] print:text-black">
                <li>
                  <strong>Immediate Asset Freeze:</strong> You are directed to immediately place an administrative and transactional debit freeze on all funds, cryptocurrency tokens, fiat balances, and linked sub-accounts associated with the verified destination addresses identified below.
                </li>
                <li>
                  <strong>Complete KYC &amp; Identity Disclosure:</strong> Furnish certified true copies of full Know-Your-Customer (KYC) dossiers, including Government ID documents, PAN/Passport, phone numbers, registered email IDs, linked bank account numbers, and IP connection audit logs for the beneficial owners of said accounts.
                </li>
                <li>
                  <strong>Historical Transaction Ledger:</strong> Provide complete chronological fiat deposit/withdrawal history, on-chain internal transfer logs, and counterparty wallet records from inception to date.
                </li>
              </ol>
            </div>

            {/* Critical On-Chain Transaction Evidence */}
            {noticeData.critical_txs && noticeData.critical_txs.length > 0 && (
              <div className="p-5 rounded-xl bg-white border border-[#E2E8F0] print:border-black/30 space-y-3 font-mono text-[11px] shadow-sm">
                <h3 className="text-xs font-bold uppercase tracking-wider text-emerald-600 print:text-emerald-700">
                  Verified On-Chain Transaction Evidence Schedule:
                </h3>

                <div className="overflow-x-auto border border-[#E2E8F0] print:border-black/20 rounded-lg">
                  <table className="w-full text-left">
                    <thead className="bg-[#F8FAFC] print:bg-gray-100 text-[#64748B] print:text-black border-b border-[#E2E8F0]">
                      <tr>
                        <th className="p-2.5">Tx Hash</th>
                        <th className="p-2.5">Source Address</th>
                        <th className="p-2.5">Destination VASP Address</th>
                        <th className="p-2.5">Amount</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[#E2E8F0] print:divide-gray-200">
                      {noticeData.critical_txs.map((tx: any, idx: number) => (
                        <tr key={idx} className="hover:bg-[#F8FAFC]">
                          <td className="p-2.5 font-bold text-[#0284C7] print:text-blue-700 break-all">{tx.tx_hash}</td>
                          <td className="p-2.5 break-all text-[#64748B]">{tx.from_address}</td>
                          <td className="p-2.5 break-all text-emerald-600 print:text-emerald-700 font-bold">{tx.to_address}</td>
                          <td className="p-2.5 font-bold text-[#0F172A]">{tx.amount} {tx.token_symbol || 'ETH'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* Officer Signature Block */}
            <div className="pt-8 border-t border-[#E2E8F0] print:border-black/30 flex justify-between items-end font-sans text-xs text-[#0F172A] print:text-black">
              <div className="space-y-1 font-mono text-[10px] text-[#64748B] print:text-black/70">
                <div>ELECTRONIC CASE VERIFICATION STAMP</div>
                <div>SEC. 65B INDIAN EVIDENCE ACT COMPLIANT</div>
                <div>SYSTEM AUDIT REF: {noticeData.ref_number}</div>
              </div>

              <div className="text-right space-y-1">
                <div className="h-12 flex items-center justify-end">
                  <span className="font-mono text-[10px] text-[#0284C7] print:text-rose-700 border-b border-dashed border-[#0284C7] pb-1">
                    [Digitally Signed by Authorized Cyber Cell Officer]
                  </span>
                </div>
                <div className="font-bold text-xs text-[#0F172A]">{officerName}</div>
                <div className="text-[11px] text-[#64748B] print:text-black/80">{policeStation}</div>
              </div>
            </div>
          </div>
        ) : (
          /* Plain Text Markdown View */
          <div className="max-w-4xl mx-auto">
            <pre className="p-5 rounded-xl bg-white border border-[#E2E8F0] font-mono text-[11px] text-[#0F172A] leading-relaxed whitespace-pre-wrap select-all shadow-sm">
              {noticeData?.notice_markdown}
            </pre>
          </div>
        )}
      </div>
    </div>
  );

  if (isFullPageView) {
    return content;
  }

  return (
    <div className="fixed inset-0 z-[100000] bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
      {content}
    </div>
  );
};
