import request from 'supertest';
import { createApp } from '../server';
import { prisma } from '../db';
import * as fs from 'fs';
import * as path from 'path';

let passedTests = 0;
let failedTests = 0;

async function assertTest(name: string, fn: () => Promise<void>) {
  try {
    await fn();
    console.log(`  ✅ PASS: ${name}`);
    passedTests++;
  } catch (err: any) {
    console.error(`  ❌ FAIL: ${name}`);
    console.error(`     Reason: ${err.message}`);
    failedTests++;
  }
}

async function runRestrictedStaffDashboardTests() {
  console.log('\n========================================================');
  console.log(' RESTRICTED STAFF DASHBOARD & RBAC ISOLATION TEST SUITE');
  console.log('========================================================\n');

  const app = createApp();

  try {
    // ----------------------------------------------------
    // AUTHENTICATION SETUP
    // ----------------------------------------------------
    console.log('--- Setting up Authentication Tokens ---');

    // 1. Staff User (Sarah Jenkins - CSE Faculty)
    const staffLoginRes = await request(app)
      .post('/api/auth/login')
      .send({ email: 'sarah.cse@college.edu', password: 'staff123' });

    if (staffLoginRes.status !== 200 || !staffLoginRes.body.token) {
      throw new Error(`Failed to login staff member: ${JSON.stringify(staffLoginRes.body)}`);
    }
    const staffToken = staffLoginRes.body.token;
    const staffUser = staffLoginRes.body.user;

    // 2. Admin User
    const adminLoginRes = await request(app)
      .post('/api/auth/login')
      .send({ email: 'admin@college.edu', password: 'admin123' });

    if (adminLoginRes.status !== 200 || !adminLoginRes.body.token) {
      throw new Error(`Failed to login admin user: ${JSON.stringify(adminLoginRes.body)}`);
    }
    const adminToken = adminLoginRes.body.token;

    console.log(`Authenticated Staff: ${staffUser.name} (${staffUser.email}) [Role: ${staffUser.role}]`);

    // ========================================================
    // SUITE 1: 5 CARDS VERIFICATION (Staff Dashboard Summary)
    // ========================================================
    console.log('\n--- SUITE 1: Staff Dashboard 5 KPI Cards Verification ---');

    let dashboardSummaryData: any = null;

    await assertTest('Staff retrieves /api/staff/dashboard-summary successfully (200 OK)', async () => {
      const res = await request(app)
        .get('/api/staff/dashboard-summary')
        .set('Authorization', `Bearer ${staffToken}`);

      if (res.status !== 200) throw new Error(`Expected 200, got ${res.status}: ${JSON.stringify(res.body)}`);
      dashboardSummaryData = res.body;
      if (!dashboardSummaryData.summary) throw new Error('Response missing summary object');
    });

    await assertTest('Card 1: Assigned Classes count is present & numeric', async () => {
      const val = dashboardSummaryData.summary.assignedClasses;
      if (typeof val !== 'number') throw new Error(`Expected number, got ${typeof val} (${val})`);
      if (val < 0) throw new Error(`Assigned classes cannot be negative: ${val}`);
    });

    await assertTest('Card 2: Assigned Subjects count is present & numeric', async () => {
      const val = dashboardSummaryData.summary.assignedSubjects;
      if (typeof val !== 'number') throw new Error(`Expected number, got ${typeof val} (${val})`);
      if (val < 0) throw new Error(`Assigned subjects cannot be negative: ${val}`);
    });

    await assertTest('Card 3: Total Students count is present & numeric', async () => {
      const val = dashboardSummaryData.summary.totalStudents;
      if (typeof val !== 'number') throw new Error(`Expected number, got ${typeof val} (${val})`);
      if (val < 0) throw new Error(`Total students cannot be negative: ${val}`);
    });

    await assertTest('Card 4: Pending Marks count is present & numeric', async () => {
      const val = dashboardSummaryData.summary.pendingMarks;
      if (typeof val !== 'number') throw new Error(`Expected number, got ${typeof val} (${val})`);
      if (val < 0) throw new Error(`Pending marks cannot be negative: ${val}`);
    });

    await assertTest('Card 5: Completed Assessments count is present & numeric', async () => {
      const val = dashboardSummaryData.summary.completedAssessments;
      if (typeof val !== 'number') throw new Error(`Expected number, got ${typeof val} (${val})`);
      if (val < 0) throw new Error(`Completed assessments cannot be negative: ${val}`);
    });

    // ========================================================
    // SUITE 2: 3 SECTIONS VERIFICATION (My Classes, My Subjects, Recent Uploads)
    // ========================================================
    console.log('\n--- SUITE 2: Staff Dashboard 3 Sections Verification ---');

    await assertTest('Section 1: "My Classes" array is populated with valid class records', async () => {
      const classes = dashboardSummaryData.myClasses;
      if (!Array.isArray(classes)) throw new Error('myClasses must be an array');
      if (classes.length > 0) {
        const first = classes[0];
        if (!first.sectionId) throw new Error('Class missing sectionId');
        if (!first.sectionName) throw new Error('Class missing sectionName');
        if (!first.departmentCode) throw new Error('Class missing departmentCode');
        if (!first.yearName) throw new Error('Class missing yearName');
        if (typeof first.studentCount !== 'number') throw new Error('Class missing studentCount');
        if (!Array.isArray(first.subjects)) throw new Error('Class missing subjects array');
      }
    });

    await assertTest('Section 2: "My Subjects" array is populated with valid subject records', async () => {
      const subjects = dashboardSummaryData.mySubjects;
      if (!Array.isArray(subjects)) throw new Error('mySubjects must be an array');
      if (subjects.length > 0) {
        const first = subjects[0];
        if (!first.subjectId) throw new Error('Subject missing subjectId');
        if (!first.code) throw new Error('Subject missing code');
        if (!first.name) throw new Error('Subject missing name');
        if (!first.departmentCode) throw new Error('Subject missing departmentCode');
        if (!Array.isArray(first.sections)) throw new Error('Subject missing sections array');
      }
    });

    await assertTest('Section 3: "Recent Marks Uploads" array exists & is validly structured', async () => {
      const uploads = dashboardSummaryData.recentMarksUploads;
      if (!Array.isArray(uploads)) throw new Error('recentMarksUploads must be an array');
      // If uploads exist, verify items
      for (const u of uploads) {
        if (!u.subjectCode) throw new Error('Upload record missing subjectCode');
        if (!u.sectionName) throw new Error('Upload record missing sectionName');
        if (!u.assessmentName && !u.assessmentCode) throw new Error('Upload record missing assessment');
        if (typeof u.recordsCount !== 'number') throw new Error('Upload record missing recordsCount');
      }
    });

    // ========================================================
    // SUITE 3: ZERO-TRUST BACKEND BLOCKING (All 11 Forbidden Admin APIs)
    // ========================================================
    console.log('\n--- SUITE 3: Zero-Trust Backend Enforcement (All 11 Forbidden Admin APIs) ---');

    const forbiddenAdminEndpoints = [
      { name: 'College Analytics', url: '/api/admin/analytics/overall' },
      { name: 'Department Analytics', url: '/api/admin/analytics/departments' },
      { name: 'Year Analytics', url: '/api/admin/analytics/years' },
      { name: 'Admin Dashboard Summary', url: '/api/admin/dashboard-summary' },
      { name: 'Reports (Overall College Result)', url: '/api/admin/reports/overall-college' },
      { name: 'Student Management Directory', url: '/api/admin/students' },
      { name: 'Parent Management Directory', url: '/api/admin/parents' },
      { name: 'Staff Management Directory', url: '/api/admin/staff' },
      { name: 'College Notices Management', url: '/api/admin/notices' },
      { name: 'Notification History', url: '/api/admin/notifications/history' },
      { name: 'Audit Logs System', url: '/api/admin/audit-logs' },
      { name: 'Academic Structure / System Settings', url: '/api/admin/academic-structure/overview' }
    ];

    for (const ep of forbiddenAdminEndpoints) {
      await assertTest(`Staff manually accessing ${ep.name} (${ep.url}) is BLOCKED with 403 Forbidden`, async () => {
        const res = await request(app)
          .get(ep.url)
          .set('Authorization', `Bearer ${staffToken}`);

        if (res.status !== 403) {
          throw new Error(`Security breach! Expected 403 Forbidden, but received HTTP ${res.status}: ${JSON.stringify(res.body)}`);
        }
        if (res.body.code !== 'ADMIN_ACCESS_REQUIRED' && !res.body.error?.toLowerCase().includes('admin') && !res.body.error?.toLowerCase().includes('forbidden')) {
          throw new Error(`Expected ADMIN_ACCESS_REQUIRED error code, got: ${res.body.code || res.body.error}`);
        }
      });
    }

    // ========================================================
    // SUITE 4: SCOPED MARKS ACCESS & UNASSIGNED CLASS FORBIDDEN
    // ========================================================
    console.log('\n--- SUITE 4: Marks Access Scoping & Unauthorized Rejections ---');

    await assertTest('Staff can access /api/staff/assigned-classes (200 OK)', async () => {
      const res = await request(app)
        .get('/api/staff/assigned-classes')
        .set('Authorization', `Bearer ${staffToken}`);

      if (res.status !== 200) throw new Error(`Expected 200, got ${res.status}`);
      if (!Array.isArray(res.body.assignedClasses)) throw new Error('Expected assignedClasses array');
    });

    await assertTest('Staff can access /api/staff/subjects (200 OK)', async () => {
      const res = await request(app)
        .get('/api/staff/subjects')
        .set('Authorization', `Bearer ${staffToken}`);

      if (res.status !== 200) throw new Error(`Expected 200, got ${res.status}`);
      if (!Array.isArray(res.body.subjects)) throw new Error('Expected subjects array');
    });

    await assertTest('Staff can access /api/staff/assessments (200 OK)', async () => {
      const res = await request(app)
        .get('/api/staff/assessments')
        .set('Authorization', `Bearer ${staffToken}`);

      if (res.status !== 200) throw new Error(`Expected 200, got ${res.status}`);
      if (!Array.isArray(res.body.assessments)) throw new Error('Expected assessments array');
    });

    // Unassigned class marks check: Staff accessing random section should receive 403
    await assertTest('Staff attempting to access marks for an unassigned section is BLOCKED (403 Forbidden)', async () => {
      const res = await request(app)
        .get('/api/staff/marks?sectionId=unassigned-dummy-section-999&subjectId=dummy-subject-888')
        .set('Authorization', `Bearer ${staffToken}`);

      if (res.status !== 403) {
        throw new Error(`Expected 403 Forbidden, got ${res.status}`);
      }
      if (res.body.code !== 'STAFF_CLASS_UNAUTHORIZED') {
        throw new Error(`Expected STAFF_CLASS_UNAUTHORIZED, got ${res.body.code}`);
      }
    });

    // ========================================================
    // SUITE 5: FRONTEND UI RESTRICTIONS & ISOLATION VERIFICATION
    // ========================================================
    console.log('\n--- SUITE 5: UI Isolation & Navigation Restrictions Verification ---');

    const staffLayoutPath = path.resolve(__dirname, '../../../client/js/views/staffLayout.js');
    const staffDashboardPath = path.resolve(__dirname, '../../../client/js/views/staffDashboardView.js');

    const staffLayoutContent = fs.readFileSync(staffLayoutPath, 'utf8');
    const staffDashboardContent = fs.readFileSync(staffDashboardPath, 'utf8');

    // 1. Verify 5 Cards exist in staffDashboardView.js
    await assertTest('UI: staffDashboardView.js defines all 5 required KPI Cards', async () => {
      const requiredCardTitles = [
        'ASSIGNED CLASSES',
        'ASSIGNED SUBJECTS',
        'TOTAL STUDENTS',
        'PENDING MARKS',
        'COMPLETED ASSESSMENTS'
      ];
      for (const cardTitle of requiredCardTitles) {
        if (!staffDashboardContent.includes(cardTitle)) {
          throw new Error(`staffDashboardView.js is missing card: "${cardTitle}"`);
        }
      }
    });

    // 2. Verify 3 Sections exist in staffDashboardView.js
    await assertTest('UI: staffDashboardView.js defines all 3 required Sections', async () => {
      const requiredSections = [
        'My Classes',
        'My Subjects',
        'Recent Marks Uploads'
      ];
      for (const sec of requiredSections) {
        if (!staffDashboardContent.includes(sec)) {
          throw new Error(`staffDashboardView.js is missing section: "${sec}"`);
        }
      }
    });

    // 3. Verify 4 Quick Actions exist in staffDashboardView.js
    await assertTest('UI: staffDashboardView.js defines all 4 required Quick Actions', async () => {
      const requiredActions = [
        'Upload Marks',
        'Enter Marks',
        'View Assigned Students',
        'View Assigned Performance'
      ];
      for (const qa of requiredActions) {
        if (!staffDashboardContent.includes(qa)) {
          throw new Error(`staffDashboardView.js is missing quick action: "${qa}"`);
        }
      }
    });

    // 4. Strict UI Negative Check: Forbidden Admin elements MUST NEVER appear in staff navigation
    await assertTest('UI: staffLayout.js contains ZERO Admin navigation items or forbidden governance modules', async () => {
      const forbiddenNavigationKeywords = [
        'College analytics',
        'Department analytics',
        'Year analytics',
        'Audit logs',
        'Notification history',
        'College notices',
        'Student management',
        'Parent management',
        'Staff management',
        'System settings'
      ];

      // Check sidebar nav specifically
      const navSection = staffLayoutContent.substring(
        staffLayoutContent.indexOf('<nav class="sidebar-nav">'),
        staffLayoutContent.indexOf('</nav>')
      );

      for (const keyword of forbiddenNavigationKeywords) {
        if (navSection.toLowerCase().includes(keyword.toLowerCase())) {
          throw new Error(`Forbidden admin navigation item found in Staff sidebar: "${keyword}"`);
        }
      }
    });

    await assertTest('UI: staffDashboardView.js contains ZERO admin analytics widgets or governance feeds', async () => {
      const forbiddenViewKeywords = [
        'College analytics',
        'Department analytics',
        'Year analytics',
        'Audit logs',
        'Notification history',
        'College notices'
      ];

      for (const keyword of forbiddenViewKeywords) {
        if (staffDashboardContent.toLowerCase().includes(keyword.toLowerCase())) {
          throw new Error(`Forbidden admin element found in staffDashboardView.js: "${keyword}"`);
        }
      }
    });

    // ----------------------------------------------------
    // TEST SUMMARY
    // ----------------------------------------------------
    console.log('\n========================================================');
    console.log(` RESTRICTED STAFF DASHBOARD TESTS COMPLETE: ${passedTests} PASSED, ${failedTests} FAILED`);
    console.log('========================================================\n');

    if (failedTests > 0) {
      process.exit(1);
    }
  } catch (error) {
    console.error('Fatal test error:', error);
    process.exit(1);
  }
}

runRestrictedStaffDashboardTests();
