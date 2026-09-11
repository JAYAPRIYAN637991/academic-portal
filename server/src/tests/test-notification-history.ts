import request from 'supertest';
import { createApp } from '../server';
import { prisma } from '../db';
import {
  NoticeTargetType,
  NoticeType,
  NotificationCategory,
  NotificationStatus,
  NotificationType
} from '@prisma/client';
import { NotificationQueue } from '../queue';

async function runNotificationHistoryTests() {
  console.log('🧪 Starting Admin-Only Notification History & Retry Engine Test Suite...\n');
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
    const adminLogin = await request(app)
      .post('/api/auth/login')
      .send({ email: 'admin@college.edu', password: 'admin123' });
    const adminToken = adminLogin.body.token;

    const staffLogin = await request(app)
      .post('/api/auth/login')
      .send({ email: 'sarah.cse@college.edu', password: 'staff123' });
    const staffToken = staffLogin.body.token;

    // Fetch test entities
    const academicYear = await prisma.academicYear.findFirst();
    const cseDept = await prisma.department.findUnique({ where: { code: 'CSE' } });
    const eceDept = await prisma.department.findUnique({ where: { code: 'ECE' } });
    const year3 = await prisma.year.findFirst({ where: { yearNumber: 3 } });
    const cseSection = await prisma.section.findFirst({ where: { departmentId: cseDept!.id } });
    const sampleStudent = await prisma.student.findFirst({
      where: { departmentId: cseDept!.id, status: 'ACTIVE' },
      include: { department: true, year: true, section: true, academicYear: true }
    });

    if (!academicYear || !cseDept || !eceDept || !year3 || !cseSection || !sampleStudent) {
      throw new Error('Database seeding incomplete for notification history tests');
    }

    // Seed diverse test notification records across categories, channels, and statuses
    console.log('Seeding diverse test notification records...');

    // 1. Performance Delivered SMS
    const notifPerfDelivered = await prisma.notification.create({
      data: {
        studentId: sampleStudent.id,
        parentMobile: sampleStudent.parentMobile,
        type: NotificationType.SMS,
        category: NotificationCategory.PERFORMANCE,
        title: 'Academic Performance Update - Ethan Vance',
        message: 'Dear Parent, Ethan Vance achieved 84% in IA-2 (+12 improvement).',
        status: NotificationStatus.DELIVERED,
        providerMessageId: 'mock-sms-seed-1',
        sentAt: new Date(Date.now() - 3600000),
        deliveredAt: new Date(Date.now() - 3500000)
      }
    });

    // 2. College Notice Delivered WhatsApp
    const testNotice = await prisma.collegeNotice.create({
      data: {
        title: 'Annual Tech Symposium 2026',
        content: 'The Department of CSE is organizing a National Tech Symposium.',
        noticeType: NoticeType.ACADEMIC,
        targetType: NoticeTargetType.SECTION,
        departmentId: cseDept.id,
        yearId: year3.id,
        sectionId: cseSection.id,
        academicYearId: academicYear.id,
        status: 'PUBLISHED',
        deliveryChannel: 'WHATSAPP',
        createdBy: adminLogin.body.user.id
      }
    });

    const notifNoticeDelivered = await prisma.notification.create({
      data: {
        noticeId: testNotice.id,
        studentId: sampleStudent.id,
        parentMobile: sampleStudent.parentMobile,
        type: NotificationType.WHATSAPP,
        category: NotificationCategory.COLLEGE_NOTICE,
        title: testNotice.title,
        message: 'College Notice: The Department of CSE is organizing a National Tech Symposium.',
        status: NotificationStatus.DELIVERED,
        providerMessageId: 'mock-wa-seed-2',
        sentAt: new Date(Date.now() - 1800000),
        deliveredAt: new Date(Date.now() - 1700000)
      }
    });

    // 3. Failed Performance Notification (eligible for retry)
    const notifFailed = await prisma.notification.create({
      data: {
        studentId: sampleStudent.id,
        parentMobile: sampleStudent.parentMobile,
        type: NotificationType.SMS,
        category: NotificationCategory.PERFORMANCE,
        title: 'Academic Alert - Ethan Vance',
        message: 'Dear Parent, your ward requires academic attention in CS8501.',
        status: NotificationStatus.FAILED,
        providerMessageId: 'mock-sms-seed-failed',
        retryCount: 3,
        failedAt: new Date(Date.now() - 900000),
        errorMessage: '[Retries exhausted]: Simulated provider network timeout'
      }
    });

    // 4. Pending Notification
    const notifPending = await prisma.notification.create({
      data: {
        noticeId: testNotice.id,
        studentId: sampleStudent.id,
        parentMobile: sampleStudent.parentMobile,
        type: NotificationType.WHATSAPP,
        category: NotificationCategory.COLLEGE_NOTICE,
        title: 'Follow-up Tech Symposium Registration',
        message: 'Dear Parent, register your ward before end of day.',
        status: NotificationStatus.PENDING
      }
    });

    // =======================================================================
    // SUITE 1: RBAC & PERMISSION PROTECTION
    // =======================================================================
    console.log('\n--- SUITE 1: Strict Admin-Only Clearance & Staff RBAC ---');

    await assertTest('RBAC 1.1: Unauthenticated request to /notifications/history returns 401 Unauthorized', async () => {
      const res = await request(app).get('/api/admin/notifications/history');
      if (res.status !== 401) throw new Error(`Expected 401, got ${res.status}`);
    });

    await assertTest('RBAC 1.2: Staff user accessing /notifications/history returns 403 Forbidden', async () => {
      const res = await request(app)
        .get('/api/admin/notifications/history')
        .set('Authorization', `Bearer ${staffToken}`);
      if (res.status !== 403) throw new Error(`Expected 403 Forbidden, got ${res.status}`);
      if (res.body.code !== 'ADMIN_ACCESS_REQUIRED') {
        throw new Error(`Expected code ADMIN_ACCESS_REQUIRED, got ${res.body.code}`);
      }
    });

    await assertTest('RBAC 1.3: Staff user attempting to retry notification returns 403 Forbidden', async () => {
      const res = await request(app)
        .post(`/api/admin/notifications/${notifFailed.id}/retry`)
        .set('Authorization', `Bearer ${staffToken}`);
      if (res.status !== 403) throw new Error(`Expected 403 Forbidden, got ${res.status}`);
    });

    await assertTest('RBAC 1.4: Staff user attempting bulk retry returns 403 Forbidden', async () => {
      const res = await request(app)
        .post('/api/admin/notifications/retry-failed')
        .set('Authorization', `Bearer ${staffToken}`)
        .send({});
      if (res.status !== 403) throw new Error(`Expected 403 Forbidden, got ${res.status}`);
    });

    await assertTest('RBAC 1.5: Admin user successfully accesses /notifications/history (200 OK)', async () => {
      const res = await request(app)
        .get('/api/admin/notifications/history')
        .set('Authorization', `Bearer ${adminToken}`);
      if (res.status !== 200) throw new Error(`HTTP ${res.status}: ${JSON.stringify(res.body)}`);
      if (!Array.isArray(res.body.notifications)) throw new Error('Expected notifications array in response');
      if (!res.body.summaryCards) throw new Error('Expected summaryCards object in response');
    });

    // =======================================================================
    // SUITE 2: DATA FIELDS & PRIVACY MASKING
    // =======================================================================
    console.log('\n--- SUITE 2: Required Data Fields & Parent Mobile Masking ---');

    await assertTest('Fields 2.1: Response contains all required fields: Student, Reg No, Category, Title, Type, Status, Times, Error', async () => {
      const res = await request(app)
        .get('/api/admin/notifications/history')
        .set('Authorization', `Bearer ${adminToken}`);

      if (res.status !== 200) throw new Error(`HTTP ${res.status}`);
      const items = res.body.notifications;
      if (items.length === 0) throw new Error('Expected at least one notification');

      const failedItem = items.find((n: any) => n.id === notifFailed.id);
      if (!failedItem) throw new Error('Failed test notification not found in history');

      // Verify fields
      if (!failedItem.studentName || failedItem.studentName !== sampleStudent.name) {
        throw new Error(`Expected studentName "${sampleStudent.name}", got ${failedItem.studentName}`);
      }
      if (!failedItem.registerNumber || failedItem.registerNumber !== sampleStudent.registerNumber) {
        throw new Error(`Expected registerNumber "${sampleStudent.registerNumber}", got ${failedItem.registerNumber}`);
      }
      if (failedItem.category !== NotificationCategory.PERFORMANCE) {
        throw new Error(`Expected category PERFORMANCE, got ${failedItem.category}`);
      }
      if (!failedItem.title) {
        throw new Error('Notice title is missing');
      }
      if (failedItem.type !== NotificationType.SMS) {
        throw new Error(`Expected type SMS, got ${failedItem.type}`);
      }
      if (failedItem.status !== NotificationStatus.FAILED) {
        throw new Error(`Expected status FAILED, got ${failedItem.status}`);
      }
      if (!failedItem.failedAt) {
        throw new Error('failedAt timestamp is missing');
      }
      if (!failedItem.errorMessage || !failedItem.errorMessage.includes('Simulated provider network timeout')) {
        throw new Error(`Expected failure reason in errorMessage, got: ${failedItem.errorMessage}`);
      }
    });

    await assertTest('Privacy 2.2: Parent mobile numbers are strictly masked and cleartext is NEVER exposed', async () => {
      const res = await request(app)
        .get('/api/admin/notifications/history')
        .set('Authorization', `Bearer ${adminToken}`);

      const rawNumber = sampleStudent.parentMobile;
      const responseText = JSON.stringify(res.body);

      // Raw unmasked 10-digit/full mobile must NOT appear anywhere in the response
      if (responseText.includes(`"${rawNumber}"`)) {
        throw new Error(`CRITICAL PRIVACY VIOLATION: Raw unmasked parent phone number ${rawNumber} was exposed in API response!`);
      }

      // Check maskedMobile format on all records
      for (const item of res.body.notifications) {
        if (!item.maskedMobile) {
          throw new Error(`Notification ${item.id} is missing maskedMobile field`);
        }
        if (!item.maskedMobile.includes('****')) {
          throw new Error(`Notification ${item.id} maskedMobile "${item.maskedMobile}" does not contain masking asterisks`);
        }
      }
    });

    // =======================================================================
    // SUITE 3: MULTI-PARAMETER FILTERING
    // =======================================================================
    console.log('\n--- SUITE 3: Comprehensive Multi-Parameter Filters ---');

    await assertTest('Filter 3.1: Filter by Category = PERFORMANCE', async () => {
      const res = await request(app)
        .get('/api/admin/notifications/history?category=PERFORMANCE')
        .set('Authorization', `Bearer ${adminToken}`);

      if (res.status !== 200) throw new Error(`HTTP ${res.status}`);
      for (const item of res.body.notifications) {
        if (item.category !== 'PERFORMANCE') {
          throw new Error(`Expected only PERFORMANCE category, got ${item.category}`);
        }
      }
    });

    await assertTest('Filter 3.2: Filter by Category = COLLEGE_NOTICE', async () => {
      const res = await request(app)
        .get('/api/admin/notifications/history?category=COLLEGE_NOTICE')
        .set('Authorization', `Bearer ${adminToken}`);

      if (res.status !== 200) throw new Error(`HTTP ${res.status}`);
      for (const item of res.body.notifications) {
        if (item.category !== 'COLLEGE_NOTICE') {
          throw new Error(`Expected only COLLEGE_NOTICE category, got ${item.category}`);
        }
      }
    });

    await assertTest('Filter 3.3: Filter by Notification Type = WHATSAPP', async () => {
      const res = await request(app)
        .get('/api/admin/notifications/history?type=WHATSAPP')
        .set('Authorization', `Bearer ${adminToken}`);

      if (res.status !== 200) throw new Error(`HTTP ${res.status}`);
      for (const item of res.body.notifications) {
        if (item.type !== 'WHATSAPP') {
          throw new Error(`Expected only WHATSAPP notifications, got ${item.type}`);
        }
      }
    });

    await assertTest('Filter 3.4: Filter by Status = FAILED', async () => {
      const res = await request(app)
        .get('/api/admin/notifications/history?status=FAILED')
        .set('Authorization', `Bearer ${adminToken}`);

      if (res.status !== 200) throw new Error(`HTTP ${res.status}`);
      for (const item of res.body.notifications) {
        if (item.status !== 'FAILED') {
          throw new Error(`Expected only FAILED notifications, got ${item.status}`);
        }
      }
    });

    await assertTest('Filter 3.5: Filter by Department = CSE', async () => {
      const res = await request(app)
        .get(`/api/admin/notifications/history?departmentId=${cseDept.id}`)
        .set('Authorization', `Bearer ${adminToken}`);

      if (res.status !== 200) throw new Error(`HTTP ${res.status}`);
      for (const item of res.body.notifications) {
        const itemDeptId = item.student?.department?.id || item.notice?.departmentId;
        if (itemDeptId && itemDeptId !== cseDept.id) {
          throw new Error(`Expected CSE department ${cseDept.id}, got ${itemDeptId}`);
        }
      }
    });

    await assertTest('Filter 3.6: Filter by Academic Year', async () => {
      const res = await request(app)
        .get(`/api/admin/notifications/history?academicYearId=${academicYear.id}`)
        .set('Authorization', `Bearer ${adminToken}`);

      if (res.status !== 200) throw new Error(`HTTP ${res.status}`);
      if (res.body.notifications.length === 0) {
        throw new Error('Expected notifications for seeded academic year');
      }
    });

    await assertTest('Filter 3.7: Filter by Date (Today)', async () => {
      const todayIso = new Date().toISOString().split('T')[0];
      const res = await request(app)
        .get(`/api/admin/notifications/history?date=${todayIso}`)
        .set('Authorization', `Bearer ${adminToken}`);

      if (res.status !== 200) throw new Error(`HTTP ${res.status}`);
      if (res.body.notifications.length === 0) {
        throw new Error('Expected notifications dispatched today');
      }
    });

    await assertTest('Filter 3.8: Search query matches Register Number', async () => {
      const res = await request(app)
        .get(`/api/admin/notifications/history?search=${sampleStudent.registerNumber}`)
        .set('Authorization', `Bearer ${adminToken}`);

      if (res.status !== 200) throw new Error(`HTTP ${res.status}`);
      if (res.body.notifications.length === 0) {
        throw new Error(`Expected results searching for registerNumber ${sampleStudent.registerNumber}`);
      }
      for (const item of res.body.notifications) {
        if (item.student && item.student.registerNumber !== sampleStudent.registerNumber) {
          throw new Error(`Unexpected student in search results: ${item.student.registerNumber}`);
        }
      }
    });

    // =======================================================================
    // SUITE 4: SUMMARY CARDS AGGREGATION
    // =======================================================================
    console.log('\n--- SUITE 4: Summary Cards Metrics Aggregation ---');

    await assertTest('Summary 4.1: Summary cards accurately count Total, Sent, Delivered, Failed, and Pending', async () => {
      const res = await request(app)
        .get('/api/admin/notifications/history')
        .set('Authorization', `Bearer ${adminToken}`);

      if (res.status !== 200) throw new Error(`HTTP ${res.status}`);
      const cards = res.body.summaryCards;

      if (typeof cards.total !== 'number' || cards.total < 4) {
        throw new Error(`Expected summaryCards.total >= 4, got ${cards.total}`);
      }
      if (typeof cards.delivered !== 'number' || cards.delivered < 2) {
        throw new Error(`Expected summaryCards.delivered >= 2, got ${cards.delivered}`);
      }
      if (typeof cards.failed !== 'number' || cards.failed < 1) {
        throw new Error(`Expected summaryCards.failed >= 1, got ${cards.failed}`);
      }
      if (typeof cards.pending !== 'number' || cards.pending < 1) {
        throw new Error(`Expected summaryCards.pending >= 1, got ${cards.pending}`);
      }
      if (typeof cards.sent !== 'number') {
        throw new Error(`Expected summaryCards.sent to be a number, got ${cards.sent}`);
      }

      console.log('     📊 Summary Cards:', cards);
    });

    // =======================================================================
    // SUITE 5: FAILED NOTIFICATION RETRY FUNCTIONALITY
    // =======================================================================
    console.log('\n--- SUITE 5: Retrying Failed Notifications ---');

    await assertTest('Retry 5.1: Attempting retry on a DELIVERED notification is rejected with 400 Bad Request', async () => {
      const res = await request(app)
        .post(`/api/admin/notifications/${notifPerfDelivered.id}/retry`)
        .set('Authorization', `Bearer ${adminToken}`);

      if (res.status !== 400) throw new Error(`Expected 400 Bad Request, got ${res.status}`);
      if (!res.body.error?.includes('Only notifications with FAILED status can be retried')) {
        throw new Error(`Expected status validation error message, got: ${res.body.error}`);
      }
    });

    await assertTest('Retry 5.2: Admin retries FAILED notification -> Transitions to PENDING and processes to DELIVERED', async () => {
      const res = await request(app)
        .post(`/api/admin/notifications/${notifFailed.id}/retry`)
        .set('Authorization', `Bearer ${adminToken}`);

      if (res.status !== 200) throw new Error(`HTTP ${res.status}: ${JSON.stringify(res.body)}`);
      if (!res.body.success) throw new Error('Expected retry endpoint to succeed');
      if (res.body.notification.status !== NotificationStatus.PENDING) {
        throw new Error(`Expected immediate status PENDING upon retry, got ${res.body.notification.status}`);
      }

      // Wait for background worker to process the retried job
      await NotificationQueue.waitUntilIdle(4000);

      // Verify database record transitioned to DELIVERED
      const dbRecord = await prisma.notification.findUnique({
        where: { id: notifFailed.id }
      });

      if (!dbRecord) throw new Error('Database record not found after retry');
      if (dbRecord.status !== NotificationStatus.DELIVERED) {
        throw new Error(`Expected DELIVERED status after worker retry, got ${dbRecord.status}`);
      }
      if (!dbRecord.deliveredAt) {
        throw new Error('Expected deliveredAt timestamp to be populated after successful retry');
      }
      if (dbRecord.errorMessage !== null) {
        throw new Error(`Expected errorMessage to be cleared upon success, got: ${dbRecord.errorMessage}`);
      }
    });

    await assertTest('Retry 5.3: Bulk retry returns count of requeued failed notifications', async () => {
      // Create another failed notification to test bulk retry
      const extraFailed = await prisma.notification.create({
        data: {
          studentId: sampleStudent.id,
          parentMobile: sampleStudent.parentMobile,
          type: NotificationType.SMS,
          category: NotificationCategory.COLLEGE_NOTICE,
          title: 'Bulk Retry Test Notice',
          message: 'Testing bulk retry mechanism.',
          status: NotificationStatus.FAILED,
          errorMessage: 'Initial failure'
        }
      });

      const res = await request(app)
        .post('/api/admin/notifications/retry-failed')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ category: 'COLLEGE_NOTICE' });

      if (res.status !== 200) throw new Error(`HTTP ${res.status}`);
      if (!res.body.success) throw new Error('Expected bulk retry to succeed');
      if (res.body.count < 1) throw new Error(`Expected count >= 1, got ${res.body.count}`);

      await NotificationQueue.waitUntilIdle(4000);

      const dbRecord = await prisma.notification.findUnique({
        where: { id: extraFailed.id }
      });
      if (dbRecord?.status !== NotificationStatus.DELIVERED) {
        throw new Error(`Expected DELIVERED after bulk retry, got ${dbRecord?.status}`);
      }
    });

    // =======================================================================
    // SUITE 6: STAFF BOUNDARY PROTECTION
    // =======================================================================
    console.log('\n--- SUITE 6: Staff Boundary Protection ---');

    await assertTest('Boundary 6.1: Staff routes (/api/staff/*) do not expose notification history', async () => {
      const res = await request(app)
        .get('/api/staff/notifications/history')
        .set('Authorization', `Bearer ${staffToken}`);

      // Route does not exist on staff router -> 404
      if (res.status !== 404) throw new Error(`Expected 404 for non-existent staff notifications route, got ${res.status}`);
    });

  } catch (globalErr: any) {
    console.error('Fatal error during notification history test run:', globalErr);
    failed++;
  }

  console.log('\n========================================');
  console.log(`Notification History Tests: ${passed} Passed, ${failed} Failed`);
  console.log('========================================');

  if (failed > 0) {
    process.exit(1);
  }
}

runNotificationHistoryTests()
  .finally(async () => {
    await prisma.$disconnect();
  });
