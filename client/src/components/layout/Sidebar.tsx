import React from 'react';
import {
  LayoutDashboard,
  Calendar,
  Building2,
  Layers,
  GraduationCap,
  BookOpen,
  Users,
  UserCheck,
  UploadCloud,
  FileSpreadsheet,
  TrendingUp,
  PieChart,
  BarChart3,
  Building,
  Award,
  Megaphone,
  Bell,
  History,
  ClipboardList,
  FileText,
  Settings,
  X,
  ShieldCheck,
  Briefcase
} from 'lucide-react';
import { UserRole } from '../../types';

export interface NavItem {
  id: string;
  label: string;
  icon: React.ReactNode;
  category?: string;
}

export const ADMIN_NAV_ITEMS: NavItem[] = [
  { id: 'dashboard', label: 'Dashboard', icon: <LayoutDashboard className="w-4 h-4" />, category: 'Overview' },
  
  // Academic Structure
  { id: 'academic-years', label: 'Academic Years', icon: <Calendar className="w-4 h-4" />, category: 'Structure' },
  { id: 'departments', label: 'Departments', icon: <Building2 className="w-4 h-4" />, category: 'Structure' },
  { id: 'years-sections', label: 'Years & Sections', icon: <Layers className="w-4 h-4" />, category: 'Structure' },
  { id: 'students', label: 'Students', icon: <GraduationCap className="w-4 h-4" />, category: 'Structure' },
  { id: 'subjects', label: 'Subjects', icon: <BookOpen className="w-4 h-4" />, category: 'Structure' },
  
  // Faculty
  { id: 'staff', label: 'Staff', icon: <Users className="w-4 h-4" />, category: 'Faculty' },
  { id: 'staff-assignments', label: 'Staff Assignments', icon: <UserCheck className="w-4 h-4" />, category: 'Faculty' },
  
  // Marks & Assessments
  { id: 'marks-upload', label: 'Marks Upload', icon: <UploadCloud className="w-4 h-4" />, category: 'Marks & Exams' },
  { id: 'marks-management', label: 'Marks Management', icon: <FileSpreadsheet className="w-4 h-4" />, category: 'Marks & Exams' },
  { id: 'mark-history', label: 'Mark Change History', icon: <ClipboardList className="w-4 h-4" />, category: 'Marks & Exams' },

  // Performance & Analytics
  { id: 'performance', label: 'Performance', icon: <TrendingUp className="w-4 h-4" />, category: 'Analytics' },
  { id: 'section-analytics', label: 'Section Analytics', icon: <PieChart className="w-4 h-4" />, category: 'Analytics' },
  { id: 'year-analytics', label: 'Year Analytics', icon: <BarChart3 className="w-4 h-4" />, category: 'Analytics' },
  { id: 'department-analytics', label: 'Department Analytics', icon: <Building className="w-4 h-4" />, category: 'Analytics' },
  { id: 'overall-result', label: 'Overall Result', icon: <Award className="w-4 h-4" />, category: 'Analytics' },

  // Communications & Notices
  { id: 'college-notices', label: 'College Notices', icon: <Megaphone className="w-4 h-4" />, category: 'Communication' },
  { id: 'notifications', label: 'Notifications', icon: <Bell className="w-4 h-4" />, category: 'Communication' },
  { id: 'notification-history', label: 'Notification History', icon: <History className="w-4 h-4" />, category: 'Communication' },

  // Reports & Configuration
  { id: 'reports', label: 'Reports', icon: <FileText className="w-4 h-4" />, category: 'System' },
  { id: 'settings', label: 'Settings', icon: <Settings className="w-4 h-4" />, category: 'System' },
];

export const STAFF_NAV_ITEMS: NavItem[] = [
  { id: 'staff-dashboard', label: 'Dashboard', icon: <LayoutDashboard className="w-4 h-4" /> },
  { id: 'my-classes', label: 'My Classes', icon: <Layers className="w-4 h-4" /> },
  { id: 'my-subjects', label: 'My Subjects', icon: <BookOpen className="w-4 h-4" /> },
  { id: 'staff-marks-upload', label: 'Marks Upload', icon: <UploadCloud className="w-4 h-4" /> },
  { id: 'staff-marks-management', label: 'Marks Management', icon: <FileSpreadsheet className="w-4 h-4" /> },
  { id: 'staff-performance', label: 'Student Performance', icon: <TrendingUp className="w-4 h-4" /> },
];

interface SidebarProps {
  role: UserRole;
  currentModule: string;
  onSelectModule: (id: string) => void;
  isOpenMobile: boolean;
  onCloseMobile: () => void;
}

export const Sidebar: React.FC<SidebarProps> = ({
  role,
  currentModule,
  onSelectModule,
  isOpenMobile,
  onCloseMobile,
}) => {
  const navItems = role === 'ADMIN' ? ADMIN_NAV_ITEMS : STAFF_NAV_ITEMS;

  const content = (
    <div className="flex flex-col h-full bg-slate-950/95 border-r border-slate-800/80 w-64 text-slate-300">
      {/* Brand Header */}
      <div className="h-16 flex items-center justify-between px-5 border-b border-slate-800/80 bg-slate-950 shrink-0">
        <div className="flex items-center gap-2.5">
          <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-indigo-600 to-indigo-400 flex items-center justify-center text-white shadow-md shadow-indigo-600/30">
            {role === 'ADMIN' ? <ShieldCheck className="w-5 h-5" /> : <Briefcase className="w-5 h-5" />}
          </div>
          <div>
            <div className="font-extrabold text-sm text-white tracking-wider">VSB PORTAL</div>
            <div className="text-[10px] text-slate-400 font-medium tracking-wide uppercase">
              {role === 'ADMIN' ? 'Admin Suite' : 'Faculty Portal'}
            </div>
          </div>
        </div>

        {/* Mobile Close Button */}
        <button
          onClick={onCloseMobile}
          className="lg:hidden p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800"
          aria-label="Close menu"
        >
          <X className="w-5 h-5" />
        </button>
      </div>

      {/* Nav List */}
      <nav className="flex-1 overflow-y-auto px-3 py-4 space-y-1">
        {navItems.map((item, idx) => {
          const isActive = currentModule === item.id;
          const showCategory =
            role === 'ADMIN' &&
            item.category &&
            (idx === 0 || navItems[idx - 1].category !== item.category);

          return (
            <React.Fragment key={item.id}>
              {showCategory && (
                <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider px-3 pt-3 pb-1">
                  {item.category}
                </div>
              )}
              <button
                onClick={() => {
                  onSelectModule(item.id);
                  onCloseMobile();
                }}
                className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg text-xs font-medium transition-all duration-150 text-left ${
                  isActive
                    ? role === 'ADMIN'
                      ? 'bg-indigo-600/20 text-indigo-300 font-semibold border-l-2 border-indigo-500 shadow-sm'
                      : 'bg-emerald-600/20 text-emerald-300 font-semibold border-l-2 border-emerald-500 shadow-sm'
                    : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900'
                }`}
              >
                <span className={isActive ? (role === 'ADMIN' ? 'text-indigo-400' : 'text-emerald-400') : 'text-slate-400'}>
                  {item.icon}
                </span>
                <span className="truncate">{item.label}</span>
              </button>
            </React.Fragment>
          );
        })}
      </nav>

      {/* Footer Info */}
      <div className="p-3 border-t border-slate-800/80 bg-slate-950/60 text-[11px] text-slate-400 text-center shrink-0">
        VSB Engineering College &copy; 2026-2027
      </div>
    </div>
  );

  return (
    <>
      {/* Desktop fixed sidebar */}
      <aside className="hidden lg:block fixed inset-y-0 left-0 z-40 w-64">
        {content}
      </aside>

      {/* Mobile Drawer Overlay */}
      {isOpenMobile && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <div
            className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm"
            onClick={onCloseMobile}
            aria-hidden="true"
          />
          <div className="fixed inset-y-0 left-0 z-50 animate-in slide-in-from-left duration-200">
            {content}
          </div>
        </div>
      )}
    </>
  );
};
