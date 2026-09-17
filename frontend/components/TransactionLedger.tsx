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
    <div className="bg-[#161616] rounded-2xl p-5 shadow-sm border border-[#2A2A2A] space-y-4 text-xs font-mono">
      {/* Header & Controls Toolbar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-[#2A2A2A]">
        <div className="flex items-center gap-2">
          <List className="h-5 w-5 text-[#E5FF8F]" />
          <h3 className="font-sans text-sm sm:text-base font-bold text-[#FFFFFF]">
            Forensic Transaction Ledger
          </h3>
          <span className="px-2.5 py-0.5 rounded-full bg-[#1A1A1A] text-[#9A9A9A] text-[11px] border border-[#2A2A2A]">
            {filtered.length} Observed Transfers
          </span>
        </div>

        <div className="flex items-center gap-2">
          <div className="relative">
            <Search className="absolute left-3 top-2 h-3.5 w-3.5 text-[#9A9A9A]" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => {
                setSearchQuery(e.target.value);
                setPage(0);
              }}
              placeholder="Filter tx hash or counterparty..."
              className="pl-8 pr-3 py-1.5 rounded-full bg-[#1A1A1A] border border-[#2A2A2A] text-[#FFFFFF] placeholder-[#666666] text-xs focus:outline-none focus:border-[#E5FF8F] w-48 sm:w-64 transition-all"
            />
          </div>

          <button
            onClick={handleExportCSV}
            className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-full bg-[#1A1A1A] hover:bg-[#252525] text-[#E5FF8F] border border-[#2A2A2A] font-bold text-xs shadow-sm transition-all"
          >
            <Download className="h-3.5 w-3.5 text-[#E5FF8F]" />
            <span>Export CSV</span>
          </button>
        </div>
      </div>

      {/* Forensic Data Table */}
      <div className="w-full overflow-x-auto rounded-2xl bg-[#161616] border border-[#2A2A2A]">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="bg-[#1A1A1A] text-[#9A9A9A] text-[10px] uppercase tracking-wider border-b border-[#2A2A2A]">
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
          <tbody className="divide-y divide-[#2A2A2A] text-xs text-[#FFFFFF]">
            {paginated.length === 0 ? (
              <tr>
                <td colSpan={8} className="py-8 text-center text-[#9A9A9A]">
                  No forensic transactions recorded for this parameter set.
                </td>
              </tr>
            ) : (
              paginated.map((tx, idx) => (
                <tr
                  key={idx}
                  onClick={() => setSelectedTx(tx)}
                  className="hover:bg-[#1A1A1A]/70 cursor-pointer transition-colors group"
                >
                  <td className="py-3 px-3 font-semibold text-[#E5FF8F] flex items-center gap-1.5">
                    <span>{tx.tx_hash.slice(0, 8)}...{tx.tx_hash.slice(-4)}</span>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleCopy(tx.tx_hash, tx.tx_hash);
                      }}
                      title="Copy Tx Hash"
                      className="opacity-0 group-hover:opacity-100 text-[#9A9A9A] hover:text-[#FFFFFF] transition-opacity"
                    >
                      {copiedHash === tx.tx_hash ? (
                        <Check className="h-3 w-3 text-[#7CFF6B]" />
                      ) : (
                        <Copy className="h-3 w-3" />
                      )}
                    </button>
                  </td>

                  <td className="py-3 px-3 text-[#9A9A9A] text-[11px]">
                    {new Date(tx.timestamp).toISOString().replace('T', ' ').slice(0, 19)}
                  </td>

                  <td className="py-3 px-3 text-[#FFFFFF] font-medium truncate max-w-[130px]">
                    {tx.from_address.slice(0, 6)}...{tx.from_address.slice(-4)}
                  </td>

                  <td className="py-3 px-3">
                    <span className="px-2 py-0.5 rounded-full bg-[#1A1A1A] text-[#9A9A9A] border border-[#2A2A2A]">
                      {tx.to_address.slice(0, 6)}...{tx.to_address.slice(-4)}
                    </span>
                  </td>

                  <td className="py-3 px-3 text-right font-semibold text-[#FFFFFF]">
                    {tx.amount.toFixed(4)} <span className="text-[#E5FF8F] text-[10px]">{tx.token_symbol || 'ETH'}</span>
                  </td>

                  <td className="py-3 px-3 text-right">
                    <div className="text-[#7CFF6B] font-bold">
                      {tx.amount_inr ? `₹${Number(tx.amount_inr).toLocaleString('en-IN', { maximumFractionDigits: 0 })}` : `₹${Math.round(tx.amount * 217100).toLocaleString('en-IN')}`}
                    </div>
                    <div className="text-[10px] text-[#9A9A9A]">
                      {tx.amount_usd ? `$${Number(tx.amount_usd).toFixed(1)}` : `$${(tx.amount * 2600).toFixed(1)}`}
                    </div>
                  </td>

                  <td className="py-3 px-2 text-center">
                    <span className="px-2 py-0.5 rounded-full bg-[#E5FF8F]/10 text-[#E5FF8F] border border-[#E5FF8F]/30 text-[10px] font-bold">
                      H{tx.hop || 1}
                    </span>
                  </td>

                  <td className="py-3 px-3 text-right">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setSelectedTx(tx);
                      }}
                      className="px-2.5 py-1 rounded-full bg-[#1A1A1A] hover:bg-[#252525] text-[#FFFFFF] border border-[#2A2A2A] text-[11px] font-medium transition-colors"
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
      <div className="flex items-center justify-between text-[11px] text-[#9A9A9A] pt-1">
        <div>
          Showing rows {paginated.length > 0 ? page * pageSize + 1 : 0} - {Math.min((page + 1) * pageSize, filtered.length)} of {filtered.length} transactions
        </div>
        <div className="flex items-center gap-1.5">
          <button
            onClick={() => setPage((p) => Math.max(p - 1, 0))}
            disabled={page === 0}
            className="px-3 py-1 rounded-full bg-[#1A1A1A] border border-[#2A2A2A] disabled:opacity-40 hover:bg-[#252525] text-[#FFFFFF] transition-colors"
          >
            Previous
          </button>
          <span className="px-2.5 py-0.5 rounded-full bg-[#1A1A1A] border border-[#2A2A2A] text-[#E5FF8F] font-bold">
            {page + 1}
          </span>
          <button
            onClick={() => setPage((p) => Math.min(p + 1, totalPages - 1))}
            disabled={page >= totalPages - 1}
            className="px-3 py-1 rounded-full bg-[#1A1A1A] border border-[#2A2A2A] disabled:opacity-40 hover:bg-[#252525] text-[#FFFFFF] transition-colors"
          >
            Next
          </button>
        </div>
      </div>

      {/* Right-Side Forensic Transaction Detail Drawer */}
      {selectedTx && (
        <div className="fixed inset-y-0 right-0 z-50 w-full max-w-md bg-[#161616] border-l border-[#2A2A2A] shadow-2xl flex flex-col font-mono text-xs">
          <div className="p-4 border-b border-[#2A2A2A] bg-[#1A1A1A] flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <ShieldCheck className="h-4 w-4 text-[#E5FF8F]" />
              <h3 className="font-bold text-[#FFFFFF] uppercase text-xs">
                Transaction Forensic Details
              </h3>
            </div>
            <button
              onClick={() => setSelectedTx(null)}
              className="p-1 rounded-full hover:bg-[#252525] text-[#9A9A9A] hover:text-[#FFFFFF]"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          <div className="p-5 flex-1 overflow-y-auto space-y-4">
            <div className="space-y-1">
              <span className="text-[10px] uppercase text-[#9A9A9A] block">Transaction Hash</span>
              <span className="text-[#E5FF8F] break-all select-all block bg-[#1A1A1A] p-2.5 rounded-xl border border-[#2A2A2A]">
                {selectedTx.tx_hash}
              </span>
            </div>

            <div className="grid grid-cols-2 gap-3 text-[11px]">
              <div className="p-3 bg-[#1A1A1A] rounded-xl border border-[#2A2A2A]">
                <span className="text-[10px] uppercase text-[#9A9A9A] block">Transferred Volume</span>
                <strong className="text-[#7CFF6B] font-bold text-sm">
                  {selectedTx.amount} {selectedTx.token_symbol || 'ETH'}
                </strong>
              </div>
              <div className="p-3 bg-[#1A1A1A] rounded-xl border border-[#2A2A2A]">
                <span className="text-[10px] uppercase text-[#9A9A9A] block">Estimated Fiat Value</span>
                <strong className="text-[#FFFFFF] font-bold text-sm block">
                  {selectedTx.amount_inr ? `₹${Number(selectedTx.amount_inr).toLocaleString('en-IN', { maximumFractionDigits: 0 })}` : `₹${Math.round(selectedTx.amount * 217100).toLocaleString('en-IN')}`}
                </strong>
                <span className="text-[10px] text-[#9A9A9A]">
                  {selectedTx.amount_usd ? `$${Number(selectedTx.amount_usd).toFixed(1)} USD` : `$${(selectedTx.amount * 2600).toFixed(1)} USD`}
                </span>
              </div>
            </div>

            <div className="space-y-1">
              <span className="text-[10px] uppercase text-[#9A9A9A] block font-bold">Origin Address (From)</span>
              <span className="text-[#FFFFFF] break-all select-all block bg-[#1A1A1A] p-2.5 rounded-xl border border-[#2A2A2A] text-xs">
                {selectedTx.from_address}
              </span>
            </div>

            <div className="space-y-1">
              <span className="text-[10px] uppercase text-[#9A9A9A] block font-bold">Recipient Address (To)</span>
              <span className="text-[#FFFFFF] break-all select-all block bg-[#1A1A1A] p-2.5 rounded-xl border border-[#2A2A2A] text-xs">
                {selectedTx.to_address}
              </span>
            </div>

            <div className="p-3.5 bg-[#1A1A1A] rounded-xl border border-[#2A2A2A] text-[11px] space-y-1">
              <span className="text-[10px] uppercase text-[#9A9A9A] block font-bold">Timestamp &amp; Block Height</span>
              <div className="text-[#FFFFFF]">UTC: {new Date(selectedTx.timestamp).toUTCString()}</div>
              {selectedTx.block_number && (
                <div className="text-[#E5FF8F]">Block Number: #{selectedTx.block_number}</div>
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
                className="w-full py-2.5 bg-[#E5FF8F] hover:bg-[#d8f575] rounded-full text-center block text-[#0A0A0A] font-mono font-bold text-xs transition-all shadow-sm"
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
