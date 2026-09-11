import React, { useState, useEffect } from 'react';
import { api } from '../../services/api';
import { StudentImportHistoryItem } from '../../types';
import { Modal } from '../common/Modal';
import { Button } from '../common/Button';
import { Badge } from '../common/Badge';
import { useToast } from '../../context/ToastContext';
import {
  History,
  FileSpreadsheet,
  Clock,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  Eye,
  RefreshCw,
  User,
  ChevronDown,
  ChevronUp
} from 'lucide-react';

interface StudentImportHistoryModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const StudentImportHistoryModal: React.FC<StudentImportHistoryModalProps> = ({
  isOpen,
  onClose,
}) => {
  const { error: toastError } = useToast();
  const [history, setHistory] = useState<StudentImportHistoryItem[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const fetchHistory = async (targetPage = 1) => {
    setIsLoading(true);
    try {
      const res = await api.get<{
        history: StudentImportHistoryItem[];
        total: number;
        page: number;
        totalPages: number;
      }>(`/admin/students/import/history?page=${targetPage}&limit=10`);
      setHistory(res.history || []);
      setPage(res.page || 1);
      setTotalPages(res.totalPages || 1);
    } catch (err: any) {
      toastError('Failed to Load History', err.message || 'Could not fetch import history.');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      fetchHistory(1);
    }
  }, [isOpen]);

  const toggleExpand = (id: string) => {
    setExpandedId(expandedId === id ? null : id);
  };

  const getStatusBadge = (status: StudentImportHistoryItem['status']) => {
    switch (status) {
      case 'COMPLETED':
        return (
          <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-400 bg-emerald-950/60 border border-emerald-800/60 px-2 py-0.5 rounded-full">
            <CheckCircle2 className="w-3 h-3" /> Completed
          </span>
        );
      case 'COMPLETED_WITH_ERRORS':
        return (
          <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-amber-400 bg-amber-950/60 border border-amber-800/60 px-2 py-0.5 rounded-full">
            <AlertTriangle className="w-3 h-3" /> Partial
          </span>
        );
      case 'FAILED':
        return (
          <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-rose-400 bg-rose-950/60 border border-rose-800/60 px-2 py-0.5 rounded-full">
            <XCircle className="w-3 h-3" /> Failed
          </span>
        );
      default:
        return <Badge variant="neutral">{status}</Badge>;
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Student Import Audit Ledger"
      subtitle="Complete chronological history of bulk spreadsheet uploads, validation logs, and diagnostic traces"
      maxWidth="5xl"
    >
      <div className="space-y-4">
        {/* Header Controls */}
        <div className="flex items-center justify-between">
          <div className="text-xs text-slate-400">
            Audit ledger stores full error logs and duplicate resolution decisions for all imports.
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={() => fetchHistory(page)}
            disabled={isLoading}
            leftIcon={<RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin' : ''}`} />}
          >
            Refresh Ledger
          </Button>
        </div>

        {/* History List Table */}
        <div className="border border-slate-800 rounded-xl overflow-hidden bg-slate-950/60">
          {isLoading && history.length === 0 ? (
            <div className="py-12 text-center text-slate-400 text-xs flex items-center justify-center gap-2">
              <RefreshCw className="w-4 h-4 animate-spin text-indigo-400" />
              Loading audit records...
            </div>
          ) : history.length === 0 ? (
            <div className="py-12 text-center text-slate-400 text-xs">
              No bulk student imports recorded yet. Use "Bulk Import" to upload your first batch.
            </div>
          ) : (
            <div className="divide-y divide-slate-800/60">
              {history.map((item) => {
                const isExpanded = expandedId === item.id;
                const errorLog = item.errorLog || [];

                return (
                  <div key={item.id} className="transition-colors hover:bg-slate-900/30">
                    <div
                      onClick={() => toggleExpand(item.id)}
                      className="p-4 cursor-pointer flex flex-col md:flex-row md:items-center justify-between gap-3"
                    >
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <FileSpreadsheet className="w-4 h-4 text-indigo-400 shrink-0" />
                          <span className="text-sm font-semibold text-white">{item.fileName}</span>
                          {getStatusBadge(item.status)}
                          <span className="text-[10px] bg-slate-800 text-slate-300 px-1.5 py-0.5 rounded font-mono">
                            Mode: {item.duplicateMode}
                          </span>
                        </div>
                        <div className="flex items-center gap-3 text-[11px] text-slate-400">
                          <span className="flex items-center gap-1">
                            <Clock className="w-3 h-3 text-slate-500" />
                            {new Date(item.createdAt).toLocaleString()}
                          </span>
                          {item.uploader && (
                            <span className="flex items-center gap-1">
                              <User className="w-3 h-3 text-slate-500" />
                              {item.uploader.name}
                            </span>
                          )}
                          <span>Speed: {item.processingTimeMs}ms</span>
                        </div>
                      </div>

                      {/* Stat Metrics Grid */}
                      <div className="flex items-center gap-3 shrink-0">
                        <div className="grid grid-cols-4 gap-2 text-center font-mono text-xs">
                          <div className="px-2 py-1 bg-slate-900 rounded border border-slate-800">
                            <div className="text-[10px] text-slate-400 uppercase font-sans">Total</div>
                            <div className="font-bold text-white">{item.totalRows}</div>
                          </div>
                          <div className="px-2 py-1 bg-emerald-950/40 rounded border border-emerald-800/40">
                            <div className="text-[10px] text-emerald-400 uppercase font-sans">Added</div>
                            <div className="font-bold text-emerald-300">{item.importedRows}</div>
                          </div>
                          <div className="px-2 py-1 bg-indigo-950/40 rounded border border-indigo-800/40">
                            <div className="text-[10px] text-indigo-400 uppercase font-sans">Updated</div>
                            <div className="font-bold text-indigo-300">{item.duplicateRows}</div>
                          </div>
                          <div className="px-2 py-1 bg-rose-950/40 rounded border border-rose-800/40">
                            <div className="text-[10px] text-rose-400 uppercase font-sans">Failed</div>
                            <div className="font-bold text-rose-300">{item.failedRows}</div>
                          </div>
                        </div>

                        <button
                          className="p-1 rounded text-slate-400 hover:text-white"
                          title="Toggle Error Log & Diagnostics"
                        >
                          {isExpanded ? <ChevronUp className="w-5 h-5" /> : <ChevronDown className="w-5 h-5" />}
                        </button>
                      </div>
                    </div>

                    {/* Expandable Diagnostics Drawer */}
                    {isExpanded && (
                      <div className="px-4 pb-4 pt-1 bg-slate-950/90 border-t border-slate-800/80 space-y-3">
                        <div className="flex items-center justify-between text-xs font-semibold text-slate-300">
                          <span>Audit Diagnostics &amp; Row Problem Trace ({errorLog.length} items logged)</span>
                          <span className="text-[11px] font-mono text-slate-500">ID: {item.id}</span>
                        </div>

                        {errorLog.length === 0 ? (
                          <div className="p-3 bg-slate-900/60 rounded-lg text-xs text-slate-400">
                            Zero validation errors were recorded during this import execution. All records passed
                            14-point schema inspection cleanly.
                          </div>
                        ) : (
                          <div className="max-h-48 overflow-y-auto space-y-1.5 border border-slate-800 rounded-lg p-2 bg-slate-900/40 text-xs">
                            {errorLog.map((log, idx) => (
                              <div
                                key={idx}
                                className="p-2 bg-slate-950 rounded border border-slate-800/80 flex flex-col sm:flex-row sm:items-center justify-between gap-2"
                              >
                                <div className="flex items-start gap-2">
                                  <span className="px-1.5 py-0.5 rounded bg-rose-950 text-rose-300 font-mono text-[10px] shrink-0">
                                    Row {log.rowNumber || '-'}
                                  </span>
                                  {log.registerNumber && (
                                    <span className="font-mono font-bold text-indigo-300 text-[11px]">
                                      [{log.registerNumber}]
                                    </span>
                                  )}
                                  <span className="text-slate-200">{log.problem}</span>
                                </div>
                                {log.suggestedCorrection && (
                                  <span className="text-[11px] text-amber-300/90 italic shrink-0">
                                    Suggestion: {log.suggestedCorrection}
                                  </span>
                                )}
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex items-center justify-between text-xs text-slate-400 pt-1">
            <span>
              Page {page} of {totalPages}
            </span>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => fetchHistory(page - 1)}
                disabled={page <= 1 || isLoading}
              >
                Previous
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => fetchHistory(page + 1)}
                disabled={page >= totalPages || isLoading}
              >
                Next
              </Button>
            </div>
          </div>
        )}

        <div className="flex justify-end pt-2 border-t border-slate-800">
          <Button variant="outline" onClick={onClose}>
            Close
          </Button>
        </div>
      </div>
    </Modal>
  );
};
