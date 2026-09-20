import React from 'react';

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'danger' | 'ghost';
  size?: 'xs' | 'sm' | 'md' | 'lg';
  icon?: React.ReactNode;
  children?: React.ReactNode;
}

export const Button: React.FC<ButtonProps> = ({
  variant = 'primary',
  size = 'md',
  icon,
  children,
  className = '',
  disabled = false,
  ...props
}) => {
  const baseClasses =
    'inline-flex items-center justify-center font-bold rounded-full font-sans transition-all duration-150 disabled:opacity-50 disabled:cursor-not-allowed select-none';

  const sizeClasses = {
    xs: 'px-2.5 py-1 text-[10px] gap-1',
    sm: 'px-3 py-1.5 text-xs gap-1.5',
    md: 'px-4 py-2 text-xs gap-2',
    lg: 'px-5 py-2.5 text-sm gap-2',
  }[size];

  const variantClasses = {
    primary:
      'bg-[#0284C7] hover:bg-[#0369A1] text-white shadow-sm active:scale-95 font-bold',
    secondary:
      'bg-white hover:bg-[#F8FAFC] text-[#334155] border border-[#CBD5E1] hover:border-[#94A3B8] shadow-sm active:scale-95',
    danger:
      'bg-[#EF4444] hover:bg-[#DC2626] text-white shadow-sm active:scale-95',
    ghost:
      'bg-transparent hover:bg-[#F1F5F9] text-[#64748B] hover:text-[#0F172A] border border-transparent',
  }[variant];

  return (
    <button
      className={`${baseClasses} ${sizeClasses} ${variantClasses} ${className}`}
      disabled={disabled}
      {...props}
    >
      {icon && <span className="shrink-0">{icon}</span>}
      {children}
    </button>
  );
};
