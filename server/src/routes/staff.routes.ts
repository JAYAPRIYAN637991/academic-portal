import { Router } from 'express';
import { StaffController } from '../controllers/staff.controller';
import { MarksUploadController } from '../controllers/marksUpload.controller';
import { PerformanceController } from '../controllers/performance.controller';
import { ReportController } from '../controllers/report.controller';
import multer from 'multer';
import { authenticateUser, requireStaff } from '../middleware/auth.middleware';

const router = Router();

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 } // 10MB limit
});

// Protect ALL routes in this router with authenticateUser AND requireStaff
router.use(authenticateUser);
router.use(requireStaff);

router.get('/assigned-classes', StaffController.getAssignedClasses);
router.get('/dashboard-summary', StaffController.getDashboardSummary);
router.get('/marks', StaffController.getMarksForClass);
router.post('/marks', StaffController.enterMarks);
router.get('/analytics/section', PerformanceController.getSectionPerformance);
router.get('/analytics/performance/student/:studentId', PerformanceController.getStudentPerformance);
router.get('/analytics/performance/section/:sectionId', PerformanceController.getSectionPerformance);
router.get('/reports/:reportType', ReportController.generateStaffReport);

// Marks Upload (Manual Roster, Excel & CSV)
router.get('/marks/template', MarksUploadController.downloadTemplate);
router.post('/marks/upload-preview', upload.single('file'), MarksUploadController.previewMarksUpload);
router.post('/marks/upload-confirm', MarksUploadController.confirmMarksUpload);
router.post('/marks/batch', MarksUploadController.batchManualEntry);

// Scoped Assessments & Subjects for Staff
router.get('/assessments', StaffController.getStaffAssessments);
router.get('/subjects', StaffController.getAssignedSubjects);

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

export default router;


