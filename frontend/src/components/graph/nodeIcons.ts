import { AlertTriangle, Box, CircleHelp, GitBranch, Landmark, Shuffle, Target, WalletCards, type LucideIcon } from 'lucide-react';

export type GraphEntityType = 'target' | 'wallet' | 'exchange' | 'vasp' | 'mixer' | 'bridge' | 'contract' | 'sanctioned' | 'unknown';

export const nodeIconifyNames: Record<GraphEntityType, string> = {
  target: 'lucide:target', wallet: 'lucide:wallet-cards', exchange: 'lucide:landmark', vasp: 'lucide:landmark',
  mixer: 'lucide:shuffle', bridge: 'lucide:git-branch', contract: 'lucide:box', sanctioned: 'lucide:triangle-alert', unknown: 'lucide:circle-help',
};

export const nodeIcons: Record<GraphEntityType, LucideIcon> = {
  target: Target, wallet: WalletCards, exchange: Landmark, vasp: Landmark, mixer: Shuffle,
  bridge: GitBranch, contract: Box, sanctioned: AlertTriangle, unknown: CircleHelp,
};

// ASCII-only glyphs prevent missing-font replacement characters in Cytoscape.
export const nodeIconGlyphs: Record<GraphEntityType, string> = {
  target: 'T', wallet: 'W', exchange: 'E', vasp: 'V', mixer: 'M', bridge: 'B', contract: 'C', sanctioned: '!', unknown: 'N',
};

export function getNodeIcon(entityType: string | undefined): LucideIcon {
  return nodeIcons[(entityType || 'unknown') as GraphEntityType] || nodeIcons.unknown;
}

export function getNodeIconGlyph(entityType: string | undefined): string {
  return nodeIconGlyphs[(entityType || 'unknown') as GraphEntityType] || nodeIconGlyphs.unknown;
}

export function getNodeIconifyName(entityType: string | undefined): string {
  return nodeIconifyNames[(entityType || 'unknown') as GraphEntityType] || nodeIconifyNames.unknown;
}

// Vendored SVGs keep graph icons available offline and avoid remote Iconify failures.
export function getNodeIconifyUrl(entityType: string | undefined, color = 'ffffff'): string {
  const key = (entityType || 'unknown') as GraphEntityType;
  const assetKey = nodeIconifyNames[key] ? key : 'unknown';
  return `/icons/graph/${assetKey}.svg`;
}
