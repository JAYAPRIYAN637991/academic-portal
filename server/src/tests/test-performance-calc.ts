import request from 'supertest';
import { createApp } from '../server';
import { prisma } from '../db';
import { AcademicPerformanceService, MarkItem } from '../services/academicPerformance.service';

async function runPerformanceCalcTests() {
  console.log('🧪 Starting Academic Performance Calculation Engine Test Suite...\n');
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

  // =========================================================================
  // 1. PURE CALCULATION & FORMULA VERIFICATION
  // =========================================================================
  console.log('--- 1. Pure Formula & Prompt Examples ---');

  await assertTest('Example from prompt: IA-1 = 60/80 (75%), IA-2 = 68/80 (85%) => +10 percentage points', () => {
    const ia1Pct = AcademicPerformanceService.calculatePercentage(60, 80);
    if (ia1Pct !== 75) throw new Error(`Expected IA-1 to be 75%, got ${ia1Pct}%`);

    const ia2Pct = AcademicPerformanceService.calculatePercentage(68, 80);
    if (ia2Pct !== 85) throw new Error(`Expected IA-2 to be 85%, got ${ia2Pct}%`);

    const result = AcademicPerformanceService.calculateImprovement(ia1Pct, ia2Pct);
    if (result.improvement !== 10) throw new Error(`Expected improvement to be 10, got ${result.improvement}`);
    if (result.decline !== 0) throw new Error(`Expected decline to be 0, got ${result.decline}`);
    if (result.status !== 'IMPROVED') throw new Error(`Expected status IMPROVED, got ${result.status}`);
    if (result.difference !== 10) throw new Error(`Expected difference 10, got ${result.difference}`);
  });

  await assertTest('Status trajectories: IMPROVED (IA-2 > IA-1), DECLINED (IA-2 < IA-1), NO_CHANGE (IA-2 = IA-1)', () => {
    // Improved
    const imp = AcademicPerformanceService.calculateImprovement(70, 78.5);
    if (imp.status !== 'IMPROVED' || imp.improvement !== 8.5 || imp.decline !== 0) {
      throw new Error(`Failed on IMPROVED: ${JSON.stringify(imp)}`);
    }

    // Declined
    const dec = AcademicPerformanceService.calculateImprovement(85, 72.5);
    if (dec.status !== 'DECLINED' || dec.improvement !== -12.5 || dec.decline !== 12.5) {
      throw new Error(`Failed on DECLINED: ${JSON.stringify(dec)}`);
    }

    // No change
    const nc = AcademicPerformanceService.calculateImprovement(80, 80);
    if (nc.status !== 'NO_CHANGE' || nc.improvement !== 0 || nc.decline !== 0) {
      throw new Error(`Failed on NO_CHANGE: ${JSON.stringify(nc)}`);
    }
  });

  await assertTest('Performance Levels scale: 90-100 (Excellent), 80-89 (Very Good), 70-79 (Good), 60-69 (Average), <60 (Needs Attention)', () => {
    // 90-100: Excellent
    if (AcademicPerformanceService.getPerformanceLevel(100) !== 'Excellent') throw new Error('100 should be Excellent');
    if (AcademicPerformanceService.getPerformanceLevel(90) !== 'Excellent') throw new Error('90 should be Excellent');
    if (AcademicPerformanceService.getPerformanceLevel(95.4) !== 'Excellent') throw new Error('95.4 should be Excellent');

    // 80-89: Very Good
    if (AcademicPerformanceService.getPerformanceLevel(89.99) !== 'Very Good') throw new Error('89.99 should be Very Good');
    if (AcademicPerformanceService.getPerformanceLevel(80) !== 'Very Good') throw new Error('80 should be Very Good');
    if (AcademicPerformanceService.getPerformanceLevel(84.2) !== 'Very Good') throw new Error('84.2 should be Very Good');

    // 70-79: Good
    if (AcademicPerformanceService.getPerformanceLevel(79.99) !== 'Good') throw new Error('79.99 should be Good');
    if (AcademicPerformanceService.getPerformanceLevel(70) !== 'Good') throw new Error('70 should be Good');
    if (AcademicPerformanceService.getPerformanceLevel(75.5) !== 'Good') throw new Error('75.5 should be Good');

    // 60-69: Average
    if (AcademicPerformanceService.getPerformanceLevel(69.99) !== 'Average') throw new Error('69.99 should be Average');
    if (AcademicPerformanceService.getPerformanceLevel(60) !== 'Average') throw new Error('60 should be Average');
    if (AcademicPerformanceService.getPerformanceLevel(64) !== 'Average') throw new Error('64 should be Average');

    // Below 60: Needs Attention
    if (AcademicPerformanceService.getPerformanceLevel(59.99) !== 'Needs Attention') throw new Error('59.99 should be Needs Attention');
    if (AcademicPerformanceService.getPerformanceLevel(35) !== 'Needs Attention') throw new Error('35 should be Needs Attention');
    if (AcademicPerformanceService.getPerformanceLevel(0) !== 'Needs Attention') throw new Error('0 should be Needs Attention');
    if (AcademicPerformanceService.getPerformanceLevel(null) !== 'Needs Attention') throw new Error('null should be Needs Attention');
  });

  // =========================================================================
  // 2. EDGE CASE CALCULATIONS
  // =========================================================================
  console.log('\n--- 2. Edge Case Calculations ---');

  await assertTest('Edge Case: Zero maximum marks handled safely (division by zero protection)', () => {
    const pct1 = AcademicPerformanceService.calculatePercentage(50, 0);
    if (pct1 !== 0) throw new Error(`Expected 0 for max=0, got ${pct1}`);

    const pct2 = AcademicPerformanceService.calculatePercentage(0, 0);
    if (pct2 !== 0) throw new Error(`Expected 0 for obtained=0 and max=0, got ${pct2}`);

    const pct3 = AcademicPerformanceService.calculatePercentage(25, -10);
    if (pct3 !== 0) throw new Error(`Expected 0 for negative max, got ${pct3}`);

    if (isNaN(pct1) || !isFinite(pct1)) throw new Error('Returned NaN or Infinity');
  });

  await assertTest('Edge Case: Missing IA-1 handled gracefully (progressionStatus: MISSING_DATA)', () => {
    const marks: MarkItem[] = [
      {
        subjectId: 'sub-1',
        subjectCode: 'CS101',
        subjectName: 'Computer Science',
        assessmentCode: 'IA-2',
        assessmentName: 'Internal Assessment 2',
        marksObtained: 85,
        maximumMarks: 100
      }
    ];

    const report = AcademicPerformanceService.calculateStudentPerformance(marks);
    if (!report.isMissingIA1) throw new Error('isMissingIA1 should be true');
    if (report.isMissingIA2) throw new Error('isMissingIA2 should be false');
    if (report.ia1Percentage !== null) throw new Error('ia1Percentage should be null');
    if (report.ia2Percentage !== 85) throw new Error(`ia2Percentage should be 85, got ${report.ia2Percentage}`);
    if (report.progressionStatus !== 'MISSING_DATA') throw new Error(`Expected MISSING_DATA, got ${report.progressionStatus}`);
    if (report.improvement !== null) throw new Error('improvement should be null');
  });

  await assertTest('Edge Case: Missing IA-2 handled gracefully (progressionStatus: MISSING_DATA)', () => {
    const marks: MarkItem[] = [
      {
        subjectId: 'sub-1',
        subjectCode: 'CS101',
        subjectName: 'Computer Science',
        assessmentCode: 'IA-1',
        assessmentName: 'Internal Assessment 1',
        marksObtained: 72,
        maximumMarks: 100
      }
    ];

    const report = AcademicPerformanceService.calculateStudentPerformance(marks);
    if (report.isMissingIA1) throw new Error('isMissingIA1 should be false');
    if (!report.isMissingIA2) throw new Error('isMissingIA2 should be true');
    if (report.ia1Percentage !== 72) throw new Error('ia1Percentage should be 72');
    if (report.ia2Percentage !== null) throw new Error('ia2Percentage should be null');
    if (report.progressionStatus !== 'MISSING_DATA') throw new Error(`Expected MISSING_DATA, got ${report.progressionStatus}`);
    if (report.improvement !== null) throw new Error('improvement should be null');
  });

  await assertTest('Edge Case: No marks at all (empty array)', () => {
    const report = AcademicPerformanceService.calculateStudentPerformance([], {
      expectedSubjectIds: ['sub-1', 'sub-2', 'sub-3']
    });

    if (report.studentTotal !== 0) throw new Error(`studentTotal should be 0, got ${report.studentTotal}`);
    if (report.maximumTotal !== 0) throw new Error(`maximumTotal should be 0, got ${report.maximumTotal}`);
    if (report.percentage !== 0) throw new Error(`percentage should be 0, got ${report.percentage}`);
    if (report.hasMarks !== false) throw new Error('hasMarks should be false');
    if (report.isMissingIA1 !== true) throw new Error('isMissingIA1 should be true');
    if (report.isMissingIA2 !== true) throw new Error('isMissingIA2 should be true');
    if (report.performanceStatus !== 'Needs Attention') throw new Error('performanceStatus should be Needs Attention');
    if (report.progressionStatus !== 'MISSING_DATA') throw new Error('progressionStatus should be MISSING_DATA');
  });

  await assertTest('Edge Case: Partial marks (some subjects evaluated, others pending)', () => {
    const marks: MarkItem[] = [
      {
        subjectId: 'sub-1',
        subjectCode: 'CS101',
        subjectName: 'Algorithms',
        assessmentCode: 'IA-1',
        marksObtained: 40,
        maximumMarks: 50
      },
      {
        subjectId: 'sub-2',
        subjectCode: 'CS102',
        subjectName: 'Database Systems',
        assessmentCode: 'IA-1',
        marksObtained: 45,
        maximumMarks: 50
      }
    ];

    const report = AcademicPerformanceService.calculateStudentPerformance(marks, {
      expectedSubjectIds: ['sub-1', 'sub-2', 'sub-3', 'sub-4', 'sub-5']
    });

    if (report.evaluatedSubjectsCount !== 2) throw new Error(`evaluatedSubjectsCount was ${report.evaluatedSubjectsCount}`);
    if (report.totalSubjectsCount !== 5) throw new Error(`totalSubjectsCount was ${report.totalSubjectsCount}`);
    if (!report.hasPartialMarks) throw new Error('hasPartialMarks should be true');
    // Total obtained: 40 + 45 = 85, Total max: 50 + 50 = 100 => 85%
    if (report.studentTotal !== 85) throw new Error(`studentTotal should be 85, got ${report.studentTotal}`);
    if (report.maximumTotal !== 100) throw new Error(`maximumTotal should be 100, got ${report.maximumTotal}`);
    if (report.percentage !== 85) throw new Error(`percentage should be 85, got ${report.percentage}`);
    if (report.performanceStatus !== 'Very Good') throw new Error(`performanceStatus was ${report.performanceStatus}`);
  });

  await assertTest('Edge Case: Different maximum marks across assessments (IA-1 out of 50, IA-2 out of 100)', () => {
    const marks: MarkItem[] = [
      {
        subjectId: 'sub-1',
        subjectCode: 'CS101',
        subjectName: 'Algorithms',
        assessmentCode: 'IA-1',
        marksObtained: 35, // 35 / 50 = 70%
        maximumMarks: 50
      },
      {
        subjectId: 'sub-1',
        subjectCode: 'CS101',
        subjectName: 'Algorithms',
        assessmentCode: 'IA-2',
        marksObtained: 85, // 85 / 100 = 85%
        maximumMarks: 100
      }
    ];

    const report = AcademicPerformanceService.calculateStudentPerformance(marks);
    if (report.ia1Percentage !== 70) throw new Error(`Expected IA-1 to be 70%, got ${report.ia1Percentage}`);
    if (report.ia2Percentage !== 85) throw new Error(`Expected IA-2 to be 85%, got ${report.ia2Percentage}`);
    if (report.improvement !== 15) throw new Error(`Expected improvement +15 points, got ${report.improvement}`);
    if (report.progressionStatus !== 'IMPROVED') throw new Error(`Expected IMPROVED, got ${report.progressionStatus}`);
  });

  // =========================================================================
  // 3. SUBJECT-WISE DIFFERENCE AND MULTI-SUBJECT COMPARISON
  // =========================================================================
  console.log('\n--- 3. Subject-Wise Difference Calculations ---');

  await assertTest('Subject-wise difference: Accurately compares IA-1 vs IA-2 for each subject', () => {
    const marks: MarkItem[] = [
      // Math: IA-1 70%, IA-2 90% => +20 (IMPROVED)
      { subjectId: 's1', subjectCode: 'MATH', subjectName: 'Mathematics', assessmentCode: 'IA-1', marksObtained: 70, maximumMarks: 100 },
      { subjectId: 's1', subjectCode: 'MATH', subjectName: 'Mathematics', assessmentCode: 'IA-2', marksObtained: 90, maximumMarks: 100 },
      // Physics: IA-1 85%, IA-2 70% => -15 (DECLINED)
      { subjectId: 's2', subjectCode: 'PHYS', subjectName: 'Physics', assessmentCode: 'IA-1', marksObtained: 85, maximumMarks: 100 },
      { subjectId: 's2', subjectCode: 'PHYS', subjectName: 'Physics', assessmentCode: 'IA-2', marksObtained: 70, maximumMarks: 100 },
      // Chemistry: IA-1 80%, IA-2 80% => 0 (NO_CHANGE)
      { subjectId: 's3', subjectCode: 'CHEM', subjectName: 'Chemistry', assessmentCode: 'IA-1', marksObtained: 80, maximumMarks: 100 },
      { subjectId: 's3', subjectCode: 'CHEM', subjectName: 'Chemistry', assessmentCode: 'IA-2', marksObtained: 80, maximumMarks: 100 },
      // Biology: IA-1 only 75% => MISSING_DATA
      { subjectId: 's4', subjectCode: 'BIOL', subjectName: 'Biology', assessmentCode: 'IA-1', marksObtained: 75, maximumMarks: 100 }
    ];

    const report = AcademicPerformanceService.calculateStudentPerformance(marks);

    // Verify Math
    const math = report.subjectBreakdown.find(s => s.subjectCode === 'MATH')!;
    if (!math) throw new Error('Math breakdown missing');
    if (math.ia1.percentage !== 70) throw new Error(`Math IA-1: ${math.ia1.percentage}`);
    if (math.ia2.percentage !== 90) throw new Error(`Math IA-2: ${math.ia2.percentage}`);
    if (math.improvement !== 20 || math.status !== 'IMPROVED') throw new Error(`Math status: ${math.status}, imp: ${math.improvement}`);

    // Verify Physics
    const phys = report.subjectBreakdown.find(s => s.subjectCode === 'PHYS')!;
    if (!phys) throw new Error('Physics breakdown missing');
    if (phys.improvement !== -15 || phys.decline !== 15 || phys.status !== 'DECLINED') {
      throw new Error(`Physics status: ${phys.status}, dec: ${phys.decline}`);
    }

    // Verify Chemistry
    const chem = report.subjectBreakdown.find(s => s.subjectCode === 'CHEM')!;
    if (!chem) throw new Error('Chemistry breakdown missing');
    if (chem.improvement !== 0 || chem.status !== 'NO_CHANGE') {
      throw new Error(`Chem status: ${chem.status}`);
    }

    // Verify Biology
    const biol = report.subjectBreakdown.find(s => s.subjectCode === 'BIOL')!;
    if (!biol) throw new Error('Biology breakdown missing');
    if (biol.status !== 'MISSING_DATA' || biol.improvement !== null) {
      throw new Error(`Biology status: ${biol.status}`);
    }
  });

  // =========================================================================
  // 4. CLASS PERFORMANCE SUMMARY AGGREGATION
  // =========================================================================
  console.log('\n--- 4. Class Performance Aggregation ---');

  await assertTest('Class aggregation: Aggregates class averages, distribution counts, and status proportions', () => {
    const classData = [
      {
        studentId: 'st-1',
        registerNumber: 'REG001',
        studentName: 'Alice',
        marks: [
          { subjectId: 'sub1', subjectCode: 'CS1', assessmentCode: 'IA-1', marksObtained: 92, maximumMarks: 100 },
          { subjectId: 'sub1', subjectCode: 'CS1', assessmentCode: 'IA-2', marksObtained: 96, maximumMarks: 100 }
        ]
      },
      {
        studentId: 'st-2',
        registerNumber: 'REG002',
        studentName: 'Bob',
        marks: [
          { subjectId: 'sub1', subjectCode: 'CS1', assessmentCode: 'IA-1', marksObtained: 80, maximumMarks: 100 },
          { subjectId: 'sub1', subjectCode: 'CS1', assessmentCode: 'IA-2', marksObtained: 70, maximumMarks: 100 }
        ]
      },
      {
        studentId: 'st-3',
        registerNumber: 'REG003',
        studentName: 'Charlie',
        marks: [] // unassessed
      }
    ];

    const summary = AcademicPerformanceService.calculateClassPerformance(classData);

    if (summary.totalStudents !== 3) throw new Error(`totalStudents was ${summary.totalStudents}`);
    if (summary.assessedStudents !== 2) throw new Error(`assessedStudents was ${summary.assessedStudents}`);
    if (summary.unassessedStudents !== 1) throw new Error(`unassessedStudents was ${summary.unassessedStudents}`);

    // Alice: (92+96)/200 = 94% (Excellent, IMPROVED)
    // Bob: (80+70)/200 = 75% (Good, DECLINED)
    // Class average = (94 + 75) / 2 = 84.5%
    if (summary.classAveragePercentage !== 84.5) {
      throw new Error(`classAveragePercentage expected 84.5, got ${summary.classAveragePercentage}`);
    }

    if (summary.levelDistribution.excellent.count !== 1) throw new Error('Excellent count expected 1');
    if (summary.levelDistribution.good.count !== 1) throw new Error('Good count expected 1');
    if (summary.levelDistribution.needsAttention.count !== 1) throw new Error('Needs Attention count expected 1 (unassessed)');

    if (summary.progressionDistribution.improved.count !== 1) throw new Error('Improved count expected 1');
    if (summary.progressionDistribution.declined.count !== 1) throw new Error('Declined count expected 1');
  });

  // =========================================================================
  // 5. BACKEND API ENDPOINTS & RBAC ACCESS
  // =========================================================================
  console.log('\n--- 5. Backend REST API & Authorization ---');

  // Authenticate Admin and Staff
  const adminLogin = await request(app)
    .post('/api/auth/login')
    .send({ email: 'admin@college.edu', password: 'admin123' });
  const adminToken = adminLogin.body.token;

  const staffLogin = await request(app)
    .post('/api/auth/login')
    .send({ email: 'sarah.cse@college.edu', password: 'staff123' });
  const staffToken = staffLogin.body.token;

  // Find a student in Sarah's class (CSE 3A)
  const cseDept = await prisma.department.findUnique({ where: { code: 'CSE' } });
  const yr3 = await prisma.year.findFirst({ where: { yearNumber: 3 } });
  const secCSE3A = await prisma.section.findFirst({
    where: { name: 'A', departmentId: cseDept!.id, yearId: yr3!.id }
  });
  const assignedStudent = await prisma.student.findFirst({
    where: { sectionId: secCSE3A!.id }
  });

  // Find a student in an unassigned class (ECE 3A)
  const eceDept = await prisma.department.findUnique({ where: { code: 'ECE' } });
  const secECE3A = await prisma.section.findFirst({
    where: { name: 'A', departmentId: eceDept!.id, yearId: yr3!.id }
  });
  const unassignedStudent = await prisma.student.findFirst({
    where: { sectionId: secECE3A!.id }
  });

  await assertTest('Admin API: Can retrieve student performance report', async () => {
    const res = await request(app)
      .get(`/api/admin/analytics/performance/student/${assignedStudent!.id}`)
      .set('Authorization', `Bearer ${adminToken}`);

    if (res.status !== 200) throw new Error(`Expected 200, got ${res.status}: ${JSON.stringify(res.body)}`);
    if (!res.body.report) throw new Error('Missing report in response');
    if (res.body.report.registerNumber !== assignedStudent!.registerNumber) {
      throw new Error(`Register number mismatch: ${res.body.report.registerNumber}`);
    }
  });

  await assertTest('Admin API: Can retrieve section performance summary', async () => {
    const res = await request(app)
      .get(`/api/admin/analytics/performance/section/${secCSE3A!.id}`)
      .set('Authorization', `Bearer ${adminToken}`);

    if (res.status !== 200) throw new Error(`Expected 200, got ${res.status}`);
    if (!res.body.summary) throw new Error('Missing summary in response');
    if (res.body.summary.totalStudents === undefined) throw new Error('Missing totalStudents');
  });

  await assertTest('Staff API: Allowed to retrieve performance for assigned class student', async () => {
    const res = await request(app)
      .get(`/api/staff/analytics/performance/student/${assignedStudent!.id}`)
      .set('Authorization', `Bearer ${staffToken}`);

    if (res.status !== 200) throw new Error(`Expected 200, got ${res.status}: ${JSON.stringify(res.body)}`);
    if (!res.body.report) throw new Error('Missing report in response');
  });

  await assertTest('Staff API: FORBIDDEN (403) when attempting to access unassigned student performance', async () => {
    const res = await request(app)
      .get(`/api/staff/analytics/performance/student/${unassignedStudent!.id}`)
      .set('Authorization', `Bearer ${staffToken}`);

    if (res.status !== 403) throw new Error(`Expected 403 Forbidden, got ${res.status}`);
    if (res.body.code !== 'STAFF_STUDENT_UNAUTHORIZED') throw new Error(`Expected STAFF_STUDENT_UNAUTHORIZED, got ${res.body.code}`);
  });

  await assertTest('Staff API: FORBIDDEN (403) when attempting to access unassigned section performance', async () => {
    const res = await request(app)
      .get(`/api/staff/analytics/performance/section/${secECE3A!.id}`)
      .set('Authorization', `Bearer ${staffToken}`);

    if (res.status !== 403) throw new Error(`Expected 403 Forbidden, got ${res.status}`);
    if (res.body.code !== 'STAFF_CLASS_UNAUTHORIZED') throw new Error(`Expected STAFF_CLASS_UNAUTHORIZED, got ${res.body.code}`);
  });

  await assertTest('Security: Unauthenticated request receives 401 Unauthorized', async () => {
    const res = await request(app)
      .get(`/api/admin/analytics/performance/student/${assignedStudent!.id}`);

    if (res.status !== 401) throw new Error(`Expected 401 Unauthorized, got ${res.status}`);
  });

  console.log(`\n==================================================`);
  console.log(`Test Results: ${passed} passed, ${failed} failed.`);
  console.log(`==================================================\n`);

  if (failed > 0) {
    process.exit(1);
  }
}

runPerformanceCalcTests()
  .catch((err) => {
    console.error('Fatal test error:', err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
