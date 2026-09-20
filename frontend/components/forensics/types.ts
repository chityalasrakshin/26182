import { Node, Edge } from '@xyflow/react';

export type ForensicsChain = 'BTC' | 'ETH' | 'Tron' | 'Solana' | 'Polygon';
export type LayoutDirection = 'LR' | 'TB';

export interface SuspectNodeData extends Record<string, unknown> {
  id: string;
  label: string;
  address: string;
  chain: ForensicsChain;
  isRoot?: boolean;
  isSanctioned?: boolean;
  isExploit?: boolean;
  outflowVolume: number;
  inflowVolume: number;
  nativeSymbol: string;
  riskScore: number;
  threatLevel: 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW';
  entityName?: string;
  txCount?: number;
}

export interface MixerNodeData extends Record<string, unknown> {
  id: string;
  label: string;
  address: string;
  chain: ForensicsChain;
  hopNumber: number;
  taintPercentage: number;
  typologyBadge: string; // e.g. 'Wasabi Peeling' | 'Tornado Intermediary' | 'Cross-Chain Bridge'
  poolType?: string;
  volume: number;
  nativeSymbol: string;
  txCount?: number;
}

export interface VaspNodeData extends Record<string, unknown> {
  id: string;
  label: string;
  address: string;
  chain: ForensicsChain;
  exchangeName: string; // e.g. 'Binance' | 'Coinbase' | 'WazirX' | 'CoinDCX'
  custodialStatus: string; // e.g. 'CUSTODIAL VASP' | 'FIU-IND REGISTERED'
  confidenceScore: number; // 0-100
  hopDistance: number;
  fiuRegistered: boolean;
  nodalOfficer?: string;
  complianceEmail?: string;
  depositVolume: number;
  nativeSymbol: string;
  sahyogRoutingCode?: string;
  fiuRegNumber?: string;
  txCount?: number;
}

export interface AnimatedFlowEdgeData extends Record<string, unknown> {
  amount: number;
  amountUsd: number;
  nativeSymbol: string;
  isTainted?: boolean;
  txCount?: number;
  txHash?: string;
  timestamp?: string;
}

export type ForensicsNode =
  | Node<SuspectNodeData, 'suspect'>
  | Node<MixerNodeData, 'mixer'>
  | Node<VaspNodeData, 'vasp'>;

export type ForensicsEdge = Edge<AnimatedFlowEdgeData, 'animatedFlow'>;

export interface ForensicsTransactionRow {
  id: string;
  timestamp: string;
  txHash: string;
  fromAddress: string;
  fromLabel?: string;
  toAddress: string;
  toLabel?: string;
  assetType: string;
  amount: number;
  amountUsd: number;
  riskLabel: string;
  riskSeverity: 'critical' | 'high' | 'medium' | 'low';
}

export interface CasePreset {
  id: string;
  title: string;
  description: string;
  targetAddress: string;
  chain: ForensicsChain;
  typology: string;
  nodes: ForensicsNode[];
  edges: ForensicsEdge[];
  transactions: ForensicsTransactionRow[];
}
