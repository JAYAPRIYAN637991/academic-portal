import assert from 'assert';
import request from 'supertest';
import { createApp } from '../server';
import { prisma } from '../db';

const app = createApp();

async function runTests() {
  console.log('================================================================');
  console.log('🧪 TEST SUITE: MS PowerPoint (.pptx) Institutional Report Export');
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
  console.log('--- 1. Authentication ---');
  let adminToken = '';
  await test('Admin logs in with default institutional credentials', async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .send({ email: 'admin@college.edu', password: 'admin123' });
    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.body.user.role, 'ADMIN');
    adminToken = res.body.token;
  });

  // 2. Report Catalog PPTX Support
  console.log('\n--- 2. Report Catalog Verification ---');
  await test('GET /api/admin/reports/types includes pptx in allowedFormats', async () => {
    const res = await request(app)
      .get('/api/admin/reports/types')
      .set('Authorization', `Bearer ${adminToken}`);

    assert.strictEqual(res.status, 200);
    assert.ok(Array.isArray(res.body.catalog));
    const studentReport = res.body.catalog.find((c: any) => c.id === 'student-performance');
    assert.ok(studentReport, 'student-performance report must exist');
    assert.ok(studentReport.allowedFormats.includes('pptx'), 'allowedFormats must include pptx');
  });

  // Helper function to verify PPTX buffer
  function verifyPptxResponse(res: request.Response, expectedCategoryName: string) {
    assert.strictEqual(res.status, 200);
    assert.strictEqual(
      res.headers['content-type'],
      'application/vnd.openxmlformats-officedocument.presentationml.presentation'
    );
    assert.ok(res.headers['content-disposition'], 'Must have Content-Disposition header');
    assert.ok(
      res.headers['content-disposition'].includes('.pptx'),
      'Content-Disposition must specify a .pptx filename'
    );

    const buf = Buffer.from(res.body);
    assert.ok(buf.length > 5000, `PPTX buffer size (${buf.length} bytes) must be > 5KB`);

    // Verify ZIP/OOXML magic bytes: 0x50 0x4B 0x03 0x04 (PK..)
    assert.strictEqual(buf[0], 0x50, 'Magic byte 0 must be 0x50 (P)');
    assert.strictEqual(buf[1], 0x4B, 'Magic byte 1 must be 0x4B (K)');
    assert.strictEqual(buf[2], 0x03, 'Magic byte 2 must be 0x03');
    assert.strictEqual(buf[3], 0x04, 'Magic byte 3 must be 0x04');
  }

  // 3. Export Student Performance Report as PPTX
  console.log('\n--- 3. Student Performance PPTX Export ---');
  await test('Export Student Performance Report as PowerPoint (.pptx)', async () => {
    const res = await request(app)
      .get('/api/reports/generate?type=student-performance&format=pptx')
      .set('Authorization', `Bearer ${adminToken}`)
      .buffer(true)
      .parse((res, callback) => {
        const data: any[] = [];
        res.on('data', chunk => data.push(chunk));
        res.on('end', () => callback(null, Buffer.concat(data)));
      });

    verifyPptxResponse(res, 'Student Performance');
  });

  // 4. Export Section Performance Report as PPTX
  console.log('\n--- 4. Section Performance PPTX Export ---');
  await test('Export Section Performance Report as PowerPoint (.pptx)', async () => {
    const res = await request(app)
      .get('/api/admin/reports/section-performance?format=pptx')
      .set('Authorization', `Bearer ${adminToken}`)
      .buffer(true)
      .parse((res, callback) => {
        const data: any[] = [];
        res.on('data', chunk => data.push(chunk));
        res.on('end', () => callback(null, Buffer.concat(data)));
      });

    verifyPptxResponse(res, 'Section Performance');
  });

  // 5. Export Department Performance Report as PPTX
  console.log('\n--- 5. Department Performance PPTX Export ---');
  await test('Export Department Performance Report as PowerPoint (.pptx)', async () => {
    const res = await request(app)
      .get('/api/admin/reports/department-performance?format=pptx')
      .set('Authorization', `Bearer ${adminToken}`)
      .buffer(true)
      .parse((res, callback) => {
        const data: any[] = [];
        res.on('data', chunk => data.push(chunk));
        res.on('end', () => callback(null, Buffer.concat(data)));
      });

    verifyPptxResponse(res, 'Department Performance');
  });

  // 6. Export Overall College Result (Alias Support) as PPTX
  console.log('\n--- 6. Overall College Result PPTX Export ---');
  await test('Export Overall College Result via /reports/generate?type=overall-college-result as PPTX', async () => {
    const res = await request(app)
      .get('/api/reports/generate?type=overall-college-result&format=pptx')
      .set('Authorization', `Bearer ${adminToken}`)
      .buffer(true)
      .parse((res, callback) => {
        const data: any[] = [];
        res.on('data', chunk => data.push(chunk));
        res.on('end', () => callback(null, Buffer.concat(data)));
      });

    verifyPptxResponse(res, 'Overall College Result');
  });

  // 7. Export Notification Delivery Report (Alias Support) as PPTX
  console.log('\n--- 7. Notification Delivery Report PPTX Export ---');
  await test('Export Notification Delivery Report via /reports/generate?type=notification-report as PPTX', async () => {
    const res = await request(app)
      .get('/api/reports/generate?type=notification-report&format=pptx')
      .set('Authorization', `Bearer ${adminToken}`)
      .buffer(true)
      .parse((res, callback) => {
        const data: any[] = [];
        res.on('data', chunk => data.push(chunk));
        res.on('end', () => callback(null, Buffer.concat(data)));
      });

    verifyPptxResponse(res, 'Notification Report');
  });

  // 8. Security & RBAC Checks
  console.log('\n--- 8. Security & Role-Based Access Control ---');
  await test('Unauthenticated PPTX export request fails with 401 Unauthorized', async () => {
    const res = await request(app)
      .get('/api/reports/generate?type=student-performance&format=pptx');

    assert.strictEqual(res.status, 401);
  });

  let staffToken = '';
  await test('Staff login and attempt to export college-wide PPTX report is blocked (403)', async () => {
    const loginRes = await request(app)
      .post('/api/auth/login')
      .send({ email: 'sarah.cse@college.edu', password: 'staff123' });
    assert.strictEqual(loginRes.status, 200);
    staffToken = loginRes.body.token;

    const res = await request(app)
      .get('/api/staff/reports/department-performance?format=pptx')
      .set('Authorization', `Bearer ${staffToken}`);

    assert.strictEqual(res.status, 403);
    assert.strictEqual(res.body.code, 'COLLEGE_WIDE_REPORTS_RESTRICTED');
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
