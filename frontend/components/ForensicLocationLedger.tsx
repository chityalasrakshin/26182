'use client';

import React, { useState, useMemo } from 'react';
import {
  FileSpreadsheet,
  Search,
  Filter,
  Download,
  MapPin,
  ExternalLink,
  Copy,
  Check,
  ShieldAlert,
  Laptop,
  Globe,
  Radio,
  Clock,
  ChevronDown
} from 'lucide-react';
import { NormalizedTransaction, GraphNode } from '../lib/types';

export interface ForensicRecord {
  id: string;
  walletAddress: string;
  date: string;
  time: string;
  cryptoAmount: number;
  cryptoSymbol: string;
  ipAddress: string;
  latitude: number;
  longitude: number;
  locationName: string;
  operatingSystem: string;
  ispOrg: string;
  isThreatFlagged: boolean;
  threatType?: string;
  hopDistance: number;
}

interface ForensicLocationLedgerProps {
  transactions?: NormalizedTransaction[];
  nodes?: GraphNode[];
  onSelectWallet?: (address: string) => void;
  onLocateOnMap?: (lat: number, lon: number, label: string) => void;
}

export const ForensicLocationLedger: React.FC<ForensicLocationLedgerProps> = ({
  transactions = [],
  nodes = [],
  onSelectWallet,
  onLocateOnMap,
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedOS, setSelectedOS] = useState<string>('ALL');
  const [selectedThreat, setSelectedThreat] = useState<string>('ALL');
  const [copiedId, setCopiedId] = useState<string | null>(null);

  // Generate enriched forensic records from transactions and graph nodes
  const records = useMemo(() => {
    const list: ForensicRecord[] = [];

    const sourceTx = transactions.length > 0 ? transactions : [];

    sourceTx.forEach((tx, idx) => {
      // Only map transactions that have genuine telemetry metadata attached
      const ip = (tx as any).ip_address || (tx as any).client_ip;
      if (!ip) return;

      let dateStr = '';
      let timeStr = '';

      if (tx.timestamp) {
        const d = new Date(tx.timestamp);
        if (!isNaN(d.getTime())) {
          dateStr = d.toISOString().split('T')[0];
          timeStr = d.toTimeString().split(' ')[0];
        }
      }

      list.push({
        id: tx.tx_hash || `rec-${idx}`,
        walletAddress: tx.from_address,
        date: dateStr,
        time: timeStr,
        cryptoAmount: tx.amount || 0,
        cryptoSymbol: tx.token_symbol || 'ETH',
        ipAddress: ip,
        latitude: (tx as any).latitude || 0,
        longitude: (tx as any).longitude || 0,
        locationName: (tx as any).location_name || (tx as any).country || 'Unknown Location',
        operatingSystem: (tx as any).operating_system || (tx as any).user_agent || 'Unknown OS',
        ispOrg: (tx as any).isp_org || (tx as any).isp || 'Unknown ISP',
        isThreatFlagged: Boolean((tx as any).is_threat_flagged),
        threatType: (tx as any).threat_type,
        hopDistance: tx.hop || 1,
      });
    });

    return list;
  }, [transactions, nodes]);

  // Filters
  const filteredRecords = useMemo(() => {
    return records.filter((r) => {
      if (selectedOS !== 'ALL' && !r.operatingSystem.includes(selectedOS)) return false;
      if (selectedThreat === 'THREAT_ONLY' && !r.isThreatFlagged) return false;
      if (selectedThreat === 'CLEAN_ONLY' && r.isThreatFlagged) return false;

      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        return (
          r.walletAddress.toLowerCase().includes(q) ||
          r.ipAddress.toLowerCase().includes(q) ||
          r.locationName.toLowerCase().includes(q) ||
          r.ispOrg.toLowerCase().includes(q) ||
          r.operatingSystem.toLowerCase().includes(q)
        );
      }
      return true;
    });
  }, [records, searchQuery, selectedOS, selectedThreat]);

  const handleCopy = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const handleExportCSV = () => {
    const headers = [
      'Wallet Address',
      'Date of Transaction',
      'Time of Transaction',
      'Amount',
      'Asset',
      'Personal IP Address',
      'Latitude',
      'Longitude',
      'Location',
      'Operating System',
      'ISP Organization',
      'Threat Flag',
    ];
    const rows = filteredRecords.map((r) => [
      r.walletAddress,
      r.date,
      r.time,
      r.cryptoAmount,
      r.cryptoSymbol,
      r.ipAddress,
      r.latitude,
      r.longitude,
      `"${r.locationName}"`,
      `"${r.operatingSystem}"`,
      `"${r.ispOrg}"`,
      r.isThreatFlagged ? r.threatType || 'FLAGGED' : 'CLEAN',
    ]);
    const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map((e) => e.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', 'Crypto_Wallet_Accts_Location_Forensics.csv');
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="bg-forensic-surface border border-forensic-border rounded-lg shadow-xl font-mono text-xs overflow-hidden flex flex-col transition-all">
      {/* ─────────────────────────────────────────────────────────────────── */}
      {/* 1. HEADER (Exact title from Video Frame 210s) */}
      {/* ─────────────────────────────────────────────────────────────────── */}
      <div className="p-3 bg-forensic-surfaceRaised border-b border-forensic-border flex items-center justify-between flex-wrap gap-2">
        <div className="flex items-center space-x-2.5">
          <div className="p-1.5 rounded bg-emerald-500/10 border border-emerald-500/30 text-emerald-400">
            <FileSpreadsheet className="h-4 w-4" />
          </div>
          <div>
            <h3 className="font-bold text-forensic-text text-[12px] uppercase tracking-wide flex items-center space-x-2">
              <span>Crypto Wallet Accts- Location</span>
              <span className="text-[9px] px-1.5 py-0.2 rounded bg-emerald-50 text-emerald-700 border border-emerald-200 font-semibold">
                Off-Chain Fusion Ledger
              </span>
            </h3>
            <span className="text-[10px] text-forensic-textDim block">
              Multi-source Intelligence Correlating On-Chain Hashes with Cyber Telemetry
            </span>
          </div>
        </div>

        <div className="flex items-center space-x-2">
          <button
            onClick={handleExportCSV}
            className="py-1 px-2.5 rounded bg-forensic-bg hover:bg-forensic-surfaceRaised border border-forensic-border text-forensic-text font-bold text-[11px] flex items-center space-x-1.5 transition-colors shadow-sm"
          >
            <Download className="h-3.5 w-3.5 text-blue-400" />
            <span>Export CSV / Excel</span>
          </button>
        </div>
      </div>

      {/* ─────────────────────────────────────────────────────────────────── */}
      {/* 2. SEARCH & FILTER TOOLBAR */}
      {/* ─────────────────────────────────────────────────────────────────── */}
      <div className="p-2.5 bg-forensic-bg border-b border-forensic-border flex items-center justify-between gap-2 flex-wrap text-[11px]">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="h-3.5 w-3.5 absolute left-2.5 top-2 text-forensic-textDim" />
          <input
            type="text"
            placeholder="Search address, IP, location, or OS..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full bg-forensic-surface border border-forensic-border rounded pl-8 pr-3 py-1 text-forensic-text placeholder-forensic-textDim focus:outline-none focus:border-emerald-500"
          />
        </div>

        <div className="flex items-center space-x-2">
          {/* OS Filter */}
          <div className="flex items-center space-x-1">
            <Laptop className="h-3.5 w-3.5 text-forensic-textDim" />
            <select
              value={selectedOS}
              onChange={(e) => setSelectedOS(e.target.value)}
              className="bg-forensic-surface border border-forensic-border rounded px-2 py-1 text-forensic-text text-[11px] focus:outline-none focus:border-emerald-500"
            >
              <option value="ALL">All Operating Systems</option>
              <option value="Windows">Windows (All)</option>
              <option value="Windows 10">Windows 10</option>
              <option value="Windows 8">Windows 8</option>
              <option value="Windows 7">Windows 7</option>
              <option value="macOS">macOS</option>
              <option value="Linux">Linux</option>
              <option value="Android">Android</option>
            </select>
          </div>

          {/* Threat Flag Filter */}
          <div className="flex items-center space-x-1">
            <ShieldAlert className="h-3.5 w-3.5 text-forensic-textDim" />
            <select
              value={selectedThreat}
              onChange={(e) => setSelectedThreat(e.target.value)}
              className="bg-forensic-surface border border-forensic-border rounded px-2 py-1 text-forensic-text text-[11px] focus:outline-none focus:border-emerald-500"
            >
              <option value="ALL">All Footprints</option>
              <option value="THREAT_ONLY">VPN / Tor / Flagged</option>
              <option value="CLEAN_ONLY">Residential / Clean</option>
            </select>
          </div>
        </div>
      </div>

      {/* ─────────────────────────────────────────────────────────────────── */}
      {/* 3. TABLE BODY (Matching Video Spreadsheet Frame 210s) */}
      {/* ─────────────────────────────────────────────────────────────────── */}
      <div className="overflow-x-auto max-h-[440px]">
        <table className="w-full text-left border-collapse">
          <thead className="bg-forensic-surfaceRaised text-forensic-textDim text-[10px] uppercase font-bold sticky top-0 border-b border-forensic-border z-10">
            <tr>
              <th className="p-2.5">Wallet A</th>
              <th className="p-2.5">Date of Tx</th>
              <th className="p-2.5">Time of Tx</th>
              <th className="p-2.5">Amount</th>
              <th className="p-2.5">Personal IP Address</th>
              <th className="p-2.5">Latitude</th>
              <th className="p-2.5">Longitude</th>
              <th className="p-2.5">Geographic Location</th>
              <th className="p-2.5">Operating System</th>
              <th className="p-2.5 text-center">Threat Status</th>
              <th className="p-2.5 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-forensic-border/50 text-[11px]">
            {filteredRecords.length === 0 ? (
              <tr>
                <td colSpan={11} className="p-10 text-center">
                  <div className="max-w-xl mx-auto space-y-3 font-mono">
                    <div className="inline-flex p-3 rounded-full bg-sky-50 border border-sky-200 text-sky-700">
                      <Radio className="h-6 w-6" />
                    </div>
                    <h4 className="text-sm font-bold text-forensic-text uppercase tracking-wide">
                      No Off-Chain Telemetry Records Attached
                    </h4>
                    <p className="text-xs text-forensic-textMuted leading-relaxed">
                      Public blockchain ledgers record decentralized cryptographic transfers without capturing client IP addresses or device operating systems.
                    </p>
                    <div className="p-3 bg-forensic-bg border border-forensic-border rounded text-left text-[11px] text-forensic-textDim space-y-1.5">
                      <div className="font-bold text-forensic-text uppercase text-[10px] text-sky-800">
                        Law Enforcement Correlation Options:
                      </div>
                      <div>1. Issue a Section 94 BNSS / Section 91 CrPC Preservation Requisition to attributed VASPs to subpoena exchange nodal access and login IP logs.</div>
                      <div>2. Ingest LEA ISP packet capture records or Cyber Cell incident telemetry via Case Intake.</div>
                    </div>
                  </div>
                </td>
              </tr>
            ) : (
              filteredRecords.map((r, idx) => (
                <tr
                  key={r.id}
                  className="hover:bg-forensic-surfaceRaised/60 transition-colors group"
                >
                  {/* Wallet A */}
                  <td className="p-2.5 font-bold text-forensic-text">
                    <div className="flex items-center space-x-1.5">
                      <span className="truncate max-w-[130px]" title={r.walletAddress}>
                        {r.walletAddress.slice(0, 8)}...{r.walletAddress.slice(-6)}
                      </span>
                      <button
                        onClick={() => handleCopy(r.walletAddress, `w-${idx}`)}
                        className="text-forensic-textDim hover:text-forensic-text p-0.5"
                        title="Copy Wallet"
                      >
                        {copiedId === `w-${idx}` ? (
                          <Check className="h-3 w-3 text-emerald-600" />
                        ) : (
                          <Copy className="h-3 w-3" />
                        )}
                      </button>
                    </div>
                  </td>

                  {/* Date */}
                  <td className="p-2.5 text-forensic-textMuted whitespace-nowrap">{r.date}</td>

                  {/* Time */}
                  <td className="p-2.5 text-amber-600 font-semibold whitespace-nowrap">{r.time}</td>

                  {/* Amount */}
                  <td className="p-2.5 font-bold text-forensic-text whitespace-nowrap">
                    {r.cryptoAmount.toFixed(4)} {r.cryptoSymbol}
                  </td>

                  {/* Personal IP Address */}
                  <td className="p-2.5 text-sky-700 font-bold whitespace-nowrap">
                    <div className="flex items-center space-x-1">
                      <span>{r.ipAddress}</span>
                      <button
                        onClick={() => handleCopy(r.ipAddress, `ip-${idx}`)}
                        className="text-forensic-textDim hover:text-forensic-text p-0.5"
                        title="Copy IP"
                      >
                        {copiedId === `ip-${idx}` ? (
                          <Check className="h-3 w-3 text-emerald-600" />
                        ) : (
                          <Copy className="h-3 w-3" />
                        )}
                      </button>
                    </div>
                    <span className="text-[9px] text-forensic-textDim block">{r.ispOrg}</span>
                  </td>

                  {/* Latitude */}
                  <td className="p-2.5 text-forensic-textMuted">{r.latitude.toFixed(6)}</td>

                  {/* Longitude */}
                  <td className="p-2.5 text-forensic-textMuted">{r.longitude.toFixed(6)}</td>

                  {/* Location Name */}
                  <td className="p-2.5 text-forensic-text font-semibold whitespace-nowrap">
                    <div className="flex items-center space-x-1">
                      <Globe className="h-3 w-3 text-emerald-600" />
                      <span>{r.locationName}</span>
                    </div>
                  </td>

                  {/* Operating System */}
                  <td className="p-2.5 text-forensic-textMuted whitespace-nowrap">
                    <span className="px-1.5 py-0.5 rounded bg-forensic-bg border border-forensic-border text-[10px]">
                      {r.operatingSystem}
                    </span>
                  </td>

                  {/* Threat Status */}
                  <td className="p-2.5 text-center whitespace-nowrap">
                    {r.isThreatFlagged ? (
                      <span className="px-2 py-0.5 rounded bg-rose-50 text-rose-700 border border-rose-200 text-[9px] font-bold uppercase">
                        {r.threatType || 'THREAT'}
                      </span>
                    ) : (
                      <span className="px-2 py-0.5 rounded bg-emerald-50 text-emerald-700 border border-emerald-200 text-[9px] font-bold uppercase">
                        RESIDENTIAL
                      </span>
                    )}
                  </td>

                  {/* Actions */}
                  <td className="p-2.5 text-right whitespace-nowrap">
                    <div className="flex items-center justify-end space-x-1.5">
                      {onLocateOnMap && (
                        <button
                          onClick={() => onLocateOnMap(r.latitude, r.longitude, `${r.locationName} (${r.ipAddress})`)}
                          className="p-1 rounded bg-sky-50 hover:bg-sky-100 text-sky-700 border border-sky-200 transition-colors"
                          title="Locate on Map"
                        >
                          <MapPin className="h-3.5 w-3.5" />
                        </button>
                      )}
                      {onSelectWallet && (
                        <button
                          onClick={() => onSelectWallet(r.walletAddress)}
                          className="p-1 rounded bg-forensic-surfaceRaised hover:bg-forensic-border text-forensic-text border border-forensic-border transition-colors"
                          title="Pivot Graph on Target"
                        >
                          <ExternalLink className="h-3.5 w-3.5" />
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* ─────────────────────────────────────────────────────────────────── */}
      {/* 4. FOOTER SUMMARY */}
      {/* ─────────────────────────────────────────────────────────────────── */}
      <div className="p-2.5 bg-forensic-surfaceRaised border-t border-forensic-border text-[10px] text-forensic-textDim flex items-center justify-between">
        <span>
          Displaying {filteredRecords.length} of {records.length} forensic cross-referenced records
        </span>
        <div className="flex items-center space-x-3">
          <span className="text-emerald-600 font-semibold">
            {records.filter((r) => !r.isThreatFlagged).length} Residential
          </span>
          <span className="text-rose-600 font-semibold">
            {records.filter((r) => r.isThreatFlagged).length} Flagged Endpoints
          </span>
        </div>
      </div>
    </div>
  );
};
