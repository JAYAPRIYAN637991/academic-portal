import React from 'react';

interface BadgeProps {
  children: React.ReactNode;
  variant?: 'primary' | 'success' | 'warning' | 'danger' | 'neutral' | 'info';
  size?: 'sm' | 'md';
  className?: string;
}

export const Badge: React.FC<BadgeProps> = ({
  children,
  variant = 'neutral',
  size = 'md',
  className = '',
}) => {
  const baseStyles = 'inline-flex items-center font-medium rounded-full border select-none tracking-wide';

  const variants = {
    primary: 'bg-indigo-950/80 border-indigo-700/50 text-indigo-300',
    success: 'bg-emerald-950/80 border-emerald-700/50 text-emerald-300',
    warning: 'bg-amber-950/80 border-amber-700/50 text-amber-300',
    danger: 'bg-rose-950/80 border-rose-700/50 text-rose-300',
    neutral: 'bg-slate-800/80 border-slate-700 text-slate-300',
    info: 'bg-sky-950/80 border-sky-700/50 text-sky-300',
  };

  const sizes = {
    sm: 'px-2 py-0.5 text-[10px]',
    md: 'px-2.5 py-1 text-xs',
  };

  return (
    <span className={`${baseStyles} ${variants[variant]} ${sizes[size]} ${className}`}>
      {children}
    </span>
  );
};
