import request from 'supertest';
import { createApp } from '../server';
import { prisma } from '../db';
import { NoticeStatus, NoticeTargetType, NoticeType } from '@prisma/client';

async function runNoticeManagementTests() {
  console.log('🧪 Starting College News & Notice Management Test Suite...\n');
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
    const eceDept = await prisma.department.findUnique({ where: { code: 'ECE' } });
    const yr3 = await prisma.year.findFirst({ where: { yearNumber: 3 } });
    const currentYear = await prisma.academicYear.findFirst({ where: { isCurrent: true } });
    const secCSE3A = await prisma.section.findFirst({
      where: { name: 'A', departmentId: cseDept!.id, yearId: yr3!.id }
    });

    const totalActiveStudents = await prisma.student.count({ where: { status: 'ACTIVE' } });
    const cseStudentsCount = await prisma.student.count({ where: { departmentId: cseDept!.id, status: 'ACTIVE' } });
    const secCSE3ACount = await prisma.student.count({ where: { sectionId: secCSE3A!.id, status: 'ACTIVE' } });

    // Track test notices to cleanup later
    const createdNoticeIds: string[] = [];

    // =======================================================================
    // SUITE 1: STRICT ROLE-BASED ACCESS CONTROL (STAFF BLOCKED 403)
    // =======================================================================
    console.log('--- SUITE 1: Strict RBAC Protection (Staff 403, Missing Auth 401) ---');

    await assertTest('RBAC 1.1: Unauthenticated request to /api/admin/notices returns 401 Unauthorized', async () => {
      const res = await request(app).get('/api/admin/notices');
      if (res.status !== 401) throw new Error(`Expected 401, got ${res.status}`);
    });

    await assertTest('RBAC 1.2: Staff user accessing GET /api/admin/notices returns 403 Forbidden', async () => {
      const res = await request(app)
        .get('/api/admin/notices')
        .set('Authorization', `Bearer ${staffToken}`);
      if (res.status !== 403) throw new Error(`Expected 403, got ${res.status}`);
    });

    await assertTest('RBAC 1.3: Staff user attempting POST /api/admin/notices returns 403 Forbidden', async () => {
      const res = await request(app)
        .post('/api/admin/notices')
        .set('Authorization', `Bearer ${staffToken}`)
        .send({
          title: 'Unauthorized Notice',
          content: 'Staff attempt',
          noticeType: NoticeType.GENERAL,
          targetType: NoticeTargetType.ALL_COLLEGE
        });
      if (res.status !== 403) throw new Error(`Expected 403, got ${res.status}`);
    });

    await assertTest('RBAC 1.4: Staff user attempting publish returns 403 Forbidden', async () => {
      const res = await request(app)
        .post('/api/admin/notices/some-id/publish')
        .set('Authorization', `Bearer ${staffToken}`);
      if (res.status !== 403) throw new Error(`Expected 403, got ${res.status}`);
    });

    await assertTest('RBAC 1.5: Staff user attempting cancel returns 403 Forbidden', async () => {
      const res = await request(app)
        .post('/api/admin/notices/some-id/cancel')
        .set('Authorization', `Bearer ${staffToken}`);
      if (res.status !== 403) throw new Error(`Expected 403, got ${res.status}`);
    });

    await assertTest('RBAC 1.6: Staff user attempting delete returns 403 Forbidden', async () => {
      const res = await request(app)
        .delete('/api/admin/notices/some-id')
        .set('Authorization', `Bearer ${staffToken}`);
      if (res.status !== 403) throw new Error(`Expected 403, got ${res.status}`);
    });

    await assertTest('RBAC 1.7: Admin user accessing GET /api/admin/notices is ALLOWED (200 OK)', async () => {
      const res = await request(app)
        .get('/api/admin/notices')
        .set('Authorization', `Bearer ${adminToken}`);
      if (res.status !== 200) throw new Error(`Expected 200, got ${res.status}`);
      if (!Array.isArray(res.body.notices)) throw new Error('Missing notices array');
    });

    // =======================================================================
    // SUITE 2: NOTICE CREATION AS DRAFT (NO NOTIFICATIONS DISPATCHED)
    // =======================================================================
    console.log('\n--- SUITE 2: Draft Notice Workflow (No Premature Notifications) ---');

    let draftNoticeId = '';
    await assertTest('Draft 2.1: Admin creates notice as DRAFT -> Returns 201 with status DRAFT', async () => {
      const initialNotifCount = await prisma.notification.count();

      const res = await request(app)
        .post('/api/admin/notices')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          title: 'Draft Holiday Announcement',
          content: 'College will remain closed on 10 September due to a declared holiday.',
          noticeType: NoticeType.HOLIDAY,
          targetType: NoticeTargetType.ALL_COLLEGE,
          startDate: '2026-09-10',
          deliveryChannel: 'BOTH',
          status: NoticeStatus.DRAFT
        });

      if (res.status !== 201) throw new Error(`Expected 201, got ${res.status}: ${JSON.stringify(res.body)}`);
      if (res.body.notice.status !== 'DRAFT') throw new Error(`Expected status DRAFT, got ${res.body.notice.status}`);
      draftNoticeId = res.body.notice.id;
      createdNoticeIds.push(draftNoticeId);

      // Verify NO notifications were created for draft notice
      const afterNotifCount = await prisma.notification.count();
      if (afterNotifCount !== initialNotifCount) {
        throw new Error(`Draft notice should NOT generate notifications! Before: ${initialNotifCount}, After: ${afterNotifCount}`);
      }
    });

    // =======================================================================
    // SUITE 3: RECIPIENT COUNT & MESSAGE PREVIEW
    // =======================================================================
    console.log('\n--- SUITE 3: Recipient Audience Resolution & Message Preview ---');

    await assertTest('Preview 3.1: Preview ALL_COLLEGE target resolves all active students', async () => {
      const res = await request(app)
        .get(`/api/admin/notices/recipients-preview?noticeType=HOLIDAY&targetType=ALL_COLLEGE&title=Holiday&content=Testing+holiday`)
        .set('Authorization', `Bearer ${adminToken}`);

      if (res.status !== 200) throw new Error(`Status ${res.status}`);
      if (res.body.totalStudents !== totalActiveStudents) {
        throw new Error(`Expected ${totalActiveStudents} students, got ${res.body.totalStudents}`);
      }
      if (!res.body.formattedMessage.includes('College Notice:')) {
        throw new Error('Missing holiday notice header in formatted message');
      }
      if (!Array.isArray(res.body.sampleRecipients)) throw new Error('Missing sampleRecipients');
      if (res.body.sampleRecipients.length > 0) {
        const sample = res.body.sampleRecipients[0];
        if (!sample.maskedMobile.includes('****')) {
          throw new Error(`Phone number was not properly masked: ${sample.maskedMobile}`);
        }
      }
    });

    await assertTest('Preview 3.2: Preview DEPARTMENT target (CSE) resolves only CSE students', async () => {
      const res = await request(app)
        .get(`/api/admin/notices/recipients-preview?noticeType=INTERNAL_EXAM&targetType=DEPARTMENT&departmentId=${cseDept!.id}&title=IA2&content=Exam+starts`)
        .set('Authorization', `Bearer ${adminToken}`);

      if (res.status !== 200) throw new Error(`Status ${res.status}`);
      if (res.body.totalStudents !== cseStudentsCount) {
        throw new Error(`Expected ${cseStudentsCount} CSE students, got ${res.body.totalStudents}`);
      }
      if (!res.body.formattedMessage.includes('Important College Notice:')) {
        throw new Error('Missing IA notice header in formatted message');
      }
    });

    await assertTest('Preview 3.3: Preview SECTION target (CSE 3A) resolves section students', async () => {
      const res = await request(app)
        .get(`/api/admin/notices/recipients-preview?noticeType=GENERAL&targetType=SECTION&sectionId=${secCSE3A!.id}&title=Gen&content=Info`)
        .set('Authorization', `Bearer ${adminToken}`);

      if (res.status !== 200) throw new Error(`Status ${res.status}`);
      if (res.body.totalStudents !== secCSE3ACount) {
        throw new Error(`Expected ${secCSE3ACount} section students, got ${res.body.totalStudents}`);
      }
    });

    // =======================================================================
    // SUITE 4: EXPLICIT PUBLISHING & NOTIFICATION DISPATCH
    // =======================================================================
    console.log('\n--- SUITE 4: Explicit Publishing & Notification Queue Dispatch ---');

    await assertTest('Publish 4.1: Admin publishes draft notice -> Dispatches SMS and WhatsApp to parents', async () => {
      const beforeNotifCount = await prisma.notification.count();

      const res = await request(app)
        .post(`/api/admin/notices/${draftNoticeId}/publish`)
        .set('Authorization', `Bearer ${adminToken}`);

      if (res.status !== 200) throw new Error(`Expected 200, got ${res.status}: ${JSON.stringify(res.body)}`);
      if (res.body.notice.status !== 'PUBLISHED') throw new Error(`Expected status PUBLISHED, got ${res.body.notice.status}`);
      if (!res.body.notice.publishedAt) throw new Error('Missing publishedAt timestamp');

      // Verify notifications generated in DB
      const notifsForNotice = await prisma.notification.findMany({
        where: { noticeId: draftNoticeId }
      });

      // Target was ALL_COLLEGE with deliveryChannel: BOTH -> Expect 2 notifications (SMS + WA) per student
      const expectedNotifs = totalActiveStudents * 2;
      if (notifsForNotice.length !== expectedNotifs) {
        throw new Error(`Expected ${expectedNotifs} notifications (SMS+WA), got ${notifsForNotice.length}`);
      }

      const smsNotifs = notifsForNotice.filter(n => n.type === 'SMS');
      const waNotifs = notifsForNotice.filter(n => n.type === 'WHATSAPP');
      if (smsNotifs.length !== totalActiveStudents) throw new Error(`Expected ${totalActiveStudents} SMS, got ${smsNotifs.length}`);
      if (waNotifs.length !== totalActiveStudents) throw new Error(`Expected ${totalActiveStudents} WhatsApp, got ${waNotifs.length}`);

      console.log(`     Dispatched: ${smsNotifs.length} SMS + ${waNotifs.length} WhatsApp notifications for ${totalActiveStudents} students.`);
    });

    await assertTest('Publish 4.2: Channel specificity - Notice with deliveryChannel="SMS" generates only SMS', async () => {
      const resCreate = await request(app)
        .post('/api/admin/notices')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          title: 'SMS Only Notice',
          content: 'Important academic instruction.',
          noticeType: NoticeType.ACADEMIC,
          targetType: NoticeTargetType.SECTION,
          sectionId: secCSE3A!.id,
          deliveryChannel: 'SMS',
          status: NoticeStatus.PUBLISHED
        });

      if (resCreate.status !== 201) throw new Error(`Expected 201, got ${resCreate.status}`);
      createdNoticeIds.push(resCreate.body.notice.id);

      const notifs = await prisma.notification.findMany({
        where: { noticeId: resCreate.body.notice.id }
      });

      if (notifs.length !== secCSE3ACount) throw new Error(`Expected ${secCSE3ACount} SMS notifications, got ${notifs.length}`);
      const nonSms = notifs.filter(n => n.type !== 'SMS');
      if (nonSms.length > 0) throw new Error('Expected 0 non-SMS notifications');
    });

    // =======================================================================
    // SUITE 5: SCHEDULED NOTICES & CANCELLATION
    // =======================================================================
    console.log('\n--- SUITE 5: Notice Scheduling & Cancellation ---');

    let scheduledNoticeId = '';
    await assertTest('Schedule 5.1: Admin creates SCHEDULED notice with future time -> No notifications sent yet', async () => {
      const futureDate = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();

      const res = await request(app)
        .post('/api/admin/notices')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          title: 'Scheduled Reopening Notice',
          content: 'College will reopen on 5 October 2026.',
          noticeType: NoticeType.COLLEGE_REOPENING,
          targetType: NoticeTargetType.ALL_COLLEGE,
          startDate: '2026-10-05',
          scheduledAt: futureDate,
          deliveryChannel: 'BOTH',
          status: NoticeStatus.SCHEDULED
        });

      if (res.status !== 201) throw new Error(`Status ${res.status}`);
      if (res.body.notice.status !== 'SCHEDULED') throw new Error(`Expected SCHEDULED, got ${res.body.notice.status}`);
      scheduledNoticeId = res.body.notice.id;
      createdNoticeIds.push(scheduledNoticeId);

      // Verify no notifications were generated yet
      const notifs = await prisma.notification.count({ where: { noticeId: scheduledNoticeId } });
      if (notifs !== 0) throw new Error('Scheduled notice should not generate notifications before publication');
    });

    await assertTest('Schedule 5.2: Admin cancels scheduled notice -> Status transitions to CANCELLED', async () => {
      const res = await request(app)
        .post(`/api/admin/notices/${scheduledNoticeId}/cancel`)
        .set('Authorization', `Bearer ${adminToken}`);

      if (res.status !== 200) throw new Error(`Expected 200, got ${res.status}: ${JSON.stringify(res.body)}`);
      if (res.body.notice.status !== 'CANCELLED') throw new Error(`Expected CANCELLED, got ${res.body.notice.status}`);

      // Confirm no notifications generated
      const notifs = await prisma.notification.count({ where: { noticeId: scheduledNoticeId } });
      if (notifs !== 0) throw new Error('Cancelled notice should have 0 notifications');
    });

    // =======================================================================
    // SUITE 6: NOTICE CRUD, EDITING & SEARCH FILTERS
    // =======================================================================
    console.log('\n--- SUITE 6: CRUD, Multi-Filter Search & Editing ---');

    await assertTest('Filter 6.1: Filter notices by status=PUBLISHED', async () => {
      const res = await request(app)
        .get('/api/admin/notices?status=PUBLISHED')
        .set('Authorization', `Bearer ${adminToken}`);

      if (res.status !== 200) throw new Error(`Status ${res.status}`);
      for (const n of res.body.notices) {
        if (n.status !== 'PUBLISHED') throw new Error(`Expected status PUBLISHED, got ${n.status}`);
      }
    });

    await assertTest('Filter 6.2: Filter notices by noticeType=HOLIDAY', async () => {
      const res = await request(app)
        .get('/api/admin/notices?noticeType=HOLIDAY')
        .set('Authorization', `Bearer ${adminToken}`);

      if (res.status !== 200) throw new Error(`Status ${res.status}`);
      for (const n of res.body.notices) {
        if (n.noticeType !== 'HOLIDAY') throw new Error(`Expected noticeType HOLIDAY, got ${n.noticeType}`);
      }
    });

    await assertTest('Edit 6.3: Update draft notice title and content', async () => {
      const resCreate = await request(app)
        .post('/api/admin/notices')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          title: 'Initial Title',
          content: 'Initial Content',
          noticeType: NoticeType.GENERAL,
          targetType: NoticeTargetType.ALL_COLLEGE,
          status: NoticeStatus.DRAFT
        });

      const id = resCreate.body.notice.id;
      createdNoticeIds.push(id);

      const resUpdate = await request(app)
        .put(`/api/admin/notices/${id}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          title: 'Updated Notice Title',
          content: 'Updated Notice Content'
        });

      if (resUpdate.status !== 200) throw new Error(`Status ${resUpdate.status}`);
      if (resUpdate.body.title !== 'Updated Notice Title') throw new Error('Title not updated');
      if (resUpdate.body.content !== 'Updated Notice Content') throw new Error('Content not updated');
    });

    await assertTest('Delete 6.4: Delete a draft notice', async () => {
      const resCreate = await request(app)
        .post('/api/admin/notices')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          title: 'To Be Deleted',
          content: 'Delete me',
          noticeType: NoticeType.GENERAL,
          targetType: NoticeTargetType.ALL_COLLEGE,
          status: NoticeStatus.DRAFT
        });

      const id = resCreate.body.notice.id;

      const resDel = await request(app)
        .delete(`/api/admin/notices/${id}`)
        .set('Authorization', `Bearer ${adminToken}`);

      if (resDel.status !== 200) throw new Error(`Status ${resDel.status}`);

      const check = await prisma.collegeNotice.findUnique({ where: { id } });
      if (check !== null) throw new Error('Notice still exists after delete');
    });

  } catch (error: any) {
    console.error('Test suite error:', error);
    failed++;
  } finally {
    await prisma.$disconnect();
    console.log(`\n========================================`);
    console.log(`Notice Tests: ${passed} Passed, ${failed} Failed`);
    console.log(`========================================\n`);

    if (failed > 0) {
      process.exit(1);
    }
  }
}

runNoticeManagementTests();
