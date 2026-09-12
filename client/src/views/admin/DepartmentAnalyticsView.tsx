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
import { BarChart2, Building2 } from 'lucide-react';

interface DeptMetric {
  department_id: number | string;
  code: string;
  name: string;
  total_students: number;
  ia1_avg: number;
  ia2_avg: number;
  pass_rate: number;
}

export const DepartmentAnalyticsView: React.FC = () => {
  const [data, setData] = useState<DeptMetric[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      setIsLoading(true);
      try {
        const res: any = await api
          .get('/admin/analytics/departments')
          .catch(() => api.get('/analytics/departments'))
          .catch(() => api.get('/analytics/department'));

        const rawList = Array.isArray(res)
          ? res
          : (res?.departments || res?.departmentAnalytics || res?.departmentRankings || res?.data || []);

        const parsed: DeptMetric[] = rawList.map((d: any) => ({
          department_id: d.department_id || d.departmentId || d.id || d.code,
          code: d.code || '',
          name: d.name || d.departmentName || '',
          total_students: d.total_students ?? d.totalStudents ?? d.assessedStudents ?? 0,
          ia1_avg: Number((d.ia1_avg ?? d.ia1Average ?? 0).toFixed(1)),
          ia2_avg: Number((d.ia2_avg ?? d.ia2Average ?? 0).toFixed(1)),
          pass_rate: Number((d.pass_rate ?? d.passPercentage ?? 0).toFixed(1)),
        }));

        setData(parsed);
      } catch (err) {
        console.error('Department analytics error', err);
      } finally {
        setIsLoading(false);
      }
    };
    fetchData();
  }, []);

  const hasEvaluations = data.some((d) => d.ia1_avg > 0 || d.ia2_avg > 0 || d.pass_rate > 0);

  const columns: Column<DeptMetric>[] = [
    {
      header: 'Department Code',
      accessor: (row) => <Badge variant="primary">{row.code}</Badge>,
    },
    {
      header: 'Department Name',
      accessor: (row) => <span className="font-semibold text-white">{row.name}</span>,
    },
    {
      header: 'Evaluated Students',
      accessor: (row) => <span className="text-slate-300">{row.total_students} Students</span>,
    },
    {
      header: 'IA-1 Average',
      accessor: (row) => (
        <span className="text-indigo-400 font-semibold">{row.ia1_avg > 0 ? `${row.ia1_avg}%` : '—'}</span>
      ),
    },
    {
      header: 'IA-2 Average',
      accessor: (row) => (
        <span className="text-emerald-400 font-semibold">{row.ia2_avg > 0 ? `${row.ia2_avg}%` : '—'}</span>
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
        <h2 className="text-xl font-bold text-white">Department Comparative Analytics</h2>
        <p className="text-xs text-slate-400">
          Faculty performance and academic outcome assessment across engineering disciplines
        </p>
      </div>

      <Card title="Department Internal Assessment Comparison">
        {hasEvaluations ? (
          <div className="h-72 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={data} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                <XAxis dataKey="code" stroke="#64748b" />
                <YAxis stroke="#64748b" domain={[0, 100]} />
                <Tooltip contentStyle={{ backgroundColor: '#0f172a', borderColor: '#334155', color: '#fff' }} />
                <Legend />
                <Bar dataKey="ia1_avg" name="IA-1 Average" fill="#6366f1" radius={[4, 4, 0, 0]} />
                <Bar dataKey="ia2_avg" name="IA-2 Average" fill="#10b981" radius={[4, 4, 0, 0]} />
                <Bar dataKey="pass_rate" name="Pass Rate (%)" fill="#38bdf8" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        ) : (
          <div className="h-72 flex flex-col items-center justify-center text-center p-6 border border-dashed border-slate-800 rounded-xl">
            <Building2 className="w-8 h-8 text-slate-600 mb-2" />
            <p className="text-sm font-semibold text-slate-300">No Department Evaluation Data Yet</p>
            <p className="text-xs text-slate-500 mt-1 max-w-md">
              Comparative analytics will be calculated as soon as internal assessment marks (IA-1 / IA-2) are recorded.
            </p>
          </div>
        )}
      </Card>

      <DataTable
        columns={columns}
        data={data}
        isLoading={isLoading}
        keyExtractor={(r, idx) => r.department_id || idx}
        emptyTitle="No Department Evaluations Found"
        emptyDescription="Departments will be analyzed here once marks are recorded for enrolled students."
      />
    </div>
  );
};
