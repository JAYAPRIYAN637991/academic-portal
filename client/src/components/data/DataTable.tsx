import React from 'react';
import { EmptyState } from './EmptyState';
import { SkeletonRow } from './SkeletonLoader';

export interface Column<T> {
  header: string | React.ReactNode;
  accessor?: keyof T | ((row: T) => React.ReactNode);
  className?: string;
  headerClassName?: string;
}

interface DataTableProps<T> {
  columns: Column<T>[];
  data: T[];
  isLoading?: boolean;
  emptyTitle?: string;
  emptyDescription?: string;
  emptyActionLabel?: string;
  onEmptyAction?: () => void;
  keyExtractor: (row: T, index: number) => string | number;
  onRowClick?: (row: T) => void;
  className?: string;
}

export function DataTable<T>({
  columns,
  data,
  isLoading = false,
  emptyTitle,
  emptyDescription,
  emptyActionLabel,
  onEmptyAction,
  keyExtractor,
  onRowClick,
  className = '',
}: DataTableProps<T>) {
  if (isLoading) {
    return (
      <div className={`w-full overflow-x-auto rounded-xl border border-slate-800 bg-slate-900/60 shadow-md ${className}`}>
        <table className="w-full text-left border-collapse text-sm">
          <thead className="bg-slate-950/80 text-xs font-semibold uppercase tracking-wider text-slate-400 border-b border-slate-800">
            <tr>
              {columns.map((col, idx) => (
                <th key={idx} className={`py-3.5 px-4 ${col.headerClassName || ''}`}>
                  {col.header}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {Array.from({ length: 6 }).map((_, i) => (
              <SkeletonRow key={i} cols={columns.length} />
            ))}
          </tbody>
        </table>
      </div>
    );
  }

  if (!data || data.length === 0) {
    return (
      <EmptyState
        title={emptyTitle}
        description={emptyDescription}
        actionLabel={emptyActionLabel}
        onAction={onEmptyAction}
      />
    );
  }

  return (
    <div className={`w-full overflow-x-auto rounded-xl border border-slate-800 bg-slate-900/60 shadow-md ${className}`}>
      <table className="w-full text-left border-collapse text-sm">
        <thead className="bg-slate-950/80 text-xs font-semibold uppercase tracking-wider text-slate-400 border-b border-slate-800">
          <tr>
            {columns.map((col, idx) => (
              <th key={idx} className={`py-3.5 px-4 ${col.headerClassName || ''}`}>
                {col.header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-800/60 text-slate-300">
          {data.map((row, rowIdx) => (
            <tr
              key={keyExtractor(row, rowIdx)}
              onClick={() => onRowClick && onRowClick(row)}
              className={`transition-colors hover:bg-slate-800/40 ${onRowClick ? 'cursor-pointer' : ''}`}
            >
              {columns.map((col, colIdx) => {
                let content: React.ReactNode = null;
                if (typeof col.accessor === 'function') {
                  content = col.accessor(row);
                } else if (col.accessor) {
                  content = (row as any)[col.accessor];
                }

                return (
                  <td key={colIdx} className={`py-3.5 px-4 ${col.className || ''}`}>
                    {content}
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
