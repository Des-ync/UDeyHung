/**
 * PATCH /api/v1/admin/walkin/[id]
 *
 * Update walk-in entry status (SEATED or CANCELLED).
 * Requires restaurant staff/owner auth.
 *
 * Body: { status: "SEATED" | "CANCELLED" }
 */

import { NextRequest } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import {
  ok,
  notFound,
  forbidden,
  serverError,
  requireAuth,
  isAuthResult,
  parseBody,
} from "@/lib/utils/api";
import { sendWalkInReady } from "@/lib/notifications/whatsapp";

const patchSchema = z.object({
  status: z.enum(["SEATED", "CANCELLED"]),
});

async function assertAccess(clerkId: string, restaurantId: string) {
  const user = await db.user.findUnique({
    where: { clerkId },
    include: { staffRoles: { where: { restaurantId } } },
  });
  if (!user) return null;
  if (user.role === "ADMIN" || user.staffRoles.length > 0) return user;
  return null;
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const authResult = await requireAuth();
  if (!isAuthResult(authResult)) return authResult.response;

  const { id } = await params;

  const body: unknown = await req.json();
  const parsed = parseBody(patchSchema, body);
  if (!parsed.success) return parsed.response;

  try {
    const entry = await db.walkInEntry.findUnique({
      where: { id },
      include: {
        restaurant: { select: { id: true, name: true, slug: true } },
      },
    });
    if (!entry) return notFound("Walk-in entry");

    const staffUser = await assertAccess(authResult.userId, entry.restaurantId);
    if (!staffUser) return forbidden();

    const updated = await db.walkInEntry.update({
      where: { id },
      data: {
        status: parsed.data.status,
        seatedAt: parsed.data.status === "SEATED" ? new Date() : undefined,
      },
    });

    // Notify guest via WhatsApp when seated
    if (parsed.data.status === "SEATED") {
      try {
        await sendWalkInReady({
          to: entry.guestPhone,
          guestName: entry.guestName,
          restaurantName: entry.restaurant.name,
          queuePosition: entry.queuePosition,
        });
      } catch (err) {
        console.error("Walk-in seat notification failed:", err);
        // Non-fatal — update succeeded
      }
    }

    return ok({ id: updated.id, status: updated.status });
  } catch (err) {
    console.error("Admin walk-in PATCH error:", err);
    return serverError();
  }
}
