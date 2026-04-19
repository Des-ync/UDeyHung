/**
 * GET /api/v1/walkin/[id]
 *
 * Returns the current queue position and status for a walk-in entry.
 * No auth required — link is shared with guest after joining.
 *
 * Returns: { id, status, queuePosition, estimatedWaitMinutes, guestName, partySize, restaurantName, restaurantSlug }
 *
 * DELETE /api/v1/walkin/[id]   — guest self-cancels (no auth, just the ID as secret)
 */

import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { ok, notFound, badRequest, serverError } from "@/lib/utils/api";
import { checkIPLimit } from "@/lib/utils/rateLimit";

const AVG_MINS_PER_PARTY = 20;

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  // Rate limit public endpoint to prevent ID enumeration
  const ipLimited = await checkIPLimit(req);
  if (ipLimited) return ipLimited;

  const { id } = await params;

  try {
    const entry = await db.walkInEntry.findUnique({
      where: { id },
      include: {
        restaurant: {
          select: { name: true, slug: true, defaultTurnTime: true },
        },
      },
    });

    if (!entry) return notFound("Queue entry");

    // Recompute live position (entries ahead that are still QUEUED/NOTIFIED)
    let livePosition = entry.queuePosition;
    let liveWait = entry.estimatedWaitMinutes;

    if (entry.status === "QUEUED" || entry.status === "NOTIFIED") {
      const ahead = await db.walkInEntry.count({
        where: {
          restaurantId: entry.restaurantId,
          status: { in: ["QUEUED", "NOTIFIED"] },
          createdAt: { lt: entry.createdAt },
        },
      });
      const turnTime =
        entry.restaurant.defaultTurnTime ?? AVG_MINS_PER_PARTY;
      livePosition = ahead + 1;
      liveWait = ahead * turnTime;
    }

    return ok({
      id: entry.id,
      status: entry.status,
      queuePosition: livePosition,
      estimatedWaitMinutes: liveWait,
      guestName: entry.guestName,
      partySize: entry.partySize,
      restaurantName: entry.restaurant.name,
      restaurantSlug: entry.restaurant.slug,
      createdAt: entry.createdAt,
    });
  } catch (err) {
    console.error("Walk-in GET error:", err);
    return serverError();
  }
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const ipLimited = await checkIPLimit(req);
  if (ipLimited) return ipLimited;

  const { id } = await params;

  try {
    const entry = await db.walkInEntry.findUnique({
      where: { id },
      select: { id: true, status: true },
    });

    if (!entry) return notFound("Queue entry");
    if (entry.status !== "QUEUED" && entry.status !== "NOTIFIED") {
      return badRequest("Cannot cancel — entry is already " + entry.status.toLowerCase());
    }

    await db.walkInEntry.update({
      where: { id },
      data: { status: "CANCELLED" },
    });

    return ok({ cancelled: true });
  } catch (err) {
    console.error("Walk-in DELETE error:", err);
    return serverError();
  }
}
