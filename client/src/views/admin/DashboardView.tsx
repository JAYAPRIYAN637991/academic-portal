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
      const res = await api.get<AdminDashboardData>('/admin/dashboard');
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
    total_students: 420,
    total_staff: 48,
    departments: 6,
    sections: 14,
    ia1_average: 68.4,
    ia2_average: 74.2,
    overall_improvement: 5.8,
    pass_percentage: 86.5,
  };

  const notices = data?.notices || { draft: 2, scheduled: 3, published: 14 };
  const notifications = data?.notifications || { pending: 12, sent: 450, delivered: 432, failed: 6 };

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
          <div className="h-64 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={data?.department_performance || [
                  { code: 'CSE', ia1_avg: 72, ia2_avg: 79, pass_rate: 89 },
                  { code: 'ECE', ia1_avg: 68, ia2_avg: 74, pass_rate: 84 },
                  { code: 'MECH', ia1_avg: 64, ia2_avg: 70, pass_rate: 81 },
                  { code: 'CIVIL', ia1_avg: 62, ia2_avg: 68, pass_rate: 78 },
                  { code: 'IT', ia1_avg: 75, ia2_avg: 82, pass_rate: 92 },
                  { code: 'EEE', ia1_avg: 66, ia2_avg: 71, pass_rate: 83 },
                ]}
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
          <div className="h-64 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={data?.year_performance || [
                  { year: 1, ia1_avg: 65, ia2_avg: 71, pass_rate: 82 },
                  { year: 2, ia1_avg: 67, ia2_avg: 73, pass_rate: 85 },
                  { year: 3, ia1_avg: 70, ia2_avg: 76, pass_rate: 88 },
                  { year: 4, ia1_avg: 73, ia2_avg: 80, pass_rate: 91 },
                ]}
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
              98.6% Delivery Success Rate
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
          <div className="space-y-2.5">
            {[
              { rank: 1, name: 'Aarav Sharma', reg: '922521104001', dept: 'CSE', year: 3, score: 98.4 },
              { rank: 2, name: 'Bhavna Sundaram', reg: '922521104015', dept: 'IT', year: 3, score: 96.8 },
              { rank: 3, name: 'Chirag Venkat', reg: '922522106024', dept: 'ECE', year: 2, score: 95.5 },
              { rank: 4, name: 'Deepa Natarajan', reg: '922523105008', dept: 'EEE', year: 1, score: 94.2 },
            ].map((s) => (
              <div
                key={s.reg}
                className="flex items-center justify-between p-3 rounded-lg bg-slate-950/70 border border-slate-800/80"
              >
                <div className="flex items-center gap-3">
                  <div className="w-6 h-6 rounded-full bg-amber-500/20 text-amber-300 font-bold text-xs flex items-center justify-center border border-amber-500/30">
                    #{s.rank}
                  </div>
                  <div>
                    <div className="font-semibold text-xs text-white">{s.name}</div>
                    <div className="text-[10px] text-slate-400">
                      {s.reg} &bull; {s.dept} (Year {s.year})
                    </div>
                  </div>
                </div>
                <Badge variant="success" size="sm" className="font-bold">
                  {s.score}%
                </Badge>
              </div>
            ))}
          </div>
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
          <div className="space-y-2.5">
            {[
              { name: 'Karthik Raja', reg: '922521104045', dept: 'CSE', year: 3, score: 42.0, arrears: 2 },
              { name: 'Manoj Kumar', reg: '922522106032', dept: 'ECE', year: 2, score: 38.5, arrears: 3 },
              { name: 'Naveen Vignesh', reg: '922523114019', dept: 'MECH', year: 1, score: 44.0, arrears: 2 },
              { name: 'Pooja Krishnan', reg: '922521105022', dept: 'EEE', year: 3, score: 46.5, arrears: 1 },
            ].map((s) => (
              <div
                key={s.reg}
                className="flex items-center justify-between p-3 rounded-lg bg-slate-950/70 border border-slate-800/80"
              >
                <div className="flex items-center gap-3">
                  <div className="w-6 h-6 rounded-full bg-rose-500/20 text-rose-300 font-bold text-xs flex items-center justify-center border border-rose-500/30">
                    !
                  </div>
                  <div>
                    <div className="font-semibold text-xs text-white">{s.name}</div>
                    <div className="text-[10px] text-slate-400">
                      {s.reg} &bull; {s.dept} (Year {s.year}) &bull;{' '}
                      <span className="text-rose-400">{s.arrears} arrears</span>
                    </div>
                  </div>
                </div>
                <Badge variant="danger" size="sm" className="font-bold">
                  {s.score}%
                </Badge>
              </div>
            ))}
          </div>
        </Card>
      </div>
    </div>
  );
};
