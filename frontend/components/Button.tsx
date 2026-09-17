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
      'bg-[#E5FF8F] hover:bg-[#EDFFB1] text-[#0A0A0A] shadow-[0_0_15px_rgba(229,255,143,0.25)] active:scale-95 font-bold',
    secondary:
      'bg-[#1A1A1A] hover:bg-[#222222] text-[#FFFFFF] border border-[#2A2A2A] hover:border-[#E5FF8F]/60 shadow-sm active:scale-95',
    danger:
      'bg-[#FF5C5C] hover:bg-[#ff7070] text-white shadow-[0_0_15px_rgba(255,92,92,0.25)] active:scale-95',
    ghost:
      'bg-transparent hover:bg-[#1A1A1A] text-[#9A9A9A] hover:text-[#FFFFFF] border border-transparent',
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
