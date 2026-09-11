import { NotificationStatus, NotificationType } from '@prisma/client';
import { INotificationProvider, ISMSAdapter, NotificationPayload, ProviderSendResult } from './types';
import { MockNotificationProvider } from './mock.provider';
import { RestSMSAdapter, SMSProviderError } from './restSms.adapter';
import { config } from '../config';

export class SMSProvider implements INotificationProvider {
  public readonly name = 'SMSProvider';
  public readonly type = NotificationType.SMS;
  private mockProvider: MockNotificationProvider;
  private adapter: ISMSAdapter;

  constructor(adapter?: ISMSAdapter) {
    this.mockProvider = new MockNotificationProvider(NotificationType.SMS);
    this.adapter = adapter || new RestSMSAdapter();
  }

  /**
   * Allows hot-swapping or injecting custom SMS gateway adapters at runtime
   */
  setAdapter(adapter: ISMSAdapter): void {
    this.adapter = adapter;
  }

  getAdapter(): ISMSAdapter {
    return this.adapter;
  }

  async send(payload: NotificationPayload): Promise<ProviderSendResult> {
    const isMock = config.mockNotifications || !config.hasSmsCredentials();

    // 1. Safe Mock Mode Fallback
    if (isMock) {
      return await this.mockProvider.send({
        ...payload,
        type: NotificationType.SMS
      });
    }

    // 2. Real SMS Gateway Dispatch via Adapter
    const now = new Date();
    try {
      console.log(
        `[SMSProvider] 📡 Dispatching real SMS via adapter: ${this.adapter.name} to ${payload.recipientMobile}`
      );

      const result = await this.adapter.sendSMS({
        to: payload.recipientMobile,
        message: payload.message,
        senderId: config.sms.senderId
      });

      console.log(
        `[SMSProvider] ✅ Real SMS Dispatched! Provider ID: ${result.providerId}`
      );

      return {
        success: true,
        providerId: result.providerId,
        providerName: `${this.name} (${this.adapter.name})`,
        status: NotificationStatus.DELIVERED,
        sentAt: now,
        deliveredAt: now,
        rawResponse: result.rawResponse,
        metadata: {
          adapter: this.adapter.name,
          category: payload.category
        }
      };
    } catch (err: any) {
      console.error(`[SMSProvider] ❌ Real SMS dispatch failed:`, err.message);

      const errorCode = (err instanceof SMSProviderError ? err.code : 'PROVIDER_FAILURE');

      return {
        success: false,
        providerId: `failed-sms-${Date.now()}`,
        providerName: `${this.name} (${this.adapter.name})`,
        status: NotificationStatus.FAILED,
        sentAt: now,
        failedAt: now,
        errorCode,
        errorMessage: `[${errorCode}] ${err.message}`,
        rawResponse: err instanceof SMSProviderError ? err.rawError : undefined,
        metadata: {
          adapter: this.adapter.name,
          category: payload.category
        }
      };
    }
  }
}
