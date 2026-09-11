import request from 'supertest';
import { createApp } from '../server';
import { prisma } from '../db';

async function runAdminAnalyticsTests() {
  console.log('🧪 Starting Admin-Only Analytics Test Suite...\n');
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
    // 1. Authenticate Admin and Staff
    const adminLogin = await request(app)
      .post('/api/auth/login')
      .send({ email: 'admin@college.edu', password: 'admin123' });
    const adminToken = adminLogin.body.token;

    const staffLogin = await request(app)
      .post('/api/auth/login')
      .send({ email: 'sarah.cse@college.edu', password: 'staff123' });
    const staffToken = staffLogin.body.token;

    if (!adminToken) throw new Error('Failed to acquire admin token');
    if (!staffToken) throw new Error('Failed to acquire staff token');

    // Retrieve database references
    const cseDept = await prisma.department.findUnique({ where: { code: 'CSE' } });
    const yr3 = await prisma.year.findFirst({ where: { yearNumber: 3 } });
    const currentYear = await prisma.academicYear.findFirst({ where: { isCurrent: true } });
    const secCSE3A = await prisma.section.findFirst({
      where: { name: 'A', departmentId: cseDept!.id, yearId: yr3!.id }
    });
    const cseStudent = await prisma.student.findFirst({
      where: { sectionId: secCSE3A!.id }
    });
    const javaSubject = await prisma.subject.findFirst({
      where: { departmentId: cseDept!.id, yearId: yr3!.id }
    });

    // =======================================================================
    // SUITE 1: STRICT ROLE-BASED ACCESS CONTROL (ADMIN ONLY)
    // =======================================================================
    console.log('--- SUITE 1: Strict RBAC Protection (Staff 403, Missing Auth 401) ---');

    await assertTest('RBAC 1.1: Unauthenticated request to /analytics/overall returns 401 Unauthorized', async () => {
      const res = await request(app).get('/api/admin/analytics/overall');
      if (res.status !== 401) throw new Error(`Expected 401, got ${res.status}`);
    });

    await assertTest('RBAC 1.2: Staff user accessing /analytics/overall returns 403 Forbidden', async () => {
      const res = await request(app)
        .get('/api/admin/analytics/overall')
        .set('Authorization', `Bearer ${staffToken}`);
      if (res.status !== 403) throw new Error(`Expected 403, got ${res.status}`);
    });

    await assertTest('RBAC 1.3: Staff user accessing /analytics/departments returns 403 Forbidden', async () => {
      const res = await request(app)
        .get('/api/admin/analytics/departments')
        .set('Authorization', `Bearer ${staffToken}`);
      if (res.status !== 403) throw new Error(`Expected 403, got ${res.status}`);
    });

    await assertTest('RBAC 1.4: Staff user accessing /analytics/years returns 403 Forbidden', async () => {
      const res = await request(app)
        .get('/api/admin/analytics/years')
        .set('Authorization', `Bearer ${staffToken}`);
      if (res.status !== 403) throw new Error(`Expected 403, got ${res.status}`);
    });

    await assertTest('RBAC 1.5: Staff user accessing /analytics/sections returns 403 Forbidden', async () => {
      const res = await request(app)
        .get('/api/admin/analytics/sections')
        .set('Authorization', `Bearer ${staffToken}`);
      if (res.status !== 403) throw new Error(`Expected 403, got ${res.status}`);
    });

    await assertTest('RBAC 1.6: Staff user accessing /analytics/drilldown returns 403 Forbidden', async () => {
      const res = await request(app)
        .get('/api/admin/analytics/drilldown?level=college')
        .set('Authorization', `Bearer ${staffToken}`);
      if (res.status !== 403) throw new Error(`Expected 403, got ${res.status}`);
    });

    // =======================================================================
    // SUITE 2: OVERALL COLLEGE ANALYTICS
    // =======================================================================
    console.log('\n--- SUITE 2: Overall College Analytics ---');

    await assertTest('Overall Analytics: Returns full college metrics, rankings, highlights, and backward-compatible metrics', async () => {
      const res = await request(app)
        .get('/api/admin/analytics/overall')
        .set('Authorization', `Bearer ${adminToken}`);

      if (res.status !== 200) throw new Error(`Expected 200, got ${res.status}: ${JSON.stringify(res.body)}`);
      const body = res.body;

      // Check core metrics
      if (typeof body.totalStudents !== 'number') throw new Error('Missing totalStudents number');
      if (typeof body.totalDepartments !== 'number') throw new Error('Missing totalDepartments number');
      if (typeof body.totalYears !== 'number') throw new Error('Missing totalYears number');
      if (typeof body.totalSections !== 'number') throw new Error('Missing totalSections number');
      if (body.overallPassPercentage === undefined) throw new Error('Missing overallPassPercentage');

      // Check backward compatibility
      if (!body.metrics) throw new Error('Missing backward-compatible metrics object');
      if (typeof body.metrics.totalDepartments !== 'number') throw new Error('Missing metrics.totalDepartments');
      if (typeof body.metrics.totalStudents !== 'number') throw new Error('Missing metrics.totalStudents');

      // Check department rankings
      if (!Array.isArray(body.departmentRankings)) throw new Error('Missing departmentRankings array');
      if (body.departmentRankings.length === 0) throw new Error('Expected at least 1 department ranking');
      const dRank = body.departmentRankings[0];
      if (typeof dRank.rank !== 'number') throw new Error('Missing rank in departmentRankings');
      if (!dRank.code) throw new Error('Missing code in departmentRankings');
      if (dRank.passPercentage === undefined) throw new Error('Missing passPercentage in departmentRankings');

      // Check year rankings
      if (!Array.isArray(body.yearRankings)) throw new Error('Missing yearRankings array');
      if (body.yearRankings.length === 0) throw new Error('Expected year rankings');

      // Check section rankings
      if (!Array.isArray(body.sectionRankings)) throw new Error('Missing sectionRankings array');
      if (body.sectionRankings.length === 0) throw new Error('Expected section rankings');

      // Check subject performance
      if (!Array.isArray(body.subjectPerformance)) throw new Error('Missing subjectPerformance array');

      // Check student highlights
      if (!Array.isArray(body.top10Students)) throw new Error('Missing top10Students array');
      if (!Array.isArray(body.bottom10Students)) throw new Error('Missing bottom10Students array');
      if (!Array.isArray(body.mostImprovedStudents)) throw new Error('Missing mostImprovedStudents array');
      if (!Array.isArray(body.studentsNeedingAttention)) throw new Error('Missing studentsNeedingAttention array');

      console.log(`     Metrics: Total Students: ${body.totalStudents}, Depts: ${body.totalDepartments}, Pass %: ${body.overallPassPercentage}%, IA-1 Avg: ${body.ia1Average}%, IA-2 Avg: ${body.ia2Average}%`);
    });

    // =======================================================================
    // SUITE 3: DEPARTMENT ANALYTICS (COMPARATIVE)
    // =======================================================================
    console.log('\n--- SUITE 3: Department Analytics ---');

    await assertTest('Department Analytics: Compares departments with detailed metrics and rankings', async () => {
      const res = await request(app)
        .get('/api/admin/analytics/departments')
        .set('Authorization', `Bearer ${adminToken}`);

      if (res.status !== 200) throw new Error(`Expected 200, got ${res.status}`);
      const body = res.body;

      if (!Array.isArray(body.departmentAnalytics)) throw new Error('Missing departmentAnalytics array');
      if (!Array.isArray(body.comparativeRanking)) throw new Error('Missing comparativeRanking array');

      const dept = body.departmentAnalytics.find((d: any) => d.code === 'CSE');
      if (!dept) throw new Error('CSE department not found in departmentAnalytics');
      if (typeof dept.totalStudents !== 'number') throw new Error('Missing totalStudents');
      if (typeof dept.passPercentage !== 'number') throw new Error('Missing passPercentage');
      if (!dept.levelDistribution) throw new Error('Missing levelDistribution');
      if (!dept.progressionDistribution) throw new Error('Missing progressionDistribution');
      if (!Array.isArray(dept.yearBreakdown)) throw new Error('Missing yearBreakdown');
      if (!Array.isArray(dept.topStudents)) throw new Error('Missing topStudents');

      console.log(`     CSE Department: Students: ${dept.totalStudents}, Assessed: ${dept.assessedStudents}, Avg: ${dept.overallAverage}%, Pass: ${dept.passPercentage}%`);
    });

    // =======================================================================
    // SUITE 4: YEAR-WISE ANALYTICS (1st, 2nd, 3rd, 4th Year)
    // =======================================================================
    console.log('\n--- SUITE 4: Year-wise Analytics ---');

    await assertTest('Year-wise Analytics: Compares 1st to 4th Year with rankings and department breakdown', async () => {
      const res = await request(app)
        .get('/api/admin/analytics/years')
        .set('Authorization', `Bearer ${adminToken}`);

      if (res.status !== 200) throw new Error(`Expected 200, got ${res.status}`);
      const body = res.body;

      if (!Array.isArray(body.yearAnalytics)) throw new Error('Missing yearAnalytics array');
      if (!Array.isArray(body.rankings)) throw new Error('Missing rankings array');
      if (body.yearAnalytics.length !== 4) throw new Error(`Expected 4 years, got ${body.yearAnalytics.length}`);

      const yr3Data = body.yearAnalytics.find((y: any) => y.yearNumber === 3);
      if (!yr3Data) throw new Error('Year 3 not found in yearAnalytics');
      if (typeof yr3Data.totalStudents !== 'number') throw new Error('Missing totalStudents');
      if (!Array.isArray(yr3Data.departmentBreakdown)) throw new Error('Missing departmentBreakdown');

      console.log(`     Year 3: Students: ${yr3Data.totalStudents}, Avg: ${yr3Data.overallAverage}%, Pass: ${yr3Data.passPercentage}%`);
    });

    // =======================================================================
    // SUITE 5: SECTION ANALYTICS
    // =======================================================================
    console.log('\n--- SUITE 5: Section Analytics ---');

    await assertTest('Section Analytics: Returns all sections overview when no sectionId provided', async () => {
      const res = await request(app)
        .get('/api/admin/analytics/sections')
        .set('Authorization', `Bearer ${adminToken}`);

      if (res.status !== 200) throw new Error(`Expected 200, got ${res.status}`);
      if (!Array.isArray(res.body.sections)) throw new Error('Missing sections array');
      if (res.body.sections.length === 0) throw new Error('Expected at least 1 section summary');
      const sec = res.body.sections[0];
      if (!sec.sectionName) throw new Error('Missing sectionName');
      if (typeof sec.passPercentage !== 'number') throw new Error('Missing passPercentage');
    });

    await assertTest('Section Analytics: Returns deep section breakdown when sectionId provided', async () => {
      const res = await request(app)
        .get(`/api/admin/analytics/sections?sectionId=${secCSE3A!.id}`)
        .set('Authorization', `Bearer ${adminToken}`);

      if (res.status !== 200) throw new Error(`Expected 200, got ${res.status}`);
      const sec = res.body;

      if (sec.sectionId !== secCSE3A!.id) throw new Error('Mismatched sectionId');
      if (typeof sec.totalStudents !== 'number') throw new Error('Missing totalStudents');
      if (!Array.isArray(sec.subjectAverages)) throw new Error('Missing subjectAverages');
      if (!Array.isArray(sec.topPerformers)) throw new Error('Missing topPerformers');
      if (!Array.isArray(sec.studentsNeedingAttention)) throw new Error('Missing studentsNeedingAttention');
      if (!sec.levelDistribution) throw new Error('Missing levelDistribution');
      if (!Array.isArray(sec.studentRoster)) throw new Error('Missing studentRoster');

      console.log(`     Section CSE 3A: Students: ${sec.totalStudents}, Subjects: ${sec.subjectAverages.length}, Top Performers: ${sec.topPerformers.length}`);
    });

    // =======================================================================
    // SUITE 6: HIERARCHICAL DRILLDOWN
    // College -> Department -> Year -> Section -> Subject -> Student
    // =======================================================================
    console.log('\n--- SUITE 6: Hierarchical Drilldown (6 Tiers) ---');

    // Tier 1: College
    let deptIdToDrill = '';
    await assertTest('Drilldown Tier 1: College -> returns departments and summary', async () => {
      const res = await request(app)
        .get('/api/admin/analytics/drilldown?level=college')
        .set('Authorization', `Bearer ${adminToken}`);

      if (res.status !== 200) throw new Error(`Status ${res.status}`);
      if (res.body.currentLevel !== 'college') throw new Error(`Expected level college, got ${res.body.currentLevel}`);
      if (!Array.isArray(res.body.breadcrumbs)) throw new Error('Missing breadcrumbs');
      if (!Array.isArray(res.body.children)) throw new Error('Missing children');
      if (res.body.children.length === 0) throw new Error('Children departments empty');
      deptIdToDrill = res.body.children[0].id;
    });

    // Tier 2: Department
    let yearIdToDrill = '';
    await assertTest('Drilldown Tier 2: Department -> returns years within department', async () => {
      const res = await request(app)
        .get(`/api/admin/analytics/drilldown?level=department&departmentId=${deptIdToDrill}`)
        .set('Authorization', `Bearer ${adminToken}`);

      if (res.status !== 200) throw new Error(`Status ${res.status}`);
      if (res.body.currentLevel !== 'department') throw new Error(`Expected level department, got ${res.body.currentLevel}`);
      if (res.body.breadcrumbs.length !== 2) throw new Error(`Expected 2 breadcrumbs, got ${res.body.breadcrumbs.length}`);
      if (!Array.isArray(res.body.children)) throw new Error('Missing children');
      yearIdToDrill = res.body.children[0].id;
    });

    // Tier 3: Year
    let sectionIdToDrill = '';
    await assertTest('Drilldown Tier 3: Year -> returns sections in department and year', async () => {
      const res = await request(app)
        .get(`/api/admin/analytics/drilldown?level=year&departmentId=${cseDept!.id}&yearId=${yr3!.id}`)
        .set('Authorization', `Bearer ${adminToken}`);

      if (res.status !== 200) throw new Error(`Status ${res.status}`);
      if (res.body.currentLevel !== 'year') throw new Error(`Expected level year, got ${res.body.currentLevel}`);
      if (res.body.breadcrumbs.length !== 3) throw new Error(`Expected 3 breadcrumbs, got ${res.body.breadcrumbs.length}`);
      if (!Array.isArray(res.body.children)) throw new Error('Missing children');
      if (res.body.children.length === 0) throw new Error('Sections empty');
      sectionIdToDrill = res.body.children[0].id;
    });

    // Tier 4: Section
    let subjectIdToDrill = '';
    await assertTest('Drilldown Tier 4: Section -> returns subjects and students in section', async () => {
      const res = await request(app)
        .get(`/api/admin/analytics/drilldown?level=section&sectionId=${sectionIdToDrill}`)
        .set('Authorization', `Bearer ${adminToken}`);

      if (res.status !== 200) throw new Error(`Status ${res.status}`);
      if (res.body.currentLevel !== 'section') throw new Error(`Expected level section, got ${res.body.currentLevel}`);
      if (res.body.breadcrumbs.length !== 4) throw new Error(`Expected 4 breadcrumbs, got ${res.body.breadcrumbs.length}`);
      if (!Array.isArray(res.body.children)) throw new Error('Missing children subjects');
      if (!Array.isArray(res.body.students)) throw new Error('Missing section students');
      if (res.body.children.length > 0) {
        subjectIdToDrill = res.body.children[0].id;
      }
    });

    // Tier 5: Subject
    if (subjectIdToDrill) {
      await assertTest('Drilldown Tier 5: Subject -> returns student marks for subject in section', async () => {
        const res = await request(app)
          .get(`/api/admin/analytics/drilldown?level=subject&sectionId=${sectionIdToDrill}&subjectId=${subjectIdToDrill}`)
          .set('Authorization', `Bearer ${adminToken}`);

        if (res.status !== 200) throw new Error(`Status ${res.status}`);
        if (res.body.currentLevel !== 'subject') throw new Error(`Expected level subject, got ${res.body.currentLevel}`);
        if (res.body.breadcrumbs.length !== 5) throw new Error(`Expected 5 breadcrumbs, got ${res.body.breadcrumbs.length}`);
        if (!Array.isArray(res.body.children)) throw new Error('Missing children marks');
      });
    }

    // Tier 6: Student
    if (cseStudent) {
      await assertTest('Drilldown Tier 6: Student -> returns individual report and assessment breakdown', async () => {
        const res = await request(app)
          .get(`/api/admin/analytics/drilldown?level=student&studentId=${cseStudent.id}`)
          .set('Authorization', `Bearer ${adminToken}`);

        if (res.status !== 200) throw new Error(`Status ${res.status}`);
        if (res.body.currentLevel !== 'student') throw new Error(`Expected level student, got ${res.body.currentLevel}`);
        if (res.body.breadcrumbs.length !== 5) throw new Error(`Expected 5 breadcrumbs, got ${res.body.breadcrumbs.length}`);
        if (!res.body.report) throw new Error('Missing report object');
        if (typeof res.body.report.percentage !== 'number') throw new Error('Missing student percentage');
      });
    }

  } catch (error: any) {
    console.error('Test setup error:', error);
    failed++;
  } finally {
    await prisma.$disconnect();
    console.log(`\n========================================`);
    console.log(`Test Results: ${passed} Passed, ${failed} Failed`);
    console.log(`========================================\n`);

    if (failed > 0) {
      process.exit(1);
    }
  }
}

runAdminAnalyticsTests();
