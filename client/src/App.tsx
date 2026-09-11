import React, { useState, useEffect } from 'react';
import { useAuth } from './context/AuthContext';
import { LoginView } from './views/auth/LoginView';
import { AdminLayout } from './components/layout/AdminLayout';
import { StaffLayout } from './components/layout/StaffLayout';
import { NoticeWorkflowModal } from './components/notices/NoticeWorkflowModal';

// Admin Views (21 Modules)
import { DashboardView } from './views/admin/DashboardView';
import { AcademicYearsView } from './views/admin/AcademicYearsView';
import { DepartmentsView } from './views/admin/DepartmentsView';
import { YearsSectionsView } from './views/admin/YearsSectionsView';
import { StudentsView } from './views/admin/StudentsView';
import { SubjectsView } from './views/admin/SubjectsView';
import { StaffView } from './views/admin/StaffView';
import { StaffAssignmentsView } from './views/admin/StaffAssignmentsView';
import { MarksUploadView } from './views/admin/MarksUploadView';
import { MarksManagementView } from './views/admin/MarksManagementView';
import { MarkChangeHistoryView } from './views/admin/MarkChangeHistoryView';
import { PerformanceView } from './views/admin/PerformanceView';
import { SectionAnalyticsView } from './views/admin/SectionAnalyticsView';
import { YearAnalyticsView } from './views/admin/YearAnalyticsView';
import { DepartmentAnalyticsView } from './views/admin/DepartmentAnalyticsView';
import { OverallResultView } from './views/admin/OverallResultView';
import { CollegeNoticesView } from './views/admin/CollegeNoticesView';
import { NotificationsView } from './views/admin/NotificationsView';
import { NotificationHistoryView } from './views/admin/NotificationHistoryView';
import { ReportsView } from './views/admin/ReportsView';
import { SettingsView } from './views/admin/SettingsView';

// Staff Views (6 Modules)
import { StaffDashboardView } from './views/staff/StaffDashboardView';
import { MyClassesView } from './views/staff/MyClassesView';
import { MySubjectsView } from './views/staff/MySubjectsView';
import { StaffMarksUploadView } from './views/staff/StaffMarksUploadView';
import { StaffMarksManagementView } from './views/staff/StaffMarksManagementView';
import { StaffPerformanceView } from './views/staff/StaffPerformanceView';

import { Button } from './components/common/Button';
import { Loader2, AlertCircle } from 'lucide-react';

export const ADMIN_MODULES = [
  'dashboard', 'academic-years', 'departments', 'years-sections', 'students',
  'subjects', 'staff', 'staff-assignments', 'marks-upload', 'marks-management',
  'mark-history', 'performance', 'section-analytics', 'year-analytics',
  'department-analytics', 'overall-result', 'college-notices', 'notifications',
  'notification-history', 'reports', 'settings'
];

export const STAFF_MODULES = [
  'staff-dashboard', 'my-classes', 'my-subjects', 'staff-marks-upload',
  'staff-marks-management', 'staff-performance'
];

export const App: React.FC = () => {
  const { user, isAuthenticated, isLoading } = useAuth();

  // Module Routing state with URL hash synchronization
  const [adminModule, setAdminModule] = useState<string>(() => {
    const hash = window.location.hash.replace('#', '');
    return hash || 'dashboard';
  });

  const [staffModule, setStaffModule] = useState<string>(() => {
    const hash = window.location.hash.replace('#', '');
    return hash || 'staff-dashboard';
  });

  const [isNoticeWizardOpen, setIsNoticeWizardOpen] = useState(false);

  // Sync hash to state on back/forward buttons
  useEffect(() => {
    const handleHashChange = () => {
      const hash = window.location.hash.replace('#', '');
      if (user?.role === 'ADMIN' && hash && ADMIN_MODULES.includes(hash)) {
        setAdminModule(hash);
      } else if (user?.role === 'STAFF' && hash && STAFF_MODULES.includes(hash)) {
        setStaffModule(hash);
      }
    };
    window.addEventListener('hashchange', handleHashChange);
    return () => window.removeEventListener('hashchange', handleHashChange);
  }, [user]);

  // Synchronize correct default landing dashboard when user authenticates
  useEffect(() => {
    if (user?.role === 'ADMIN') {
      const hash = window.location.hash.replace('#', '');
      if (!ADMIN_MODULES.includes(hash)) {
        setAdminModule('dashboard');
        window.location.hash = 'dashboard';
      } else {
        setAdminModule(hash);
      }
    } else if (user?.role === 'STAFF') {
      const hash = window.location.hash.replace('#', '');
      if (!STAFF_MODULES.includes(hash)) {
        setStaffModule('staff-dashboard');
        window.location.hash = 'staff-dashboard';
      } else {
        setStaffModule(hash);
      }
    }
  }, [user]);

  const handleSelectAdminModule = (id: string) => {
    setAdminModule(id);
    window.location.hash = id;
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleSelectStaffModule = (id: string) => {
    setStaffModule(id);
    window.location.hash = id;
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center text-slate-400">
        <Loader2 className="w-10 h-10 animate-spin text-indigo-500 mb-4" />
        <p className="text-xs uppercase tracking-widest font-semibold text-slate-500">
          Initializing Institutional Platform...
        </p>
      </div>
    );
  }

  if (!isAuthenticated || !user) {
    return <LoginView onLoginSuccess={() => {}} />;
  }

  // ADMIN ROUTING (21 MODULES)
  if (user.role === 'ADMIN') {
    return (
      <AdminLayout currentModule={adminModule} onSelectModule={handleSelectAdminModule}>
        {adminModule === 'dashboard' && (
          <DashboardView
            onNavigate={handleSelectAdminModule}
            onOpenNoticeWorkflow={() => setIsNoticeWizardOpen(true)}
          />
        )}
        {adminModule === 'academic-years' && <AcademicYearsView />}
        {adminModule === 'departments' && <DepartmentsView />}
        {adminModule === 'years-sections' && <YearsSectionsView />}
        {adminModule === 'students' && <StudentsView />}
        {adminModule === 'subjects' && <SubjectsView />}
        {adminModule === 'staff' && <StaffView />}
        {adminModule === 'staff-assignments' && <StaffAssignmentsView />}
        {adminModule === 'marks-upload' && <MarksUploadView />}
        {adminModule === 'marks-management' && <MarksManagementView />}
        {adminModule === 'mark-history' && <MarkChangeHistoryView />}
        {adminModule === 'performance' && <PerformanceView />}
        {adminModule === 'section-analytics' && <SectionAnalyticsView />}
        {adminModule === 'year-analytics' && <YearAnalyticsView />}
        {adminModule === 'department-analytics' && <DepartmentAnalyticsView />}
        {adminModule === 'overall-result' && <OverallResultView />}
        {adminModule === 'college-notices' && <CollegeNoticesView />}
        {adminModule === 'notifications' && <NotificationsView />}
        {adminModule === 'notification-history' && <NotificationHistoryView />}
        {adminModule === 'reports' && <ReportsView />}
        {adminModule === 'settings' && <SettingsView />}

        {!ADMIN_MODULES.includes(adminModule) && (
          <div className="p-8 text-center bg-slate-900 border border-slate-800 rounded-2xl max-w-md mx-auto my-12">
            <div className="w-12 h-12 rounded-xl bg-indigo-500/10 text-indigo-400 flex items-center justify-center mx-auto mb-3">
              <AlertCircle className="w-6 h-6" />
            </div>
            <h2 className="text-lg font-bold text-white mb-1">Module Not Found</h2>
            <p className="text-xs text-slate-400 mb-4">The module "{adminModule}" does not exist in the administrative directory.</p>
            <Button variant="primary" size="sm" onClick={() => handleSelectAdminModule('dashboard')}>
              Return to Dashboard
            </Button>
          </div>
        )}

        {/* Global Notice Wizard Modal */}
        {isNoticeWizardOpen && (
          <NoticeWorkflowModal
            isOpen={isNoticeWizardOpen}
            onClose={() => setIsNoticeWizardOpen(false)}
            onSuccess={() => setIsNoticeWizardOpen(false)}
          />
        )}
      </AdminLayout>
    );
  }

  // STAFF ROUTING (STRICTLY RESTRICTED 6 MODULES)
  if (user.role === 'STAFF') {
    return (
      <StaffLayout currentModule={staffModule} onSelectModule={handleSelectStaffModule}>
        {staffModule === 'staff-dashboard' && (
          <StaffDashboardView onNavigate={handleSelectStaffModule} />
        )}
        {staffModule === 'my-classes' && <MyClassesView />}
        {staffModule === 'my-subjects' && (
          <MySubjectsView onNavigateToUpload={() => handleSelectStaffModule('staff-marks-upload')} />
        )}
        {staffModule === 'staff-marks-upload' && <StaffMarksUploadView />}
        {staffModule === 'staff-marks-management' && <StaffMarksManagementView />}
        {staffModule === 'staff-performance' && <StaffPerformanceView />}

        {!STAFF_MODULES.includes(staffModule) && (
          <div className="p-8 text-center bg-slate-900 border border-slate-800 rounded-2xl max-w-md mx-auto my-12">
            <div className="w-12 h-12 rounded-xl bg-indigo-500/10 text-indigo-400 flex items-center justify-center mx-auto mb-3">
              <AlertCircle className="w-6 h-6" />
            </div>
            <h2 className="text-lg font-bold text-white mb-1">Module Not Found</h2>
            <p className="text-xs text-slate-400 mb-4">The module "{staffModule}" does not exist in your faculty portal.</p>
            <Button variant="primary" size="sm" onClick={() => handleSelectStaffModule('staff-dashboard')}>
              Return to Dashboard
            </Button>
          </div>
        )}
      </StaffLayout>
    );
  }

  return <LoginView onLoginSuccess={() => {}} />;
};
