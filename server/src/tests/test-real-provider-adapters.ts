import request from 'supertest';
import { createApp } from '../server';
import { prisma } from '../db';
import {
  MetaWhatsAppCloudAdapter,
  NotificationProviderFactory,
  RestSMSAdapter,
  SMSProvider,
  WhatsAppProvider,
  WhatsAppProviderError,
  SMSProviderError,
  ISMSAdapter
} from '../providers';
import { NotificationCategory, NotificationStatus, NotificationType } from '@prisma/client';
import { NotificationQueue } from '../queue';

async function runRealProviderAdapterTests() {
  console.log('🧪 Starting Real SMS & Official Meta WhatsApp Cloud API Provider Adapter Test Suite...\n');
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
      where: { status: 'ACTIVE' }
    });
    if (!sampleStudent) throw new Error('No active student found for testing');

    // =======================================================================
    // SUITE 1: AUTOMATIC MOCK FALLBACK & CREDENTIAL SAFETY
    // =======================================================================
    console.log('--- SUITE 1: Automatic Mock Fallback & Credential Safety ---');

    await assertTest('Fallback 1.1: SMSProvider automatically remains in MOCK mode when credentials missing', async () => {
      const smsProvider = new SMSProvider();
      const res = await smsProvider.send({
        recipientMobile: '+91 9876543210',
        message: 'Test message fallback',
        type: NotificationType.SMS,
        category: NotificationCategory.PERFORMANCE
      });

      if (!res.success) throw new Error('Expected successful mock dispatch');
      if (!res.providerId.startsWith('mock-sms-')) {
        throw new Error(`Expected mock-sms- ID, got ${res.providerId}`);
      }
      if (res.status !== NotificationStatus.DELIVERED) {
        throw new Error(`Expected DELIVERED, got ${res.status}`);
      }
    });

    await assertTest('Fallback 1.2: WhatsAppProvider automatically remains in MOCK mode when credentials missing', async () => {
      const waProvider = new WhatsAppProvider();
      const res = await waProvider.send({
        recipientMobile: '+91 9876543210',
        message: 'Test WhatsApp fallback',
        type: NotificationType.WHATSAPP,
        category: NotificationCategory.COLLEGE_NOTICE
      });

      if (!res.success) throw new Error('Expected successful mock dispatch');
      if (!res.providerId.startsWith('mock-wa-')) {
        throw new Error(`Expected mock-wa- ID, got ${res.providerId}`);
      }
      if (res.status !== NotificationStatus.DELIVERED) {
        throw new Error(`Expected DELIVERED, got ${res.status}`);
      }
    });

    await assertTest('Security 1.3: Admin notification preview APIs do NOT expose credentials', async () => {
      const res = await request(app)
        .get(`/api/admin/notifications/preview-student-performance/${sampleStudent.id}`)
        .set('Authorization', `Bearer ${adminToken}`);

      if (res.status !== 200) throw new Error(`HTTP ${res.status}`);
      const bodyStr = JSON.stringify(res.body);
      if (bodyStr.includes('API_KEY') || bodyStr.includes('ACCESS_TOKEN') || bodyStr.includes('secret')) {
        throw new Error('Credential leaked in preview response!');
      }
    });

    // =======================================================================
    // SUITE 2: PHONE NUMBER NORMALIZATION & VALIDATION
    // =======================================================================
    console.log('\n--- SUITE 2: Phone Number Normalization & Validation ---');

    await assertTest('Phone 2.1: Meta WhatsApp adapter normalizes Indian 10-digit number to E.164 without "+"', () => {
      const normalized = MetaWhatsAppCloudAdapter.normalizePhoneNumber('9876543210');
      if (normalized !== '919876543210') throw new Error(`Expected 919876543210, got ${normalized}`);

      const formatted = MetaWhatsAppCloudAdapter.normalizePhoneNumber('+91 98765-43210');
      if (formatted !== '919876543210') throw new Error(`Expected 919876543210, got ${formatted}`);
    });

    await assertTest('Phone 2.2: Meta WhatsApp adapter rejects invalid phone numbers with INVALID_PHONE_NUMBER', () => {
      let threw = false;
      try {
        MetaWhatsAppCloudAdapter.normalizePhoneNumber('12345'); // too short
      } catch (err: any) {
        threw = true;
        if (err.code !== 'INVALID_PHONE_NUMBER') throw new Error(`Expected INVALID_PHONE_NUMBER, got ${err.code}`);
      }
      if (!threw) throw new Error('Expected error for short phone number');

      threw = false;
      try {
        MetaWhatsAppCloudAdapter.normalizePhoneNumber(''); // empty
      } catch (err: any) {
        threw = true;
        if (err.code !== 'INVALID_PHONE_NUMBER') throw new Error(`Expected INVALID_PHONE_NUMBER, got ${err.code}`);
      }
      if (!threw) throw new Error('Expected error for empty phone number');
    });

    await assertTest('Phone 2.3: RestSMS adapter normalizes phone numbers and rejects invalid formats', () => {
      const clean = RestSMSAdapter.normalizePhoneNumber('+91 98765 43210');
      if (clean !== '919876543210') throw new Error(`Expected 919876543210, got ${clean}`);

      let threw = false;
      try {
        RestSMSAdapter.normalizePhoneNumber('abc');
      } catch (err: any) {
        threw = true;
        if (err.code !== 'INVALID_PHONE_NUMBER') throw new Error(`Expected INVALID_PHONE_NUMBER, got ${err.code}`);
      }
      if (!threw) throw new Error('Expected error for non-digit phone');
    });

    // =======================================================================
    // SUITE 3: META WHATSAPP CLOUD API ADAPTER ERROR MAPPINGS
    // =======================================================================
    console.log('\n--- SUITE 3: Official Meta WhatsApp Business API Error Handling ---');

    await assertTest('Meta 3.1: Missing access token triggers AUTHENTICATION_ERROR', async () => {
      const adapter = new MetaWhatsAppCloudAdapter();
      // Temporarily ensure token is empty
      const origToken = process.env.WHATSAPP_ACCESS_TOKEN;
      delete process.env.WHATSAPP_ACCESS_TOKEN;

      let threw = false;
      try {
        await adapter.sendTemplate({
          to: '919876543210',
          templateName: 'hello_world'
        });
      } catch (err: any) {
        threw = true;
        if (err.code !== 'AUTHENTICATION_ERROR') {
          throw new Error(`Expected AUTHENTICATION_ERROR, got ${err.code}`);
        }
      } finally {
        if (origToken) process.env.WHATSAPP_ACCESS_TOKEN = origToken;
      }
      if (!threw) throw new Error('Expected error when token missing');
    });

    await assertTest('Meta 3.2: Handles simulated Meta Rate Limit (429 / 130429) -> RATE_LIMIT', () => {
      const adapter = new MetaWhatsAppCloudAdapter();
      let threw = false;
      try {
        (adapter as any).handleMetaApiError(429, {
          error: {
            message: 'Too many requests',
            code: 130429,
            type: 'OAuthException'
          }
        });
      } catch (err: any) {
        threw = true;
        if (err.code !== 'RATE_LIMIT') throw new Error(`Expected RATE_LIMIT, got ${err.code}`);
      }
      if (!threw) throw new Error('Expected error for 429');
    });

    await assertTest('Meta 3.3: Handles Meta Template Error (132000 template does not exist) -> WHATSAPP_TEMPLATE_ERROR', () => {
      const adapter = new MetaWhatsAppCloudAdapter();
      let threw = false;
      try {
        (adapter as any).handleMetaApiError(400, {
          error: {
            message: 'Template does not exist in requested language',
            code: 132000,
            type: 'OAuthException'
          }
        });
      } catch (err: any) {
        threw = true;
        if (err.code !== 'WHATSAPP_TEMPLATE_ERROR') {
          throw new Error(`Expected WHATSAPP_TEMPLATE_ERROR, got ${err.code}`);
        }
      }
      if (!threw) throw new Error('Expected error for template missing');
    });

    await assertTest('Meta 3.4: Handles Meta Template Parameter Mismatch (132001) -> WHATSAPP_TEMPLATE_ERROR', () => {
      const adapter = new MetaWhatsAppCloudAdapter();
      let threw = false;
      try {
        (adapter as any).handleMetaApiError(400, {
          error: {
            message: 'Parameter count mismatch for body component',
            code: 132001,
            type: 'OAuthException'
          }
        });
      } catch (err: any) {
        threw = true;
        if (err.code !== 'WHATSAPP_TEMPLATE_ERROR') {
          throw new Error(`Expected WHATSAPP_TEMPLATE_ERROR, got ${err.code}`);
        }
      }
      if (!threw) throw new Error('Expected error for parameter mismatch');
    });

    await assertTest('Meta 3.5: Handles Invalid Recipient from Meta (131030) -> INVALID_PHONE_NUMBER', () => {
      const adapter = new MetaWhatsAppCloudAdapter();
      let threw = false;
      try {
        (adapter as any).handleMetaApiError(400, {
          error: {
            message: 'Recipient phone number not valid on WhatsApp',
            code: 131030,
            type: 'OAuthException'
          }
        });
      } catch (err: any) {
        threw = true;
        if (err.code !== 'INVALID_PHONE_NUMBER') {
          throw new Error(`Expected INVALID_PHONE_NUMBER, got ${err.code}`);
        }
      }
      if (!threw) throw new Error('Expected error for invalid recipient');
    });

    // =======================================================================
    // SUITE 4: PLUGGABLE SMS ADAPTER ARCHITECTURE
    // =======================================================================
    console.log('\n--- SUITE 4: Pluggable SMS Adapter Architecture ---');

    await assertTest('SMS 4.1: RestSMSAdapter error handling maps 401 to AUTHENTICATION_ERROR and 429 to RATE_LIMIT', () => {
      const adapter = new RestSMSAdapter();

      let threw = false;
      try {
        (adapter as any).handleHttpError(401, { message: 'Invalid API Key' });
      } catch (err: any) {
        threw = true;
        if (err.code !== 'AUTHENTICATION_ERROR') throw new Error(`Expected AUTHENTICATION_ERROR, got ${err.code}`);
      }
      if (!threw) throw new Error('Expected 401 error');

      threw = false;
      try {
        (adapter as any).handleHttpError(429, { message: 'Rate limit exceeded' });
      } catch (err: any) {
        threw = true;
        if (err.code !== 'RATE_LIMIT') throw new Error(`Expected RATE_LIMIT, got ${err.code}`);
      }
      if (!threw) throw new Error('Expected 429 error');
    });

    await assertTest('SMS 4.2: SMSProvider allows hot-swapping SMS adapter without touching core system', async () => {
      const smsProvider = new SMSProvider();

      // Define a custom mock adapter representing e.g. Twilio / AWS SNS
      const customAdapter: ISMSAdapter = {
        name: 'CustomTwilioAdapter',
        async sendSMS(params) {
          return {
            providerId: `custom_twilio_${Date.now()}`,
            rawResponse: { sid: 'SM12345678', status: 'sent' }
          };
        }
      };

      smsProvider.setAdapter(customAdapter);
      if (smsProvider.getAdapter().name !== 'CustomTwilioAdapter') {
        throw new Error('Adapter was not swapped');
      }
    });

    // =======================================================================
    // SUITE 5: NOTIFICATION PERSISTENCE & ERROR RECORDING
    // =======================================================================
    console.log('\n--- SUITE 5: Notification Persistence & Error Recording ---');

    await assertTest('Persistence 5.1: Failed dispatch records error details and FAILED status in Notification table', async () => {
      const res = await request(app)
        .post('/api/admin/notifications/send-performance')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          studentId: sampleStudent.id,
          channel: 'SMS',
          simulateFailure: true
        });

      if (res.status !== 200) throw new Error(`HTTP ${res.status}`);
      const notifId = res.body.notifications[0]?.id;
      if (!notifId) throw new Error('Missing notification ID in response');

      // Wait for background worker retries and failure exhaustion
      await NotificationQueue.waitUntilIdle(4000);

      const dbRecord = await prisma.notification.findUnique({
        where: { id: notifId }
      });

      if (!dbRecord) throw new Error('Notification record not found in database');
      if (dbRecord.status !== NotificationStatus.FAILED) {
        throw new Error(`Expected status FAILED, got ${dbRecord.status}`);
      }
      if (!dbRecord.failedAt) {
        throw new Error('failedAt timestamp missing');
      }
      if (!dbRecord.errorMessage || dbRecord.errorMessage.trim().length === 0) {
        throw new Error('errorMessage missing from failed notification');
      }
    });

    await assertTest('Persistence 5.2: Successful dispatch records DELIVERED status and timestamps in DB', async () => {
      const res = await request(app)
        .post('/api/admin/notifications/send-performance')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          studentId: sampleStudent.id,
          channel: 'BOTH'
        });

      if (res.status !== 200) throw new Error(`HTTP ${res.status}`);

      // Wait for background worker to process the queued jobs
      await NotificationQueue.waitUntilIdle(4000);

      for (const notif of res.body.notifications) {
        const dbRecord = await prisma.notification.findUnique({
          where: { id: notif.id }
        });

        if (!dbRecord) throw new Error(`Notification ${notif.id} not found in DB`);
        if (dbRecord.status !== NotificationStatus.DELIVERED) {
          throw new Error(`Expected DELIVERED, got ${dbRecord.status}`);
        }
        if (!dbRecord.sentAt || !dbRecord.deliveredAt) {
          throw new Error('sentAt or deliveredAt timestamp missing');
        }
        if (!dbRecord.providerMessageId) {
          throw new Error('providerMessageId missing');
        }
      }
    });

  } catch (globalErr: any) {
    console.error('Fatal error during test run:', globalErr);
    failed++;
  }

  console.log('\n========================================');
  console.log(`Real Provider Adapter Tests: ${passed} Passed, ${failed} Failed`);
  console.log('========================================');

  if (failed > 0) {
    process.exit(1);
  }
}

runRealProviderAdapterTests()
  .finally(async () => {
    await prisma.$disconnect();
  });
