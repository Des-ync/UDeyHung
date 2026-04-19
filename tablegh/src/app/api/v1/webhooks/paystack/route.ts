/**
 * POST /api/v1/webhooks/paystack
 * Handles Paystack webhook events.
 * Events processed: charge.success, charge.failed, transfer.reversed
 *
 * Security: verify HMAC-SHA512 signature on every request.
 * This route must be excluded from CSRF protection (raw body needed for signature).
 */

import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import {
  verifyWebhookSignature,
  type PaystackWebhookEvent,
} from "@/lib/payments/paystack";
import { ReservationStatus } from "@prisma/client";
import { sendBookingConfirmation } from "@/lib/notifications/whatsapp";
import { formatBookingDateTime } from "@/lib/utils/slots";

export async function POST(req: NextRequest) {
  const rawBody = await req.text();
  const signature = req.headers.get("x-paystack-signature") ?? "";

  // Verify signature — reject anything that doesn't match
  let isValid: boolean;
  try {
    isValid = verifyWebhookSignature(rawBody, signature);
  } catch {
    return new NextResponse("Webhook configuration error", { status: 500 });
  }

  if (!isValid) {
    return new NextResponse("Invalid signature", { status: 401 });
  }

  let event: PaystackWebhookEvent;
  try {
    event = JSON.parse(rawBody) as PaystackWebhookEvent;
  } catch {
    return new NextResponse("Invalid JSON", { status: 400 });
  }

  try {
    switch (event.event) {
      case "charge.success":
        await handleChargeSuccess(event);
        break;
      case "charge.failed":
        await handleChargeFailed(event);
        break;
      default:
        // Acknowledge but don't process unhandled events
        break;
    }
  } catch (err) {
    console.error("Paystack webhook processing error:", err);
    // Return 200 to prevent Paystack retrying — log for manual review
  }

  return new NextResponse("OK", { status: 200 });
}

async function handleChargeSuccess(event: PaystackWebhookEvent): Promise<void> {
  const { reference, amount, metadata } = event.data;

  const payment = await db.payment.findUnique({ where: { providerRef: reference } });
  if (!payment) {
    console.warn(`Paystack webhook: unknown reference ${reference}`);
    return;
  }

  // Idempotency: skip if already processed
  if (payment.status === "SUCCESS") return;

  await db.$transaction(async (tx) => {
    await tx.payment.update({
      where: { providerRef: reference },
      data: {
        status: "SUCCESS",
        providerPayload: event as unknown as Record<string, unknown>,
      },
    });

    await tx.reservation.update({
      where: { id: payment.reservationId },
      data: {
        depositPaid: true,
        status: ReservationStatus.CONFIRMED,
      },
    });
  });

  // Send WhatsApp confirmation now that payment is confirmed
  const reservation = await db.reservation.findUnique({
    where: { id: payment.reservationId },
    include: {
      restaurant: { select: { name: true, address: true, googleMapsUrl: true } },
    },
  });

  if (!reservation) return;

  const cancelUrl = `${process.env["NEXT_PUBLIC_APP_URL"]}/booking/${reservation.ref}/cancel`;
  const dateTimeStr = formatBookingDateTime(
    reservation.startsAt,
    reservation.timeSlot
  );

  await sendBookingConfirmation({
    to: reservation.guestPhone,
    guestName: reservation.guestName,
    restaurantName: reservation.restaurant.name,
    bookingRef: reservation.ref,
    dateTime: dateTimeStr,
    partySize: reservation.partySize,
    address: reservation.restaurant.address,
    mapsUrl: reservation.restaurant.googleMapsUrl ?? "",
    cancelUrl,
  }).catch(console.error);
}

async function handleChargeFailed(event: PaystackWebhookEvent): Promise<void> {
  const { reference } = event.data;

  await db.payment.update({
    where: { providerRef: reference },
    data: {
      status: "FAILED",
      providerPayload: event as unknown as Record<string, unknown>,
    },
  }).catch(console.error);
}
