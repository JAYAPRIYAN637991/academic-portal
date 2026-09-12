import React, { useEffect, useState } from 'react';
import { api } from '../../services/api';
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
  LineChart,
  Line,
} from 'recharts';

interface YearMetric {
  year: number;
  total_students: number;
  ia1_avg: number;
  ia2_avg: number;
  improvement: number;
  pass_rate: number;
}

export const YearAnalyticsView: React.FC = () => {
  const [data, setData] = useState<YearMetric[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      setIsLoading(true);
      try {
        const res: any = await api
          .get('/admin/analytics/years')
          .catch(() => api.get('/analytics/years'))
          .catch(() => api.get('/analytics/year'));

        const rawList = Array.isArray(res)
          ? res
          : (res?.years || res?.yearRankings || res?.data || []);

        const parsed: YearMetric[] = rawList.map((y: any) => ({
          year: y.yearNumber ?? y.year ?? 1,
          total_students: y.total_students ?? y.totalStudents ?? y.assessedStudents ?? 0,
          ia1_avg: Number((y.ia1_avg ?? y.ia1Average ?? 0).toFixed(1)),
          ia2_avg: Number((y.ia2_avg ?? y.ia2Average ?? 0).toFixed(1)),
          improvement: Number((y.improvement ?? (y.ia2Average && y.ia1Average ? y.ia2Average - y.ia1Average : 0)).toFixed(1)),
          pass_rate: Number((y.pass_rate ?? y.passPercentage ?? 0).toFixed(1)),
        }));

        setData(parsed);
      } catch (err) {
        console.error('Year analytics error', err);
      } finally {
        setIsLoading(false);
      }
    };
    fetchData();
  }, []);

  const hasEvaluations = data.some((y) => y.ia1_avg > 0 || y.ia2_avg > 0 || y.pass_rate > 0);

  const columns: Column<YearMetric>[] = [
    {
      header: 'Academic Year Level',
      accessor: (row) => <span className="font-bold text-white">Year {row.year}</span>,
    },
    {
      header: 'Student Population',
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
      header: 'Improvement',
      accessor: (row) => {
        if (row.ia1_avg === 0 && row.ia2_avg === 0) return <span className="text-slate-500">—</span>;
        const isPos = row.improvement >= 0;
        return (
          <span className={`font-bold ${isPos ? 'text-emerald-400' : 'text-rose-400'}`}>
            {isPos ? `+${row.improvement}%` : `${row.improvement}%`}
          </span>
        );
      },
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
        <h2 className="text-xl font-bold text-white">Year-Wise Academic Analytics</h2>
        <p className="text-xs text-slate-400">
          Cohort tracking from 1st Year foundational engineering to Final Year graduation readiness
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card title="Assessment Progression by Year Level">
          {hasEvaluations ? (
            <div className="h-64 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={data} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                  <XAxis dataKey="year" stroke="#64748b" tickFormatter={(y) => `Year ${y}`} />
                  <YAxis stroke="#64748b" domain={[0, 100]} />
                  <Tooltip contentStyle={{ backgroundColor: '#0f172a', borderColor: '#334155', color: '#fff' }} />
                  <Legend />
                  <Bar dataKey="ia1_avg" name="IA-1 Average" fill="#6366f1" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="ia2_avg" name="IA-2 Average" fill="#10b981" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <div className="h-64 flex flex-col items-center justify-center text-center p-6 border border-dashed border-slate-800 rounded-xl">
              <p className="text-sm font-semibold text-slate-300">No Assessment Progression Data Yet</p>
              <p className="text-xs text-slate-500 mt-1 max-w-sm">
                Progression charts will be populated after entering internal evaluation scores.
              </p>
            </div>
          )}
        </Card>

        <Card title="Cohort Pass Rate Growth Curve">
          {hasEvaluations ? (
            <div className="h-64 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={data} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                  <XAxis dataKey="year" stroke="#64748b" tickFormatter={(y) => `Year ${y}`} />
                  <YAxis stroke="#64748b" domain={[0, 100]} />
                  <Tooltip contentStyle={{ backgroundColor: '#0f172a', borderColor: '#334155', color: '#fff' }} />
                  <Legend />
                  <Line type="monotone" dataKey="pass_rate" name="Pass Rate (%)" stroke="#38bdf8" strokeWidth={3} dot={{ r: 5 }} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <div className="h-64 flex flex-col items-center justify-center text-center p-6 border border-dashed border-slate-800 rounded-xl">
              <p className="text-sm font-semibold text-slate-300">No Pass Rate Curve Data Yet</p>
              <p className="text-xs text-slate-500 mt-1 max-w-sm">
                Pass percentage trend lines will render once examination marks are submitted.
              </p>
            </div>
          )}
        </Card>
      </div>

      <DataTable
        columns={columns}
        data={data}
        isLoading={isLoading}
        keyExtractor={(r) => r.year}
        emptyTitle="No Year-Wise Evaluations Found"
        emptyDescription="Assessment progression by year will appear once student marks are loaded."
      />
    </div>
  );
};
