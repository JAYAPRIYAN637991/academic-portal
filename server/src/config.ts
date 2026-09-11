import dotenv from 'dotenv';
dotenv.config();

export const config = {
  port: parseInt(process.env.PORT || '5000', 10),
  jwtSecret: process.env.JWT_SECRET || 'college-portal-super-secret-jwt-key-minimum-32-chars-2026',
  jwtExpiration: '24h',
  nodeEnv: process.env.NODE_ENV || 'development',
  corsOrigin: process.env.CORS_ORIGIN || '*',
  mockNotifications: process.env.MOCK_NOTIFICATIONS !== 'false',
  importBatchSize: parseInt(process.env.IMPORT_BATCH_SIZE || '500', 10),
  maxUploadSizeMb: parseInt(process.env.MAX_UPLOAD_SIZE_MB || '25', 10),
  redis: {
    host: process.env.REDIS_HOST || '127.0.0.1',
    port: parseInt(process.env.REDIS_PORT || '6379', 10),
    password: process.env.REDIS_PASSWORD || undefined,
    enabled: process.env.ENABLE_REDIS !== 'false'
  },
  sms: {
    apiKey: process.env.SMS_API_KEY || '',
    senderId: process.env.SMS_SENDER_ID || 'COLLEGE',
    apiUrl: process.env.SMS_API_URL || 'https://api.sms-gateway.com/v1/send',
    timeoutMs: parseInt(process.env.SMS_TIMEOUT_MS || '10000', 10)
  },
  whatsapp: {
    accessToken: process.env.WHATSAPP_ACCESS_TOKEN || '',
    phoneNumberId: process.env.WHATSAPP_PHONE_NUMBER_ID || '',
    businessAccountId: process.env.WHATSAPP_BUSINESS_ACCOUNT_ID || '',
    apiVersion: process.env.WHATSAPP_API_VERSION || 'v19.0',
    templateName: process.env.WHATSAPP_TEMPLATE_NAME || 'academic_notification',
    timeoutMs: parseInt(process.env.WHATSAPP_TIMEOUT_MS || '10000', 10)
  },
  hasSmsCredentials(): boolean {
    return Boolean(this.sms.apiKey && this.sms.apiKey.trim().length > 0);
  },
  hasWhatsAppCredentials(): boolean {
    return Boolean(
      this.whatsapp.accessToken &&
      this.whatsapp.phoneNumberId &&
      this.whatsapp.accessToken.trim().length > 0 &&
      this.whatsapp.phoneNumberId.trim().length > 0
    );
  }
};
