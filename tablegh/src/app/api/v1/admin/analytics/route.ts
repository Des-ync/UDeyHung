/**
 * GET /api/v1/admin/analytics?restaurantId=&from=YYYY-MM-DD&to=YYYY-MM-DD
 *
 * Returns:
 * - KPI summary (covers, no-show rate, avg party size, deposit revenue)
 * - Covers per day (line chart data)
 * - Peak times heatmap (day-of-week × time-slot matrix)
 * - Top-requested dishes from special requests (naive keyword match)
 * - Status breakdown
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
import { ReservationStatus } from "@prisma/client";
import { minutesToDisplay } from "@/lib/utils/slots";
import { format, eachDayOfInterval, parseISO } from "date-fns";
import { toZonedTime } from "date-fns-tz";
import { ACCRA_TZ } from "@/lib/utils/slots";

const querySchema = z.object({
  restaurantId: z.string().cuid(),
  from: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).default(() => {
    const d = new Date();
    d.setDate(d.getDate() - 29); // last 30 days
    return d.toISOString().split("T")[0]!;
  }),
  to: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).default(() => {
    return new Date().toISOString().split("T")[0]!;
  }),
});

const DAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

export async function GET(req: NextRequest) {
  const authResult = await requireAuth();
  if (!isAuthResult(authResult)) return authResult.response;
  const { userId: clerkId } = authResult;

  const parsed = querySchema.safeParse(
    Object.fromEntries(req.nextUrl.searchParams)
  );
  if (!parsed.success) return badRequest("Invalid query", parsed.error.errors);
  const { restaurantId, from, to } = parsed.data;

  try {
    const user = await db.user.findUnique({
      where: { clerkId },
      include: { staffRoles: { where: { restaurantId } } },
    });
    if (!user) return unauthorized();
    if (user.role !== "ADMIN" && user.staffRoles.length === 0) return forbidden();

    const fromDate = new Date(from + "T00:00:00Z");
    const toDate = new Date(to + "T23:59:59Z");

    // Fetch all reservations in range
    const reservations = await db.reservation.findMany({
      where: {
        restaurantId,
        startsAt: { gte: fromDate, lte: toDate },
      },
      include: {
        payment: { select: { status: true, amountPesewas: true } },
      },
    });

    const completed = reservations.filter((r) =>
      [
        ReservationStatus.CONFIRMED,
        ReservationStatus.SEATED,
        ReservationStatus.COMPLETED,
      ].includes(r.status)
    );
    const noShows = reservations.filter(
      (r) => r.status === ReservationStatus.NO_SHOW
    );
    const cancelled = reservations.filter((r) =>
      [
        ReservationStatus.CANCELLED_DINER,
        ReservationStatus.CANCELLED_VENUE,
      ].includes(r.status)
    );

    // ── KPIs ──────────────────────────────────────────────────────────────────

    const totalCovers = completed.reduce((s, r) => s + r.partySize, 0);
    const avgPartySize =
      completed.length > 0
        ? Math.round((totalCovers / completed.length) * 10) / 10
        : 0;
    const noShowRate =
      reservations.length > 0
        ? Math.round((noShows.length / reservations.length) * 1000) / 10
        : 0;
    const depositRevenuePesewas = reservations
      .filter((r) => r.depositPaid && r.payment?.status === "SUCCESS")
      .reduce((s, r) => s + (r.depositPesewas ?? 0), 0);

    // ── Covers per day ────────────────────────────────────────────────────────

    const coversByDay = new Map<string, number>();
    const days = eachDayOfInterval({ start: parseISO(from), end: parseISO(to) });
    days.forEach((d) => coversByDay.set(format(d, "yyyy-MM-dd"), 0));

    completed.forEach((r) => {
      const day = format(
        toZonedTime(r.startsAt, ACCRA_TZ),
        "yyyy-MM-dd"
      );
      coversByDay.set(day, (coversByDay.get(day) ?? 0) + r.partySize);
    });

    const coversPerDay = Array.from(coversByDay.entries()).map(
      ([date, covers]) => ({ date, covers })
    );

    // ── Peak times heatmap: [dayOfWeek 0-6][slotIndex] = cover count ─────────
    // Days: Mon=0 … Sun=6
    // Slots: 10:00–23:30 in 30-min increments = 28 slots (index 0 = 10:00)

    const HEATMAP_START = 600; // 10:00 AM
    const HEATMAP_END = 1380;  // 11:00 PM
    const SLOT_COUNT = (HEATMAP_END - HEATMAP_START) / 30 + 1; // 33 slots

    // heatmap[dayIndex][slotIndex] = cover count
    const heatmap: number[][] = Array.from({ length: 7 }, () =>
      new Array<number>(SLOT_COUNT).fill(0)
    );

    completed.forEach((r) => {
      const localDate = toZonedTime(r.startsAt, ACCRA_TZ);
      // getDay() returns 0=Sun, 1=Mon…6=Sat — convert to Mon=0
      const rawDay = localDate.getDay();
      const dayIndex = rawDay === 0 ? 6 : rawDay - 1;
      const slotIndex = Math.floor(
        (r.timeSlot - HEATMAP_START) / 30
      );
      if (slotIndex >= 0 && slotIndex < SLOT_COUNT) {
        heatmap[dayIndex]![slotIndex] =
          (heatmap[dayIndex]![slotIndex] ?? 0) + r.partySize;
      }
    });

    // Flatten for client
    const heatmapFlat = heatmap.flatMap((daySlots, dayIndex) =>
      daySlots.map((value, slotIndex) => ({
        day: DAYS[dayIndex] ?? "?",
        dayIndex,
        timeSlot: HEATMAP_START + slotIndex * 30,
        displayTime: minutesToDisplay(HEATMAP_START + slotIndex * 30),
        value,
      }))
    );

    const maxHeatmapValue = Math.max(...heatmapFlat.map((c) => c.value), 1);

    // ── Status breakdown ──────────────────────────────────────────────────────

    const statusCounts: Record<string, number> = {};
    reservations.forEach((r) => {
      statusCounts[r.status] = (statusCounts[r.status] ?? 0) + 1;
    });

    // ── Top party sizes ───────────────────────────────────────────────────────

    const partySizeCounts: Record<number, number> = {};
    completed.forEach((r) => {
      partySizeCounts[r.partySize] =
        (partySizeCounts[r.partySize] ?? 0) + 1;
    });
    const topPartySizes = Object.entries(partySizeCounts)
      .sort((a, b) => Number(b[1]) - Number(a[1]))
      .slice(0, 6)
      .map(([size, count]) => ({ size: Number(size), count }));

    return ok({
      kpis: {
        totalReservations: reservations.length,
        totalCovers,
        avgPartySize,
        noShowRate,
        noShowCount: noShows.length,
        cancelledCount: cancelled.length,
        depositRevenuePesewas,
        fromDate: from,
        toDate: to,
      },
      coversPerDay,
      heatmap: heatmapFlat,
      maxHeatmapValue,
      statusBreakdown: statusCounts,
      topPartySizes,
    });
  } catch (err) {
    console.error("Analytics error:", err);
    return serverError();
  }
}
