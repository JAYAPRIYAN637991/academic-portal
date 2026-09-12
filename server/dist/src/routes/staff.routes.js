"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const staff_controller_1 = require("../controllers/staff.controller");
const marksUpload_controller_1 = require("../controllers/marksUpload.controller");
const performance_controller_1 = require("../controllers/performance.controller");
const report_controller_1 = require("../controllers/report.controller");
const multer_1 = __importDefault(require("multer"));
const auth_middleware_1 = require("../middleware/auth.middleware");
const router = (0, express_1.Router)();
const upload = (0, multer_1.default)({
    storage: multer_1.default.memoryStorage(),
    limits: { fileSize: 10 * 1024 * 1024 } // 10MB limit
});
// Protect ALL routes in this router with authenticateUser AND requireStaff
router.use(auth_middleware_1.authenticateUser);
router.use(auth_middleware_1.requireStaff);
router.get('/assigned-classes', staff_controller_1.StaffController.getAssignedClasses);
router.get('/classes', staff_controller_1.StaffController.getAssignedClasses);
router.get('/dashboard-summary', staff_controller_1.StaffController.getDashboardSummary);
router.get('/marks', staff_controller_1.StaffController.getMarksForClass);
router.post('/marks', staff_controller_1.StaffController.enterMarks);
router.get('/analytics/section', performance_controller_1.PerformanceController.getSectionPerformance);
router.get('/analytics/performance/student/:studentId', performance_controller_1.PerformanceController.getStudentPerformance);
router.get('/analytics/performance/section/:sectionId', performance_controller_1.PerformanceController.getSectionPerformance);
router.get('/reports/:reportType', report_controller_1.ReportController.generateStaffReport);
// Marks Upload (Manual Roster, Excel & CSV)
router.get('/marks/template', marksUpload_controller_1.MarksUploadController.downloadTemplate);
router.post('/marks/upload-preview', upload.single('file'), marksUpload_controller_1.MarksUploadController.previewMarksUpload);
router.post('/marks/upload-confirm', marksUpload_controller_1.MarksUploadController.confirmMarksUpload);
router.post('/marks/batch', marksUpload_controller_1.MarksUploadController.batchManualEntry);
// Scoped Assessments & Subjects for Staff
router.get('/assessments', staff_controller_1.StaffController.getStaffAssessments);
router.get('/subjects', staff_controller_1.StaffController.getAssignedSubjects);
// Strict Staff Mutation Guards: Staff cannot create, edit, or delete assessments
router.post('/assessments', (req, res) => {
    return res.status(403).json({
        error: 'Forbidden: Staff cannot create assessments. Assessments are centrally managed by Administrators.',
        code: 'STAFF_CANNOT_MANAGE_ASSESSMENTS'
    });
});
router.put('/assessments/:id', (req, res) => {
    return res.status(403).json({
        error: 'Forbidden: Staff cannot update assessments.',
        code: 'STAFF_CANNOT_MANAGE_ASSESSMENTS'
    });
});
router.delete('/assessments/:id', (req, res) => {
    return res.status(403).json({
        error: 'Forbidden: Staff cannot delete assessments.',
        code: 'STAFF_CANNOT_MANAGE_ASSESSMENTS'
    });
});
// ----------------------------------------------------
// ZERO-TRUST DEFENSE-IN-DEPTH: Categorically Reject Governance Probes
// ----------------------------------------------------
router.use([
    '/parents',
    '/students',
    '/staff',
    '/notices',
    '/notifications',
    '/audit-logs',
    '/settings',
    '/academic-structure',
    '/academic-years',
    '/departments',
    '/years',
    '/sections'
], (_req, res) => {
    return res.status(403).json({
        error: 'Forbidden: Access to institutional administrative governance is strictly restricted to Central Administrators.',
        code: 'ADMIN_ACCESS_REQUIRED'
    });
});
exports.default = router;
