/**
 * Arkesel SMS API — primary SMS provider (Ghanaian rates).
 * Hubtel used as fallback.
 * Docs: https://developers.arkesel.com/
 */

interface ArkeselSendParams {
  to: string; // E.164 +233XXXXXXXXX
  message: string;
  senderId?: string;
}

interface ArkeselResponse {
  status: string;
  data?: Array<{ id: string; recipient: string; status: string }>;
  message?: string;
}

/**
 * Send SMS via Arkesel (primary).
 * Returns the Arkesel message ID.
 */
async function sendArkesel(params: ArkeselSendParams): Promise<string> {
  const apiKey = process.env["ARKESEL_API_KEY"];
  const senderId = params.senderId ?? process.env["ARKESEL_SENDER_ID"] ?? "TableGH";

  if (!apiKey) throw new Error("Arkesel API key not configured");

  const response = await fetch("https://sms.arkesel.com/api/v2/sms/send", {
    method: "POST",
    headers: {
      "api-key": apiKey,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      sender: senderId,
      message: params.message,
      recipients: [params.to.replace("+", "")], // Arkesel expects without +
    }),
  });

  if (!response.ok) {
    throw new Error(`Arkesel HTTP error: ${response.status}`);
  }

  const data: ArkeselResponse = (await response.json()) as ArkeselResponse;

  if (data.status !== "success") {
    throw new Error(`Arkesel error: ${data.message ?? "Unknown error"}`);
  }

  return data.data?.[0]?.id ?? "unknown";
}

// ─────────────────────────────────────────────────────────────────────────────
// Hubtel SMS fallback
// ─────────────────────────────────────────────────────────────────────────────

interface HubtelSmsResponse {
  Status: number;
  MessageId?: string;
  Message?: string;
}

async function sendHubtelSms(params: ArkeselSendParams): Promise<string> {
  const clientId = process.env["HUBTEL_CLIENT_ID"];
  const clientSecret = process.env["HUBTEL_CLIENT_SECRET"];
  const senderId = params.senderId ?? process.env["HUBTEL_SENDER_ID"] ?? "TableGH";

  if (!clientId || !clientSecret) {
    throw new Error("Hubtel credentials not configured");
  }

  const credentials = Buffer.from(`${clientId}:${clientSecret}`).toString("base64");

  const response = await fetch(
    "https://smsc.hubtel.com/v1/messages/send?" +
      new URLSearchParams({
        clientsecretid: clientId,
        clientsecret: clientSecret,
        from: senderId,
        to: params.to.replace("+", ""),
        content: params.message,
      }),
    {
      method: "GET",
      headers: {
        Authorization: `Basic ${credentials}`,
      },
    }
  );

  if (!response.ok) {
    throw new Error(`Hubtel SMS HTTP error: ${response.status}`);
  }

  const data: HubtelSmsResponse = (await response.json()) as HubtelSmsResponse;

  if (data.Status !== 0) {
    throw new Error(`Hubtel SMS error: ${data.Message ?? "Unknown error"}`);
  }

  return data.MessageId ?? "unknown";
}

// ─────────────────────────────────────────────────────────────────────────────
// Public API with automatic fallback
// ─────────────────────────────────────────────────────────────────────────────

export interface SmsResult {
  provider: "arkesel" | "hubtel";
  messageId: string;
}

/**
 * Send SMS with automatic fallback: Arkesel → Hubtel.
 */
export async function sendSms(
  to: string,
  message: string
): Promise<SmsResult> {
  try {
    const messageId = await sendArkesel({ to, message });
    return { provider: "arkesel", messageId };
  } catch (arkeselError) {
    console.error("Arkesel SMS failed, falling back to Hubtel:", arkeselError);
    try {
      const messageId = await sendHubtelSms({ to, message });
      return { provider: "hubtel", messageId };
    } catch (hubtelError) {
      console.error("Hubtel SMS fallback also failed:", hubtelError);
      throw new Error("All SMS providers failed");
    }
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// OTP
// ─────────────────────────────────────────────────────────────────────────────

export function formatOtpMessage(otp: string): string {
  return `Your TableGH verification code is: ${otp}. Valid for 10 minutes. Do not share this code.`;
}

export function formatBookingConfirmationSms(params: {
  guestName: string;
  restaurantName: string;
  bookingRef: string;
  dateTime: string;
  cancelUrl: string;
}): string {
  return (
    `Hi ${params.guestName}! Your booking at ${params.restaurantName} is confirmed.\n` +
    `Ref: ${params.bookingRef} | ${params.dateTime}\n` +
    `Cancel: ${params.cancelUrl}`
  );
}
