import crypto from 'crypto';
import { NotificationCategory, NotificationStatus, NotificationType } from '@prisma/client';
import { INotificationProvider, NotificationPayload, ProviderSendResult } from './types';

export class MockNotificationProvider implements INotificationProvider {
  public readonly name = 'MockNotificationProvider';
  public readonly type: NotificationType;

  constructor(type: NotificationType = NotificationType.SMS) {
    this.type = type;
  }

  /**
   * Masks mobile number for secure operation logging
   */
  private maskNumber(phone: string): string {
    if (!phone) return '—';
    const clean = phone.trim();
    if (clean.length <= 4) return clean;
    if (clean.length <= 7) return `${clean.slice(0, 2)}***${clean.slice(-2)}`;
    return `${clean.slice(0, 4)}****${clean.slice(-4)}`;
  }

  /**
   * Simulates message transmission, logs operation, and generates mock provider ID and status
   */
  async send(payload: NotificationPayload): Promise<ProviderSendResult> {
    const channel = payload.type || this.type;
    const channelTag = channel === NotificationType.WHATSAPP ? 'wa' : 'sms';
    const mockProviderId = `mock-${channelTag}-${crypto.randomUUID().slice(0, 12)}`;
    const now = new Date();
    const maskedMobile = this.maskNumber(payload.recipientMobile);

    console.log(
      `[MockNotificationProvider] ⏳ [PROCESSING] [${channel}] [${payload.category}] Recipient: ${maskedMobile} | ProviderID: ${mockProviderId}`
    );

    // Simulate failure detection conditions:
    // 1. Explicit simulateFailure flag
    // 2. Failure trigger phone numbers (ending in '0000', empty, or contains 'FAIL')
    const isExplicitFailure = payload.simulateFailure === true;
    const isFailureNumber =
      !payload.recipientMobile ||
      payload.recipientMobile.trim().endsWith('0000') ||
      payload.recipientMobile.includes('FAIL') ||
      payload.recipientMobile === '0000000000';

    if (isExplicitFailure || isFailureNumber) {
      const errorMsg = isExplicitFailure
        ? 'Simulated provider dispatch failure (simulated error triggered by admin/test)'
        : `Destination network unreachable or invalid phone format: ${maskedMobile}`;

      console.error(
        `[MockNotificationProvider] ❌ [FAILED] [${channel}] [${payload.category}] Recipient: ${maskedMobile} | ProviderID: ${mockProviderId} | Error: ${errorMsg}`
      );

      return {
        success: false,
        providerId: mockProviderId,
        providerName: `${this.name} (${channel})`,
        status: NotificationStatus.FAILED,
        sentAt: now,
        failedAt: now,
        errorMessage: errorMsg,
        metadata: {
          simulated: true,
          channel,
          category: payload.category
        }
      };
    }

    // Success simulation
    console.log(
      `[MockNotificationProvider] ✅ [DELIVERED] [${channel}] [${payload.category}] Recipient: ${maskedMobile} | ProviderID: ${mockProviderId} | Length: ${payload.message.length} chars`
    );

    return {
      success: true,
      providerId: mockProviderId,
      providerName: `${this.name} (${channel})`,
      status: NotificationStatus.DELIVERED,
      sentAt: now,
      deliveredAt: now,
      metadata: {
        simulated: true,
        channel,
        category: payload.category,
        title: payload.title
      }
    };
  }
}
