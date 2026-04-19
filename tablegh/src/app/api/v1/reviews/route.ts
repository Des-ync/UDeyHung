/**
 * POST /api/v1/reviews — Submit a review for a completed reservation.
 *
 * Rules:
 *  - Must be authenticated
 *  - reservation must belong to the calling user
 *  - reservation must be COMPLETED (verified diner)
 *  - one review per reservation (enforced by unique FK + DB-level @unique)
 *  - Rating 1–5, body optional (max 1000 chars)
 *  - After creation, update restaurant's denormalized ratingAvg + ratingCount
 */

import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import {
  created,
  badRequest,
  conflict,
  unauthorized,
  forbidden,
  serverError,
  requireAuth,
  isAuthResult,
  parseBody,
} from "@/lib/utils/api";
import { createReviewSchema } from "@/lib/validations";
import { ReservationStatus } from "@prisma/client";
import { checkIPLimit } from "@/lib/utils/rateLimit";

export async function POST(req: NextRequest) {
  const ipLimited = await checkIPLimit(req);
  if (ipLimited) return ipLimited;

  const authResult = await requireAuth();
  if (!isAuthResult(authResult)) return authResult.response;
  const { userId: clerkId } = authResult;

  const body: unknown = await req.json();
  const parsed = parseBody(createReviewSchema, body);
  if (!parsed.success) return parsed.response;

  try {
    const user = await db.user.findUnique({ where: { clerkId } });
    if (!user) return unauthorized();

    // Verify reservation belongs to user and is COMPLETED
    const reservation = await db.reservation.findUnique({
      where: { id: parsed.data.reservationId },
      select: {
        id: true,
        userId: true,
        restaurantId: true,
        status: true,
        review: { select: { id: true } },
      },
    });

    if (!reservation) return badRequest("Reservation not found");
    if (reservation.userId !== user.id) return forbidden();
    if (reservation.status !== ReservationStatus.COMPLETED) {
      return badRequest(
        "Reviews can only be submitted for completed reservations"
      );
    }
    if (reservation.review) {
      return conflict("You have already reviewed this reservation");
    }

    const review = await db.$transaction(async (tx) => {
      const r = await tx.review.create({
        data: {
          restaurantId: reservation.restaurantId,
          userId: user.id,
          reservationId: parsed.data.reservationId,
          rating: parsed.data.rating,
          body: parsed.data.body,
          photoUrls: parsed.data.photoUrls ?? [],
          isVerified: true,
        },
        include: {
          user: { select: { id: true, name: true } },
          response: true,
        },
      });

      // Update denormalized rating on Restaurant
      const agg = await tx.review.aggregate({
        where: { restaurantId: reservation.restaurantId, isFlagged: false },
        _avg: { rating: true },
        _count: { rating: true },
      });

      await tx.restaurant.update({
        where: { id: reservation.restaurantId },
        data: {
          ratingAvg: agg._avg.rating ?? 0,
          ratingCount: agg._count.rating,
        },
      });

      return r;
    });

    return created(review);
  } catch (err) {
    console.error("Submit review error:", err);
    return serverError();
  }
}
