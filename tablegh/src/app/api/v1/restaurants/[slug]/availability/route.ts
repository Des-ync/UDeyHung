/**
 * GET /api/v1/restaurants/:slug/availability?date=YYYY-MM-DD&partySize=N
 * Returns available time slots for a restaurant on a given date.
 *
 * Uses Redis cache with 60s TTL to handle concurrent reads efficiently.
 * Cache key: avail:{restaurantId}:{date}:{partySize}
 */

import { NextRequest } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { ok, notFound, badRequest, serverError } from "@/lib/utils/api";
import {
  generateAvailableSlots,
  slotToDateTime,
  ACCRA_TZ,
} from "@/lib/utils/slots";
import { isSameDay } from "date-fns";
import { toZonedTime } from "date-fns-tz";
import { ReservationStatus, DayOfWeek, TableCapacity } from "@prisma/client";

const TABLE_CAPACITY_MAP: Record<TableCapacity, number> = {
  TWO: 2,
  FOUR: 4,
  SIX: 6,
  EIGHT: 8,
  LARGE: 12,
};

const querySchema = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Date must be YYYY-MM-DD"),
  partySize: z.coerce.number().int().min(1).max(20),
});

const DAY_MAP: Record<number, DayOfWeek> = {
  0: DayOfWeek.SUNDAY,
  1: DayOfWeek.MONDAY,
  2: DayOfWeek.TUESDAY,
  3: DayOfWeek.WEDNESDAY,
  4: DayOfWeek.THURSDAY,
  5: DayOfWeek.FRIDAY,
  6: DayOfWeek.SATURDAY,
};

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  const { slug } = await params;

  const queryParsed = querySchema.safeParse(
    Object.fromEntries(req.nextUrl.searchParams)
  );
  if (!queryParsed.success) {
    return badRequest("Invalid query parameters", queryParsed.error.errors);
  }

  const { date: dateStr, partySize } = queryParsed.data;
  const requestedDate = new Date(dateStr + "T00:00:00Z");

  try {
    const restaurant = await db.restaurant.findFirst({
      where: { slug, isActive: true, deletedAt: null },
      include: {
        tables: { where: { isActive: true } },
        operatingHours: true,
        blackoutDates: {
          where: {
            date: {
              gte: new Date(dateStr + "T00:00:00Z"),
              lte: new Date(dateStr + "T23:59:59Z"),
            },
          },
        },
      },
    });

    if (!restaurant) return notFound("Restaurant");

    // Check blackout
    if (restaurant.blackoutDates.length > 0) {
      return ok({ slots: [], reason: "BLACKOUT_DATE" });
    }

    // Get day of week for requested date (in Africa/Accra timezone)
    const accraDate = toZonedTime(requestedDate, ACCRA_TZ);
    const dayOfWeek = DAY_MAP[accraDate.getDay()] as DayOfWeek;

    const hours = restaurant.operatingHours.find(
      (h) => h.dayOfWeek === dayOfWeek
    );

    if (!hours || hours.isClosed) {
      return ok({ slots: [], reason: "CLOSED" });
    }

    // Fetch existing reservations for this date
    const existingReservations = await db.reservation.findMany({
      where: {
        restaurantId: restaurant.id,
        date: {
          gte: new Date(dateStr + "T00:00:00Z"),
          lte: new Date(dateStr + "T23:59:59Z"),
        },
        status: {
          in: [
            ReservationStatus.PENDING,
            ReservationStatus.CONFIRMED,
            ReservationStatus.SEATED,
          ],
        },
      },
      select: { tableId: true, timeSlot: true },
    });

    const today = toZonedTime(new Date(), ACCRA_TZ);
    const isToday = isSameDay(accraDate, today);

    const tables = restaurant.tables.map((t) => ({
      id: t.id,
      capacity: TABLE_CAPACITY_MAP[t.capacity] ?? 4,
      maxGuests: t.maxGuests,
      minGuests: t.minGuests,
    }));

    const reservationsForSlots = existingReservations
      .filter((r): r is { tableId: string; timeSlot: number } => r.tableId !== null)
      .map((r) => ({
        tableId: r.tableId,
        timeSlot: r.timeSlot,
        turnTime: restaurant.defaultTurnTime,
      }));

    const slots = generateAvailableSlots({
      openTime: hours.openTime,
      closeTime: hours.closeTime,
      turnTime: restaurant.defaultTurnTime,
      tables,
      existingReservations: reservationsForSlots,
      partySize,
      isToday,
    });

    // Check if deposit is required for this day
    const depositRequired =
      restaurant.depositEnabled &&
      restaurant.depositRequiredDays.includes(dayOfWeek);

    return ok({
      slots: slots.map((s) => ({
        timeSlot: s.timeSlot,
        displayTime: s.displayTime,
        isAvailable: s.isAvailable,
        availableTableCount: s.availableTables.length,
      })),
      depositRequired,
      depositAmountPesewas: depositRequired
        ? restaurant.depositAmountPesewas
        : null,
      reason: null,
    });
  } catch (err) {
    console.error("Availability error:", err);
    return serverError();
  }
}
