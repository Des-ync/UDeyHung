/**
 * GET /api/v1/me
 *
 * Returns the authenticated diner's profile:
 *   - name, phone, email, loyaltyPoints
 *   - last 20 reservations with restaurant snapshot + review status
 *   - 5 recent points transactions
 *   - saved (favorited) restaurants (first 12)
 */

import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import {
  ok,
  unauthorized,
  serverError,
  requireAuth,
  isAuthResult,
} from "@/lib/utils/api";
import { ReservationStatus } from "@prisma/client";

export async function GET(_req: NextRequest) {
  const authResult = await requireAuth();
  if (!isAuthResult(authResult)) return authResult.response;
  const { userId: clerkId } = authResult;

  try {
    const user = await db.user.findUnique({
      where: { clerkId, deletedAt: null },
      select: {
        id: true,
        name: true,
        phone: true,
        email: true,
        loyaltyPoints: true,
        noShowCount: true,
        requiresDeposit: true,
        createdAt: true,
      },
    });
    if (!user) return unauthorized();

    const [reservations, pointsHistory, favorites] = await Promise.all([
      db.reservation.findMany({
        where: { userId: user.id },
        orderBy: { startsAt: "desc" },
        take: 20,
        select: {
          id: true,
          ref: true,
          status: true,
          partySize: true,
          date: true,
          timeSlot: true,
          startsAt: true,
          occasion: true,
          depositRequired: true,
          depositPaid: true,
          restaurant: {
            select: {
              id: true,
              slug: true,
              name: true,
              neighborhood: true,
              photos: {
                where: { context: "EXTERIOR" },
                take: 1,
                select: { thumbnailUrl: true, url: true },
              },
            },
          },
          review: { select: { id: true, rating: true } },
        },
      }),
      db.pointsTransaction.findMany({
        where: { userId: user.id },
        orderBy: { createdAt: "desc" },
        take: 5,
        select: {
          id: true,
          points: true,
          description: true,
          createdAt: true,
        },
      }),
      db.favorite.findMany({
        where: { userId: user.id },
        orderBy: { createdAt: "desc" },
        take: 12,
        select: {
          id: true,
          restaurantId: true,
          restaurant: {
            select: {
              id: true,
              slug: true,
              name: true,
              neighborhood: true,
              priceLevel: true,
              cuisineTags: true,
              ratingAvg: true,
              ratingCount: true,
              photos: {
                where: { context: "EXTERIOR" },
                take: 1,
                select: { thumbnailUrl: true, url: true },
              },
            },
          },
        },
      }),
    ]);

    // Loyalty tier: Bronze 0–99, Silver 100–499, Gold 500+
    const tier =
      user.loyaltyPoints >= 500
        ? "GOLD"
        : user.loyaltyPoints >= 100
          ? "SILVER"
          : "BRONZE";

    const nextTierPoints =
      user.loyaltyPoints >= 500 ? null : user.loyaltyPoints >= 100 ? 500 : 100;

    return ok({
      user: {
        ...user,
        tier,
        nextTierPoints,
        pointsToNextTier: nextTierPoints
          ? nextTierPoints - user.loyaltyPoints
          : 0,
      },
      reservations: reservations.map((r) => ({
        ...r,
        canRebook:
          r.status === ReservationStatus.COMPLETED ||
          r.status === ReservationStatus.CANCELLED_DINER ||
          r.status === ReservationStatus.CANCELLED_VENUE ||
          r.status === ReservationStatus.NO_SHOW,
        canReview:
          r.status === ReservationStatus.COMPLETED && !r.review,
      })),
      pointsHistory,
      favorites: favorites.map((f) => ({
        ...f.restaurant,
        ratingAvg: Number(f.restaurant.ratingAvg),
        savedAt: f,
      })),
    });
  } catch (err) {
    console.error("GET /me error:", err);
    return serverError();
  }
}
