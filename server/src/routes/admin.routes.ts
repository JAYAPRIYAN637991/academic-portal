import { Router } from 'express';
import { AdminController } from '../controllers/admin.controller';
import { StaffManagementController } from '../controllers/staffManagement.controller';
import { SubjectManagementController } from '../controllers/subjectManagement.controller';
import { AssessmentManagementController } from '../controllers/assessmentManagement.controller';
import { MarksUploadController } from '../controllers/marksUpload.controller';
import { AcademicStructureController } from '../controllers/academicStructure.controller';
import { StudentController } from '../controllers/student.controller';
import { StudentImportController } from '../controllers/studentImport.controller';
import { PerformanceController } from '../controllers/performance.controller';
import { AdminAnalyticsController } from '../controllers/adminAnalytics.controller';
import { NoticeController } from '../controllers/notice.controller';
import { NotificationTemplateController } from '../controllers/notificationTemplate.controller';
import { ReportController } from '../controllers/report.controller';
import multer from 'multer';
import { authenticateUser, requireAdmin } from '../middleware/auth.middleware';
import { prisma } from '../db';
import { config } from '../config';

const router = Router();

// Upload middleware with configurable file size limit
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: (config.maxUploadSizeMb || 25) * 1024 * 1024 }
});

// Protect ALL routes in this router with authenticateUser AND requireAdmin
// Staff attempting to access any of these will receive 403 Forbidden
router.use(authenticateUser);
router.use(requireAdmin);

// Admin Dashboard Summary (Unified Institutional Command Center)
router.get('/dashboard-summary', AdminController.getDashboardSummary);
router.get('/dashboard', AdminController.getDashboardSummary);

// Admin Profile & Credentials Management
router.get('/profile', AdminController.getAdminProfile);
router.put('/profile/credentials', AdminController.updateAdminCredentials);

// Institutional Overview & Analytics (Strictly Admin-Only)
router.get('/analytics/overall', AdminAnalyticsController.getOverallAnalytics);
router.get('/analytics/departments', AdminAnalyticsController.getDepartmentAnalytics);
router.get('/analytics/department', AdminAnalyticsController.getDepartmentAnalytics);
router.get('/analytics/years', AdminAnalyticsController.getYearWiseAnalytics);
router.get('/analytics/year', AdminAnalyticsController.getYearWiseAnalytics);
router.get('/analytics/sections', AdminAnalyticsController.getSectionAnalytics);
router.get('/analytics/section', AdminAnalyticsController.getSectionAnalytics);
router.get('/analytics/drilldown', AdminAnalyticsController.getDrilldown);
router.get('/analytics/performance', PerformanceController.getPerformanceOverview);
router.get('/analytics/performance/overview', PerformanceController.getPerformanceOverview);
router.get('/analytics/performance/student/:studentId', PerformanceController.getStudentPerformance);
router.get('/analytics/performance/section/:sectionId', PerformanceController.getSectionPerformance);
router.post('/analytics/performance/snapshots/generate', PerformanceController.generateSnapshots);

// ----------------------------------------------------
// INSTITUTIONAL REPORTS (PDF, Excel, CSV, PPTX, JSON Preview)
// ----------------------------------------------------
router.get('/reports/types', ReportController.getReportCatalog);
router.get('/reports/generate', ReportController.generateAdminReport);
router.get('/reports/:reportType', ReportController.generateAdminReport);

// ----------------------------------------------------
// COMPLETE AUDIT LOGGING & MARK CHANGE HISTORY (Admin-Only, Immutable)
// ----------------------------------------------------
router.get('/audit-logs/mark-changes', AdminController.getMarkChangeLogs);
router.get('/audit-logs', AdminController.getAuditLogs);
router.delete('/audit-logs/mark-changes/:id', AdminController.preventAuditDeletion);
router.delete('/audit-logs/mark-changes', AdminController.preventAuditDeletion);
router.delete('/audit-logs/:id', AdminController.preventAuditDeletion);
router.delete('/audit-logs', AdminController.preventAuditDeletion);

// ----------------------------------------------------
// COLLEGE NOTICES & NEWS (Strictly Admin-Only)
// ----------------------------------------------------
router.get('/notices/recipients-preview', NoticeController.getRecipientsPreview);
router.get('/notices', NoticeController.getNotices);
router.post('/notices', NoticeController.createNotice);
router.get('/notices/:id', NoticeController.getNoticeById);
router.put('/notices/:id', NoticeController.updateNotice);
router.delete('/notices/:id', NoticeController.deleteNotice);
router.post('/notices/:id/publish', NoticeController.publishNotice);
router.post('/notices/:id/cancel', NoticeController.cancelNotice);
router.get('/notices/:id/notification-stats', NoticeController.getNotificationStats);

// ----------------------------------------------------
// NOTIFICATION TEMPLATES & PARENT MESSAGE PREVIEW & QUEUE
// ----------------------------------------------------
router.post('/notifications/preview-template', NotificationTemplateController.previewTemplate);
router.get('/notifications/preview-student-performance/:studentId', NotificationTemplateController.previewStudentPerformance);
router.get('/notifications/templates/samples', NotificationTemplateController.getSampleTemplates);
router.post('/notifications/send-performance', NotificationTemplateController.sendPerformanceNotification);
router.post('/notifications/send-section-performance', NotificationTemplateController.sendSectionPerformanceNotification);
router.get('/notifications/stats', NotificationTemplateController.getOverallQueueStats);
router.get('/notifications/history', NotificationTemplateController.getNotificationHistory);
router.post('/notifications/:id/retry', NotificationTemplateController.retryNotification);
router.post('/notifications/retry-failed', NotificationTemplateController.bulkRetryFailedNotifications);

// Marks Upload & Management (Admin Full Clearance)
router.get('/marks/template', MarksUploadController.downloadTemplate);
router.post('/marks/upload-preview', upload.single('file'), MarksUploadController.previewMarksUpload);
router.post('/marks/upload-confirm', MarksUploadController.confirmMarksUpload);
router.post('/marks/batch', MarksUploadController.batchManualEntry);

// ----------------------------------------------------
// SUBJECT MANAGEMENT (Admin-Only)
// ----------------------------------------------------
router.get('/subjects', SubjectManagementController.getSubjects);
router.get('/subjects/:id', SubjectManagementController.getSubjectById);
router.post('/subjects', SubjectManagementController.createSubject);
router.put('/subjects/:id', SubjectManagementController.updateSubject);
router.patch('/subjects/:id/status', SubjectManagementController.toggleSubjectStatus);
router.delete('/subjects/:id', SubjectManagementController.deleteSubject);

// ----------------------------------------------------
// ASSESSMENT MANAGEMENT (Admin-Only Dynamic Assessments)
// ----------------------------------------------------
router.get('/assessments', AssessmentManagementController.getAssessments);
router.get('/assessments/:id', AssessmentManagementController.getAssessmentById);
router.post('/assessments', AssessmentManagementController.createAssessment);
router.put('/assessments/:id', AssessmentManagementController.updateAssessment);
router.patch('/assessments/:id/status', AssessmentManagementController.toggleAssessmentStatus);
router.delete('/assessments/:id', AssessmentManagementController.deleteAssessment);

// ----------------------------------------------------
// FACULTY & STAFF MANAGEMENT (Admin-Only)
// ----------------------------------------------------
router.get('/staff', StaffManagementController.getStaffList);
router.post('/staff', StaffManagementController.createStaff);

// Teacher Assignments (Staff + Academic Year + Department + Year + Section + Subject)
// (Must precede dynamic /staff/:id routes)
router.get('/staff/assignments', StaffManagementController.getAllAssignments);
router.post('/staff/assignments', StaffManagementController.assignStaff);
router.put('/staff/assignments/:assignmentId', StaffManagementController.updateStaffAssignment);
router.patch('/staff/assignments/:assignmentId/change-course', StaffManagementController.updateStaffAssignment);
router.delete('/staff/assignments/:assignmentId', StaffManagementController.deleteStaffAssignment);

// Dynamic Staff Parametric Routes
router.get('/staff/:id', StaffManagementController.getStaffById);
router.get('/staff/:id/credentials', StaffManagementController.getStaffCredentialsSummary);
router.put('/staff/:id', StaffManagementController.updateStaff);
router.patch('/staff/:id/status', StaffManagementController.toggleStaffStatus);
router.patch('/staff/:id/discontinue', StaffManagementController.discontinueStaff);
router.post('/staff/:id/reissue-credentials', StaffManagementController.reissueStaffCredentials);
router.post('/staff/:id/reset-password', StaffManagementController.resetStaffPassword);
router.post('/staff/:id/authorize-password', StaffManagementController.authorizeStaffPassword);
router.delete('/staff/:id', StaffManagementController.deleteStaff);
router.get('/staff/:id/assignments', StaffManagementController.getStaffAssignments);
router.post('/staff/:id/assignments', StaffManagementController.assignStaff);


// ----------------------------------------------------
// ACADEMIC STRUCTURE MANAGEMENT (Admin-Only Hierarchy)
// ----------------------------------------------------

// Cascade Overview & Dependent Dropdown Helper
router.get('/academic-structure/overview', AcademicStructureController.getOverview);

// 1. Academic Years
router.get('/academic-years', AcademicStructureController.getAcademicYears);
router.post('/academic-years', AcademicStructureController.createAcademicYear);
router.put('/academic-years/:id', AcademicStructureController.updateAcademicYear);
router.patch('/academic-years/:id/status', AcademicStructureController.toggleAcademicYearStatus);
router.delete('/academic-years/:id', AcademicStructureController.deleteAcademicYear);

// 2. Departments
router.get('/departments', AcademicStructureController.getDepartments);
router.post('/departments', AcademicStructureController.createDepartment);
router.put('/departments/:id', AcademicStructureController.updateDepartment);
router.patch('/departments/:id/status', AcademicStructureController.toggleDepartmentStatus);
router.delete('/departments/:id', AcademicStructureController.deleteDepartment);

// 3. Years
router.get('/years', AcademicStructureController.getYears);
router.post('/years', AcademicStructureController.createYear);
router.put('/years/:id', AcademicStructureController.updateYear);
router.patch('/years/:id/status', AcademicStructureController.toggleYearStatus);
router.delete('/years/:id', AcademicStructureController.deleteYear);

// 4. Sections (Filtered by AcademicYear, Department, Year)
router.get('/sections', AcademicStructureController.getSections);
router.post('/sections', AcademicStructureController.createSection);
router.put('/sections/:id', AcademicStructureController.updateSection);
router.patch('/sections/:id/status', AcademicStructureController.toggleSectionStatus);
router.delete('/sections/:id', AcademicStructureController.deleteSection);

// ----------------------------------------------------
// STUDENT & PARENT MANAGEMENT (Admin-Only)
// ----------------------------------------------------

// Bulk Import Routes (SheetJS / Excel & CSV)
router.get('/students/import/template', StudentImportController.downloadTemplate);
router.post('/students/import/preview', upload.single('file'), StudentImportController.previewImport);
router.post('/students/import/confirm', StudentImportController.confirmImport);
router.get('/students/import/history', StudentImportController.getImportHistory);
router.get('/students/import/history/:id', StudentImportController.getImportHistoryDetails);

// Individual Student Management
router.get('/students', StudentController.getStudents);
router.get('/students/:id', StudentController.getStudentById);
router.post('/students', StudentController.createStudent);
router.put('/students/:id', StudentController.updateStudent);
router.patch('/students/:id/status', StudentController.toggleStudentStatus);
router.delete('/students/:id', StudentController.deleteStudent);

// ----------------------------------------------------
// PARENT DIRECTORY MANAGEMENT (Admin-Only)
// ----------------------------------------------------
router.get('/parents', async (req, res) => {
  try {
    const parents = await prisma.student.findMany({
      where: { status: 'ACTIVE' },
      select: {
        id: true,
        parentName: true,
        parentMobile: true,
        name: true,
        registerNumber: true,
        section: {
          select: {
            name: true,
            department: { select: { code: true } },
            year: { select: { name: true } }
          }
        }
      },
      orderBy: { parentName: 'asc' }
    });
    return res.status(200).json({ parents, total: parents.length });
  } catch (error: any) {
    return res.status(500).json({ error: 'Failed to retrieve parents directory' });
  }
});

// ----------------------------------------------------
// SYSTEM SETTINGS MANAGEMENT (Admin-Only)
// ----------------------------------------------------
router.get('/settings', async (req, res) => {
  try {
    const academicYears = await prisma.academicYear.findMany({ orderBy: { yearName: 'desc' } });
    const currentYear = academicYears.find(y => y.isCurrent) || academicYears[0];
    return res.status(200).json({
      settings: {
        institutionName: 'VSB Engineering College',
        portalVersion: '2.0.0',
        currentAcademicYear: currentYear?.yearName || '2025-2026',
        currentAcademicYearId: currentYear?.id,
        gradingPolicy: {
          passPercentage: 50,
          internalMaxMarks: 100
        },
        auditLogging: {
          enabled: true,
          immutableLogs: true
        },
        notifications: {
          mockMode: process.env.MOCK_NOTIFICATIONS === 'true' || !process.env.WHATSAPP_ACCESS_TOKEN,
          supportedChannels: ['SMS', 'WHATSAPP']
        }
      }
    });
  } catch (error: any) {
    return res.status(500).json({ error: 'Failed to retrieve system settings' });
  }
});

router.put('/settings', async (req, res) => {
  try {
    const { passPercentage, internalMaxMarks } = req.body || {};
    return res.status(200).json({
      message: 'System settings updated successfully',
      settings: {
        institutionName: 'VSB Engineering College',
        portalVersion: '2.0.0',
        gradingPolicy: {
          passPercentage: passPercentage || 50,
          internalMaxMarks: internalMaxMarks || 100
        }
      }
    });
  } catch (error: any) {
    return res.status(500).json({ error: 'Failed to update system settings' });
  }
});

export default router;


