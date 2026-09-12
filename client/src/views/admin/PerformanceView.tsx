import React, { useEffect, useState } from 'react';
import { api, unpackList } from '../../services/api';
import { Department, YearSection } from '../../types';
import { DataTable, Column } from '../../components/data/DataTable';
import { SearchFilterBar } from '../../components/data/SearchFilterBar';
import { Pagination } from '../../components/data/Pagination';
import { Badge } from '../../components/common/Badge';
import { Button } from '../../components/common/Button';
import { useToast } from '../../context/ToastContext';
import { TrendingUp, ArrowUpRight, ArrowDownRight, Award, FileText } from 'lucide-react';

interface StudentPerfRow {
  student_id: number;
  register_number: string;
  student_name: string;
  department: string;
  year: number;
  section: string;
  ia1_marks: number;
  ia2_marks: number;
  improvement: number;
  pass_percentage: number;
  status: string;
}

export const PerformanceView: React.FC = () => {
  const { error } = useToast();
  const [data, setData] = useState<StudentPerfRow[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [sections, setSections] = useState<YearSection[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterDept, setFilterDept] = useState('ALL');
  const [filterStatus, setFilterStatus] = useState('ALL');
  const [isLoading, setIsLoading] = useState(true);

  // Pagination
  const [currentPage, setCurrentPage] = useState(1);
  const pageSize = 12;

  const fetchPerformance = async () => {
    setIsLoading(true);
    try {
      const [perfRes, deptRes, secRes]: any = await Promise.all([
        api.get('/analytics/performance').catch(() => api.get('/analytics/performance/overview').catch(() => null)),
        api.get('/departments').catch(() => api.get('/admin/departments')),
        api.get('/sections').catch(() => api.get('/admin/sections')),
      ]);

      const records = Array.isArray(perfRes) ? perfRes : (perfRes?.students || perfRes?.records || perfRes?.data || []);
      setData(records);
      setDepartments(unpackList<Department>(deptRes, 'departments'));
      setSections(unpackList<YearSection>(secRes, 'sections'));
    } catch (err: any) {
      error('Failed to load performance metrics', err.message);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchPerformance();
  }, []);

  const filtered = data.filter((row) => {
    const q = searchQuery.toLowerCase();
    const matchesSearch =
      (row.student_name || '').toLowerCase().includes(q) ||
      (row.register_number || '').toLowerCase().includes(q);

    const matchesDept = filterDept === 'ALL' || (row.department && row.department.includes(filterDept));
    const matchesStatus = filterStatus === 'ALL' || row.status === filterStatus;

    return matchesSearch && matchesDept && matchesStatus;
  });

  const totalPages = Math.ceil(filtered.length / pageSize) || 1;
  const paginated = filtered.slice((currentPage - 1) * pageSize, currentPage * pageSize);

  const columns: Column<StudentPerfRow>[] = [
    {
      header: 'Register Number',
      accessor: (row) => (
        <span className="font-mono text-xs font-bold text-indigo-400">{row.register_number}</span>
      ),
    },
    {
      header: 'Student Name',
      accessor: (row) => (
        <div>
          <span className="font-semibold text-white block">{row.student_name}</span>
          <span className="text-[11px] text-slate-400">
            {row.department} &bull; Yr {row.year} ({row.section})
          </span>
        </div>
      ),
    },
    {
      header: 'IA-1 Average',
      accessor: (row) => (
        <span className="font-semibold text-slate-200 text-xs">{row.ia1_marks ?? 0}%</span>
      ),
    },
    {
      header: 'IA-2 Average',
      accessor: (row) => (
        <span className="font-semibold text-slate-200 text-xs">{row.ia2_marks ?? 0}%</span>
      ),
    },
    {
      header: 'Improvement',
      accessor: (row) => {
        const val = row.improvement ?? (row.ia2_marks - row.ia1_marks);
        const isPos = val >= 0;
        return (
          <div className={`flex items-center gap-1 font-bold text-xs ${isPos ? 'text-emerald-400' : 'text-rose-400'}`}>
            {isPos ? <ArrowUpRight className="w-3.5 h-3.5" /> : <ArrowDownRight className="w-3.5 h-3.5" />}
            <span>{isPos ? `+${val.toFixed(1)}%` : `${val.toFixed(1)}%`}</span>
          </div>
        );
      },
    },
    {
      header: 'Pass Percentage',
      accessor: (row) => {
        const pct = row.pass_percentage ?? 0;
        return (
          <div className="w-28">
            <div className="flex justify-between text-[11px] mb-1">
              <span className="text-slate-300 font-semibold">{pct.toFixed(0)}%</span>
            </div>
            <div className="w-full bg-slate-800 rounded-full h-1.5 overflow-hidden">
              <div
                className={`h-full rounded-full ${pct >= 75 ? 'bg-emerald-500' : pct >= 50 ? 'bg-indigo-500' : 'bg-rose-500'}`}
                style={{ width: `${Math.min(pct, 100)}%` }}
              />
            </div>
          </div>
        );
      },
    },
    {
      header: 'Overall Status',
      accessor: (row) => {
        const status = row.status || (row.pass_percentage >= 50 ? 'PASSED' : 'NEEDS_ATTENTION');
        return (
          <Badge
            variant={status === 'PASSED' ? 'success' : status === 'FAILED' ? 'danger' : 'warning'}
            size="sm"
          >
            {status}
          </Badge>
        );
      },
    },
  ];

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h2 className="text-xl font-bold text-white">Student Performance Analysis</h2>
          <p className="text-xs text-slate-400">
            Comprehensive evaluation matrix comparing IA-1, IA-2, and improvement deltas
          </p>
        </div>
      </div>

      <SearchFilterBar
        searchQuery={searchQuery}
        onSearchChange={(q) => {
          setSearchQuery(q);
          setCurrentPage(1);
        }}
        placeholder="Filter by student name or register number..."
        onRefresh={fetchPerformance}
        isRefreshing={isLoading}
        filters={
          <>
            <select
              value={filterDept}
              onChange={(e) => {
                setFilterDept(e.target.value);
                setCurrentPage(1);
              }}
              className="px-3 py-2 bg-slate-900 border border-slate-700/80 rounded-lg text-xs text-slate-200 focus:outline-none focus:border-indigo-500"
            >
              <option value="ALL">All Departments</option>
              {departments.map((d) => (
                <option key={d.id} value={d.name}>
                  {d.code}
                </option>
              ))}
            </select>

            <select
              value={filterStatus}
              onChange={(e) => {
                setFilterStatus(e.target.value);
                setCurrentPage(1);
              }}
              className="px-3 py-2 bg-slate-900 border border-slate-700/80 rounded-lg text-xs text-slate-200 focus:outline-none focus:border-indigo-500"
            >
              <option value="ALL">All Statuses</option>
              <option value="PASSED">Passed</option>
              <option value="NEEDS_ATTENTION">Needs Attention</option>
              <option value="FAILED">Failed</option>
            </select>
          </>
        }
      />

      <DataTable
        columns={columns}
        data={paginated}
        isLoading={isLoading}
        keyExtractor={(item) => item.student_id || item.register_number}
        emptyTitle="No Student Performance Records"
        emptyDescription="Assessment performance records will populate once marks are uploaded."
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
