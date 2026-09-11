import { NotificationStatus, NotificationType } from '@prisma/client';
import { INotificationProvider, IWhatsAppAdapter, NotificationPayload, ProviderSendResult } from './types';
import { MockNotificationProvider } from './mock.provider';
import { MetaWhatsAppCloudAdapter, WhatsAppProviderError } from './metaWhatsApp.adapter';
import { config } from '../config';

export class WhatsAppProvider implements INotificationProvider {
  public readonly name = 'WhatsAppProvider';
  public readonly type = NotificationType.WHATSAPP;
  private mockProvider: MockNotificationProvider;
  private adapter: IWhatsAppAdapter;

  constructor(adapter?: IWhatsAppAdapter) {
    this.mockProvider = new MockNotificationProvider(NotificationType.WHATSAPP);
    this.adapter = adapter || new MetaWhatsAppCloudAdapter();
  }

  /**
   * Allows hot-swapping or injecting custom WhatsApp adapters at runtime
   */
  setAdapter(adapter: IWhatsAppAdapter): void {
    this.adapter = adapter;
  }

  getAdapter(): IWhatsAppAdapter {
    return this.adapter;
  }

  async send(payload: NotificationPayload): Promise<ProviderSendResult> {
    const isMock = config.mockNotifications || !config.hasWhatsAppCredentials();

    // 1. Safe Mock Mode Fallback
    if (isMock) {
      return await this.mockProvider.send({
        ...payload,
        type: NotificationType.WHATSAPP
      });
    }

    // 2. Real Meta WhatsApp Business Cloud API Dispatch via Adapter
    const now = new Date();
    try {
      console.log(
        `[WhatsAppProvider] 📡 Dispatching real WhatsApp message via adapter: ${this.adapter.name} to ${payload.recipientMobile}`
      );

      let result: { providerId: string; rawResponse?: any };

      // Check if template dispatch is requested (Meta requires template for business-initiated chats)
      if (payload.templateName) {
        result = await this.adapter.sendTemplate({
          to: payload.recipientMobile,
          templateName: payload.templateName,
          bodyParameters: payload.templateParameters || [payload.message]
        });
      } else {
        // Direct text dispatch (within active customer service window or sandbox)
        result = await this.adapter.sendText({
          to: payload.recipientMobile,
          text: payload.message
        });
      }

      console.log(
        `[WhatsAppProvider] ✅ Real WhatsApp Dispatched! Meta Provider ID: ${result.providerId}`
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
      console.error(`[WhatsAppProvider] ❌ Real WhatsApp dispatch failed:`, err.message);

      const errorCode = (err instanceof WhatsAppProviderError ? err.code : 'PROVIDER_FAILURE');

      return {
        success: false,
        providerId: `failed-wa-${Date.now()}`,
        providerName: `${this.name} (${this.adapter.name})`,
        status: NotificationStatus.FAILED,
        sentAt: now,
        failedAt: now,
        errorCode,
        errorMessage: `[${errorCode}] ${err.message}`,
        rawResponse: err instanceof WhatsAppProviderError ? err.rawError : undefined,
        metadata: {
          adapter: this.adapter.name,
          category: payload.category
        }
      };
    }
  }
}
