import assert from 'assert';
import request from 'supertest';
import { createApp } from '../server';
import { prisma } from '../db.js';

const app = createApp();

async function runTests() {
  console.log('================================================================');
  console.log('🧪 TEST SUITE: Faculty Subject, Subject Code & Semester Assignment');
  console.log('================================================================\n');

  let passed = 0;
  let failed = 0;

  async function test(name: string, fn: () => Promise<void>) {
    try {
      await fn();
      console.log(`  ✓ PASS: ${name}`);
      passed++;
    } catch (err: any) {
      console.error(`  ✗ FAIL: ${name}`);
      console.error(`    Error: ${err.message}`);
      failed++;
    }
  }

  // 1. Authenticate Admin and Staff
  console.log('--- 1. Authentication Setup ---');
  let adminToken = '';
  let staffToken = '';
  let staffId = '';
  let staffName = '';

  await test('Admin logs in with default credentials', async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .send({ email: 'admin@college.edu', password: 'admin123' });
    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.body.user.role, 'ADMIN');
    adminToken = res.body.token;
  });

  await test('Staff logs in and obtains token', async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .send({ username: 'Sarah Jenkins', password: 'Sarah@15081988' });
    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.body.user.role, 'STAFF');
    staffToken = res.body.token;
    staffId = res.body.user.id;
    staffName = res.body.user.name;
  });

  // 2. Identify Academic Structure Fixtures
  console.log('\n--- 2. Academic Fixtures Discovery ---');
  let cseDept: any;
  let sem5Subject: any;
  let sem6Subject: any;
  let cseSectionA: any;
  let cseSectionB: any;
  let academicYear: any;

  await test('Load Department, Sem 5/6 Subjects, and Section fixtures', async () => {
    cseDept = await prisma.department.findUnique({ where: { code: 'CSE' } });
    assert.ok(cseDept, 'CSE department must exist');

    academicYear = await prisma.academicYear.findFirst({
      where: { isCurrent: true }
    }) || await prisma.academicYear.findFirst();
    assert.ok(academicYear, 'Academic Year must exist');

    // Find or create Semester 5 subject (e.g. CS8501)
    sem5Subject = await prisma.subject.findFirst({
      where: { departmentId: cseDept.id, semester: 5 }
    });
    if (!sem5Subject) {
      const year3 = await prisma.year.findUnique({ where: { yearNumber: 3 } });
      sem5Subject = await prisma.subject.create({
        data: {
          code: 'CS8501',
          name: 'Database Management Systems',
          departmentId: cseDept.id,
          yearId: year3!.id,
          semester: 5
        }
      });
    }

    // Find or create Semester 6 subject (e.g. CS8601)
    sem6Subject = await prisma.subject.findFirst({
      where: { departmentId: cseDept.id, semester: 6 }
    });
    if (!sem6Subject) {
      const year3 = await prisma.year.findUnique({ where: { yearNumber: 3 } });
      sem6Subject = await prisma.subject.create({
        data: {
          code: 'CS8601',
          name: 'Mobile Computing & Cloud Infrastructure',
          departmentId: cseDept.id,
          yearId: year3!.id,
          semester: 6
        }
      });
    }

    assert.ok(sem5Subject && sem5Subject.code, 'Semester 5 subject exists with code');
    assert.ok(sem6Subject && sem6Subject.code, 'Semester 6 subject exists with code');

    // Section in Year 3
    cseSectionA = await prisma.section.findFirst({
      where: { departmentId: cseDept.id, yearId: sem5Subject.yearId, academicYearId: academicYear.id }
    });
    assert.ok(cseSectionA, 'Section A exists for CSE Year 3');

    console.log(`  Fixtures: Dept=${cseDept.code}, Sem5 Subject=[${sem5Subject.code}] ${sem5Subject.name}, Sem6 Subject=[${sem6Subject.code}] ${sem6Subject.name}`);
  });

  // 3. Admin Assigns Faculty with Dept, Semester & Subject Code
  console.log('\n--- 3. Admin Assigns Faculty with Department, Semester & Subject Code ---');
  let createdAssignmentId = '';

  // Clean up existing assignment for this subject/section/year if any
  await prisma.teacherAssignment.deleteMany({
    where: {
      subjectId: sem5Subject.id,
      sectionId: cseSectionA.id,
      academicYearId: academicYear.id
    }
  });

  await test('Admin assigns faculty to CSE, Semester 5, Subject CS8501', async () => {
    const res = await request(app)
      .post('/api/admin/staff/assignments')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        staffId,
        departmentId: cseDept.id,
        semester: 5,
        subjectId: sem5Subject.id,
        sectionId: cseSectionA.id,
        academicYearId: academicYear.id
      });

    assert.strictEqual(res.status, 201);
    assert.ok(res.body.assignment, 'Must return assignment');
    assert.strictEqual(res.body.assignment.subjectId, sem5Subject.id);
    assert.strictEqual(res.body.assignment.subject.code, sem5Subject.code);
    assert.strictEqual(res.body.assignment.subject.semester, 5);
    createdAssignmentId = res.body.assignment.id;
  });

  await test('GET /api/admin/staff/assignments returns enriched assignment with department, subject code and semester', async () => {
    const res = await request(app)
      .get('/api/admin/staff/assignments')
      .set('Authorization', `Bearer ${adminToken}`);

    assert.strictEqual(res.status, 200);
    const item = res.body.assignments.find((a: any) => a.id === createdAssignmentId);
    assert.ok(item, 'Created assignment must appear in assignments list');
    assert.strictEqual(item.subjectCode, sem5Subject.code);
    assert.strictEqual(item.semester, 5);
    assert.strictEqual(item.departmentCode, 'CSE');
  });

  // 4. Admin Only: Change Subject and Semester After Completed Semester
  console.log('\n--- 4. Admin Changes Faculty Subject and Semester (Semester Completed Transition) ---');

  // Clean up any conflict on target sem6Subject if any
  await prisma.teacherAssignment.deleteMany({
    where: {
      subjectId: sem6Subject.id,
      sectionId: cseSectionA.id,
      academicYearId: academicYear.id
    }
  });

  await test('Admin updates faculty assignment from Semester 5 (CS8501) to Semester 6 (CS8601)', async () => {
    const res = await request(app)
      .put(`/api/admin/staff/assignments/${createdAssignmentId}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        subjectId: sem6Subject.id,
        semester: 6,
        reason: 'Semester 5 completed. Reassigned to Semester 6 curriculum course.'
      });

    assert.strictEqual(res.status, 200);
    assert.ok(res.body.assignment, 'Must return updated assignment');
    assert.strictEqual(res.body.assignment.subjectId, sem6Subject.id);
    assert.strictEqual(res.body.assignment.subjectCode, sem6Subject.code);
    assert.strictEqual(res.body.assignment.subjectName, sem6Subject.name);
    assert.strictEqual(res.body.assignment.semester, 6);
  });

  await test('GET /api/admin/staff/assignments reflects updated course CS8601 and semester 6', async () => {
    const res = await request(app)
      .get('/api/admin/staff/assignments')
      .set('Authorization', `Bearer ${adminToken}`);

    assert.strictEqual(res.status, 200);
    const item = res.body.assignments.find((a: any) => a.id === createdAssignmentId);
    assert.ok(item);
    assert.strictEqual(item.subjectCode, sem6Subject.code);
    assert.strictEqual(item.semester, 6);
  });

  // 5. Staff Dashboard Reflection
  console.log('\n--- 5. Staff Dashboard Dynamic Reflection ---');
  await test('Staff assigned classes & subjects reflect the newly changed subject CS8601', async () => {
    const res = await request(app)
      .get('/api/staff/assigned-classes')
      .set('Authorization', `Bearer ${staffToken}`);

    assert.strictEqual(res.status, 200);
    const classes = res.body.assignedClasses || res.body;
    const hasNewSubject = classes.some((c: any) => c.subject?.code === sem6Subject.code || c.subjectCode === sem6Subject.code);
    assert.ok(hasNewSubject, 'Staff assigned classes must include new subject CS8601');
  });

  // 6. Security & RBAC: Staff CANNOT Change Their Own Course or Semester
  console.log('\n--- 6. Security Enforcement: Admin ONLY Can Change Subject & Semester ---');
  await test('Staff attempting to update assignment is blocked with 403 Forbidden', async () => {
    const res = await request(app)
      .put(`/api/admin/staff/assignments/${createdAssignmentId}`)
      .set('Authorization', `Bearer ${staffToken}`)
      .send({
        subjectId: sem5Subject.id,
        semester: 5
      });

    assert.strictEqual(res.status, 403);
    assert.ok(res.body.code === 'ADMIN_ACCESS_REQUIRED' || res.body.code === 'ADMIN_ONLY_ASSIGNMENT_CHANGE');
  });

  await test('Unauthenticated request to update assignment fails with 401', async () => {
    const res = await request(app)
      .put(`/api/admin/staff/assignments/${createdAssignmentId}`)
      .send({
        subjectId: sem5Subject.id
      });

    assert.strictEqual(res.status, 401);
  });

  // 7. Validation & Error Handling
  console.log('\n--- 7. Input Validation & Error Handling ---');
  await test('Attempting to change to non-existent subject fails with 404', async () => {
    const res = await request(app)
      .put(`/api/admin/staff/assignments/${createdAssignmentId}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        subjectId: 'non-existent-subject-id'
      });

    assert.strictEqual(res.status, 404);
    assert.strictEqual(res.body.code, 'SUBJECT_NOT_FOUND');
  });

  await test('Attempting to assign subject with wrong semester fails with 400', async () => {
    const res = await request(app)
      .put(`/api/admin/staff/assignments/${createdAssignmentId}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        subjectId: sem6Subject.id,
        semester: 3 // Mismatched semester: sem6Subject is semester 6!
      });

    assert.strictEqual(res.status, 400);
    assert.strictEqual(res.body.code, 'SEMESTER_SUBJECT_MISMATCH');
  });

  // 8. Audit Log Verification
  console.log('\n--- 8. Audit Log Recording Verification ---');
  await test('AuditLog records semester completion & subject transition by Admin', async () => {
    const log = await prisma.auditLog.findFirst({
      where: {
        action: 'STAFF_ASSIGNMENT_CHANGED',
        entityId: createdAssignmentId
      },
      orderBy: { createdAt: 'desc' }
    });

    assert.ok(log, 'Audit log record must exist');
    assert.strictEqual((log.metadata as any)?.subAction, 'UPDATE_SUBJECT_SEMESTER');
    assert.strictEqual((log.metadata as any)?.previousSubjectCode, sem5Subject.code);
    assert.strictEqual((log.metadata as any)?.newSubjectCode, sem6Subject.code);
    assert.strictEqual((log.metadata as any)?.previousSemester, 5);
    assert.strictEqual((log.metadata as any)?.newSemester, 6);
  });

  // Teardown: restore Sarah's standard assignment back to CS8501 (Semester 5)
  if (createdAssignmentId) {
    await request(app)
      .put(`/api/admin/staff/assignments/${createdAssignmentId}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        subjectId: sem5Subject.id,
        semester: 5
      });
  }

  console.log('\n================================================================');
  console.log(`🏁 TEST RESULTS: ${passed} PASSED, ${failed} FAILED`);
  console.log('================================================================');

  await prisma.$disconnect();

  if (failed > 0) {
    process.exit(1);
  }
  process.exit(0);
}

runTests().catch(async (err) => {
  console.error('Fatal test error:', err);
  await prisma.$disconnect();
  process.exit(1);
});
