'use client';

import React from 'react';
import { BaseEdge, EdgeLabelRenderer, EdgeProps, getBezierPath } from '@xyflow/react';
import { AnimatedFlowEdgeData } from '../types';

export const AnimatedFlowEdge: React.FC<EdgeProps> = ({
  id,
  sourceX,
  sourceY,
  targetX,
  targetY,
  sourcePosition,
  targetPosition,
  markerEnd,
  data,
}) => {
  const [edgePath, labelX, labelY] = getBezierPath({
    sourceX,
    sourceY,
    sourcePosition,
    targetX,
    targetY,
    targetPosition,
  });

  const edgeData = data as AnimatedFlowEdgeData | undefined;
  const isTainted = edgeData?.isTainted ?? false;
  const amount = edgeData?.amount ?? 0;
  const symbol = edgeData?.nativeSymbol || 'ETH';
  const amountUsd = edgeData?.amountUsd ?? (amount * 3400);

  return (
    <>
      {/* Background glow path */}
      <path
        id={`${id}-bg`}
        d={edgePath}
        fill="none"
        stroke={isTainted ? 'rgba(245, 158, 11, 0.2)' : 'rgba(16, 185, 129, 0.2)'}
        strokeWidth={5}
      />

      {/* Static track line */}
      <path
        id={`${id}-track`}
        d={edgePath}
        fill="none"
        stroke="#1E293B"
        strokeWidth={2}
      />

      {/* Animated directional dashed fund-flow line */}
      <path
        id={id}
        d={edgePath}
        fill="none"
        stroke={isTainted ? '#F59E0B' : '#10B981'}
        strokeWidth={2.5}
        strokeDasharray="6 6"
        className="animated-flow-dash"
        markerEnd={markerEnd}
      />

      {/* Edge Label Renderer with Token Amount + USD Value */}
      <EdgeLabelRenderer>
        <div
          style={{
            position: 'absolute',
            transform: `translate(-50%, -50%) translate(${labelX}px,${labelY}px)`,
            pointerEvents: 'all',
          }}
          className="nodrag nopan"
        >
          <div
            className={`px-2 py-1 rounded-md text-[10px] font-mono font-semibold border backdrop-blur-md shadow-lg transition-transform hover:scale-105 select-none ${
              isTainted
                ? 'bg-slate-950/90 text-amber-300 border-amber-500/40 shadow-amber-950/50'
                : 'bg-slate-950/90 text-emerald-300 border-emerald-500/40 shadow-emerald-950/50'
            }`}
          >
            <div className="flex items-center space-x-1 whitespace-nowrap">
              <span>{amount > 0 ? amount.toLocaleString(undefined, { maximumFractionDigits: 4 }) : '0.00'}</span>
              <span className="opacity-80">{symbol}</span>
            </div>
            {amountUsd > 0 && (
              <div className="text-[9px] text-slate-400 font-normal text-center whitespace-nowrap">
                ≈ ${amountUsd.toLocaleString(undefined, { maximumFractionDigits: 0 })}
              </div>
            )}
          </div>
        </div>
      </EdgeLabelRenderer>

      <style jsx global>{`
        @keyframes flowDash {
          from {
            stroke-dashoffset: 24;
          }
          to {
            stroke-dashoffset: 0;
          }
        }
        .animated-flow-dash {
          animation: flowDash 1.2s linear infinite;
        }
      `}</style>
    </>
  );
};
