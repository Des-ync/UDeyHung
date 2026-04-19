/**
 * PATCH /api/v1/admin/reservations/:id
 * Allows admin to: reassign table, change status, add admin notes.
 * This is the drag-to-reassign endpoint.
 */

import { NextRequest } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import {
  ok,
  badRequest,
  forbidden,
  unauthorized,
  notFound,
  serverError,
  requireAuth,
  isAuthResult,
  parseBody,
} from "@/lib/utils/api";
import { ReservationStatus } from "@prisma/client";

const patchSchema = z.object({
  tableId: z.string().cuid().optional(),
  status: z.nativeEnum(ReservationStatus).optional(),
  adminNotes: z.string().max(500).optional(),
  // Seat a diner (marks SEATED + timestamps)
  seatNow: z.boolean().optional(),
  // Mark no-show
  noShow: z.boolean().optional(),
});

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const authResult = await requireAuth();
  if (!isAuthResult(authResult)) return authResult.response;
  const { userId: clerkId } = authResult;

  const body: unknown = await req.json();
  const parsed = parseBody(patchSchema, body);
  if (!parsed.success) return parsed.response;

  try {
    const user = await db.user.findUnique({ where: { clerkId } });
    if (!user) return unauthorized();

    const reservation = await db.reservation.findUnique({
      where: { id },
      include: { restaurant: { select: { id: true } } },
    });
    if (!reservation) return notFound("Reservation");

    // Verify staff access
    const canAccess =
      user.role === "ADMIN" ||
      (await db.restaurantStaff.findUnique({
        where: {
          userId_restaurantId: {
            userId: user.id,
            restaurantId: reservation.restaurant.id,
          },
        },
      })) !== null;
    if (!canAccess) return forbidden();

    // Validate new table belongs to this restaurant and doesn't conflict
    if (parsed.data.tableId) {
      const table = await db.restaurantTable.findFirst({
        where: {
          id: parsed.data.tableId,
          restaurantId: reservation.restaurant.id,
          isActive: true,
        },
      });
      if (!table) return badRequest("Table not found in this restaurant");

      // Check no other confirmed reservation occupies this table at this slot
      const conflict = await db.reservation.findFirst({
        where: {
          id: { not: id },
          tableId: parsed.data.tableId,
          date: reservation.date,
          status: {
            in: [
              ReservationStatus.PENDING,
              ReservationStatus.CONFIRMED,
              ReservationStatus.SEATED,
            ],
          },
          // Overlap check: existing slot overlaps with [timeSlot, timeSlot+turnTime)
          AND: [
            { timeSlot: { lt: reservation.timeSlot + 90 } }, // approximate turn time
            {
              // end of existing > start of new
              startsAt: { lt: reservation.endsAt },
            },
          ],
        },
      });
      if (conflict) {
        return badRequest(
          `Table is already booked by reservation ${conflict.ref} at this time`
        );
      }
    }

    // Build update payload
    const updateData: Record<string, unknown> = {};

    if (parsed.data.tableId !== undefined) updateData["tableId"] = parsed.data.tableId;
    if (parsed.data.adminNotes !== undefined) updateData["adminNotes"] = parsed.data.adminNotes;

    if (parsed.data.seatNow) {
      updateData["status"] = ReservationStatus.SEATED;
    } else if (parsed.data.noShow) {
      updateData["status"] = ReservationStatus.NO_SHOW;
      updateData["noShowAt"] = new Date();
    } else if (parsed.data.status !== undefined) {
      updateData["status"] = parsed.data.status;
    }

    const updated = await db.reservation.update({
      where: { id },
      data: updateData,
    });

    // Handle no-show tracking
    if (parsed.data.noShow) {
      await handleNoShow(updated.userId, updated.id);
    }

    // If completed, award loyalty points
    if (parsed.data.status === ReservationStatus.COMPLETED) {
      await db.$transaction([
        db.user.update({
          where: { id: updated.userId },
          data: { loyaltyPoints: { increment: 10 } },
        }),
        db.pointsTransaction.create({
          data: {
            userId: updated.userId,
            points: 10,
            description: `Completed booking ${updated.ref}`,
            reservationId: updated.id,
          },
        }),
      ]);
    }

    return ok(updated);
  } catch (err) {
    console.error("Admin patch reservation error:", err);
    return serverError();
  }
}

/**
 * Track no-shows. If 2+ in a 60-day window → requiresDeposit = true.
 */
async function handleNoShow(userId: string, reservationId: string): Promise<void> {
  const windowStart = new Date(Date.now() - 60 * 24 * 60 * 60 * 1000); // 60 days ago

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
