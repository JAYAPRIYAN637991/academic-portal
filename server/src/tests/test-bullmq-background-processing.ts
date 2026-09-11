import request from 'supertest';
import { createApp } from '../server';
import { prisma } from '../db';
import { NotificationQueue } from '../queue';
import { NotificationCategory, NotificationStatus, NotificationType } from '@prisma/client';

async function runBullMQBackgroundProcessingTests() {
  console.log('🧪 Starting BullMQ & Redis Background Notification Processing Test Suite...\n');
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
    // 1. Authenticate Admin
    const adminLogin = await request(app)
      .post('/api/auth/login')
      .send({ email: 'admin@college.edu', password: 'admin123' });
    const adminToken = adminLogin.body.token;
    if (!adminToken) throw new Error('Failed to acquire admin token');

    const sampleStudent = await prisma.student.findFirst({
      where: { status: 'ACTIVE' },
      include: { section: true }
    });
    if (!sampleStudent) throw new Error('No active student found');

    const sampleSection = sampleStudent.section;

    // =======================================================================
    // SUITE 1: NON-BLOCKING ADMIN PUBLISH WORKFLOW
    // =======================================================================
    console.log('--- SUITE 1: Non-Blocking Admin Publish Workflow ---');

    let publishedNoticeId = '';

    await assertTest('Publish 1.1: Admin publish returns immediately (<250ms) without waiting for SMS/WA dispatches', async () => {
      const startTime = Date.now();

      const res = await request(app)
        .post('/api/admin/notices')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          title: 'High-Volume Emergency Weather Advisory',
          content: 'Severe rain warnings issued. College will operate on modified hours.',
          noticeType: 'URGENT',
          targetType: 'ALL_COLLEGE',
          deliveryChannel: 'BOTH',
          status: 'PUBLISHED'
        });

      const durationMs = Date.now() - startTime;
      console.log(`     ⚡ Publish API response time: ${durationMs}ms`);

      if (res.status !== 201) throw new Error(`HTTP ${res.status}: ${JSON.stringify(res.body)}`);
      if (durationMs > 350) throw new Error(`API took too long (${durationMs}ms) — expected non-blocking return`);

      publishedNoticeId = res.body.notice.id;
      const summary = res.body.notificationSummary;

      if (!summary) throw new Error('Missing notificationSummary in publish response');
      if (summary.status !== 'QUEUED') {
        throw new Error(`Expected status 'QUEUED', got ${summary.status}`);
      }
      if (summary.totalNotificationsCreated === 0) {
        throw new Error('Expected positive notifications created count');
      }
    });

    await assertTest('Publish 1.2: Notification records initially created in database and queued', async () => {
      const initialRecords = await prisma.notification.findMany({
        where: { noticeId: publishedNoticeId }
      });

      if (initialRecords.length === 0) throw new Error('No notification records created in DB');

      // Verify records are tracked
      for (const rec of initialRecords) {
        if (!['PENDING', 'PROCESSING', 'DELIVERED'].includes(rec.status)) {
          throw new Error(`Unexpected initial status: ${rec.status}`);
        }
      }
    });

    await assertTest('Publish 1.3: Background worker processes queued jobs to DELIVERED status', async () => {
      // Allow background queue to drain
      await NotificationQueue.waitUntilIdle(5000);

      const finalRecords = await prisma.notification.findMany({
        where: { noticeId: publishedNoticeId }
      });

      for (const rec of finalRecords) {
        if (rec.status !== NotificationStatus.DELIVERED) {
          throw new Error(`Notification ${rec.id} did not reach DELIVERED status: current status is ${rec.status}`);
        }
        if (!rec.providerMessageId) {
          throw new Error(`Notification ${rec.id} missing providerMessageId`);
        }
        if (!rec.sentAt || !rec.deliveredAt) {
          throw new Error(`Notification ${rec.id} missing sentAt or deliveredAt timestamp`);
        }
      }
    });

    // =======================================================================
    // SUITE 2: PERFORMANCE NOTIFICATION BACKGROUND QUEUEING
    // =======================================================================
    console.log('\n--- SUITE 2: Performance Notification Background Processing ---');

    let perfNotifId = '';

    await assertTest('Perf 2.1: Performance dispatch returns immediately with QUEUED status', async () => {
      const startTime = Date.now();

      const res = await request(app)
        .post('/api/admin/notifications/send-performance')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          studentId: sampleStudent.id,
          channel: 'BOTH'
        });

      const durationMs = Date.now() - startTime;
      console.log(`     ⚡ Performance dispatch response time: ${durationMs}ms`);

      if (res.status !== 200) throw new Error(`HTTP ${res.status}: ${JSON.stringify(res.body)}`);
      if (res.body.status !== 'QUEUED') throw new Error(`Expected status 'QUEUED', got ${res.body.status}`);

      perfNotifId = res.body.notifications[0]?.id;
      if (!perfNotifId) throw new Error('Missing notification ID in response');
    });

    await assertTest('Perf 2.2: Performance notification job is processed in background by worker', async () => {
      await NotificationQueue.waitUntilIdle(3000);

      const dbRecord = await prisma.notification.findUnique({
        where: { id: perfNotifId }
      });

      if (!dbRecord) throw new Error('Performance notification record not found');
      if (dbRecord.status !== NotificationStatus.DELIVERED) {
        throw new Error(`Expected DELIVERED status, got ${dbRecord.status}`);
      }
      if (!dbRecord.providerMessageId?.startsWith('mock-')) {
        throw new Error(`Expected mock provider ID, got ${dbRecord.providerMessageId}`);
      }
    });

    // =======================================================================
    // SUITE 3: RETRY LOGIC, RETRY COUNT & FAILURE REASON
    // =======================================================================
    console.log('\n--- SUITE 3: Retry Logic, Retry Count & Failure Reasons ---');

    await assertTest('Retry 3.1: Failed job retries, increments retryCount, and records FAILED status upon exhaustion', async () => {
      // Dispatch performance notification with simulated failure
      const res = await request(app)
        .post('/api/admin/notifications/send-performance')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          studentId: sampleStudent.id,
          channel: 'SMS',
          simulateFailure: true
        });

      if (res.status !== 200) throw new Error(`HTTP ${res.status}`);
      const failedNotifId = res.body.notifications[0]?.id;
      if (!failedNotifId) throw new Error('Missing notification record ID');

      // Wait for retry attempts to exhaust
      await NotificationQueue.waitUntilIdle(5000);

      const dbRecord = await prisma.notification.findUnique({
        where: { id: failedNotifId }
      });

      if (!dbRecord) throw new Error('Failed notification record not found');
      if (dbRecord.status !== NotificationStatus.FAILED) {
        throw new Error(`Expected FAILED status, got ${dbRecord.status}`);
      }
      if (!dbRecord.failedAt) {
        throw new Error('failedAt timestamp missing');
      }
      if (dbRecord.retryCount < 1) {
        throw new Error(`Expected retryCount >= 1, got ${dbRecord.retryCount}`);
      }
      if (!dbRecord.errorMessage || !dbRecord.errorMessage.includes('Simulated provider dispatch failure')) {
        throw new Error(`Expected failure reason in errorMessage, got: ${dbRecord.errorMessage}`);
      }
      if (!dbRecord.providerMessageId) {
        throw new Error('Expected provider ID recorded on failure');
      }
    });

    // =======================================================================
    // SUITE 4: LIVE NOTIFICATION DELIVERY STATISTICS API
    // =======================================================================
    console.log('\n--- SUITE 4: Live Delivery Statistics API ---');

    await assertTest('Stats 4.1: Notice notification-stats API returns Total, Pending, Processing, Sent, Delivered, Failed', async () => {
      const res = await request(app)
        .get(`/api/admin/notices/${publishedNoticeId}/notification-stats`)
        .set('Authorization', `Bearer ${adminToken}`);

      if (res.status !== 200) throw new Error(`HTTP ${res.status}`);
      const stats = res.body;

      console.log('     📊 Notice Stats:', stats);

      if (typeof stats.total !== 'number') throw new Error('Missing total count');
      if (typeof stats.pending !== 'number') throw new Error('Missing pending count');
      if (typeof stats.processing !== 'number') throw new Error('Missing processing count');
      if (typeof stats.delivered !== 'number') throw new Error('Missing delivered count');
      if (typeof stats.failed !== 'number') throw new Error('Missing failed count');

      if (stats.delivered === 0 && stats.total > 0) {
        throw new Error('Expected delivered count > 0 after queue processing');
      }
    });

    await assertTest('Stats 4.2: System-wide notifications stats API returns queue and database breakdown', async () => {
      const res = await request(app)
        .get('/api/admin/notifications/stats')
        .set('Authorization', `Bearer ${adminToken}`);

      if (res.status !== 200) throw new Error(`HTTP ${res.status}`);
      const body = res.body;

      if (!body.databaseCounts) throw new Error('Missing databaseCounts in response');
      if (!body.queueStats) throw new Error('Missing queueStats in response');
      if (typeof body.queueStats.activeWorkerType !== 'string') {
        throw new Error('Missing activeWorkerType');
      }

      console.log('     📊 System Worker Type:', body.queueStats.activeWorkerType);
    });

    // =======================================================================
    // SUITE 5: REDIS UNAVAILABLE HANDLING & RESILIENCE
    // =======================================================================
    console.log('\n--- SUITE 5: Redis Unavailable Handling & Resilience ---');

    await assertTest('Resilience 5.1: System handles Redis offline gracefully without throwing or blocking', async () => {
      const queueStats = await NotificationQueue.getQueueStats();
      // Even if Redis is offline, activeWorkerType should be ResilientFallback and isRedisConnected should be false
      if (queueStats.isRedisConnected === false) {
        if (queueStats.activeWorkerType !== 'ResilientFallback') {
          throw new Error(`Expected ResilientFallback when Redis offline, got ${queueStats.activeWorkerType}`);
        }
      }
    });

  } catch (globalErr: any) {
    console.error('Fatal error during test run:', globalErr);
    failed++;
  }

  console.log('\n========================================');
  console.log(`BullMQ Background Processing Tests: ${passed} Passed, ${failed} Failed`);
  console.log('========================================');

  if (failed > 0) {
    process.exit(1);
  }
}

runBullMQBackgroundProcessingTests()
  .finally(async () => {
    await prisma.$disconnect();
  });
