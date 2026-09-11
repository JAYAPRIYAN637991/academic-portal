import request from 'supertest';
import { createApp } from '../server';
import { prisma } from '../db';

async function runAdminDashboardTests() {
  console.log('🏛️ Starting Complete Institutional Admin Dashboard Test Suite...\n');
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
    // SETUP: Authenticate Admin & Staff
    // -------------------------------------------------------------------------
    const adminLoginRes = await request(app)
      .post('/api/auth/login')
      .send({ email: 'admin@college.edu', password: 'admin123' });
    const adminToken = adminLoginRes.body.token;

    const staffLoginRes = await request(app)
      .post('/api/auth/login')
      .send({ email: 'sarah.cse@college.edu', password: 'staff123' });
    const staffToken = staffLoginRes.body.token;

    // -------------------------------------------------------------------------
    // SUITE 1: Admin Access & Strict RBAC
    // -------------------------------------------------------------------------
    console.log('--- SUITE 1: Admin Clearance & Strict RBAC Protection ---');

    await assertTest('Admin user successfully accesses /api/admin/dashboard-summary (200 OK)', async () => {
      const res = await request(app)
        .get('/api/admin/dashboard-summary')
        .set('Authorization', `Bearer ${adminToken}`);

      if (res.status !== 200) throw new Error(`Expected 200 OK, got ${res.status}`);
      if (!res.body.success) throw new Error('Expected success: true');
    });

    await assertTest('Staff user attempting to access /api/admin/dashboard-summary is BLOCKED (403 Forbidden)', async () => {
      const res = await request(app)
        .get('/api/admin/dashboard-summary')
        .set('Authorization', `Bearer ${staffToken}`);

      if (res.status !== 403) throw new Error(`Expected 403 Forbidden, got ${res.status}`);
      if (res.body.code !== 'ADMIN_ACCESS_REQUIRED') {
        throw new Error(`Expected error code ADMIN_ACCESS_REQUIRED, got ${res.body.code}`);
      }
    });

    await assertTest('Unauthenticated request to /api/admin/dashboard-summary is BLOCKED (401 Unauthorized)', async () => {
      const res = await request(app)
        .get('/api/admin/dashboard-summary');

      if (res.status !== 401) throw new Error(`Expected 401 Unauthorized, got ${res.status}`);
    });

    // -------------------------------------------------------------------------
    // SUITE 2: All 8 Dashboard Cards Data Verification
    // -------------------------------------------------------------------------
    console.log('\n--- SUITE 2: 8 Core Dashboard Cards Data Integrity ---');

    let summaryData: any;
    const summaryRes = await request(app)
      .get('/api/admin/dashboard-summary')
      .set('Authorization', `Bearer ${adminToken}`);
    summaryData = summaryRes.body;

    await assertTest('Card 1: Total Students metric is present and valid', () => {
      const val = summaryData.totalStudents ?? summaryData.cards?.totalStudents;
      if (typeof val !== 'number' || val < 0) throw new Error(`Invalid totalStudents: ${val}`);
    });

    await assertTest('Card 2: Total Staff metric is present and valid', () => {
      const val = summaryData.totalStaff ?? summaryData.cards?.totalStaff;
      if (typeof val !== 'number' || val < 0) throw new Error(`Invalid totalStaff: ${val}`);
    });

    await assertTest('Card 3: Departments metric is present and valid', () => {
      const val = summaryData.departments ?? summaryData.cards?.departments;
      if (typeof val !== 'number' || val <= 0) throw new Error(`Invalid departments: ${val}`);
    });

    await assertTest('Card 4: Sections metric is present and valid', () => {
      const val = summaryData.sections ?? summaryData.cards?.sections;
      if (typeof val !== 'number' || val <= 0) throw new Error(`Invalid sections: ${val}`);
    });

    await assertTest('Card 5: IA-1 Average metric is present and valid', () => {
      const val = summaryData.ia1Average ?? summaryData.cards?.ia1Average;
      if (val !== null && typeof val !== 'number') throw new Error(`Invalid ia1Average: ${val}`);
    });

    await assertTest('Card 6: IA-2 Average metric is present and valid', () => {
      const val = summaryData.ia2Average ?? summaryData.cards?.ia2Average;
      if (val !== null && typeof val !== 'number') throw new Error(`Invalid ia2Average: ${val}`);
    });

    await assertTest('Card 7: Overall Improvement metric is present and valid', () => {
      const val = summaryData.overallImprovement ?? summaryData.cards?.overallImprovement;
      if (val !== null && typeof val !== 'number') throw new Error(`Invalid overallImprovement: ${val}`);
    });

    await assertTest('Card 8: Pass Percentage metric is present and valid', () => {
      const val = summaryData.passPercentage ?? summaryData.cards?.passPercentage;
      if (typeof val !== 'number' || val < 0 || val > 100) throw new Error(`Invalid passPercentage: ${val}`);
    });

    // -------------------------------------------------------------------------
    // SUITE 3: Additional Academic Sections
    // -------------------------------------------------------------------------
    console.log('\n--- SUITE 3: Additional Academic Sections ---');

    await assertTest('Section: Performance Overview contains institutional statistics', () => {
      const p = summaryData.performanceOverview;
      if (!p) throw new Error('performanceOverview missing');
      if (typeof p.totalStudents !== 'number') throw new Error('totalStudents missing in performanceOverview');
      if (typeof p.overallPassPercentage !== 'number') throw new Error('overallPassPercentage missing in performanceOverview');
      if (!p.benchmarkStatus) throw new Error('benchmarkStatus missing in performanceOverview');
    });

    await assertTest('Section: Department Performance contains department rankings and statistics', () => {
      const depts = summaryData.departmentPerformance;
      if (!Array.isArray(depts)) throw new Error('departmentPerformance is not an array');
      if (depts.length === 0) throw new Error('departmentPerformance is empty');
      const first = depts[0];
      if (!first.name || !first.code || typeof first.totalStudents !== 'number') {
        throw new Error(`Invalid department item: ${JSON.stringify(first)}`);
      }
    });

    await assertTest('Section: Year Performance contains cohort breakdown (1st to 4th Year)', () => {
      const years = summaryData.yearPerformance;
      if (!Array.isArray(years)) throw new Error('yearPerformance is not an array');
      if (years.length === 0) throw new Error('yearPerformance is empty');
      const first = years[0];
      if (!first.name || typeof first.totalStudents !== 'number') {
        throw new Error(`Invalid year item: ${JSON.stringify(first)}`);
      }
    });

    await assertTest('Section: Section Performance contains class section analytics', () => {
      const secs = summaryData.sectionPerformance;
      if (!Array.isArray(secs)) throw new Error('sectionPerformance is not an array');
      if (secs.length === 0) throw new Error('sectionPerformance is empty');
      const first = secs[0];
      if (!first.sectionName || !first.departmentCode) {
        throw new Error(`Invalid section item: ${JSON.stringify(first)}`);
      }
    });

    await assertTest('Section: Top Students contains high-performing roster', () => {
      const top = summaryData.topStudents;
      if (!Array.isArray(top)) throw new Error('topStudents is not an array');
      if (top.length > 0) {
        const first = top[0];
        if (!first.studentName || !first.registerNumber || typeof first.percentage !== 'number') {
          throw new Error(`Invalid top student item: ${JSON.stringify(first)}`);
        }
      }
    });

    await assertTest('Section: Students Needing Attention contains intervention roster', () => {
      const att = summaryData.studentsNeedingAttention;
      if (!Array.isArray(att)) throw new Error('studentsNeedingAttention is not an array');
      // If there are at-risk students, check attributes
      if (att.length > 0) {
        const first = att[0];
        if (!first.studentName || !first.registerNumber) {
          throw new Error(`Invalid student needing attention: ${JSON.stringify(first)}`);
        }
      }
    });

    // -------------------------------------------------------------------------
    // SUITE 4: College Notices (Draft, Scheduled, Published)
    // -------------------------------------------------------------------------
    console.log('\n--- SUITE 4: College Notices Queue & Status Metrics ---');

    await assertTest('College Notices contains draft, scheduled, and published counts', () => {
      const n = summaryData.collegeNotices;
      if (!n) throw new Error('collegeNotices missing');
      if (typeof n.draft !== 'number') throw new Error(`Invalid draft count: ${n.draft}`);
      if (typeof n.scheduled !== 'number') throw new Error(`Invalid scheduled count: ${n.scheduled}`);
      if (typeof n.published !== 'number') throw new Error(`Invalid published count: ${n.published}`);
      if (!Array.isArray(n.recent)) throw new Error('recent notices missing');
    });

    // -------------------------------------------------------------------------
    // SUITE 5: Notifications Queue (Pending, Sent, Delivered, Failed)
    // -------------------------------------------------------------------------
    console.log('\n--- SUITE 5: Notifications Queue Statuses ---');

    await assertTest('Notifications contains pending, sent, delivered, and failed counts', () => {
      const notif = summaryData.notifications;
      if (!notif) throw new Error('notifications missing');
      if (typeof notif.pending !== 'number') throw new Error(`Invalid pending: ${notif.pending}`);
      if (typeof notif.sent !== 'number') throw new Error(`Invalid sent: ${notif.sent}`);
      if (typeof notif.delivered !== 'number') throw new Error(`Invalid delivered: ${notif.delivered}`);
      if (typeof notif.failed !== 'number') throw new Error(`Invalid failed: ${notif.failed}`);
      if (typeof notif.deliveryRate !== 'number') throw new Error(`Invalid deliveryRate: ${notif.deliveryRate}`);
    });

    // -------------------------------------------------------------------------
    // SUMMARY
    // -------------------------------------------------------------------------
    console.log('\n======================================================');
    console.log(`🏛️ Complete Institutional Admin Dashboard Test Summary:`);
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

runAdminDashboardTests();
