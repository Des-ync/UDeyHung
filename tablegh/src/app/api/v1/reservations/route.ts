/**
 * POST /api/v1/reservations — Create a new reservation
 * GET  /api/v1/reservations — List current user's reservations
 *
 * Double-booking prevention: SELECT ... FOR UPDATE in a transaction on table inventory.
 * Rate limit: 10 bookings/day per phone number.
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
  parseQuery,
  paginate,
} from "@/lib/utils/api";
import {
  createReservationSchema,
  listReservationsSchema,
} from "@/lib/validations";
import {
  generateBookingRef,
  selectBestTable,
  slotToDateTime,
  ACCRA_TZ,
} from "@/lib/utils/slots";
import { sendBookingConfirmation } from "@/lib/notifications/whatsapp";
import { sendSms } from "@/lib/notifications/sms";
import { formatBookingDateTime } from "@/lib/utils/slots";
import { formatGHS } from "@/lib/utils/currency";
import {
  ReservationStatus,
  DayOfWeek,
  TableCapacity,
  Prisma,
} from "@prisma/client";
import { toZonedTime } from "date-fns-tz";
import { addHours, isBefore } from "date-fns";
import { checkIPLimit, checkPhoneBookingLimit } from "@/lib/utils/rateLimit";

const TABLE_CAPACITY_MAP: Record<TableCapacity, number> = {
  TWO: 2,
  FOUR: 4,
  SIX: 6,
  EIGHT: 8,
  LARGE: 12,
};

const DAY_MAP: Record<number, DayOfWeek> = {
  0: DayOfWeek.SUNDAY,
  1: DayOfWeek.MONDAY,
  2: DayOfWeek.TUESDAY,
  3: DayOfWeek.WEDNESDAY,
  4: DayOfWeek.THURSDAY,
  5: DayOfWeek.FRIDAY,
  6: DayOfWeek.SATURDAY,
};

async function sendConfirmationWithFallback(params: {
  to: string;
  guestName: string;
  restaurantName: string;
  bookingRef: string;
  dateTime: string;
  partySize: number;
  address: string;
  mapsUrl: string;
  cancelUrl: string;
}): Promise<{ channel: "WHATSAPP" | "SMS" | "FAILED"; error?: string }> {
  try {
    await sendBookingConfirmation(params);
    return { channel: "WHATSAPP" };
  } catch (waErr) {
    console.warn(
      `[reservations] WhatsApp confirmation failed for ${params.bookingRef}, falling back to SMS:`,
      waErr
    );
    try {
      const message = `TableGH: Booking confirmed at ${params.restaurantName} on ${params.dateTime}. Ref: ${params.bookingRef}`;
      await sendSms(params.to, message);
      return { channel: "SMS" };
    } catch (smsErr) {
      console.error(
        `[reservations] SMS confirmation also failed for ${params.bookingRef}:`,
        smsErr
      );
      return { channel: "FAILED", error: String(smsErr) };
    }
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// POST — Create reservation
// ─────────────────────────────────────────────────────────────────────────────

export async function POST(req: NextRequest) {
  // Rate limits: 100 req/min per IP, 10 bookings/day per phone
  const ipLimited = await checkIPLimit(req);
  if (ipLimited) return ipLimited;

  const authResult = await requireAuth();
  if (!isAuthResult(authResult)) return authResult.response;
  const { userId: clerkId } = authResult;

  const body: unknown = await req.json();
  const parsed = parseBody(createReservationSchema, body);
  if (!parsed.success) return parsed.response;

  const input = parsed.data;

  try {
    // Phone-based booking rate limit (10 per 24h)
    const phoneLimited = await checkPhoneBookingLimit(input.guestPhone);
    if (phoneLimited) return phoneLimited;

    // Resolve user from Clerk ID
    const user = await db.user.findUnique({ where: { clerkId } });
    if (!user) return unauthorized("User profile not found");

    // Resolve restaurant
    const restaurant = await db.restaurant.findUnique({
      where: { id: input.restaurantId, isActive: true, deletedAt: null },
      include: {
        tables: { where: { isActive: true } },
        operatingHours: true,
        blackoutDates: true,
      },
    });
    if (!restaurant) return badRequest("Restaurant not found");

    // Verify the date/slot is valid (re-check — client might be stale)
    const accraDate = toZonedTime(input.date, ACCRA_TZ);
    const dayOfWeek = DAY_MAP[accraDate.getDay()] as DayOfWeek;
    const hours = restaurant.operatingHours.find(
      (h) => h.dayOfWeek === dayOfWeek
    );

    if (!hours || hours.isClosed) {
      return badRequest("Restaurant is closed on the requested date");
    }

    const isBlackout = restaurant.blackoutDates.some((b) => {
      const bDate = new Date(b.date);
      return (
        bDate.getFullYear() === accraDate.getFullYear() &&
        bDate.getMonth() === accraDate.getMonth() &&
        bDate.getDate() === accraDate.getDate()
      );
    });
    if (isBlackout) return badRequest("Restaurant is unavailable on this date");

    // Deposit determination
    const depositRequired =
      restaurant.depositEnabled &&
      restaurant.depositRequiredDays.includes(dayOfWeek);
    const depositAmountPesewas = depositRequired
      ? (restaurant.depositAmountPesewas ?? 0) * input.partySize
      : null;

    // Determine initial status
    const initialStatus: ReservationStatus = depositRequired
      ? ReservationStatus.PENDING
      : ReservationStatus.CONFIRMED;

    // Build DateTime objects for the booking
    const startsAt = slotToDateTime(input.date, input.timeSlot);
    const endsAt = slotToDateTime(
      input.date,
      input.timeSlot + restaurant.defaultTurnTime
    );

    // Transactional reservation creation with double-booking prevention
    const reservation = await db.$transaction(async (tx) => {
      // Lock existing reservations for this date/restaurant
      // Prisma doesn't support SELECT FOR UPDATE natively; use raw SQL
      await tx.$executeRaw`
        SELECT id FROM reservations
        WHERE restaurant_id = ${restaurant.id}
          AND date = ${input.date}::date
          AND status IN ('PENDING', 'CONFIRMED', 'SEATED')
        FOR UPDATE
      `;

      // Re-fetch available tables inside the transaction
      const activeReservations = await tx.reservation.findMany({
        where: {
          restaurantId: restaurant.id,
          date: {
            gte: new Date(
              input.date.toISOString().split("T")[0] + "T00:00:00Z"
            ),
            lte: new Date(
              input.date.toISOString().split("T")[0] + "T23:59:59Z"
            ),
          },
          status: {
            in: [
              ReservationStatus.PENDING,
              ReservationStatus.CONFIRMED,
              ReservationStatus.SEATED,
            ],
          },
          tableId: { not: null },
        },
        select: { tableId: true, timeSlot: true },
      });

      const existingForSlot = activeReservations
        .filter((r): r is { tableId: string; timeSlot: number } => r.tableId !== null)
        .map((r) => ({
          tableId: r.tableId,
          timeSlot: r.timeSlot,
          turnTime: restaurant.defaultTurnTime,
        }));

      const slotEnd = input.timeSlot + restaurant.defaultTurnTime;

      const occupiedTableIds = new Set(
        existingForSlot
          .filter((r) => {
            const resEnd = r.timeSlot + r.turnTime;
            return input.timeSlot < resEnd && slotEnd > r.timeSlot;
          })
          .map((r) => r.tableId)
      );

      const availableTables = restaurant.tables
        .filter((t) => !occupiedTableIds.has(t.id))
        .map((t) => ({
          id: t.id,
          capacity: TABLE_CAPACITY_MAP[t.capacity] ?? 4,
          maxGuests: t.maxGuests,
          minGuests: t.minGuests,
        }));

      const selectedTable = selectBestTable(availableTables, input.partySize);
      if (!selectedTable) {
        throw new ConflictError("No tables available for the requested time and party size");
      }

      // Generate unique ref (retry up to 5 times on collision)
      let ref: string;
      let attempt = 0;
      do {
        ref = generateBookingRef();
        const exists = await tx.reservation.findUnique({ where: { ref } });
        if (!exists) break;
        attempt++;
      } while (attempt < 5);

      return tx.reservation.create({
        data: {
          ref: ref!,
          restaurantId: restaurant.id,
          userId: user.id,
          tableId: selectedTable.id,
          partySize: input.partySize,
          date: input.date,
          timeSlot: input.timeSlot,
          startsAt,
          endsAt,
          status: initialStatus,
          occasion: input.occasion,
          specialReqs: input.specialReqs,
          guestName: input.guestName,
          guestPhone: input.guestPhone,
          depositRequired,
          depositPesewas: depositAmountPesewas,
        },
      });
    });

    // Send confirmation notification (async — don't block response)
    if (reservation.status === ReservationStatus.CONFIRMED) {
      const cancelUrl = `${process.env["NEXT_PUBLIC_APP_URL"]}/booking/${reservation.ref}/cancel`;
      const dateTimeStr = formatBookingDateTime(
        reservation.startsAt,
        reservation.timeSlot
      );

      void (async () => {
        const result = await sendConfirmationWithFallback({
          to: reservation.guestPhone,
          guestName: reservation.guestName,
          restaurantName: restaurant.name,
          bookingRef: reservation.ref,
          dateTime: dateTimeStr,
          partySize: reservation.partySize,
          address: restaurant.address,
          mapsUrl: restaurant.googleMapsUrl ?? "",
          cancelUrl,
        });

        // Record notification in DB
        await db.notification
          .create({
            data: {
              userId: user.id,
              restaurantId: restaurant.id,
              reservationId: reservation.id,
              type: "BOOKING_CONFIRMATION",
              channel: result.channel === "SMS" ? "SMS" : "WHATSAPP",
              status: result.channel === "FAILED" ? "FAILED" : "SENT",
              toPhone: reservation.guestPhone,
              templateData: {
                bookingRef: reservation.ref,
                restaurantName: restaurant.name,
                fallbackError: result.error ?? null,
              },
            },
          })
          .catch(console.error);
      })();
    }

    return created({
      id: reservation.id,
      ref: reservation.ref,
      status: reservation.status,
      restaurantName: restaurant.name,
      partySize: reservation.partySize,
      date: reservation.date,
      timeSlot: reservation.timeSlot,
      startsAt: reservation.startsAt,
      depositRequired: reservation.depositRequired,
      depositPesewas: reservation.depositPesewas,
      depositAmountDisplay: reservation.depositPesewas
        ? formatGHS(reservation.depositPesewas)
        : null,
    });
  } catch (err) {
    if (err instanceof ConflictError) return conflict(err.message);
    console.error("Create reservation error:", err);
    return serverError();
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// GET — List reservations
// ─────────────────────────────────────────────────────────────────────────────

export async function GET(req: NextRequest) {
  const authResult = await requireAuth();
  if (!isAuthResult(authResult)) return authResult.response;
  const { userId: clerkId } = authResult;

  const parsed = parseQuery(listReservationsSchema, req);
  if (!parsed.success) return parsed.response;

  const { status, restaurantId, fromDate, toDate, page, limit } = parsed.data;

  try {
    const user = await db.user.findUnique({ where: { clerkId } });
    if (!user) return unauthorized("User profile not found");

    const where: Prisma.ReservationWhereInput = { userId: user.id };
    if (status) where["status"] = status;
    if (restaurantId) where["restaurantId"] = restaurantId;
    if (fromDate) where["date"] = { gte: fromDate };
    if (toDate) {
      where["date"] = {
        ...(typeof where["date"] === "object" ? where["date"] : {}),
        lte: toDate,
      };
    }

    const [reservations, total] = await Promise.all([
      db.reservation.findMany({
        where,
        orderBy: { startsAt: "desc" },
        skip: (page - 1) * limit,
        take: limit,
        include: {
          restaurant: {
            select: {
              id: true,
              name: true,
              slug: true,
              neighborhood: true,
              photos: {
                where: { context: "EXTERIOR" },
                take: 1,
                select: { url: true, thumbnailUrl: true },
              },
            },
          },
          review: { select: { id: true, rating: true } },
          payment: { select: { status: true, amountPesewas: true } },
        },
      }),
      db.reservation.count({ where }),
    ]);

    return ok(paginate(reservations, total, page, limit));
  } catch (err) {
    console.error("List reservations error:", err);
    return serverError();
  }
}

class ConflictError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ConflictError";
  }
}
