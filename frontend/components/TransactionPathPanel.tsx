'use client';

import React, { useState } from 'react';
import {
  Route,
  ChevronDown,
  ChevronUp,
  Download,
  Building2,
  GitBranch,
  ShieldCheck,
  Coins,
  Sparkles,
  Layers,
} from 'lucide-react';
import { OrderedPath } from '../lib/types';
import { PathTimeline } from './PathTimeline';
import { VaspAttributionPanel } from './VaspAttributionPanel';

interface TransactionPathPanelProps {
  paths: OrderedPath[];
  selectedPathIndex: number;
  onSelectPathIndex: (index: number) => void;
  selectedHop: number | null;
  onSelectHop: (hop: number | null) => void;
  onFocusNode?: (nodeId: string) => void;
  onFocusTx?: (txHash: string) => void;
  onTriggerDisclosure?: (vaspName: string) => void;
  className?: string;
}

export const TransactionPathPanel: React.FC<TransactionPathPanelProps> = ({
  paths,
  selectedPathIndex,
  onSelectPathIndex,
  selectedHop,
  onSelectHop,
  onFocusNode,
  onFocusTx,
  onTriggerDisclosure,
  className = '',
}) => {
  const [isExpanded, setIsExpanded] = useState<boolean>(true);

  if (!paths || paths.length === 0) {
    return (
      <div className={`glass-panel p-4 font-mono select-none ${className}`}>
        <div className="flex items-center justify-between border-b border-[#2C2C2E] pb-2.5 mb-3">
          <div className="flex items-center space-x-2">
            <Route className="h-4 w-4 text-[#FF5722]" />
            <h3 className="uppercase font-bold text-white text-xs tracking-wider">
              Transaction Path & VASP Attribution
            </h3>
          </div>
          <span className="text-[10px] uppercase font-bold text-[#8E8E93] bg-[#1C1C1E] px-2 py-0.5 rounded border border-[#2C2C2E]">
            Awaiting Ingestion
          </span>
        </div>
        <div className="p-4 bg-[#161618] border border-[#2C2C2E] rounded-md text-center text-[#8E8E93] space-y-1 text-xs">
          <p className="font-semibold text-white">No Ordered Path Trajectory Loaded</p>
          <p className="text-[11px]">
            Launch a wallet trace or await pipeline completion to inspect hop-by-hop fund movements to attributed exchange clusters.
          </p>
        </div>
      </div>
    );
  }

  const currentPath = paths[selectedPathIndex] || paths[0];

  const handleExportJson = () => {
    try {
      const dataStr = 'data:text/json;charset=utf-8,' + encodeURIComponent(JSON.stringify(paths, null, 2));
      const dlAnchor = document.createElement('a');
      dlAnchor.setAttribute('href', dataStr);
      dlAnchor.setAttribute('download', `attribution_path_${currentPath.path_id || 'trace'}.json`);
      document.body.appendChild(dlAnchor);
      dlAnchor.click();
      dlAnchor.remove();
    } catch (e) {
      console.error('Failed to export path data JSON:', e);
    }
  };

  return (
    <div className={`glass-panel p-4 font-mono space-y-4 select-none ${className}`}>
      {/* Panel Header */}
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[#2C2C2E] pb-3">
        <div className="flex items-center space-x-2.5">
          <div className="p-1.5 rounded bg-[#FF5722]/10 border border-[#FF5722]/30 text-[#FF5722]">
            <Route className="h-4 w-4" />
          </div>
          <div>
            <h3 className="uppercase font-bold text-white text-xs tracking-wider flex items-center space-x-2">
              <span>Transaction Path & VASP Attribution</span>
              <span className="text-[10px] px-1.5 py-0.5 rounded bg-emerald-950/60 text-emerald-400 border border-emerald-500/40">
                {paths.length} Route{paths.length !== 1 ? 's' : ''} Found
              </span>
            </h3>
            <span className="text-[10px] text-[#8E8E93] block">
              Multi-hop chronological trajectory from suspect wallet to terminal deposit clusters
            </span>
          </div>
        </div>

        {/* Action buttons */}
        <div className="flex items-center space-x-2 text-xs">
          <button
            onClick={handleExportJson}
            className="flex items-center space-x-1 py-1 px-2.5 rounded bg-[#1C1C1E] hover:bg-[#252528] text-[#8E8E93] hover:text-white border border-[#2C2C2E] transition-colors text-[11px]"
            title="Download structured trajectory JSON"
          >
            <Download className="h-3 w-3" />
            <span>Export JSON</span>
          </button>

          <button
            onClick={() => setIsExpanded(!isExpanded)}
            className="p-1.5 rounded hover:bg-[#252528] text-[#8E8E93] hover:text-white transition-colors"
            title={isExpanded ? 'Collapse panel' : 'Expand panel'}
          >
            {isExpanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
          </button>
        </div>
      </div>

      {isExpanded && (
        <>
          {/* Path selector tabs if more than 1 route exists */}
          {paths.length > 1 && (
            <div className="flex items-center space-x-2 overflow-x-auto pb-1 scrollbar-thin">
              <span className="text-[10px] uppercase font-bold text-[#8E8E93] shrink-0">Pathways:</span>
              {paths.map((p, idx) => {
                const isActive = idx === selectedPathIndex;
                return (
                  <button
                    key={p.path_id || idx}
                    onClick={() => {
                      onSelectPathIndex(idx);
                      onSelectHop(null);
                    }}
                    className={`flex items-center space-x-1.5 px-2.5 py-1 rounded text-xs transition-all whitespace-nowrap border ${
                      isActive
                        ? 'bg-cyan-950/40 text-cyan-300 border-cyan-500/50 shadow-sm'
                        : 'bg-[#1C1C1E] text-[#8E8E93] hover:text-white border-[#2C2C2E]'
                    }`}
                  >
                    <GitBranch className="h-3 w-3" />
                    <span>Path {idx + 1}: {p.endpoint.name} ({p.total_hops} hop{p.total_hops !== 1 ? 's' : ''})</span>
                  </button>
                );
              })}
            </div>
          )}

          {/* Sequential Timeline Component */}
          <PathTimeline
            path={currentPath}
            selectedHop={selectedHop}
            onSelectHop={onSelectHop}
            onSelectAddress={onFocusNode}
            onSelectTx={onFocusTx}
          />

          {/* Terminal VASP Attribution Details */}
          <div className="pt-2 border-t border-[#2C2C2E]">
            <VaspAttributionPanel
              endpoint={currentPath.endpoint}
              totalHops={currentPath.total_hops}
              totalAmount={currentPath.total_amount}
              token={currentPath.token}
              onFocusVasp={() => onFocusNode?.(currentPath.endpoint.address)}
              onTriggerDisclosure={onTriggerDisclosure}
            />
          </div>
        </>
      )}
    </div>
  );
};
