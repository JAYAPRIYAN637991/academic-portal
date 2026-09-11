import request from 'supertest';
import { createApp } from '../server';
import { prisma } from '../db';
import { AuditAction, AuditService } from '../services/audit.service';
import {
  NoticeTargetType,
  NoticeType,
  NotificationCategory,
  NotificationType
} from '@prisma/client';
import { processNotificationJob } from '../queue/notification.worker';

async function runAuditLoggingTests() {
  console.log('🛡️ Starting Complete Audit Logging & Mark Change History Test Suite...\n');
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
    const adminUser = adminLoginRes.body.user;

    const staffLoginRes = await request(app)
      .post('/api/auth/login')
      .send({ email: 'sarah.cse@college.edu', password: 'staff123' });
    const staffToken = staffLoginRes.body.token;
    const staffUser = staffLoginRes.body.user;

    // Fetch necessary context entities
    const academicYear = await prisma.academicYear.findFirst({ where: { isCurrent: true } }) || await prisma.academicYear.findFirst();
    const cseDept = await prisma.department.findUnique({ where: { code: 'CSE' } });
    const year3 = await prisma.year.findFirst({ where: { yearNumber: 3 } });
    const cseSection = await prisma.section.findFirst({ where: { departmentId: cseDept!.id } });
    const cseSectionB = await prisma.section.findFirst({ where: { departmentId: cseDept!.id, name: 'B' } }) || cseSection;
    const cseSubject = await prisma.subject.findFirst({ where: { departmentId: cseDept!.id } });
    const tocSubject = await prisma.subject.findUnique({ where: { code: 'CS8502' } }) || cseSubject;
    const ia1Assessment = await prisma.assessment.findFirst({ where: { code: 'IA-1' } }) || await prisma.assessment.findFirst();
    const student = await prisma.student.findFirst({
      where: { departmentId: cseDept!.id, status: 'ACTIVE' }
    });

    if (!academicYear || !cseDept || !year3 || !cseSection || !cseSubject || !ia1Assessment || !student) {
      throw new Error(`Database prerequisite data missing for audit logging tests: ${JSON.stringify({
        academicYear: !!academicYear,
        cseDept: !!cseDept,
        year3: !!year3,
        cseSection: !!cseSection,
        cseSubject: !!cseSubject,
        ia1Assessment: !!ia1Assessment,
        student: !!student
      })}`);
    }

    // =========================================================================
    // SUITE 1: RBAC & CLEARANCE
    // =========================================================================
    console.log('--- Suite 1: RBAC & Permission Verification ---');

    await assertTest('Staff is forbidden from reading system audit logs (403)', async () => {
      const res = await request(app)
        .get('/api/admin/audit-logs')
        .set('Authorization', `Bearer ${staffToken}`);
      if (res.status !== 403) throw new Error(`Expected 403, got ${res.status}`);
    });

    await assertTest('Staff is forbidden from reading mark change history (403)', async () => {
      const res = await request(app)
        .get('/api/admin/audit-logs/mark-changes')
        .set('Authorization', `Bearer ${staffToken}`);
      if (res.status !== 403) throw new Error(`Expected 403, got ${res.status}`);
    });

    await assertTest('Unauthenticated access to audit logs is rejected (401)', async () => {
      const res = await request(app)
        .get('/api/admin/audit-logs');
      if (res.status !== 401) throw new Error(`Expected 401, got ${res.status}`);
    });

    await assertTest('Admin has full clearance to read system audit logs (200)', async () => {
      const res = await request(app)
        .get('/api/admin/audit-logs')
        .set('Authorization', `Bearer ${adminToken}`);
      if (res.status !== 200) throw new Error(`Expected 200, got ${res.status}`);
      if (!Array.isArray(res.body.logs)) throw new Error('Expected logs array');
      if (typeof res.body.total !== 'number') throw new Error('Expected total count');
    });

    await assertTest('Admin has full clearance to read mark change history (200)', async () => {
      const res = await request(app)
        .get('/api/admin/audit-logs/mark-changes')
        .set('Authorization', `Bearer ${adminToken}`);
      if (res.status !== 200) throw new Error(`Expected 200, got ${res.status}`);
      if (!Array.isArray(res.body.logs)) throw new Error('Expected logs array');
    });

    // =========================================================================
    // SUITE 2: IMMUTABILITY & TAMPER RESISTANCE
    // =========================================================================
    console.log('\n--- Suite 2: Immutability & Tamper Resistance ---');

    await assertTest('DELETE /api/admin/audit-logs is strictly forbidden (403 AUDIT_LOGS_IMMUTABLE)', async () => {
      const res = await request(app)
        .delete('/api/admin/audit-logs')
        .set('Authorization', `Bearer ${adminToken}`);
      if (res.status !== 403) throw new Error(`Expected 403, got ${res.status}`);
      if (res.body.code !== 'AUDIT_LOGS_IMMUTABLE') throw new Error(`Expected AUDIT_LOGS_IMMUTABLE, got ${res.body.code}`);
    });

    await assertTest('DELETE /api/admin/audit-logs/:id is strictly forbidden (403 AUDIT_LOGS_IMMUTABLE)', async () => {
      const res = await request(app)
        .delete('/api/admin/audit-logs/fake-log-id')
        .set('Authorization', `Bearer ${adminToken}`);
      if (res.status !== 403) throw new Error(`Expected 403, got ${res.status}`);
      if (res.body.code !== 'AUDIT_LOGS_IMMUTABLE') throw new Error(`Expected AUDIT_LOGS_IMMUTABLE, got ${res.body.code}`);
    });

    await assertTest('DELETE /api/admin/audit-logs/mark-changes is strictly forbidden (403 AUDIT_LOGS_IMMUTABLE)', async () => {
      const res = await request(app)
        .delete('/api/admin/audit-logs/mark-changes')
        .set('Authorization', `Bearer ${adminToken}`);
      if (res.status !== 403) throw new Error(`Expected 403, got ${res.status}`);
      if (res.body.code !== 'AUDIT_LOGS_IMMUTABLE') throw new Error(`Expected AUDIT_LOGS_IMMUTABLE, got ${res.body.code}`);
    });

    await assertTest('DELETE /api/admin/audit-logs/mark-changes/:id is strictly forbidden (403 AUDIT_LOGS_IMMUTABLE)', async () => {
      const res = await request(app)
        .delete('/api/admin/audit-logs/mark-changes/fake-log-id')
        .set('Authorization', `Bearer ${adminToken}`);
      if (res.status !== 403) throw new Error(`Expected 403, got ${res.status}`);
      if (res.body.code !== 'AUDIT_LOGS_IMMUTABLE') throw new Error(`Expected AUDIT_LOGS_IMMUTABLE, got ${res.body.code}`);
    });

    // =========================================================================
    // SUITE 3: MARK CHANGE HISTORY (ALL 9 ATTRIBUTES)
    // =========================================================================
    console.log('\n--- Suite 3: Mark Change History Tracking ---');

    let createdMarkId: string;
    const initialMarks = 68;
    const revisedMarks = 82;
    const testReason = 'Correction after re-evaluating Question 4';

    await assertTest('Create initial mark record for test student', async () => {
      // Ensure existing mark is deleted first if any
      await prisma.mark.deleteMany({
        where: {
          studentId: student.id,
          subjectId: cseSubject.id,
          assessmentId: ia1Assessment.id
        }
      });

      const mark = await prisma.mark.create({
        data: {
          studentId: student.id,
          subjectId: cseSubject.id,
          assessmentId: ia1Assessment.id,
          marksObtained: initialMarks,
          maximumMarks: 100,
          enteredBy: adminUser.id
        }
      });
      createdMarkId = mark.id;
      if (!createdMarkId) throw new Error('Failed to seed initial mark');
    });

    await assertTest('Revise mark and record MarkChangeLog with all required fields', async () => {
      const res = await request(app)
        .post('/api/staff/marks')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          studentId: student.id,
          subjectId: cseSubject.id,
          assessmentId: ia1Assessment.id,
          marksObtained: revisedMarks,
          maximumMarks: 100,
          reason: testReason
        });

      if (res.status !== 200) throw new Error(`Mark update failed with ${res.status}: ${JSON.stringify(res.body)}`);
    });

    await assertTest('Verify Mark Change History records all 9 required attributes', async () => {
      const res = await request(app)
        .get(`/api/admin/audit-logs/mark-changes?studentId=${student.id}`)
        .set('Authorization', `Bearer ${adminToken}`);

      if (res.status !== 200) throw new Error(`Expected 200, got ${res.status}`);
      const logs = res.body.logs;
      if (!logs || logs.length === 0) throw new Error('Expected at least 1 mark change log for student');

      const log = logs[0];
      // Check 1: Student
      if (!log.student || !log.student.name) throw new Error('Missing 1. Student Name');
      // Check 2: Register Number
      if (!log.student.registerNumber) throw new Error('Missing 2. Register Number');
      // Check 3: Subject
      if (!log.subject || !log.subject.code) throw new Error('Missing 3. Subject');
      // Check 4: Assessment
      if (!log.assessment || !log.assessment.name) throw new Error('Missing 4. Assessment');
      // Check 5: Previous Mark
      if (log.previousMarks !== initialMarks) throw new Error(`Expected previousMarks=${initialMarks}, got ${log.previousMarks}`);
      // Check 6: New Mark
      if (log.newMarks !== revisedMarks) throw new Error(`Expected newMarks=${revisedMarks}, got ${log.newMarks}`);
      // Check 7: Changed By
      if (!log.changer || !log.changer.name) throw new Error('Missing 7. Changed By');
      // Check 8: Reason
      if (log.reason !== testReason) throw new Error(`Expected reason="${testReason}", got "${log.reason}"`);
      // Check 9: Date/Time
      if (!log.createdAt) throw new Error('Missing 9. Date/Time');
      // Difference verification
      if (log.difference !== (revisedMarks - initialMarks)) {
        throw new Error(`Expected difference=${revisedMarks - initialMarks}, got ${log.difference}`);
      }
    });

    // =========================================================================
    // SUITE 4: ALL 14 AUDIT LOG ACTIONS
    // =========================================================================
    console.log('\n--- Suite 4: Verifying All 14 Audit Actions ---');

    // 1. LOGIN
    await assertTest('1. Audit Action LOGIN is logged upon successful user authentication', async () => {
      const loginCheck = await prisma.auditLog.findFirst({
        where: { action: AuditAction.LOGIN, userId: adminUser.id },
        orderBy: { createdAt: 'desc' }
      });
      if (!loginCheck) throw new Error('LOGIN audit record not found');
    });

    // 2. LOGOUT
    await assertTest('2. Audit Action LOGOUT is logged upon user sign out', async () => {
      await request(app)
        .post('/api/auth/logout')
        .set('Authorization', `Bearer ${adminToken}`);

      const logoutCheck = await prisma.auditLog.findFirst({
        where: { action: AuditAction.LOGOUT, userId: adminUser.id },
        orderBy: { createdAt: 'desc' }
      });
      if (!logoutCheck) throw new Error('LOGOUT audit record not found');
    });

    // Re-login admin for remaining actions
    const relogin = await request(app)
      .post('/api/auth/login')
      .send({ email: 'admin@college.edu', password: 'admin123' });
    const currentAdminToken = relogin.body.token;

    // 3. STUDENT_CREATED
    let testStudentId: string;
    const testRegNo = `AUDIT${Date.now().toString().slice(-6)}`;
    await assertTest('3. Audit Action STUDENT_CREATED is logged upon adding a student', async () => {
      const res = await request(app)
        .post('/api/admin/students')
        .set('Authorization', `Bearer ${currentAdminToken}`)
        .send({
          registerNumber: testRegNo,
          name: 'Audit Test Student',
          departmentId: cseDept.id,
          yearId: year3.id,
          sectionId: cseSection.id,
          academicYearId: academicYear.id,
          parentName: 'Test Parent',
          parentMobile: '9876543210'
        });

      if (res.status !== 201) throw new Error(`Create student failed: ${JSON.stringify(res.body)}`);
      testStudentId = res.body.student.id;

      const audit = await prisma.auditLog.findFirst({
        where: { action: AuditAction.STUDENT_CREATED, entityId: testStudentId }
      });
      if (!audit) throw new Error('STUDENT_CREATED audit log not found');
    });

    // 4. STUDENT_UPDATED
    await assertTest('4. Audit Action STUDENT_UPDATED is logged upon modifying student profile', async () => {
      const res = await request(app)
        .put(`/api/admin/students/${testStudentId}`)
        .set('Authorization', `Bearer ${currentAdminToken}`)
        .send({
          name: 'Audit Test Student Renamed'
        });

      if (res.status !== 200) throw new Error(`Update student failed: ${JSON.stringify(res.body)}`);

      const audit = await prisma.auditLog.findFirst({
        where: { action: AuditAction.STUDENT_UPDATED, entityId: testStudentId },
        orderBy: { createdAt: 'desc' }
      });
      if (!audit) throw new Error('STUDENT_UPDATED audit log not found');
    });

    // 5. STUDENT_IMPORTED
    await assertTest('5. Audit Action STUDENT_IMPORTED is logged upon confirming bulk student import', async () => {
      const importRegNo = `IMP${Date.now().toString().slice(-6)}`;
      const res = await request(app)
        .post('/api/admin/students/import/confirm')
        .set('Authorization', `Bearer ${currentAdminToken}`)
        .send({
          students: [
            {
              registerNumber: importRegNo,
              name: 'Imported Student 1',
              department: cseDept.code,
              year: '3',
              section: cseSection.name,
              parentName: 'Parent 1',
              parentMobile: '9876500001',
              departmentId: cseDept.id,
              yearId: year3.id,
              academicYearId: academicYear.id,
              sectionId: cseSection.id
            }
          ],
          academicYearId: academicYear.id
        });

      if (res.status !== 200) throw new Error(`Student import confirm failed: ${JSON.stringify(res.body)}`);

      const audit = await prisma.auditLog.findFirst({
        where: { action: AuditAction.STUDENT_IMPORTED },
        orderBy: { createdAt: 'desc' }
      });
      if (!audit) throw new Error('STUDENT_IMPORTED audit log not found');
    });

    // 6. STAFF_CREATED
    let testStaffId: string;
    const testStaffEmail = `audit.staff.${Date.now()}@college.edu`;
    await assertTest('6. Audit Action STAFF_CREATED is logged upon creating faculty account', async () => {
      const res = await request(app)
        .post('/api/admin/staff')
        .set('Authorization', `Bearer ${currentAdminToken}`)
        .send({
          name: 'Prof. Audit Tester',
          email: testStaffEmail,
          password: 'password123'
        });

      if (res.status !== 201) throw new Error(`Staff creation failed: ${JSON.stringify(res.body)}`);
      testStaffId = res.body.staff.id;

      const audit = await prisma.auditLog.findFirst({
        where: { action: AuditAction.STAFF_CREATED, entityId: testStaffId }
      });
      if (!audit) throw new Error('STAFF_CREATED audit log not found');
    });

    // 7. STAFF_ASSIGNMENT_CHANGED
    let testAssignmentId: string;
    await assertTest('7. Audit Action STAFF_ASSIGNMENT_CHANGED is logged upon assigning teacher', async () => {
      const res = await request(app)
        .post('/api/admin/staff/assignments')
        .set('Authorization', `Bearer ${currentAdminToken}`)
        .send({
          staffId: testStaffId,
          academicYearId: academicYear.id,
          departmentId: cseDept.id,
          yearId: year3.id,
          sectionId: cseSectionB!.id,
          subjectId: tocSubject!.id
        });

      if (res.status !== 200 && res.status !== 201) throw new Error(`Staff assignment failed: ${JSON.stringify(res.body)}`);
      testAssignmentId = res.body.assignment.id;

      const audit = await prisma.auditLog.findFirst({
        where: { action: AuditAction.STAFF_ASSIGNMENT_CHANGED, entityId: testAssignmentId }
      });
      if (!audit) throw new Error('STAFF_ASSIGNMENT_CHANGED audit log not found');
    });

    // 8. MARKS_UPLOADED
    await assertTest('8. Audit Action MARKS_UPLOADED is logged upon initial marks upload/entry', async () => {
      const res = await request(app)
        .post('/api/admin/marks/upload-confirm')
        .set('Authorization', `Bearer ${currentAdminToken}`)
        .send({
          sectionId: cseSection.id,
          subjectId: cseSubject.id,
          assessmentId: ia1Assessment.id,
          academicYearId: academicYear.id,
          reason: 'Initial class grading upload',
          validRows: [
            {
              studentId: testStudentId,
              registerNumber: testRegNo,
              marksObtained: 75
            }
          ]
        });

      if (res.status !== 200) throw new Error(`Marks upload confirm failed: ${JSON.stringify(res.body)}`);

      const audit = await prisma.auditLog.findFirst({
        where: { action: AuditAction.MARKS_UPLOADED, entityId: ia1Assessment.id },
        orderBy: { createdAt: 'desc' }
      });
      if (!audit) throw new Error('MARKS_UPLOADED audit log not found');
    });

    // 9. MARKS_UPDATED
    await assertTest('9. Audit Action MARKS_UPDATED is logged upon revision of marks', async () => {
      const res = await request(app)
        .post('/api/admin/marks/upload-confirm')
        .set('Authorization', `Bearer ${currentAdminToken}`)
        .send({
          sectionId: cseSection.id,
          subjectId: cseSubject.id,
          assessmentId: ia1Assessment.id,
          academicYearId: academicYear.id,
          reason: 'Score revision upload',
          validRows: [
            {
              studentId: testStudentId,
              registerNumber: testRegNo,
              marksObtained: 88
            }
          ]
        });

      if (res.status !== 200) throw new Error(`Marks update confirm failed: ${JSON.stringify(res.body)}`);

      const audit = await prisma.auditLog.findFirst({
        where: { action: AuditAction.MARKS_UPDATED, entityId: ia1Assessment.id },
        orderBy: { createdAt: 'desc' }
      });
      if (!audit) throw new Error('MARKS_UPDATED audit log not found');
    });

    // 10. PERFORMANCE_PUBLISHED
    await assertTest('10. Audit Action PERFORMANCE_PUBLISHED is logged upon generating assessment snapshots', async () => {
      const res = await request(app)
        .post('/api/admin/analytics/performance/snapshots/generate')
        .set('Authorization', `Bearer ${currentAdminToken}`)
        .send({
          assessmentId: ia1Assessment.id,
          sectionId: cseSection.id
        });

      if (res.status !== 200) throw new Error(`Generate snapshots failed: ${JSON.stringify(res.body)}`);

      const audit = await prisma.auditLog.findFirst({
        where: { action: AuditAction.PERFORMANCE_PUBLISHED, entityId: ia1Assessment.id },
        orderBy: { createdAt: 'desc' }
      });
      if (!audit) throw new Error('PERFORMANCE_PUBLISHED audit log not found');
    });

    // 11. COLLEGE_NOTICE_CREATED
    let testNoticeId: string;
    await assertTest('11. Audit Action COLLEGE_NOTICE_CREATED is logged upon notice creation', async () => {
      const res = await request(app)
        .post('/api/admin/notices')
        .set('Authorization', `Bearer ${currentAdminToken}`)
        .send({
          title: 'Audit Test College Notice',
          content: 'Important academic guidelines published for all students.',
          noticeType: NoticeType.ACADEMIC,
          targetType: NoticeTargetType.ALL_COLLEGE,
          publishNow: false
        });

      if (res.status !== 201) throw new Error(`Create notice failed: ${JSON.stringify(res.body)}`);
      testNoticeId = res.body.notice.id;

      const audit = await prisma.auditLog.findFirst({
        where: { action: AuditAction.COLLEGE_NOTICE_CREATED, entityId: testNoticeId }
      });
      if (!audit) throw new Error('COLLEGE_NOTICE_CREATED audit log not found');
    });

    // 12. COLLEGE_NOTICE_PUBLISHED
    await assertTest('12. Audit Action COLLEGE_NOTICE_PUBLISHED is logged upon notice publication', async () => {
      const res = await request(app)
        .post(`/api/admin/notices/${testNoticeId}/publish`)
        .set('Authorization', `Bearer ${currentAdminToken}`);

      if (res.status !== 200) throw new Error(`Publish notice failed: ${JSON.stringify(res.body)}`);

      const audit = await prisma.auditLog.findFirst({
        where: { action: AuditAction.COLLEGE_NOTICE_PUBLISHED, entityId: testNoticeId }
      });
      if (!audit) throw new Error('COLLEGE_NOTICE_PUBLISHED audit log not found');
    });

    // 13. NOTIFICATION_SENT
    await assertTest('13. Audit Action NOTIFICATION_SENT is logged upon delivery processing', async () => {
      // Seed a test notification
      const testNotification = await prisma.notification.create({
        data: {
          noticeId: testNoticeId,
          parentMobile: '9876543210',
          title: 'Audit Test College Notice',
          category: NotificationCategory.COLLEGE_NOTICE,
          type: NotificationType.SMS,
          message: 'Test notification delivery for audit log verification'
        }
      });

      // Process via worker
      const jobResult = await processNotificationJob({
        notificationId: testNotification.id,
        recipientMobile: '9876543210',
        category: NotificationCategory.COLLEGE_NOTICE,
        type: NotificationType.SMS,
        message: 'Test notification delivery for audit log verification',
        noticeId: testNoticeId,
        title: 'Audit Test College Notice'
      });

      if (!jobResult.success) throw new Error(`Job execution failed: ${jobResult.errorMessage}`);

      const audit = await prisma.auditLog.findFirst({
        where: { action: AuditAction.NOTIFICATION_SENT, entityId: testNotification.id }
      });
      if (!audit) throw new Error('NOTIFICATION_SENT audit log not found');
    });

    // 14. REPORT_GENERATED
    await assertTest('14. Audit Action REPORT_GENERATED is logged upon student performance report retrieval', async () => {
      const res = await request(app)
        .get(`/api/admin/analytics/performance/student/${student.id}`)
        .set('Authorization', `Bearer ${currentAdminToken}`);

      if (res.status !== 200) throw new Error(`Get student performance failed: ${JSON.stringify(res.body)}`);

      const audit = await prisma.auditLog.findFirst({
        where: { action: AuditAction.REPORT_GENERATED, entityId: student.id },
        orderBy: { createdAt: 'desc' }
      });
      if (!audit) throw new Error('REPORT_GENERATED audit log not found');
    });

    // =========================================================================
    // SUITE 5: FILTERING & SEARCHING
    // =========================================================================
    console.log('\n--- Suite 5: Filtering, Search, & Action Summaries ---');

    await assertTest('Filter audit logs by specific action returns matching entries', async () => {
      const res = await request(app)
        .get(`/api/admin/audit-logs?action=${AuditAction.STUDENT_CREATED}`)
        .set('Authorization', `Bearer ${currentAdminToken}`);

      if (res.status !== 200) throw new Error(`Expected 200, got ${res.status}`);
      const logs = res.body.logs;
      if (!logs.every((l: any) => l.action === AuditAction.STUDENT_CREATED)) {
        throw new Error('Non-matching actions returned');
      }
    });

    await assertTest('Action counts summary returns breakdown across all 14 actions', async () => {
      const res = await request(app)
        .get('/api/admin/audit-logs')
        .set('Authorization', `Bearer ${currentAdminToken}`);

      if (res.status !== 200) throw new Error(`Expected 200, got ${res.status}`);
      const counts = res.body.actionCounts;
      if (!counts || typeof counts !== 'object') throw new Error('Missing actionCounts summary');
      if (!counts[AuditAction.LOGIN] || !counts[AuditAction.STUDENT_CREATED]) {
        throw new Error('Expected counts for tested actions');
      }
    });

    await assertTest('Mark change history search by student register number filters accurately', async () => {
      const res = await request(app)
        .get(`/api/admin/audit-logs/mark-changes?search=${student.registerNumber}`)
        .set('Authorization', `Bearer ${currentAdminToken}`);

      if (res.status !== 200) throw new Error(`Expected 200, got ${res.status}`);
      const logs = res.body.logs;
      if (logs.length === 0) throw new Error('Expected to find mark change logs for searched registerNumber');
      if (!logs.every((l: any) => l.student?.registerNumber === student.registerNumber)) {
        throw new Error('Search result returned non-matching student');
      }
    });

  } finally {
    console.log(`\n======================================================`);
    console.log(`🏁 Complete Audit Logging Test Suite Complete:`);
    console.log(`   Passed: ${passed}`);
    console.log(`   Failed: ${failed}`);
    console.log(`   Success Rate: ${Math.round((passed / (passed + failed)) * 100)}%`);
    console.log(`======================================================\n`);
  }
}

runAuditLoggingTests()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error('Test suite failed:', err);
    process.exit(1);
  });
