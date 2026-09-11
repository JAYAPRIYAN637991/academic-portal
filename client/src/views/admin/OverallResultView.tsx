import React, { useEffect, useState } from 'react';
import { api } from '../../services/api';
import { Card } from '../../components/common/Card';
import { Badge } from '../../components/common/Badge';
import { Award, TrendingUp, CheckCircle, GraduationCap, BarChart2 } from 'lucide-react';
import { ResponsiveContainer, PieChart, Pie, Cell, Tooltip, Legend } from 'recharts';

export const OverallResultView: React.FC = () => {
  const [result, setResult] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const fetchOverall = async () => {
      try {
        const res: any = await api.get('/analytics/overall');
        setResult(res);
      } catch (err) {
        console.error('Overall result fetch error', err);
      } finally {
        setIsLoading(false);
      }
    };
    fetchOverall();
  }, []);

  const gradeDistribution = [
    { name: 'Distinction (> 75%)', value: 165, color: '#10b981' },
    { name: 'First Class (60-74%)', value: 180, color: '#6366f1' },
    { name: 'Second Class (50-59%)', value: 50, color: '#f59e0b' },
    { name: 'Needs Remedial (< 50%)', value: 25, color: '#f43f5e' },
  ];

  return (
    <div className="space-y-6">
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-emerald-950 via-slate-900 to-indigo-950 border border-emerald-500/30 p-6 shadow-xl">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <Badge variant="success" size="sm" className="mb-2">
              Anna University Institutional Result 2026-2027
            </Badge>
            <h2 className="text-2xl font-black text-white">Overall College Academic Standing</h2>
            <p className="text-xs text-slate-300 mt-1 max-w-xl">
              Consolidated evaluation across 6 Engineering departments and 420 active candidates.
            </p>
          </div>
          <div className="text-right">
            <span className="text-xs text-slate-400 block">Institutional Pass Percentage</span>
            <span className="text-4xl font-extrabold text-emerald-400">86.5%</span>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="p-4 rounded-xl bg-slate-900/80 border border-slate-800">
          <span className="text-xs text-slate-400 block mb-1">Total Evaluated Students</span>
          <span className="text-2xl font-bold text-white">420</span>
          <p className="text-[11px] text-slate-400 mt-1">100% evaluated across IA-1 &amp; IA-2</p>
        </div>
        <div className="p-4 rounded-xl bg-slate-900/80 border border-slate-800">
          <span className="text-xs text-slate-400 block mb-1">IA-1 College Average</span>
          <span className="text-2xl font-bold text-indigo-400">68.4%</span>
          <p className="text-[11px] text-slate-400 mt-1">Baseline assessment</p>
        </div>
        <div className="p-4 rounded-xl bg-slate-900/80 border border-slate-800">
          <span className="text-xs text-slate-400 block mb-1">IA-2 College Average</span>
          <span className="text-2xl font-bold text-emerald-400">74.2%</span>
          <p className="text-[11px] text-slate-400 mt-1">Summative assessment</p>
        </div>
        <div className="p-4 rounded-xl bg-slate-900/80 border border-slate-800">
          <span className="text-xs text-slate-400 block mb-1">Average Improvement</span>
          <span className="text-2xl font-bold text-sky-400">+5.8%</span>
          <p className="text-[11px] text-slate-400 mt-1">Institution-wide net gain</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card title="Grade &amp; Classification Distribution">
          <div className="h-64 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={gradeDistribution}
                  cx="50%"
                  cy="50%"
                  innerRadius={60}
                  outerRadius={90}
                  paddingAngle={5}
                  dataKey="value"
                >
                  {gradeDistribution.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip contentStyle={{ backgroundColor: '#0f172a', borderColor: '#334155', color: '#fff' }} />
                <Legend />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </Card>

        <Card title="Institutional Honors &amp; Highlights">
          <div className="space-y-3 text-xs">
            <div className="p-3 bg-slate-950 rounded-xl border border-slate-800 flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <Award className="w-5 h-5 text-amber-400" />
                <div>
                  <span className="font-bold text-white block">Top Department: Information Technology</span>
                  <span className="text-[11px] text-slate-400">Highest IA-2 Average (83.0%) &amp; 93% Pass Rate</span>
                </div>
              </div>
              <Badge variant="success">93.0%</Badge>
            </div>

            <div className="p-3 bg-slate-950 rounded-xl border border-slate-800 flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <TrendingUp className="w-5 h-5 text-emerald-400" />
                <div>
                  <span className="font-bold text-white block">Most Improved: Year 4 Final Cohort</span>
                  <span className="text-[11px] text-slate-400">+7.2% average improvement across technical electives</span>
                </div>
              </div>
              <Badge variant="primary">+7.2%</Badge>
            </div>

            <div className="p-3 bg-slate-950 rounded-xl border border-slate-800 flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <CheckCircle className="w-5 h-5 text-indigo-400" />
                <div>
                  <span className="font-bold text-white block">Parent Communication Coverage</span>
                  <span className="text-[11px] text-slate-400">98.6% of parents received automated IA assessment reports</span>
                </div>
              </div>
              <Badge variant="info">98.6%</Badge>
            </div>
          </div>
        </Card>
      </div>
    </div>
  );
};
