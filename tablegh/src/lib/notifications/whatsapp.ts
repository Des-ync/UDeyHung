/**
 * WhatsApp Business Cloud API integration.
 * Primary notification channel — ~90% penetration in Ghana.
 * Uses Meta's template message API (approved templates required for outbound).
 *
 * Docs: https://developers.facebook.com/docs/whatsapp/cloud-api/messages/template-messages
 */

import { formatBookingDateTime } from "@/lib/utils/slots";
import { formatGHS } from "@/lib/utils/currency";

const WA_API_BASE = "https://graph.facebook.com/v20.0";

interface WhatsAppTextComponent {
  type: "text";
  text: string;
}

interface WhatsAppHeaderComponent {
  type: "header";
  parameters: WhatsAppTextComponent[];
}

interface WhatsAppBodyComponent {
  type: "body";
  parameters: WhatsAppTextComponent[];
}

interface WhatsAppButtonComponent {
  type: "button";
  sub_type: "url" | "quick_reply";
  index: string;
  parameters: WhatsAppTextComponent[];
}

type WhatsAppComponent =
  | WhatsAppHeaderComponent
  | WhatsAppBodyComponent
  | WhatsAppButtonComponent;

interface TemplateMessage {
  to: string; // E.164 without + prefix (WhatsApp expects this)
  template: string;
  language: string;
  components: WhatsAppComponent[];
}

interface WhatsAppApiError {
  error: {
    message: string;
    type: string;
    code: number;
    fbtrace_id: string;
  };
}

interface WhatsAppApiSuccess {
  messaging_product: "whatsapp";
  messages: Array<{ id: string }>;
}

type WhatsAppApiResponse = WhatsAppApiSuccess | WhatsAppApiError;

function isError(r: WhatsAppApiResponse): r is WhatsAppApiError {
  return "error" in r;
}

/**
 * Send a WhatsApp template message.
 * Returns the WhatsApp message ID on success.
 */
async function sendTemplate(msg: TemplateMessage): Promise<string> {
  const phoneId = process.env["WHATSAPP_PHONE_NUMBER_ID"];
  const token = process.env["WHATSAPP_ACCESS_TOKEN"];

  if (!phoneId || !token) {
    throw new Error("WhatsApp credentials not configured");
  }

  // WhatsApp expects numbers without the '+' prefix
  const toFormatted = msg.to.startsWith("+") ? msg.to.slice(1) : msg.to;

  const response = await fetch(`${WA_API_BASE}/${phoneId}/messages`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      messaging_product: "whatsapp",
      recipient_type: "individual",
      to: toFormatted,
      type: "template",
      template: {
        name: msg.template,
        language: { code: msg.language },
        components: msg.components,
      },
    }),
  });

  const data: WhatsAppApiResponse = (await response.json()) as WhatsAppApiResponse;

  if (!response.ok || isError(data)) {
    const errMsg = isError(data)
      ? data.error.message
      : `HTTP ${response.status}`;
    throw new Error(`WhatsApp API error: ${errMsg}`);
  }

  return data.messages[0]?.id ?? "unknown";
}

// ─────────────────────────────────────────────────────────────────────────────
// Template senders
// ─────────────────────────────────────────────────────────────────────────────

export interface BookingConfirmationParams {
  to: string; // +233XXXXXXXXX
  guestName: string;
  restaurantName: string;
  bookingRef: string; // TGH-XXXXXX
  dateTime: string; // "25/12/2025 at 7:30 PM"
  partySize: number;
  address: string;
  mapsUrl: string;
  cancelUrl: string;
}

export async function sendBookingConfirmation(
  params: BookingConfirmationParams
): Promise<string> {
  const template =
    process.env["WHATSAPP_TEMPLATE_BOOKING_CONFIRMATION"] ??
    "booking_confirmation_v1";

  return sendTemplate({
    to: params.to,
    template,
    language: "en",
    components: [
      {
        type: "header",
        parameters: [{ type: "text", text: params.restaurantName }],
      },
      {
        type: "body",
        parameters: [
          { type: "text", text: params.guestName },
          { type: "text", text: params.bookingRef },
          { type: "text", text: params.dateTime },
          { type: "text", text: String(params.partySize) },
          { type: "text", text: params.address },
        ],
      },
      {
        type: "button",
        sub_type: "url",
        index: "0",
        parameters: [{ type: "text", text: params.cancelUrl }],
      },
    ],
  });
}

export interface BookingReminderParams {
  to: string;
  guestName: string;
  restaurantName: string;
  bookingRef: string;
  dateTime: string;
  address: string;
  mapsUrl: string;
  isLast2Hours: boolean; // true = 2h reminder, false = 24h reminder
}

export async function sendBookingReminder(
  params: BookingReminderParams
): Promise<string> {
  const templateEnvKey = params.isLast2Hours
    ? "WHATSAPP_TEMPLATE_REMINDER_2H"
    : "WHATSAPP_TEMPLATE_REMINDER_24H";
  const template =
    process.env[templateEnvKey] ??
    (params.isLast2Hours ? "booking_reminder_2h_v1" : "booking_reminder_24h_v1");

  return sendTemplate({
    to: params.to,
    template,
    language: "en",
    components: [
      {
        type: "body",
        parameters: [
          { type: "text", text: params.guestName },
          { type: "text", text: params.restaurantName },
          { type: "text", text: params.dateTime },
          { type: "text", text: params.address },
          { type: "text", text: params.bookingRef },
        ],
      },
      {
        type: "button",
        sub_type: "url",
        index: "0",
        parameters: [{ type: "text", text: params.mapsUrl }],
      },
    ],
  });
}

export interface WaitlistAvailableParams {
  to: string;
  guestName: string;
  restaurantName: string;
  dateTime: string;
  claimUrl: string;
  expiryMinutes: number; // 15
}

export async function sendWaitlistAvailable(
  params: WaitlistAvailableParams
): Promise<string> {
  const template =
    process.env["WHATSAPP_TEMPLATE_WAITLIST_AVAILABLE"] ??
    "waitlist_available_v1";

  return sendTemplate({
    to: params.to,
    template,
    language: "en",
    components: [
      {
        type: "body",
        parameters: [
          { type: "text", text: params.guestName },
          { type: "text", text: params.restaurantName },
          { type: "text", text: params.dateTime },
          { type: "text", text: String(params.expiryMinutes) },
        ],
      },
      {
        type: "button",
        sub_type: "url",
        index: "0",
        parameters: [{ type: "text", text: params.claimUrl }],
      },
    ],
  });
}

export interface WalkInReadyParams {
  to: string;
  guestName: string;
  restaurantName: string;
  queuePosition: number;
}

export async function sendWalkInReady(
  params: WalkInReadyParams
): Promise<string> {
  const template =
    process.env["WHATSAPP_TEMPLATE_WALKIN_READY"] ?? "walkin_ready_v1";

  return sendTemplate({
    to: params.to,
    template,
    language: "en",
    components: [
      {
        type: "body",
        parameters: [
          { type: "text", text: params.guestName },
          { type: "text", text: params.restaurantName },
        ],
      },
    ],
  });
}
