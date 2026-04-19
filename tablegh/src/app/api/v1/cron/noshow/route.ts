/**
 * GET /api/v1/cron/noshow
 *
 * Invoked by Vercel Cron every 15 minutes.
 * Automatically marks reservations as NO_SHOW when:
 *   - Status is CONFIRMED or PENDING
 *   - endsAt is in the past (the booking window has closed)
 *   - No-show has not already been recorded
 *
 * Also triggers the no-show penalty logic (rolling 60-day window →
 * requiresDeposit = true after 2+ no-shows).
 *
 * Security: validates Authorization: Bearer <CRON_SECRET>
 */

import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { ReservationStatus } from "@prisma/client";
import { subMinutes } from "date-fns";

function isAuthorised(req: NextRequest): boolean {
  const secret = process.env["CRON_SECRET"];
  if (!secret) return false;
  return req.headers.get("authorization") === `Bearer ${secret}`;
}

async function handleNoShow(userId: string, reservationId: string): Promise<void> {
  const windowStart = new Date(Date.now() - 60 * 24 * 60 * 60 * 1000);

  await db.noShowRecord.create({
    data: { userId, reservationId, rollingWindowStart: windowStart },
  });

  const recentNoShows = await db.noShowRecord.count({
    where: { userId, recordedAt: { gte: windowStart } },
  });

  await db.user.update({
    where: { id: userId },
    data: {
      noShowCount: { increment: 1 },
      requiresDeposit: recentNoShows >= 2,
      noShowWindowStart: recentNoShows === 1 ? windowStart : undefined,
    },
  });
}

export async function GET(req: NextRequest) {
  if (!isAuthorised(req)) {
    return new Response("Unauthorized", { status: 401 });
  }

  // Add a 10-minute grace period after endsAt before marking no-show
  const graceEnd = subMinutes(new Date(), 10);

  try {
    const overdueReservations = await db.reservation.findMany({
      where: {
        status: {
          in: [ReservationStatus.CONFIRMED, ReservationStatus.PENDING],
        },
        endsAt: { lt: graceEnd },
        noShowAt: null,
      },
      select: {
        id: true,
        ref: true,
        userId: true,
        restaurantId: true,
        guestName: true,
        endsAt: true,
      },
    });

    let marked = 0;
    const errors: string[] = [];

    for (const res of overdueReservations) {
      try {
        await db.reservation.update({
          where: { id: res.id },
          data: {
            status: ReservationStatus.NO_SHOW,
            noShowAt: new Date(),
          },
        });

        await handleNoShow(res.userId, res.id);
        marked++;

        console.log(
          `[noshow] Marked ${res.ref} (${res.guestName}) as NO_SHOW`
        );
      } catch (err) {
        const msg = `Failed to mark ${res.ref}: ${String(err)}`;
        console.error(`[noshow] ${msg}`);
        errors.push(msg);
      }
    }

    return Response.json({
      success: true,
      checked: overdueReservations.length,
      marked,
      errors: errors.length > 0 ? errors : undefined,
    });
  } catch (err) {
    console.error("[noshow] Cron error:", err);
    return Response.json({ success: false, error: String(err) }, { status: 500 });
  }
}

export const dynamic = "force-dynamic";
