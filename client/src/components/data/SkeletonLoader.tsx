import React from 'react';

export const SkeletonRow: React.FC<{ cols?: number }> = ({ cols = 5 }) => {
  return (
    <tr className="animate-pulse border-b border-slate-800/60">
      {Array.from({ length: cols }).map((_, i) => (
        <td key={i} className="py-3.5 px-4">
          <div className="h-4 bg-slate-800/80 rounded-md w-3/4"></div>
        </td>
      ))}
    </tr>
  );
};

export const SkeletonCard: React.FC = () => {
  return (
    <div className="p-5 rounded-xl border border-slate-800/70 bg-slate-900/60 animate-pulse">
      <div className="flex items-center justify-between mb-3">
        <div className="h-3.5 bg-slate-800 rounded w-1/3"></div>
        <div className="w-8 h-8 rounded-lg bg-slate-800"></div>
      </div>
      <div className="h-7 bg-slate-800 rounded w-1/2 mb-2"></div>
      <div className="h-3 bg-slate-800/50 rounded w-2/3"></div>
    </div>
  );
};

export const SkeletonTable: React.FC<{ rows?: number; cols?: number }> = ({ rows = 5, cols = 5 }) => {
  return (
    <div className="w-full overflow-hidden rounded-xl border border-slate-800 bg-slate-900/40">
      <table className="w-full">
        <thead className="bg-slate-950/60 border-b border-slate-800">
          <tr>
            {Array.from({ length: cols }).map((_, i) => (
              <th key={i} className="py-3 px-4">
                <div className="h-3.5 bg-slate-800 rounded w-1/2"></div>
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {Array.from({ length: rows }).map((_, i) => (
            <SkeletonRow key={i} cols={cols} />
          ))}
        </tbody>
      </table>
    </div>
  );
};
