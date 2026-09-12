import React, { useEffect, useState } from 'react';
import { api, unpackList } from '../../services/api';
import { Card } from '../../components/common/Card';
import { Badge } from '../../components/common/Badge';
import { DataTable, Column } from '../../components/data/DataTable';
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  Legend,
  CartesianGrid,
} from 'recharts';
import { Layers, CheckCircle2 } from 'lucide-react';

interface SectionMetric {
  section_id: string | number;
  label: string;
  department: string;
  year: number;
  section: string;
  total_students: number;
  assessed_students: number;
  ia1_avg: number;
  ia2_avg: number;
  improvement: number;
  pass_rate: number;
}

export const SectionAnalyticsView: React.FC = () => {
  const [data, setData] = useState<SectionMetric[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      setIsLoading(true);
      try {
        const res: any = await api
          .get('/admin/analytics/sections')
          .catch(() => api.get('/analytics/sections'))
          .catch(() => api.get('/analytics/section'));

        const rawList = unpackList<any>(res, 'sections');
        const parsed: SectionMetric[] = rawList.map((s: any) => ({
          section_id: s.sectionId || s.section_id || s.id || `${s.departmentCode || s.department}-${s.yearNumber || s.year}-${s.sectionName || s.section}`,
          label: s.displayName || `${s.departmentCode || s.department || 'DEPT'} Y${s.yearNumber || s.year || 1}-${s.sectionName || s.section || 'A'}`,
          department: s.departmentCode || s.department || '',
          year: s.yearNumber ?? s.year ?? 1,
          section: s.sectionName || s.section || 'A',
          total_students: s.totalStudents ?? s.total_students ?? 0,
          assessed_students: s.assessedStudents ?? s.assessed_students ?? 0,
          ia1_avg: Number((s.ia1Average ?? s.ia1_avg ?? 0).toFixed(1)),
          ia2_avg: Number((s.ia2Average ?? s.ia2_avg ?? 0).toFixed(1)),
          improvement: Number((s.improvement ?? 0).toFixed(1)),
          pass_rate: Number((s.passPercentage ?? s.pass_rate ?? 0).toFixed(1)),
        }));

        setData(parsed);
      } catch (err) {
        console.error('Section analytics error', err);
      } finally {
        setIsLoading(false);
      }
    };
    fetchData();
  }, []);

  const hasEvaluations = data.some((s) => s.ia1_avg > 0 || s.ia2_avg > 0 || s.pass_rate > 0);

  const columns: Column<SectionMetric>[] = [
    {
      header: 'Class Section',
      accessor: (row) => (
        <span className="font-bold text-white">
          {row.label}
        </span>
      ),
    },
    {
      header: 'Total Students',
      accessor: (row) => <span className="text-slate-300">{row.total_students} Enrolled</span>,
    },
    {
      header: 'Assessed',
      accessor: (row) => (
        <span className="text-slate-400">
          {row.assessed_students} / {row.total_students}
        </span>
      ),
    },
    {
      header: 'IA-1 Average',
      accessor: (row) => (
        <span className="text-indigo-400 font-semibold">
          {row.ia1_avg > 0 ? `${row.ia1_avg}%` : '—'}
        </span>
      ),
    },
    {
      header: 'IA-2 Average',
      accessor: (row) => (
        <span className="text-emerald-400 font-semibold">
          {row.ia2_avg > 0 ? `${row.ia2_avg}%` : '—'}
        </span>
      ),
    },
    {
      header: 'Pass Rate',
      accessor: (row) => (
        <Badge variant={row.pass_rate >= 75 ? 'success' : row.pass_rate >= 50 ? 'primary' : 'danger'}>
          {row.pass_rate > 0 ? `${row.pass_rate}%` : '—'}
        </Badge>
      ),
    },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-bold text-white">Section Comparative Analytics</h2>
        <p className="text-xs text-slate-400">
          Cross-section evaluation metrics for academic quality assurance
        </p>
      </div>

      <Card title="Section Performance Chart (IA-1 vs IA-2)">
        {hasEvaluations ? (
          <div className="h-72 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={data} margin={{ top: 10, right: 10, left: -20, bottom: 20 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                <XAxis dataKey="label" stroke="#64748b" tick={{ fontSize: 11 }} angle={-15} textAnchor="end" />
                <YAxis stroke="#64748b" domain={[0, 100]} />
                <Tooltip contentStyle={{ backgroundColor: '#0f172a', borderColor: '#334155', color: '#fff' }} />
                <Legend verticalAlign="top" wrapperStyle={{ paddingBottom: '10px' }} />
                <Bar dataKey="ia1_avg" name="IA-1 Average (%)" fill="#6366f1" radius={[4, 4, 0, 0]} />
                <Bar dataKey="ia2_avg" name="IA-2 Average (%)" fill="#10b981" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        ) : (
          <div className="h-72 flex flex-col items-center justify-center text-center p-6 border border-dashed border-slate-800 rounded-xl">
            <Layers className="w-8 h-8 text-slate-600 mb-2" />
            <p className="text-sm font-semibold text-slate-300">No Section Evaluation Data Yet</p>
            <p className="text-xs text-slate-500 mt-1 max-w-md">
              Comparative assessment graphs across sections will be calculated as soon as marks are entered for enrolled students.
            </p>
          </div>
        )}
      </Card>

      <DataTable
        columns={columns}
        data={data}
        isLoading={isLoading}
        keyExtractor={(r, idx) => r.section_id || idx}
        emptyTitle="No Section Evaluations Found"
        emptyDescription="Section comparative analysis will appear here once internal assessment marks are loaded."
      />
    </div>
  );
};

