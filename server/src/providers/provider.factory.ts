import { NotificationType } from '@prisma/client';
import { INotificationProvider } from './types';
import { SMSProvider } from './sms.provider';
import { WhatsAppProvider } from './whatsapp.provider';
import { MockNotificationProvider } from './mock.provider';
import { config } from '../config';

export class NotificationProviderFactory {
  private static smsProvider: SMSProvider = new SMSProvider();
  private static whatsappProvider: WhatsAppProvider = new WhatsAppProvider();
  private static mockProvider: MockNotificationProvider = new MockNotificationProvider();

  /**
   * Returns the provider for the specified notification channel.
   * If global mock mode is active, returns the MockNotificationProvider.
   */
  static getProvider(type: NotificationType): INotificationProvider {
    if (config.mockNotifications) {
      return this.mockProvider;
    }

    switch (type) {
      case NotificationType.SMS:
        return this.smsProvider;
      case NotificationType.WHATSAPP:
        return this.whatsappProvider;
      default:
        return this.mockProvider;
    }
  }

  /**
   * Returns the SMS provider directly (with adapter)
   */
  static getSMSProvider(): SMSProvider {
    return this.smsProvider;
  }

  /**
   * Returns the WhatsApp provider directly (with adapter)
   */
  static getWhatsAppProvider(): WhatsAppProvider {
    return this.whatsappProvider;
  }

  /**
   * Explicitly returns the MockNotificationProvider
   */
  static getMockProvider(): MockNotificationProvider {
    return this.mockProvider;
  }

  /**
   * Checks whether mock notifications mode is currently active
   */
  static isMockMode(): boolean {
    return config.mockNotifications;
  }

  /**
   * Checks whether real SMS credentials are configured
   */
  static hasSmsCredentials(): boolean {
    return config.hasSmsCredentials();
  }

  /**
   * Checks whether real WhatsApp credentials are configured
   */
  static hasWhatsAppCredentials(): boolean {
    return config.hasWhatsAppCredentials();
  }
}
