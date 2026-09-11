import assert from 'assert';
import request from 'supertest';
import { createApp } from '../server';
import { prisma } from '../db';
import { generateDefaultStaffPassword, extractFirstName, formatDobToDDMMYYYY } from '../utils/credential.util';

const app = createApp();

async function runStaffLoginMethodologyTests() {
  console.log('================================================================');
  console.log('🧪 RUNNING COMPREHENSIVE STAFF LOGIN METHODOLOGY TEST SUITE');
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

  // Tokens
  let adminToken = '';
  let sarahToken = '';
  let michaelToken = '';
  let sarahId = '';
  let michaelId = '';

  // -------------------------------------------------------------
  // Test 1: Credential Utility Unit Tests
  // -------------------------------------------------------------
  await test('Utility: extractFirstName strips titles correctly', async () => {
    assert.strictEqual(extractFirstName('Prof. Sarah Jenkins'), 'Sarah');
    assert.strictEqual(extractFirstName('Dr. Michael Chang'), 'Michael');
    assert.strictEqual(extractFirstName('Mr. David Miller'), 'David');
    assert.strictEqual(extractFirstName('Mrs. Anita Roy'), 'Anita');
    assert.strictEqual(extractFirstName('A. Rajesh'), 'Rajesh');
    assert.strictEqual(extractFirstName('Sarah'), 'Sarah');
  });

  await test('Utility: formatDobToDDMMYYYY formats various date formats', async () => {
    assert.strictEqual(formatDobToDDMMYYYY('1988-08-15'), '15081988');
    assert.strictEqual(formatDobToDDMMYYYY('15-08-1988'), '15081988');
    assert.strictEqual(formatDobToDDMMYYYY('15/08/1988'), '15081988');
    assert.strictEqual(formatDobToDDMMYYYY(new Date(1988, 7, 15)), '15081988');
  });

  await test('Utility: generateDefaultStaffPassword follows FirstName@DDMMYYYY formula', async () => {
    assert.strictEqual(
      generateDefaultStaffPassword('Prof. Sarah Jenkins', '1988-08-15'),
      'Sarah@15081988'
    );
    assert.strictEqual(
      generateDefaultStaffPassword('Dr. Michael Chang', '1985-11-20'),
      'Michael@20111985'
    );
  });

  // -------------------------------------------------------------
  // Test 2: Admin Login
  // -------------------------------------------------------------
  await test('Admin login with default institutional credentials', async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .send({ email: 'admin@college.edu', password: 'admin123' });

    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.body.user.role, 'ADMIN');
    assert.ok(res.body.token);
    adminToken = res.body.token;
  });

  // -------------------------------------------------------------
  // Test 3: Staff Login Using Name & Name+DOB Password
  // -------------------------------------------------------------
  await test('Staff 1 (Sarah) login using exact full name "Sarah Jenkins"', async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .send({ username: 'Sarah Jenkins', password: 'Sarah@15081988' });

    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.body.user.role, 'STAFF');
    assert.ok(res.body.token);
    sarahToken = res.body.token;
    sarahId = res.body.user.id;
  });

  await test('Staff 1 (Sarah) login using title-prefixed name "Prof. Sarah Jenkins"', async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .send({ username: 'Prof. Sarah Jenkins', password: 'Sarah@15081988' });

    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.body.user.role, 'STAFF');
  });

  await test('Staff 1 (Sarah) login using generated username "sarah.jenkins"', async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .send({ username: 'sarah.jenkins', password: 'Sarah@15081988' });

    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.body.user.role, 'STAFF');
  });

  await test('Staff 1 (Sarah) login with case-tolerant password "sarah@15081988"', async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .send({ username: 'Sarah Jenkins', password: 'sarah@15081988' });

    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.body.user.role, 'STAFF');
  });

  // -------------------------------------------------------------
  // Test 4: Staff 2 Distinct Credentials (Dr. Michael Chang)
  // -------------------------------------------------------------
  await test('Staff 2 (Michael) login using Name "Dr. Michael Chang" and password "Michael@20111985"', async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .send({ username: 'Dr. Michael Chang', password: 'Michael@20111985' });

    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.body.user.role, 'STAFF');
    assert.ok(res.body.token);
    michaelToken = res.body.token;
    michaelId = res.body.user.id;
  });

  await test('Staff 2 (Michael) login using clean name "Michael Chang"', async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .send({ username: 'Michael Chang', password: 'Michael@20111985' });

    assert.strictEqual(res.status, 200);
  });

  // -------------------------------------------------------------
  // Test 5: Negative Login & Cross-Credential Isolation
  // -------------------------------------------------------------
  await test('Negative: Sarah login using Michael password fails with 401', async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .send({ username: 'Sarah Jenkins', password: 'Michael@20111985' });

    assert.strictEqual(res.status, 401);
  });

  await test('Negative: Michael login with wrong password fails with 401', async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .send({ username: 'Dr. Michael Chang', password: 'WrongPassword123' });

    assert.strictEqual(res.status, 401);
  });

  // -------------------------------------------------------------
  // Test 6: Admin Clearance & Password Authorization
  // -------------------------------------------------------------
  await test('Admin can inspect staff credentials summary', async () => {
    const res = await request(app)
      .get(`/api/admin/staff/${sarahId}/credentials`)
      .set('Authorization', `Bearer ${adminToken}`);

    assert.strictEqual(res.status, 200);
    assert.ok(res.body.staff);
    assert.strictEqual(res.body.staff.defaultPasswordPreview, 'Sarah@15081988');
    assert.strictEqual(res.body.staff.passwordAuthorized, true);
  });

  await test('Staff CANNOT access admin credentials summary (403 Forbidden)', async () => {
    const res = await request(app)
      .get(`/api/admin/staff/${sarahId}/credentials`)
      .set('Authorization', `Bearer ${sarahToken}`);

    assert.strictEqual(res.status, 403);
  });

  await test('Admin can revoke staff password authorization', async () => {
    const res = await request(app)
      .post(`/api/admin/staff/${sarahId}/authorize-password`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ mode: 'REVOKE' });

    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.body.staff.passwordAuthorized, false);
  });

  await test('Revoked staff login attempt is rejected with 403 PASSWORD_NOT_AUTHORIZED', async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .send({ username: 'Sarah Jenkins', password: 'Sarah@15081988' });

    assert.strictEqual(res.status, 403);
    assert.strictEqual(res.body.code, 'PASSWORD_NOT_AUTHORIZED');
  });

  await test('Admin re-authorizes Sarah using DEFAULT_NAME_DOB mode', async () => {
    const res = await request(app)
      .post(`/api/admin/staff/${sarahId}/authorize-password`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ mode: 'DEFAULT_NAME_DOB', dateOfBirth: '1988-08-15' });

    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.body.staff.passwordAuthorized, true);
    assert.strictEqual(res.body.defaultPasswordPreview, 'Sarah@15081988');
  });

  await test('Re-authorized Sarah can log in again successfully', async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .send({ username: 'Sarah Jenkins', password: 'Sarah@15081988' });

    assert.strictEqual(res.status, 200);
    assert.ok(res.body.token);
  });

  await test('Admin can set custom authorized password for staff', async () => {
    const res = await request(app)
      .post(`/api/admin/staff/${sarahId}/authorize-password`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ mode: 'CUSTOM', newPassword: 'AuthorizedCustom#2026' });

    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.body.staff.passwordAuthorized, true);

    // Login with new custom password
    const loginRes = await request(app)
      .post('/api/auth/login')
      .send({ username: 'Sarah Jenkins', password: 'AuthorizedCustom#2026' });

    assert.strictEqual(loginRes.status, 200);

    // Reset back to formula default
    await request(app)
      .post(`/api/admin/staff/${sarahId}/authorize-password`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ mode: 'DEFAULT_NAME_DOB', dateOfBirth: '1988-08-15' });
  });

  // -------------------------------------------------------------
  // Test 7: Dynamic Staff Creation with Automated Name+DOB Credential
  // -------------------------------------------------------------
  let newStaffId = '';
  await test('Admin creates new staff with DOB and automated formula password', async () => {
    // Delete if existing from prior runs
    const existingAnanya = await prisma.user.findUnique({
      where: { email: 'ananya.sharma@college.edu' }
    });
    if (existingAnanya) {
      await prisma.auditLog.deleteMany({ where: { userId: existingAnanya.id } });
      await prisma.user.delete({ where: { id: existingAnanya.id } });
    }

    const res = await request(app)
      .post('/api/admin/staff')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        name: 'Dr. Ananya Sharma',
        email: 'ananya.sharma@college.edu',
        dateOfBirth: '1992-04-12'
      });

    assert.strictEqual(res.status, 201);
    assert.ok(res.body.staff);
    assert.strictEqual(res.body.staff.passwordAuthorized, true);
    assert.strictEqual(res.body.generatedPassword, 'Ananya@12041992');
    newStaffId = res.body.staff.id;
  });

  await test('Newly created staff logs in immediately using Name and formula password', async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .send({
        username: 'Dr. Ananya Sharma',
        password: 'Ananya@12041992'
      });

    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.body.user.name, 'Dr. Ananya Sharma');
    assert.strictEqual(res.body.user.role, 'STAFF');
  });

  await test('Newly created staff also logs in with clean name "Ananya Sharma"', async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .send({
        username: 'Ananya Sharma',
        password: 'Ananya@12041992'
      });

    assert.strictEqual(res.status, 200);
  });

  // Clean up created staff
  if (newStaffId) {
    await prisma.auditLog.deleteMany({ where: { userId: newStaffId } }).catch(() => {});
    await prisma.user.delete({ where: { id: newStaffId } }).catch(() => {});
  }

  console.log('\n================================================================');
  console.log(`📊 RESULTS: ${passed} PASSED | ${failed} FAILED`);
  console.log('================================================================\n');

  if (failed > 0) {
    process.exit(1);
  } else {
    process.exit(0);
  }
}

runStaffLoginMethodologyTests().catch((err) => {
  console.error('Fatal test error:', err);
  process.exit(1);
});
