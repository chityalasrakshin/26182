import React from 'react';

export type RiskLevel = 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW';

export interface StatusBadgeProps {
  level: RiskLevel | string;
  size?: 'sm' | 'md';
  label?: string;
  className?: string;
}

export const StatusBadge: React.FC<StatusBadgeProps> = ({
  level,
  size = 'md',
  label,
  className = '',
}) => {
  const norm = (level || 'LOW').toUpperCase();

  const config: Record<
    string,
    { icon: string; classes: string; defaultLabel: string }
  > = {
    CRITICAL: {
      icon: '▲',
      classes: 'bg-rose-50 text-rose-700 border-rose-200',
      defaultLabel: 'CRITICAL',
    },
    HIGH: {
      icon: '●',
      classes: 'bg-orange-50 text-orange-700 border-orange-200',
      defaultLabel: 'HIGH',
    },
    MEDIUM: {
      icon: '◐',
      classes: 'bg-amber-50 text-amber-700 border-amber-200',
      defaultLabel: 'MEDIUM',
    },
    LOW: {
      icon: '○',
      classes: 'bg-emerald-50 text-emerald-700 border-emerald-200',
      defaultLabel: 'LOW',
    },
  };

  const item = config[norm] || config.LOW;
  const sizeClasses =
    size === 'sm'
      ? 'px-2 py-0.5 text-[9px] gap-1'
      : 'px-2.5 py-0.5 text-[10px] gap-1.5';

  return (
    <span
      className={`inline-flex items-center font-mono font-bold uppercase rounded-full border ${sizeClasses} ${item.classes} ${className}`}
    >
      <span className="text-[8px] leading-none">{item.icon}</span>
      <span>{label || item.defaultLabel}</span>
    </span>
  );
};
