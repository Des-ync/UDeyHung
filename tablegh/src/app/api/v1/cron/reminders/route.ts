/**
 * GET /api/v1/cron/reminders
 *
 * Invoked by Vercel Cron every 15 minutes.
 * Sends WhatsApp reminders for:
 *   - 24h window: bookings starting between now+23h and now+24h (reminder not yet sent)
 *   - 2h  window: bookings starting between now+1h50m and now+2h10m (reminder not yet sent)
 *
 * Falls back to SMS (Arkesel) if WhatsApp fails.
 *
 * Security: validates Authorization: Bearer <CRON_SECRET>
 */

import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { sendBookingReminder } from "@/lib/notifications/whatsapp";
import { sendSms } from "@/lib/notifications/sms";
import { formatBookingDateTime } from "@/lib/utils/slots";
import { addHours, addMinutes, subMinutes } from "date-fns";

// ─── Auth ─────────────────────────────────────────────────────────────────────

function isAuthorised(req: NextRequest): boolean {
  const secret = process.env["CRON_SECRET"];
  if (!secret) return false; // misconfigured — deny
  const authHeader = req.headers.get("authorization");
  return authHeader === `Bearer ${secret}`;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

interface ReminderResult {
  reservationId: string;
  ref: string;
  channel: "whatsapp" | "sms" | "failed";
  error?: string;
}

async function sendReminder(
  reservationId: string,
  guestPhone: string,
  guestName: string,
  restaurantName: string,
  restaurantAddress: string,
  restaurantMapsUrl: string,
  bookingRef: string,
  startsAt: Date,
  timeSlot: number,
  isLast2Hours: boolean
): Promise<ReminderResult> {
  const dateTime = formatBookingDateTime(startsAt, timeSlot);
  const appUrl = process.env["NEXT_PUBLIC_APP_URL"] ?? "";
  const mapsUrl = restaurantMapsUrl || `${appUrl}/restaurants`;

  try {
    await sendBookingReminder({
      to: guestPhone,
      guestName,
      restaurantName,
      bookingRef,
      dateTime,
      address: restaurantAddress,
      mapsUrl,
      isLast2Hours,
    });
    return { reservationId, ref: bookingRef, channel: "whatsapp" };
  } catch (waErr) {
    console.warn(
      `[reminders] WhatsApp failed for ${bookingRef}, falling back to SMS:`,
      waErr
    );
    // SMS fallback
    try {
      const message = isLast2Hours
        ? `TableGH: Reminder — your table at ${restaurantName} is in ~2 hours (${dateTime}). Ref: ${bookingRef}`
        : `TableGH: Reminder — your table at ${restaurantName} is tomorrow (${dateTime}). Ref: ${bookingRef}`;

      await sendSms(guestPhone, message);
      return { reservationId, ref: bookingRef, channel: "sms" };
    } catch (smsErr) {
      console.error(`[reminders] SMS also failed for ${bookingRef}:`, smsErr);
      return {
        reservationId,
        ref: bookingRef,
        channel: "failed",
        error: String(smsErr),
      };
    }
  }
}

async function processReminderBatch(
  reservations: Array<{
    id: string;
    userId: string;
    restaurantId: string;
    guestPhone: string;
    guestName: string;
    ref: string;
    startsAt: Date;
    timeSlot: number;
    restaurant: { name: string; address: string; googleMapsUrl: string | null };
  }>,
  isLast2Hours: boolean
): Promise<ReminderResult[]> {
  const settled = await Promise.allSettled(
    reservations.map((res) =>
      sendReminder(
        res.id,
        res.guestPhone,
        res.guestName,
        res.restaurant.name,
        res.restaurant.address,
        res.restaurant.googleMapsUrl ?? "",
        res.ref,
        res.startsAt,
        res.timeSlot,
        isLast2Hours
      ).then(async (result) => {
        await db.reservation
          .update({
            where: { id: res.id },
            data: isLast2Hours
              ? { reminder2hSentAt: new Date() }
              : { reminder24hSentAt: new Date() },
          })
          .catch(console.error);

        await db.notification
          .create({
            data: {
              userId: res.userId,
              restaurantId: res.restaurantId,
              reservationId: res.id,
              type: isLast2Hours ? "BOOKING_REMINDER_2H" : "BOOKING_REMINDER_24H",
              channel: result.channel === "sms" ? "SMS" : "WHATSAPP",
              status: result.channel === "failed" ? "FAILED" : "SENT",
              toPhone: res.guestPhone,
              templateData: { bookingRef: res.ref },
            },
          })
          .catch(console.error);

        return result;
      })
    )
  );

  return settled.map((entry, index) => {
    if (entry.status === "fulfilled") return entry.value;
    const failed = reservations[index];
    console.error(`[reminders] send promise failed for ${failed.ref}:`, entry.reason);
    return {
      reservationId: failed.id,
      ref: failed.ref,
      channel: "failed",
      error: String(entry.reason),
    };
  });
}

async function processInChunks<T>(
  items: T[],
  size: number,
  worker: (chunk: T[]) => Promise<ReminderResult[]>
): Promise<ReminderResult[]> {
  const aggregated: ReminderResult[] = [];
  for (let index = 0; index < items.length; index += size) {
    const chunk = items.slice(index, index + size);
    const chunkResults = await worker(chunk);
    aggregated.push(...chunkResults);
  }
  return aggregated;
}

// ─── Handler ──────────────────────────────────────────────────────────────────

export async function GET(req: NextRequest) {
  if (!isAuthorised(req)) {
    return new Response("Unauthorized", { status: 401 });
  }

  const now = new Date();
  const results: ReminderResult[] = [];

  try {
    // ── 24h reminders ──────────────────────────────────────────────────────
    // Window: bookings starting between now+23h and now+25h
    const window24hStart = addHours(now, 23);
    const window24hEnd = addHours(now, 25);

    const due24h = await db.reservation.findMany({
      where: {
        startsAt: { gte: window24hStart, lte: window24hEnd },
        status: { in: ["CONFIRMED", "PENDING"] },
        reminder24hSentAt: null,
      },
      include: {
        restaurant: {
          select: {
            name: true,
            address: true,
            googleMapsUrl: true,
          },
        },
      },
    });

    const results24h = await processInChunks(due24h, 10, (chunk) =>
      processReminderBatch(chunk, false)
    );
    results.push(...results24h);

    // ── 2h reminders ───────────────────────────────────────────────────────
    // Window: bookings starting between now+1h50m and now+2h10m
    const window2hStart = subMinutes(addHours(now, 2), 10);
    const window2hEnd = addMinutes(addHours(now, 2), 10);

    const due2h = await db.reservation.findMany({
      where: {
        startsAt: { gte: window2hStart, lte: window2hEnd },
        status: { in: ["CONFIRMED", "PENDING"] },
        reminder2hSentAt: null,
      },
      include: {
        restaurant: {
          select: {
            name: true,
            address: true,
            googleMapsUrl: true,
          },
        },
      },
    });

    const results2h = await processInChunks(due2h, 10, (chunk) =>
      processReminderBatch(chunk, true)
    );
    results.push(...results2h);

    console.log(
      `[reminders] Sent ${due24h.length} 24h + ${due2h.length} 2h reminders.`
    );

    return Response.json({
      success: true,
      sent24h: due24h.length,
      sent2h: due2h.length,
      results,
    });
  } catch (err) {
    console.error("[reminders] Cron error:", err);
    return Response.json({ success: false, error: String(err) }, { status: 500 });
  }
}

// Vercel Cron requires this to be a dynamic route
export const dynamic = "force-dynamic";
