import {
  Injectable,
  Logger,
  ServiceUnavailableException,
  InternalServerErrorException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

interface PayPalTokenResponse {
  access_token: string;
  token_type: string;
  expires_in: number;
}

export interface PayPalOrderStatus {
  id: string;
  status: string;
  amount: {
    currency_code: string;
    value: string;
  } | null;
}

@Injectable()
export class PayPalService {
  private readonly logger = new Logger(PayPalService.name);

  private readonly clientId: string | undefined;
  private readonly secret: string | undefined;
  private readonly baseUrl: string;

  constructor(private readonly configService: ConfigService) {
    this.clientId = this.configService.get<string>('PAYPAL_CLIENT_ID');
    this.secret = this.configService.get<string>('PAYPAL_SECRET');

    const mode = this.configService.get<string>('PAYPAL_MODE') ?? 'sandbox';
    this.baseUrl =
      mode === 'live'
        ? 'https://api-m.paypal.com'
        : 'https://api-m.sandbox.paypal.com';

    if (!this.clientId || !this.secret) {
      this.logger.warn(
        'PayPal credentials (PAYPAL_CLIENT_ID / PAYPAL_SECRET) are not configured. ' +
          'PayPal features will be unavailable.',
      );
    } else {
      this.logger.log(`PayPal service initialised in "${mode}" mode`);
    }
  }

  // ─── Credentials guard ──────────────────────────────────────────────────────

  private assertCredentials(): void {
    if (!this.clientId || !this.secret) {
      throw new ServiceUnavailableException(
        'PayPal is not configured on this server. ' +
          'Please set PAYPAL_CLIENT_ID and PAYPAL_SECRET.',
      );
    }
  }

  // ─── OAuth 2.0 access token ─────────────────────────────────────────────────

  /**
   * Obtain a short-lived OAuth 2.0 bearer token from PayPal using the
   * client-credentials grant.
   */
  async getAccessToken(): Promise<string> {
    this.assertCredentials();

    const url = `${this.baseUrl}/v1/oauth2/token`;
    const credentials = Buffer.from(`${this.clientId}:${this.secret}`).toString('base64');

    this.logger.debug('Requesting PayPal access token');

    let response: Response;
    try {
      response = await fetch(url, {
        method: 'POST',
        headers: {
          Authorization: `Basic ${credentials}`,
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: 'grant_type=client_credentials',
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      this.logger.error(`PayPal token request failed (network): ${message}`);
      throw new InternalServerErrorException(
        'Unable to reach the PayPal API. Please try again later.',
      );
    }

    if (!response.ok) {
      const body = await response.text();
      this.logger.error(
        `PayPal token request failed — HTTP ${response.status}: ${body}`,
      );
      throw new InternalServerErrorException(
        `PayPal authentication failed with status ${response.status}.`,
      );
    }

    const data = (await response.json()) as PayPalTokenResponse;
    this.logger.debug('PayPal access token obtained successfully');
    return data.access_token;
  }

  // ─── Order verification ─────────────────────────────────────────────────────

  /**
   * Fetch order details from the PayPal Orders v2 API and return a normalised
   * status + amount object.
   *
   * @param orderId  The PayPal order ID to verify (e.g. "5O190127TN364715T")
   */
  async verifyOrder(orderId: string): Promise<PayPalOrderStatus> {
    this.assertCredentials();

    this.logger.log(`Verifying PayPal order: ${orderId}`);

    const accessToken = await this.getAccessToken();
    const url = `${this.baseUrl}/v2/checkout/orders/${orderId}`;

    let response: Response;
    try {
      response = await fetch(url, {
        method: 'GET',
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      this.logger.error(
        `PayPal order fetch failed (network) for order ${orderId}: ${message}`,
      );
      throw new InternalServerErrorException(
        'Unable to reach the PayPal API. Please try again later.',
      );
    }

    if (!response.ok) {
      const body = await response.text();
      this.logger.error(
        `PayPal order fetch failed — HTTP ${response.status} for order ${orderId}: ${body}`,
      );
      throw new InternalServerErrorException(
        `PayPal returned status ${response.status} for order ${orderId}.`,
      );
    }

    // PayPal Orders v2 response shape (simplified)
    const data = (await response.json()) as {
      id: string;
      status: string;
      purchase_units?: Array<{
        amount?: {
          currency_code: string;
          value: string;
        };
      }>;
    };

    const amount = data.purchase_units?.[0]?.amount ?? null;

    this.logger.log(
      `PayPal order ${orderId} resolved — status: ${data.status}, ` +
        `amount: ${amount ? `${amount.value} ${amount.currency_code}` : 'n/a'}`,
    );

    return {
      id: data.id,
      status: data.status,
      amount,
    };
  }
}
