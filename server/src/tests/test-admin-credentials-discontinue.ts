import assert from 'assert';
import request from 'supertest';
import { createApp } from '../server';
import { validatePasswordComplexity } from '../utils/credential.util';

const app = createApp();

async function runTests() {
  console.log('================================================================');
  console.log('🧪 TEST SUITE: Admin Credentials, Faculty Add & Discontinue');
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

  // 1. Password Complexity Utility Unit Tests
  console.log('--- 1. Password Complexity Utility Validation ---');
  await test('Compliant password (Staff@2026!) passes validation', async () => {
    const res = validatePasswordComplexity('Staff@2026!');
    assert.strictEqual(res.isValid, true);
    assert.strictEqual(res.errors.length, 0);
  });

  await test('Password shorter than 8 characters is rejected', async () => {
    const res = validatePasswordComplexity('St@1');
    assert.strictEqual(res.isValid, false);
    assert.ok(res.errors.some(e => e.includes('at least 8 characters')));
  });

  await test('Password without letters is rejected', async () => {
    const res = validatePasswordComplexity('12345678@!');
    assert.strictEqual(res.isValid, false);
    assert.ok(res.errors.some(e => e.includes('at least one letter')));
  });

  await test('Password without numbers is rejected', async () => {
    const res = validatePasswordComplexity('StaffPassword@');
    assert.strictEqual(res.isValid, false);
    assert.ok(res.errors.some(e => e.includes('at least one number')));
  });

  await test('Password without special symbols is rejected', async () => {
    const res = validatePasswordComplexity('StaffPassword123');
    assert.strictEqual(res.isValid, false);
    assert.ok(res.errors.some(e => e.includes('at least one special symbol')));
  });

  // 2. Admin Login
  console.log('\n--- 2. Admin Authentication ---');
  let adminToken = '';
  await test('Admin logs in with default credentials and receives JWT token', async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .send({ email: 'admin@college.edu', password: 'admin123' });
    assert.strictEqual(res.status, 200);
    assert.ok(res.body.token, 'Must return JWT token');
    assert.strictEqual(res.body.user?.role, 'ADMIN');
    adminToken = res.body.token;
  });

  // 3. Faculty Creation with Non-Compliant Password
  console.log('\n--- 3. Faculty Creation Password Policy Enforcement ---');
  const uniqueId = Date.now().toString().slice(-4);

  await test('Creating faculty with password lacking special symbol fails with 400', async () => {
    const res = await request(app)
      .post('/api/admin/staff')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        name: `Weak Pass Faculty ${uniqueId}`,
        email: `weak${uniqueId}@college.edu`,
        department: 'CSE',
        designation: 'Assistant Professor',
        password: 'weakpassword123'
      });
    assert.strictEqual(res.status, 400);
    assert.strictEqual(res.body.code, 'PASSWORD_COMPLEXITY_FAILED');
  });

  // 4. Faculty Creation with Compliant Password & Handout Generation
  console.log('\n--- 4. Faculty Creation & Credential Handout ---');
  let createdFacultyId = '';
  let createdFacultyUsername = '';
  const compliantFacultyPassword = `Rajesh@${uniqueId}#2026`;

  await test('Admin creates faculty with compliant password and receives credentials handout', async () => {
    const res = await request(app)
      .post('/api/admin/staff')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        name: `Prof Rajesh Kumar ${uniqueId}`,
        email: `rajesh${uniqueId}@college.edu`,
        department: 'CSE',
        designation: 'Associate Professor',
        dob: '1985-05-15',
        password: compliantFacultyPassword
      });

    assert.strictEqual(res.status, 201);
    assert.ok(res.body.credentials, 'Must return credentials object');
    assert.strictEqual(res.body.credentials.password, compliantFacultyPassword);
    assert.ok(res.body.credentials.username.startsWith('rajesh'));
    assert.ok(res.body.credentials.loginUrl.includes('/login'));

    createdFacultyId = res.body.staff.id;
    createdFacultyUsername = res.body.credentials.username;
  });

  // 5. Faculty Login with Handout Credentials
  console.log('\n--- 5. Faculty Login Verification ---');
  await test('Created faculty logs in successfully with handout credentials', async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .send({
        username: createdFacultyUsername,
        password: compliantFacultyPassword
      });
    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.body.user?.role, 'STAFF');
  });

  // 6. Admin Discontinues Faculty
  console.log('\n--- 6. Admin Discontinues Faculty ---');
  await test('Admin marks faculty as discontinued (isActive: false, passwordAuthorized: false)', async () => {
    const res = await request(app)
      .patch(`/api/admin/staff/${createdFacultyId}/discontinue`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ reason: 'Faculty resigned' });

    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.body.staff.isActive, false);
    assert.strictEqual(res.body.staff.passwordAuthorized, false);
  });

  // 7. Verify Discontinued Faculty Login is Blocked
  console.log('\n--- 7. Discontinued Faculty Login Blocking ---');
  await test('Discontinued faculty login attempt is blocked with 403 Forbidden', async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .send({
        username: createdFacultyUsername,
        password: compliantFacultyPassword
      });
    assert.strictEqual(res.status, 403);
  });

  // 8. Admin Re-activates and Reissues Credentials
  console.log('\n--- 8. Admin Re-activates & Reissues Credentials ---');
  const reissuedPassword = `Reissued@${uniqueId}!99`;
  await test('Admin reissues compliant credentials to reactivate faculty', async () => {
    const res = await request(app)
      .post(`/api/admin/staff/${createdFacultyId}/reissue-credentials`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ password: reissuedPassword });

    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.body.credentials.password, reissuedPassword);
    assert.strictEqual(res.body.staff.isActive, true);
    assert.strictEqual(res.body.staff.passwordAuthorized, true);

    // Faculty logs in again
    const loginRes = await request(app)
      .post('/api/auth/login')
      .send({
        username: createdFacultyUsername,
        password: reissuedPassword
      });
    assert.strictEqual(loginRes.status, 200);
    assert.strictEqual(loginRes.body.user?.role, 'STAFF');
  });

  // 9. Admin Profile Credentials Management
  console.log('\n--- 9. Admin Dashboard Profile & Security Credentials ---');
  await test('GET /api/admin/profile returns Admin profile details', async () => {
    const res = await request(app)
      .get('/api/admin/profile')
      .set('Authorization', `Bearer ${adminToken}`);
    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.body.admin?.role, 'ADMIN');
  });

  await test('Updating admin credentials with wrong current password fails with 401', async () => {
    const res = await request(app)
      .put('/api/admin/profile/credentials')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        currentPassword: 'WrongPassword!',
        newPassword: 'NewValidPassword#2026'
      });
    assert.strictEqual(res.status, 401);
  });

  await test('Updating admin credentials with weak new password fails with 400', async () => {
    const res = await request(app)
      .put('/api/admin/profile/credentials')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        currentPassword: 'admin123',
        newPassword: 'weakadminpassword'
      });
    assert.strictEqual(res.status, 400);
    assert.strictEqual(res.body.code, 'PASSWORD_COMPLEXITY_FAILED');
  });

  const tempAdminPass = `MasterAdmin@${uniqueId}#2026`;
  let newAdminToken = '';
  await test('Admin successfully updates password with compliant credentials', async () => {
    const res = await request(app)
      .put('/api/admin/profile/credentials')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        currentPassword: 'admin123',
        newPassword: tempAdminPass
      });
    assert.strictEqual(res.status, 200);
    assert.ok(res.body.token, 'Must return new JWT token');
    newAdminToken = res.body.token;
  });

  await test('Admin can log in with new password; old password fails', async () => {
    const oldLoginRes = await request(app)
      .post('/api/auth/login')
      .send({ email: 'admin@college.edu', password: 'admin123' });
    assert.strictEqual(oldLoginRes.status, 401);

    const newLoginRes = await request(app)
      .post('/api/auth/login')
      .send({ email: 'admin@college.edu', password: tempAdminPass });
    assert.strictEqual(newLoginRes.status, 200);
  });

  await test('Admin safely restores original credentials for environment consistency', async () => {
    const restoreRes = await request(app)
      .put('/api/admin/profile/credentials')
      .set('Authorization', `Bearer ${newAdminToken}`)
      .send({
        currentPassword: tempAdminPass,
        newPassword: 'admin123!' // compliant restore
      });
    
    // Note: let's restore to admin123! or seed password
    assert.strictEqual(restoreRes.status, 200);

    // Let's restore to admin123 directly in DB or through password with complexity
    // Notice admin123 has 8 chars: a-d-m-i-n-1-2-3 (letters+numbers), but no symbol unless admin123!
  });

  // Let's also restore back to admin123 so subsequent test suites that use 'admin123' pass
  await test('Restore DB admin password directly to default admin123 for regression suites', async () => {
    const bcrypt = await import('bcryptjs');
    const { prisma } = await import('../db.js');
    const salt = await bcrypt.genSalt(10);
    const hash = await bcrypt.hash('admin123', salt);
    await prisma.user.updateMany({
      where: { email: 'admin@college.edu' },
      data: { passwordHash: hash }
    });

    const verifyOriginalLogin = await request(app)
      .post('/api/auth/login')
      .send({ email: 'admin@college.edu', password: 'admin123' });
    assert.strictEqual(verifyOriginalLogin.status, 200);
  });

  console.log('\n================================================================');
  console.log(`🏁 TEST RESULTS: ${passed} PASSED, ${failed} FAILED`);
  console.log('================================================================');

  if (failed > 0) {
    process.exit(1);
  }
  process.exit(0);
}

runTests().catch(err => {
  console.error('Fatal test error:', err);
  process.exit(1);
});
