import React, { useEffect, useState } from 'react';
import { api } from '../../services/api';
import { Card } from '../../components/common/Card';
import { Button } from '../../components/common/Button';
import { Badge } from '../../components/common/Badge';
import { AdminDashboardData } from '../../types';
import {
  Users,
  GraduationCap,
  Building2,
  Layers,
  TrendingUp,
  Percent,
  CheckCircle,
  AlertTriangle,
  UploadCloud,
  UserPlus,
  FileText,
  Megaphone,
  Bell,
  ArrowUpRight,
  ArrowDownRight,
  Award,
  Sparkles,
} from 'lucide-react';
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

interface DashboardViewProps {
  onNavigate: (module: string) => void;
  onOpenNoticeWorkflow: () => void;
}

export const DashboardView: React.FC<DashboardViewProps> = ({ onNavigate, onOpenNoticeWorkflow }) => {
  const [data, setData] = useState<AdminDashboardData | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const fetchDashboardData = async () => {
    setIsLoading(true);
    try {
      const res = await api
        .get<AdminDashboardData>('/admin/dashboard-summary')
        .catch(() => api.get<AdminDashboardData>('/admin/dashboard'));
      setData(res);
    } catch (err) {
      console.error('Failed to load dashboard data:', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchDashboardData();
  }, []);

  const metrics = data?.metrics || {
    total_students: (data as any)?.totalStudents ?? (data as any)?.cards?.totalStudents ?? 0,
    total_staff: (data as any)?.totalStaff ?? (data as any)?.cards?.totalStaff ?? 0,
    departments: (data as any)?.departments ?? (data as any)?.cards?.departments ?? 0,
    sections: (data as any)?.sections ?? (data as any)?.cards?.sections ?? 0,
    ia1_average: (data as any)?.ia1Average ?? (data as any)?.cards?.ia1Average ?? 0,
    ia2_average: (data as any)?.ia2Average ?? (data as any)?.cards?.ia2Average ?? 0,
    overall_improvement: (data as any)?.overallImprovement ?? (data as any)?.cards?.overallImprovement ?? 0,
    pass_percentage: (data as any)?.passPercentage ?? (data as any)?.cards?.passPercentage ?? 0,
  };

  const notices = data?.notices || (data as any)?.collegeNotices || { draft: 0, scheduled: 0, published: 0 };
  const notifications = data?.notifications || { pending: 0, sent: 0, delivered: 0, failed: 0 };

  return (
    <div className="space-y-6 animate-in fade-in duration-200">
      {/* Welcome Banner */}
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-indigo-900/60 via-slate-900 to-slate-900 border border-indigo-500/30 p-6 shadow-xl">
        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-indigo-500/20 border border-indigo-500/40 text-indigo-300 text-xs font-semibold mb-2">
              <Sparkles className="w-3.5 h-3.5" /> Institutional Executive Suite
            </div>
            <h2 className="text-xl sm:text-2xl font-black text-white">
              VSB Engineering College Admin Dashboard
            </h2>
            <p className="text-xs text-slate-300 mt-1 max-w-2xl leading-relaxed">
              Real-time monitoring of academic evaluations, faculty assignments, parent notifications, and Anna University curriculum performance.
            </p>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            <Button
              variant="primary"
              size="sm"
              onClick={onOpenNoticeWorkflow}
              leftIcon={<Megaphone className="w-4 h-4" />}
            >
              Create Notice
            </Button>
            <Button
              variant="secondary"
              size="sm"
              onClick={() => onNavigate('reports')}
              leftIcon={<FileText className="w-4 h-4" />}
            >
              Generate Report
            </Button>
          </div>
        </div>
      </div>

      {/* 8 Metric KPI Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="p-4 rounded-xl bg-slate-900/80 border border-slate-800 shadow-md">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-semibold text-slate-400">Total Students</span>
            <div className="p-2 rounded-lg bg-indigo-950/60 text-indigo-400 border border-indigo-800/40">
              <GraduationCap className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl font-bold text-white">{metrics.total_students}</div>
          <p className="text-[11px] text-slate-400 mt-1">Enrolled across all depts</p>
        </div>

        <div className="p-4 rounded-xl bg-slate-900/80 border border-slate-800 shadow-md">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-semibold text-slate-400">Total Faculty</span>
            <div className="p-2 rounded-lg bg-emerald-950/60 text-emerald-400 border border-emerald-800/40">
              <Users className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl font-bold text-white">{metrics.total_staff}</div>
          <p className="text-[11px] text-slate-400 mt-1">Teaching &amp; Lab Staff</p>
        </div>

        <div className="p-4 rounded-xl bg-slate-900/80 border border-slate-800 shadow-md">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-semibold text-slate-400">Departments</span>
            <div className="p-2 rounded-lg bg-amber-950/60 text-amber-400 border border-amber-800/40">
              <Building2 className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl font-bold text-white">{metrics.departments}</div>
          <p className="text-[11px] text-slate-400 mt-1">Engineering Branches</p>
        </div>

        <div className="p-4 rounded-xl bg-slate-900/80 border border-slate-800 shadow-md">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-semibold text-slate-400">Active Sections</span>
            <div className="p-2 rounded-lg bg-sky-950/60 text-sky-400 border border-sky-800/40">
              <Layers className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl font-bold text-white">{metrics.sections}</div>
          <p className="text-[11px] text-slate-400 mt-1">Across Years 1 to 4</p>
        </div>

        <div className="p-4 rounded-xl bg-slate-900/80 border border-slate-800 shadow-md">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-semibold text-slate-400">IA-1 Average</span>
            <div className="p-2 rounded-lg bg-slate-800 text-indigo-400 border border-slate-700">
              <TrendingUp className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl font-bold text-indigo-300">{metrics.ia1_average}%</div>
          <p className="text-[11px] text-slate-400 mt-1">Internal Assessment I</p>
        </div>

        <div className="p-4 rounded-xl bg-slate-900/80 border border-slate-800 shadow-md">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-semibold text-slate-400">IA-2 Average</span>
            <div className="p-2 rounded-lg bg-slate-800 text-emerald-400 border border-slate-700">
              <TrendingUp className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl font-bold text-emerald-300">{metrics.ia2_average}%</div>
          <p className="text-[11px] text-slate-400 mt-1">Internal Assessment II</p>
        </div>

        <div className="p-4 rounded-xl bg-slate-900/80 border border-slate-800 shadow-md">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-semibold text-slate-400">Improvement</span>
            <div className="p-2 rounded-lg bg-emerald-950/60 text-emerald-400 border border-emerald-800/40">
              <ArrowUpRight className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl font-bold text-emerald-400">+{metrics.overall_improvement}%</div>
          <p className="text-[11px] text-emerald-300/80 mt-1">Positive growth IA-1 &rarr; IA-2</p>
        </div>

        <div className="p-4 rounded-xl bg-slate-900/80 border border-slate-800 shadow-md">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-semibold text-slate-400">Pass Percentage</span>
            <div className="p-2 rounded-lg bg-indigo-950/60 text-indigo-400 border border-indigo-800/40">
              <Percent className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl font-bold text-indigo-200">{metrics.pass_percentage}%</div>
          <p className="text-[11px] text-slate-400 mt-1">Overall Institutional Pass</p>
        </div>
      </div>

      {/* Quick Action Hub (8 Actions) */}
      <Card title="Administrative Quick Actions" subtitle="One-click access to core college management modules">
        <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-3">
          <button
            onClick={() => onNavigate('students')}
            className="flex flex-col items-center justify-center p-3 rounded-xl bg-slate-950/80 border border-slate-800 hover:border-indigo-500/50 hover:bg-slate-900 transition-all text-center group"
          >
            <UserPlus className="w-5 h-5 text-indigo-400 group-hover:scale-110 transition-transform mb-1.5" />
            <span className="text-xs font-medium text-slate-300">Add Student</span>
          </button>

          <button
            onClick={() => onNavigate('students')}
            className="flex flex-col items-center justify-center p-3 rounded-xl bg-slate-950/80 border border-slate-800 hover:border-indigo-500/50 hover:bg-slate-900 transition-all text-center group"
          >
            <UploadCloud className="w-5 h-5 text-sky-400 group-hover:scale-110 transition-transform mb-1.5" />
            <span className="text-xs font-medium text-slate-300">Import CSV</span>
          </button>

          <button
            onClick={() => onNavigate('staff')}
            className="flex flex-col items-center justify-center p-3 rounded-xl bg-slate-950/80 border border-slate-800 hover:border-indigo-500/50 hover:bg-slate-900 transition-all text-center group"
          >
            <Users className="w-5 h-5 text-emerald-400 group-hover:scale-110 transition-transform mb-1.5" />
            <span className="text-xs font-medium text-slate-300">Add Staff</span>
          </button>

          <button
            onClick={() => onNavigate('staff-assignments')}
            className="flex flex-col items-center justify-center p-3 rounded-xl bg-slate-950/80 border border-slate-800 hover:border-indigo-500/50 hover:bg-slate-900 transition-all text-center group"
          >
            <Layers className="w-5 h-5 text-amber-400 group-hover:scale-110 transition-transform mb-1.5" />
            <span className="text-xs font-medium text-slate-300">Assign Staff</span>
          </button>

          <button
            onClick={() => onNavigate('marks-upload')}
            className="flex flex-col items-center justify-center p-3 rounded-xl bg-slate-950/80 border border-slate-800 hover:border-indigo-500/50 hover:bg-slate-900 transition-all text-center group"
          >
            <UploadCloud className="w-5 h-5 text-violet-400 group-hover:scale-110 transition-transform mb-1.5" />
            <span className="text-xs font-medium text-slate-300">Upload Marks</span>
          </button>

          <button
            onClick={onOpenNoticeWorkflow}
            className="flex flex-col items-center justify-center p-3 rounded-xl bg-slate-950/80 border border-slate-800 hover:border-indigo-500/50 hover:bg-slate-900 transition-all text-center group"
          >
            <Megaphone className="w-5 h-5 text-rose-400 group-hover:scale-110 transition-transform mb-1.5" />
            <span className="text-xs font-medium text-slate-300">Notice Wizard</span>
          </button>

          <button
            onClick={() => onNavigate('performance')}
            className="flex flex-col items-center justify-center p-3 rounded-xl bg-slate-950/80 border border-slate-800 hover:border-indigo-500/50 hover:bg-slate-900 transition-all text-center group"
          >
            <TrendingUp className="w-5 h-5 text-teal-400 group-hover:scale-110 transition-transform mb-1.5" />
            <span className="text-xs font-medium text-slate-300">View Analytics</span>
          </button>

          <button
            onClick={() => onNavigate('reports')}
            className="flex flex-col items-center justify-center p-3 rounded-xl bg-slate-950/80 border border-slate-800 hover:border-indigo-500/50 hover:bg-slate-900 transition-all text-center group"
          >
            <FileText className="w-5 h-5 text-amber-400 group-hover:scale-110 transition-transform mb-1.5" />
            <span className="text-xs font-medium text-slate-300">Generate Report</span>
          </button>
        </div>
      </Card>

      {/* Analytics Visualization: Department & Year Performance Charts */}
      {(() => {
        const deptPerformanceList = (data?.department_performance || (data as any)?.departmentPerformance || []);
        const hasDeptMarks = deptPerformanceList.some((d: any) => (d.ia1_avg > 0 || d.ia2_avg > 0 || d.pass_rate > 0));

        const yearPerformanceList = (data?.year_performance || (data as any)?.yearPerformance || []);
        const hasYearMarks = yearPerformanceList.some((y: any) => (y.ia1_avg > 0 || y.ia2_avg > 0 || y.pass_rate > 0));

        const topStudentsList: any[] = (data as any)?.topStudents || (data as any)?.allTopStudents || [];
        const attentionList: any[] = (data as any)?.studentsNeedingAttention || [];

        return (
          <>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Department Performance Bar Chart */}
              <Card
                title="Department Performance (IA-1 vs IA-2)"
                subtitle="Comparative assessment metrics across engineering streams"
                action={
                  <Button variant="ghost" size="sm" onClick={() => onNavigate('department-analytics')}>
                    Explore Details
                  </Button>
                }
              >
                {hasDeptMarks ? (
                  <div className="h-64 w-full">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart
                        data={deptPerformanceList}
                        margin={{ top: 10, right: 10, left: -20, bottom: 0 }}
                      >
                        <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                        <XAxis dataKey="code" stroke="#64748b" tick={{ fontSize: 12 }} />
                        <YAxis stroke="#64748b" tick={{ fontSize: 12 }} domain={[0, 100]} />
                        <Tooltip
                          contentStyle={{ backgroundColor: '#0f172a', borderColor: '#334155', borderRadius: '8px', color: '#fff' }}
                        />
                        <Legend wrapperStyle={{ fontSize: '12px' }} />
                        <Bar dataKey="ia1_avg" name="IA-1 Average (%)" fill="#6366f1" radius={[4, 4, 0, 0]} />
                        <Bar dataKey="ia2_avg" name="IA-2 Average (%)" fill="#10b981" radius={[4, 4, 0, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                ) : (
                  <div className="h-64 flex flex-col items-center justify-center p-6 text-center text-slate-400 border border-dashed border-slate-800 rounded-xl">
                    <Building2 className="w-8 h-8 text-slate-600 mb-2" />
                    <p className="text-sm font-semibold text-slate-300">No Department Evaluation Data Yet</p>
                    <p className="text-xs text-slate-500 mt-1 max-w-sm">
                      Departmental metrics will be automatically analyzed and plotted once internal assessment marks are recorded.
                    </p>
                  </div>
                )}
              </Card>

              {/* Year Performance Comparative */}
              <Card
                title="Year-Wise Progression"
                subtitle="Pass percentages and improvement rates across Year 1 to 4"
                action={
                  <Button variant="ghost" size="sm" onClick={() => onNavigate('year-analytics')}>
                    Year Breakdown
                  </Button>
                }
              >
                {hasYearMarks ? (
                  <div className="h-64 w-full">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart
                        data={yearPerformanceList}
                        margin={{ top: 10, right: 10, left: -20, bottom: 0 }}
                      >
                        <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                        <XAxis dataKey="year" stroke="#64748b" tick={{ fontSize: 12 }} tickFormatter={(y) => `Year ${y}`} />
                        <YAxis stroke="#64748b" tick={{ fontSize: 12 }} domain={[0, 100]} />
                        <Tooltip
                          contentStyle={{ backgroundColor: '#0f172a', borderColor: '#334155', borderRadius: '8px', color: '#fff' }}
                        />
                        <Legend wrapperStyle={{ fontSize: '12px' }} />
                        <Bar dataKey="pass_rate" name="Pass Rate (%)" fill="#38bdf8" radius={[4, 4, 0, 0]} />
                        <Bar dataKey="ia2_avg" name="IA-2 Score (%)" fill="#10b981" radius={[4, 4, 0, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                ) : (
                  <div className="h-64 flex flex-col items-center justify-center p-6 text-center text-slate-400 border border-dashed border-slate-800 rounded-xl">
                    <TrendingUp className="w-8 h-8 text-slate-600 mb-2" />
                    <p className="text-sm font-semibold text-slate-300">No Year-Wise Progression Data Yet</p>
                    <p className="text-xs text-slate-500 mt-1 max-w-sm">
                      Year-wise academic curves will appear as soon as evaluations are uploaded for active student batches.
                    </p>
                  </div>
                )}
              </Card>
            </div>

            {/* College Notices & Notifications Status Widgets */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* College Notices Card */}
              <Card
                title="College Notices Status"
                subtitle="Live circulation status across communication channels"
                action={
                  <Button variant="outline" size="sm" onClick={() => onNavigate('college-notices')}>
                    Manage Notices
                  </Button>
                }
              >
                <div className="grid grid-cols-3 gap-3 text-center">
                  <div className="p-3 bg-slate-950 rounded-xl border border-slate-800">
                    <span className="text-[11px] text-slate-400 block mb-1 font-semibold">Draft Notices</span>
                    <span className="text-xl font-bold text-amber-400">{notices.draft}</span>
                  </div>
                  <div className="p-3 bg-slate-950 rounded-xl border border-slate-800">
                    <span className="text-[11px] text-slate-400 block mb-1 font-semibold">Scheduled</span>
                    <span className="text-xl font-bold text-sky-400">{notices.scheduled}</span>
                  </div>
                  <div className="p-3 bg-slate-950 rounded-xl border border-slate-800">
                    <span className="text-[11px] text-slate-400 block mb-1 font-semibold">Published</span>
                    <span className="text-xl font-bold text-emerald-400">{notices.published}</span>
                  </div>
                </div>
                <div className="mt-4 pt-3 border-t border-slate-800/80 flex items-center justify-between text-xs text-slate-400">
                  <span>Integrated with SMS Gateway &amp; WhatsApp Cloud API</span>
                  <button
                    onClick={onOpenNoticeWorkflow}
                    className="text-indigo-400 hover:text-indigo-300 font-medium"
                  >
                    + Launch Notice &rarr;
                  </button>
                </div>
              </Card>

              {/* Parent Notifications Dispatch Tracker */}
              <Card
                title="Notifications Transmission"
                subtitle="Real-time transmission counters for parent updates"
                action={
                  <Button variant="outline" size="sm" onClick={() => onNavigate('notifications')}>
                    View History
                  </Button>
                }
              >
                <div className="grid grid-cols-4 gap-2 text-center">
                  <div className="p-2.5 bg-slate-950 rounded-lg border border-slate-800">
                    <span className="text-[10px] text-slate-400 block mb-0.5">Pending</span>
                    <span className="text-base font-bold text-amber-400">{notifications.pending}</span>
                  </div>
                  <div className="p-2.5 bg-slate-950 rounded-lg border border-slate-800">
                    <span className="text-[10px] text-slate-400 block mb-0.5">Sent</span>
                    <span className="text-base font-bold text-sky-400">{notifications.sent}</span>
                  </div>
                  <div className="p-2.5 bg-slate-950 rounded-lg border border-slate-800">
                    <span className="text-[10px] text-slate-400 block mb-0.5">Delivered</span>
                    <span className="text-base font-bold text-emerald-400">{notifications.delivered}</span>
                  </div>
                  <div className="p-2.5 bg-slate-950 rounded-lg border border-slate-800">
                    <span className="text-[10px] text-slate-400 block mb-0.5">Failed</span>
                    <span className="text-base font-bold text-rose-400">{notifications.failed}</span>
                  </div>
                </div>
                <div className="mt-4 pt-3 border-t border-slate-800/80 flex items-center justify-between text-xs text-slate-400">
                  <span className="text-emerald-400 font-semibold">
                    Live parent notification gateway
                  </span>
                  <button
                    onClick={() => onNavigate('notification-history')}
                    className="text-indigo-400 hover:text-indigo-300 font-medium"
                  >
                    Audit Logs &rarr;
                  </button>
                </div>
              </Card>
            </div>

            {/* Top Students & Students Needing Attention */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Top Students */}
              <Card
                title="Top Performing Students"
                subtitle="Excellence in cumulative internal assessments"
                icon={<Award className="w-5 h-5 text-amber-400" />}
                action={
                  <Button variant="ghost" size="sm" onClick={() => onNavigate('performance')}>
                    Full Rank List
                  </Button>
                }
              >
                {topStudentsList.length > 0 ? (
                  <div className="space-y-2.5">
                    {topStudentsList.slice(0, 4).map((s: any, idx: number) => (
                      <div
                        key={s.studentId || s.id || s.registerNumber || idx}
                        className="flex items-center justify-between p-3 rounded-lg bg-slate-950/70 border border-slate-800/80"
                      >
                        <div className="flex items-center gap-3">
                          <div className="w-6 h-6 rounded-full bg-amber-500/20 text-amber-300 font-bold text-xs flex items-center justify-center border border-amber-500/30">
                            #{idx + 1}
                          </div>
                          <div>
                            <div className="font-semibold text-xs text-white">{s.studentName || s.name}</div>
                            <div className="text-[10px] text-slate-400">
                              {s.registerNumber || s.reg} {s.departmentCode ? `• ${s.departmentCode}` : ''}
                            </div>
                          </div>
                        </div>
                        <Badge variant="success" size="sm" className="font-bold">
                          {(s.percentage ?? s.score ?? 0).toFixed(1)}%
                        </Badge>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="p-8 text-center text-slate-400 border border-dashed border-slate-800 rounded-xl">
                    <Award className="w-7 h-7 text-slate-600 mx-auto mb-2" />
                    <p className="text-xs font-semibold text-slate-300">No Student Rankings Yet</p>
                    <p className="text-[11px] text-slate-500 mt-1">Top performing candidates will be ranked here after marks entry.</p>
                  </div>
                )}
              </Card>

              {/* Students Needing Attention */}
              <Card
                title="Students Needing Academic Attention"
                subtitle="Targeted intervention list for counseling and remedial coaching"
                icon={<AlertTriangle className="w-5 h-5 text-rose-400" />}
                action={
                  <Button variant="ghost" size="sm" onClick={() => onNavigate('performance')}>
                    Remedial List
                  </Button>
                }
              >
                {attentionList.length > 0 ? (
                  <div className="space-y-2.5">
                    {attentionList.slice(0, 4).map((s: any, idx: number) => (
                      <div
                        key={s.studentId || s.id || s.registerNumber || idx}
                        className="flex items-center justify-between p-3 rounded-lg bg-slate-950/70 border border-slate-800/80"
                      >
                        <div className="flex items-center gap-3">
                          <div className="w-6 h-6 rounded-full bg-rose-500/20 text-rose-300 font-bold text-xs flex items-center justify-center border border-rose-500/30">
                            !
                          </div>
                          <div>
                            <div className="font-semibold text-xs text-white">{s.studentName || s.name}</div>
                            <div className="text-[10px] text-slate-400">
                              {s.registerNumber || s.reg} {s.departmentCode ? `• ${s.departmentCode}` : ''}
                            </div>
                          </div>
                        </div>
                        <Badge variant="danger" size="sm" className="font-bold">
                          {(s.percentage ?? s.score ?? 0).toFixed(1)}%
                        </Badge>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="p-8 text-center text-slate-400 border border-dashed border-slate-800 rounded-xl">
                    <CheckCircle className="w-7 h-7 text-emerald-500/50 mx-auto mb-2" />
                    <p className="text-xs font-semibold text-slate-300">No Remedial Interventions Needed</p>
                    <p className="text-[11px] text-slate-500 mt-1">All evaluated students currently meet institutional performance criteria.</p>
                  </div>
                )}
              </Card>
            </div>
          </>
        );
      })()}
    </div>
  );
};
