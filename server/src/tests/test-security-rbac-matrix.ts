import request from 'supertest';
import { createApp } from '../server';
import { prisma } from '../db';

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

async function runSecurityAndRbacMatrixTests() {
  console.log('\n================================================================');
  console.log(' COMPLETE SECURITY & ROLE-BASED ACCESS CONTROL (RBAC) TEST SUITE');
  console.log('================================================================\n');

  const app = createApp();

  try {
    // ----------------------------------------------------
    // SETUP: Tokens & Active Allocations
    // ----------------------------------------------------
    console.log('--- Setting up Authentication & Fixture Allocations ---');

    // 1. Admin Token
    const adminLoginRes = await request(app)
      .post('/api/auth/login')
      .send({ email: 'admin@college.edu', password: 'admin123' });

    if (adminLoginRes.status !== 200 || !adminLoginRes.body.token) {
      throw new Error(`Admin login failed: ${JSON.stringify(adminLoginRes.body)}`);
    }
    const adminToken = adminLoginRes.body.token;

    // 2. Staff Token (Sarah Jenkins - CSE Department)
    const staffLoginRes = await request(app)
      .post('/api/auth/login')
      .send({ email: 'sarah.cse@college.edu', password: 'staff123' });

    if (staffLoginRes.status !== 200 || !staffLoginRes.body.token) {
      throw new Error(`Staff login failed: ${JSON.stringify(staffLoginRes.body)}`);
    }
    const staffToken = staffLoginRes.body.token;
    const staffUser = staffLoginRes.body.user;

    // Retrieve Sarah's assigned classes & subjects
    const sarahAssignments = await prisma.teacherAssignment.findMany({
      where: { staffId: staffUser.id },
      include: {
        section: { include: { department: true, year: true, academicYear: true } },
        subject: true,
        academicYear: true
      }
    });

    if (sarahAssignments.length === 0) {
      throw new Error('Sarah has no teacher assignments seeded.');
    }

    const assignedAssignment = sarahAssignments[0];
    const assignedSectionId = assignedAssignment.sectionId;
    const assignedSubjectId = assignedAssignment.subjectId;
    const assignedAcademicYearId = assignedAssignment.academicYearId;
    const assignedDepartmentId = assignedAssignment.section.departmentId;

    // Find an unassigned section in CSE or ECE
    const unassignedSection = await prisma.section.findFirst({
      where: {
        id: { notIn: sarahAssignments.map(a => a.sectionId) }
      },
      include: { department: true }
    });

    // Find an unassigned subject
    const unassignedSubject = await prisma.subject.findFirst({
      where: {
        id: { notIn: sarahAssignments.map(a => a.subjectId) }
      }
    });

    // Find a different department (e.g. ECE)
    const otherDepartment = await prisma.department.findFirst({
      where: { id: { not: assignedDepartmentId } }
    });

    // Find a different academic year
    const otherAcademicYear = await prisma.academicYear.findFirst({
      where: { id: { not: assignedAcademicYearId } }
    });

    console.log(`Sarah Assigned Section: ${assignedAssignment.section.name} (${assignedAssignment.section.department.code})`);
    console.log(`Sarah Assigned Subject: [${assignedAssignment.subject.code}] ${assignedAssignment.subject.name}`);
    if (unassignedSection) console.log(`Unassigned Section: ${unassignedSection.name} (${unassignedSection.department.code})`);

    // ========================================================
    // SUITE 1: ADMIN PERMISSIONS (ALL 18 ALLOWED CAPABILITIES)
    // ========================================================
    console.log('\n--- SUITE 1: Admin Permissions Verification (All 18 Items Allowed) ---');

    await assertTest('ADMIN 1: Academic structure → ALLOWED (200 OK)', async () => {
      const res = await request(app)
        .get('/api/admin/academic-structure/overview')
        .set('Authorization', `Bearer ${adminToken}`);
      if (res.status !== 200) throw new Error(`Expected 200, got ${res.status}`);
    });

    await assertTest('ADMIN 2: Students → ALLOWED (200 OK)', async () => {
      const res = await request(app)
        .get('/api/admin/students')
        .set('Authorization', `Bearer ${adminToken}`);
      if (res.status !== 200) throw new Error(`Expected 200, got ${res.status}`);
    });

    await assertTest('ADMIN 3: Parents → ALLOWED (200 OK)', async () => {
      const res = await request(app)
        .get('/api/admin/parents')
        .set('Authorization', `Bearer ${adminToken}`);
      if (res.status !== 200) throw new Error(`Expected 200, got ${res.status}`);
      if (!Array.isArray(res.body.parents)) throw new Error('Expected parents array');
    });

    await assertTest('ADMIN 4: Staff → ALLOWED (200 OK)', async () => {
      const res = await request(app)
        .get('/api/admin/staff')
        .set('Authorization', `Bearer ${adminToken}`);
      if (res.status !== 200) throw new Error(`Expected 200, got ${res.status}`);
    });

    await assertTest('ADMIN 5: Subjects → ALLOWED (200 OK)', async () => {
      const res = await request(app)
        .get('/api/admin/subjects')
        .set('Authorization', `Bearer ${adminToken}`);
      if (res.status !== 200) throw new Error(`Expected 200, got ${res.status}`);
    });

    await assertTest('ADMIN 6: Assignments → ALLOWED (200 OK)', async () => {
      const res = await request(app)
        .get('/api/admin/staff/assignments')
        .set('Authorization', `Bearer ${adminToken}`);
      if (res.status !== 200) throw new Error(`Expected 200, got ${res.status}`);
    });

    await assertTest('ADMIN 7: Marks → ALLOWED (200 OK)', async () => {
      const res = await request(app)
        .get(`/api/admin/marks/template?sectionId=${assignedSectionId}&subjectId=${assignedSubjectId}`)
        .set('Authorization', `Bearer ${adminToken}`);
      if (res.status !== 200) throw new Error(`Expected 200, got ${res.status}`);
    });

    await assertTest('ADMIN 8: Performance → ALLOWED (200 OK)', async () => {
      const res = await request(app)
        .get('/api/admin/analytics/performance/overview')
        .set('Authorization', `Bearer ${adminToken}`);
      if (res.status !== 200) throw new Error(`Expected 200, got ${res.status}`);
    });

    await assertTest('ADMIN 9: Section Analytics → ALLOWED (200 OK)', async () => {
      const res = await request(app)
        .get(`/api/admin/analytics/sections?sectionId=${assignedSectionId}`)
        .set('Authorization', `Bearer ${adminToken}`);
      if (res.status !== 200) throw new Error(`Expected 200, got ${res.status}`);
    });

    await assertTest('ADMIN 10: Year Analytics → ALLOWED (200 OK)', async () => {
      const res = await request(app)
        .get('/api/admin/analytics/years')
        .set('Authorization', `Bearer ${adminToken}`);
      if (res.status !== 200) throw new Error(`Expected 200, got ${res.status}`);
    });

    await assertTest('ADMIN 11: Department Analytics → ALLOWED (200 OK)', async () => {
      const res = await request(app)
        .get('/api/admin/analytics/departments')
        .set('Authorization', `Bearer ${adminToken}`);
      if (res.status !== 200) throw new Error(`Expected 200, got ${res.status}`);
    });

    await assertTest('ADMIN 12: College Analytics → ALLOWED (200 OK)', async () => {
      const res = await request(app)
        .get('/api/admin/analytics/overall')
        .set('Authorization', `Bearer ${adminToken}`);
      if (res.status !== 200) throw new Error(`Expected 200, got ${res.status}`);
    });

    await assertTest('ADMIN 13: Reports → ALLOWED (200 OK)', async () => {
      const res = await request(app)
        .get('/api/admin/reports/overall-college?format=json')
        .set('Authorization', `Bearer ${adminToken}`);
      if (res.status !== 200) throw new Error(`Expected 200, got ${res.status}`);
    });

    await assertTest('ADMIN 14: College Notices → ALLOWED (200 OK)', async () => {
      const res = await request(app)
        .get('/api/admin/notices')
        .set('Authorization', `Bearer ${adminToken}`);
      if (res.status !== 200) throw new Error(`Expected 200, got ${res.status}`);
    });

    await assertTest('ADMIN 15: Notifications → ALLOWED (200 OK)', async () => {
      const res = await request(app)
        .get('/api/admin/notifications/history')
        .set('Authorization', `Bearer ${adminToken}`);
      if (res.status !== 200) throw new Error(`Expected 200, got ${res.status}`);
    });

    await assertTest('ADMIN 16: Audit Logs → ALLOWED (200 OK)', async () => {
      const res = await request(app)
        .get('/api/admin/audit-logs')
        .set('Authorization', `Bearer ${adminToken}`);
      if (res.status !== 200) throw new Error(`Expected 200, got ${res.status}`);
    });

    await assertTest('ADMIN 17: Mark History → ALLOWED (200 OK)', async () => {
      const res = await request(app)
        .get('/api/admin/audit-logs/mark-changes')
        .set('Authorization', `Bearer ${adminToken}`);
      if (res.status !== 200) throw new Error(`Expected 200, got ${res.status}`);
    });

    await assertTest('ADMIN 18: Settings → ALLOWED (200 OK)', async () => {
      const res = await request(app)
        .get('/api/admin/settings')
        .set('Authorization', `Bearer ${adminToken}`);
      if (res.status !== 200) throw new Error(`Expected 200, got ${res.status}`);
      if (!res.body.settings || !res.body.settings.institutionName) {
        throw new Error('Settings object missing institutionName');
      }
    });

    // ========================================================
    // SUITE 2: STAFF PERMISSIONS (ALL 6 ALLOWED CAPABILITIES)
    // ========================================================
    console.log('\n--- SUITE 2: Staff Permissions Verification (All 6 Items Allowed) ---');

    await assertTest('STAFF 1: Login → ALLOWED (200 OK)', async () => {
      const res = await request(app)
        .post('/api/auth/login')
        .send({ email: 'sarah.cse@college.edu', password: 'staff123' });
      if (res.status !== 200 || !res.body.token) throw new Error(`Expected 200, got ${res.status}`);
    });

    await assertTest('STAFF 2: Assigned Classes → ALLOWED (200 OK)', async () => {
      const res = await request(app)
        .get('/api/staff/assigned-classes')
        .set('Authorization', `Bearer ${staffToken}`);
      if (res.status !== 200) throw new Error(`Expected 200, got ${res.status}`);
      if (!Array.isArray(res.body.assignedClasses)) throw new Error('Expected assignedClasses array');
    });

    await assertTest('STAFF 3: Assigned Subjects → ALLOWED (200 OK)', async () => {
      const res = await request(app)
        .get('/api/staff/subjects')
        .set('Authorization', `Bearer ${staffToken}`);
      if (res.status !== 200) throw new Error(`Expected 200, got ${res.status}`);
      if (!Array.isArray(res.body.subjects)) throw new Error('Expected subjects array');
    });

    await assertTest('STAFF 4: Marks Upload → ALLOWED (200 OK for assigned class)', async () => {
      const res = await request(app)
        .get(`/api/staff/marks/template?sectionId=${assignedSectionId}&subjectId=${assignedSubjectId}`)
        .set('Authorization', `Bearer ${staffToken}`);
      if (res.status !== 200) throw new Error(`Expected 200, got ${res.status}`);
    });

    await assertTest('STAFF 5: Assigned Marks Management → ALLOWED (200 OK for assigned class)', async () => {
      const res = await request(app)
        .get(`/api/staff/marks?sectionId=${assignedSectionId}&subjectId=${assignedSubjectId}`)
        .set('Authorization', `Bearer ${staffToken}`);
      if (res.status !== 200) throw new Error(`Expected 200, got ${res.status}`);
      if (!Array.isArray(res.body.students)) throw new Error('Expected students array');
    });

    await assertTest('STAFF 6: Limited Assigned Performance → ALLOWED (200 OK for assigned section)', async () => {
      const res = await request(app)
        .get(`/api/staff/analytics/section?sectionId=${assignedSectionId}&subjectId=${assignedSubjectId}`)
        .set('Authorization', `Bearer ${staffToken}`);
      if (res.status !== 200) throw new Error(`Expected 200, got ${res.status}`);
      if (!res.body.summary) throw new Error('Expected summary in section performance');
    });

    // ========================================================
    // SUITE 3: STAFF RESTRICTIONS (ALL 14 DENIED CAPABILITIES)
    // ========================================================
    console.log('\n--- SUITE 3: Staff Restrictions Verification (All 14 Items DENIED with 403) ---');

    const deniedEndpoints = [
      { num: 1, name: 'Academic structure', url: '/api/admin/academic-structure/overview' },
      { num: 2, name: 'Student management', url: '/api/admin/students' },
      { num: 3, name: 'Parent management', url: '/api/admin/parents' },
      { num: 4, name: 'Staff management', url: '/api/admin/staff' },
      { num: 5, name: 'Teacher assignments', url: '/api/admin/staff/assignments' },
      { num: 6, name: 'College analytics', url: '/api/admin/analytics/overall' },
      { num: 7, name: 'Department analytics', url: '/api/admin/analytics/departments' },
      { num: 8, name: 'Year analytics', url: '/api/admin/analytics/years' },
      { num: 9, name: 'Reports', url: '/api/admin/reports/overall-college' },
      { num: 10, name: 'College notices', url: '/api/admin/notices' },
      { num: 11, name: 'Notification history', url: '/api/admin/notifications/history' },
      { num: 12, name: 'Audit logs', url: '/api/admin/audit-logs' },
      { num: 13, name: 'Mark history', url: '/api/admin/audit-logs/mark-changes' },
      { num: 14, name: 'Settings', url: '/api/admin/settings' }
    ];

    for (const d of deniedEndpoints) {
      await assertTest(`STAFF DENIED ${d.num}: ${d.name} → DENIED (403 Forbidden)`, async () => {
        const res = await request(app)
          .get(d.url)
          .set('Authorization', `Bearer ${staffToken}`);

        if (res.status !== 403) {
          throw new Error(`Expected 403 Forbidden, got HTTP ${res.status}: ${JSON.stringify(res.body)}`);
        }
      });
    }

    // ========================================================
    // SUITE 4: THE 8 TAMPER & MANIPULATION ATTACK TESTS
    // ========================================================
    console.log('\n--- SUITE 4: The 8 Tamper & Manipulation Attack Tests ---');

    if (unassignedSection) {
      await assertTest('Attack 1: Staff changing sectionId to an unassigned section → 403 Forbidden', async () => {
        const res = await request(app)
          .get(`/api/staff/marks?sectionId=${unassignedSection.id}&subjectId=${assignedSubjectId}`)
          .set('Authorization', `Bearer ${staffToken}`);

        if (res.status !== 403) throw new Error(`Expected 403, got ${res.status}`);
        if (res.body.code !== 'STAFF_CLASS_UNAUTHORIZED') {
          throw new Error(`Expected STAFF_CLASS_UNAUTHORIZED, got: ${res.body.code}`);
        }
      });
    }

    if (unassignedSubject) {
      await assertTest('Attack 2: Staff changing subjectId to an unassigned subject → 403 Forbidden', async () => {
        const res = await request(app)
          .get(`/api/staff/marks?sectionId=${assignedSectionId}&subjectId=${unassignedSubject.id}`)
          .set('Authorization', `Bearer ${staffToken}`);

        if (res.status !== 403) throw new Error(`Expected 403, got ${res.status}`);
        if (res.body.code !== 'STAFF_CLASS_UNAUTHORIZED') {
          throw new Error(`Expected STAFF_CLASS_UNAUTHORIZED, got: ${res.body.code}`);
        }
      });
    }

    if (otherDepartment) {
      await assertTest('Attack 3: Staff changing departmentId / querying other department marks → 403 Forbidden', async () => {
        // Find a section in another department
        const otherDeptSection = await prisma.section.findFirst({
          where: { departmentId: otherDepartment.id },
          include: { department: true }
        });
        if (otherDeptSection) {
          const res = await request(app)
            .get(`/api/staff/marks?sectionId=${otherDeptSection.id}&subjectId=${assignedSubjectId}`)
            .set('Authorization', `Bearer ${staffToken}`);

          if (res.status !== 403) throw new Error(`Expected 403, got ${res.status}`);
        }
      });
    }

    await assertTest('Attack 4: Staff changing academicYearId to unassigned term → 403 Forbidden', async () => {
      const fakeYearId = otherAcademicYear?.id || '11111111-2222-3333-4444-555555555555';
      const res = await request(app)
        .get(`/api/staff/marks?sectionId=${assignedSectionId}&subjectId=${assignedSubjectId}&academicYearId=${fakeYearId}`)
        .set('Authorization', `Bearer ${staffToken}`);

      if (res.status !== 403) throw new Error(`Expected 403, got ${res.status}`);
      if (res.body.code !== 'STAFF_CLASS_UNAUTHORIZED') {
        throw new Error(`Expected STAFF_CLASS_UNAUTHORIZED, got: ${res.body.code}`);
      }
    });


    await assertTest('Attack 5: Staff calling Admin analytics API → 403 Forbidden', async () => {
      const res = await request(app)
        .get('/api/admin/analytics/overall')
        .set('Authorization', `Bearer ${staffToken}`);

      if (res.status !== 403) throw new Error(`Expected 403, got ${res.status}`);
    });

    await assertTest('Attack 6: Staff calling Notification dispatches & history APIs → 403 Forbidden', async () => {
      const res1 = await request(app)
        .post('/api/admin/notifications/send-performance')
        .set('Authorization', `Bearer ${staffToken}`)
        .send({ studentId: 'dummy-id' });

      if (res1.status !== 403) throw new Error(`Expected 403, got ${res1.status}`);

      const res2 = await request(app)
        .get('/api/admin/notifications/history')
        .set('Authorization', `Bearer ${staffToken}`);

      if (res2.status !== 403) throw new Error(`Expected 403, got ${res2.status}`);
    });

    await assertTest('Attack 7: Staff calling College Notice creation & publish APIs → 403 Forbidden', async () => {
      const res1 = await request(app)
        .post('/api/admin/notices')
        .set('Authorization', `Bearer ${staffToken}`)
        .send({ title: 'Hacked Notice', content: 'Unauthorized', category: 'GENERAL' });

      if (res1.status !== 403) throw new Error(`Expected 403, got ${res1.status}`);

      const res2 = await request(app)
        .get('/api/admin/notices')
        .set('Authorization', `Bearer ${staffToken}`);

      if (res2.status !== 403) throw new Error(`Expected 403, got ${res2.status}`);
    });

    await assertTest('Attack 8: Staff accessing another Staff member’s assignment → 403 Forbidden', async () => {
      // Try to view another staff's assignments on admin endpoint
      const otherStaff = await prisma.user.findFirst({
        where: { role: 'STAFF', id: { not: staffUser.id } }
      });

      if (otherStaff) {
        const res = await request(app)
          .get(`/api/admin/staff/${otherStaff.id}/assignments`)
          .set('Authorization', `Bearer ${staffToken}`);

        if (res.status !== 403) throw new Error(`Expected 403, got ${res.status}`);
      }

      // Try to reassign another teacher's class
      const resAssign = await request(app)
        .post('/api/admin/staff/assignments')
        .set('Authorization', `Bearer ${staffToken}`)
        .send({
          staffId: staffUser.id,
          sectionId: unassignedSection?.id,
          subjectId: assignedSubjectId,
          academicYearId: assignedAcademicYearId,
          departmentId: assignedDepartmentId,
          yearId: assignedAssignment.section.yearId
        });

      if (resAssign.status !== 403) throw new Error(`Expected 403, got ${resAssign.status}`);
    });

    // ========================================================
    // SUITE 5: ZERO INFORMATION LEAK PREVENTION
    // ========================================================
    console.log('\n--- SUITE 5: Zero Sensitive Information Leak Prevention ---');

    await assertTest('Privacy Guard: Staff marks roster NEVER leaks parentMobile or parentName', async () => {
      const res = await request(app)
        .get(`/api/staff/marks?sectionId=${assignedSectionId}&subjectId=${assignedSubjectId}`)
        .set('Authorization', `Bearer ${staffToken}`);

      if (res.status !== 200) throw new Error(`Expected 200, got ${res.status}`);
      const students = res.body.students || [];

      for (const st of students) {
        if (st.parentMobile !== undefined) {
          throw new Error(`CRITICAL PRIVACY BREACH: parentMobile leaked to Staff! Student: ${st.registerNumber}`);
        }
        if (st.parentName !== undefined) {
          throw new Error(`CRITICAL PRIVACY BREACH: parentName leaked to Staff! Student: ${st.registerNumber}`);
        }
      }
    });

    await assertTest('Isolation Guard: Staff assigned-classes returns ONLY assignments for Sarah', async () => {
      const res = await request(app)
        .get('/api/staff/assigned-classes')
        .set('Authorization', `Bearer ${staffToken}`);

      if (res.status !== 200) throw new Error(`Expected 200, got ${res.status}`);
      const list = res.body.assignedClasses || [];

      for (const item of list) {
        if (item.staffId && item.staffId !== staffUser.id) {
          throw new Error(`CRITICAL ISOLATION BREACH: Another staff member assignment leaked! Found staffId: ${item.staffId}`);
        }
      }
    });

    await assertTest('Defense-in-depth: Probing governance resources on /api/staff/* returns 403 Forbidden', async () => {
      const staffProbes = [
        '/api/staff/parents',
        '/api/staff/students',
        '/api/staff/staff',
        '/api/staff/notices',
        '/api/staff/notifications',
        '/api/staff/audit-logs',
        '/api/staff/settings',
        '/api/staff/academic-structure'
      ];

      for (const probeUrl of staffProbes) {
        const res = await request(app)
          .get(probeUrl)
          .set('Authorization', `Bearer ${staffToken}`);

        if (res.status !== 403) {
          throw new Error(`Expected 403 for probe ${probeUrl}, got HTTP ${res.status}`);
        }
      }
    });

    // ----------------------------------------------------
    // TEST SUMMARY
    // ----------------------------------------------------
    console.log('\n================================================================');
    console.log(` RBAC & SECURITY MATRIX COMPLETE: ${passedTests} PASSED | ${failedTests} FAILED`);
    console.log('================================================================\n');

    if (failedTests > 0) {
      process.exit(1);
    }
  } catch (error) {
    console.error('Fatal test error:', error);
    process.exit(1);
  }
}

runSecurityAndRbacMatrixTests();
