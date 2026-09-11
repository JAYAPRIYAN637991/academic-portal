import request from 'supertest';
import * as xlsx from 'xlsx';
import { createApp } from '../server';
import { prisma } from '../db';

async function runBulkImportTests() {
  console.log('🧪 Starting Admin-Only Bulk Student Import (SheetJS/xlsx) Test Suite...\n');
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
    const acadYear = await prisma.academicYear.findFirst({ where: { isCurrent: true } });
    const cseDept = await prisma.department.findUnique({ where: { code: 'CSE' } });
    const yr3 = await prisma.year.findFirst({ where: { yearNumber: 3 } });
    const secA = await prisma.section.findFirst({
      where: { name: 'A', departmentId: cseDept!.id, yearId: yr3!.id, academicYearId: acadYear!.id }
    });

    // ========================================================
    // SECTION 1: STAFF RESTRICTIONS (403 FORBIDDEN)
    // ========================================================
    await assertTest('Staff downloading import template → 403 Forbidden', async () => {
      const res = await request(app)
        .get('/api/admin/students/import/template')
        .set('Authorization', `Bearer ${staffToken}`);
      if (res.status !== 403) throw new Error(`Expected 403, got ${res.status}`);
      if (res.body.code !== 'ADMIN_ACCESS_REQUIRED') throw new Error(`Expected ADMIN_ACCESS_REQUIRED, got ${res.body.code}`);
    });

    await assertTest('Staff uploading import preview → 403 Forbidden', async () => {
      const res = await request(app)
        .post('/api/admin/students/import/preview')
        .set('Authorization', `Bearer ${staffToken}`);
      if (res.status !== 403) throw new Error(`Expected 403, got ${res.status}`);
    });

    await assertTest('Staff confirming bulk import → 403 Forbidden', async () => {
      const res = await request(app)
        .post('/api/admin/students/import/confirm')
        .set('Authorization', `Bearer ${staffToken}`)
        .send({ students: [] });
      if (res.status !== 403) throw new Error(`Expected 403, got ${res.status}`);
    });

    // ========================================================
    // SECTION 2: TEMPLATE GENERATION (SheetJS / Excel)
    // ========================================================
    await assertTest('Admin downloads sample Excel template → 200 OK (.xlsx format)', async () => {
      const res = await request(app)
        .get('/api/admin/students/import/template')
        .set('Authorization', `Bearer ${adminToken}`)
        .buffer(true)
        .parse((res, callback) => {
          const chunks: Buffer[] = [];
          res.on('data', (chunk) => chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk)));
          res.on('end', () => callback(null, Buffer.concat(chunks)));
        });

      if (res.status !== 200) throw new Error(`Expected 200, got ${res.status}`);
      if (!res.headers['content-type'].includes('spreadsheetml')) {
        throw new Error(`Expected spreadsheetml content-type, got ${res.headers['content-type']}`);
      }

      // Parse downloaded template buffer using SheetJS
      const wb = xlsx.read(res.body, { type: 'buffer' });
      if (!wb.SheetNames.includes('Student_Import_Template')) {
        throw new Error('Sheet name mismatch in generated template');
      }
      const sheet = wb.Sheets[wb.SheetNames[0]];
      const json = xlsx.utils.sheet_to_json(sheet, { header: 1 }) as string[][];
      const headers = json[0];
      if (!headers.includes('Register Number') || !headers.includes('Parent Mobile')) {
        throw new Error(`Expected headers missing in template: ${headers.join(', ')}`);
      }
    });

    // ========================================================
    // SECTION 3: SPREADSHEET VALIDATION (EXHAUSTIVE CHECKS)
    // ========================================================
    const testWorkbook = xlsx.utils.book_new();
    const testRows = [
      ['Register Number', 'Student Name', 'Department', 'Year', 'Section', 'Parent Name', 'Parent Mobile'],
      // Row 2: Valid student
      ['2025CSE060', 'Gautam Singhania', 'CSE', '3', 'A', 'Vijay Singhania', '+919876543299'],
      // Row 3: Missing register number
      ['', 'Missing Reg Student', 'CSE', '3', 'A', 'Parent Name', '9876543210'],
      // Row 4: Duplicate register number in same file
      ['2025CSE060', 'Duplicate In File', 'CSE', '3', 'A', 'Another Parent', '9876543210'],
      // Row 5: Existing student already in DB
      ['723723106001', 'Existing DB Student', 'CSE', '3', 'A', 'Parent One', '9800000001'],
      // Row 6: Missing student name
      ['2025CSE061', '', 'CSE', '3', 'A', 'Parent Two', '9876543210'],
      // Row 7: Invalid department
      ['2025CSE062', 'Bad Dept Student', 'UNKNOWN_DEPT', '3', 'A', 'Parent Three', '9876543210'],
      // Row 8: Invalid year
      ['2025CSE063', 'Bad Year Student', 'CSE', '99', 'A', 'Parent Four', '9876543210'],
      // Row 9: Invalid section
      ['2025CSE064', 'Bad Sec Student', 'CSE', '3', 'Z', 'Parent Five', '9876543210'],
      // Row 10: Invalid parent mobile
      ['2025CSE065', 'Bad Phone Student', 'CSE', '3', 'A', 'Parent Six', '12345']
    ];

    const testSheet = xlsx.utils.aoa_to_sheet(testRows);
    xlsx.utils.book_append_sheet(testWorkbook, testSheet, 'TestSheet');
    const excelBuffer = xlsx.write(testWorkbook, { type: 'buffer', bookType: 'xlsx' });

    let previewResponse: any = null;
    await assertTest('Admin uploads Excel file → Exhaustive row validation & error reporting', async () => {
      const res = await request(app)
        .post(`/api/admin/students/import/preview?academicYearId=${acadYear!.id}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .attach('file', excelBuffer, 'students_test.xlsx');

      if (res.status !== 200) throw new Error(`Status ${res.status}: ${res.body.error}`);
      previewResponse = res.body;

      const { summary, rows } = res.body;
      if (summary.totalRows !== 9) throw new Error(`Expected totalRows === 9, got ${summary.totalRows}`);
      if (summary.validRows !== 1) throw new Error(`Expected validRows === 1, got ${summary.validRows}`);
      if (summary.invalidRows !== 6) throw new Error(`Expected invalidRows === 6, got ${summary.invalidRows}`);
      if (summary.duplicateRows !== 2) throw new Error(`Expected duplicateRows === 2, got ${summary.duplicateRows}`);

      // Check specific row errors
      const row3 = rows.find((r: any) => r.rowNumber === 3); // missing reg
      if (!row3.errors.some((e: string) => e.includes('Missing Register Number'))) {
        throw new Error('Row 3 missing error for Missing Register Number');
      }

      const row4 = rows.find((r: any) => r.rowNumber === 4); // in-file duplicate
      if (row4.status !== 'DUPLICATE') throw new Error('Row 4 should be DUPLICATE status');

      const row5 = rows.find((r: any) => r.rowNumber === 5); // existing DB duplicate
      if (!row5.errors.some((e: string) => e.includes('already enrolled'))) {
        throw new Error('Row 5 should indicate student already enrolled');
      }

      const row7 = rows.find((r: any) => r.rowNumber === 7); // invalid dept
      if (!row7.errors.some((e: string) => e.includes('Invalid Department'))) {
        throw new Error('Row 7 should indicate Invalid Department');
      }

      const row10 = rows.find((r: any) => r.rowNumber === 10); // bad phone
      if (!row10.errors.some((e: string) => e.includes('Invalid Parent Mobile'))) {
        throw new Error('Row 10 should indicate Invalid Parent Mobile');
      }
    });

    // ========================================================
    // SECTION 4: DATABASE TRANSACTION CONFIRMATION
    // ========================================================
    await assertTest('Admin confirms import → Commits valid row into database inside transaction', async () => {
      const validRow = previewResponse.rows.find((r: any) => r.status === 'VALID');
      if (!validRow || !validRow.resolved) throw new Error('No valid resolved row found in preview');

      const res = await request(app)
        .post('/api/admin/students/import/confirm')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          students: [validRow.resolved],
          academicYearId: acadYear!.id
        });

      if (res.status !== 200) throw new Error(`Status ${res.status}: ${res.body.error}`);
      if (res.body.importedCount !== 1) throw new Error(`Expected importedCount === 1, got ${res.body.importedCount}`);

      // Verify student in PostgreSQL
      const createdInDb = await prisma.student.findUnique({
        where: {
          registerNumber_academicYearId: {
            registerNumber: '2025CSE060',
            academicYearId: acadYear!.id
          }
        }
      });
      if (!createdInDb) throw new Error('Student 2025CSE060 was not found in database');
      if (createdInDb.name !== 'Gautam Singhania') throw new Error('Student name mismatch');
      if (createdInDb.parentMobile !== '+919876543299') throw new Error('Parent mobile mismatch');

      // Cleanup
      await prisma.student.delete({ where: { id: createdInDb.id } });
    });

    // ========================================================
    // SECTION 5: CSV SUPPORT
    // ========================================================
    await assertTest('Admin uploads valid CSV spreadsheet → Successfully parsed by SheetJS', async () => {
      const csvContent = [
        'Register Number,Student Name,Department,Year,Section,Parent Name,Parent Mobile',
        '2025CSE070,Pooja Hegde,CSE,3,A,Manjunath Hegde,+919876543255'
      ].join('\n');

      const csvBuffer = Buffer.from(csvContent, 'utf-8');

      const res = await request(app)
        .post(`/api/admin/students/import/preview?academicYearId=${acadYear!.id}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .attach('file', csvBuffer, 'students.csv');

      if (res.status !== 200) throw new Error(`Status ${res.status}: ${res.body.error}`);
      if (res.body.summary.totalRows !== 1) throw new Error(`Expected totalRows === 1, got ${res.body.summary.totalRows}`);
      if (res.body.summary.validRows !== 1) throw new Error(`Expected validRows === 1, got ${res.body.summary.validRows}`);
      if (res.body.rows[0].data.registerNumber !== '2025CSE070') throw new Error('CSV Reg Number mismatch');
    });

  } catch (err: any) {
    console.error('Fatal error during test run:', err);
  } finally {
    await prisma.$disconnect();
    console.log('\n======================================================');
    console.log(`🏁 Bulk Import Suite: ${passed} PASSED | ${failed} FAILED`);
    console.log('======================================================\n');
    if (failed > 0) process.exit(1);
    else process.exit(0);
  }
}

runBulkImportTests();
