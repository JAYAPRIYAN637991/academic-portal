import request from 'supertest';
import { createApp } from '../server';
import { prisma } from '../db';

async function runAdminPerformanceDashboardTests() {
  console.log('🧪 Starting Admin Student Performance Dashboard Test Suite...\n');
  const app = createApp();

  let passed = 0;
  let failed = 0;

  async function assertTest(name: string, fn: () => Promise<void> | void) {
    try {
      await fn();
      console.log(`  ✅ PASS: ${name}`);
      passed++;
    } catch (err: any) {
      console.error(`  ❌ FAIL: ${name}`);
      console.error(`     Error: ${err.message || err}\n`);
      failed++;
    }
  }

  try {
    // 1. Authenticate Admin and Staff
    const adminLogin = await request(app)
      .post('/api/auth/login')
      .send({ email: 'admin@college.edu', password: 'admin123' });
    const adminToken = adminLogin.body.token;

    const staffLogin = await request(app)
      .post('/api/auth/login')
      .send({ email: 'sarah.cse@college.edu', password: 'staff123' });
    const staffToken = staffLogin.body.token;

    // Prerequisite entities
    const currentYear = await prisma.academicYear.findFirst({ where: { isCurrent: true } });
    const cseDept = await prisma.department.findUnique({ where: { code: 'CSE' } });
    const eceDept = await prisma.department.findUnique({ where: { code: 'ECE' } });
    const yr3 = await prisma.year.findFirst({ where: { yearNumber: 3 } });

    const secCSE3A = await prisma.section.findFirst({
      where: { name: 'A', departmentId: cseDept!.id, yearId: yr3!.id, academicYearId: currentYear!.id }
    });
    const secECE3A = await prisma.section.findFirst({
      where: { name: 'A', departmentId: eceDept!.id, yearId: yr3!.id, academicYearId: currentYear!.id }
    });

    const cseStudent = await prisma.student.findFirst({
      where: { sectionId: secCSE3A!.id }
    });
    const eceStudent = await prisma.student.findFirst({
      where: { sectionId: secECE3A!.id }
    });

    // =======================================================================
    // SECTION 1: ADMIN PERFORMANCE OVERVIEW & CALCULATION METRICS
    // =======================================================================
    console.log('--- SECTION 1: Performance Overview API & Backend Calculations ---');

    let allStudentsCount = 0;

    await assertTest('Admin Overview: Can retrieve complete student performance overview', async () => {
      const res = await request(app)
        .get('/api/admin/analytics/performance/overview')
        .set('Authorization', `Bearer ${adminToken}`);

      if (res.status !== 200) throw new Error(`Status ${res.status}: ${JSON.stringify(res.body)}`);
      if (!res.body.students || !Array.isArray(res.body.students)) throw new Error('Missing students array');
      if (!res.body.summary) throw new Error('Missing summary');
      if (!res.body.subjects) throw new Error('Missing subjects');

      allStudentsCount = res.body.students.length;
      if (allStudentsCount === 0) throw new Error('Expected enrolled students in database');

      // Check fields of first student
      const s = res.body.students[0];
      if (!s.studentName) throw new Error('Missing studentName');
      if (!s.registerNumber) throw new Error('Missing registerNumber');
      if (s.departmentCode === undefined) throw new Error('Missing departmentCode');
      if (s.yearName === undefined) throw new Error('Missing yearName');
      if (s.sectionName === undefined) throw new Error('Missing sectionName');
      if (s.percentage === undefined) throw new Error('Missing percentage');
      if (s.performanceStatus === undefined) throw new Error('Missing performanceStatus');
      if (s.progressionStatus === undefined) throw new Error('Missing progressionStatus');
    });

    // =======================================================================
    // SECTION 2: MULTI-PARAMETER FILTERING
    // =======================================================================
    console.log('\n--- SECTION 2: Dynamic Multi-Parameter Filtering ---');

    await assertTest('Filter 1: Filter by Department (CSE)', async () => {
      const res = await request(app)
        .get(`/api/admin/analytics/performance/overview?departmentId=${cseDept!.id}`)
        .set('Authorization', `Bearer ${adminToken}`);

      if (res.status !== 200) throw new Error(`Status ${res.status}`);
      const students = res.body.students;
      for (const s of students) {
        if (s.departmentCode !== 'CSE') {
          throw new Error(`Expected all students to be in CSE, found ${s.departmentCode}`);
        }
      }
    });

    await assertTest('Filter 2: Filter by Year (Year 3)', async () => {
      const res = await request(app)
        .get(`/api/admin/analytics/performance/overview?yearId=${yr3!.id}`)
        .set('Authorization', `Bearer ${adminToken}`);

      if (res.status !== 200) throw new Error(`Status ${res.status}`);
      const students = res.body.students;
      for (const s of students) {
        if (s.yearName !== yr3!.name) {
          throw new Error(`Expected all students to be Year 3, found ${s.yearName}`);
        }
      }
    });

    await assertTest('Filter 3: Filter by Section (CSE 3A)', async () => {
      const res = await request(app)
        .get(`/api/admin/analytics/performance/overview?sectionId=${secCSE3A!.id}`)
        .set('Authorization', `Bearer ${adminToken}`);

      if (res.status !== 200) throw new Error(`Status ${res.status}`);
      const students = res.body.students;
      for (const s of students) {
        if (s.sectionName !== 'A') {
          throw new Error(`Expected all students to be in Section A, found ${s.sectionName}`);
        }
      }
    });

    await assertTest('Filter 4: Filter by Student Search (Query by Register Number)', async () => {
      const reg = cseStudent!.registerNumber;
      const res = await request(app)
        .get(`/api/admin/analytics/performance/overview?search=${encodeURIComponent(reg)}`)
        .set('Authorization', `Bearer ${adminToken}`);

      if (res.status !== 200) throw new Error(`Status ${res.status}`);
      const students = res.body.students;
      if (students.length === 0) throw new Error('Expected to find searched student');
      if (students[0].registerNumber !== reg) {
        throw new Error(`Expected ${reg}, got ${students[0].registerNumber}`);
      }
    });

    await assertTest('Filter 5: Filter by Academic Year', async () => {
      const res = await request(app)
        .get(`/api/admin/analytics/performance/overview?academicYearId=${currentYear!.id}`)
        .set('Authorization', `Bearer ${adminToken}`);

      if (res.status !== 200) throw new Error(`Status ${res.status}`);
      if (res.body.students.length === 0) throw new Error('Expected students for current academic year');
    });

    // =======================================================================
    // SECTION 3: STUDENT DEEP-DIVE & SUBJECT COMPARISON TABLE
    // =======================================================================
    console.log('\n--- SECTION 3: Student Deep-Dive & Subject Comparison ---');

    await assertTest('Student Deep-Dive: Retrieves student with placement and assessment timeline', async () => {
      const res = await request(app)
        .get(`/api/admin/analytics/performance/student/${cseStudent!.id}`)
        .set('Authorization', `Bearer ${adminToken}`);

      if (res.status !== 200) throw new Error(`Status ${res.status}: ${JSON.stringify(res.body)}`);
      const report = res.body.report;
      if (!report) throw new Error('Missing report');
      if (report.studentName !== cseStudent!.name) throw new Error(`Name mismatch: ${report.studentName}`);
      if (!report.departmentCode) throw new Error('Missing departmentCode');
      if (!report.yearName) throw new Error('Missing yearName');
      if (!report.sectionName) throw new Error('Missing sectionName');
      if (!report.assessmentTimeline || !Array.isArray(report.assessmentTimeline)) {
        throw new Error('Missing assessmentTimeline array for trend plotting');
      }

      // Verify subject comparison fields
      if (!report.subjectBreakdown || !Array.isArray(report.subjectBreakdown)) {
        throw new Error('Missing subjectBreakdown array');
      }

      for (const sub of report.subjectBreakdown) {
        if (!sub.subjectCode) throw new Error('Missing subjectCode in breakdown');
        if (!sub.subjectName) throw new Error('Missing subjectName in breakdown');
        if (sub.ia1 === undefined) throw new Error('Missing ia1 object');
        if (sub.ia2 === undefined) throw new Error('Missing ia2 object');
        if (sub.status === undefined) throw new Error('Missing status');
      }
    });

    // =======================================================================
    // SECTION 4: ROLE-BASED ACCESS CONTROL & STAFF BOUNDARY RESTRICTIONS
    // =======================================================================
    console.log('\n--- SECTION 4: Staff RBAC & Boundary Protection ---');

    await assertTest('Staff CANNOT access Admin Performance Overview (/api/admin/analytics/performance/overview) -> 403 Forbidden', async () => {
      const res = await request(app)
        .get('/api/admin/analytics/performance/overview')
        .set('Authorization', `Bearer ${staffToken}`);

      if (res.status !== 403) throw new Error(`Expected 403 Forbidden, got ${res.status}`);
    });

    await assertTest('Staff CANNOT access Admin Student Deep-Dive -> 403 Forbidden', async () => {
      const res = await request(app)
        .get(`/api/admin/analytics/performance/student/${cseStudent!.id}`)
        .set('Authorization', `Bearer ${staffToken}`);

      if (res.status !== 403) throw new Error(`Expected 403 Forbidden, got ${res.status}`);
    });

    await assertTest('Staff CAN access their assigned student via /api/staff/analytics/performance/student/:id', async () => {
      const res = await request(app)
        .get(`/api/staff/analytics/performance/student/${cseStudent!.id}`)
        .set('Authorization', `Bearer ${staffToken}`);

      if (res.status !== 200) throw new Error(`Expected 200 OK, got ${res.status}: ${JSON.stringify(res.body)}`);
      if (!res.body.report) throw new Error('Missing report in staff response');
    });

    await assertTest('Staff CANNOT access unassigned student performance via staff route -> 403 Forbidden', async () => {
      const res = await request(app)
        .get(`/api/staff/analytics/performance/student/${eceStudent!.id}`)
        .set('Authorization', `Bearer ${staffToken}`);

      if (res.status !== 403) throw new Error(`Expected 403 Forbidden, got ${res.status}`);
      if (res.body.code !== 'STAFF_STUDENT_UNAUTHORIZED') {
        throw new Error(`Expected STAFF_STUDENT_UNAUTHORIZED, got ${res.body.code}`);
      }
    });

    await assertTest('Unauthenticated access to Performance Overview -> 401 Unauthorized', async () => {
      const res = await request(app)
        .get('/api/admin/analytics/performance/overview');

      if (res.status !== 401) throw new Error(`Expected 401 Unauthorized, got ${res.status}`);
    });

    console.log(`\n======================================================`);
    console.log(`🏁 Admin Performance Dashboard: ${passed} PASSED | ${failed} FAILED`);
    console.log(`======================================================\n`);

    if (failed > 0) {
      process.exit(1);
    }
  } catch (err: any) {
    console.error('Fatal test error:', err);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

runAdminPerformanceDashboardTests();
