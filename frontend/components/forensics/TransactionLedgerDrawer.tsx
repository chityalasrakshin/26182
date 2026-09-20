'use client';

import React, { useState, useMemo } from 'react';
import {
  useReactTable,
  getCoreRowModel,
  getFilteredRowModel,
  getPaginationRowModel,
  getSortedRowModel,
  ColumnDef,
  flexRender,
} from '@tanstack/react-table';
import {
  ChevronUp,
  ChevronDown,
  Search,
  ExternalLink,
  Copy,
  Check,
  Filter,
  Layers,
  ArrowRight,
} from 'lucide-react';
import { ForensicsTransactionRow } from './types';

interface TransactionLedgerDrawerProps {
  transactions: ForensicsTransactionRow[];
}

export const TransactionLedgerDrawer: React.FC<TransactionLedgerDrawerProps> = ({ transactions }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [globalFilter, setGlobalFilter] = useState('');
  const [copiedHash, setCopiedHash] = useState<string | null>(null);

  const handleCopy = (hash: string, e: React.MouseEvent) => {
    e.stopPropagation();
    navigator.clipboard.writeText(hash);
    setCopiedHash(hash);
    setTimeout(() => setCopiedHash(null), 2000);
  };

  const columns = useMemo<ColumnDef<ForensicsTransactionRow>[]>(
    () => [
      {
        accessorKey: 'timestamp',
        header: 'Timestamp (UTC)',
        cell: (info) => (
          <span className="font-mono text-slate-400 text-[10px]">
            {info.getValue() as string}
          </span>
        ),
      },
      {
        accessorKey: 'txHash',
        header: 'Tx Hash',
        cell: (info) => {
          const hash = info.getValue() as string;
          const truncated = `${hash.slice(0, 10)}...${hash.slice(-6)}`;
          return (
            <div className="flex items-center space-x-1.5 font-mono text-[11px]">
              <span className="text-sky-400 select-all">{truncated}</span>
              <button
                type="button"
                onClick={(e) => handleCopy(hash, e)}
                className="p-0.5 rounded hover:bg-slate-800 text-slate-400 hover:text-white transition-colors"
                title="Copy Hash"
              >
                {copiedHash === hash ? (
                  <Check className="w-3 h-3 text-emerald-400" />
                ) : (
                  <Copy className="w-3 h-3" />
                )}
              </button>
            </div>
          );
        },
      },
      {
        accessorKey: 'fromAddress',
        header: 'From (Counterparty)',
        cell: (info) => {
          const row = info.row.original;
          return (
            <div className="flex flex-col font-mono text-[10px]">
              <span className="text-slate-200 truncate max-w-[140px]" title={row.fromAddress}>
                {row.fromLabel || `${row.fromAddress.slice(0, 6)}...${row.fromAddress.slice(-4)}`}
              </span>
              <span className="text-slate-500 text-[9px] truncate max-w-[140px]">
                {row.fromAddress.slice(0, 10)}...
              </span>
            </div>
          );
        },
      },
      {
        accessorKey: 'toAddress',
        header: 'To (Counterparty)',
        cell: (info) => {
          const row = info.row.original;
          return (
            <div className="flex flex-col font-mono text-[10px]">
              <span className="text-slate-200 truncate max-w-[140px]" title={row.toAddress}>
                {row.toLabel || `${row.toAddress.slice(0, 6)}...${row.toAddress.slice(-4)}`}
              </span>
              <span className="text-slate-500 text-[9px] truncate max-w-[140px]">
                {row.toAddress.slice(0, 10)}...
              </span>
            </div>
          );
        },
      },
      {
        accessorKey: 'amount',
        header: 'Asset & Volume',
        cell: (info) => {
          const row = info.row.original;
          return (
            <div className="font-mono text-[11px]">
              <span className="text-white font-bold">
                {row.amount.toLocaleString(undefined, { maximumFractionDigits: 4 })}{' '}
                <span className="text-slate-400 font-normal">{row.assetType}</span>
              </span>
              <div className="text-[9px] text-slate-500">
                ≈ ${row.amountUsd.toLocaleString(undefined, { maximumFractionDigits: 0 })} USD
              </div>
            </div>
          );
        },
      },
      {
        accessorKey: 'riskLabel',
        header: 'Automated Risk Classification',
        cell: (info) => {
          const row = info.row.original;
          const severityColors: Record<string, string> = {
            critical: 'bg-rose-950/60 text-rose-300 border-rose-800',
            high: 'bg-amber-950/60 text-amber-300 border-amber-800',
            medium: 'bg-yellow-950/40 text-yellow-300 border-yellow-800/80',
            low: 'bg-emerald-950/60 text-emerald-300 border-emerald-800',
          };
          const cls = severityColors[row.riskSeverity] || severityColors.medium;

          return (
            <span
              className={`px-2 py-0.5 rounded text-[10px] font-mono font-bold uppercase border tracking-tight ${cls}`}
            >
              {row.riskLabel}
            </span>
          );
        },
      },
    ],
    [copiedHash]
  );

  const table = useReactTable({
    data: transactions,
    columns,
    state: {
      globalFilter,
    },
    onGlobalFilterChange: setGlobalFilter,
    getCoreRowModel: getCoreRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    initialState: {
      pagination: {
        pageSize: 5,
      },
    },
  });

  return (
    <div className="absolute bottom-0 left-0 right-0 z-30 font-sans transition-all duration-300">
      {/* Drawer Toggle Header Bar */}
      <div
        onClick={() => setIsOpen(!isOpen)}
        className="h-10 bg-slate-950 border-t border-slate-800 px-5 flex items-center justify-between cursor-pointer hover:bg-slate-900 transition-colors select-none backdrop-blur-md"
      >
        <div className="flex items-center space-x-3 text-xs font-mono">
          <div className="flex items-center space-x-1.5 text-slate-300">
            <Layers className="w-4 h-4 text-sky-400" />
            <span className="font-bold text-white">Forensic Transaction Ledger</span>
          </div>
          <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-slate-800 text-sky-400 border border-slate-700">
            {transactions.length} Indexed Flows
          </span>
        </div>

        <div className="flex items-center space-x-3 text-xs text-slate-400 font-mono">
          <span className="text-[11px] hidden sm:inline">
            {isOpen ? 'Click to Minimize Drawer' : 'Expand Ledger'}
          </span>
          {isOpen ? <ChevronDown className="w-4 h-4" /> : <ChevronUp className="w-4 h-4" />}
        </div>
      </div>

      {/* Expandable Drawer Body */}
      {isOpen && (
        <div className="bg-slate-950/98 border-t border-slate-800/80 p-4 h-72 flex flex-col justify-between backdrop-blur-xl shadow-2xl animate-fade-in">
          {/* Top Filter and Controls Bar */}
          <div className="flex items-center justify-between pb-3 border-b border-slate-800">
            <div className="relative w-72">
              <Search className="absolute left-2.5 top-2 w-3.5 h-3.5 text-slate-500" />
              <input
                type="text"
                value={globalFilter}
                onChange={(e) => setGlobalFilter(e.target.value)}
                placeholder="Filter transactions by hash, entity, or tag..."
                className="w-full bg-slate-900 border border-slate-800 rounded-lg pl-8 pr-3 py-1.5 text-xs text-slate-100 placeholder-slate-500 font-mono focus:outline-none focus:border-sky-500"
              />
            </div>

            <div className="flex items-center space-x-2 text-xs font-mono text-slate-400">
              <span>
                Page {table.getState().pagination.pageIndex + 1} of{' '}
                {Math.max(1, table.getPageCount())}
              </span>
              <button
                type="button"
                onClick={() => table.previousPage()}
                disabled={!table.getCanPreviousPage()}
                className="px-2 py-1 rounded bg-slate-900 border border-slate-800 hover:bg-slate-800 disabled:opacity-40 text-slate-200 text-xs"
              >
                Previous
              </button>
              <button
                type="button"
                onClick={() => table.nextPage()}
                disabled={!table.getCanNextPage()}
                className="px-2 py-1 rounded bg-slate-900 border border-slate-800 hover:bg-slate-800 disabled:opacity-40 text-slate-200 text-xs"
              >
                Next
              </button>
            </div>
          </div>

          {/* Table Element */}
          <div className="flex-1 overflow-auto py-1 text-xs">
            <table className="w-full text-left border-collapse">
              <thead>
                {table.getHeaderGroups().map((headerGroup) => (
                  <tr key={headerGroup.id} className="border-b border-slate-800/60 text-slate-400">
                    {headerGroup.headers.map((header) => (
                      <th
                        key={header.id}
                        className="py-2 px-3 font-mono text-[10px] font-bold uppercase tracking-wider"
                      >
                        {header.isPlaceholder
                          ? null
                          : flexRender(header.column.columnDef.header, header.getContext())}
                      </th>
                    ))}
                  </tr>
                ))}
              </thead>
              <tbody className="divide-y divide-slate-900">
                {table.getRowModel().rows.length === 0 ? (
                  <tr>
                    <td colSpan={columns.length} className="py-8 text-center text-slate-500 font-mono text-xs">
                      No transactions found matching filter criteria.
                    </td>
                  </tr>
                ) : (
                  table.getRowModel().rows.map((row) => (
                    <tr
                      key={row.id}
                      className="hover:bg-slate-900/50 transition-colors group cursor-default"
                    >
                      {row.getVisibleCells().map((cell) => (
                        <td key={cell.id} className="py-2 px-3">
                          {flexRender(cell.column.columnDef.cell, cell.getContext())}
                        </td>
                      ))}
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
};
