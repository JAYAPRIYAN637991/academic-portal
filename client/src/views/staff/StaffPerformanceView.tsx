import React, { useEffect, useState } from 'react';
import { api } from '../../services/api';
import { DataTable, Column } from '../../components/data/DataTable';
import { SearchFilterBar } from '../../components/data/SearchFilterBar';
import { Pagination } from '../../components/data/Pagination';
import { Badge } from '../../components/common/Badge';
import { ArrowUpRight, ArrowDownRight, Award } from 'lucide-react';

interface AssignedPerfItem {
  student_id: number;
  register_number: string;
  student_name: string;
  subject_code?: string;
  ia1_marks: number;
  ia2_marks: number;
  improvement: number;
  pass_percentage: number;
  status: 'PASSED' | 'FAILED' | 'NEEDS_ATTENTION';
}

export const StaffPerformanceView: React.FC = () => {
  const [data, setData] = useState<AssignedPerfItem[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterStatus, setFilterStatus] = useState('ALL');
  const [isLoading, setIsLoading] = useState(true);

  // Pagination
  const [currentPage, setCurrentPage] = useState(1);
  const pageSize = 12;

  useEffect(() => {
    const fetchPerf = async () => {
      setIsLoading(true);
      try {
        const res: any = await api.get('/staff/performance');
        setData(Array.isArray(res) ? res : res?.students || []);
      } catch (err) {
        console.error('Failed to load performance', err);
      } finally {
        setIsLoading(false);
      }
    };
    fetchPerf();
  }, []);

  const filtered = data.filter((row) => {
    const q = searchQuery.toLowerCase();
    const matchesSearch =
      (row.student_name || '').toLowerCase().includes(q) ||
      (row.register_number || '').toLowerCase().includes(q);
    const matchesStatus = filterStatus === 'ALL' || row.status === filterStatus;
    return matchesSearch && matchesStatus;
  });

  const totalPages = Math.ceil(filtered.length / pageSize) || 1;
  const paginated = filtered.slice((currentPage - 1) * pageSize, currentPage * pageSize);

  const columns: Column<AssignedPerfItem>[] = [
    {
      header: 'Register Number',
      accessor: (row) => <span className="font-mono text-xs font-bold text-indigo-400">{row.register_number}</span>,
    },
    {
      header: 'Student Name',
      accessor: (row) => <span className="font-semibold text-white">{row.student_name}</span>,
    },
    {
      header: 'IA-1 Score',
      accessor: (row) => <span className="font-semibold text-slate-300">{row.ia1_marks ?? 0}%</span>,
    },
    {
      header: 'IA-2 Score',
      accessor: (row) => <span className="font-semibold text-slate-300">{row.ia2_marks ?? 0}%</span>,
    },
    {
      header: 'Improvement',
      accessor: (row) => {
        const diff = row.improvement ?? (row.ia2_marks - row.ia1_marks);
        const isPos = diff >= 0;
        return (
          <div className={`flex items-center gap-1 font-bold text-xs ${isPos ? 'text-emerald-400' : 'text-rose-400'}`}>
            {isPos ? <ArrowUpRight className="w-3.5 h-3.5" /> : <ArrowDownRight className="w-3.5 h-3.5" />}
            <span>{isPos ? `+${diff.toFixed(1)}%` : `${diff.toFixed(1)}%`}</span>
          </div>
        );
      },
    },
    {
      header: 'Standing',
      accessor: (row) => {
        const st = row.status || (row.ia2_marks >= 50 ? 'PASSED' : 'NEEDS_ATTENTION');
        return (
          <Badge variant={st === 'PASSED' ? 'success' : st === 'FAILED' ? 'danger' : 'warning'}>
            {st}
          </Badge>
        );
      },
    },
  ];

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-xl font-bold text-white">Assigned Student Performance</h2>
        <p className="text-xs text-slate-400">
          Individual growth and assessment trends for students in your assigned sections
        </p>
      </div>

      <SearchFilterBar
        searchQuery={searchQuery}
        onSearchChange={(q) => {
          setSearchQuery(q);
          setCurrentPage(1);
        }}
        placeholder="Filter by student name or register number..."
        filters={
          <select
            value={filterStatus}
            onChange={(e) => {
              setFilterStatus(e.target.value);
              setCurrentPage(1);
            }}
            className="px-3 py-2 bg-slate-900 border border-slate-700/80 rounded-lg text-xs text-slate-200 focus:outline-none focus:border-emerald-500"
          >
            <option value="ALL">All Standings</option>
            <option value="PASSED">Passed</option>
            <option value="NEEDS_ATTENTION">Needs Attention</option>
            <option value="FAILED">Failed</option>
          </select>
        }
      />

      <DataTable
        columns={columns}
        data={paginated}
        isLoading={isLoading}
        keyExtractor={(item) => item.student_id || item.register_number}
        emptyTitle="No Performance Records"
        emptyDescription="Performance data will calculate once marks are uploaded."
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
