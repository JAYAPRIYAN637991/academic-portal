import request from 'supertest';
import * as xlsx from 'xlsx';
import { createApp } from '../server';
import { prisma } from '../db';

async function runStaffMarksUploadTests() {
  console.log('🧪 Starting Staff Marks Upload (Manual, Excel & CSV) Test Suite...\n');
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

  // Cleanup tracking
  const createdMarkIds: string[] = [];

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

    // Prerequisite entities
    const currentYear = await prisma.academicYear.findFirst({ where: { isCurrent: true } });
    const cseDept = await prisma.department.findUnique({ where: { code: 'CSE' } });
    const eceDept = await prisma.department.findUnique({ where: { code: 'ECE' } });
    const yr3 = await prisma.year.findFirst({ where: { yearNumber: 3 } });

    // Sections: CSE 3A (assigned to Sarah), ECE 3A (unassigned to Sarah)
    const secCSE3A = await prisma.section.findFirst({
      where: { name: 'A', departmentId: cseDept!.id, yearId: yr3!.id, academicYearId: currentYear!.id }
    });
    const secECE3A = await prisma.section.findFirst({
      where: { name: 'A', departmentId: eceDept!.id, yearId: yr3!.id, academicYearId: currentYear!.id }
    });

    // Subjects: DBMS (assigned to Sarah), DC (unassigned to Sarah)
    const subDBMS = await prisma.subject.findUnique({ where: { code: 'CS8501' } });
    const subDC = await prisma.subject.findUnique({ where: { code: 'EC8501' } });

    // Assessment: IA-1 (Max marks 50)
    let ia1 = await prisma.assessment.findFirst({ where: { code: 'IA-1' } });
    if (!ia1) {
      ia1 = await prisma.assessment.create({
        data: { name: 'Internal Assessment 1', code: 'IA-1', maximumMarks: 50, isActive: true }
      });
    }

    // Helper to generate in-memory Excel buffer
    function createExcelBuffer(rows: any[][]): Buffer {
      const ws = xlsx.utils.aoa_to_sheet(rows);
      const wb = xlsx.utils.book_new();
      xlsx.utils.book_append_sheet(wb, ws, 'Marks');
      return xlsx.write(wb, { type: 'buffer', bookType: 'xlsx' });
    }

    console.log('--- SECTION 1: TEMPLATE DOWNLOAD & ASSIGNMENT VERIFICATION ---');

    await assertTest('Staff downloads Excel marks template for assigned class (Sarah -> CSE 3A, DBMS) -> 200 OK', async () => {
      const res = await request(app)
        .get(`/api/staff/marks/template?sectionId=${secCSE3A!.id}&subjectId=${subDBMS!.id}&assessmentId=${ia1!.id}&academicYearId=${currentYear!.id}`)
        .set('Authorization', `Bearer ${staffToken}`)
        .buffer(true)
        .parse((res, callback) => {
          const chunks: Buffer[] = [];
          res.on('data', (chunk) => chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk)));
          res.on('end', () => callback(null, Buffer.concat(chunks)));
        });

      if (res.status !== 200) throw new Error(`Expected 200, got ${res.status}`);
      if (!res.header['content-disposition']?.includes('attachment')) {
        throw new Error('Expected attachment header');
      }

      // Verify Excel contents
      const wb = xlsx.read(res.body, { type: 'buffer' });
      const sheet = wb.Sheets[wb.SheetNames[0]];
      const json: any[] = xlsx.utils.sheet_to_json(sheet);
      if (json.length === 0) throw new Error('Template should contain student rows');
    });

    await assertTest('Unauthorized manipulation: Staff attempts template download for UNASSIGNED class (Sarah -> ECE 3A) -> 403 Forbidden', async () => {
      const res = await request(app)
        .get(`/api/staff/marks/template?sectionId=${secECE3A!.id}&subjectId=${subDC!.id}&assessmentId=${ia1!.id}&academicYearId=${currentYear!.id}`)
        .set('Authorization', `Bearer ${staffToken}`);

      if (res.status !== 403) throw new Error(`Expected 403, got ${res.status}`);
      if (res.body.code !== 'STAFF_CLASS_UNAUTHORIZED') throw new Error(`Expected STAFF_CLASS_UNAUTHORIZED, got ${res.body.code}`);
    });

    console.log('\n--- SECTION 2: EXCEL (.XLSX) MARKS UPLOAD & VALIDATION ---');

    await assertTest('Staff uploads valid Excel file for assigned class -> 200 OK preview (All Valid)', async () => {
      const excelBuffer = createExcelBuffer([
        ['Register Number', 'Student Name', 'Marks'],
        ['723723106001', 'Ethan Vance', 44],
        ['723723106002', 'Chloe Miller', 47]
      ]);

      const res = await request(app)
        .post('/api/staff/marks/upload-preview')
        .set('Authorization', `Bearer ${staffToken}`)
        .field('sectionId', secCSE3A!.id)
        .field('subjectId', subDBMS!.id)
        .field('assessmentId', ia1!.id)
        .field('academicYearId', currentYear!.id)
        .attach('file', excelBuffer, 'class_marks.xlsx');

      if (res.status !== 200) throw new Error(`Expected 200, got ${res.status}: ${JSON.stringify(res.body)}`);
      if (res.body.totalRows !== 2) throw new Error(`Expected 2 totalRows, got ${res.body.totalRows}`);
      if (res.body.validRows !== 2) throw new Error(`Expected 2 validRows, got ${res.body.validRows}`);
      if (res.body.invalidRows !== 0) throw new Error(`Expected 0 invalidRows, got ${res.body.invalidRows}`);
    });

    await assertTest('Staff confirms valid Excel upload -> Marks persisted in database', async () => {
      // Fetch student IDs
      const s1 = await prisma.student.findFirst({ where: { registerNumber: '723723106001' } });
      const s2 = await prisma.student.findFirst({ where: { registerNumber: '723723106002' } });

      const res = await request(app)
        .post('/api/staff/marks/upload-confirm')
        .set('Authorization', `Bearer ${staffToken}`)
        .send({
          sectionId: secCSE3A!.id,
          subjectId: subDBMS!.id,
          assessmentId: ia1!.id,
          academicYearId: currentYear!.id,
          validRows: [
            { studentId: s1!.id, registerNumber: '723723106001', marksObtained: 44 },
            { studentId: s2!.id, registerNumber: '723723106002', marksObtained: 47 }
          ]
        });

      if (res.status !== 200) throw new Error(`Expected 200, got ${res.status}: ${JSON.stringify(res.body)}`);
      if (res.body.totalProcessed !== 2) throw new Error(`Expected 2 processed, got ${res.body.totalProcessed}`);

      // Verify in DB
      const m1 = await prisma.mark.findUnique({
        where: { studentId_subjectId_assessmentId: { studentId: s1!.id, subjectId: subDBMS!.id, assessmentId: ia1!.id } }
      });
      if (!m1 || m1.marksObtained !== 44) throw new Error('Mark 1 was not persisted accurately');
      createdMarkIds.push(m1.id);
    });

    await assertTest('Staff re-uploads with revised scores -> Marks updated & MarkChangeLog recorded', async () => {
      const s1 = await prisma.student.findFirst({ where: { registerNumber: '723723106001' } });

      const res = await request(app)
        .post('/api/staff/marks/upload-confirm')
        .set('Authorization', `Bearer ${staffToken}`)
        .send({
          sectionId: secCSE3A!.id,
          subjectId: subDBMS!.id,
          assessmentId: ia1!.id,
          academicYearId: currentYear!.id,
          reason: 'Score recount verification',
          validRows: [
            { studentId: s1!.id, registerNumber: '723723106001', marksObtained: 48 }
          ]
        });

      if (res.status !== 200) throw new Error(`Expected 200, got ${res.status}`);
      if (res.body.updatedCount !== 1) throw new Error(`Expected 1 updatedCount, got ${res.body.updatedCount}`);

      // Check MarkChangeLog
      const log = await prisma.markChangeLog.findFirst({
        where: { studentId: s1!.id, subjectId: subDBMS!.id, assessmentId: ia1!.id },
        orderBy: { createdAt: 'desc' }
      });

      if (!log || log.previousMarks !== 44 || log.newMarks !== 48) {
        throw new Error('MarkChangeLog was not logged accurately');
      }
    });

    console.log('\n--- SECTION 3: CSV (.CSV) MARKS UPLOAD ---');

    await assertTest('Staff uploads valid CSV file -> 200 OK preview and commit', async () => {
      const csvContent = 'Register Number,Marks\n723723106003,42\n723723106004,39';
      const csvBuffer = Buffer.from(csvContent, 'utf-8');

      const previewRes = await request(app)
        .post('/api/staff/marks/upload-preview')
        .set('Authorization', `Bearer ${staffToken}`)
        .field('sectionId', secCSE3A!.id)
        .field('subjectId', subDBMS!.id)
        .field('assessmentId', ia1!.id)
        .field('academicYearId', currentYear!.id)
        .attach('file', csvBuffer, 'marks.csv');

      if (previewRes.status !== 200) throw new Error(`Expected 200, got ${previewRes.status}`);
      if (previewRes.body.validRows !== 2) throw new Error(`Expected 2 validRows, got ${previewRes.body.validRows}`);

      const s3 = await prisma.student.findFirst({ where: { registerNumber: '723723106003' } });
      const s4 = await prisma.student.findFirst({ where: { registerNumber: '723723106004' } });

      const confirmRes = await request(app)
        .post('/api/staff/marks/upload-confirm')
        .set('Authorization', `Bearer ${staffToken}`)
        .send({
          sectionId: secCSE3A!.id,
          subjectId: subDBMS!.id,
          assessmentId: ia1!.id,
          academicYearId: currentYear!.id,
          validRows: [
            { studentId: s3!.id, registerNumber: '723723106003', marksObtained: 42 },
            { studentId: s4!.id, registerNumber: '723723106004', marksObtained: 39 }
          ]
        });

      if (confirmRes.status !== 200) throw new Error(`Expected 200, got ${confirmRes.status}`);
      if (confirmRes.body.totalProcessed !== 2) throw new Error(`Expected 2 totalProcessed, got ${confirmRes.body.totalProcessed}`);
    });

    console.log('\n--- SECTION 4: UNAUTHORIZED MANIPULATION PREVENTION ---');

    await assertTest('Manipulation 1: Staff attempts upload for unassigned Section -> 403 Forbidden', async () => {
      const buffer = createExcelBuffer([['Register Number', 'Marks'], ['723723106005', 40]]);

      const res = await request(app)
        .post('/api/staff/marks/upload-preview')
        .set('Authorization', `Bearer ${staffToken}`)
        .field('sectionId', secECE3A!.id) // Sarah is NOT assigned to ECE 3A
        .field('subjectId', subDBMS!.id)
        .field('assessmentId', ia1!.id)
        .attach('file', buffer, 'hacked.xlsx');

      if (res.status !== 403) throw new Error(`Expected 403, got ${res.status}`);
      if (res.body.code !== 'STAFF_CLASS_UNAUTHORIZED') throw new Error(`Expected STAFF_CLASS_UNAUTHORIZED, got ${res.body.code}`);
    });

    await assertTest('Manipulation 2: Staff attempts upload for unassigned Subject -> 403 Forbidden', async () => {
      const buffer = createExcelBuffer([['Register Number', 'Marks'], ['723723106001', 40]]);

      const res = await request(app)
        .post('/api/staff/marks/upload-preview')
        .set('Authorization', `Bearer ${staffToken}`)
        .field('sectionId', secCSE3A!.id)
        .field('subjectId', subDC!.id) // Sarah does NOT teach Digital Communication
        .field('assessmentId', ia1!.id)
        .attach('file', buffer, 'hacked_subject.xlsx');

      if (res.status !== 403) throw new Error(`Expected 403, got ${res.status}`);
      if (res.body.code !== 'STAFF_CLASS_UNAUTHORIZED') throw new Error(`Expected STAFF_CLASS_UNAUTHORIZED, got ${res.body.code}`);
    });

    await assertTest('Manipulation 3: Staff attempts confirm for unassigned class -> 403 Forbidden', async () => {
      const s1 = await prisma.student.findFirst({ where: { registerNumber: '723723106001' } });

      const res = await request(app)
        .post('/api/staff/marks/upload-confirm')
        .set('Authorization', `Bearer ${staffToken}`)
        .send({
          sectionId: secECE3A!.id, // Unassigned
          subjectId: subDC!.id,
          assessmentId: ia1!.id,
          academicYearId: currentYear!.id,
          validRows: [{ studentId: s1!.id, registerNumber: '723723106001', marksObtained: 40 }]
        });

      if (res.status !== 403) throw new Error(`Expected 403, got ${res.status}`);
      if (res.body.code !== 'STAFF_CLASS_UNAUTHORIZED') throw new Error(`Expected STAFF_CLASS_UNAUTHORIZED, got ${res.body.code}`);
    });

    await assertTest('Cross-Class Student Injection: Uploading student from another class is flagged INVALID (STUDENT_NOT_IN_SECTION)', async () => {
      // 723723106005 (Liam Davis) belongs to ECE 3A, not CSE 3A
      const buffer = createExcelBuffer([
        ['Register Number', 'Marks'],
        ['723723106001', 40], // Valid student from CSE 3A
        ['723723106005', 45]  // Invalid student from ECE 3A
      ]);

      const res = await request(app)
        .post('/api/staff/marks/upload-preview')
        .set('Authorization', `Bearer ${staffToken}`)
        .field('sectionId', secCSE3A!.id)
        .field('subjectId', subDBMS!.id)
        .field('assessmentId', ia1!.id)
        .field('academicYearId', currentYear!.id)
        .attach('file', buffer, 'mixed_students.xlsx');

      if (res.status !== 200) throw new Error(`Expected 200, got ${res.status}`);
      if (res.body.validRows !== 1) throw new Error(`Expected 1 validRow, got ${res.body.validRows}`);
      if (res.body.invalidRows !== 1) throw new Error(`Expected 1 invalidRow, got ${res.body.invalidRows}`);

      const invalidRow = res.body.rows.find((r: any) => r.registerNumber === '723723106005');
      if (!invalidRow || invalidRow.errorCode !== 'STUDENT_NOT_IN_SECTION') {
        throw new Error(`Expected errorCode STUDENT_NOT_IN_SECTION, got ${invalidRow?.errorCode}`);
      }
    });

    console.log('\n--- SECTION 5: EXHAUSTIVE ROW VALIDATIONS ---');

    await assertTest('Validation 1: Marks exceeding maximum marks is flagged MARKS_EXCEED_MAXIMUM', async () => {
      const exceedValue = (ia1!.maximumMarks || 100) + 15;
      const buffer = createExcelBuffer([
        ['Register Number', 'Marks'],
        ['723723106001', exceedValue]
      ]);

      const res = await request(app)
        .post('/api/staff/marks/upload-preview')
        .set('Authorization', `Bearer ${staffToken}`)
        .field('sectionId', secCSE3A!.id)
        .field('subjectId', subDBMS!.id)
        .field('assessmentId', ia1!.id)
        .attach('file', buffer, 'exceed_max.xlsx');

      if (res.status !== 200) throw new Error(`Expected 200, got ${res.status}`);
      const row = res.body.rows[0];
      if (row.status !== 'INVALID' || row.errorCode !== 'MARKS_EXCEED_MAXIMUM') {
        throw new Error(`Expected MARKS_EXCEED_MAXIMUM, got ${row.errorCode}`);
      }
    });

    await assertTest('Validation 2: Negative marks (-5) is flagged NEGATIVE_MARKS', async () => {
      const buffer = createExcelBuffer([
        ['Register Number', 'Marks'],
        ['723723106001', -5]
      ]);

      const res = await request(app)
        .post('/api/staff/marks/upload-preview')
        .set('Authorization', `Bearer ${staffToken}`)
        .field('sectionId', secCSE3A!.id)
        .field('subjectId', subDBMS!.id)
        .field('assessmentId', ia1!.id)
        .attach('file', buffer, 'neg_marks.xlsx');

      if (res.status !== 200) throw new Error(`Expected 200, got ${res.status}`);
      const row = res.body.rows[0];
      if (row.status !== 'INVALID' || row.errorCode !== 'NEGATIVE_MARKS') {
        throw new Error(`Expected NEGATIVE_MARKS, got ${row.errorCode}`);
      }
    });

    await assertTest('Validation 3: Non-numeric marks ("ABSENT") is flagged NON_NUMERIC_MARKS', async () => {
      const buffer = createExcelBuffer([
        ['Register Number', 'Marks'],
        ['723723106001', 'ABSENT']
      ]);

      const res = await request(app)
        .post('/api/staff/marks/upload-preview')
        .set('Authorization', `Bearer ${staffToken}`)
        .field('sectionId', secCSE3A!.id)
        .field('subjectId', subDBMS!.id)
        .field('assessmentId', ia1!.id)
        .attach('file', buffer, 'non_numeric.xlsx');

      if (res.status !== 200) throw new Error(`Expected 200, got ${res.status}`);
      const row = res.body.rows[0];
      if (row.status !== 'INVALID' || row.errorCode !== 'NON_NUMERIC_MARKS') {
        throw new Error(`Expected NON_NUMERIC_MARKS, got ${row.errorCode}`);
      }
    });

    await assertTest('Validation 4: Non-existent register number is flagged STUDENT_NOT_FOUND', async () => {
      const buffer = createExcelBuffer([
        ['Register Number', 'Marks'],
        ['999999999999', 40]
      ]);

      const res = await request(app)
        .post('/api/staff/marks/upload-preview')
        .set('Authorization', `Bearer ${staffToken}`)
        .field('sectionId', secCSE3A!.id)
        .field('subjectId', subDBMS!.id)
        .field('assessmentId', ia1!.id)
        .attach('file', buffer, 'not_found.xlsx');

      if (res.status !== 200) throw new Error(`Expected 200, got ${res.status}`);
      const row = res.body.rows[0];
      if (row.status !== 'INVALID' || row.errorCode !== 'STUDENT_NOT_FOUND') {
        throw new Error(`Expected STUDENT_NOT_FOUND, got ${row.errorCode}`);
      }
    });

    await assertTest('Validation 5: Duplicate register number in same file is flagged DUPLICATE_IN_FILE', async () => {
      const buffer = createExcelBuffer([
        ['Register Number', 'Marks'],
        ['723723106001', 40],
        ['723723106001', 45] // Duplicate row
      ]);

      const res = await request(app)
        .post('/api/staff/marks/upload-preview')
        .set('Authorization', `Bearer ${staffToken}`)
        .field('sectionId', secCSE3A!.id)
        .field('subjectId', subDBMS!.id)
        .field('assessmentId', ia1!.id)
        .attach('file', buffer, 'dupe_marks.xlsx');

      if (res.status !== 200) throw new Error(`Expected 200, got ${res.status}`);
      if (res.body.duplicateRows !== 1) throw new Error(`Expected 1 duplicateRow, got ${res.body.duplicateRows}`);
      const row = res.body.rows[1];
      if (row.status !== 'DUPLICATE' || row.errorCode !== 'DUPLICATE_IN_FILE') {
        throw new Error(`Expected DUPLICATE_IN_FILE, got ${row.errorCode}`);
      }
    });

    console.log('\n--- SECTION 6: BATCH MANUAL ENTRY ---');

    await assertTest('Staff submits batch manual marks entry for assigned class -> 200 OK', async () => {
      const s1 = await prisma.student.findFirst({ where: { registerNumber: '723723106001' } });
      const s2 = await prisma.student.findFirst({ where: { registerNumber: '723723106002' } });

      const res = await request(app)
        .post('/api/staff/marks/batch')
        .set('Authorization', `Bearer ${staffToken}`)
        .send({
          sectionId: secCSE3A!.id,
          subjectId: subDBMS!.id,
          assessmentId: ia1!.id,
          academicYearId: currentYear!.id,
          entries: [
            { studentId: s1!.id, marksObtained: 46 },
            { studentId: s2!.id, marksObtained: 49 }
          ]
        });

      if (res.status !== 200) throw new Error(`Expected 200, got ${res.status}: ${JSON.stringify(res.body)}`);
      if (res.body.total !== 2) throw new Error(`Expected 2 total saved, got ${res.body.total}`);
    });

    await assertTest('Staff submits batch manual marks entry for unassigned class -> 403 Forbidden', async () => {
      const s5 = await prisma.student.findFirst({ where: { registerNumber: '723723106005' } });

      const res = await request(app)
        .post('/api/staff/marks/batch')
        .set('Authorization', `Bearer ${staffToken}`)
        .send({
          sectionId: secECE3A!.id,
          subjectId: subDC!.id,
          assessmentId: ia1!.id,
          entries: [
            { studentId: s5!.id, marksObtained: 38 }
          ]
        });

      if (res.status !== 403) throw new Error(`Expected 403, got ${res.status}`);
      if (res.body.code !== 'STAFF_CLASS_UNAUTHORIZED') throw new Error(`Expected STAFF_CLASS_UNAUTHORIZED, got ${res.body.code}`);
    });

    console.log('\n--- SECTION 7: ADMIN CLEARANCE & STAFF BOUNDARY RESTRICTIONS ---');

    await assertTest('Admin uploads/edits marks for any class (ECE 3A) -> 200 OK (Full Clearance)', async () => {
      const s5 = await prisma.student.findFirst({ where: { registerNumber: '723723106005' } });

      const res = await request(app)
        .post('/api/admin/marks/batch')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          sectionId: secECE3A!.id,
          subjectId: subDC!.id,
          assessmentId: ia1!.id,
          academicYearId: currentYear!.id,
          entries: [{ studentId: s5!.id, marksObtained: 43 }]
        });

      if (res.status !== 200) throw new Error(`Expected 200, got ${res.status}`);
      if (res.body.total !== 1) throw new Error(`Expected 1 total, got ${res.body.total}`);
    });

    await assertTest('Staff CANNOT access Admin Analytics (/api/admin/analytics/overall) -> 403 Forbidden', async () => {
      const res = await request(app)
        .get('/api/admin/analytics/overall')
        .set('Authorization', `Bearer ${staffToken}`);

      if (res.status !== 403) throw new Error(`Expected 403, got ${res.status}`);
      if (res.body.code !== 'ADMIN_ACCESS_REQUIRED') throw new Error(`Expected ADMIN_ACCESS_REQUIRED, got ${res.body.code}`);
    });

    await assertTest('Staff CANNOT access Admin Student Management (/api/admin/students) -> 403 Forbidden', async () => {
      const res = await request(app)
        .get('/api/admin/students')
        .set('Authorization', `Bearer ${staffToken}`);

      if (res.status !== 403) throw new Error(`Expected 403, got ${res.status}`);
      if (res.body.code !== 'ADMIN_ACCESS_REQUIRED') throw new Error(`Expected ADMIN_ACCESS_REQUIRED, got ${res.body.code}`);
    });

    await assertTest('Staff CANNOT access Admin Audit Logs (/api/admin/audit-logs) -> 403 Forbidden', async () => {
      const res = await request(app)
        .get('/api/admin/audit-logs')
        .set('Authorization', `Bearer ${staffToken}`);

      if (res.status !== 403) throw new Error(`Expected 403, got ${res.status}`);
      if (res.body.code !== 'ADMIN_ACCESS_REQUIRED') throw new Error(`Expected ADMIN_ACCESS_REQUIRED, got ${res.body.code}`);
    });

  } finally {
    console.log('\n🧹 Cleaning up marks test data...');
  }

  console.log('\n======================================================');
  console.log(`🏁 Staff Marks Upload Suite: ${passed} PASSED | ${failed} FAILED`);
  console.log('======================================================\n');

  if (failed > 0) {
    process.exit(1);
  }
}

runStaffMarksUploadTests().catch(err => {
  console.error('Fatal test error:', err);
  process.exit(1);
});
