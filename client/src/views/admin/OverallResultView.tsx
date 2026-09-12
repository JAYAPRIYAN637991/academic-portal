import React, { useEffect, useState } from 'react';
import { api } from '../../services/api';
import { Card } from '../../components/common/Card';
import { Badge } from '../../components/common/Badge';
import { Award, TrendingUp, CheckCircle, GraduationCap, BarChart2, Users } from 'lucide-react';
import { ResponsiveContainer, PieChart, Pie, Cell, Tooltip, Legend } from 'recharts';

export const OverallResultView: React.FC = () => {
  const [result, setResult] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const fetchOverall = async () => {
      try {
        const res: any = await api
          .get('/admin/analytics/overall')
          .catch(() => api.get('/analytics/overall'));
        setResult(res);
      } catch (err) {
        console.error('Overall result fetch error', err);
      } finally {
        setIsLoading(false);
      }
    };
    fetchOverall();
  }, []);

  const totalDepartments = result?.totalDepartments ?? result?.metrics?.totalDepartments ?? 0;
  const totalStudents = result?.totalStudents ?? result?.metrics?.totalStudents ?? 0;
  const evaluatedStudents = result?.metrics?.totalStudents ?? result?.evaluatedStudents ?? 0;
  const totalMarksEntered = result?.metrics?.totalMarksEntered ?? 0;
  const ia1Avg = Number((result?.ia1Average ?? result?.ia1_average ?? 0).toFixed(1));
  const ia2Avg = Number((result?.ia2Average ?? result?.ia2_average ?? 0).toFixed(1));
  const passPercentage = Number((result?.overallPassPercentage ?? result?.pass_percentage ?? 0).toFixed(1));
  const improvement = Number((result?.overallImprovement ?? (ia2Avg && ia1Avg ? ia2Avg - ia1Avg : 0)).toFixed(1));

  const hasEvaluations = totalMarksEntered > 0 || ia1Avg > 0 || ia2Avg > 0 || passPercentage > 0;

  // Derive top department if available
  const deptRankings = result?.departmentRankings || [];
  const topDept = deptRankings.length > 0 && deptRankings[0].assessedStudents > 0 ? deptRankings[0] : null;

  // Derive top year if available
  const yearRankings = result?.yearRankings || [];
  const topYear = yearRankings.length > 0 && yearRankings[0].assessedStudents > 0 ? yearRankings[0] : null;

  // Dynamic Grade distribution from students
  const allAssessed = [
    ...(result?.top10Students || []),
    ...(result?.studentsNeedingAttention || []),
    ...(result?.mostImprovedStudents || [])
  ];

  let distinctionCount = 0;
  let firstClassCount = 0;
  let secondClassCount = 0;
  let remedialCount = 0;

  if (allAssessed.length > 0) {
    // Unique by studentId
    const seen = new Set<string>();
    allAssessed.forEach((s: any) => {
      const id = s.studentId || s.id;
      if (!seen.has(id)) {
        seen.add(id);
        const pct = s.percentage ?? s.overallPercentage ?? 0;
        if (pct >= 75) distinctionCount++;
        else if (pct >= 60) firstClassCount++;
        else if (pct >= 50) secondClassCount++;
        else remedialCount++;
      }
    });
  }

  const gradeDistribution = hasEvaluations && (distinctionCount + firstClassCount + secondClassCount + remedialCount > 0)
    ? [
        { name: 'Distinction (> 75%)', value: distinctionCount, color: '#10b981' },
        { name: 'First Class (60-74%)', value: firstClassCount, color: '#6366f1' },
        { name: 'Second Class (50-59%)', value: secondClassCount, color: '#f59e0b' },
        { name: 'Needs Remedial (< 50%)', value: remedialCount, color: '#f43f5e' },
      ].filter((g) => g.value > 0)
    : [];

  return (
    <div className="space-y-6">
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-emerald-950 via-slate-900 to-indigo-950 border border-emerald-500/30 p-6 shadow-xl">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <Badge variant="success" size="sm" className="mb-2">
              Anna University Institutional Standing
            </Badge>
            <h2 className="text-2xl font-black text-white">Overall College Academic Standing</h2>
            <p className="text-xs text-slate-300 mt-1 max-w-xl">
              Consolidated evaluation across {totalDepartments} Engineering departments and {totalStudents} active candidates.
            </p>
          </div>
          <div className="text-right">
            <span className="text-xs text-slate-400 block">Institutional Pass Percentage</span>
            <span className="text-4xl font-extrabold text-emerald-400">
              {hasEvaluations ? `${passPercentage}%` : '—'}
            </span>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="p-4 rounded-xl bg-slate-900/80 border border-slate-800">
          <span className="text-xs text-slate-400 block mb-1">Total Evaluated Students</span>
          <span className="text-2xl font-bold text-white">
            {evaluatedStudents > 0 ? evaluatedStudents : '0'}
          </span>
          <p className="text-[11px] text-slate-400 mt-1">
            {totalStudents > 0 ? `Out of ${totalStudents} active students` : 'No active student records'}
          </p>
        </div>
        <div className="p-4 rounded-xl bg-slate-900/80 border border-slate-800">
          <span className="text-xs text-slate-400 block mb-1">IA-1 College Average</span>
          <span className="text-2xl font-bold text-indigo-400">
            {ia1Avg > 0 ? `${ia1Avg}%` : '—'}
          </span>
          <p className="text-[11px] text-slate-400 mt-1">Internal Assessment 1</p>
        </div>
        <div className="p-4 rounded-xl bg-slate-900/80 border border-slate-800">
          <span className="text-xs text-slate-400 block mb-1">IA-2 College Average</span>
          <span className="text-2xl font-bold text-emerald-400">
            {ia2Avg > 0 ? `${ia2Avg}%` : '—'}
          </span>
          <p className="text-[11px] text-slate-400 mt-1">Internal Assessment 2</p>
        </div>
        <div className="p-4 rounded-xl bg-slate-900/80 border border-slate-800">
          <span className="text-xs text-slate-400 block mb-1">Average Improvement</span>
          <span className="text-2xl font-bold text-sky-400">
            {hasEvaluations && (ia1Avg > 0 || ia2Avg > 0)
              ? (improvement >= 0 ? `+${improvement}%` : `${improvement}%`)
              : '—'}
          </span>
          <p className="text-[11px] text-slate-400 mt-1">Institution-wide net gain</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card title="Grade & Classification Distribution">
          {gradeDistribution.length > 0 ? (
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
          ) : (
            <div className="h-64 flex flex-col items-center justify-center text-center p-6 border border-dashed border-slate-800 rounded-xl">
              <GraduationCap className="w-8 h-8 text-slate-600 mb-2" />
              <p className="text-sm font-semibold text-slate-300">No Grade Distribution Data Yet</p>
              <p className="text-xs text-slate-500 mt-1 max-w-sm">
                Grade classifications (Distinction, First Class, Second Class, Remedial) will appear here once evaluation marks are entered.
              </p>
            </div>
          )}
        </Card>

        <Card title="Institutional Honors & Highlights">
          {hasEvaluations ? (
            <div className="space-y-3 text-xs">
              {topDept && (
                <div className="p-3 bg-slate-950 rounded-xl border border-slate-800 flex items-center justify-between">
                  <div className="flex items-center gap-2.5">
                    <Award className="w-5 h-5 text-amber-400" />
                    <div>
                      <span className="font-bold text-white block">Top Department: {topDept.name}</span>
                      <span className="text-[11px] text-slate-400">
                        Average: {topDept.overallAverage}% &amp; {topDept.passPercentage}% Pass Rate
                      </span>
                    </div>
                  </div>
                  <Badge variant="success">{topDept.overallAverage}%</Badge>
                </div>
              )}

              {topYear && (
                <div className="p-3 bg-slate-950 rounded-xl border border-slate-800 flex items-center justify-between">
                  <div className="flex items-center gap-2.5">
                    <TrendingUp className="w-5 h-5 text-emerald-400" />
                    <div>
                      <span className="font-bold text-white block">Leading Cohort: {topYear.name}</span>
                      <span className="text-[11px] text-slate-400">
                        Pass rate: {topYear.passPercentage}% ({topYear.assessedStudents} students assessed)
                      </span>
                    </div>
                  </div>
                  <Badge variant="primary">{topYear.passPercentage}%</Badge>
                </div>
              )}

              <div className="p-3 bg-slate-950 rounded-xl border border-slate-800 flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <CheckCircle className="w-5 h-5 text-indigo-400" />
                  <div>
                    <span className="font-bold text-white block">Academic Coverage</span>
                    <span className="text-[11px] text-slate-400">
                      {totalMarksEntered} total marks entries registered across assessments
                    </span>
                  </div>
                </div>
                <Badge variant="info">{totalMarksEntered} Marks</Badge>
              </div>
            </div>
          ) : (
            <div className="h-64 flex flex-col items-center justify-center text-center p-6 border border-dashed border-slate-800 rounded-xl">
              <Award className="w-8 h-8 text-slate-600 mb-2" />
              <p className="text-sm font-semibold text-slate-300">Awaiting Assessment Data</p>
              <p className="text-xs text-slate-500 mt-1 max-w-sm">
                Institutional honors, leading departments, and cohort highlights will automatically generate when marks are recorded.
              </p>
            </div>
          )}
        </Card>
      </div>
    </div>
  );
};

