import { IWhatsAppAdapter, NotificationErrorCode } from './types';
import { config } from '../config';

export class WhatsAppProviderError extends Error {
  public readonly code: NotificationErrorCode;
  public readonly statusCode?: number;
  public readonly rawError?: any;

  constructor(message: string, code: NotificationErrorCode, statusCode?: number, rawError?: any) {
    super(message);
    this.name = 'WhatsAppProviderError';
    this.code = code;
    this.statusCode = statusCode;
    this.rawError = rawError;
  }
}

export class MetaWhatsAppCloudAdapter implements IWhatsAppAdapter {
  public readonly name = 'MetaWhatsAppCloudAdapter';

  private get baseUrl(): string {
    const version = config.whatsapp.apiVersion || 'v19.0';
    const phoneId = config.whatsapp.phoneNumberId;
    return `https://graph.facebook.com/${version}/${phoneId}/messages`;
  }

  /**
   * Normalizes mobile number to E.164 without '+' or non-digit characters
   * e.g. "+91 98765-43210" -> "919876543210"
   */
  static normalizePhoneNumber(phone: string): string {
    if (!phone) {
      throw new WhatsAppProviderError(
        'Recipient phone number is empty',
        'INVALID_PHONE_NUMBER'
      );
    }

    let digits = phone.replace(/\D/g, '');

    // Standard Indian 10-digit number starting with 6-9: prepend country code 91
    if (digits.length === 10 && /^[6-9]/.test(digits)) {
      digits = `91${digits}`;
    }

    // Standard E.164 length is 10 to 15 digits
    if (digits.length < 10 || digits.length > 15) {
      throw new WhatsAppProviderError(
        `Invalid phone number length (${digits.length} digits): expected 10-15 digits`,
        'INVALID_PHONE_NUMBER'
      );
    }

    return digits;
  }

  /**
   * Dispatches an approved WhatsApp Message Template via Meta Cloud API
   */
  async sendTemplate(params: {
    to: string;
    templateName: string;
    languageCode?: string;
    bodyParameters?: string[];
    timeoutMs?: number;
  }): Promise<{ providerId: string; rawResponse?: any }> {
    const recipient = MetaWhatsAppCloudAdapter.normalizePhoneNumber(params.to);
    const language = params.languageCode || 'en_US';

    const components: any[] = [];
    if (params.bodyParameters && params.bodyParameters.length > 0) {
      components.push({
        type: 'body',
        parameters: params.bodyParameters.map(val => ({
          type: 'text',
          text: String(val)
        }))
      });
    }

    const payload = {
      messaging_product: 'whatsapp',
      recipient_type: 'individual',
      to: recipient,
      type: 'template',
      template: {
        name: params.templateName,
        language: { code: language },
        components: components.length > 0 ? components : undefined
      }
    };

    return await this.executeMetaRequest(payload, params.timeoutMs);
  }

  /**
   * Dispatches a direct text message via Meta Cloud API
   */
  async sendText(params: {
    to: string;
    text: string;
    previewUrl?: boolean;
    timeoutMs?: number;
  }): Promise<{ providerId: string; rawResponse?: any }> {
    const recipient = MetaWhatsAppCloudAdapter.normalizePhoneNumber(params.to);

    const payload = {
      messaging_product: 'whatsapp',
      recipient_type: 'individual',
      to: recipient,
      type: 'text',
      text: {
        preview_url: Boolean(params.previewUrl),
        body: params.text
      }
    };

    return await this.executeMetaRequest(payload, params.timeoutMs);
  }

  /**
   * Internal execution pipeline with timeout, auth, rate-limit, and template error mapping
   */
  private async executeMetaRequest(
    payload: any,
    timeoutMs: number = config.whatsapp.timeoutMs
  ): Promise<{ providerId: string; rawResponse?: any }> {
    const token = config.whatsapp.accessToken;
    if (!token || token.trim().length === 0) {
      throw new WhatsAppProviderError(
        'Meta WhatsApp Access Token is missing or empty',
        'AUTHENTICATION_ERROR',
        401
      );
    }

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);

    try {
      const response = await fetch(this.baseUrl, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(payload),
        signal: controller.signal
      });

      const responseJson: any = await response.json().catch(() => ({}));

      if (!response.ok) {
        this.handleMetaApiError(response.status, responseJson);
      }

      const messageId = responseJson?.messages?.[0]?.id;
      if (!messageId) {
        throw new WhatsAppProviderError(
          'Meta API did not return a valid message id in response',
          'PROVIDER_FAILURE',
          response.status,
          responseJson
        );
      }

      return {
        providerId: messageId,
        rawResponse: responseJson
      };
    } catch (err: any) {
      if (err instanceof WhatsAppProviderError) {
        throw err;
      }

      if (err.name === 'AbortError' || err.code === 'ABORT_ERR') {
        throw new WhatsAppProviderError(
          `Meta WhatsApp API request timed out after ${timeoutMs}ms`,
          'TIMEOUT',
          408
        );
      }

      if (err.code === 'ECONNREFUSED' || err.code === 'ENOTFOUND' || err.message?.includes('fetch failed')) {
        throw new WhatsAppProviderError(
          `Meta WhatsApp API network error: ${err.message || 'Connection refused or unreachable'}`,
          'NETWORK_ERROR',
          503,
          err
        );
      }

      throw new WhatsAppProviderError(
        err.message || 'Unknown Meta WhatsApp Cloud API error',
        'UNKNOWN_ERROR',
        500,
        err
      );
    } finally {
      clearTimeout(timer);
    }
  }

  /**
   * Categorizes Meta Graph API error codes into unified NotificationErrorCodes
   */
  private handleMetaApiError(status: number, json: any): never {
    const metaError = json?.error || {};
    const errorCode = metaError.code;
    const errorSubcode = metaError.error_subcode;
    const errorMsg = metaError.message || `Meta Cloud API error (HTTP ${status})`;

    // Authentication Errors (Invalid or Expired Token, Permissions)
    if (status === 401 || status === 403 || errorCode === 190 || errorCode === 200) {
      throw new WhatsAppProviderError(
        `Meta Authentication Failure: ${errorMsg}`,
        'AUTHENTICATION_ERROR',
        status,
        json
      );
    }

    // Rate Limit Errors
    if (status === 429 || errorCode === 130429 || errorCode === 80007 || errorCode === 4) {
      throw new WhatsAppProviderError(
        `Meta Rate Limit Exceeded: ${errorMsg}`,
        'RATE_LIMIT',
        429,
        json
      );
    }

    // Invalid Recipient Phone Number
    if (errorCode === 131030 || errorCode === 131026 || errorCode === 100) {
      throw new WhatsAppProviderError(
        `Meta Invalid Recipient Phone: ${errorMsg}`,
        'INVALID_PHONE_NUMBER',
        status,
        json
      );
    }

    // Template Errors (Missing, Mismatch parameters, Disabled)
    if (
      errorCode === 132000 || // Template does not exist
      errorCode === 132001 || // Template parameter count mismatch
      errorCode === 132007 || // Template paused
      errorCode === 132015    // Template language mismatch
    ) {
      throw new WhatsAppProviderError(
        `Meta WhatsApp Template Error [${errorCode}]: ${errorMsg}`,
        'WHATSAPP_TEMPLATE_ERROR',
        status,
        json
      );
    }

    // General Provider Failure
    throw new WhatsAppProviderError(
      `Meta WhatsApp Provider Failure [HTTP ${status}]: ${errorMsg}`,
      'PROVIDER_FAILURE',
      status,
      json
    );
  }
}
