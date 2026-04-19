/**
 * GET    /api/v1/reservations/:ref — Get reservation detail
 * PATCH  /api/v1/reservations/:ref — Modify reservation (up to 2h before)
 * DELETE /api/v1/reservations/:ref — Cancel reservation (up to 2h before)
 */

import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import {
  ok,
  noContent,
  badRequest,
  unauthorized,
  forbidden,
  notFound,
  serverError,
  requireAuth,
  isAuthResult,
  parseBody,
} from "@/lib/utils/api";
import {
  modifyReservationSchema,
  cancelReservationSchema,
} from "@/lib/validations";
import { slotToDateTime, generateBookingRef } from "@/lib/utils/slots";
import { ReservationStatus, DayOfWeek, TableCapacity } from "@prisma/client";
import { isBefore, addHours } from "date-fns";

const TABLE_CAPACITY_MAP: Record<TableCapacity, number> = {
  TWO: 2,
  FOUR: 4,
  SIX: 6,
  EIGHT: 8,
  LARGE: 12,
};

// 2 hours before booking = last point to cancel/modify without penalty
const CANCEL_CUTOFF_HOURS = 2;

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ ref: string }> }
) {
  const { ref } = await params;
  const authResult = await requireAuth();
  if (!isAuthResult(authResult)) return authResult.response;
  const { userId: clerkId } = authResult;

  try {
    const user = await db.user.findUnique({ where: { clerkId } });
    if (!user) return unauthorized();

    const reservation = await db.reservation.findUnique({
      where: { ref },
      include: {
        restaurant: {
          select: {
            name: true,
            address: true,
            phone: true,
            googleMapsUrl: true,
            photos: { where: { context: "EXTERIOR" }, take: 1 },
          },
        },
        payment: true,
        review: { select: { id: true } },
      },
    });

    if (!reservation) return notFound("Reservation");
    if (reservation.userId !== user.id) return forbidden();

    return ok(reservation);
  } catch (err) {
    console.error("Get reservation error:", err);
    return serverError();
  }
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ ref: string }> }
) {
  const { ref } = await params;
  const authResult = await requireAuth();
  if (!isAuthResult(authResult)) return authResult.response;
  const { userId: clerkId } = authResult;

  const body: unknown = await req.json();
  const parsed = parseBody(modifyReservationSchema, body);
  if (!parsed.success) return parsed.response;

  try {
    const user = await db.user.findUnique({ where: { clerkId } });
    if (!user) return unauthorized();

    const reservation = await db.reservation.findUnique({
      where: { ref },
      include: {
        restaurant: {
          include: {
            tables: { where: { isActive: true } },
            operatingHours: true,
          },
        },
      },
    });

    if (!reservation) return notFound("Reservation");
    if (reservation.userId !== user.id) return forbidden();

    if (
      !["PENDING", "CONFIRMED"].includes(reservation.status as string)
    ) {
      return badRequest("Only pending or confirmed reservations can be modified");
    }

    // Check 2h cutoff
    const cutoff = addHours(reservation.startsAt, -CANCEL_CUTOFF_HOURS);
    if (!isBefore(new Date(), cutoff)) {
      return badRequest("Reservations can only be modified up to 2 hours before the booking time");
    }

    const updated = await db.reservation.update({
      where: { ref },
      data: {
        ...(parsed.data.partySize !== undefined && {
          partySize: parsed.data.partySize,
        }),
        ...(parsed.data.date !== undefined && { date: parsed.data.date }),
        ...(parsed.data.timeSlot !== undefined && {
          timeSlot: parsed.data.timeSlot,
          startsAt: slotToDateTime(
            parsed.data.date ?? reservation.date,
            parsed.data.timeSlot
          ),
          endsAt: slotToDateTime(
            parsed.data.date ?? reservation.date,
            (parsed.data.timeSlot ?? reservation.timeSlot) +
              reservation.restaurant.defaultTurnTime
          ),
        }),
        ...(parsed.data.occasion !== undefined && {
          occasion: parsed.data.occasion,
        }),
        ...(parsed.data.specialReqs !== undefined && {
          specialReqs: parsed.data.specialReqs,
        }),
        modifiedAt: new Date(),
      },
    });

    return ok(updated);
  } catch (err) {
    console.error("Modify reservation error:", err);
    return serverError();
  }
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ ref: string }> }
) {
  const { ref } = await params;
  const authResult = await requireAuth();
  if (!isAuthResult(authResult)) return authResult.response;
  const { userId: clerkId } = authResult;

  const body: unknown = await req.json().catch(() => ({}));
  const parsed = parseBody(cancelReservationSchema, body);
  if (!parsed.success) return parsed.response;

  try {
    const user = await db.user.findUnique({ where: { clerkId } });
    if (!user) return unauthorized();

    const reservation = await db.reservation.findUnique({
      where: { ref },
      include: {
        payment: true,
        restaurant: { select: { name: true, depositRefundHours: true } },
      },
    });

    if (!reservation) return notFound("Reservation");
    if (reservation.userId !== user.id) return forbidden();

    if (
      ["CANCELLED_DINER", "CANCELLED_VENUE", "COMPLETED", "NO_SHOW"].includes(
        reservation.status as string
      )
    ) {
      return badRequest("Reservation is already cancelled or completed");
    }

    const cutoff = addHours(
      reservation.startsAt,
      -(reservation.restaurant.depositRefundHours ?? CANCEL_CUTOFF_HOURS)
    );
    const isRefundable = isBefore(new Date(), cutoff);

    await db.reservation.update({
      where: { ref },
      data: {
        status: ReservationStatus.CANCELLED_DINER,
        cancelledAt: new Date(),
        cancelReason: parsed.data.reason,
      },
    });

    // Trigger deposit refund if applicable
    if (
      reservation.depositPaid &&
      reservation.payment &&
      isRefundable
    ) {
      // Import refund lazily to avoid circular deps
      const { refundTransaction } = await import("@/lib/payments/paystack");
      await refundTransaction(
        reservation.payment.providerRef,
        reservation.depositPesewas ?? undefined
      ).catch((err) => console.error("Refund failed:", err));
    }

    // Notify waitlist when a slot opens up
    notifyWaitlist(reservation.restaurantId, reservation.date, reservation.timeSlot)
      .catch(console.error);

    return noContent();
  } catch (err) {
    console.error("Cancel reservation error:", err);
    return serverError();
  }
}

/**
 * After a cancellation, check if anyone is on the waitlist for a compatible slot
 * and send them a WhatsApp notification with a 15-min claim window.
 */
async function notifyWaitlist(
  restaurantId: string,
  date: Date,
  cancelledTimeSlot: number
): Promise<void> {
  const WINDOW = 30; // ±30 minutes

  const nextWaiting = await db.waitlistEntry.findFirst({
    where: {
      restaurantId,
      date: {
        gte: new Date(date.toISOString().split("T")[0] + "T00:00:00Z"),
        lte: new Date(date.toISOString().split("T")[0] + "T23:59:59Z"),
      },
      status: "WAITING",
      windowStart: { lte: cancelledTimeSlot },
      windowEnd: { gte: cancelledTimeSlot },
    },
    orderBy: { createdAt: "asc" },
    include: { user: true },
  });

  if (!nextWaiting) return;

  const claimExpiry = new Date(Date.now() + 15 * 60 * 1000);

  await db.waitlistEntry.update({
    where: { id: nextWaiting.id },
    data: {
      status: "NOTIFIED",
      notifiedAt: new Date(),
      claimExpiry,
    },
  });

  const { sendWaitlistAvailable } = await import(
    "@/lib/notifications/whatsapp"
  );
  const restaurant = await db.restaurant.findUnique({
    where: { id: restaurantId },
    select: { name: true },
  });

  const { minutesToDisplay, formatDateGH } = await import("@/lib/utils/slots");

  await sendWaitlistAvailable({
    to: nextWaiting.user.phone,
    guestName: nextWaiting.user.name,
    restaurantName: restaurant?.name ?? "restaurant",
    dateTime: `${formatDateGH(date)} at ${minutesToDisplay(cancelledTimeSlot)}`,
    claimUrl: `${process.env["NEXT_PUBLIC_APP_URL"]}/waitlist/${nextWaiting.id}/claim`,
    expiryMinutes: 15,
  }).catch(console.error);
}
