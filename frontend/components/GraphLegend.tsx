'use client';

import { getNodeIconifyUrl, type GraphEntityType } from '../src/components/graph/nodeIcons';

const entities: Array<[GraphEntityType, string]> = [
  ['target', 'Target'], ['wallet', 'Wallet'], ['exchange', 'Exchange / VASP'],
  ['mixer', 'Mixer'], ['bridge', 'Bridge'], ['contract', 'Smart Contract'],
  ['sanctioned', 'Sanctioned'], ['unknown', 'Unknown'],
];

export function GraphLegend() {
  return (
    <div className="max-w-[290px] rounded-lg bg-white/95 dark:bg-[#0D131F]/95 backdrop-blur-md border border-slate-200 dark:border-[#1E293B] px-3 py-2 text-[9px] font-mono shadow-md pointer-events-auto text-slate-700 dark:text-[#CBD5E1]">
      <div className="font-bold uppercase tracking-wider text-slate-400 dark:text-[#64748B]">Entity type</div>
      <div className="mt-1 grid grid-cols-2 gap-x-3 gap-y-1">
        {entities.map(([type, label]) => (
          <span key={type} className="flex items-center gap-1.5">
            <img src={getNodeIconifyUrl(type)} width="13" height="13" alt="" aria-label={label} />
            {label}
          </span>
        ))}
      </div>
      <div className="mt-2 font-bold uppercase tracking-wider text-slate-400 dark:text-[#64748B]">Risk</div>
      <div className="mt-1 text-slate-500 dark:text-[#94A3B8]">◯ Unknown · ◯ Low · ◯ Medium · ◯ High · ◯ Critical</div>
      <div className="mt-1 font-bold uppercase tracking-wider text-slate-400 dark:text-[#64748B]">Hop</div>
      <div className="mt-1 text-slate-500 dark:text-[#94A3B8]">H0 Target · H1 Direct · H2 Secondary · H3+ Extended</div>
    </div>
  );
}
