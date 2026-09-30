'use client';

import React, { useState } from 'react';
import {
  Scale,
  X,
  Copy,
  Check,
  Printer,
  Send,
  Building2,
  FileCheck2,
  ShieldAlert,
  AlertCircle,
  ExternalLink,
} from 'lucide-react';
import { ForensicsNode, VaspNodeData } from './types';

interface SahyogRoutingModalProps {
  node: ForensicsNode | null;
  onClose: () => void;
}

export const SahyogRoutingModal: React.FC<SahyogRoutingModalProps> = ({ node, onClose }) => {
  if (!node) return null;

  const vaspData = node.type === 'vasp' ? (node.data as VaspNodeData) : null;
  const targetVasp = vaspData?.exchangeName || 'Binance Global';
  const targetAddress = (node.data.address as string) || '0x0000000000000000000000000000000000000000';
  const fiuNumber = vaspData?.fiuRegNumber || 'FIU-IND/REQ/VASP-2024/0912';
  const nodalOfficer = vaspData?.nodalOfficer || 'Mr. Amitav Sen, Compliance Nodal Officer';
  const complianceEmail = vaspData?.complianceEmail || 'nodal.lea@binance.com';
  const routingCode = vaspData?.sahyogRoutingCode || 'SHYG-IN-VASP-8842';

  const [officerName, setOfficerName] = useState('Inspector R. K. Sharma');
  const [policeStation, setPoliceStation] = useState('Cyber Crime Police Station, Special Cell / CID');
  const [crimeNumber, setCrimeNumber] = useState('FIR No. 428/2026 / NCRP-FIN-8842');
  const [copied, setCopied] = useState(false);
  const [dispatched, setDispatched] = useState(false);
  const [dispatching, setDispatching] = useState(false);

  const noticeDate = new Date().toLocaleDateString('en-IN', {
    day: '2-digit',
    month: 'long',
    year: 'numeric',
  });

  const generateNoticeText = () => {
    return `================================================================================
STATUTORY NOTICE UNDER SECTION 91 Cr.P.C. / SECTION 94 BNSS
FOR PRODUCTION OF INFORMATION, KYC & ASSET FREEZE (CRYPTO VASP)
================================================================================
Ref: SUDARSHAN/SAHYOG/2026/SEC91/${Math.random().toString(36).substring(2, 9).toUpperCase()}
Date: ${noticeDate}
Transmission Medium: Ministry of Home Affairs (MHA) SAHYOG Portal
Routing Code: ${routingCode}

TO:
The Nodal Officer for Law Enforcement (FIU-IND Registered VASP)
Entity: ${targetVasp}
FIU-IND Registration No: ${fiuNumber}
Attn: ${nodalOfficer}
Compliance Email: ${complianceEmail}

FROM:
${officerName}
Investigating Officer / Inspector of Police
${policeStation}
Crime Case Reference: ${crimeNumber}

SUBJECT: STATUTORY DEMAND FOR IMMEDIATE FREEZING OF PROCEEDS OF CRIME AND 
DISCLOSURE OF SUBSCRIBER IDENTITY (KYC/IP LOGS) UNDER SEC 91 CrPC / SEC 94 BNSS.

Sir / Madam,

1. WHEREAS, an active cyber-financial investigation is being carried out into the 
theft, unauthorized transfer, and laundering of digital cryptocurrency assets in 
connection with ${crimeNumber}.

2. AND WHEREAS, specialized blockchain forensic tracing using the National 
Blockchain Intelligence & VASP Attribution Engine has established a direct 
attribution nexus between the suspect illicit fund flow and your registered 
custodial deposit address:

   TARGET ATTRIBUTED WALLET:
   Address: ${targetAddress}
   Blockchain: ${(node.data.chain as string) || 'Ethereum'}
   Attributed VASP: ${targetVasp}
   Attribution Confidence: ${vaspData?.confidenceScore ?? 96}%

3. NOW THEREFORE, by virtue of statutory powers vested under Section 91 of the 
Code of Criminal Procedure (Cr.P.C.) [read with Section 94 of Bharatiya Nagarik 
Suraksha Sanhita (BNSS), 2023], YOU ARE HEREBY STATUTORILY DIRECTED TO:

   a) IMMEDIATELY IMPOUND, LIEN, AND FREEZE all token balances, fiat credits, 
      and withdrawal abilities associated with the attributed account/deposit address.
   b) PRESERVE AND PRODUCE the complete Customer Identification (KYC) records, 
      including government photo ID, registered phone number, verified email, and
      bank account linkage.
   c) FURNISH COMPLETE TRANSACTION HISTORY including login IP addresses, device 
      fingerprints, and associated counterparty withdrawal destination addresses.

4. TAKE NOTICE that non-compliance or undue delay within the statutory response SLA 
(24 hours) may attract penal consequences under Section 175/176 of the Indian Penal 
Code / relevant sections of the Bharatiya Nyaya Sanhita (BNS) and PMLA regulations.

ISSUED UNDER MY SIGNATURE AND OFFICIAL SEAL:

${officerName}
Investigating Officer, ${policeStation}
Dispatched via National LEA Gateway (SAHYOG / I4C Portal)
================================================================================`;
  };

  const handleCopyNotice = () => {
    navigator.clipboard.writeText(generateNoticeText());
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handlePrint = () => {
    window.print();
  };

  const handleSimulateDispatch = () => {
    setDispatching(true);
    setTimeout(() => {
      setDispatching(false);
      setDispatched(true);
    }, 1200);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 animate-fade-in">
      <div className="w-full max-w-3xl bg-slate-950 border border-slate-800 rounded-2xl shadow-2xl flex flex-col max-h-[90vh] overflow-hidden text-slate-100 font-sans">
        {/* Modal Header */}
        <div className="p-4 border-b border-slate-800 flex items-center justify-between bg-slate-900/60">
          <div className="flex items-center space-x-2.5">
            <div className="p-2 rounded-xl bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
              <Scale className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-bold text-sm text-white flex items-center gap-2">
                <span>Section 91 CrPC Statutory Notice</span>
                <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-400 border border-emerald-500/40">
                  SAHYOG Nodal Routing
                </span>
              </h3>
              <p className="text-xs text-slate-400 font-mono mt-0.5">
                Target VASP: <strong className="text-emerald-300">{targetVasp}</strong> ({fiuNumber})
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg hover:bg-slate-800 text-slate-400 hover:text-white transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form Controls for Investigating Officer */}
        <div className="p-4 border-b border-slate-800/80 bg-slate-900/40 grid grid-cols-3 gap-3 text-xs">
          <div className="space-y-1">
            <label className="text-[10px] font-mono uppercase text-slate-400 font-bold block">
              Investigating Officer
            </label>
            <input
              type="text"
              value={officerName}
              onChange={(e) => setOfficerName(e.target.value)}
              className="w-full bg-slate-950 border border-slate-800 rounded-lg px-2.5 py-1.5 text-xs text-white focus:outline-none focus:border-sky-500"
            />
          </div>

          <div className="space-y-1">
            <label className="text-[10px] font-mono uppercase text-slate-400 font-bold block">
              Police Station / Unit
            </label>
            <input
              type="text"
              value={policeStation}
              onChange={(e) => setPoliceStation(e.target.value)}
              className="w-full bg-slate-950 border border-slate-800 rounded-lg px-2.5 py-1.5 text-xs text-white focus:outline-none focus:border-sky-500"
            />
          </div>

          <div className="space-y-1">
            <label className="text-[10px] font-mono uppercase text-slate-400 font-bold block">
              FIR / Crime Reference
            </label>
            <input
              type="text"
              value={crimeNumber}
              onChange={(e) => setCrimeNumber(e.target.value)}
              className="w-full bg-slate-950 border border-slate-800 rounded-lg px-2.5 py-1.5 text-xs text-white focus:outline-none focus:border-sky-500"
            />
          </div>
        </div>

        {/* Notice Preview */}
        <div className="flex-1 overflow-y-auto p-4 bg-slate-950/80 font-mono text-[11px] leading-relaxed text-slate-300">
          <pre className="whitespace-pre-wrap font-mono select-all bg-slate-900/50 p-4 rounded-xl border border-slate-800">
            {generateNoticeText()}
          </pre>
        </div>

        {/* Dispatch State & Footer Actions */}
        <div className="p-4 border-t border-slate-800 bg-slate-900/80 flex items-center justify-between">
          <div className="text-[11px] font-mono text-slate-400 flex items-center gap-2">
            {dispatched ? (
              <span className="text-emerald-400 font-bold flex items-center gap-1.5">
                <FileCheck2 className="w-4 h-4" />
                Dispatched to {complianceEmail} via SAHYOG Gateway (ACK: {routingCode})
              </span>
            ) : (
              <span>Statutory notice compliant with Section 91 CrPC / Section 94 BNSS</span>
            )}
          </div>

          <div className="flex items-center space-x-2">
            <button
              type="button"
              onClick={handlePrint}
              className="py-1.5 px-3 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold flex items-center space-x-1.5 transition-colors"
            >
              <Printer className="w-3.5 h-3.5" />
              <span>Print Notice</span>
            </button>

            <button
              type="button"
              onClick={handleCopyNotice}
              className="py-1.5 px-3 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold flex items-center space-x-1.5 transition-colors"
            >
              {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
              <span>{copied ? 'Copied' : 'Copy Notice'}</span>
            </button>

            <button
              type="button"
              onClick={handleSimulateDispatch}
              disabled={dispatching || dispatched}
              className={`py-1.5 px-4 rounded-lg text-xs font-bold flex items-center space-x-1.5 transition-all ${
                dispatched
                  ? 'bg-emerald-600/50 text-emerald-200 cursor-default'
                  : 'bg-emerald-600 hover:bg-emerald-500 text-white shadow-[0_0_15px_rgba(16,185,129,0.4)]'
              }`}
            >
              {dispatching ? (
                <>
                  <span className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin"></span>
                  <span>Transmitting...</span>
                </>
              ) : (
                <>
                  <Send className="w-3.5 h-3.5" />
                  <span>{dispatched ? 'Notice Transmitted' : 'Dispatch via SAHYOG API'}</span>
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
