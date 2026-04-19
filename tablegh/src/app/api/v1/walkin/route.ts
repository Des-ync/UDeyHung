/**
 * POST /api/v1/walkin
 *
 * Join the walk-in queue at a restaurant.
 * No auth required — guests provide name + phone at the door.
 *
 * Body: { restaurantId, guestName, guestPhone, partySize }
 * Returns: { id, queuePosition, estimatedWaitMinutes, restaurantName, restaurantSlug }
 */

import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import {
  created,
  badRequest,
  conflict,
  serverError,
  parseBody,
} from "@/lib/utils/api";
import { joinWalkInSchema } from "@/lib/validations";
import { checkIPLimit } from "@/lib/utils/rateLimit";

const AVG_MINS_PER_PARTY = 20; // estimate per queued party ahead

export async function POST(req: NextRequest) {
  const ipLimited = await checkIPLimit(req);
  if (ipLimited) return ipLimited;

  const body: unknown = await req.json();
  const parsed = parseBody(joinWalkInSchema, body);
  if (!parsed.success) return parsed.response;

  const { restaurantId, guestName, guestPhone, partySize } = parsed.data;

  try {
    const restaurant = await db.restaurant.findUnique({
      where: { id: restaurantId, isActive: true, deletedAt: null },
      select: {
        id: true,
        name: true,
        slug: true,
        defaultTurnTime: true,
      },
    });

    if (!restaurant) return badRequest("Restaurant not found");

    // Use a serializable transaction so the duplicate-check + count + create
    // are atomic — prevents two concurrent POSTs from getting the same position.
    const result = await db.$transaction(async (tx) => {
      // Prevent duplicate entries for the same phone in this queue
      const existing = await tx.walkInEntry.findFirst({
        where: {
          restaurantId,
          guestPhone,
          status: { in: ["QUEUED", "NOTIFIED"] },
        },
      });

      if (existing) return { duplicate: true as const };

      // Count active queue length to assign position
      const ahead = await tx.walkInEntry.count({
        where: {
          restaurantId,
          status: { in: ["QUEUED", "NOTIFIED"] },
        },
      });

      const queuePosition = ahead + 1;
      const turnTime = restaurant.defaultTurnTime ?? AVG_MINS_PER_PARTY;
      const estimatedWaitMinutes = ahead * turnTime;

      const entry = await tx.walkInEntry.create({
        data: {
          restaurantId,
          guestName,
          guestPhone,
          partySize,
          queuePosition,
          estimatedWaitMinutes,
          status: "QUEUED",
        },
      });

      return {
        duplicate: false as const,
        entry,
        queuePosition,
        estimatedWaitMinutes,
      };
    });

    if (result.duplicate) {
      return conflict(
        "You are already in the queue. Check your position at your link."
      );
    }

    return created({
      id: result.entry.id,
      queuePosition: result.queuePosition,
      estimatedWaitMinutes: result.estimatedWaitMinutes,
      restaurantName: restaurant.name,
      restaurantSlug: restaurant.slug,
    });
  } catch (err) {
    console.error("Walk-in join error:", err);
    return serverError();
  }
}
