import request from 'supertest';
import { createApp } from '../server';
import { prisma } from '../db';
import { NotificationTemplateService } from '../services/notificationTemplate.service';
import { NoticeType, NotificationCategory } from '@prisma/client';

async function runNotificationTemplateTests() {
  console.log('🧪 Starting Reusable Parent Notification Template Test Suite...\n');
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

    // =======================================================================
    // SUITE 1: PERFORMANCE TEMPLATE UNIT TESTS
    // =======================================================================
    console.log('--- SUITE 1: Performance Template Generation ---');

    await assertTest('Perf 1.1: Standard Improved Student Message Generation', () => {
      const msg = NotificationTemplateService.generatePerformanceMessage({
        studentName: 'Arun Kumar',
        registerNumber: '23CSE101',
        ia1Percentage: 72,
        ia2Percentage: 84,
        improvement: 12,
        progressionStatus: 'IMPROVED',
        improvedSubjects: ['Java', 'DBMS'],
        attentionSubjects: ['Computer Networks']
      });

      if (!msg.includes('Dear Parent,')) throw new Error('Missing greeting');
      if (!msg.includes('Student: Arun Kumar')) throw new Error('Missing student name');
      if (!msg.includes('Register No: 23CSE101')) throw new Error('Missing register number');
      if (!msg.includes('IA-1: 72%')) throw new Error('Missing IA-1 percentage');
      if (!msg.includes('IA-2: 84%')) throw new Error('Missing IA-2 percentage');
      if (!msg.includes('Improvement: +12 percentage points')) throw new Error('Missing improvement');
      if (!msg.includes('Improved Subjects:\nJava, DBMS')) throw new Error('Missing improved subjects');
      if (!msg.includes('Subjects Needing Attention:\nComputer Networks')) throw new Error('Missing attention subjects');
      if (!msg.includes('Please encourage your ward to continue improving.')) throw new Error('Missing encouragement');
    });

    await assertTest('Perf 1.2: Declined Student Message Generation', () => {
      const msg = NotificationTemplateService.generatePerformanceMessage({
        studentName: 'Priya Sharma',
        registerNumber: '23ECE042',
        ia1Percentage: 78,
        ia2Percentage: 65,
        improvement: -13,
        progressionStatus: 'DECLINED',
        improvedSubjects: [],
        attentionSubjects: ['Digital Electronics', 'Signals & Systems']
      });

      if (!msg.includes('Improvement: -13 percentage points')) throw new Error('Missing decline delta');
      if (!msg.includes('Improved Subjects:\nNone')) throw new Error('Expected None for empty improved subjects');
      if (!msg.includes('Digital Electronics, Signals & Systems')) throw new Error('Missing attention subjects');
      if (!msg.includes('Please support and encourage your ward to focus on academic studies.')) {
        throw new Error('Missing decline encouragement note');
      }
    });

    await assertTest('Perf 1.3: Missing Assessment Marks Handled Gracefully', () => {
      const msg = NotificationTemplateService.generatePerformanceMessage({
        studentName: 'Ravi Teja',
        registerNumber: '23MECH010',
        ia1Percentage: null,
        ia2Percentage: 68,
        improvement: null,
        progressionStatus: 'MISSING_DATA',
        improvedSubjects: [],
        attentionSubjects: []
      });

      if (!msg.includes('IA-1: Not Evaluated')) throw new Error('Missing fallback for null IA-1');
      if (!msg.includes('IA-2: 68%')) throw new Error('Missing IA-2 percentage');
      if (!msg.includes('Improvement: Incomplete Assessment Data')) throw new Error('Missing incomplete data note');
    });

    await assertTest('Perf 1.4: All Subjects Passed / No Attention Needed', () => {
      const msg = NotificationTemplateService.generatePerformanceMessage({
        studentName: 'Sneha Roy',
        registerNumber: '23CSE099',
        ia1Percentage: 92,
        ia2Percentage: 95,
        improvement: 3,
        progressionStatus: 'IMPROVED',
        improvedSubjects: ['Operating Systems', 'Algorithms'],
        attentionSubjects: [],
        overallLevel: 'Excellent'
      });

      if (!msg.includes('Subjects Needing Attention:\nNone (All subjects meeting standard)')) {
        throw new Error('Missing standard passing text for attention subjects');
      }
      if (!msg.includes('commendable academic performance')) {
        throw new Error('Missing distinction congratulatory text');
      }
    });

    // =======================================================================
    // SUITE 2: COLLEGE NOTICE TEMPLATE UNIT TESTS
    // =======================================================================
    console.log('\n--- SUITE 2: College Notice Template Categories ---');

    await assertTest('Notice 2.1: HOLIDAY Notice Template', () => {
      const msg = NotificationTemplateService.generateCollegeNoticeMessage({
        noticeType: NoticeType.HOLIDAY,
        title: 'Declared Holiday',
        content: 'The college will remain closed on 10 September 2026 due to a declared holiday.',
        startDate: '2026-09-10'
      });

      if (!msg.includes('College Notice:')) throw new Error('Missing header');
      if (!msg.includes('closed on 10 September 2026')) throw new Error('Missing holiday text');
      if (!msg.includes('Regards,\nCollege Administration')) throw new Error('Missing signoff');
    });

    await assertTest('Notice 2.2: INTERNAL_EXAM Notice Template', () => {
      const msg = NotificationTemplateService.generateCollegeNoticeMessage({
        noticeType: NoticeType.INTERNAL_EXAM,
        title: 'Internal Assessment-2 Announcement',
        content: 'Internal Assessment-2 examinations will begin from 15 September 2026.',
        startDate: '2026-09-15'
      });

      if (!msg.includes('Important College Notice:')) throw new Error('Missing header');
      if (!msg.includes('Internal Assessment-2 examinations will begin')) throw new Error('Missing exam text');
      if (!msg.includes('Please ensure that your ward is prepared')) throw new Error('Missing preparation instruction');
    });

    await assertTest('Notice 2.3: SEMESTER_EXAM Notice Template', () => {
      const msg = NotificationTemplateService.generateCollegeNoticeMessage({
        noticeType: NoticeType.SEMESTER_EXAM,
        title: 'Semester Examinations Notice',
        content: 'Semester examinations will begin from 20 November 2026.',
        startDate: '2026-11-20'
      });

      if (!msg.includes('Semester Examination Notice:')) throw new Error('Missing semester header');
      if (!msg.includes('Semester examinations will begin')) throw new Error('Missing semester start text');
      if (!msg.includes('Please refer to the official examination schedule for details.')) {
        throw new Error('Missing schedule reference instruction');
      }
    });

    await assertTest('Notice 2.4: COLLEGE_REOPENING Notice Template', () => {
      const msg = NotificationTemplateService.generateCollegeNoticeMessage({
        noticeType: NoticeType.COLLEGE_REOPENING,
        title: 'Reopening Announcement',
        content: 'The college will reopen on 5 October 2026.',
        startDate: '2026-10-05'
      });

      if (!msg.includes('College Notice:')) throw new Error('Missing reopening header');
      if (!msg.includes('reopen on 5 October 2026')) throw new Error('Missing reopening text');
    });

    await assertTest('Notice 2.5: EXAM_TIMETABLE & URGENT Notices', () => {
      const timetableMsg = NotificationTemplateService.generateCollegeNoticeMessage({
        noticeType: NoticeType.EXAM_TIMETABLE,
        title: 'Model Exam Timetable',
        content: 'Model exam schedule is now published on student portal.'
      });
      if (!msgContains(timetableMsg, 'Examination Timetable Notice:')) throw new Error('Missing timetable header');

      const urgentMsg = NotificationTemplateService.generateCollegeNoticeMessage({
        noticeType: NoticeType.URGENT,
        title: 'Advisory Alert',
        content: 'College will dismiss classes early due to rain.'
      });
      if (!msgContains(urgentMsg, 'URGENT COLLEGE NOTICE:')) throw new Error('Missing urgent header');
    });

    // =======================================================================
    // SUITE 3: PREVIEW API ENDPOINTS & RBAC PROTECTION
    // =======================================================================
    console.log('\n--- SUITE 3: Preview APIs & Strict Security ---');

    await assertTest('API 3.1: Staff blocked from preview-template endpoint (403 Forbidden)', async () => {
      const res = await request(app)
        .post('/api/admin/notifications/preview-template')
        .set('Authorization', `Bearer ${staffToken}`)
        .send({ category: 'PERFORMANCE', data: {} });
      if (res.status !== 403) throw new Error(`Expected 403, got ${res.status}`);
    });

    await assertTest('API 3.2: Admin calls POST /api/admin/notifications/preview-template -> 200 OK', async () => {
      const res = await request(app)
        .post('/api/admin/notifications/preview-template')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          category: 'PERFORMANCE',
          data: {
            studentName: 'Karthik Raja',
            registerNumber: '23CSE055',
            ia1Percentage: 70,
            ia2Percentage: 82,
            improvement: 12,
            progressionStatus: 'IMPROVED',
            improvedSubjects: ['Data Structures'],
            attentionSubjects: ['Algorithms']
          }
        });

      if (res.status !== 200) throw new Error(`Expected 200, got ${res.status}: ${JSON.stringify(res.body)}`);
      if (!res.body.message.includes('Student: Karthik Raja')) throw new Error('Missing formatted message content');
      if (typeof res.body.characterCount !== 'number') throw new Error('Missing characterCount');
      if (typeof res.body.estimatedSmsSegments !== 'number') throw new Error('Missing estimatedSmsSegments');
    });

    if (sampleStudent) {
      await assertTest('API 3.3: Preview student performance message from DB (/preview-student-performance/:id)', async () => {
        const res = await request(app)
          .get(`/api/admin/notifications/preview-student-performance/${sampleStudent.id}`)
          .set('Authorization', `Bearer ${adminToken}`);

        if (res.status !== 200) throw new Error(`Expected 200, got ${res.status}: ${JSON.stringify(res.body)}`);
        if (!res.body.message.includes(sampleStudent.name)) throw new Error('Missing student name in generated message');
        if (res.body.registerNumber !== sampleStudent.registerNumber) throw new Error('Mismatched register number');
        console.log(`     Sample Parent Preview (${sampleStudent.name}):\n${res.body.message.split('\n').slice(0, 7).join('\n')}\n...`);
      });
    }

    await assertTest('API 3.4: Admin retrieves sample template dictionary (/templates/samples)', async () => {
      const res = await request(app)
        .get('/api/admin/notifications/templates/samples')
        .set('Authorization', `Bearer ${adminToken}`);

      if (res.status !== 200) throw new Error(`Status ${res.status}`);
      if (!res.body.samples) throw new Error('Missing samples object');
      if (!res.body.samples.PERFORMANCE_IMPROVED) throw new Error('Missing PERFORMANCE_IMPROVED sample');
      if (!res.body.samples.HOLIDAY) throw new Error('Missing HOLIDAY sample');
      if (!res.body.samples.INTERNAL_EXAM) throw new Error('Missing INTERNAL_EXAM sample');
      if (!res.body.samples.SEMESTER_EXAM) throw new Error('Missing SEMESTER_EXAM sample');
    });

  } catch (error: any) {
    console.error('Test suite error:', error);
    failed++;
  } finally {
    await prisma.$disconnect();
    console.log(`\n========================================`);
    console.log(`Template Tests: ${passed} Passed, ${failed} Failed`);
    console.log(`========================================\n`);

    if (failed > 0) {
      process.exit(1);
    }
  }
}

function msgContains(target: string, needle: string): boolean {
  return target.toLowerCase().includes(needle.toLowerCase());
}

runNotificationTemplateTests();
