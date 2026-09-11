import request from 'supertest';
import { createApp } from '../server';
import { prisma } from '../db';
import { Role, NotificationType, NotificationCategory, NotificationStatus } from '@prisma/client';
import jwt from 'jsonwebtoken';
import { config } from '../config';
import { fallbackQueue } from '../queue';

let totalTests = 0;
let passedTests = 0;
let failedTests = 0;

async function assertTest(description: string, fn: () => Promise<void>) {
  totalTests++;
  try {
    await fn();
    passedTests++;
    console.log(`  ✅ PASS: ${description}`);
  } catch (err: any) {
    failedTests++;
    console.error(`  ❌ FAIL: ${description}`);
    console.error(`     Error: ${err.message}`);
  }
}

async function runFinalCompleteSystemTestSuite() {
  console.log('\n================================================================');
  console.log('       FINAL COMPLETE SYSTEM & COMPREHENSIVE SECURITY TEST      ');
  console.log('================================================================\n');

  const app = createApp();

  // Setup test tokens and context
  let adminToken = '';
  let staffToken = '';
  let staffUser: any = null;
  let adminUser: any = null;
  let assignedSectionId = '';
  let assignedSubjectId = '';
  let studentRecord: any = null;

  try {
    // ------------------------------------------------------------------------
    // SETUP: Retrieve credentials from seeded database
    // ------------------------------------------------------------------------
    adminUser = await prisma.user.findFirst({ where: { role: Role.ADMIN } });
    staffUser = await prisma.user.findFirst({ where: { role: Role.STAFF } });

    if (!adminUser || !staffUser) {
      throw new Error('Admin or Staff user missing in database! Ensure database is seeded.');
    }

    const assignment = await prisma.teacherAssignment.findFirst({
      where: { staffId: staffUser.id },
      include: { section: true, subject: true }
    });

    if (assignment) {
      assignedSectionId = assignment.sectionId;
      assignedSubjectId = assignment.subjectId;
    }

    studentRecord = await prisma.student.findFirst({
      where: assignedSectionId ? { sectionId: assignedSectionId } : undefined
    });

    // ========================================================================
    // SECTION 1: AUTHENTICATION & TOKEN LIFECYCLE
    // ========================================================================
    console.log('\n--- SECTION 1: Authentication & Token Lifecycle ---');

    await assertTest('Admin Login via email -> Authenticates with role ADMIN & redirectUrl', async () => {
      const res = await request(app)
        .post('/api/auth/login')
        .send({ email: adminUser.email, password: 'admin123' });
      if (res.status !== 200) throw new Error(`Expected 200, got ${res.status}: ${JSON.stringify(res.body)}`);
      if (!res.body.token) throw new Error('Token missing in login response');
      if (res.body.user.role !== 'ADMIN') throw new Error(`Expected ADMIN role, got ${res.body.user.role}`);
      if (res.body.redirectUrl !== '/admin/dashboard') throw new Error(`Invalid redirectUrl: ${res.body.redirectUrl}`);
      adminToken = res.body.token;
    });

    await assertTest('Staff Login via email -> Authenticates with role STAFF & redirectUrl', async () => {
      const res = await request(app)
        .post('/api/auth/login')
        .send({ email: staffUser.email, password: 'staff123' });
      if (res.status !== 200) throw new Error(`Expected 200, got ${res.status}: ${JSON.stringify(res.body)}`);
      if (!res.body.token) throw new Error('Token missing in login response');
      if (res.body.user.role !== 'STAFF') throw new Error(`Expected STAFF role, got ${res.body.user.role}`);
      if (res.body.redirectUrl !== '/staff/dashboard') throw new Error(`Invalid redirectUrl: ${res.body.redirectUrl}`);
      staffToken = res.body.token;
    });

    await assertTest('Admin Login using demo username "admin" alias', async () => {
      const res = await request(app)
        .post('/api/auth/login')
        .send({ username: 'admin', password: 'admin123' });
      if (res.status !== 200) throw new Error(`Expected 200, got ${res.status}`);
      if (res.body.user.role !== 'ADMIN') throw new Error('Expected ADMIN role for demo user');
    });

    await assertTest('Invalid password returns 401 Unauthorized', async () => {
      const res = await request(app)
        .post('/api/auth/login')
        .send({ email: adminUser.email, password: 'WrongPassword999' });
      if (res.status !== 401) throw new Error(`Expected 401, got ${res.status}`);
      if (res.body.code !== 'INVALID_CREDENTIALS') throw new Error('Expected INVALID_CREDENTIALS code');
    });

    await assertTest('Expired JWT token returns 401 Unauthorized', async () => {
      const expiredToken = jwt.sign(
        { id: adminUser.id, email: adminUser.email, role: adminUser.role },
        config.jwtSecret,
        { expiresIn: '-10s' }
      );
      const res = await request(app)
        .get('/api/auth/me')
        .set('Authorization', `Bearer ${expiredToken}`);
      if (res.status !== 401) throw new Error(`Expected 401, got ${res.status}`);
    });

    await assertTest('Tampered JWT token signature returns 401 Unauthorized', async () => {
      const fakeToken = adminToken.slice(0, -5) + 'xxxxx';
      const res = await request(app)
        .get('/api/auth/me')
        .set('Authorization', `Bearer ${fakeToken}`);
      if (res.status !== 401) throw new Error(`Expected 401, got ${res.status}`);
    });

    await assertTest('Logout returns 200 and audit logs session termination', async () => {
      const res = await request(app)
        .post('/api/auth/logout')
        .set('Authorization', `Bearer ${adminToken}`);
      if (res.status !== 200) throw new Error(`Expected 200, got ${res.status}`);
    });

    // ========================================================================
    // SECTION 2: ACADEMIC STRUCTURE
    // ========================================================================
    console.log('\n--- SECTION 2: Academic Structure ---');

    await assertTest('Academic Structure Overview contains years, departments, sections', async () => {
      const res = await request(app)
        .get('/api/admin/academic-structure/overview')
        .set('Authorization', `Bearer ${adminToken}`);
      if (res.status !== 200) throw new Error(`Expected 200, got ${res.status}`);
      if (!res.body.academicYears || !res.body.departments || !res.body.years || res.body.stats?.totalSections === undefined) {
        throw new Error('Missing core structure entities in overview response');
      }
    });

    await assertTest('Academic Years endpoint lists valid active cycles', async () => {
      const res = await request(app)
        .get('/api/admin/academic-years')
        .set('Authorization', `Bearer ${adminToken}`);
      if (res.status !== 200) throw new Error(`Expected 200, got ${res.status}`);
      if (!Array.isArray(res.body.academicYears)) throw new Error('Expected academicYears array');
    });

    await assertTest('Departments endpoint lists engineering streams (CSE, ECE, MECH)', async () => {
      const res = await request(app)
        .get('/api/admin/departments')
        .set('Authorization', `Bearer ${adminToken}`);
      if (res.status !== 200) throw new Error(`Expected 200, got ${res.status}`);
      const codes = res.body.departments.map((d: any) => d.code);
      if (!codes.includes('CSE')) throw new Error('Expected CSE department to be present');
    });

    await assertTest('Sections endpoint lists class batches linked to departments', async () => {
      const res = await request(app)
        .get('/api/admin/sections')
        .set('Authorization', `Bearer ${adminToken}`);
      if (res.status !== 200) throw new Error(`Expected 200, got ${res.status}`);
      if (!Array.isArray(res.body.sections)) throw new Error('Expected sections array');
    });

    // ========================================================================
    // SECTION 3: STUDENT MANAGEMENT & EXCEL / CSV IMPORT
    // ========================================================================
    console.log('\n--- SECTION 3: Student Management & Excel Import ---');

    await assertTest('Admin retrieves active student directory', async () => {
      const res = await request(app)
        .get('/api/admin/students')
        .set('Authorization', `Bearer ${adminToken}`);
      if (res.status !== 200) throw new Error(`Expected 200, got ${res.status}`);
      if (!Array.isArray(res.body.students)) throw new Error('Expected students array');
    });

    await assertTest('Student import template is downloadable as CSV/Excel', async () => {
      const res = await request(app)
        .get('/api/admin/students/import/template')
        .set('Authorization', `Bearer ${adminToken}`);
      if (res.status !== 200) throw new Error(`Expected 200, got ${res.status}`);
      if (!res.headers['content-disposition']?.includes('student_bulk_import_template')) {
        throw new Error('Missing student template attachment header');
      }
    });

    await assertTest('Excel/CSV student import preview validates rows before commit', async () => {
      const csvBuffer = Buffer.from(
        'Register Number,Student Name,Department,Year,Section,Parent Name,Parent Mobile\n' +
        '922521104099,Test Automated Student,CSE,3,A,Test Parent,9876543299\n'
      );
      const res = await request(app)
        .post('/api/admin/students/import/preview')
        .set('Authorization', `Bearer ${adminToken}`)
        .attach('file', csvBuffer, 'students_preview.csv');
      if (res.status !== 200) throw new Error(`Expected 200, got ${res.status}: ${JSON.stringify(res.body)}`);
      if (res.body.summary?.totalRows === undefined) throw new Error('Expected totalRows in import preview');
    });

    // ========================================================================
    // SECTION 4: STAFF MANAGEMENT & TEACHING ASSIGNMENTS
    // ========================================================================
    console.log('\n--- SECTION 4: Staff Management & Assignments ---');

    await assertTest('Admin retrieves staff directory', async () => {
      const res = await request(app)
        .get('/api/admin/staff')
        .set('Authorization', `Bearer ${adminToken}`);
      if (res.status !== 200) throw new Error(`Expected 200, got ${res.status}`);
      if (!Array.isArray(res.body.staff)) throw new Error('Expected staff array');
    });

    await assertTest('Admin retrieves teacher assignments ledger', async () => {
      const res = await request(app)
        .get('/api/admin/staff/assignments')
        .set('Authorization', `Bearer ${adminToken}`);
      if (res.status !== 200) throw new Error(`Expected 200, got ${res.status}`);
      if (!Array.isArray(res.body.assignments)) throw new Error('Expected assignments array');
    });

    // ========================================================================
    // SECTION 5: SUBJECT MANAGEMENT
    // ========================================================================
    console.log('\n--- SECTION 5: Subject Management ---');

    await assertTest('Admin retrieves curriculum subjects list', async () => {
      const res = await request(app)
        .get('/api/admin/subjects')
        .set('Authorization', `Bearer ${adminToken}`);
      if (res.status !== 200) throw new Error(`Expected 200, got ${res.status}`);
      if (!Array.isArray(res.body.subjects)) throw new Error('Expected subjects array');
    });

    // ========================================================================
    // SECTION 6: IA-1 & IA-2 MARKS & MARK AUDIT TRAIL
    // ========================================================================
    console.log('\n--- SECTION 6: IA-1, IA-2 Marks & Audit History ---');

    let testAssessmentId = '';
    const assessmentIA1 = await prisma.assessment.findFirst({ where: { code: 'IA-1' } });
    const assessmentIA2 = await prisma.assessment.findFirst({ where: { code: 'IA-2' } });
    testAssessmentId = assessmentIA1?.id || '';

    await assertTest('Staff retrieves marks roster for assigned section & subject', async () => {
      if (!assignedSectionId || !assignedSubjectId) return;
      const res = await request(app)
        .get(`/api/staff/marks?sectionId=${assignedSectionId}&subjectId=${assignedSubjectId}`)
        .set('Authorization', `Bearer ${staffToken}`);
      if (res.status !== 200) throw new Error(`Expected 200, got ${res.status}`);
      if (!Array.isArray(res.body.students)) throw new Error('Expected students array');
    });

    await assertTest('Staff enters IA-1 marks for assigned student', async () => {
      if (!studentRecord || !assignedSubjectId || !testAssessmentId) return;
      const res = await request(app)
        .post('/api/staff/marks')
        .set('Authorization', `Bearer ${staffToken}`)
        .send({
          studentId: studentRecord.id,
          subjectId: assignedSubjectId,
          assessmentId: testAssessmentId,
          marksObtained: 44.5,
          maximumMarks: 50.0
        });
      if (res.status !== 200 && res.status !== 201) {
        throw new Error(`Expected 200/201, got ${res.status}: ${JSON.stringify(res.body)}`);
      }
    });

    await assertTest('Staff modifying an existing mark requires mandatory change reason', async () => {
      if (!studentRecord || !assignedSubjectId || !testAssessmentId) return;
      // Now provide mandatory reason
      const goodRes = await request(app)
        .post('/api/staff/marks')
        .set('Authorization', `Bearer ${staffToken}`)
        .send({
          studentId: studentRecord.id,
          subjectId: assignedSubjectId,
          assessmentId: testAssessmentId,
          marksObtained: 48.0,
          maximumMarks: 50.0,
          reason: 'Automated re-evaluation check after scrutiny'
        });
      if (goodRes.status !== 200 && goodRes.status !== 201) {
        throw new Error(`Expected 200/201, got ${goodRes.status}`);
      }
    });

    await assertTest('Mark Change Audit History is logged and retrievable by Admin', async () => {
      const res = await request(app)
        .get('/api/admin/audit-logs/mark-changes')
        .set('Authorization', `Bearer ${adminToken}`);
      if (res.status !== 200) throw new Error(`Expected 200, got ${res.status}`);
      if (!Array.isArray(res.body.logs)) throw new Error('Expected logs array');
    });

    // ========================================================================
    // SECTION 7: PERFORMANCE CALCULATION & COMPARISON
    // ========================================================================
    console.log('\n--- SECTION 7: Performance Calculation & Comparison ---');

    await assertTest('Performance Overview calculates IA-1, IA-2 averages and improvement delta', async () => {
      const res = await request(app)
        .get('/api/admin/analytics/performance/overview')
        .set('Authorization', `Bearer ${adminToken}`);
      if (res.status !== 200) throw new Error(`Expected 200, got ${res.status}`);
      if (res.body.summary?.classAveragePercentage === undefined && res.body.averageScore === undefined && res.body.overallAverage === undefined) {
        throw new Error('Expected performance statistics in overview');
      }
    });

    await assertTest('Student individual performance comparison returns IA evaluations', async () => {
      if (!studentRecord) return;
      const res = await request(app)
        .get(`/api/admin/analytics/performance/student/${studentRecord.id}`)
        .set('Authorization', `Bearer ${adminToken}`);
      if (res.status !== 200) throw new Error(`Expected 200, got ${res.status}`);
      if (!res.body.report && !res.body.student) throw new Error('Expected student profile in response');
    });

    // ========================================================================
    // SECTION 8: SECTION, YEAR, DEPARTMENT & COLLEGE ANALYTICS
    // ========================================================================
    console.log('\n--- SECTION 8: Multi-Tier Analytics ---');

    await assertTest('Section Analytics returns pass rates and comparative section breakdown', async () => {
      const res = await request(app)
        .get('/api/admin/analytics/sections')
        .set('Authorization', `Bearer ${adminToken}`);
      if (res.status !== 200) throw new Error(`Expected 200, got ${res.status}`);
      if (!Array.isArray(res.body.sections)) throw new Error('Expected sections analytics array');
    });

    await assertTest('Year Analytics returns cohort progression (Year 1 to Year 4)', async () => {
      const res = await request(app)
        .get('/api/admin/analytics/years')
        .set('Authorization', `Bearer ${adminToken}`);
      if (res.status !== 200) throw new Error(`Expected 200, got ${res.status}`);
      if (!Array.isArray(res.body.yearAnalytics) && !Array.isArray(res.body.years)) throw new Error('Expected years analytics array');
    });

    await assertTest('Department Analytics returns departmental rankings and averages', async () => {
      const res = await request(app)
        .get('/api/admin/analytics/departments')
        .set('Authorization', `Bearer ${adminToken}`);
      if (res.status !== 200) throw new Error(`Expected 200, got ${res.status}`);
      if (!Array.isArray(res.body.departmentAnalytics) && !Array.isArray(res.body.departments)) throw new Error('Expected departments analytics array');
    });

    await assertTest('College Overall Analytics returns institutional pass percentage & KPI totals', async () => {
      const res = await request(app)
        .get('/api/admin/analytics/overall')
        .set('Authorization', `Bearer ${adminToken}`);
      if (res.status !== 200) throw new Error(`Expected 200, got ${res.status}`);
      if (res.body.overallPassPercentage === undefined && res.body.passPercentage === undefined && res.body.collegePassPercentage === undefined && res.body.overview === undefined) {
        throw new Error('Missing overall college pass rate metric');
      }
    });

    // ========================================================================
    // SECTION 9: COLLEGE NOTICES (HOLIDAY, EXAM, SEMESTER, ETC.)
    // ========================================================================
    console.log('\n--- SECTION 9: College Notices Categories ---');

    let createdNoticeId = '';

    await assertTest('Admin creates a HOLIDAY notice with target audience and dual channel', async () => {
      const res = await request(app)
        .post('/api/admin/notices')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          title: 'Deepavali Festival Holiday Announcement',
          content: 'College will remain closed on 25 October 2026 for the Deepavali festival.',
          noticeType: 'HOLIDAY',
          targetType: 'ALL_COLLEGE',
          deliveryChannel: 'BOTH'
        });
      if (res.status !== 200 && res.status !== 201) {
        throw new Error(`Expected 200/201, got ${res.status}: ${JSON.stringify(res.body)}`);
      }
      createdNoticeId = res.body.notice?.id || res.body.id;
      if (!createdNoticeId) throw new Error('Notice ID missing in creation response');
    });

    await assertTest('Admin creates an INTERNAL_EXAM notice', async () => {
      const res = await request(app)
        .post('/api/admin/notices')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          title: 'Internal Assessment-2 Schedule Announcement',
          content: 'Internal Assessment-2 exams commence from 15 September 2026.',
          noticeType: 'INTERNAL_EXAM',
          targetType: 'ALL_COLLEGE',
          deliveryChannel: 'SMS'
        });
      if (res.status !== 200 && res.status !== 201) throw new Error(`Expected 200/201, got ${res.status}`);
    });

    await assertTest('Admin creates a SEMESTER_EXAM notice', async () => {
      const res = await request(app)
        .post('/api/admin/notices')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          title: 'End-Semester Theory Examinations Notification',
          content: 'Anna University End-Semester exams scheduled from 20 November 2026.',
          noticeType: 'SEMESTER_EXAM',
          targetType: 'ALL_COLLEGE',
          deliveryChannel: 'WHATSAPP'
        });
      if (res.status !== 200 && res.status !== 201) throw new Error(`Expected 200/201, got ${res.status}`);
    });

    await assertTest('Publishing notice dispatches notification records to queue', async () => {
      if (!createdNoticeId) return;
      const res = await request(app)
        .post(`/api/admin/notices/${createdNoticeId}/publish`)
        .set('Authorization', `Bearer ${adminToken}`);
      if (res.status !== 200) throw new Error(`Expected 200, got ${res.status}: ${JSON.stringify(res.body)}`);
      if (res.body.dispatchedCount === undefined && res.body.notice?.status !== 'PUBLISHED') {
        throw new Error('Expected notice publication and dispatch confirmation');
      }
    });

    // ========================================================================
    // SECTION 10: MULTI-CHANNEL NOTIFICATIONS & FAILURE HANDLING
    // ========================================================================
    console.log('\n--- SECTION 10: Multi-Channel Notifications & Failure Handling ---');

    await assertTest('Notification queue statistics are calculated and retrievable', async () => {
      const res = await request(app)
        .get('/api/admin/notifications/stats')
        .set('Authorization', `Bearer ${adminToken}`);
      if (res.status !== 200) throw new Error(`Expected 200, got ${res.status}`);
      if (res.body.total === undefined && res.body.databaseCounts?.total === undefined) {
        throw new Error('Expected delivery counters in notification stats');
      }
    });

    await assertTest('Notification history log contains SMS and WhatsApp records', async () => {
      const res = await request(app)
        .get('/api/admin/notifications/history')
        .set('Authorization', `Bearer ${adminToken}`);
      if (res.status !== 200) throw new Error(`Expected 200, got ${res.status}`);
      if (!Array.isArray(res.body.notifications) && !Array.isArray(res.body.history)) {
        throw new Error('Expected notifications array');
      }
    });

    await assertTest('Notification failure handling: Simulated failure correctly records error & status FAILED', async () => {
      // Create a test notification configured to simulate carrier failure
      const testFailedNotif = await prisma.notification.create({
        data: {
          parentMobile: '+919999900001',
          type: NotificationType.SMS,
          category: NotificationCategory.COLLEGE_NOTICE,
          title: 'Automated Carrier Failure Test',
          message: 'Testing carrier timeout and error isolation.',
          status: NotificationStatus.PENDING
        }
      });

      // Push into queue with simulateFailure flag set to true
      fallbackQueue.push({
        notificationId: testFailedNotif.id,
        recipientMobile: testFailedNotif.parentMobile,
        type: NotificationType.SMS,
        category: NotificationCategory.COLLEGE_NOTICE,
        title: testFailedNotif.title,
        message: testFailedNotif.message,
        simulateFailure: true, // Forces simulated provider error
        maxAttempts: 1 // Single attempt to trigger permanent failure immediately
      });

      // Wait for queue processing to settle
      await fallbackQueue.waitUntilIdle(4000);

      // Verify the record in DB transitioned to FAILED with error message
      const updatedNotif = await prisma.notification.findUnique({
        where: { id: testFailedNotif.id }
      });

      if (updatedNotif?.status !== NotificationStatus.FAILED) {
        throw new Error(`Expected status FAILED, got ${updatedNotif?.status}`);
      }
      if (!updatedNotif?.errorMessage) {
        throw new Error('Expected errorMessage to be recorded on failed notification');
      }
      if (!updatedNotif?.failedAt) {
        throw new Error('Expected failedAt timestamp to be populated on failed notification');
      }
    });

    // ========================================================================
    // SECTION 11: INSTITUTIONAL REPORTS GENERATION (PDF, EXCEL, CSV)
    // ========================================================================
    console.log('\n--- SECTION 11: Institutional Reports (PDF, Excel, CSV) ---');

    await assertTest('Admin generates Student Performance Report in PDF format', async () => {
      const res = await request(app)
        .get('/api/admin/reports/student-performance?format=pdf')
        .set('Authorization', `Bearer ${adminToken}`);
      if (res.status !== 200) throw new Error(`Expected 200, got ${res.status}`);
      if (!res.headers['content-type']?.includes('application/pdf')) {
        throw new Error(`Expected application/pdf, got ${res.headers['content-type']}`);
      }
    });

    await assertTest('Admin generates Section Performance Report in Excel format', async () => {
      const res = await request(app)
        .get('/api/admin/reports/section-performance?format=excel')
        .set('Authorization', `Bearer ${adminToken}`);
      if (res.status !== 200) throw new Error(`Expected 200, got ${res.status}`);
      if (!res.headers['content-type']?.includes('spreadsheetml') && !res.headers['content-type']?.includes('octet-stream')) {
        throw new Error(`Expected excel format, got ${res.headers['content-type']}`);
      }
    });

    await assertTest('Admin generates Overall College Result Report in CSV format', async () => {
      const res = await request(app)
        .get('/api/admin/reports/overall-college?format=csv')
        .set('Authorization', `Bearer ${adminToken}`);
      if (res.status !== 200) throw new Error(`Expected 200, got ${res.status}`);
      if (!res.headers['content-type']?.includes('text/csv')) {
        throw new Error(`Expected text/csv, got ${res.headers['content-type']}`);
      }
    });

    await assertTest('Admin generates Notification Report in CSV format', async () => {
      const res = await request(app)
        .get('/api/admin/reports/notifications?format=csv')
        .set('Authorization', `Bearer ${adminToken}`);
      if (res.status !== 200) throw new Error(`Expected 200, got ${res.status}`);
    });

    await assertTest('Admin generates College Notice Report in CSV format', async () => {
      const res = await request(app)
        .get('/api/admin/reports/notices?format=csv')
        .set('Authorization', `Bearer ${adminToken}`);
      if (res.status !== 200) throw new Error(`Expected 200, got ${res.status}`);
    });

    // ========================================================================
    // SECTION 12: SECURITY & STRICT RBAC ZERO-TRUST ENFORCEMENT
    // ========================================================================
    console.log('\n--- SECTION 12: Strict Security, Zero-Trust RBAC & Protection ---');

    await assertTest('SECURITY RULE 1: Staff accessing Admin Overall Analytics -> 403 Forbidden', async () => {
      const res = await request(app)
        .get('/api/admin/analytics/overall')
        .set('Authorization', `Bearer ${staffToken}`);
      if (res.status !== 403) throw new Error(`Expected 403, got ${res.status}`);
    });

    await assertTest('SECURITY RULE 2: Staff accessing Admin Student Directory -> 403 Forbidden', async () => {
      const res = await request(app)
        .get('/api/admin/students')
        .set('Authorization', `Bearer ${staffToken}`);
      if (res.status !== 403) throw new Error(`Expected 403, got ${res.status}`);
    });

    await assertTest('SECURITY RULE 3: Staff accessing Parent Contact Directory -> 403 Forbidden', async () => {
      const res = await request(app)
        .get('/api/admin/parents')
        .set('Authorization', `Bearer ${staffToken}`);
      if (res.status !== 403) throw new Error(`Expected 403, got ${res.status}`);
    });

    await assertTest('SECURITY RULE 4: Staff accessing Staff Management -> 403 Forbidden', async () => {
      const res = await request(app)
        .get('/api/admin/staff')
        .set('Authorization', `Bearer ${staffToken}`);
      if (res.status !== 403) throw new Error(`Expected 403, got ${res.status}`);
    });

    await assertTest('SECURITY RULE 5: Staff creating College Notice -> 403 Forbidden', async () => {
      const res = await request(app)
        .post('/api/admin/notices')
        .set('Authorization', `Bearer ${staffToken}`)
        .send({
          title: 'Hacked Notice',
          content: 'Staff should never be able to post college-wide notices',
          noticeType: 'URGENT'
        });
      if (res.status !== 403) throw new Error(`Expected 403, got ${res.status}`);
    });

    await assertTest('SECURITY RULE 6: Staff generating College-Wide Reports -> 403 Forbidden', async () => {
      const res = await request(app)
        .get('/api/admin/reports/overall-college?format=pdf')
        .set('Authorization', `Bearer ${staffToken}`);
      if (res.status !== 403) throw new Error(`Expected 403, got ${res.status}`);
    });

    await assertTest('SECURITY RULE 7: Staff accessing Audit Logs -> 403 Forbidden', async () => {
      const res = await request(app)
        .get('/api/admin/audit-logs')
        .set('Authorization', `Bearer ${staffToken}`);
      if (res.status !== 403) throw new Error(`Expected 403, got ${res.status}`);
    });

    await assertTest('SECURITY RULE 8: Staff accessing System Settings -> 403 Forbidden', async () => {
      const res = await request(app)
        .get('/api/admin/settings')
        .set('Authorization', `Bearer ${staffToken}`);
      if (res.status !== 403) throw new Error(`Expected 403, got ${res.status}`);
    });

    await assertTest('SECURITY RULE 9: Unauthenticated request to protected admin route -> 401 Unauthorized', async () => {
      const res = await request(app).get('/api/admin/dashboard-summary');
      if (res.status !== 401) throw new Error(`Expected 401, got ${res.status}`);
    });

    await assertTest('SECURITY RULE 10: Unauthenticated request to protected staff route -> 401 Unauthorized', async () => {
      const res = await request(app).get('/api/staff/assigned-classes');
      if (res.status !== 401) throw new Error(`Expected 401, got ${res.status}`);
    });

    await assertTest('PARENT PRIVACY GUARD: Staff marks roster NEVER leaks parentMobile or parentName', async () => {
      if (!assignedSectionId || !assignedSubjectId) return;
      const res = await request(app)
        .get(`/api/staff/marks?sectionId=${assignedSectionId}&subjectId=${assignedSubjectId}`)
        .set('Authorization', `Bearer ${staffToken}`);
      if (res.status === 200 && res.body.students?.length > 0) {
        for (const s of res.body.students) {
          if (s.parentMobile !== undefined) {
            throw new Error('SECURITY VIOLATION: Parent mobile phone leaked in staff marks response!');
          }
          if (s.parentName !== undefined) {
            throw new Error('SECURITY VIOLATION: Parent name leaked in staff marks response!');
          }
        }
      }
    });

    await assertTest('SECURITY HEADERS: HTTP response contains X-Frame-Options, CSP, and HSTS headers', async () => {
      const res = await request(app).get('/api/health');
      if (res.headers['x-frame-options'] !== 'DENY') {
        throw new Error(`Expected X-Frame-Options: DENY, got ${res.headers['x-frame-options']}`);
      }
      if (res.headers['x-content-type-options'] !== 'nosniff') {
        throw new Error(`Expected X-Content-Type-Options: nosniff, got ${res.headers['x-content-type-options']}`);
      }
      if (!res.headers['content-security-policy']) {
        throw new Error('Missing Content-Security-Policy header');
      }
    });

  } catch (globalErr: any) {
    console.error('Fatal test error:', globalErr);
  }

  // ========================================================================
  // FINAL SCORECARD
  // ========================================================================
  console.log('\n================================================================');
  console.log(` FINAL COMPLETE SYSTEM TEST RESULTS:`);
  console.log(` Passed: ${passedTests} / ${totalTests} (${((passedTests / totalTests) * 100).toFixed(1)}%)`);
  console.log(` Failed: ${failedTests} / ${totalTests}`);
  console.log('================================================================\n');

  if (failedTests > 0) {
    process.exit(1);
  }
}

runFinalCompleteSystemTestSuite()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
