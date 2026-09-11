import request from 'supertest';
import { createApp } from '../server';
import { prisma } from '../db';

async function runTestSuite() {
  console.log('🧪 Starting RBAC Authentication & Authorization Test Suite...\n');
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
    // 0. Fetch seeded IDs
    const cseDept = await prisma.department.findUnique({ where: { code: 'CSE' } });
    const eceDept = await prisma.department.findUnique({ where: { code: 'ECE' } });

    const cse3A = await prisma.section.findFirst({
      where: { name: 'A', departmentId: cseDept!.id }
    });
    const cseSectionAId = cse3A!.id;

    const ece3A = await prisma.section.findFirst({
      where: { name: 'A', departmentId: eceDept!.id }
    });
    const eceSectionAId = ece3A!.id;

    const dbms = await prisma.subject.findUnique({ where: { code: 'CS8501' } });
    const dbmsSubjectId = dbms!.id;

    const toc = await prisma.subject.findUnique({ where: { code: 'CS8502' } });
    const tocSubjectId = toc!.id;

    // Login Admin
    const adminLogin = await request(app)
      .post('/api/auth/login')
      .send({ email: 'admin@college.edu', password: 'admin123' });
    if (adminLogin.status !== 200) throw new Error(`Admin login failed: ${adminLogin.status}`);
    const adminToken = adminLogin.body.token;

    // Login Staff 1 (Sarah)
    const staff1Login = await request(app)
      .post('/api/auth/login')
      .send({ email: 'sarah.cse@college.edu', password: 'staff123' });
    if (staff1Login.status !== 200) throw new Error(`Staff 1 login failed: ${staff1Login.status}`);
    const staff1Token = staff1Login.body.token;

    // 1. Unauthenticated user → 401 Unauthorized
    await assertTest('Unauthenticated user → 401 Unauthorized', async () => {
      const res = await request(app).get('/api/admin/staff');
      if (res.status !== 401) throw new Error(`Expected 401, got ${res.status}`);
      if (res.body.code !== 'TOKEN_MISSING') throw new Error(`Expected code TOKEN_MISSING, got ${res.body.code}`);
    });

    // 2. Admin Login Redirect Check
    await assertTest('Admin Login → role ADMIN & redirectUrl /admin/dashboard', async () => {
      if (adminLogin.body.role !== 'ADMIN') throw new Error(`Expected ADMIN, got ${adminLogin.body.role}`);
      if (adminLogin.body.redirectUrl !== '/admin/dashboard') throw new Error(`Expected /admin/dashboard, got ${adminLogin.body.redirectUrl}`);
    });

    // 3. Staff Login Redirect Check
    await assertTest('Staff Login → role STAFF & redirectUrl /staff/dashboard', async () => {
      if (staff1Login.body.role !== 'STAFF') throw new Error(`Expected STAFF, got ${staff1Login.body.role}`);
      if (staff1Login.body.redirectUrl !== '/staff/dashboard') throw new Error(`Expected /staff/dashboard, got ${staff1Login.body.redirectUrl}`);
    });

    // 4. Admin accessing Admin API → ALLOWED (200 OK)
    await assertTest('Admin accessing Admin API → ALLOWED', async () => {
      const res = await request(app)
        .get('/api/admin/staff')
        .set('Authorization', `Bearer ${adminToken}`);
      if (res.status !== 200) throw new Error(`Expected 200, got ${res.status}`);
      if (!Array.isArray(res.body.staff)) throw new Error('Expected staff array');
    });

    // 5. Staff accessing Staff marks API → ALLOWED (200 OK)
    await assertTest('Staff accessing Staff marks API → ALLOWED', async () => {
      const res = await request(app)
        .get(`/api/staff/marks?sectionId=${cseSectionAId}&subjectId=${dbmsSubjectId}`)
        .set('Authorization', `Bearer ${staff1Token}`);
      if (res.status !== 200) throw new Error(`Expected 200, got ${res.status}`);
      if (!Array.isArray(res.body.students)) throw new Error('Expected students array');
    });

    // 6. Staff accessing Admin API → 403 Forbidden
    await assertTest('Staff accessing Admin API → 403 Forbidden', async () => {
      const res = await request(app)
        .get('/api/admin/staff')
        .set('Authorization', `Bearer ${staff1Token}`);
      if (res.status !== 403) throw new Error(`Expected 403, got ${res.status}`);
      if (res.body.code !== 'ADMIN_ACCESS_REQUIRED') throw new Error(`Expected ADMIN_ACCESS_REQUIRED, got ${res.body.code}`);
    });

    // 7. Staff trying to access another class → 403 Forbidden
    await assertTest('Staff trying to access another class → 403 Forbidden', async () => {
      const res = await request(app)
        .get(`/api/staff/marks?sectionId=${eceSectionAId}&subjectId=${dbmsSubjectId}`)
        .set('Authorization', `Bearer ${staff1Token}`);
      if (res.status !== 403) throw new Error(`Expected 403, got ${res.status}`);
      if (res.body.code !== 'STAFF_CLASS_UNAUTHORIZED') throw new Error(`Expected STAFF_CLASS_UNAUTHORIZED, got ${res.body.code}`);
    });

    // 8. Staff trying to access another subject → 403 Forbidden
    await assertTest('Staff trying to access another subject → 403 Forbidden', async () => {
      const res = await request(app)
        .get(`/api/staff/marks?sectionId=${cseSectionAId}&subjectId=${tocSubjectId}`)
        .set('Authorization', `Bearer ${staff1Token}`);
      if (res.status !== 403) throw new Error(`Expected 403, got ${res.status}`);
      if (res.body.code !== 'STAFF_CLASS_UNAUTHORIZED') throw new Error(`Expected STAFF_CLASS_UNAUTHORIZED, got ${res.body.code}`);
    });

    // 9. Staff trying to access overall analytics → 403 Forbidden
    await assertTest('Staff trying to access overall analytics → 403 Forbidden', async () => {
      const res = await request(app)
        .get('/api/admin/analytics/overall')
        .set('Authorization', `Bearer ${staff1Token}`);
      if (res.status !== 403) throw new Error(`Expected 403, got ${res.status}`);
      if (res.body.code !== 'ADMIN_ACCESS_REQUIRED') throw new Error(`Expected ADMIN_ACCESS_REQUIRED, got ${res.body.code}`);
    });

    // 10. Admin accessing overall analytics → ALLOWED
    await assertTest('Admin accessing overall analytics → ALLOWED', async () => {
      const res = await request(app)
        .get('/api/admin/analytics/overall')
        .set('Authorization', `Bearer ${adminToken}`);
      if (res.status !== 200) throw new Error(`Expected 200, got ${res.status}`);
      if (res.body.scope !== 'OVERALL_COLLEGE_ANALYTICS') throw new Error('Expected OVERALL_COLLEGE_ANALYTICS');
    });

    // 11. Admin can securely create Staff accounts from Admin panel
    await assertTest('Admin can create Staff accounts (no public registration)', async () => {
      const newEmail = `faculty.${Date.now()}@college.edu`;
      const res = await request(app)
        .post('/api/admin/staff')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          name: 'Prof. David Warner',
          email: newEmail,
          password: 'staffPassword123'
        });
      if (res.status !== 201) throw new Error(`Expected 201, got ${res.status}`);
      if (res.body.staff.role !== 'STAFF') throw new Error('Expected role STAFF');

      // Test login for newly created staff
      const loginRes = await request(app)
        .post('/api/auth/login')
        .send({ email: newEmail, password: 'staffPassword123' });
      if (loginRes.status !== 200) throw new Error(`Login failed for new staff: ${loginRes.status}`);
      if (loginRes.body.redirectUrl !== '/staff/dashboard') throw new Error('Expected /staff/dashboard');
    });

  } catch (error) {
    console.error('Fatal test runner error:', error);
  } finally {
    await prisma.$disconnect();
    console.log(`\n========================================`);
    console.log(`🏁 Test Summary: ${passed} PASSED | ${failed} FAILED`);
    console.log(`========================================\n`);

    if (failed > 0) {
      process.exit(1);
    } else {
      process.exit(0);
    }
  }
}

runTestSuite();
