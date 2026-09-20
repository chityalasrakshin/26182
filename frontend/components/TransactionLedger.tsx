'use client';

import React, { useState } from 'react';
import {
  List,
  Search,
  Copy,
  Check,
  Download,
  X,
  ShieldCheck,
} from 'lucide-react';
import { NormalizedTransaction } from '../lib/types';

interface TransactionLedgerProps {
  transactions: NormalizedTransaction[];
}

export const TransactionLedger: React.FC<TransactionLedgerProps> = ({ transactions }) => {
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [selectedAsset, setSelectedAsset] = useState<string>('ALL');
  const [selectedHop, setSelectedHop] = useState<string>('ALL');
  const [selectedTx, setSelectedTx] = useState<NormalizedTransaction | null>(null);
  const [copiedHash, setCopiedHash] = useState<string | null>(null);

  const [page, setPage] = useState<number>(0);
  const pageSize = 15;

  const handleCopy = (text: string, hash: string) => {
    navigator.clipboard.writeText(text);
    setCopiedHash(hash);
    setTimeout(() => setCopiedHash(null), 2000);
  };

  const handleExportCSV = () => {
    if (!transactions || transactions.length === 0) return;
    const headers = ['TxHash', 'Timestamp', 'FromAddress', 'ToAddress', 'Amount', 'Asset', 'AmountUSD', 'AmountINR', 'Hop'];
    const rows = transactions.map((t) => [
      t.tx_hash,
      t.timestamp,
      t.from_address,
      t.to_address,
      t.amount,
      t.token_symbol || 'ETH',
      t.amount_usd ?? (t.amount * 2600).toFixed(2),
      t.amount_inr ?? (t.amount * 217100).toFixed(2),
      t.hop || 1,
    ]);

    const csvContent = [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `forensic_transactions_${Date.now()}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const filtered = (transactions || []).filter((t) => {
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      const match =
        t.tx_hash.toLowerCase().includes(q) ||
        t.from_address.toLowerCase().includes(q) ||
        t.to_address.toLowerCase().includes(q);
      if (!match) return false;
    }
    if (selectedAsset !== 'ALL' && (t.token_symbol || 'ETH').toUpperCase() !== selectedAsset) {
      return false;
    }
    if (selectedHop !== 'ALL' && t.hop?.toString() !== selectedHop) {
      return false;
    }
    return true;
  });

  const paginated = filtered.slice(page * pageSize, (page + 1) * pageSize);
  const totalPages = Math.ceil(filtered.length / pageSize) || 1;

  return (
    <div className="bg-white rounded-xl p-5 shadow-sm border border-[#E2E8F0] space-y-4 text-xs font-mono">
      {/* Header & Controls Toolbar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-[#E2E8F0]">
        <div className="flex items-center gap-2">
          <List className="h-5 w-5 text-[#0284C7]" />
          <h3 className="font-sans text-sm sm:text-base font-bold text-[#0F172A]">
            Forensic Transaction Ledger
          </h3>
          <span className="px-2.5 py-0.5 rounded-full bg-[#F8FAFC] text-[#64748B] text-[11px] border border-[#E2E8F0]">
            {filtered.length} Observed Transfers
          </span>
        </div>

        <div className="flex items-center gap-2">
          <div className="relative">
            <Search className="absolute left-3 top-2 h-3.5 w-3.5 text-[#64748B]" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => {
                setSearchQuery(e.target.value);
                setPage(0);
              }}
              placeholder="Filter tx hash or counterparty..."
              className="pl-8 pr-3 py-1.5 rounded-lg bg-white border border-[#E2E8F0] text-[#0F172A] placeholder-[#94A3B8] text-xs focus:outline-none focus:border-[#0284C7] w-48 sm:w-64 transition-all shadow-sm"
            />
          </div>

          <button
            onClick={handleExportCSV}
            className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg bg-white hover:bg-slate-50 text-[#0284C7] border border-[#E2E8F0] font-bold text-xs shadow-sm transition-all"
          >
            <Download className="h-3.5 w-3.5 text-[#0284C7]" />
            <span>Export CSV</span>
          </button>
        </div>
      </div>

      {/* Forensic Data Table */}
      <div className="w-full overflow-x-auto rounded-xl bg-white border border-[#E2E8F0]">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="bg-[#F8FAFC] text-[#64748B] text-[10px] uppercase tracking-wider border-b border-[#E2E8F0]">
              <th className="py-3 px-3">TX HASH</th>
              <th className="py-3 px-3">TIMESTAMP (UTC)</th>
              <th className="py-3 px-3">FROM WALLET</th>
              <th className="py-3 px-3">TO WALLET (COUNTERPARTY)</th>
              <th className="py-3 px-3 text-right">VOLUME</th>
              <th className="py-3 px-3 text-right">VALUE (INR / USD)</th>
              <th className="py-3 px-2 text-center">HOP</th>
              <th className="py-3 px-3 text-right">ACTION</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[#E2E8F0] text-xs text-[#0F172A]">
            {paginated.length === 0 ? (
              <tr>
                <td colSpan={8} className="py-8 text-center text-[#64748B]">
                  No forensic transactions recorded for this parameter set.
                </td>
              </tr>
            ) : (
              paginated.map((tx, idx) => (
                <tr
                  key={idx}
                  onClick={() => setSelectedTx(tx)}
                  className="hover:bg-[#F8FAFC] cursor-pointer transition-colors group"
                >
                  <td className="py-3 px-3 font-semibold text-[#0284C7] flex items-center gap-1.5">
                    <span>{tx.tx_hash.slice(0, 8)}...{tx.tx_hash.slice(-4)}</span>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleCopy(tx.tx_hash, tx.tx_hash);
                      }}
                      title="Copy Tx Hash"
                      className="opacity-0 group-hover:opacity-100 text-[#64748B] hover:text-[#0F172A] transition-opacity"
                    >
                      {copiedHash === tx.tx_hash ? (
                        <Check className="h-3 w-3 text-emerald-600" />
                      ) : (
                        <Copy className="h-3 w-3" />
                      )}
                    </button>
                  </td>

                  <td className="py-3 px-3 text-[#64748B] text-[11px]">
                    {new Date(tx.timestamp).toISOString().replace('T', ' ').slice(0, 19)}
                  </td>

                  <td className="py-3 px-3 text-[#0F172A] font-medium truncate max-w-[130px]">
                    {tx.from_address.slice(0, 6)}...{tx.from_address.slice(-4)}
                  </td>

                  <td className="py-3 px-3">
                    <span className="px-2 py-0.5 rounded-full bg-[#F1F5F9] text-[#0F172A] border border-[#E2E8F0]">
                      {tx.to_address.slice(0, 6)}...{tx.to_address.slice(-4)}
                    </span>
                  </td>

                  <td className="py-3 px-3 text-right font-semibold text-[#0F172A]">
                    {tx.amount.toFixed(4)} <span className="text-[#0284C7] text-[10px]">{tx.token_symbol || 'ETH'}</span>
                  </td>

                  <td className="py-3 px-3 text-right">
                    <div className="text-emerald-700 font-bold">
                      {tx.amount_inr ? `₹${Number(tx.amount_inr).toLocaleString('en-IN', { maximumFractionDigits: 0 })}` : `₹${Math.round(tx.amount * 217100).toLocaleString('en-IN')}`}
                    </div>
                    <div className="text-[10px] text-[#64748B]">
                      {tx.amount_usd ? `$${Number(tx.amount_usd).toFixed(1)}` : `$${(tx.amount * 2600).toFixed(1)}`}
                    </div>
                  </td>

                  <td className="py-3 px-2 text-center">
                    <span className="px-2 py-0.5 rounded-full bg-sky-50 text-[#0284C7] border border-sky-200 text-[10px] font-bold">
                      H{tx.hop || 1}
                    </span>
                  </td>

                  <td className="py-3 px-3 text-right">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setSelectedTx(tx);
                      }}
                      className="px-2.5 py-1 rounded-lg bg-white hover:bg-slate-50 text-[#0F172A] border border-[#E2E8F0] text-[11px] font-medium shadow-sm transition-colors"
                    >
                      Inspect
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination Bar */}
      <div className="flex items-center justify-between text-[11px] text-[#64748B] pt-1">
        <div>
          Showing rows {paginated.length > 0 ? page * pageSize + 1 : 0} - {Math.min((page + 1) * pageSize, filtered.length)} of {filtered.length} transactions
        </div>
        <div className="flex items-center gap-1.5">
          <button
            onClick={() => setPage((p) => Math.max(p - 1, 0))}
            disabled={page === 0}
            className="px-3 py-1 rounded-lg bg-white border border-[#E2E8F0] disabled:opacity-40 hover:bg-slate-50 text-[#0F172A] shadow-sm transition-colors"
          >
            Previous
          </button>
          <span className="px-2.5 py-0.5 rounded-md bg-sky-50 border border-sky-200 text-[#0284C7] font-bold">
            {page + 1}
          </span>
          <button
            onClick={() => setPage((p) => Math.min(p + 1, totalPages - 1))}
            disabled={page >= totalPages - 1}
            className="px-3 py-1 rounded-lg bg-white border border-[#E2E8F0] disabled:opacity-40 hover:bg-slate-50 text-[#0F172A] shadow-sm transition-colors"
          >
            Next
          </button>
        </div>
      </div>

      {/* Right-Side Forensic Transaction Detail Drawer */}
      {selectedTx && (
        <div className="fixed inset-y-0 right-0 z-50 w-full max-w-md bg-white border-l border-[#E2E8F0] shadow-2xl flex flex-col font-mono text-xs">
          <div className="p-4 border-b border-[#E2E8F0] bg-[#F8FAFC] flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <ShieldCheck className="h-4 w-4 text-[#0284C7]" />
              <h3 className="font-bold text-[#0F172A] uppercase text-xs">
                Transaction Forensic Details
              </h3>
            </div>
            <button
              onClick={() => setSelectedTx(null)}
              className="p-1 rounded-lg hover:bg-slate-200 text-[#64748B] hover:text-[#0F172A]"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          <div className="p-5 flex-1 overflow-y-auto space-y-4">
            <div className="space-y-1">
              <span className="text-[10px] uppercase text-[#64748B] block font-semibold">Transaction Hash</span>
              <span className="text-[#0284C7] break-all select-all block bg-[#F8FAFC] p-2.5 rounded-lg border border-[#E2E8F0]">
                {selectedTx.tx_hash}
              </span>
            </div>

            <div className="grid grid-cols-2 gap-3 text-[11px]">
              <div className="p-3 bg-[#F8FAFC] rounded-lg border border-[#E2E8F0]">
                <span className="text-[10px] uppercase text-[#64748B] block font-semibold">Transferred Volume</span>
                <strong className="text-emerald-700 font-bold text-sm">
                  {selectedTx.amount} {selectedTx.token_symbol || 'ETH'}
                </strong>
              </div>
              <div className="p-3 bg-[#F8FAFC] rounded-lg border border-[#E2E8F0]">
                <span className="text-[10px] uppercase text-[#64748B] block font-semibold">Estimated Fiat Value</span>
                <strong className="text-[#0F172A] font-bold text-sm block">
                  {selectedTx.amount_inr ? `₹${Number(selectedTx.amount_inr).toLocaleString('en-IN', { maximumFractionDigits: 0 })}` : `₹${Math.round(selectedTx.amount * 217100).toLocaleString('en-IN')}`}
                </strong>
                <span className="text-[10px] text-[#64748B]">
                  {selectedTx.amount_usd ? `$${Number(selectedTx.amount_usd).toFixed(1)} USD` : `$${(selectedTx.amount * 2600).toFixed(1)} USD`}
                </span>
              </div>
            </div>

            <div className="space-y-1">
              <span className="text-[10px] uppercase text-[#64748B] block font-bold">Origin Address (From)</span>
              <span className="text-[#0F172A] break-all select-all block bg-[#F8FAFC] p-2.5 rounded-lg border border-[#E2E8F0] text-xs">
                {selectedTx.from_address}
              </span>
            </div>

            <div className="space-y-1">
              <span className="text-[10px] uppercase text-[#64748B] block font-bold">Recipient Address (To)</span>
              <span className="text-[#0F172A] break-all select-all block bg-[#F8FAFC] p-2.5 rounded-lg border border-[#E2E8F0] text-xs">
                {selectedTx.to_address}
              </span>
            </div>

            <div className="p-3.5 bg-[#F8FAFC] rounded-lg border border-[#E2E8F0] text-[11px] space-y-1">
              <span className="text-[10px] uppercase text-[#64748B] block font-bold">Timestamp &amp; Block Height</span>
              <div className="text-[#0F172A]">UTC: {new Date(selectedTx.timestamp).toUTCString()}</div>
              {selectedTx.block_number && (
                <div className="text-[#0284C7] font-semibold">Block Number: #{selectedTx.block_number}</div>
              )}
            </div>

            <div className="pt-2">
              <a
                href={
                  selectedTx.tx_hash.startsWith('0x')
                    ? `https://etherscan.io/tx/${selectedTx.tx_hash}`
                    : `https://tronscan.org/#/transaction/${selectedTx.tx_hash}`
                }
                target="_blank"
                rel="noreferrer"
                className="w-full py-2.5 bg-[#0284C7] hover:bg-[#0369A1] rounded-lg text-center block text-white font-mono font-bold text-xs transition-all shadow-sm"
              >
                Inspect on Public Explorer →
              </a>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
