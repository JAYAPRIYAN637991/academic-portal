import request from 'supertest';
import { createApp } from '../server';
import { prisma } from '../db';
import { Role } from '@prisma/client';

async function runStaffManagementTests() {
  console.log('🧪 Starting Admin-Only Staff Management & Teacher Assignments Test Suite...\n');
  const app = createApp();

  let passed = 0;
  let failed = 0;

  async function assertTest(name: string, fn: () => Promise<void>) {
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

  let createdStaffId: string | null = null;
  let createdAssignmentId: string | null = null;

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

    // Sections
    const secCSE3A = await prisma.section.findFirst({
      where: { name: 'A', departmentId: cseDept!.id, yearId: yr3!.id, academicYearId: currentYear!.id }
    });
    const secCSE3B = await prisma.section.findFirst({
      where: { name: 'B', departmentId: cseDept!.id, yearId: yr3!.id, academicYearId: currentYear!.id }
    });
    const secECE3A = await prisma.section.findFirst({
      where: { name: 'A', departmentId: eceDept!.id, yearId: yr3!.id, academicYearId: currentYear!.id }
    });

    // Subjects
    const subDBMS = await prisma.subject.findUnique({ where: { code: 'CS8501' } }); // CSE Yr3
    const subTOC = await prisma.subject.findUnique({ where: { code: 'CS8502' } });  // CSE Yr3
    const subDC = await prisma.subject.findUnique({ where: { code: 'EC8501' } });   // ECE Yr3

    // Create a 2nd Academic Year for testing different academic years
    let otherYear = await prisma.academicYear.findUnique({ where: { yearName: '2028-2029' } });
    if (!otherYear) {
      otherYear = await prisma.academicYear.create({
        data: { yearName: '2028-2029', isCurrent: false, isActive: true }
      });
    }

    let secCSE3A_OtherYear = await prisma.section.findFirst({
      where: { name: 'A', departmentId: cseDept!.id, yearId: yr3!.id, academicYearId: otherYear.id }
    });
    if (!secCSE3A_OtherYear) {
      secCSE3A_OtherYear = await prisma.section.create({
        data: { name: 'A', departmentId: cseDept!.id, yearId: yr3!.id, academicYearId: otherYear.id }
      });
    }

    // ========================================================
    // SECTION 1: STAFF RESTRICTIONS ON ADMIN STAFF APIS (403)
    // ========================================================
    await assertTest('Staff attempting to access Admin Staff API → 403 Forbidden', async () => {
      const res = await request(app)
        .get('/api/admin/staff')
        .set('Authorization', `Bearer ${staffToken}`);
      if (res.status !== 403) throw new Error(`Expected 403, got ${res.status}`);
      if (res.body.code !== 'ADMIN_ACCESS_REQUIRED') throw new Error(`Expected ADMIN_ACCESS_REQUIRED, got ${res.body.code}`);
    });

    await assertTest('Staff attempting to create a faculty account → 403 Forbidden', async () => {
      const res = await request(app)
        .post('/api/admin/staff')
        .set('Authorization', `Bearer ${staffToken}`)
        .send({ name: 'Hacker', email: 'hack@college.edu', password: 'password123' });
      if (res.status !== 403) throw new Error(`Expected 403, got ${res.status}`);
    });

    // ========================================================
    // SECTION 2: ADMIN STAFF CRUD & STATUS MANAGEMENT
    // ========================================================
    // Ensure clean state for John Doe
    const adminUser = await prisma.user.findFirst({ where: { role: 'ADMIN' } });
    const existingJohn = await prisma.user.findUnique({ where: { email: 'john.doe@college.edu' } });
    if (existingJohn) {
      await prisma.teacherAssignment.deleteMany({ where: { staffId: existingJohn.id } });
      if (adminUser) {
        await prisma.auditLog.updateMany({ where: { userId: existingJohn.id }, data: { userId: adminUser.id } });
      }
      await prisma.user.delete({ where: { id: existingJohn.id } });
    }

    await assertTest('Admin creates a new Staff member (John Doe) → 201 Created', async () => {
      const res = await request(app)
        .post('/api/admin/staff')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          name: 'Prof. John Doe',
          email: 'john.doe@college.edu',
          password: 'initialPassword123'
        });

      if (res.status !== 201) throw new Error(`Status ${res.status}: ${res.body.error}`);
      if (res.body.staff.name !== 'Prof. John Doe') throw new Error('Staff name mismatch');
      if (res.body.staff.role !== 'STAFF') throw new Error('Role must be STAFF');
      createdStaffId = res.body.staff.id;
    });

    await assertTest('Admin edits Staff profile information → 200 OK', async () => {
      const res = await request(app)
        .put(`/api/admin/staff/${createdStaffId}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          name: 'Dr. Johnathan Doe'
        });

      if (res.status !== 200) throw new Error(`Status ${res.status}: ${res.body.error}`);
      if (res.body.staff.name !== 'Dr. Johnathan Doe') throw new Error('Updated name mismatch');
    });

    await assertTest('Admin deactivates Staff member → 200 OK & login blocked (403)', async () => {
      const toggleRes = await request(app)
        .patch(`/api/admin/staff/${createdStaffId}/status`)
        .set('Authorization', `Bearer ${adminToken}`);
      if (toggleRes.status !== 200) throw new Error(`Toggle status failed: ${toggleRes.status}`);
      if (toggleRes.body.staff.isActive !== false) throw new Error('Staff should be deactivated');

      // Attempt to login while deactivated
      const loginRes = await request(app)
        .post('/api/auth/login')
        .send({ email: 'john.doe@college.edu', password: 'initialPassword123' });
      if (loginRes.status !== 403) throw new Error(`Expected 403, got ${loginRes.status}`);
      if (loginRes.body.code !== 'ACCOUNT_DEACTIVATED') throw new Error(`Expected ACCOUNT_DEACTIVATED, got ${loginRes.body.code}`);
    });

    await assertTest('Admin reactivates Staff member → 200 OK', async () => {
      const res = await request(app)
        .patch(`/api/admin/staff/${createdStaffId}/status`)
        .set('Authorization', `Bearer ${adminToken}`);
      if (res.status !== 200) throw new Error(`Reactivation failed: ${res.status}`);
      if (res.body.staff.isActive !== true) throw new Error('Staff should be active');
    });

    await assertTest('Admin resets Staff password → 200 OK & new password works', async () => {
      const resetRes = await request(app)
        .post(`/api/admin/staff/${createdStaffId}/reset-password`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ newPassword: 'newSecretPassword123' });
      if (resetRes.status !== 200) throw new Error(`Reset failed: ${resetRes.status}`);

      // Login with old password should fail
      const oldLogin = await request(app)
        .post('/api/auth/login')
        .send({ email: 'john.doe@college.edu', password: 'initialPassword123' });
      if (oldLogin.status !== 401) throw new Error('Old password must be rejected');

      // Login with new password should succeed
      const newLogin = await request(app)
        .post('/api/auth/login')
        .send({ email: 'john.doe@college.edu', password: 'newSecretPassword123' });
      if (newLogin.status !== 200) throw new Error('New password login failed');
      if (newLogin.body.user.name !== 'Dr. Johnathan Doe') throw new Error('User identity mismatch');
    });

    // ========================================================
    // SECTION 3: ASSIGNMENT STRUCTURE & VALIDATION
    // Structure: Staff + Academic Year + Department + Year + Section + Subject
    // ========================================================
    await assertTest('Admin assigns John to CSE Yr3 SecB for TOC (CS8502) → 201 Created', async () => {
      const res = await request(app)
        .post(`/api/admin/staff/${createdStaffId}/assignments`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          academicYearId: currentYear!.id,
          departmentId: cseDept!.id,
          yearId: yr3!.id,
          sectionId: secCSE3B!.id,
          subjectId: subTOC!.id
        });

      if (res.status !== 201 && res.status !== 200) throw new Error(`Status ${res.status}: ${res.body.error}`);
      createdAssignmentId = res.body.assignment.id;
      if (res.body.assignment.staffId !== createdStaffId) throw new Error('Staff assignment mismatch');
      if (res.body.assignment.subject.code !== 'CS8502') throw new Error('Subject mismatch');
    });

    await assertTest('Validation: Duplicate assignment of same class & subject → 409 Conflict', async () => {
      const res = await request(app)
        .post(`/api/admin/staff/${createdStaffId}/assignments`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          academicYearId: currentYear!.id,
          departmentId: cseDept!.id,
          yearId: yr3!.id,
          sectionId: secCSE3B!.id,
          subjectId: subTOC!.id
        });

      if (res.status !== 409) throw new Error(`Expected 409, got ${res.status}`);
      if (res.body.code !== 'ALREADY_ASSIGNED') throw new Error(`Expected ALREADY_ASSIGNED, got ${res.body.code}`);
    });

    await assertTest('Validation: Section and Subject Department mismatch → 400 Bad Request', async () => {
      // Trying to assign ECE section with CSE subject
      const res = await request(app)
        .post(`/api/admin/staff/${createdStaffId}/assignments`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          academicYearId: currentYear!.id,
          departmentId: cseDept!.id,
          yearId: yr3!.id,
          sectionId: secECE3A!.id, // ECE Section!
          subjectId: subTOC!.id
        });

      if (res.status !== 400) throw new Error(`Expected 400, got ${res.status}`);
      if (res.body.code !== 'SECTION_HIERARCHY_MISMATCH') throw new Error(`Expected SECTION_HIERARCHY_MISMATCH, got ${res.body.code}`);
    });

    // ========================================================
    // SECTION 4: MULTIDIMENSIONAL RBAC CHECKS ON MARKS
    // Staff Sarah is assigned ONLY to:
    // - Academic Year: currentYear
    // - Department: CSE
    // - Year: 3
    // - Section: A
    // - Subject: CS8501 (DBMS)
    // ========================================================
    await assertTest('Assigned Staff → ALLOWED (200 OK) accessing marks for assigned class & subject', async () => {
      const res = await request(app)
        .get(`/api/staff/marks?sectionId=${secCSE3A!.id}&subjectId=${subDBMS!.id}`)
        .set('Authorization', `Bearer ${staffToken}`);

      if (res.status !== 200) throw new Error(`Expected 200, got ${res.status}: ${res.body.error}`);
      if (!Array.isArray(res.body.students)) throw new Error('Expected students array');
    });

    await assertTest('Unassigned Section → 403 Forbidden (Sarah accessing Sec B)', async () => {
      const res = await request(app)
        .get(`/api/staff/marks?sectionId=${secCSE3B!.id}&subjectId=${subDBMS!.id}`)
        .set('Authorization', `Bearer ${staffToken}`);

      if (res.status !== 403) throw new Error(`Expected 403, got ${res.status}`);
      if (res.body.code !== 'STAFF_CLASS_UNAUTHORIZED') throw new Error(`Expected STAFF_CLASS_UNAUTHORIZED, got ${res.body.code}`);
    });

    await assertTest('Unassigned Subject → 403 Forbidden (Sarah accessing TOC in Sec A)', async () => {
      const res = await request(app)
        .get(`/api/staff/marks?sectionId=${secCSE3A!.id}&subjectId=${subTOC!.id}`)
        .set('Authorization', `Bearer ${staffToken}`);

      if (res.status !== 403) throw new Error(`Expected 403, got ${res.status}`);
      if (res.body.code !== 'STAFF_CLASS_UNAUTHORIZED') throw new Error(`Expected STAFF_CLASS_UNAUTHORIZED, got ${res.body.code}`);
    });

    await assertTest('Different Department → 403 Forbidden (Sarah accessing ECE Sec A & DC)', async () => {
      const res = await request(app)
        .get(`/api/staff/marks?sectionId=${secECE3A!.id}&subjectId=${subDC!.id}`)
        .set('Authorization', `Bearer ${staffToken}`);

      if (res.status !== 403) throw new Error(`Expected 403, got ${res.status}`);
      if (res.body.code !== 'STAFF_CLASS_UNAUTHORIZED') throw new Error(`Expected STAFF_CLASS_UNAUTHORIZED, got ${res.body.code}`);
    });

    await assertTest('Different Academic Year → 403 Forbidden (Sarah accessing Sec A in 2026-2027)', async () => {
      const res = await request(app)
        .get(`/api/staff/marks?sectionId=${secCSE3A_OtherYear!.id}&subjectId=${subDBMS!.id}`)
        .set('Authorization', `Bearer ${staffToken}`);

      if (res.status !== 403) throw new Error(`Expected 403, got ${res.status}`);
      if (res.body.code !== 'STAFF_CLASS_UNAUTHORIZED') throw new Error(`Expected STAFF_CLASS_UNAUTHORIZED, got ${res.body.code}`);
    });

    // ========================================================
    // SECTION 5: STAFF DASHBOARD DATA VERIFICATION
    // Must show: Assigned classes, Assigned subjects, Academic year, Student count
    // ========================================================
    await assertTest('Staff Dashboard Summary endpoint → returns classes, subjects, academic year & student count', async () => {
      const res = await request(app)
        .get('/api/staff/dashboard-summary')
        .set('Authorization', `Bearer ${staffToken}`);

      if (res.status !== 200) throw new Error(`Expected 200, got ${res.status}`);
      const { summary, assignedClasses } = res.body;

      if (!summary.academicYear) throw new Error('Missing academicYear in summary');
      if (typeof summary.totalAssignedClasses !== 'number') throw new Error('Missing totalAssignedClasses');
      if (typeof summary.totalAssignedSubjects !== 'number') throw new Error('Missing totalAssignedSubjects');
      if (typeof summary.totalStudentsTaught !== 'number') throw new Error('Missing totalStudentsTaught');

      if (!Array.isArray(assignedClasses) || assignedClasses.length === 0) {
        throw new Error('Expected at least 1 assigned class for Sarah');
      }

      const first = assignedClasses[0];
      if (!first.subjectCode || !first.section || typeof first.studentCount !== 'number') {
        throw new Error('Assigned class item is missing subject, section, or studentCount');
      }
    });

    // ========================================================
    // SECTION 6: UNASSIGNMENT & CLEANUP
    // ========================================================
    await assertTest('Admin unassigns class from John → 200 OK', async () => {
      const res = await request(app)
        .delete(`/api/admin/staff/assignments/${createdAssignmentId}`)
        .set('Authorization', `Bearer ${adminToken}`);

      if (res.status !== 200) throw new Error(`Status ${res.status}: ${res.body.error}`);
    });

    await assertTest('Admin deletes unreferenced staff member (John Doe) → 200 OK', async () => {
      const res = await request(app)
        .delete(`/api/admin/staff/${createdStaffId}`)
        .set('Authorization', `Bearer ${adminToken}`);

      if (res.status !== 200) throw new Error(`Status ${res.status}: ${res.body.error}`);

      const check = await prisma.user.findUnique({ where: { id: createdStaffId! } });
      if (check) throw new Error('Staff record should be deleted');
    });

    await assertTest('Reference-Checked Deletion: Attempting to delete Sarah with recorded marks → 409 Conflict', async () => {
      const sarah = await prisma.user.findUnique({ where: { email: 'sarah.cse@college.edu' } });
      const res = await request(app)
        .delete(`/api/admin/staff/${sarah!.id}`)
        .set('Authorization', `Bearer ${adminToken}`);

      if (res.status !== 409) throw new Error(`Expected 409, got ${res.status}`);
      if (res.body.code !== 'STAFF_REFERENCED_IN_MARKS') throw new Error(`Expected STAFF_REFERENCED_IN_MARKS, got ${res.body.code}`);
    });

  } catch (err: any) {
    console.error('Fatal error during test run:', err);
  } finally {
    try {
      await prisma.section.deleteMany({
        where: { academicYear: { yearName: { in: ['2026-2027', '2028-2029'] } } }
      });
      await prisma.academicYear.deleteMany({
        where: { yearName: { in: ['2026-2027', '2028-2029'] } }
      });
    } catch (_) {}
    await prisma.$disconnect();
    console.log('\n======================================================');
    console.log(`🏁 Staff Management Suite: ${passed} PASSED | ${failed} FAILED`);
    console.log('======================================================\n');
    if (failed > 0) process.exit(1);
    else process.exit(0);
  }
}

runStaffManagementTests();
