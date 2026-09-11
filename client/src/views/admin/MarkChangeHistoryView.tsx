import React, { useEffect, useState } from 'react';
import { api } from '../../services/api';
import { MarkChangeLog } from '../../types';
import { DataTable, Column } from '../../components/data/DataTable';
import { SearchFilterBar } from '../../components/data/SearchFilterBar';
import { Pagination } from '../../components/data/Pagination';
import { Badge } from '../../components/common/Badge';
import { ClipboardList, Clock, ArrowRight, UserCheck } from 'lucide-react';

export const MarkChangeHistoryView: React.FC = () => {
  const [logs, setLogs] = useState<MarkChangeLog[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [isLoading, setIsLoading] = useState(true);

  // Pagination
  const [currentPage, setCurrentPage] = useState(1);
  const pageSize = 12;

  const fetchLogs = async () => {
    setIsLoading(true);
    try {
      const res: any = await api.get('/marks/history');
      setLogs(Array.isArray(res) ? res : res?.history || []);
    } catch (err) {
      console.error('Failed to load mark change logs', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchLogs();
  }, []);

  const filtered = logs.filter((l) => {
    const q = searchQuery.toLowerCase();
    return (
      (l.student_name || '').toLowerCase().includes(q) ||
      (l.register_number || '').toLowerCase().includes(q) ||
      (l.changed_by || '').toLowerCase().includes(q) ||
      (l.subject_code || '').toLowerCase().includes(q) ||
      (l.change_reason || '').toLowerCase().includes(q)
    );
  });

  const totalPages = Math.ceil(filtered.length / pageSize) || 1;
  const paginated = filtered.slice((currentPage - 1) * pageSize, currentPage * pageSize);

  const columns: Column<MarkChangeLog>[] = [
    {
      header: 'Student',
      accessor: (row) => (
        <div>
          <span className="font-semibold text-white block">{row.student_name}</span>
          <span className="font-mono text-xs text-indigo-400">{row.register_number}</span>
        </div>
      ),
    },
    {
      header: 'Course & Exam',
      accessor: (row) => (
        <div>
          <span className="font-mono text-xs font-bold text-slate-300 block">{row.subject_code}</span>
          <Badge variant="primary" size="sm">
            {row.assessment_name}
          </Badge>
        </div>
      ),
    },
    {
      header: 'Marks Modification',
      accessor: (row) => (
        <div className="flex items-center gap-2 text-xs font-bold">
          <span className="text-slate-400 line-through">{row.old_marks}</span>
          <ArrowRight className="w-3 h-3 text-slate-400" />
          <span className={row.new_marks > row.old_marks ? 'text-emerald-400' : 'text-rose-400'}>
            {row.new_marks}
          </span>
        </div>
      ),
    },
    {
      header: 'Authorized By',
      accessor: (row) => (
        <div className="flex items-center gap-1.5 text-xs text-slate-300">
          <UserCheck className="w-3.5 h-3.5 text-indigo-400" />
          <span>{row.changed_by}</span>
        </div>
      ),
    },
    {
      header: 'Reason / Justification',
      accessor: (row) => (
        <span className="text-xs text-slate-300 italic">{row.change_reason || 'Re-evaluation'}</span>
      ),
    },
    {
      header: 'Timestamp',
      accessor: (row) => (
        <div className="flex items-center gap-1 text-xs text-slate-400">
          <Clock className="w-3 h-3" />
          <span>{row.changed_at ? new Date(row.changed_at).toLocaleString() : 'Recent'}</span>
        </div>
      ),
    },
  ];

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-xl font-bold text-white">Mark Change Audit Trail</h2>
        <p className="text-xs text-slate-400">
          Complete, tamper-evident historical audit log of all assessment score alterations
        </p>
      </div>

      <SearchFilterBar
        searchQuery={searchQuery}
        onSearchChange={(q) => {
          setSearchQuery(q);
          setCurrentPage(1);
        }}
        placeholder="Search audit trail by student, faculty, course code, or reason..."
        onRefresh={fetchLogs}
        isRefreshing={isLoading}
      />

      <DataTable
        columns={columns}
        data={paginated}
        isLoading={isLoading}
        keyExtractor={(l, idx) => l.id || idx}
        emptyTitle="No Mark Changes Recorded"
        emptyDescription="All mark alterations made by staff or administrators will be logged here with mandatory justifications."
      />

      <Pagination
        currentPage={currentPage}
        totalPages={totalPages}
        totalItems={filtered.length}
        pageSize={pageSize}
        onPageChange={setCurrentPage}
      />
    </div>
  );
};
