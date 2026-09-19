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
      classes: 'bg-[#FF5C5C]/15 text-[#FF5C5C] border-[#FF5C5C]/30',
      defaultLabel: 'CRITICAL',
    },
    HIGH: {
      icon: '●',
      classes: 'bg-[#FF5C5C]/15 text-[#FF5C5C] border-[#FF5C5C]/30',
      defaultLabel: 'HIGH',
    },
    MEDIUM: {
      icon: '◐',
      classes: 'bg-[#E5D34F]/15 text-[#E5D34F] border-[#E5D34F]/30',
      defaultLabel: 'MEDIUM',
    },
    LOW: {
      icon: '○',
      classes: 'bg-[#7CFF6B]/15 text-[#7CFF6B] border-[#7CFF6B]/30',
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
