/**
 * GET /api/v1/admin/dashboard?restaurantId=
 *
 * Returns today's KPI stats and upcoming reservations for the admin overview.
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
import { startOfDay, endOfDay, addDays } from "date-fns";
import { toZonedTime, fromZonedTime } from "date-fns-tz";
import { ACCRA_TZ } from "@/lib/utils/slots";
import { ReservationStatus } from "@prisma/client";

const querySchema = z.object({
  restaurantId: z.string().cuid(),
});

export async function GET(req: NextRequest) {
  const authResult = await requireAuth();
  if (!isAuthResult(authResult)) return authResult.response;
  const { userId: clerkId } = authResult;

  const parsed = querySchema.safeParse(
    Object.fromEntries(req.nextUrl.searchParams)
  );
  if (!parsed.success) return badRequest("restaurantId required");

  const { restaurantId } = parsed.data;

  try {
    const user = await db.user.findUnique({
      where: { clerkId },
      include: { staffRoles: { where: { restaurantId } } },
    });
    if (!user) return unauthorized();
    if (user.role !== "ADMIN" && user.staffRoles.length === 0) return forbidden();

    // Today's window in Africa/Accra time
    const nowAccra = toZonedTime(new Date(), ACCRA_TZ);
    const todayStart = fromZonedTime(startOfDay(nowAccra), ACCRA_TZ);
    const todayEnd = fromZonedTime(endOfDay(nowAccra), ACCRA_TZ);
    const tomorrowEnd = fromZonedTime(endOfDay(addDays(nowAccra, 1)), ACCRA_TZ);

    const [
      restaurant,
      todayReservations,
      pendingCount,
      upcomingReservations,
      activeTableCount,
      totalMenuItems,
    ] = await Promise.all([
      db.restaurant.findUnique({
        where: { id: restaurantId },
        select: {
          id: true,
          name: true,
          isActive: true,
          defaultTurnTime: true,
          ratingAvg: true,
          ratingCount: true,
        },
      }),
      db.reservation.findMany({
        where: {
          restaurantId,
          startsAt: { gte: todayStart, lte: todayEnd },
          status: {
            in: [
              ReservationStatus.CONFIRMED,
              ReservationStatus.SEATED,
              ReservationStatus.COMPLETED,
              ReservationStatus.NO_SHOW,
            ],
          },
        },
        select: { id: true, status: true, partySize: true, guestName: true, timeSlot: true, startsAt: true },
      }),
      db.reservation.count({
        where: {
          restaurantId,
          startsAt: { gte: todayStart, lte: todayEnd },
          status: ReservationStatus.PENDING,
        },
      }),
      // Next 24h reservations for the "upcoming" list
      db.reservation.findMany({
        where: {
          restaurantId,
          startsAt: { gte: new Date(), lte: tomorrowEnd },
          status: {
            in: [ReservationStatus.CONFIRMED, ReservationStatus.PENDING],
          },
        },
        select: {
          id: true,
          ref: true,
          guestName: true,
          partySize: true,
          timeSlot: true,
          startsAt: true,
          status: true,
          occasion: true,
          specialReqs: true,
          table: { select: { label: true } },
        },
        orderBy: { startsAt: "asc" },
        take: 10,
      }),
      db.restaurantTable.count({
        where: { restaurantId, isActive: true },
      }),
      db.menuItem.count({
        where: { restaurantId, isAvailable: true },
      }),
    ]);

    if (!restaurant) return forbidden();

    // Compute today's KPIs
    const confirmed = todayReservations.filter(
      (r) => r.status === ReservationStatus.CONFIRMED
    ).length;
    const seated = todayReservations.filter(
      (r) => r.status === ReservationStatus.SEATED
    ).length;
    const completed = todayReservations.filter(
      (r) => r.status === ReservationStatus.COMPLETED
    ).length;
    const noShows = todayReservations.filter(
      (r) => r.status === ReservationStatus.NO_SHOW
    ).length;
    const totalCovers = todayReservations.reduce(
      (s, r) => s + r.partySize,
      0
    );

    return ok({
      restaurant,
      today: {
        total: todayReservations.length,
        pending: pendingCount,
        confirmed,
        seated,
        completed,
        noShows,
        totalCovers,
      },
      upcoming: upcomingReservations.map((r) => ({
        id: r.id,
        ref: r.ref,
        guestName: r.guestName,
        partySize: r.partySize,
        timeSlot: r.timeSlot,
        startsAt: r.startsAt,
        status: r.status,
        occasion: r.occasion,
        specialReqs: r.specialReqs,
        tableLabel: r.table?.label ?? null,
      })),
      meta: {
        activeTableCount,
        totalMenuItems,
        ratingAvg: Number(restaurant.ratingAvg),
        ratingCount: restaurant.ratingCount,
      },
    });
  } catch (err) {
    console.error("Dashboard error:", err);
    return serverError();
  }
}
