import request from 'supertest';
import { createApp } from '../server';
import { prisma } from '../db';
import { AuditAction } from '../services/audit.service';

async function runAdminReportingTests() {
  console.log('📑 Starting Institutional Admin & Staff Reporting Test Suite...\n');
  const app = createApp();

  let passed = 0;
  let failed = 0;

  async function assertTest(name: string, fn: () => Promise<void> | void) {
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
    // -------------------------------------------------------------------------
    // SETUP: Authenticate Admin & Staff Users
    // -------------------------------------------------------------------------
    const adminLoginRes = await request(app)
      .post('/api/auth/login')
      .send({ email: 'admin@college.edu', password: 'admin123' });
    const adminToken = adminLoginRes.body.token;
    const adminUser = adminLoginRes.body.user;

    const staffLoginRes = await request(app)
      .post('/api/auth/login')
      .send({ email: 'sarah.cse@college.edu', password: 'staff123' });
    const staffToken = staffLoginRes.body.token;
    const staffUser = staffLoginRes.body.user;

    // Fetch assigned section for Sarah (CSE teacher)
    const assignment = await prisma.teacherAssignment.findFirst({
      where: { staffId: staffUser.id }
    });

    const assignedSectionId = assignment?.sectionId;

    // Find an unassigned section (e.g. ECE or MECH section)
    const unassignedSection = await prisma.section.findFirst({
      where: {
        id: { not: assignedSectionId || '' }
      }
    });

    // -------------------------------------------------------------------------
    // SUITE 1: Report Catalog & Metadata
    // -------------------------------------------------------------------------
    console.log('--- SUITE 1: Report Catalog & Definition Metadata ---');

    await assertTest('GET /api/admin/reports/types returns all 7 institutional reports', async () => {
      const res = await request(app)
        .get('/api/admin/reports/types')
        .set('Authorization', `Bearer ${adminToken}`);

      if (res.status !== 200) throw new Error(`Expected status 200, got ${res.status}`);
      if (!Array.isArray(res.body.reports)) throw new Error('Expected reports array');
      if (res.body.reports.length !== 7) throw new Error(`Expected 7 reports, got ${res.body.reports.length}`);

      const ids = res.body.reports.map((r: any) => r.id);
      const expectedIds = [
        'student-performance',
        'section-performance',
        'year-performance',
        'department-performance',
        'overall-college',
        'notifications',
        'notices'
      ];

      for (const exp of expectedIds) {
        if (!ids.includes(exp)) throw new Error(`Missing expected report type: ${exp}`);
      }
    });

    await assertTest('Report definitions include supported export formats (pdf, excel, csv)', async () => {
      const res = await request(app)
        .get('/api/admin/reports/types')
        .set('Authorization', `Bearer ${adminToken}`);

      for (const rep of res.body.reports) {
        if (!rep.formats.includes('pdf') || !rep.formats.includes('excel') || !rep.formats.includes('csv')) {
          throw new Error(`Report ${rep.id} missing formats: ${JSON.stringify(rep.formats)}`);
        }
      }
    });

    // -------------------------------------------------------------------------
    // SUITE 2: Export Format Verification (PDF, Excel, CSV, JSON)
    // -------------------------------------------------------------------------
    console.log('\n--- SUITE 2: Export Formats & Binary Header Verification ---');

    await assertTest('PDF format exports binary buffer with %PDF- header', async () => {
      const res = await request(app)
        .get('/api/admin/reports/student-performance?format=pdf')
        .set('Authorization', `Bearer ${adminToken}`)
        .responseType('blob');

      if (res.status !== 200) throw new Error(`Expected status 200, got ${res.status}`);
      if (!res.headers['content-type']?.includes('application/pdf')) {
        throw new Error(`Expected application/pdf, got ${res.headers['content-type']}`);
      }
      if (!res.headers['content-disposition']?.includes('.pdf')) {
        throw new Error(`Expected Content-Disposition to include .pdf, got ${res.headers['content-disposition']}`);
      }

      const buffer = Buffer.from(res.body);
      const magicBytes = buffer.subarray(0, 5).toString('ascii');
      if (magicBytes !== '%PDF-') {
        throw new Error(`Expected PDF magic bytes "%PDF-", got "${magicBytes}"`);
      }
    });

    await assertTest('Excel (.xlsx) format exports OpenXML spreadsheet with PK zip header', async () => {
      const res = await request(app)
        .get('/api/admin/reports/student-performance?format=excel')
        .set('Authorization', `Bearer ${adminToken}`)
        .responseType('blob');

      if (res.status !== 200) throw new Error(`Expected status 200, got ${res.status}`);
      if (!res.headers['content-type']?.includes('spreadsheetml.sheet')) {
        throw new Error(`Expected spreadsheetml.sheet, got ${res.headers['content-type']}`);
      }
      if (!res.headers['content-disposition']?.includes('.xlsx')) {
        throw new Error(`Expected Content-Disposition to include .xlsx, got ${res.headers['content-disposition']}`);
      }

      const buffer = Buffer.from(res.body);
      const magicBytes = buffer.subarray(0, 2).toString('ascii');
      if (magicBytes !== 'PK') {
        throw new Error(`Expected ZIP/OpenXML magic bytes "PK", got "${magicBytes}"`);
      }
    });

    await assertTest('CSV format exports UTF-8 BOM and valid comma-separated headers', async () => {
      const res = await request(app)
        .get('/api/admin/reports/student-performance?format=csv')
        .set('Authorization', `Bearer ${adminToken}`);

      if (res.status !== 200) throw new Error(`Expected status 200, got ${res.status}`);
      if (!res.headers['content-type']?.includes('text/csv')) {
        throw new Error(`Expected text/csv, got ${res.headers['content-type']}`);
      }

      const text = res.text;
      if (!text.startsWith('\uFEFF')) {
        throw new Error('Expected UTF-8 BOM at start of CSV export');
      }
      if (!text.includes('College') || !text.includes('Register Number') || !text.includes('Pass percentage')) {
        throw new Error('Missing mandatory columns in CSV export');
      }
    });

    await assertTest('JSON format returns structured report payload with metadata and summary', async () => {
      const res = await request(app)
        .get('/api/admin/reports/student-performance?format=json')
        .set('Authorization', `Bearer ${adminToken}`);

      if (res.status !== 200) throw new Error(`Expected status 200, got ${res.status}`);
      if (!res.body.reportId || !Array.isArray(res.body.data) || !Array.isArray(res.body.columns)) {
        throw new Error(`Invalid JSON report structure: ${JSON.stringify(Object.keys(res.body))}`);
      }
      if (typeof res.body.rowCount !== 'number') {
        throw new Error('Missing rowCount in JSON response');
      }
    });

    // -------------------------------------------------------------------------
    // SUITE 3: Content Verification for All 7 Reports (Mandatory Columns)
    // -------------------------------------------------------------------------
    console.log('\n--- SUITE 3: Content Verification for All 7 Reports ---');

    await assertTest('Report 1 (Student Performance) contains all 12 mandatory specification fields', async () => {
      const res = await request(app)
        .get('/api/admin/reports/student-performance?format=json')
        .set('Authorization', `Bearer ${adminToken}`);

      if (res.status !== 200) throw new Error(`Status ${res.status}`);
      const requiredColumns = [
        'College',
        'Academic Year',
        'Department',
        'Year',
        'Section',
        'Student',
        'Register Number',
        'IA-1',
        'IA-2',
        'Improvement',
        'Status',
        'Pass percentage'
      ];

      for (const col of requiredColumns) {
        if (!res.body.columns.includes(col)) {
          throw new Error(`Missing required column: "${col}". Found: ${res.body.columns.join(', ')}`);
        }
      }

      if (res.body.data.length > 0) {
        const first = res.body.data[0];
        const requiredKeys = [
          'college',
          'academicYear',
          'department',
          'year',
          'section',
          'student',
          'registerNumber',
          'ia1',
          'ia2',
          'improvement',
          'status',
          'passPercentage'
        ];
        for (const key of requiredKeys) {
          if (!(key in first)) {
            throw new Error(`First row missing key "${key}"`);
          }
        }
      }
    });

    await assertTest('Report 2 (Section Performance) contains section-level aggregated metrics', async () => {
      const res = await request(app)
        .get('/api/admin/reports/section-performance?format=json')
        .set('Authorization', `Bearer ${adminToken}`);

      if (res.status !== 200) throw new Error(`Status ${res.status}`);
      const requiredColumns = [
        'College',
        'Academic Year',
        'Department',
        'Year',
        'Section',
        'Total Students',
        'IA-1 Avg (%)',
        'IA-2 Avg (%)',
        'Improvement (%)',
        'Pass %',
        'Status'
      ];

      for (const col of requiredColumns) {
        if (!res.body.columns.includes(col)) {
          throw new Error(`Section report missing column "${col}"`);
        }
      }
    });

    await assertTest('Report 3 (Year Performance) contains 1st-4th cohort comparisons', async () => {
      const res = await request(app)
        .get('/api/admin/reports/year-performance?format=json')
        .set('Authorization', `Bearer ${adminToken}`);

      if (res.status !== 200) throw new Error(`Status ${res.status}`);
      if (!res.body.columns.includes('Year') || !res.body.columns.includes('IA-1 Average (%)') || !res.body.columns.includes('Pass %')) {
        throw new Error(`Year report missing required columns: ${res.body.columns.join(', ')}`);
      }
    });

    await assertTest('Report 4 (Department Performance) contains faculty counts, section counts, and rankings', async () => {
      const res = await request(app)
        .get('/api/admin/reports/department-performance?format=json')
        .set('Authorization', `Bearer ${adminToken}`);

      if (res.status !== 200) throw new Error(`Status ${res.status}`);
      const cols = res.body.columns;
      if (!cols.includes('Department') || !cols.includes('Code') || !cols.includes('Total Faculty') || !cols.includes('Rank')) {
        throw new Error(`Department report missing columns: ${cols.join(', ')}`);
      }
    });

    await assertTest('Report 5 (Overall College Result) contains institutional executive summary', async () => {
      const res = await request(app)
        .get('/api/admin/reports/overall-college?format=json')
        .set('Authorization', `Bearer ${adminToken}`);

      if (res.status !== 200) throw new Error(`Status ${res.status}`);
      if (!res.body.columns.includes('Metric') || !res.body.columns.includes('Value')) {
        throw new Error(`Overall college report missing metric columns: ${res.body.columns.join(', ')}`);
      }
    });

    await assertTest('Report 6 (Notification Report) contains all 8 specified notification metrics', async () => {
      const res = await request(app)
        .get('/api/admin/reports/notifications?format=json')
        .set('Authorization', `Bearer ${adminToken}`);

      if (res.status !== 200) throw new Error(`Status ${res.status}`);
      const requiredColumns = [
        'Notice',
        'Notification category',
        'Recipient count',
        'SMS count',
        'WhatsApp count',
        'Sent',
        'Delivered',
        'Failed'
      ];

      for (const col of requiredColumns) {
        if (!res.body.columns.includes(col)) {
          throw new Error(`Notification report missing column: "${col}". Columns: ${res.body.columns.join(', ')}`);
        }
      }
    });

    await assertTest('Report 7 (College Notice Report) contains notice publication registry', async () => {
      const res = await request(app)
        .get('/api/admin/reports/notices?format=json')
        .set('Authorization', `Bearer ${adminToken}`);

      if (res.status !== 200) throw new Error(`Status ${res.status}`);
      const cols = res.body.columns;
      if (!cols.includes('Title') || !cols.includes('Type / Category') || !cols.includes('Target Audience') || !cols.includes('Status')) {
        throw new Error(`Notice report missing columns: ${cols.join(', ')}`);
      }
    });

    // -------------------------------------------------------------------------
    // SUITE 4: Role-Based Access Control (RBAC) & Security Enforcement
    // -------------------------------------------------------------------------
    console.log('\n--- SUITE 4: Strict RBAC & College-Wide Scope Restrictions ---');

    await assertTest('Staff member is BLOCKED (403) from Year Performance report', async () => {
      const res = await request(app)
        .get('/api/staff/reports/year-performance?format=json')
        .set('Authorization', `Bearer ${staffToken}`);

      if (res.status !== 403) throw new Error(`Expected 403 Forbidden, got ${res.status}`);
      if (res.body.code !== 'COLLEGE_WIDE_REPORTS_RESTRICTED') {
        throw new Error(`Expected error code COLLEGE_WIDE_REPORTS_RESTRICTED, got ${res.body.code}`);
      }
    });

    await assertTest('Staff member is BLOCKED (403) from Department Performance report', async () => {
      const res = await request(app)
        .get('/api/staff/reports/department-performance?format=json')
        .set('Authorization', `Bearer ${staffToken}`);

      if (res.status !== 403) throw new Error(`Expected 403 Forbidden, got ${res.status}`);
      if (res.body.code !== 'COLLEGE_WIDE_REPORTS_RESTRICTED') {
        throw new Error(`Expected code COLLEGE_WIDE_REPORTS_RESTRICTED, got ${res.body.code}`);
      }
    });

    await assertTest('Staff member is BLOCKED (403) from Overall College Result report', async () => {
      const res = await request(app)
        .get('/api/staff/reports/overall-college?format=json')
        .set('Authorization', `Bearer ${staffToken}`);

      if (res.status !== 403) throw new Error(`Expected 403 Forbidden, got ${res.status}`);
      if (res.body.code !== 'COLLEGE_WIDE_REPORTS_RESTRICTED') {
        throw new Error(`Expected code COLLEGE_WIDE_REPORTS_RESTRICTED, got ${res.body.code}`);
      }
    });

    await assertTest('Staff member is BLOCKED (403) from Notification Report', async () => {
      const res = await request(app)
        .get('/api/staff/reports/notifications?format=json')
        .set('Authorization', `Bearer ${staffToken}`);

      if (res.status !== 403) throw new Error(`Expected 403 Forbidden, got ${res.status}`);
      if (res.body.code !== 'COLLEGE_WIDE_REPORTS_RESTRICTED') {
        throw new Error(`Expected code COLLEGE_WIDE_REPORTS_RESTRICTED, got ${res.body.code}`);
      }
    });

    await assertTest('Staff member is BLOCKED (403) from College Notice Report', async () => {
      const res = await request(app)
        .get('/api/staff/reports/notices?format=json')
        .set('Authorization', `Bearer ${staffToken}`);

      if (res.status !== 403) throw new Error(`Expected 403 Forbidden, got ${res.status}`);
      if (res.body.code !== 'COLLEGE_WIDE_REPORTS_RESTRICTED') {
        throw new Error(`Expected code COLLEGE_WIDE_REPORTS_RESTRICTED, got ${res.body.code}`);
      }
    });

    await assertTest('Staff member is BLOCKED (403) from direct Admin reports endpoint', async () => {
      const res = await request(app)
        .get('/api/admin/reports/student-performance?format=json')
        .set('Authorization', `Bearer ${staffToken}`);

      if (res.status !== 403) throw new Error(`Expected 403 Forbidden, got ${res.status}`);
    });

    if (unassignedSection) {
      await assertTest('Staff member is BLOCKED (403) from unassigned section performance report', async () => {
        const res = await request(app)
          .get(`/api/staff/reports/student-performance?sectionId=${unassignedSection.id}&format=json`)
          .set('Authorization', `Bearer ${staffToken}`);

        if (res.status !== 403) throw new Error(`Expected 403 Forbidden, got ${res.status}`);
        if (res.body.code !== 'STAFF_SECTION_UNAUTHORIZED') {
          throw new Error(`Expected STAFF_SECTION_UNAUTHORIZED, got ${res.body.code}`);
        }
      });
    }

    if (assignedSectionId) {
      await assertTest('Staff member is PERMITTED (200) to view report for their assigned section', async () => {
        const res = await request(app)
          .get(`/api/staff/reports/student-performance?sectionId=${assignedSectionId}&format=json`)
          .set('Authorization', `Bearer ${staffToken}`);

        if (res.status !== 200) throw new Error(`Expected 200 OK, got ${res.status}: ${JSON.stringify(res.body)}`);
      });
    }

    await assertTest('Unauthenticated request to reports endpoint is BLOCKED (401)', async () => {
      const res = await request(app)
        .get('/api/admin/reports/student-performance?format=json');

      if (res.status !== 401) throw new Error(`Expected 401 Unauthorized, got ${res.status}`);
    });

    // -------------------------------------------------------------------------
    // SUITE 5: Audit Trail Verification (REPORT_GENERATED)
    // -------------------------------------------------------------------------
    console.log('\n--- SUITE 5: Audit Trail Logging Verification ---');

    await assertTest('Audit log record is created with action REPORT_GENERATED on export', async () => {
      const preCount = await prisma.auditLog.count({
        where: { action: AuditAction.REPORT_GENERATED }
      });

      const res = await request(app)
        .get('/api/admin/reports/student-performance?format=excel')
        .set('Authorization', `Bearer ${adminToken}`);

      if (res.status !== 200) throw new Error(`Status ${res.status}`);

      const postCount = await prisma.auditLog.count({
        where: { action: AuditAction.REPORT_GENERATED }
      });

      if (postCount <= preCount) {
        throw new Error(`Expected audit log count to increase. Pre: ${preCount}, Post: ${postCount}`);
      }

      const latestLog = await prisma.auditLog.findFirst({
        where: { action: AuditAction.REPORT_GENERATED },
        orderBy: { createdAt: 'desc' }
      });

      if (!latestLog) throw new Error('No audit log found');
      if (latestLog.userId !== adminUser.id) {
        throw new Error(`Expected userId ${adminUser.id}, got ${latestLog.userId}`);
      }

      const details = (latestLog.metadata as any) || {};
      if (details.reportType !== 'student-performance' || details.format !== 'excel') {
        throw new Error(`Incorrect audit details: ${JSON.stringify(details)}`);
      }
    });

    // -------------------------------------------------------------------------
    // SUMMARY
    // -------------------------------------------------------------------------
    console.log('\n======================================================');
    console.log(`📑 Institutional Admin Reporting Test Summary:`);
    console.log(`   Passed: ${passed}`);
    console.log(`   Failed: ${failed}`);
    console.log('======================================================\n');

    if (failed > 0) {
      process.exit(1);
    }
  } catch (err: any) {
    console.error('Fatal error during test execution:', err);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

runAdminReportingTests();
