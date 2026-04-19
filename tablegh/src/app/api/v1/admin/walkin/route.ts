/**
 * GET /api/v1/admin/walkin?restaurantId=[id]
 *
 * Returns the active walk-in queue for a restaurant.
 * Requires restaurant staff/owner auth.
 */

import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import {
  ok,
  badRequest,
  forbidden,
  serverError,
  requireAuth,
  isAuthResult,
} from "@/lib/utils/api";

async function assertAccess(clerkId: string, restaurantId: string) {
  const user = await db.user.findUnique({
    where: { clerkId },
    include: { staffRoles: { where: { restaurantId } } },
  });
  if (!user) return null;
  if (user.role === "ADMIN" || user.staffRoles.length > 0) return user;
  return null;
}

export async function GET(req: NextRequest) {
  const authResult = await requireAuth();
  if (!isAuthResult(authResult)) return authResult.response;

  const restaurantId = req.nextUrl.searchParams.get("restaurantId");
  if (!restaurantId) return badRequest("restaurantId is required");

  const user = await assertAccess(authResult.userId, restaurantId);
  if (!user) return forbidden();

  try {
    const entries = await db.walkInEntry.findMany({
      where: {
        restaurantId,
        status: { in: ["QUEUED", "NOTIFIED"] },
      },
      orderBy: { createdAt: "asc" },
      select: {
        id: true,
        guestName: true,
        partySize: true,
        queuePosition: true,
        estimatedWaitMinutes: true,
        status: true,
        createdAt: true,
      },
    });

    // Recompute live positions (entries ahead may have been seated/cancelled)
    const live = entries.map((e, idx) => ({
      ...e,
      queuePosition: idx + 1,
      createdAt: e.createdAt.toISOString(),
    }));

    return ok(live);
  } catch (err) {
    console.error("Admin walk-in list error:", err);
    return serverError();
  }
}
