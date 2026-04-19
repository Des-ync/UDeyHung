/**
 * PATCH /api/v1/admin/reviews/:id — Moderate a review (unflag, hide).
 */

import { NextRequest } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import {
  ok,
  forbidden,
  notFound,
  serverError,
  requireAuth,
  isAuthResult,
  parseBody,
} from "@/lib/utils/api";

const moderateSchema = z.object({
  isFlagged: z.boolean().optional(),
  // Soft-hide without deleting (add field to schema if needed; use flagReason="HIDDEN" as proxy)
  hide: z.boolean().optional(),
});

async function assertAccess(clerkId: string, reviewId: string) {
  const user = await db.user.findUnique({ where: { clerkId } });
  if (!user) return null;

  const review = await db.review.findUnique({
    where: { id: reviewId },
    select: { id: true, restaurantId: true },
  });
  if (!review) return null;

  if (user.role === "ADMIN") return { user, review };

  const staff = await db.restaurantStaff.findUnique({
    where: {
      userId_restaurantId: {
        userId: user.id,
        restaurantId: review.restaurantId,
      },
    },
  });
  return staff ? { user, review } : null;
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  const authResult = await requireAuth();
  if (!isAuthResult(authResult)) return authResult.response;

  const access = await assertAccess(authResult.userId, id);
  if (!access) return forbidden();

  const review = await db.review.findUnique({ where: { id } });
  if (!review) return notFound("Review");

  const body: unknown = await req.json();
  const parsed = parseBody(moderateSchema, body);
  if (!parsed.success) return parsed.response;

  try {
    const updateData: Record<string, unknown> = {};

    if (parsed.data.isFlagged !== undefined) {
      updateData["isFlagged"] = parsed.data.isFlagged;
      if (!parsed.data.isFlagged) {
        updateData["flagReason"] = null; // clear flag reason on unflag
      }
    }
    if (parsed.data.hide) {
      updateData["isFlagged"] = true;
      updateData["flagReason"] = "HIDDEN";
    }

    const updated = await db.review.update({ where: { id }, data: updateData });

    // Re-compute restaurant rating if flag status changed
    if (parsed.data.isFlagged !== undefined || parsed.data.hide !== undefined) {
      const agg = await db.review.aggregate({
        where: { restaurantId: review.restaurantId, isFlagged: false },
        _avg: { rating: true },
        _count: { rating: true },
      });
      await db.restaurant.update({
        where: { id: review.restaurantId },
        data: {
          ratingAvg: agg._avg.rating ?? 0,
          ratingCount: agg._count.rating,
        },
      });
    }

    return ok(updated);
  } catch (err) {
    console.error("Moderate review error:", err);
    return serverError();
  }
}
