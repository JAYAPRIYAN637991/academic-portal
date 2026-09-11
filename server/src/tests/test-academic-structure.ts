import request from 'supertest';
import { createApp } from '../server';
import { prisma } from '../db';

async function runAcademicStructureTests() {
  console.log('🧪 Starting Admin-Only Academic Structure Management Test Suite...\n');
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

  const cleanup = async () => {
    try {
      await prisma.section.deleteMany({
        where: { name: 'C', department: { code: 'CSE' } }
      });
      await prisma.department.deleteMany({
        where: { code: 'AIDS' }
      });
      await prisma.academicYear.deleteMany({
        where: { yearName: { in: ['2026-2027', '2026-2027 (Upcoming)'] } }
      });
    } catch (_) {}
  };

  try {
    await cleanup();

    // 1. Authenticate Admin and Staff to obtain JWT tokens
    const adminLogin = await request(app)
      .post('/api/auth/login')
      .send({ email: 'admin@college.edu', password: 'admin123' });
    const adminToken = adminLogin.body.token;

    const staffLogin = await request(app)
      .post('/api/auth/login')
      .send({ email: 'sarah.cse@college.edu', password: 'staff123' });
    const staffToken = staffLogin.body.token;

    // ========================================================
    // SECTION 1: STAFF & UNAUTHENTICATED RESTRICTION (403 / 401)
    // ========================================================
    await assertTest('Staff accessing Academic Years API → 403 Forbidden', async () => {
      const res = await request(app)
        .get('/api/admin/academic-years')
        .set('Authorization', `Bearer ${staffToken}`);
      if (res.status !== 403) throw new Error(`Expected 403, got ${res.status}`);
      if (res.body.code !== 'ADMIN_ACCESS_REQUIRED') throw new Error(`Expected code ADMIN_ACCESS_REQUIRED, got ${res.body.code}`);
    });

    await assertTest('Staff attempting to create a Department → 403 Forbidden', async () => {
      const res = await request(app)
        .post('/api/admin/departments')
        .set('Authorization', `Bearer ${staffToken}`)
        .send({ code: 'CIVIL', name: 'Civil Engineering' });
      if (res.status !== 403) throw new Error(`Expected 403, got ${res.status}`);
    });

    await assertTest('Staff attempting to delete a Section → 403 Forbidden', async () => {
      const res = await request(app)
        .delete('/api/admin/sections/dummy-id')
        .set('Authorization', `Bearer ${staffToken}`);
      if (res.status !== 403) throw new Error(`Expected 403, got ${res.status}`);
    });

    await assertTest('Unauthenticated request to Academic Structure → 401 Unauthorized', async () => {
      const res = await request(app).get('/api/admin/academic-structure/overview');
      if (res.status !== 401) throw new Error(`Expected 401, got ${res.status}`);
    });

    // ========================================================
    // SECTION 2: ADMIN ACADEMIC STRUCTURE OVERVIEW & DROPDOWNS
    // ========================================================
    await assertTest('Admin fetches Academic Structure Overview with stats & dropdown options', async () => {
      const res = await request(app)
        .get('/api/admin/academic-structure/overview')
        .set('Authorization', `Bearer ${adminToken}`);
      if (res.status !== 200) throw new Error(`Status ${res.status}`);
      if (!Array.isArray(res.body.academicYears)) throw new Error('academicYears missing');
      if (!Array.isArray(res.body.departments)) throw new Error('departments missing');
      if (!Array.isArray(res.body.years)) throw new Error('years missing');
      if (typeof res.body.stats.totalSections !== 'number') throw new Error('totalSections missing');
    });

    // ========================================================
    // SECTION 3: ACADEMIC YEARS (CREATE, EDIT, TOGGLE, SEARCH)
    // ========================================================
    let createdYearId = '';
    await assertTest('Admin creates new Academic Year (2026-2027)', async () => {
      const res = await request(app)
        .post('/api/admin/academic-years')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ yearName: '2026-2027', isCurrent: false, isActive: true });
      if (res.status !== 201) throw new Error(`Status ${res.status}: ${res.body.error}`);
      if (res.body.academicYear.yearName !== '2026-2027') throw new Error('Mismatch yearName');
      createdYearId = res.body.academicYear.id;
    });

    await assertTest('Admin searches Academic Years by query "2026"', async () => {
      const res = await request(app)
        .get('/api/admin/academic-years?search=2026')
        .set('Authorization', `Bearer ${adminToken}`);
      if (res.status !== 200) throw new Error(`Status ${res.status}`);
      const found = res.body.academicYears.some((y: any) => y.yearName === '2026-2027');
      if (!found) throw new Error('Did not find 2026-2027 in search results');
    });

    await assertTest('Admin deactivates Academic Year (safe status toggle)', async () => {
      const res = await request(app)
        .patch(`/api/admin/academic-years/${createdYearId}/status`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ isActive: false });
      if (res.status !== 200) throw new Error(`Status ${res.status}`);
      if (res.body.academicYear.isActive !== false) throw new Error('Expected isActive === false');
    });

    await assertTest('Admin edits Academic Year name & reactivates', async () => {
      const res = await request(app)
        .put(`/api/admin/academic-years/${createdYearId}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ yearName: '2026-2027 (Upcoming)', isActive: true });
      if (res.status !== 200) throw new Error(`Status ${res.status}`);
      if (res.body.academicYear.yearName !== '2026-2027 (Upcoming)') throw new Error('Expected updated name');
      if (res.body.academicYear.isActive !== true) throw new Error('Expected isActive === true');
    });

    // ========================================================
    // SECTION 4: DEPARTMENTS (CREATE, SEARCH, FILTER, TOGGLE)
    // ========================================================
    let createdDeptId = '';
    await assertTest('Admin creates new Department (AI&DS)', async () => {
      const res = await request(app)
        .post('/api/admin/departments')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ code: 'AIDS', name: 'Artificial Intelligence and Data Science' });
      if (res.status !== 201) throw new Error(`Status ${res.status}: ${res.body.error}`);
      if (res.body.department.code !== 'AIDS') throw new Error('Code mismatch');
      createdDeptId = res.body.department.id;
    });

    await assertTest('Admin searches Departments with keyword "Intelligence"', async () => {
      const res = await request(app)
        .get('/api/admin/departments?search=Intelligence')
        .set('Authorization', `Bearer ${adminToken}`);
      if (res.status !== 200) throw new Error(`Status ${res.status}`);
      if (!res.body.departments.some((d: any) => d.code === 'AIDS')) throw new Error('Department not found in search');
    });

    await assertTest('Admin toggles Department status to Inactive', async () => {
      const res = await request(app)
        .patch(`/api/admin/departments/${createdDeptId}/status`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ isActive: false });
      if (res.status !== 200) throw new Error(`Status ${res.status}`);
      if (res.body.department.isActive !== false) throw new Error('Expected inactive');
    });

    // ========================================================
    // SECTION 5: SECTIONS & DEPENDENT FILTERING
    // ========================================================
    const cseDept = await prisma.department.findUnique({ where: { code: 'CSE' } });
    const yr3 = await prisma.year.findFirst({ where: { yearNumber: 3 } });
    const activeAcadYear = await prisma.academicYear.findFirst({ where: { isCurrent: true } });

    let createdSectionId = '';
    await assertTest('Admin creates Section C for CSE Year 3', async () => {
      const res = await request(app)
        .post('/api/admin/sections')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          name: 'C',
          departmentId: cseDept!.id,
          yearId: yr3!.id,
          academicYearId: activeAcadYear!.id,
          isActive: true
        });
      if (res.status !== 201) throw new Error(`Status ${res.status}: ${res.body.error}`);
      if (res.body.section.name !== 'C') throw new Error('Section name mismatch');
      createdSectionId = res.body.section.id;
    });

    await assertTest('Admin filters Sections with dependent params (AcademicYear + Dept + Year)', async () => {
      const res = await request(app)
        .get(`/api/admin/sections?academicYearId=${activeAcadYear!.id}&departmentId=${cseDept!.id}&yearId=${yr3!.id}`)
        .set('Authorization', `Bearer ${adminToken}`);
      if (res.status !== 200) throw new Error(`Status ${res.status}`);
      const secNames = res.body.sections.map((s: any) => s.name);
      if (!secNames.includes('A') || !secNames.includes('C')) {
        throw new Error(`Expected A and C in filtered sections, got: ${secNames.join(', ')}`);
      }
    });

    // ========================================================
    // SECTION 6: REFERENCE-CHECKED DELETION & SAFE DEACTIVATION
    // ========================================================
    await assertTest('Admin attempting to DELETE referenced Department (CSE) → 409 Conflict (Protected)', async () => {
      const res = await request(app)
        .delete(`/api/admin/departments/${cseDept!.id}`)
        .set('Authorization', `Bearer ${adminToken}`);
      if (res.status !== 409) throw new Error(`Expected 409 Conflict, got ${res.status}`);
      if (res.body.code !== 'CANNOT_DELETE_REFERENCED_RECORD') {
        throw new Error(`Expected CANNOT_DELETE_REFERENCED_RECORD, got ${res.body.code}`);
      }
      if (!res.body.recommendation.includes('safe deactivation')) {
        throw new Error('Expected safe deactivation recommendation in error response');
      }
    });

    await assertTest('Admin safely deactivates referenced Department (CSE) instead of deleting → 200 OK', async () => {
      const res = await request(app)
        .patch(`/api/admin/departments/${cseDept!.id}/status`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ isActive: false });
      if (res.status !== 200) throw new Error(`Status ${res.status}`);
      if (res.body.department.isActive !== false) throw new Error('Expected deactivated');

      // Re-activate so other system operations continue normally
      await request(app)
        .patch(`/api/admin/departments/${cseDept!.id}/status`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ isActive: true });
    });

    await assertTest('Admin deletes UNREFERENCED Section C → 200 OK (Allowed)', async () => {
      const res = await request(app)
        .delete(`/api/admin/sections/${createdSectionId}`)
        .set('Authorization', `Bearer ${adminToken}`);
      if (res.status !== 200) throw new Error(`Status ${res.status}: ${res.body.error}`);
    });

    await assertTest('Admin deletes UNREFERENCED Department AIDS → 200 OK (Allowed)', async () => {
      const res = await request(app)
        .delete(`/api/admin/departments/${createdDeptId}`)
        .set('Authorization', `Bearer ${adminToken}`);
      if (res.status !== 200) throw new Error(`Status ${res.status}: ${res.body.error}`);
    });

    await assertTest('Admin deletes UNREFERENCED Academic Year → 200 OK (Allowed)', async () => {
      const res = await request(app)
        .delete(`/api/admin/academic-years/${createdYearId}`)
        .set('Authorization', `Bearer ${adminToken}`);
      if (res.status !== 200) throw new Error(`Status ${res.status}: ${res.body.error}`);
    });

  } catch (err: any) {
    console.error('Fatal error during test run:', err);
  } finally {
    await cleanup();
    await prisma.$disconnect();
    console.log('\n======================================================');
    console.log(`🏁 Academic Structure Suite: ${passed} PASSED | ${failed} FAILED`);
    console.log('======================================================\n');
    if (failed > 0) process.exit(1);
    else process.exit(0);
  }
}

runAcademicStructureTests();
