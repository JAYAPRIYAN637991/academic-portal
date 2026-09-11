import { prisma } from './db';

async function testDatabaseConnectivity() {
  console.log('🔍 Testing PostgreSQL Database Connectivity via Prisma ORM...');
  const startTime = Date.now();

  try {
    // 1. Raw ping query
    await prisma.$queryRaw`SELECT 1 as ping`;
    console.log('✓ Raw PostgreSQL query execution succeeded');

    // 2. Count records in all models
    const [
      users,
      academicYears,
      departments,
      years,
      sections,
      subjects,
      students,
      assignments,
      assessments,
      marks,
      changeLogs,
      snapshots,
      notifications,
      notices,
      auditLogs
    ] = await Promise.all([
      prisma.user.count(),
      prisma.academicYear.count(),
      prisma.department.count(),
      prisma.year.count(),
      prisma.section.count(),
      prisma.subject.count(),
      prisma.student.count(),
      prisma.teacherAssignment.count(),
      prisma.assessment.count(),
      prisma.mark.count(),
      prisma.markChangeLog.count(),
      prisma.performanceSnapshot.count(),
      prisma.notification.count(),
      prisma.collegeNotice.count(),
      prisma.auditLog.count()
    ]);

    console.log('\n📊 Database Model Verification Summary:');
    console.log(`• Users (Admin & Staff):     ${users}`);
    console.log(`• Academic Years:            ${academicYears}`);
    console.log(`• Departments:               ${departments}`);
    console.log(`• Years:                     ${years}`);
    console.log(`• Sections:                  ${sections}`);
    console.log(`• Subjects:                  ${subjects}`);
    console.log(`• Students:                  ${students}`);
    console.log(`• Teacher Assignments:       ${assignments}`);
    console.log(`• Assessments (IA1, IA2...): ${assessments}`);
    console.log(`• Marks Recorded:            ${marks}`);
    console.log(`• Mark Change Logs:          ${changeLogs}`);
    console.log(`• Performance Snapshots:     ${snapshots}`);
    console.log(`• Notifications (SMS/WA):    ${notifications}`);
    console.log(`• College Notices:           ${notices}`);
    console.log(`• Audit Logs:                ${auditLogs}`);

    const elapsed = Date.now() - startTime;
    console.log(`\n✅ Database connectivity and all 15 models validated in ${elapsed}ms!`);
  } catch (error) {
    console.error('❌ Database connectivity test failed:', error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

testDatabaseConnectivity();
