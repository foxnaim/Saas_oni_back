/**
 * PayPal payment verification service
 * Uses native fetch (Node 18+) - no additional dependencies required
 */

import { logger } from "../utils/logger";

const PAYPAL_API_URL =
  process.env.PAYPAL_MODE === "live"
    ? "https://api-m.paypal.com"
    : "https://api-m.sandbox.paypal.com";

export async function getPayPalAccessToken(): Promise<string> {
  const clientId = process.env.PAYPAL_CLIENT_ID;
  const secret = process.env.PAYPAL_SECRET;

  if (!clientId || !secret) {
    throw new Error("PayPal credentials not configured");
  }

  const auth = Buffer.from(`${clientId}:${secret}`).toString("base64");
  const response = await fetch(`${PAYPAL_API_URL}/v1/oauth2/token`, {
    method: "POST",
    headers: {
      Authorization: `Basic ${auth}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: "grant_type=client_credentials",
  });

  if (!response.ok) {
    const errorBody = await response.text();
    logger.error(`[PayPal] Auth failed: ${response.status} - ${errorBody}`);
    throw new Error(`PayPal auth failed: ${response.status}`);
  }

  const data = (await response.json()) as { access_token: string };
  logger.info(`[PayPal] Auth success, token received`);
  return data.access_token;
}

interface PayPalOrderDetails {
  id: string;
  status: string;
  purchase_units?: Array<{
    amount?: { value?: string; currency_code?: string };
  }>;
}

export async function verifyPayPalOrder(orderId: string): Promise<PayPalOrderDetails> {
  const accessToken = await getPayPalAccessToken();

  const response = await fetch(
    `${PAYPAL_API_URL}/v2/checkout/orders/${orderId}`,
    {
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
    },
  );

  if (!response.ok) {
    const errorBody = await response.text();
    logger.error(`[PayPal] Order verification failed: ${response.status} - ${errorBody}`);
    throw new Error(`PayPal order verification failed: ${response.status}`);
  }

  const result = (await response.json()) as PayPalOrderDetails;
  logger.info(`[PayPal] Order ${orderId} status: ${result.status}`);
  return result;
}
