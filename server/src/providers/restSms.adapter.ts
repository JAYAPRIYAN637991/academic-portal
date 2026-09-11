import { ISMSAdapter, NotificationErrorCode } from './types';
import { config } from '../config';

export class SMSProviderError extends Error {
  public readonly code: NotificationErrorCode;
  public readonly statusCode?: number;
  public readonly rawError?: any;

  constructor(message: string, code: NotificationErrorCode, statusCode?: number, rawError?: any) {
    super(message);
    this.name = 'SMSProviderError';
    this.code = code;
    this.statusCode = statusCode;
    this.rawError = rawError;
  }
}

/**
 * Pluggable REST SMS Gateway Adapter
 * Connects to standard REST SMS gateways (e.g., Fast2SMS, Twilio, AWS SNS, MSG91)
 */
export class RestSMSAdapter implements ISMSAdapter {
  public readonly name = 'RestSMSAdapter';

  private apiUrl: string;
  private defaultSenderId: string;

  constructor(apiUrl?: string, defaultSenderId?: string) {
    this.apiUrl = apiUrl || config.sms.apiUrl;
    this.defaultSenderId = defaultSenderId || config.sms.senderId;
  }

  /**
   * Normalizes mobile number to standard 10-digit or valid international format
   */
  static normalizePhoneNumber(phone: string): string {
    if (!phone) {
      throw new SMSProviderError('Recipient phone number is empty', 'INVALID_PHONE_NUMBER');
    }

    const digits = phone.replace(/\D/g, '');

    if (digits.length < 10 || digits.length > 15) {
      throw new SMSProviderError(
        `Invalid phone number length (${digits.length} digits): expected 10-15 digits`,
        'INVALID_PHONE_NUMBER'
      );
    }

    return digits;
  }

  /**
   * Sends SMS via the configured REST Gateway
   */
  async sendSMS(params: {
    to: string;
    message: string;
    senderId?: string;
    timeoutMs?: number;
  }): Promise<{ providerId: string; rawResponse?: any }> {
    const apiKey = config.sms.apiKey;
    if (!apiKey || apiKey.trim().length === 0) {
      throw new SMSProviderError(
        'SMS Gateway API Key is missing or empty',
        'AUTHENTICATION_ERROR',
        401
      );
    }

    const recipient = RestSMSAdapter.normalizePhoneNumber(params.to);
    const sender = params.senderId || this.defaultSenderId;
    const timeoutMs = params.timeoutMs || config.sms.timeoutMs;

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);

    const payload = {
      sender_id: sender,
      message: params.message,
      numbers: recipient
    };

    try {
      const response = await fetch(this.apiUrl, {
        method: 'POST',
        headers: {
          'Authorization': apiKey,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(payload),
        signal: controller.signal
      });

      const responseJson: any = await response.json().catch(() => ({}));

      if (!response.ok) {
        this.handleHttpError(response.status, responseJson);
      }

      // Extract message ID from standard gateway response structures
      const messageId =
        responseJson?.message_id ||
        responseJson?.request_id ||
        responseJson?.id ||
        (Array.isArray(responseJson?.message) ? responseJson.message[0] : null) ||
        `sms_${Date.now()}_${recipient.slice(-4)}`;

      return {
        providerId: String(messageId),
        rawResponse: responseJson
      };
    } catch (err: any) {
      if (err instanceof SMSProviderError) {
        throw err;
      }

      if (err.name === 'AbortError' || err.code === 'ABORT_ERR') {
        throw new SMSProviderError(
          `SMS gateway request timed out after ${timeoutMs}ms`,
          'TIMEOUT',
          408
        );
      }

      if (err.code === 'ECONNREFUSED' || err.code === 'ENOTFOUND' || err.message?.includes('fetch failed')) {
        throw new SMSProviderError(
          `SMS gateway network error: ${err.message || 'Connection refused or host unreachable'}`,
          'NETWORK_ERROR',
          503,
          err
        );
      }

      throw new SMSProviderError(
        err.message || 'Unknown SMS gateway error',
        'UNKNOWN_ERROR',
        500,
        err
      );
    } finally {
      clearTimeout(timer);
    }
  }

  private handleHttpError(status: number, json: any): never {
    const errorMsg = json?.message || json?.error || `SMS gateway error (HTTP ${status})`;

    if (status === 401 || status === 403) {
      throw new SMSProviderError(
        `SMS Gateway Authentication Failure: ${errorMsg}`,
        'AUTHENTICATION_ERROR',
        status,
        json
      );
    }

    if (status === 429) {
      throw new SMSProviderError(
        `SMS Gateway Rate Limit Exceeded: ${errorMsg}`,
        'RATE_LIMIT',
        429,
        json
      );
    }

    if (status >= 400 && status < 500) {
      throw new SMSProviderError(
        `SMS Gateway Client Error [HTTP ${status}]: ${errorMsg}`,
        'INVALID_PHONE_NUMBER',
        status,
        json
      );
    }

    throw new SMSProviderError(
      `SMS Gateway Provider Failure [HTTP ${status}]: ${errorMsg}`,
      'PROVIDER_FAILURE',
      status,
      json
    );
  }
}
