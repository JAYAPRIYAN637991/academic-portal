import request from 'supertest';
import { createApp } from '../server';
import { prisma } from '../db';
import { NoticeTargetType, NoticeType, NotificationCategory, NotificationStatus, NotificationType } from '@prisma/client';
import { NotificationProviderFactory } from '../providers';
import { NotificationQueue } from '../queue';

async function runMockNotificationProviderTests() {
  console.log('🧪 Starting Mock Notification Provider Architecture Test Suite...\n');
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

    const sampleStudent = await prisma.student.findFirst({
      where: { status: 'ACTIVE' },
      include: { department: true, year: true, section: true }
    });

    if (!sampleStudent) throw new Error('No active student found for test setup');

    const sampleSection = sampleStudent.section;

    // =======================================================================
    // SUITE 1: PROVIDER ARCHITECTURE & MOCK MODE VERIFICATION
    // =======================================================================
    console.log('--- SUITE 1: Provider Architecture & Mock Mode Verification ---');

    await assertTest('Provider 1.1: System is running in MOCK mode', () => {
      const isMock = NotificationProviderFactory.isMockMode();
      if (!isMock) throw new Error('Expected NotificationProviderFactory.isMockMode() to be true');
    });

    await assertTest('Provider 1.2: Mock provider returns mock provider IDs and DELIVERED status', async () => {
      const mockProvider = NotificationProviderFactory.getMockProvider();
      const res = await mockProvider.send({
        recipientMobile: '+91 9876543210',
        message: 'Test mock SMS dispatch',
        type: NotificationType.SMS,
        category: NotificationCategory.COLLEGE_NOTICE
      });

      if (!res.success) throw new Error('Expected mock send to succeed');
      if (res.status !== NotificationStatus.DELIVERED) throw new Error(`Expected DELIVERED, got ${res.status}`);
      if (!res.providerId.startsWith('mock-sms-')) throw new Error(`Expected mock-sms- prefix, got ${res.providerId}`);
      if (!res.sentAt || !res.deliveredAt) throw new Error('Missing sentAt or deliveredAt timestamps');
    });

    await assertTest('Provider 1.3: WhatsApp channel generates mock-wa- provider ID', async () => {
      const mockProvider = NotificationProviderFactory.getMockProvider();
      const res = await mockProvider.send({
        recipientMobile: '+91 9876543210',
        message: 'Test mock WhatsApp dispatch',
        type: NotificationType.WHATSAPP,
        category: NotificationCategory.COLLEGE_NOTICE
      });

      if (!res.success) throw new Error('Expected mock send to succeed');
      if (!res.providerId.startsWith('mock-wa-')) throw new Error(`Expected mock-wa- prefix, got ${res.providerId}`);
    });

    // =======================================================================
    // SUITE 2: ACADEMIC PERFORMANCE NOTIFICATION DISPATCH
    // =======================================================================
    console.log('\n--- SUITE 2: Academic Performance Notification (Mock Mode) ---');

    await assertTest('Perf 2.1: Admin dispatches performance notification via BOTH channels', async () => {
      const res = await request(app)
        .post('/api/admin/notifications/send-performance')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          studentId: sampleStudent.id,
          channel: 'BOTH'
        });

      if (res.status !== 200) throw new Error(`HTTP ${res.status}: ${JSON.stringify(res.body)}`);
      if (!res.body.success) throw new Error('Expected dispatch to succeed');
      if (!res.body.notifications || res.body.notifications.length !== 2) {
        throw new Error(`Expected 2 notification records (SMS + WhatsApp), got ${res.body.notifications?.length}`);
      }

      await NotificationQueue.waitUntilIdle(4000);

      // Check DB records
      const dbNotifications = await prisma.notification.findMany({
        where: {
          studentId: sampleStudent.id,
          category: NotificationCategory.PERFORMANCE
        },
        orderBy: { createdAt: 'desc' },
        take: 2
      });

      if (dbNotifications.length < 2) throw new Error('DB notifications missing');

      for (const n of dbNotifications) {
        if (n.status !== NotificationStatus.DELIVERED) {
          throw new Error(`Expected DB record status DELIVERED, got ${n.status}`);
        }
        if (!n.providerMessageId || !n.providerMessageId.startsWith('mock-')) {
          throw new Error(`Expected mock- provider ID, got ${n.providerMessageId}`);
        }
        if (!n.sentAt || !n.deliveredAt) {
          throw new Error('Timestamps sentAt or deliveredAt missing in DB record');
        }
        if (!n.message.includes('Dear Parent') || !n.message.includes(sampleStudent.name)) {
          throw new Error(`Message content missing template elements: ${n.message}`);
        }
      }
    });

    await assertTest('Perf 2.2: Staff user receives 403 Forbidden when attempting performance dispatch', async () => {
      const res = await request(app)
        .post('/api/admin/notifications/send-performance')
        .set('Authorization', `Bearer ${staffToken}`)
        .send({
          studentId: sampleStudent.id,
          channel: 'BOTH'
        });

      if (res.status !== 403) throw new Error(`Expected 403 Forbidden, got ${res.status}`);
    });

    // =======================================================================
    // SUITE 3: COLLEGE NOTICES (HOLIDAY, INTERNAL EXAM, SEMESTER)
    // =======================================================================
    console.log('\n--- SUITE 3: College Notices (Predefined Templates & Mock Dispatch) ---');

    await assertTest('Notice 3.1: Holiday Notice creates formatted notifications with mock provider IDs', async () => {
      const res = await request(app)
        .post('/api/admin/notices')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          title: 'Declared Holiday for Ganesh Chaturthi',
          content: 'The college will remain closed on 10 September 2026 due to a declared holiday.',
          noticeType: 'HOLIDAY',
          targetType: 'SECTION',
          sectionId: sampleSection.id,
          deliveryChannel: 'BOTH',
          status: 'PUBLISHED'
        });

      if (res.status !== 201) throw new Error(`HTTP ${res.status}: ${JSON.stringify(res.body)}`);
      const noticeId = res.body.notice.id;

      await NotificationQueue.waitUntilIdle(4000);

      const notifications = await prisma.notification.findMany({
        where: { noticeId }
      });

      if (notifications.length === 0) throw new Error('No notifications generated for published holiday notice');

      for (const notif of notifications) {
        if (notif.category !== NotificationCategory.COLLEGE_NOTICE) {
          throw new Error(`Expected COLLEGE_NOTICE, got ${notif.category}`);
        }
        if (notif.status !== NotificationStatus.DELIVERED) {
          throw new Error(`Expected DELIVERED status, got ${notif.status}`);
        }
        if (!notif.providerMessageId || !notif.providerMessageId.startsWith('mock-')) {
          throw new Error(`Expected mock- provider ID, got ${notif.providerMessageId}`);
        }
        if (!notif.message.includes('College Notice:')) {
          throw new Error(`Message missing Holiday header: ${notif.message}`);
        }
        if (!notif.message.includes('College Administration')) {
          throw new Error(`Message missing standard footer: ${notif.message}`);
        }
      }
    });

    await assertTest('Notice 3.2: Internal Exam Notice with SMS channel only', async () => {
      const res = await request(app)
        .post('/api/admin/notices')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          title: 'IA-2 Examination Timetable Notice',
          content: 'Internal Assessment-2 examinations will begin from 15 September 2026.',
          noticeType: 'INTERNAL_EXAM',
          targetType: 'SECTION',
          sectionId: sampleSection.id,
          deliveryChannel: 'SMS',
          status: 'PUBLISHED'
        });

      if (res.status !== 201) throw new Error(`HTTP ${res.status}: ${JSON.stringify(res.body)}`);
      const noticeId = res.body.notice.id;

      await NotificationQueue.waitUntilIdle(4000);

      const notifications = await prisma.notification.findMany({
        where: { noticeId }
      });

      if (notifications.length === 0) throw new Error('No notifications generated');
      // All must be SMS
      for (const notif of notifications) {
        if (notif.type !== NotificationType.SMS) {
          throw new Error(`Expected only SMS notifications, got ${notif.type}`);
        }
        if (!notif.message.includes('Important College Notice:')) {
          throw new Error(`Message missing Internal Exam header: ${notif.message}`);
        }
        if (!notif.message.includes('follows the examination schedule')) {
          throw new Error(`Message missing internal exam guidance: ${notif.message}`);
        }
        if (!notif.providerMessageId || !notif.providerMessageId.startsWith('mock-sms-')) {
          throw new Error(`Expected mock-sms- prefix, got ${notif.providerMessageId}`);
        }
      }
    });

    await assertTest('Notice 3.3: Semester Notice with WhatsApp channel only', async () => {
      const res = await request(app)
        .post('/api/admin/notices')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          title: 'Anna University Semester Exams Notice',
          content: 'Semester examinations are scheduled to begin from 20 November 2026.',
          noticeType: 'SEMESTER_EXAM',
          targetType: 'SECTION',
          sectionId: sampleSection.id,
          deliveryChannel: 'WHATSAPP',
          status: 'PUBLISHED'
        });

      if (res.status !== 201) throw new Error(`HTTP ${res.status}: ${JSON.stringify(res.body)}`);
      const noticeId = res.body.notice.id;

      await NotificationQueue.waitUntilIdle(4000);

      const notifications = await prisma.notification.findMany({
        where: { noticeId }
      });

      if (notifications.length === 0) throw new Error('No notifications generated');
      // All must be WhatsApp
      for (const notif of notifications) {
        if (notif.type !== NotificationType.WHATSAPP) {
          throw new Error(`Expected only WHATSAPP notifications, got ${notif.type}`);
        }
        if (!notif.message.includes('Semester Examination Notice:')) {
          throw new Error(`Message missing Semester Exam header: ${notif.message}`);
        }
        if (!notif.providerMessageId || !notif.providerMessageId.startsWith('mock-wa-')) {
          throw new Error(`Expected mock-wa- prefix, got ${notif.providerMessageId}`);
        }
      }
    });

    // =======================================================================
    // SUITE 4: TARGETED AUDIENCES (SECTION VS ALL COLLEGE)
    // =======================================================================
    console.log('\n--- SUITE 4: Audience Scopes (Targeted Section vs All College) ---');

    await assertTest('Audience 4.1: Targeted Section Notice restricts dispatch to section students only', async () => {
      const sectionStudents = await prisma.student.findMany({
        where: { sectionId: sampleSection.id, status: 'ACTIVE' }
      });

      const res = await request(app)
        .post('/api/admin/notices')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          title: 'Special Section Coaching Notice',
          content: 'Remedial coaching classes will be conducted tomorrow.',
          noticeType: 'ACADEMIC',
          targetType: 'SECTION',
          sectionId: sampleSection.id,
          deliveryChannel: 'SMS',
          status: 'PUBLISHED'
        });

      if (res.status !== 201) throw new Error(`HTTP ${res.status}`);
      const noticeId = res.body.notice.id;

      await NotificationQueue.waitUntilIdle(4000);

      const notifications = await prisma.notification.findMany({
        where: { noticeId }
      });

      if (notifications.length !== sectionStudents.length) {
        throw new Error(`Expected ${sectionStudents.length} notifications, got ${notifications.length}`);
      }

      // Verify each recipient is from sampleSection
      const studentIdsInSec = new Set(sectionStudents.map(s => s.id));
      for (const notif of notifications) {
        if (!notif.studentId || !studentIdsInSec.has(notif.studentId)) {
          throw new Error(`Notification dispatched to student ${notif.studentId} outside target section!`);
        }
      }
    });

    await assertTest('Audience 4.2: All College Notice dispatches to entire student body', async () => {
      const allActiveStudents = await prisma.student.findMany({
        where: { status: 'ACTIVE' }
      });

      const res = await request(app)
        .post('/api/admin/notices')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          title: 'Annual College Sports Meet Announcement',
          content: 'Annual sports meet will be held on campus on Friday.',
          noticeType: 'GENERAL',
          targetType: 'ALL_COLLEGE',
          deliveryChannel: 'SMS',
          status: 'PUBLISHED'
        });

      if (res.status !== 201) throw new Error(`HTTP ${res.status}`);
      const noticeId = res.body.notice.id;

      await NotificationQueue.waitUntilIdle(4000);

      const notifications = await prisma.notification.findMany({
        where: { noticeId }
      });

      if (notifications.length !== allActiveStudents.length) {
        throw new Error(`Expected ${allActiveStudents.length} notifications for ALL_COLLEGE, got ${notifications.length}`);
      }

      for (const notif of notifications) {
        if (notif.status !== NotificationStatus.DELIVERED) {
          throw new Error(`Expected DELIVERED status, got ${notif.status}`);
        }
        if (!notif.providerMessageId || !notif.providerMessageId.startsWith('mock-sms-')) {
          throw new Error(`Expected mock-sms- prefix, got ${notif.providerMessageId}`);
        }
      }
    });

    // =======================================================================
    // SUITE 5: FAILED MOCK NOTIFICATION & ERROR HANDLING
    // =======================================================================
    console.log('\n--- SUITE 5: Failed Mock Notification Simulation ---');

    await assertTest('Failure 5.1: Simulated failure records FAILED status, timestamp, and errorMessage', async () => {
      const res = await request(app)
        .post('/api/admin/notifications/send-performance')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          studentId: sampleStudent.id,
          channel: 'SMS',
          simulateFailure: true
        });

      if (res.status !== 200) throw new Error(`HTTP ${res.status}`);

      const failedNotification = res.body.notifications[0];
      if (!failedNotification) throw new Error('Expected at least one notification in response');

      // Wait for worker retries to exhaust
      await NotificationQueue.waitUntilIdle(4000);

      // Check DB record
      const dbRecord = await prisma.notification.findUnique({
        where: { id: failedNotification.id }
      });

      if (!dbRecord) throw new Error('DB record not found');
      if (dbRecord.status !== NotificationStatus.FAILED) {
        throw new Error(`Expected DB status FAILED, got ${dbRecord.status}`);
      }
      if (!dbRecord.failedAt) {
        throw new Error('Expected failedAt timestamp to be populated in DB');
      }
      if (dbRecord.deliveredAt !== null) {
        throw new Error('Expected deliveredAt to be null for failed notification');
      }
      if (!dbRecord.errorMessage || !dbRecord.errorMessage.includes('Simulated provider dispatch failure')) {
        throw new Error(`Expected specific failure errorMessage, got: ${dbRecord.errorMessage}`);
      }
      if (!dbRecord.providerMessageId || !dbRecord.providerMessageId.startsWith('mock-')) {
        throw new Error(`Expected mock provider ID even on failure, got ${dbRecord.providerMessageId}`);
      }
    });

    await assertTest('Failure 5.2: Mock provider handles invalid/unreachable phone format with FAILED status', async () => {
      const mockProvider = NotificationProviderFactory.getMockProvider();
      const res = await mockProvider.send({
        recipientMobile: '0000000000',
        message: 'Invalid number test',
        type: NotificationType.SMS,
        category: NotificationCategory.PERFORMANCE
      });

      if (res.success !== false) throw new Error('Expected failure for invalid number');
      if (res.status !== NotificationStatus.FAILED) throw new Error(`Expected FAILED status, got ${res.status}`);
      if (!res.failedAt) throw new Error('Expected failedAt timestamp');
      if (!res.errorMessage?.includes('unreachable') && !res.errorMessage?.includes('invalid')) {
        throw new Error(`Unexpected error message: ${res.errorMessage}`);
      }
    });

  } catch (globalErr: any) {
    console.error('Fatal error during mock notification test run:', globalErr);
    failed++;
  }

  console.log('\n========================================');
  console.log(`Mock Notification Provider Tests: ${passed} Passed, ${failed} Failed`);
  console.log('========================================');

  if (failed > 0) {
    process.exit(1);
  }
}

runMockNotificationProviderTests()
  .finally(async () => {
    await prisma.$disconnect();
  });
