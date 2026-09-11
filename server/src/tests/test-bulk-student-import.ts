import request from 'supertest';
import { createApp } from '../server';
import { prisma } from '../db';
import * as XLSX from 'xlsx';

async function runBulkStudentImportTests() {
  console.log('🧪 Starting Bulk Student Import Engine & RBAC Test Suite...\n');
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

  // Cleanup test students & imports
  const cleanup = async () => {
    try {
      const testRegs = [
        'TEST_REG_1001',
        'TEST_REG_1002',
        'TEST_REG_1003',
        'TEST_REG_1004',
        'TEST_REG_2001',
        'TEST_REG_2002',
        'TEST_REG_3001',
        'TEST_REG_BAD',
      ];
      await prisma.mark.deleteMany({
        where: { student: { registerNumber: { in: testRegs } } }
      });
      await prisma.student.deleteMany({
        where: { registerNumber: { in: testRegs } }
      });
      await prisma.studentImportHistory.deleteMany({
        where: { fileName: { contains: 'test_student_import' } }
      });
    } catch (_) {}
  };

  try {
    await cleanup();

    // 1. Authenticate Admin and Staff
    const adminLogin = await request(app)
      .post('/api/auth/login')
      .send({ email: 'admin@college.edu', password: 'admin123' });
    const adminToken = adminLogin.body.token;

    const staffLogin = await request(app)
      .post('/api/auth/login')
      .send({ email: 'sarah.cse@college.edu', password: 'staff123' });
    const staffToken = staffLogin.body.token;

    // Get current academic year
    const currentAy = await prisma.academicYear.findFirst({
      where: { isCurrent: true }
    });
    if (!currentAy) throw new Error('No current academic year found in database');

    // ========================================================
    // TEST GROUP 1: TEMPLATE GENERATION
    // ========================================================
    await assertTest('Admin: Download .xlsx Template → 200 OK with correct headers', async () => {
      const res = await request(app)
        .get('/api/admin/students/import/template?format=xlsx')
        .set('Authorization', `Bearer ${adminToken}`)
        .buffer(true)
        .parse((response, callback) => {
          const chunks: any[] = [];
          response.on('data', (chunk) => chunks.push(chunk));
          response.on('end', () => callback(null, Buffer.concat(chunks)));
        });
      
      if (res.status !== 200) throw new Error(`Expected 200, got ${res.status}`);
      if (!res.header['content-type']?.includes('spreadsheetml')) {
        throw new Error(`Expected excel content-type, got ${res.header['content-type']}`);
      }
      // Parse downloaded buffer
      const wb = XLSX.read(res.body, { type: 'buffer' });
      const ws = wb.Sheets[wb.SheetNames[0]];
      const json: any[] = XLSX.utils.sheet_to_json(ws);
      if (!json || json.length === 0) throw new Error('Template is empty');
      if (!('Register Number' in json[0]) || !('Parent Mobile' in json[0])) {
        throw new Error('Template missing required column headers');
      }
    });

    await assertTest('Admin: Download .csv Template → 200 OK with CSV text', async () => {
      const res = await request(app)
        .get('/api/admin/students/import/template?format=csv')
        .set('Authorization', `Bearer ${adminToken}`);
      
      if (res.status !== 200) throw new Error(`Expected 200, got ${res.status}`);
      if (!res.text.includes('Register Number,Student Name')) {
        throw new Error('CSV template missing expected headers');
      }
    });

    // ========================================================
    // TEST GROUP 2: RBAC SECURITY VERIFICATION
    // ========================================================
    await assertTest('Staff: Download Template → 403 Forbidden', async () => {
      const res = await request(app)
        .get('/api/admin/students/import/template?format=xlsx')
        .set('Authorization', `Bearer ${staffToken}`);
      if (res.status !== 403) throw new Error(`Expected 403, got ${res.status}`);
    });

    await assertTest('Staff: Preview Import → 403 Forbidden', async () => {
      const res = await request(app)
        .post('/api/admin/students/import/preview')
        .set('Authorization', `Bearer ${staffToken}`)
        .send({});
      if (res.status !== 403) throw new Error(`Expected 403, got ${res.status}`);
    });

    await assertTest('Staff: Confirm Import → 403 Forbidden', async () => {
      const res = await request(app)
        .post('/api/admin/students/import/confirm')
        .set('Authorization', `Bearer ${staffToken}`)
        .send({});
      if (res.status !== 403) throw new Error(`Expected 403, got ${res.status}`);
    });

    await assertTest('Staff: Get Import History Ledger → 403 Forbidden', async () => {
      const res = await request(app)
        .get('/api/admin/students/import/history')
        .set('Authorization', `Bearer ${staffToken}`);
      if (res.status !== 403) throw new Error(`Expected 403, got ${res.status}`);
    });

    // ========================================================
    // TEST GROUP 3: 14-POINT VALIDATION & DRY-RUN PREVIEW
    // ========================================================
    // Create Excel file in memory with valid and intentionally invalid rows
    const testRows = [
      // Valid row 1
      {
        'Register Number': 'TEST_REG_1001',
        'Student Name': 'Rohan Sharma',
        'Roll Number': '21CS101',
        'Department': 'CSE',
        'Year': 3,
        'Section': 'A',
        'Parent Name': 'Rajesh Sharma',
        'Parent Phone': '9876543210',
        'Parent Email': 'rajesh@example.com',
        'Gender': 'MALE'
      },
      // Valid row 2
      {
        'Register Number': 'TEST_REG_1002',
        'Student Name': 'Ananya Iyer',
        'Roll Number': '21CS102',
        'Department': 'CSE',
        'Year': 3,
        'Section': 'A',
        'Parent Name': 'Suresh Iyer',
        'Parent Phone': '9876543211',
        'Parent Email': 'suresh@example.com',
        'Gender': 'FEMALE'
      },
      // Invalid row 1: Invalid phone (< 10 digits)
      {
        'Register Number': 'TEST_REG_BAD',
        'Student Name': 'Kiran Rao',
        'Roll Number': '21CS103',
        'Department': 'CSE',
        'Year': 3,
        'Section': 'A',
        'Parent Name': 'Rao Sr',
        'Parent Phone': '12345',
        'Gender': 'MALE'
      },
      // Invalid row 2: Non-existent department
      {
        'Register Number': 'TEST_REG_1003',
        'Student Name': 'Vikram Das',
        'Roll Number': '21ME104',
        'Department': 'NONEXISTENT_DEPT',
        'Year': 2,
        'Section': 'A',
        'Parent Name': 'Das Sr',
        'Parent Phone': '9876543212',
        'Gender': 'MALE'
      }
    ];

    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.json_to_sheet(testRows);
    XLSX.utils.book_append_sheet(wb, ws, 'Students');
    const xlsxBuffer = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });

    let previewResponse: any = null;

    await assertTest('Admin: Preview Spreadsheet with 14-Point Validation → Detects 2 valid, 2 invalid', async () => {
      const res = await request(app)
        .post('/api/admin/students/import/preview')
        .set('Authorization', `Bearer ${adminToken}`)
        .attach('file', xlsxBuffer, 'test_student_import_mixed.xlsx')
        .field('academicYearId', currentAy.id)
        .field('duplicateMode', 'SKIP');

      if (res.status !== 200) throw new Error(`Expected 200, got ${res.status}: ${JSON.stringify(res.body)}`);
      previewResponse = res.body;

      if (previewResponse.totalRows !== 4) throw new Error(`Expected 4 total rows, got ${previewResponse.totalRows}`);
      if (previewResponse.validCount !== 2) throw new Error(`Expected 2 valid rows, got ${previewResponse.validCount}`);
      if (previewResponse.invalidCount !== 2) throw new Error(`Expected 2 invalid rows, got ${previewResponse.invalidCount}`);
      if (typeof previewResponse.processingTimeMs !== 'number') throw new Error('Missing processingTimeMs metric');

      // Verify specific error reporting
      const phoneError = previewResponse.previewRows.find((r: any) => r.registerNumber === 'TEST_REG_BAD');
      if (!phoneError || !phoneError.errors.some((e: string) => e.toLowerCase().includes('phone') || e.toLowerCase().includes('mobile'))) {
        throw new Error('Expected phone validation error for TEST_REG_BAD');
      }

      const deptError = previewResponse.previewRows.find((r: any) => r.registerNumber === 'TEST_REG_1003');
      if (!deptError || !deptError.errors.some((e: string) => e.includes('Department'))) {
        throw new Error('Expected department validation error for NONEXISTENT_DEPT');
      }
    });

    // ========================================================
    // TEST GROUP 4: BATCH CONFIRMATION & SAFE DUPLICATE 'SKIP'
    // ========================================================
    let firstHistoryId = '';

    await assertTest('Admin: Confirm Import with mode SKIP → Imports 2 valid rows', async () => {
      const res = await request(app)
        .post('/api/admin/students/import/confirm')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          fileName: 'test_student_import_mixed.xlsx',
          fileSize: xlsxBuffer.length,
          academicYearId: currentAy.id,
          duplicateMode: 'SKIP',
          students: previewResponse.previewRows,
          validPayloads: previewResponse.validPayloads,
          duplicatePayloads: previewResponse.duplicatePayloads
        });

      if (res.status !== 200) throw new Error(`Expected 200, got ${res.status}: ${JSON.stringify(res.body)}`);
      const summary = res.body.summary;
      if (summary.importedCount !== 2) throw new Error(`Expected 2 imported, got ${summary.importedCount}`);
      if (summary.failedCount !== 2) throw new Error(`Expected 2 failed, got ${summary.failedCount}`);
      firstHistoryId = summary.importHistoryId;

      // Verify DB records
      const s1 = await prisma.student.findFirst({ where: { registerNumber: 'TEST_REG_1001' } });
      const s2 = await prisma.student.findFirst({ where: { registerNumber: 'TEST_REG_1002' } });
      if (!s1 || !s2) throw new Error('Students were not inserted in database');
      if (!s1.parentMobile.includes('9876543210')) throw new Error(`Unexpected parent mobile: ${s1.parentMobile}`);
    });

    // ========================================================
    // TEST GROUP 5: DUPLICATE DETECTION & RESOLUTION MODES
    // ========================================================
    // Create new batch containing TEST_REG_1001 with UPDATED parent phone and TEST_REG_1004 (new)
    const duplicateRows = [
      {
        'Register Number': 'TEST_REG_1001', // Duplicate!
        'Student Name': 'Rohan Sharma Updated',
        'Roll Number': '21CS101',
        'Department': 'CSE',
        'Year': 3,
        'Section': 'A',
        'Parent Name': 'Rajesh Sharma Updated',
        'Parent Phone': '9999999999', // Updated phone
        'Gender': 'MALE'
      },
      {
        'Register Number': 'TEST_REG_1004', // New!
        'Student Name': 'Sneha Patel',
        'Roll Number': '21CS104',
        'Department': 'CSE',
        'Year': 3,
        'Section': 'A',
        'Parent Name': 'Manoj Patel',
        'Parent Phone': '9876543214',
        'Gender': 'FEMALE'
      }
    ];

    const dupWb = XLSX.utils.book_new();
    const dupWs = XLSX.utils.json_to_sheet(duplicateRows);
    XLSX.utils.book_append_sheet(dupWb, dupWs, 'Students');
    const dupBuffer = XLSX.write(dupWb, { type: 'buffer', bookType: 'xlsx' });

    let dupPreview: any = null;

    await assertTest('Admin: Preview Detects 1 Duplicate, 1 Valid', async () => {
      const res = await request(app)
        .post('/api/admin/students/import/preview')
        .set('Authorization', `Bearer ${adminToken}`)
        .attach('file', dupBuffer, 'test_student_import_dup.xlsx')
        .field('academicYearId', currentAy.id)
        .field('duplicateMode', 'SKIP');

      if (res.status !== 200) throw new Error(`Expected 200, got ${res.status}`);
      dupPreview = res.body;

      if (dupPreview.duplicateCount !== 1) throw new Error(`Expected 1 duplicate, got ${dupPreview.duplicateCount}`);
      if (dupPreview.validCount !== 1) throw new Error(`Expected 1 valid, got ${dupPreview.validCount}`);
    });

    // Test STOP mode: should abort with 409 Conflict
    await assertTest('Admin: Confirm with mode STOP → 409 Conflict (Aborted)', async () => {
      const res = await request(app)
        .post('/api/admin/students/import/confirm')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          fileName: 'test_student_import_dup.xlsx',
          fileSize: dupBuffer.length,
          academicYearId: currentAy.id,
          duplicateMode: 'STOP',
          students: dupPreview.previewRows,
          validPayloads: dupPreview.validPayloads,
          duplicatePayloads: dupPreview.duplicatePayloads
        });

      if (res.status !== 409) throw new Error(`Expected 409, got ${res.status}`);
      if (res.body.code !== 'DUPLICATE_IMPORT_ABORTED') {
        throw new Error(`Expected code DUPLICATE_IMPORT_ABORTED, got ${res.body.code}`);
      }

      // Check that TEST_REG_1004 was NOT inserted due to abortion
      const s4 = await prisma.student.findFirst({ where: { registerNumber: 'TEST_REG_1004' } });
      if (s4) throw new Error('TEST_REG_1004 should NOT have been inserted in STOP mode');
    });

    // Test UPDATE mode: should update TEST_REG_1001 and insert TEST_REG_1004
    await assertTest('Admin: Confirm with mode UPDATE → Updates existing and inserts new', async () => {
      const res = await request(app)
        .post('/api/admin/students/import/confirm')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          fileName: 'test_student_import_dup.xlsx',
          fileSize: dupBuffer.length,
          academicYearId: currentAy.id,
          duplicateMode: 'UPDATE',
          students: dupPreview.previewRows,
          validPayloads: dupPreview.validPayloads,
          duplicatePayloads: dupPreview.duplicatePayloads
        });

      if (res.status !== 200) throw new Error(`Expected 200, got ${res.status}: ${JSON.stringify(res.body)}`);
      const summary = res.body.summary;
      if (summary.updatedCount !== 1) throw new Error(`Expected 1 updated, got ${summary.updatedCount}`);
      if (summary.importedCount !== 1) throw new Error(`Expected 1 imported, got ${summary.importedCount}`);

      // Verify updated record in DB
      const s1Updated = await prisma.student.findFirst({ where: { registerNumber: 'TEST_REG_1001' } });
      if (!s1Updated?.parentMobile.includes('9999999999')) {
        throw new Error(`Expected updated parent mobile 9999999999, got ${s1Updated?.parentMobile}`);
      }
      if (s1Updated?.name !== 'Rohan Sharma Updated') {
        throw new Error(`Expected updated name, got ${s1Updated?.name}`);
      }

      // Verify new record in DB
      const s4 = await prisma.student.findFirst({ where: { registerNumber: 'TEST_REG_1004' } });
      if (!s4) throw new Error('TEST_REG_1004 was not inserted in UPDATE mode');
    });

    // ========================================================
    // TEST GROUP 6: AUDIT LEDGER & IMPORT HISTORY
    // ========================================================
    await assertTest('Admin: Get Import History → Returns paginated ledger with metrics', async () => {
      const res = await request(app)
        .get('/api/admin/students/import/history?page=1&limit=10')
        .set('Authorization', `Bearer ${adminToken}`);

      if (res.status !== 200) throw new Error(`Expected 200, got ${res.status}`);
      if (!Array.isArray(res.body.history) || res.body.history.length === 0) {
        throw new Error('No import history entries returned');
      }

      const entry = res.body.history.find((h: any) => h.id === firstHistoryId);
      if (!entry) throw new Error(`History record with id ${firstHistoryId} not found in ledger`);
      if (entry.importedRows !== 2) throw new Error(`Expected 2 imported rows in ledger, got ${entry.importedRows}`);
      if (entry.status !== 'COMPLETED_WITH_ERRORS') {
        throw new Error(`Expected COMPLETED_WITH_ERRORS status, got ${entry.status}`);
      }
    });

    await assertTest('Admin: Get Specific Import History Record → Returns row error diagnostics', async () => {
      const res = await request(app)
        .get(`/api/admin/students/import/history/${firstHistoryId}`)
        .set('Authorization', `Bearer ${adminToken}`);

      if (res.status !== 200) throw new Error(`Expected 200, got ${res.status}`);
      const record = res.body.record;
      if (!record || !Array.isArray(record.errorLog)) {
        throw new Error('Missing errorLog in history details');
      }
      if (record.errorLog.length < 2) {
        throw new Error(`Expected at least 2 diagnostic log items, got ${record.errorLog.length}`);
      }
    });

    // Clean up
    await cleanup();

  } catch (error: any) {
    console.error('Fatal test suite error:', error);
    failed++;
  }

  console.log('\n==================================================');
  console.log(`BULK STUDENT IMPORT TEST RESULTS: ${passed} PASSED, ${failed} FAILED`);
  console.log('==================================================\n');

  if (failed > 0) {
    process.exit(1);
  }
}

runBulkStudentImportTests();
