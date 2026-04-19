/**
 * GET /api/v1/admin/reservations?restaurantId=&date=YYYY-MM-DD&view=day|week
 *
 * Returns reservations shaped for the calendar UI.
 * Auth: must be RESTAURANT_OWNER or RESTAURANT_STAFF for this restaurant.
 */

import { NextRequest } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import {
  ok,
  badRequest,
  forbidden,
  unauthorized,
  serverError,
  requireAuth,
  isAuthResult,
} from "@/lib/utils/api";
import { addDays, startOfDay, endOfDay, startOfWeek, endOfWeek } from "date-fns";
import { toZonedTime, fromZonedTime } from "date-fns-tz";
import { ACCRA_TZ } from "@/lib/utils/slots";
import { ReservationStatus } from "@prisma/client";

const querySchema = z.object({
  restaurantId: z.string().cuid(),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  view: z.enum(["day", "week"]).default("day"),
});

export async function GET(req: NextRequest) {
  const authResult = await requireAuth();
  if (!isAuthResult(authResult)) return authResult.response;
  const { userId: clerkId } = authResult;

  const parsed = querySchema.safeParse(
    Object.fromEntries(req.nextUrl.searchParams)
  );
  if (!parsed.success) return badRequest("Invalid query", parsed.error.errors);

  const { restaurantId, date, view } = parsed.data;

  try {
    const user = await db.user.findUnique({
      where: { clerkId },
      include: {
        staffRoles: { where: { restaurantId } },
      },
    });
    if (!user) return unauthorized();

    const canAccess =
      user.role === "ADMIN" || user.staffRoles.length > 0;
    if (!canAccess) return forbidden();

    // Build date range in Africa/Accra timezone
    const anchorLocal = toZonedTime(new Date(date + "T00:00:00Z"), ACCRA_TZ);

    let rangeStart: Date;
    let rangeEnd: Date;

    if (view === "week") {
      // Week: Mon–Sun in Accra time
      rangeStart = fromZonedTime(
        startOfWeek(anchorLocal, { weekStartsOn: 1 }),
        ACCRA_TZ
      );
      rangeEnd = fromZonedTime(
        endOfWeek(anchorLocal, { weekStartsOn: 1 }),
        ACCRA_TZ
      );
    } else {
      rangeStart = fromZonedTime(startOfDay(anchorLocal), ACCRA_TZ);
      rangeEnd = fromZonedTime(endOfDay(anchorLocal), ACCRA_TZ);
    }

    const [reservations, tables] = await Promise.all([
      db.reservation.findMany({
        where: {
          restaurantId,
          startsAt: { gte: rangeStart, lte: rangeEnd },
          status: {
            in: [
              ReservationStatus.PENDING,
              ReservationStatus.CONFIRMED,
              ReservationStatus.SEATED,
              ReservationStatus.COMPLETED,
              ReservationStatus.NO_SHOW,
            ],
          },
        },
        include: {
          table: { select: { id: true, label: true, capacity: true, maxGuests: true } },
          payment: { select: { status: true, amountPesewas: true } },
        },
        orderBy: { startsAt: "asc" },
      }),
      db.restaurantTable.findMany({
        where: { restaurantId, isActive: true },
        orderBy: { label: "asc" },
      }),
    ]);

    return ok({
      reservations: reservations.map((r) => ({
        id: r.id,
        ref: r.ref,
        guestName: r.guestName,
        guestPhone: r.guestPhone,
        partySize: r.partySize,
        date: r.date,
        timeSlot: r.timeSlot,
        startsAt: r.startsAt,
        endsAt: r.endsAt,
        status: r.status,
        occasion: r.occasion,
        specialReqs: r.specialReqs,
        tableId: r.tableId,
        tableLabel: r.table?.label ?? null,
        depositRequired: r.depositRequired,
        depositPaid: r.depositPaid,
        depositPesewas: r.depositPesewas,
        adminNotes: r.adminNotes,
        paymentStatus: r.payment?.status ?? null,
      })),
      tables: tables.map((t) => ({
        id: t.id,
        label: t.label,
        capacity: t.capacity,
        maxGuests: t.maxGuests,
        minGuests: t.minGuests,
      })),
    });
  } catch (err) {
    console.error("Admin reservations error:", err);
    return serverError();
  }
}
