import React, { useEffect, useState } from 'react';
import { api } from '../../services/api';
import { Card } from '../../components/common/Card';
import { Button } from '../../components/common/Button';
import { Badge } from '../../components/common/Badge';
import { StaffDashboardData } from '../../types';
import {
  Layers,
  BookOpen,
  Users,
  Clock,
  CheckCircle,
  UploadCloud,
  Edit,
  TrendingUp,
  FileSpreadsheet,
} from 'lucide-react';

interface StaffDashboardViewProps {
  onNavigate: (module: string) => void;
}

export const StaffDashboardView: React.FC<StaffDashboardViewProps> = ({ onNavigate }) => {
  const [data, setData] = useState<StaffDashboardData | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const fetchStaffDashboard = async () => {
      setIsLoading(true);
      try {
        const res = await api.get<StaffDashboardData>('/staff/dashboard');
        setData(res);
      } catch (err) {
        console.error('Failed to load staff dashboard data:', err);
      } finally {
        setIsLoading(false);
      }
    };
    fetchStaffDashboard();
  }, []);

  const metrics = data?.metrics || {
    assigned_classes: 0,
    assigned_subjects: 0,
    total_students: 0,
    pending_marks: 0,
    completed_assessments: 0,
  };

  const assignedClasses = data?.assigned_classes || [];
  const assignedSubjects = data?.assigned_subjects || [];
  const recentUploads = data?.recent_uploads || [];

  return (
    <div className="space-y-6 animate-in fade-in duration-200">
      {/* Welcome Banner */}
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-emerald-950 via-slate-900 to-slate-900 border border-emerald-500/30 p-6 shadow-xl">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <Badge variant="success" size="sm" className="mb-2">
              Faculty Academic Console
            </Badge>
            <h2 className="text-xl sm:text-2xl font-black text-white">
              Teaching Faculty Dashboard
            </h2>
            <p className="text-xs text-slate-300 mt-1 max-w-xl leading-relaxed">
              Manage your assigned course evaluations, upload internal assessment marks, and review cohort performance.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="success"
              size="sm"
              onClick={() => onNavigate('staff-marks-upload')}
              leftIcon={<UploadCloud className="w-4 h-4" />}
            >
              Upload Marks
            </Button>
          </div>
        </div>
      </div>

      {/* 5 Staff Metric Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
        <div className="p-4 rounded-xl bg-slate-900/80 border border-slate-800 shadow-md">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-semibold text-slate-400">Assigned Classes</span>
            <div className="p-2 rounded-lg bg-emerald-950 text-emerald-400 border border-emerald-800/50">
              <Layers className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl font-bold text-white">{metrics.assigned_classes}</div>
          <p className="text-[11px] text-slate-400 mt-1">Active class sections</p>
        </div>

        <div className="p-4 rounded-xl bg-slate-900/80 border border-slate-800 shadow-md">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-semibold text-slate-400">Assigned Subjects</span>
            <div className="p-2 rounded-lg bg-indigo-950 text-indigo-400 border border-indigo-800/50">
              <BookOpen className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl font-bold text-white">{metrics.assigned_subjects}</div>
          <p className="text-[11px] text-slate-400 mt-1">Curriculum courses</p>
        </div>

        <div className="p-4 rounded-xl bg-slate-900/80 border border-slate-800 shadow-md">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-semibold text-slate-400">Total Students</span>
            <div className="p-2 rounded-lg bg-sky-950 text-sky-400 border border-sky-800/50">
              <Users className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl font-bold text-white">{metrics.total_students}</div>
          <p className="text-[11px] text-slate-400 mt-1">In assigned batches</p>
        </div>

        <div className="p-4 rounded-xl bg-slate-900/80 border border-slate-800 shadow-md">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-semibold text-slate-400">Pending Marks</span>
            <div className="p-2 rounded-lg bg-amber-950 text-amber-400 border border-amber-800/50">
              <Clock className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl font-bold text-amber-400">{metrics.pending_marks}</div>
          <p className="text-[11px] text-slate-400 mt-1">Awaiting evaluation</p>
        </div>

        <div className="p-4 rounded-xl bg-slate-900/80 border border-slate-800 shadow-md">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-semibold text-slate-400">Completed Exams</span>
            <div className="p-2 rounded-lg bg-emerald-950 text-emerald-400 border border-emerald-800/50">
              <CheckCircle className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl font-bold text-emerald-400">{metrics.completed_assessments}</div>
          <p className="text-[11px] text-slate-400 mt-1">Assessments filed</p>
        </div>
      </div>

      {/* Quick Actions (4 Actions) */}
      <Card title="Quick Tasks" subtitle="Frequent marks management actions">
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <button
            onClick={() => onNavigate('staff-marks-upload')}
            className="flex flex-col items-center justify-center p-3 rounded-xl bg-slate-950 border border-slate-800 hover:border-emerald-500/50 hover:bg-slate-900 transition-all text-center group"
          >
            <UploadCloud className="w-5 h-5 text-emerald-400 group-hover:scale-110 transition-transform mb-1.5" />
            <span className="text-xs font-medium text-slate-200">Upload Marks</span>
          </button>

          <button
            onClick={() => onNavigate('staff-marks-management')}
            className="flex flex-col items-center justify-center p-3 rounded-xl bg-slate-950 border border-slate-800 hover:border-emerald-500/50 hover:bg-slate-900 transition-all text-center group"
          >
            <FileSpreadsheet className="w-5 h-5 text-sky-400 group-hover:scale-110 transition-transform mb-1.5" />
            <span className="text-xs font-medium text-slate-200">Enter Marks</span>
          </button>

          <button
            onClick={() => onNavigate('my-classes')}
            className="flex flex-col items-center justify-center p-3 rounded-xl bg-slate-950 border border-slate-800 hover:border-emerald-500/50 hover:bg-slate-900 transition-all text-center group"
          >
            <Users className="w-5 h-5 text-indigo-400 group-hover:scale-110 transition-transform mb-1.5" />
            <span className="text-xs font-medium text-slate-200">View Assigned Students</span>
          </button>

          <button
            onClick={() => onNavigate('staff-performance')}
            className="flex flex-col items-center justify-center p-3 rounded-xl bg-slate-950 border border-slate-800 hover:border-emerald-500/50 hover:bg-slate-900 transition-all text-center group"
          >
            <TrendingUp className="w-5 h-5 text-amber-400 group-hover:scale-110 transition-transform mb-1.5" />
            <span className="text-xs font-medium text-slate-200">View Assigned Performance</span>
          </button>
        </div>
      </Card>

      {/* Sections: My Classes & My Subjects */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* My Classes */}
        <Card
          title="My Classes"
          subtitle="Class batches assigned to you this semester"
          action={
            <Button variant="ghost" size="sm" onClick={() => onNavigate('my-classes')}>
              View All
            </Button>
          }
        >
          <div className="space-y-3">
            {assignedClasses.length > 0 ? (
              assignedClasses.map((cls) => (
                <div
                  key={cls.id}
                  className="flex items-center justify-between p-3 rounded-xl bg-slate-950 border border-slate-800"
                >
                  <div className="flex items-center gap-3">
                    <div className="p-2 rounded-lg bg-emerald-950 text-emerald-400 border border-emerald-800/40">
                      <Layers className="w-4 h-4" />
                    </div>
                    <div>
                      <span className="font-semibold text-white text-xs block">
                        {cls.department} - Year {cls.year} (Section {cls.section})
                      </span>
                      <span className="text-[11px] text-slate-400">{cls.student_count} Enrolled Students</span>
                    </div>
                  </div>
                  <Badge variant="primary" size="sm">
                    Active
                  </Badge>
                </div>
              ))
            ) : (
              <div className="p-6 text-center border border-dashed border-slate-800 rounded-xl text-xs text-slate-500">
                No active class allocations assigned to you yet.
              </div>
            )}
          </div>
        </Card>

        {/* My Subjects */}
        <Card
          title="My Subjects"
          subtitle="Course syllabi under your academic evaluation"
          action={
            <Button variant="ghost" size="sm" onClick={() => onNavigate('my-subjects')}>
              View All
            </Button>
          }
        >
          <div className="space-y-3">
            {assignedSubjects.length > 0 ? (
              assignedSubjects.map((sb) => (
                <div
                  key={sb.id}
                  className="flex items-center justify-between p-3 rounded-xl bg-slate-950 border border-slate-800"
                >
                  <div className="flex items-center gap-3">
                    <div className="p-2 rounded-lg bg-indigo-950 text-indigo-400 border border-indigo-800/40">
                      <BookOpen className="w-4 h-4" />
                    </div>
                    <div>
                      <span className="font-mono text-xs font-bold text-indigo-300 block">{sb.code}</span>
                      <span className="text-xs text-white font-medium">{sb.name}</span>
                    </div>
                  </div>
                  <Badge variant="neutral" size="sm">
                    Sem {sb.semester}
                  </Badge>
                </div>
              ))
            ) : (
              <div className="p-6 text-center border border-dashed border-slate-800 rounded-xl text-xs text-slate-500">
                No course subjects allocated to your profile yet.
              </div>
            )}
          </div>
        </Card>
      </div>

      {/* Recent Marks Uploads */}
      <Card title="Recent Marks Uploads" subtitle="Latest assessment submissions recorded">
        <div className="space-y-2.5">
          {recentUploads.length > 0 ? (
            recentUploads.map((up) => (
              <div
                key={up.id}
                className="flex items-center justify-between p-3 rounded-lg bg-slate-950 border border-slate-800 text-xs"
              >
                <div className="flex items-center gap-3">
                  <div className="p-1.5 rounded-lg bg-slate-800 text-emerald-400">
                    <CheckCircle className="w-4 h-4" />
                  </div>
                  <div>
                    <span className="font-semibold text-white">
                      {up.subject_code} - {up.assessment} ({up.section})
                    </span>
                    <span className="text-slate-400 block text-[11px]">{up.count} Students Evaluated</span>
                  </div>
                </div>
                <span className="text-slate-400 font-mono text-[11px]">{up.date}</span>
              </div>
            ))
          ) : (
            <div className="p-6 text-center border border-dashed border-slate-800 rounded-xl text-xs text-slate-500">
              No recent assessment mark uploads recorded yet.
            </div>
          )}
        </div>
      </Card>
    </div>
  );
};
