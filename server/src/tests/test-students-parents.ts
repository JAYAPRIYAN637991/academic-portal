import request from 'supertest';
import { createApp } from '../server';
import { prisma } from '../db';

async function runStudentParentTests() {
  console.log('🧪 Starting Admin-Only Student and Parent Management Test Suite...\n');
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

    // Fetch prerequisite entities
    const cseDept = await prisma.department.findUnique({ where: { code: 'CSE' } });
    const yr3 = await prisma.year.findFirst({ where: { yearNumber: 3 } });
    const acadYear = await prisma.academicYear.findFirst({ where: { isCurrent: true } });
    const secA = await prisma.section.findFirst({
      where: { name: 'A', departmentId: cseDept!.id, yearId: yr3!.id, academicYearId: acadYear!.id }
    });
    const dbmsSubject = await prisma.subject.findUnique({ where: { code: 'CS8501' } });

    // ========================================================
    // SECTION 1: STAFF RESTRICTION & PARENT DATA PRIVACY
    // ========================================================
    await assertTest('Staff attempting to access Admin Students API → 403 Forbidden', async () => {
      const res = await request(app)
        .get('/api/admin/students')
        .set('Authorization', `Bearer ${staffToken}`);
      if (res.status !== 403) throw new Error(`Expected 403, got ${res.status}`);
      if (res.body.code !== 'ADMIN_ACCESS_REQUIRED') throw new Error(`Expected ADMIN_ACCESS_REQUIRED, got ${res.body.code}`);
    });

    await assertTest('Staff attempting to create a Student → 403 Forbidden', async () => {
      const res = await request(app)
        .post('/api/admin/students')
        .set('Authorization', `Bearer ${staffToken}`)
        .send({ name: 'Hacked Student' });
      if (res.status !== 403) throw new Error(`Expected 403, got ${res.status}`);
    });

    await assertTest('Staff viewing marks entry roster → parentName & parentMobile are STRICTLY EXCLUDED', async () => {
      const res = await request(app)
        .get(`/api/staff/marks?sectionId=${secA!.id}&subjectId=${dbmsSubject!.id}`)
        .set('Authorization', `Bearer ${staffToken}`);
      if (res.status !== 200) throw new Error(`Expected 200, got ${res.status}`);
      if (!res.body.students || res.body.students.length === 0) throw new Error('No students returned');

      for (const student of res.body.students) {
        if (student.parentMobile !== undefined) {
          throw new Error(`SECURITY LEAK: parentMobile was returned to Staff! Value: ${student.parentMobile}`);
        }
        if (student.parentName !== undefined) {
          throw new Error(`SECURITY LEAK: parentName was returned to Staff! Value: ${student.parentName}`);
        }
      }
    });

    await assertTest('Unauthenticated access to Students API → 401 Unauthorized', async () => {
      const res = await request(app).get('/api/admin/students');
      if (res.status !== 401) throw new Error(`Expected 401, got ${res.status}`);
    });

    // ========================================================
    // SECTION 2: VALIDATION RULES (MOBILE, DUPLICATE REG, STRUCTURE)
    // ========================================================
    await assertTest('Validation: Invalid parent mobile number format → 400 Bad Request', async () => {
      const res = await request(app)
        .post('/api/admin/students')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          registerNumber: '2025CSE999',
          name: 'Test Student',
          academicYearId: acadYear!.id,
          departmentId: cseDept!.id,
          yearId: yr3!.id,
          sectionId: secA!.id,
          parentName: 'Parent Test',
          parentMobile: '12345' // Too short
        });
      if (res.status !== 400) throw new Error(`Expected 400, got ${res.status}`);
      if (res.body.code !== 'INVALID_MOBILE_NUMBER') throw new Error(`Expected INVALID_MOBILE_NUMBER, got ${res.body.code}`);
    });

    await assertTest('Validation: Missing academic structure → 400 Bad Request', async () => {
      const res = await request(app)
        .post('/api/admin/students')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          registerNumber: '2025CSE999',
          name: 'Test Student',
          academicYearId: 'non-existent-acad-id',
          departmentId: cseDept!.id,
          yearId: yr3!.id,
          sectionId: secA!.id,
          parentName: 'Parent Test',
          parentMobile: '9876543210'
        });
      if (res.status !== 400) throw new Error(`Expected 400, got ${res.status}`);
      if (res.body.code !== 'ACADEMIC_STRUCTURE_NOT_FOUND') throw new Error(`Expected ACADEMIC_STRUCTURE_NOT_FOUND, got ${res.body.code}`);
    });

    // ========================================================
    // SECTION 3: ADMIN STUDENT & PARENT CRUD & DETAILS
    // ========================================================
    let createdStudentId = '';
    await assertTest('Admin creates student with valid parent name & mobile number', async () => {
      const res = await request(app)
        .post('/api/admin/students')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          registerNumber: '2025CSE010',
          name: 'Aditya Kumar',
          academicYearId: acadYear!.id,
          departmentId: cseDept!.id,
          yearId: yr3!.id,
          sectionId: secA!.id,
          parentName: 'Ramesh Kumar',
          parentMobile: '+919876543210',
          status: 'ACTIVE'
        });
      if (res.status !== 201) throw new Error(`Status ${res.status}: ${res.body.error}`);
      if (res.body.student.registerNumber !== '2025CSE010') throw new Error('Mismatch registerNumber');
      if (res.body.student.parentMobile !== '+919876543210') throw new Error('Mismatch parentMobile');
      createdStudentId = res.body.student.id;
    });

    await assertTest('Validation: Duplicate register number in same academic year → 409 Conflict', async () => {
      const res = await request(app)
        .post('/api/admin/students')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          registerNumber: '2025CSE010', // Duplicate!
          name: 'Another Student',
          academicYearId: acadYear!.id,
          departmentId: cseDept!.id,
          yearId: yr3!.id,
          sectionId: secA!.id,
          parentName: 'Another Parent',
          parentMobile: '9123456780'
        });
      if (res.status !== 409) throw new Error(`Expected 409, got ${res.status}`);
      if (res.body.code !== 'DUPLICATE_REGISTER_NUMBER') throw new Error(`Expected DUPLICATE_REGISTER_NUMBER, got ${res.body.code}`);
    });

    await assertTest('Admin views full student details including protected parent contact', async () => {
      const res = await request(app)
        .get(`/api/admin/students/${createdStudentId}`)
        .set('Authorization', `Bearer ${adminToken}`);
      if (res.status !== 200) throw new Error(`Status ${res.status}`);
      if (res.body.student.parentMobile !== '+919876543210') throw new Error('Missing or mismatch parentMobile');
      if (res.body.student.parentName !== 'Ramesh Kumar') throw new Error('Missing or mismatch parentName');
    });

    await assertTest('Admin edits student parent name and mobile number', async () => {
      const res = await request(app)
        .put(`/api/admin/students/${createdStudentId}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          parentName: 'Ramesh Kumar Sharma',
          parentMobile: '+919988776655'
        });
      if (res.status !== 200) throw new Error(`Status ${res.status}: ${res.body.error}`);
      if (res.body.student.parentName !== 'Ramesh Kumar Sharma') throw new Error('Parent name was not updated');
      if (res.body.student.parentMobile !== '+919988776655') throw new Error('Parent mobile was not updated');
    });

    await assertTest('Admin searches student by name "Aditya" and by register number "2025CSE010"', async () => {
      const resName = await request(app)
        .get('/api/admin/students?search=Aditya')
        .set('Authorization', `Bearer ${adminToken}`);
      if (resName.status !== 200 || !resName.body.students.some((s: any) => s.id === createdStudentId)) {
        throw new Error('Search by name failed');
      }

      const resReg = await request(app)
        .get('/api/admin/students?search=2025CSE010')
        .set('Authorization', `Bearer ${adminToken}`);
      if (resReg.status !== 200 || !resReg.body.students.some((s: any) => s.id === createdStudentId)) {
        throw new Error('Search by register number failed');
      }
    });

    await assertTest('Admin filters students by dependent academic structure (Dept + Year + Section)', async () => {
      const res = await request(app)
        .get(`/api/admin/students?departmentId=${cseDept!.id}&yearId=${yr3!.id}&sectionId=${secA!.id}`)
        .set('Authorization', `Bearer ${adminToken}`);
      if (res.status !== 200) throw new Error(`Status ${res.status}`);
      if (!res.body.students.some((s: any) => s.id === createdStudentId)) {
        throw new Error('Filtered list does not contain created student');
      }
    });

    await assertTest('Admin deactivates student (toggle status to INACTIVE)', async () => {
      const res = await request(app)
        .patch(`/api/admin/students/${createdStudentId}/status`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ status: 'INACTIVE' });
      if (res.status !== 200) throw new Error(`Status ${res.status}`);
      if (res.body.student.status !== 'INACTIVE') throw new Error('Expected status INACTIVE');
    });

    await assertTest('Admin deletes unreferenced student record', async () => {
      const res = await request(app)
        .delete(`/api/admin/students/${createdStudentId}`)
        .set('Authorization', `Bearer ${adminToken}`);
      if (res.status !== 200) throw new Error(`Status ${res.status}: ${res.body.error}`);
    });

  } catch (err: any) {
    console.error('Fatal error during test run:', err);
  } finally {
    await prisma.$disconnect();
    console.log('\n======================================================');
    console.log(`🏁 Student & Parent Suite: ${passed} PASSED | ${failed} FAILED`);
    console.log('======================================================\n');
    if (failed > 0) process.exit(1);
    else process.exit(0);
  }
}

runStudentParentTests();
