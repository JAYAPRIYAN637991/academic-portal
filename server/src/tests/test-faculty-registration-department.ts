import assert from 'assert';
import request from 'supertest';
import { createApp } from '../server';
import { prisma } from '../db.js';

const app = createApp();

async function runTests() {
  console.log('================================================================');
  console.log('🧪 TEST SUITE: Faculty Registration With Department (Admin)');
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

  // 1. Authenticate Admin
  console.log('--- 1. Admin Authentication ---');
  let adminToken = '';
  await test('Admin logs in with default credentials', async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .send({ email: 'admin@college.edu', password: 'admin123' });
    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.body.user.role, 'ADMIN');
    adminToken = res.body.token;
  });

  // 2. Discover Departments
  console.log('\n--- 2. Discover Departments ---');
  let cseDept: any;
  let eceDept: any;
  await test('Load CSE and ECE departments from database', async () => {
    cseDept = await prisma.department.findUnique({ where: { code: 'CSE' } });
    assert.ok(cseDept, 'CSE department must exist');

    eceDept = await prisma.department.findUnique({ where: { code: 'ECE' } });
    if (!eceDept) {
      eceDept = await prisma.department.create({
        data: {
          code: 'ECE',
          name: 'Electronics and Communication Engineering'
        }
      });
    }
    assert.ok(eceDept, 'ECE department must exist');
  });

  // 3. Register Faculty with departmentId (UUID)
  console.log('\n--- 3. Register Faculty with departmentId ---');
  const uid1 = Date.now().toString().slice(-4);
  let createdFacultyId1 = '';

  await test('Admin registers new faculty with departmentId (CSE)', async () => {
    const res = await request(app)
      .post('/api/admin/staff')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        name: `Dr. Ananya Sharma ${uid1}`,
        email: `ananya${uid1}@college.edu`,
        departmentId: cseDept.id,
        designation: 'Associate Professor',
        password: `Ananya@${uid1}#2026`
      });

    assert.strictEqual(res.status, 201);
    assert.ok(res.body.staff, 'Staff object returned');
    assert.strictEqual(res.body.staff.departmentId, cseDept.id, 'Staff departmentId must match CSE ID');
    assert.strictEqual(res.body.staff.department?.code, 'CSE', 'Staff department code must be CSE');
    
    // Credentials Handout must also include Department information
    assert.ok(res.body.credentials, 'Credentials handout returned');
    assert.ok(res.body.credentials.department, 'Credentials must include department');
    assert.ok(res.body.credentials.department.includes('CSE'));

    createdFacultyId1 = res.body.staff.id;
  });

  // 4. Verify in DB and via Staff Listing
  console.log('\n--- 4. Verify Persistence & Staff Listing ---');
  await test('User in Prisma DB has departmentId foreign key set and relation queryable', async () => {
    const userInDb = await prisma.user.findUnique({
      where: { id: createdFacultyId1 },
      include: { department: true }
    });

    assert.ok(userInDb);
    assert.strictEqual(userInDb.departmentId, cseDept.id);
    assert.strictEqual(userInDb.department?.code, 'CSE');
    assert.strictEqual(userInDb.department?.name, cseDept.name);
  });

  await test('GET /api/admin/staff includes department information for the registered faculty', async () => {
    const res = await request(app)
      .get('/api/admin/staff')
      .set('Authorization', `Bearer ${adminToken}`);

    assert.strictEqual(res.status, 200);
    assert.ok(Array.isArray(res.body.staff));
    const faculty = res.body.staff.find((s: any) => s.id === createdFacultyId1);
    assert.ok(faculty, 'Faculty must be in list');
    assert.strictEqual(faculty.departmentId, cseDept.id);
    assert.strictEqual(faculty.departmentCode, 'CSE');
    assert.strictEqual(faculty.departmentName, cseDept.name);
  });

  await test('GET /api/admin/staff/:id includes full department details', async () => {
    const res = await request(app)
      .get(`/api/admin/staff/${createdFacultyId1}`)
      .set('Authorization', `Bearer ${adminToken}`);

    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.body.staff.departmentId, cseDept.id);
    assert.strictEqual(res.body.staff.departmentCode, 'CSE');
    assert.strictEqual(res.body.staff.department?.id, cseDept.id);
    assert.strictEqual(res.body.staff.department?.code, 'CSE');
  });

  // 5. Register Faculty with department code or name
  console.log('\n--- 5. Register Faculty with department string code ---');
  const uid2 = (Date.now() + 1).toString().slice(-4);
  let createdFacultyId2 = '';

  await test('Admin registers new faculty with department code "ECE"', async () => {
    const res = await request(app)
      .post('/api/admin/staff')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        name: `Prof. Vikram Raman ${uid2}`,
        email: `vikram${uid2}@college.edu`,
        department: 'ECE',
        designation: 'Assistant Professor',
        password: `Vikram@${uid2}#2026`
      });

    assert.strictEqual(res.status, 201);
    assert.strictEqual(res.body.staff.departmentId, eceDept.id);
    assert.strictEqual(res.body.staff.department?.code, 'ECE');
    assert.ok(res.body.credentials.department?.includes('ECE'));
    createdFacultyId2 = res.body.staff.id;
  });

  // 6. Update Existing Faculty Department
  console.log('\n--- 6. Update Existing Faculty Department ---');
  await test('Admin updates faculty department from CSE to ECE via PUT /api/admin/staff/:id', async () => {
    const res = await request(app)
      .put(`/api/admin/staff/${createdFacultyId1}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        departmentId: eceDept.id,
        designation: 'Professor'
      });

    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.body.staff.departmentId, eceDept.id);
    assert.strictEqual(res.body.staff.department?.code, 'ECE');

    // Check DB
    const dbCheck = await prisma.user.findUnique({
      where: { id: createdFacultyId1 },
      include: { department: true }
    });
    assert.strictEqual(dbCheck?.departmentId, eceDept.id);
    assert.strictEqual(dbCheck?.department?.code, 'ECE');
  });

  // 7. Cleanup
  console.log('\n--- 7. Cleanup Test Records ---');
  await test('Clean up created test faculty', async () => {
    await prisma.user.deleteMany({
      where: { id: { in: [createdFacultyId1, createdFacultyId2] } }
    });
  });

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
