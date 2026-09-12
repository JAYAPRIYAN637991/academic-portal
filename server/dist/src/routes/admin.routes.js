"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const admin_controller_1 = require("../controllers/admin.controller");
const staffManagement_controller_1 = require("../controllers/staffManagement.controller");
const subjectManagement_controller_1 = require("../controllers/subjectManagement.controller");
const assessmentManagement_controller_1 = require("../controllers/assessmentManagement.controller");
const marksUpload_controller_1 = require("../controllers/marksUpload.controller");
const academicStructure_controller_1 = require("../controllers/academicStructure.controller");
const student_controller_1 = require("../controllers/student.controller");
const studentImport_controller_1 = require("../controllers/studentImport.controller");
const performance_controller_1 = require("../controllers/performance.controller");
const adminAnalytics_controller_1 = require("../controllers/adminAnalytics.controller");
const notice_controller_1 = require("../controllers/notice.controller");
const notificationTemplate_controller_1 = require("../controllers/notificationTemplate.controller");
const report_controller_1 = require("../controllers/report.controller");
const multer_1 = __importDefault(require("multer"));
const auth_middleware_1 = require("../middleware/auth.middleware");
const db_1 = require("../db");
const config_1 = require("../config");
const router = (0, express_1.Router)();
// Upload middleware with configurable file size limit
const upload = (0, multer_1.default)({
    storage: multer_1.default.memoryStorage(),
    limits: { fileSize: (config_1.config.maxUploadSizeMb || 25) * 1024 * 1024 }
});
// Protect ALL routes in this router with authenticateUser AND requireAdmin
// Staff attempting to access any of these will receive 403 Forbidden
router.use(auth_middleware_1.authenticateUser);
router.use(auth_middleware_1.requireAdmin);
// Admin Dashboard Summary (Unified Institutional Command Center)
router.get('/dashboard-summary', admin_controller_1.AdminController.getDashboardSummary);
router.get('/dashboard', admin_controller_1.AdminController.getDashboardSummary);
// Admin Profile & Credentials Management
router.get('/profile', admin_controller_1.AdminController.getAdminProfile);
router.put('/profile/credentials', admin_controller_1.AdminController.updateAdminCredentials);
// Institutional Overview & Analytics (Strictly Admin-Only)
router.get('/analytics/overall', adminAnalytics_controller_1.AdminAnalyticsController.getOverallAnalytics);
router.get('/analytics/departments', adminAnalytics_controller_1.AdminAnalyticsController.getDepartmentAnalytics);
router.get('/analytics/department', adminAnalytics_controller_1.AdminAnalyticsController.getDepartmentAnalytics);
router.get('/analytics/years', adminAnalytics_controller_1.AdminAnalyticsController.getYearWiseAnalytics);
router.get('/analytics/year', adminAnalytics_controller_1.AdminAnalyticsController.getYearWiseAnalytics);
router.get('/analytics/sections', adminAnalytics_controller_1.AdminAnalyticsController.getSectionAnalytics);
router.get('/analytics/section', adminAnalytics_controller_1.AdminAnalyticsController.getSectionAnalytics);
router.get('/analytics/drilldown', adminAnalytics_controller_1.AdminAnalyticsController.getDrilldown);
router.get('/analytics/performance', performance_controller_1.PerformanceController.getPerformanceOverview);
router.get('/analytics/performance/overview', performance_controller_1.PerformanceController.getPerformanceOverview);
router.get('/analytics/performance/student/:studentId', performance_controller_1.PerformanceController.getStudentPerformance);
router.get('/analytics/performance/section/:sectionId', performance_controller_1.PerformanceController.getSectionPerformance);
router.post('/analytics/performance/snapshots/generate', performance_controller_1.PerformanceController.generateSnapshots);
// ----------------------------------------------------
// INSTITUTIONAL REPORTS (PDF, Excel, CSV, PPTX, JSON Preview)
// ----------------------------------------------------
router.get('/reports/types', report_controller_1.ReportController.getReportCatalog);
router.get('/reports/generate', report_controller_1.ReportController.generateAdminReport);
router.get('/reports/:reportType', report_controller_1.ReportController.generateAdminReport);
// ----------------------------------------------------
// COMPLETE AUDIT LOGGING & MARK CHANGE HISTORY (Admin-Only, Immutable)
// ----------------------------------------------------
router.get('/audit-logs/mark-changes', admin_controller_1.AdminController.getMarkChangeLogs);
router.get('/audit-logs', admin_controller_1.AdminController.getAuditLogs);
router.delete('/audit-logs/mark-changes/:id', admin_controller_1.AdminController.preventAuditDeletion);
router.delete('/audit-logs/mark-changes', admin_controller_1.AdminController.preventAuditDeletion);
router.delete('/audit-logs/:id', admin_controller_1.AdminController.preventAuditDeletion);
router.delete('/audit-logs', admin_controller_1.AdminController.preventAuditDeletion);
// ----------------------------------------------------
// COLLEGE NOTICES & NEWS (Strictly Admin-Only)
// ----------------------------------------------------
router.get('/notices/recipients-preview', notice_controller_1.NoticeController.getRecipientsPreview);
router.get('/notices', notice_controller_1.NoticeController.getNotices);
router.post('/notices', notice_controller_1.NoticeController.createNotice);
router.get('/notices/:id', notice_controller_1.NoticeController.getNoticeById);
router.put('/notices/:id', notice_controller_1.NoticeController.updateNotice);
router.delete('/notices/:id', notice_controller_1.NoticeController.deleteNotice);
router.post('/notices/:id/publish', notice_controller_1.NoticeController.publishNotice);
router.post('/notices/:id/cancel', notice_controller_1.NoticeController.cancelNotice);
router.get('/notices/:id/notification-stats', notice_controller_1.NoticeController.getNotificationStats);
// ----------------------------------------------------
// NOTIFICATION TEMPLATES & PARENT MESSAGE PREVIEW & QUEUE
// ----------------------------------------------------
router.post('/notifications/preview-template', notificationTemplate_controller_1.NotificationTemplateController.previewTemplate);
router.get('/notifications/preview-student-performance/:studentId', notificationTemplate_controller_1.NotificationTemplateController.previewStudentPerformance);
router.get('/notifications/templates/samples', notificationTemplate_controller_1.NotificationTemplateController.getSampleTemplates);
router.post('/notifications/send-performance', notificationTemplate_controller_1.NotificationTemplateController.sendPerformanceNotification);
router.post('/notifications/send-section-performance', notificationTemplate_controller_1.NotificationTemplateController.sendSectionPerformanceNotification);
router.get('/notifications/stats', notificationTemplate_controller_1.NotificationTemplateController.getOverallQueueStats);
router.get('/notifications/history', notificationTemplate_controller_1.NotificationTemplateController.getNotificationHistory);
router.post('/notifications/:id/retry', notificationTemplate_controller_1.NotificationTemplateController.retryNotification);
router.post('/notifications/retry-failed', notificationTemplate_controller_1.NotificationTemplateController.bulkRetryFailedNotifications);
// Marks Upload & Management (Admin Full Clearance)
router.get('/marks/template', marksUpload_controller_1.MarksUploadController.downloadTemplate);
router.post('/marks/upload-preview', upload.single('file'), marksUpload_controller_1.MarksUploadController.previewMarksUpload);
router.post('/marks/upload-confirm', marksUpload_controller_1.MarksUploadController.confirmMarksUpload);
router.post('/marks/batch', marksUpload_controller_1.MarksUploadController.batchManualEntry);
// ----------------------------------------------------
// SUBJECT MANAGEMENT (Admin-Only)
// ----------------------------------------------------
router.get('/subjects', subjectManagement_controller_1.SubjectManagementController.getSubjects);
router.get('/subjects/:id', subjectManagement_controller_1.SubjectManagementController.getSubjectById);
router.post('/subjects', subjectManagement_controller_1.SubjectManagementController.createSubject);
router.put('/subjects/:id', subjectManagement_controller_1.SubjectManagementController.updateSubject);
router.patch('/subjects/:id/status', subjectManagement_controller_1.SubjectManagementController.toggleSubjectStatus);
router.delete('/subjects/:id', subjectManagement_controller_1.SubjectManagementController.deleteSubject);
// ----------------------------------------------------
// ASSESSMENT MANAGEMENT (Admin-Only Dynamic Assessments)
// ----------------------------------------------------
router.get('/assessments', assessmentManagement_controller_1.AssessmentManagementController.getAssessments);
router.get('/assessments/:id', assessmentManagement_controller_1.AssessmentManagementController.getAssessmentById);
router.post('/assessments', assessmentManagement_controller_1.AssessmentManagementController.createAssessment);
router.put('/assessments/:id', assessmentManagement_controller_1.AssessmentManagementController.updateAssessment);
router.patch('/assessments/:id/status', assessmentManagement_controller_1.AssessmentManagementController.toggleAssessmentStatus);
router.delete('/assessments/:id', assessmentManagement_controller_1.AssessmentManagementController.deleteAssessment);
// ----------------------------------------------------
// FACULTY & STAFF MANAGEMENT (Admin-Only)
// ----------------------------------------------------
router.get('/staff', staffManagement_controller_1.StaffManagementController.getStaffList);
router.post('/staff', staffManagement_controller_1.StaffManagementController.createStaff);
// Teacher Assignments (Staff + Academic Year + Department + Year + Section + Subject)
// (Must precede dynamic /staff/:id routes)
router.get('/staff/assignments', staffManagement_controller_1.StaffManagementController.getAllAssignments);
router.post('/staff/assignments', staffManagement_controller_1.StaffManagementController.assignStaff);
router.put('/staff/assignments/:assignmentId', staffManagement_controller_1.StaffManagementController.updateStaffAssignment);
router.patch('/staff/assignments/:assignmentId/change-course', staffManagement_controller_1.StaffManagementController.updateStaffAssignment);
router.delete('/staff/assignments/:assignmentId', staffManagement_controller_1.StaffManagementController.deleteStaffAssignment);
// Dynamic Staff Parametric Routes
router.get('/staff/:id', staffManagement_controller_1.StaffManagementController.getStaffById);
router.get('/staff/:id/credentials', staffManagement_controller_1.StaffManagementController.getStaffCredentialsSummary);
router.put('/staff/:id', staffManagement_controller_1.StaffManagementController.updateStaff);
router.patch('/staff/:id/status', staffManagement_controller_1.StaffManagementController.toggleStaffStatus);
router.patch('/staff/:id/discontinue', staffManagement_controller_1.StaffManagementController.discontinueStaff);
router.post('/staff/:id/reissue-credentials', staffManagement_controller_1.StaffManagementController.reissueStaffCredentials);
router.post('/staff/:id/reset-password', staffManagement_controller_1.StaffManagementController.resetStaffPassword);
router.post('/staff/:id/authorize-password', staffManagement_controller_1.StaffManagementController.authorizeStaffPassword);
router.delete('/staff/:id', staffManagement_controller_1.StaffManagementController.deleteStaff);
router.get('/staff/:id/assignments', staffManagement_controller_1.StaffManagementController.getStaffAssignments);
router.post('/staff/:id/assignments', staffManagement_controller_1.StaffManagementController.assignStaff);
// ----------------------------------------------------
// ACADEMIC STRUCTURE MANAGEMENT (Admin-Only Hierarchy)
// ----------------------------------------------------
// Cascade Overview & Dependent Dropdown Helper
router.get('/academic-structure/overview', academicStructure_controller_1.AcademicStructureController.getOverview);
// 1. Academic Years
router.get('/academic-years', academicStructure_controller_1.AcademicStructureController.getAcademicYears);
router.post('/academic-years', academicStructure_controller_1.AcademicStructureController.createAcademicYear);
router.put('/academic-years/:id', academicStructure_controller_1.AcademicStructureController.updateAcademicYear);
router.patch('/academic-years/:id/status', academicStructure_controller_1.AcademicStructureController.toggleAcademicYearStatus);
router.delete('/academic-years/:id', academicStructure_controller_1.AcademicStructureController.deleteAcademicYear);
// 2. Departments
router.get('/departments', academicStructure_controller_1.AcademicStructureController.getDepartments);
router.post('/departments', academicStructure_controller_1.AcademicStructureController.createDepartment);
router.put('/departments/:id', academicStructure_controller_1.AcademicStructureController.updateDepartment);
router.patch('/departments/:id/status', academicStructure_controller_1.AcademicStructureController.toggleDepartmentStatus);
router.delete('/departments/:id', academicStructure_controller_1.AcademicStructureController.deleteDepartment);
// 3. Years
router.get('/years', academicStructure_controller_1.AcademicStructureController.getYears);
router.post('/years', academicStructure_controller_1.AcademicStructureController.createYear);
router.put('/years/:id', academicStructure_controller_1.AcademicStructureController.updateYear);
router.patch('/years/:id/status', academicStructure_controller_1.AcademicStructureController.toggleYearStatus);
router.delete('/years/:id', academicStructure_controller_1.AcademicStructureController.deleteYear);
// 4. Sections (Filtered by AcademicYear, Department, Year)
router.get('/sections', academicStructure_controller_1.AcademicStructureController.getSections);
router.post('/sections', academicStructure_controller_1.AcademicStructureController.createSection);
router.put('/sections/:id', academicStructure_controller_1.AcademicStructureController.updateSection);
router.patch('/sections/:id/status', academicStructure_controller_1.AcademicStructureController.toggleSectionStatus);
router.delete('/sections/:id', academicStructure_controller_1.AcademicStructureController.deleteSection);
// ----------------------------------------------------
// STUDENT & PARENT MANAGEMENT (Admin-Only)
// ----------------------------------------------------
// Bulk Import Routes (SheetJS / Excel & CSV)
router.get('/students/import/template', studentImport_controller_1.StudentImportController.downloadTemplate);
router.post('/students/import/preview', upload.single('file'), studentImport_controller_1.StudentImportController.previewImport);
router.post('/students/import/confirm', studentImport_controller_1.StudentImportController.confirmImport);
router.get('/students/import/history', studentImport_controller_1.StudentImportController.getImportHistory);
router.get('/students/import/history/:id', studentImport_controller_1.StudentImportController.getImportHistoryDetails);
// Individual Student Management
router.get('/students', student_controller_1.StudentController.getStudents);
router.get('/students/:id', student_controller_1.StudentController.getStudentById);
router.post('/students', student_controller_1.StudentController.createStudent);
router.put('/students/:id', student_controller_1.StudentController.updateStudent);
router.patch('/students/:id/status', student_controller_1.StudentController.toggleStudentStatus);
router.delete('/students/:id', student_controller_1.StudentController.deleteStudent);
// ----------------------------------------------------
// PARENT DIRECTORY MANAGEMENT (Admin-Only)
// ----------------------------------------------------
router.get('/parents', async (req, res) => {
    try {
        const parents = await db_1.prisma.student.findMany({
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
    }
    catch (error) {
        return res.status(500).json({ error: 'Failed to retrieve parents directory' });
    }
});
// ----------------------------------------------------
// SYSTEM SETTINGS MANAGEMENT (Admin-Only)
// ----------------------------------------------------
router.get('/settings', async (req, res) => {
    try {
        const academicYears = await db_1.prisma.academicYear.findMany({ orderBy: { yearName: 'desc' } });
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
    }
    catch (error) {
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
    }
    catch (error) {
        return res.status(500).json({ error: 'Failed to update system settings' });
    }
});
exports.default = router;
