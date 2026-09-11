import { NotificationCategory, NotificationStatus, NotificationType } from '@prisma/client';

export type NotificationErrorCode =
  | 'INVALID_PHONE_NUMBER'
  | 'PROVIDER_FAILURE'
  | 'TIMEOUT'
  | 'RATE_LIMIT'
  | 'WHATSAPP_TEMPLATE_ERROR'
  | 'NETWORK_ERROR'
  | 'AUTHENTICATION_ERROR'
  | 'UNKNOWN_ERROR';

export interface NotificationPayload {
  recipientMobile: string;
  message: string;
  type: NotificationType;
  category: NotificationCategory;
  title?: string;
  studentId?: string;
  noticeId?: string;
  simulateFailure?: boolean;
  templateName?: string;
  templateParameters?: string[];
  metadata?: Record<string, any>;
}

export interface ProviderSendResult {
  success: boolean;
  providerId: string;
  providerName: string;
  status: NotificationStatus;
  sentAt?: Date;
  deliveredAt?: Date;
  failedAt?: Date;
  errorCode?: NotificationErrorCode;
  errorMessage?: string;
  rawResponse?: any;
  metadata?: Record<string, any>;
}

export interface INotificationProvider {
  readonly name: string;
  readonly type: NotificationType;
  send(payload: NotificationPayload): Promise<ProviderSendResult>;
}

/**
 * Adapter interface for SMS gateways (pluggable without rewriting application)
 */
export interface ISMSAdapter {
  readonly name: string;
  sendSMS(params: {
    to: string;
    message: string;
    senderId?: string;
    timeoutMs?: number;
  }): Promise<{ providerId: string; rawResponse?: any }>;
}

/**
 * Adapter interface for Meta WhatsApp Business / Cloud API
 */
export interface IWhatsAppAdapter {
  readonly name: string;
  sendTemplate(params: {
    to: string;
    templateName: string;
    languageCode?: string;
    bodyParameters?: string[];
    timeoutMs?: number;
  }): Promise<{ providerId: string; rawResponse?: any }>;
  sendText(params: {
    to: string;
    text: string;
    previewUrl?: boolean;
    timeoutMs?: number;
  }): Promise<{ providerId: string; rawResponse?: any }>;
}
