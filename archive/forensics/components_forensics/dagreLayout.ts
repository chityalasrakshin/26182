import dagre from 'dagre';
import { Node, Edge, Position } from '@xyflow/react';
import { LayoutDirection } from './types';

export const FORENSICS_NODE_WIDTH = 280;
export const FORENSICS_NODE_HEIGHT = 160;

/**
 * Computes deterministic Left-to-Right (LR) or Top-to-Bottom (TB) positions
 * using Dagre graph layout before React Flow mounts.
 */
export function computeDagreLayout<N extends Node, E extends Edge>(
  nodes: N[],
  edges: E[],
  direction: LayoutDirection = 'LR'
): { nodes: N[]; edges: E[] } {
  if (!nodes || nodes.length === 0) {
    return { nodes: [], edges: [] };
  }

  const dagreGraph = new dagre.graphlib.Graph();
  dagreGraph.setDefaultEdgeLabel(() => ({}));

  const isHorizontal = direction === 'LR';
  dagreGraph.setGraph({
    rankdir: direction,
    nodesep: 60,
    ranksep: 100,
    align: 'DL',
    marginx: 40,
    marginy: 40,
  });

  nodes.forEach((node) => {
    dagreGraph.setNode(node.id, {
      width: FORENSICS_NODE_WIDTH,
      height: FORENSICS_NODE_HEIGHT,
    });
  });

  edges.forEach((edge) => {
    dagreGraph.setEdge(edge.source, edge.target);
  });

  dagre.layout(dagreGraph);

  const layoutedNodes = nodes.map((node) => {
    const dagreNode = dagreGraph.node(node.id);

    // Fallback if dagre didn't place node
    const cx = dagreNode ? dagreNode.x : 0;
    const cy = dagreNode ? dagreNode.y : 0;

    // React Flow positions are top-left anchored; Dagre returns center coordinates
    const x = Math.round(cx - FORENSICS_NODE_WIDTH / 2);
    const y = Math.round(cy - FORENSICS_NODE_HEIGHT / 2);

    return {
      ...node,
      targetPosition: isHorizontal ? Position.Left : Position.Top,
      sourcePosition: isHorizontal ? Position.Right : Position.Bottom,
      position: { x, y },
    };
  });

  return { nodes: layoutedNodes, edges };
}
