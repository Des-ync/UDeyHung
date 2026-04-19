/**
 * POST /api/v1/waitlist — Join waitlist for a slot
 * GET  /api/v1/waitlist — List user's waitlist entries
 */

import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import {
  ok,
  created,
  badRequest,
  unauthorized,
  conflict,
  serverError,
  requireAuth,
  isAuthResult,
  parseBody,
} from "@/lib/utils/api";
import { joinWaitlistSchema } from "@/lib/validations";

export async function POST(req: NextRequest) {
  const authResult = await requireAuth();
  if (!isAuthResult(authResult)) return authResult.response;
  const { userId: clerkId } = authResult;

  const body: unknown = await req.json();
  const parsed = parseBody(joinWaitlistSchema, body);
  if (!parsed.success) return parsed.response;

  const { restaurantId, partySize, date, desiredTime } = parsed.data;

  try {
    const user = await db.user.findUnique({ where: { clerkId } });
    if (!user) return unauthorized();

    const restaurant = await db.restaurant.findUnique({
      where: { id: restaurantId, isActive: true },
    });
    if (!restaurant) return badRequest("Restaurant not found");

    // Check if user already has a pending waitlist entry for this slot
    const existing = await db.waitlistEntry.findFirst({
      where: {
        restaurantId,
        userId: user.id,
        date: {
          gte: new Date(date.toISOString().split("T")[0] + "T00:00:00Z"),
          lte: new Date(date.toISOString().split("T")[0] + "T23:59:59Z"),
        },
        status: { in: ["WAITING", "NOTIFIED"] },
      },
    });

    if (existing) {
      return conflict("You already have a waitlist entry for this date");
    }

    const WINDOW = 30; // ±30 minutes
    const entry = await db.waitlistEntry.create({
      data: {
        restaurantId,
        userId: user.id,
        partySize,
        date,
        desiredTime,
        windowStart: Math.max(0, desiredTime - WINDOW),
        windowEnd: Math.min(1439, desiredTime + WINDOW),
        status: "WAITING",
      },
    });

    return created({
      id: entry.id,
      position: await db.waitlistEntry.count({
        where: {
          restaurantId,
          status: "WAITING",
          createdAt: { lte: entry.createdAt },
        },
      }),
      desiredTime: entry.desiredTime,
      date: entry.date,
    });
  } catch (err) {
    console.error("Join waitlist error:", err);
    return serverError();
  }
}

export async function GET(_req: NextRequest) {
  const authResult = await requireAuth();
  if (!isAuthResult(authResult)) return authResult.response;
  const { userId: clerkId } = authResult;

  try {
    const user = await db.user.findUnique({ where: { clerkId } });
    if (!user) return unauthorized();

    const entries = await db.waitlistEntry.findMany({
      where: {
        userId: user.id,
        status: { in: ["WAITING", "NOTIFIED"] },
      },
      orderBy: { createdAt: "desc" },
      include: {
        restaurant: {
          select: { name: true, slug: true, neighborhood: true },
        },
      },
    });

    return ok(entries);
  } catch (err) {
    console.error("List waitlist error:", err);
    return serverError();
  }
}
