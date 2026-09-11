import React from 'react';

interface CardProps {
  children: React.ReactNode;
  className?: string;
  title?: string | React.ReactNode;
  subtitle?: string | React.ReactNode;
  icon?: React.ReactNode;
  action?: React.ReactNode;
}

export const Card: React.FC<CardProps> = ({
  children,
  className = '',
  title,
  subtitle,
  icon,
  action,
}) => {
  return (
    <div className={`bg-slate-900/80 backdrop-blur-md border border-slate-800/80 rounded-xl p-5 shadow-lg shadow-black/20 ${className}`}>
      {(title || action || icon) && (
        <div className="flex items-start justify-between gap-4 mb-4 pb-3 border-b border-slate-800/60">
          <div className="flex items-center gap-3">
            {icon && <div className="p-2 rounded-lg bg-slate-800/70 text-indigo-400 border border-slate-700/50">{icon}</div>}
            <div>
              {typeof title === 'string' ? (
                <h3 className="font-semibold text-slate-100 text-base">{title}</h3>
              ) : (
                title
              )}
              {subtitle && <p className="text-xs text-slate-400 mt-0.5">{subtitle}</p>}
            </div>
          </div>
          {action && <div className="shrink-0">{action}</div>}
        </div>
      )}
      <div>{children}</div>
    </div>
  );
};
