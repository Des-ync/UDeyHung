/**
 * Paystack integration — primary payment provider.
 * Supports: cards, bank transfer, USSD, MoMo (MTN, Vodafone, AirtelTigo).
 * All amounts in kobo = pesewas in this context (Paystack uses lowest unit).
 * Docs: https://paystack.com/docs/api/
 */

import crypto from "crypto";

const PAYSTACK_API = "https://api.paystack.co";

interface PaystackHeaders {
  Authorization: string;
  "Content-Type": string;
}

function getHeaders(): PaystackHeaders {
  const key = process.env["PAYSTACK_SECRET_KEY"];
  if (!key) throw new Error("PAYSTACK_SECRET_KEY not configured");
  return {
    Authorization: `Bearer ${key}`,
    "Content-Type": "application/json",
  };
}

async function paystackFetch<T>(
  path: string,
  options?: RequestInit
): Promise<T> {
  const response = await fetch(`${PAYSTACK_API}${path}`, {
    ...options,
    headers: {
      ...getHeaders(),
      ...(options?.headers ?? {}),
    },
  });

  const data: unknown = await response.json();

  if (!response.ok) {
    const errData = data as { message?: string };
    throw new Error(
      `Paystack error ${response.status}: ${errData.message ?? "Unknown"}`
    );
  }

  return data as T;
}

// ─────────────────────────────────────────────────────────────────────────────
// Initialize transaction (for card + bank transfer)
// ─────────────────────────────────────────────────────────────────────────────

export interface InitializeTransactionParams {
  email: string;
  amountPesewas: number; // stored as pesewas, sent as-is (Paystack GHS uses pesewas as base unit)
  reference: string; // unique per transaction
  callbackUrl: string;
  metadata?: Record<string, unknown>;
  channels?: Array<"card" | "bank" | "ussd" | "qr" | "mobile_money" | "bank_transfer">;
}

interface PaystackInitResponse {
  status: boolean;
  message: string;
  data: {
    authorization_url: string;
    access_code: string;
    reference: string;
  };
}

export async function initializeTransaction(
  params: InitializeTransactionParams
): Promise<{ authorizationUrl: string; accessCode: string; reference: string }> {
  const result = await paystackFetch<PaystackInitResponse>(
    "/transaction/initialize",
    {
      method: "POST",
      body: JSON.stringify({
        email: params.email,
        amount: params.amountPesewas, // Paystack GHS base unit = pesewas
        reference: params.reference,
        callback_url: params.callbackUrl,
        metadata: params.metadata ?? {},
        channels: params.channels ?? ["card", "mobile_money", "bank_transfer"],
        currency: "GHS",
      }),
    }
  );

  return {
    authorizationUrl: result.data.authorization_url,
    accessCode: result.data.access_code,
    reference: result.data.reference,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Mobile Money charge (direct charge flow)
// ─────────────────────────────────────────────────────────────────────────────

type MoMoProvider = "mtn" | "vodafone" | "tigo"; // Paystack provider codes

const MOMO_PROVIDER_MAP: Record<string, MoMoProvider> = {
  MTN: "mtn",
  VODAFONE: "vodafone",
  AIRTELTIGO: "tigo",
};

export interface ChargeMoMoParams {
  email: string;
  amountPesewas: number;
  reference: string;
  phone: string; // +233XXXXXXXXX
  network: "MTN" | "VODAFONE" | "AIRTELTIGO";
}

interface PaystackChargeResponse {
  status: boolean;
  message: string;
  data: {
    status: string; // "send_otp" | "pending" | "success" | "failed"
    reference: string;
    display_text?: string;
  };
}

export async function chargeMoMo(
  params: ChargeMoMoParams
): Promise<{ status: string; reference: string; displayText?: string }> {
  const provider = MOMO_PROVIDER_MAP[params.network];
  if (!provider) throw new Error(`Unsupported MoMo network: ${params.network}`);

  // Paystack expects phone without +
  const phone = params.phone.replace("+", "");

  const result = await paystackFetch<PaystackChargeResponse>("/charge", {
    method: "POST",
    body: JSON.stringify({
      email: params.email,
      amount: params.amountPesewas,
      currency: "GHS",
      reference: params.reference,
      mobile_money: { phone, provider },
    }),
  });

  return {
    status: result.data.status,
    reference: result.data.reference,
    displayText: result.data.display_text,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Verify transaction
// ─────────────────────────────────────────────────────────────────────────────

interface PaystackVerifyResponse {
  status: boolean;
  data: {
    status: string; // "success" | "failed" | "abandoned"
    amount: number;
    reference: string;
    gateway_response: string;
    customer: { email: string };
    metadata?: Record<string, unknown>;
  };
}

export async function verifyTransaction(
  reference: string
): Promise<{ status: "success" | "failed" | "abandoned"; amountPesewas: number; reference: string }> {
  const result = await paystackFetch<PaystackVerifyResponse>(
    `/transaction/verify/${encodeURIComponent(reference)}`
  );

  const status = result.data.status as "success" | "failed" | "abandoned";
  return {
    status,
    amountPesewas: result.data.amount,
    reference: result.data.reference,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Refund
// ─────────────────────────────────────────────────────────────────────────────

export async function refundTransaction(
  reference: string,
  amountPesewas?: number // partial refund if provided
): Promise<boolean> {
  interface RefundResponse {
    status: boolean;
    message: string;
  }
  const body: Record<string, unknown> = { transaction: reference };
  if (amountPesewas !== undefined) body["amount"] = amountPesewas;

  const result = await paystackFetch<RefundResponse>("/refund", {
    method: "POST",
    body: JSON.stringify(body),
  });

  return result.status;
}

// ─────────────────────────────────────────────────────────────────────────────
// Webhook signature verification
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Verify Paystack webhook signature.
 * Paystack signs with HMAC-SHA512 of the raw body using the secret key.
 */
export function verifyWebhookSignature(
  rawBody: string,
  signature: string
): boolean {
  const secret = process.env["PAYSTACK_WEBHOOK_SECRET"];
  if (!secret) throw new Error("PAYSTACK_WEBHOOK_SECRET not configured");

  const expected = crypto
    .createHmac("sha512", secret)
    .update(rawBody)
    .digest("hex");

  return crypto.timingSafeEqual(
    Buffer.from(expected, "hex"),
    Buffer.from(signature, "hex")
  );
}

export interface PaystackWebhookEvent {
  event: string; // "charge.success" | "charge.failed" | "transfer.success" etc.
  data: {
    reference: string;
    status: string;
    amount: number;
    metadata?: Record<string, unknown>;
  };
}
