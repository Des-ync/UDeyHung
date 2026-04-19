/**
 * POST   /api/v1/admin/reviews/:id/respond  — post or update a restaurant response
 * DELETE /api/v1/admin/reviews/:id/respond  — remove a restaurant response
 * PATCH  /api/v1/admin/reviews/:id          — moderate review (unflag / hide)
 */

import { NextRequest } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import {
  ok,
  noContent,
  badRequest,
  forbidden,
  notFound,
  serverError,
  requireAuth,
  isAuthResult,
  parseBody,
} from "@/lib/utils/api";

const respondSchema = z.object({
  body: z.string().min(10).max(500),
});

// ─── Shared access guard ──────────────────────────────────────────────────────

async function assertRestaurantAccess(clerkId: string, reviewId: string) {
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

// ─── POST — create or update response ────────────────────────────────────────

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  const authResult = await requireAuth();
  if (!isAuthResult(authResult)) return authResult.response;

  const access = await assertRestaurantAccess(authResult.userId, id);
  if (!access) return forbidden();

  const body: unknown = await req.json();
  const parsed = parseBody(respondSchema, body);
  if (!parsed.success) return parsed.response;

  try {
    const response = await db.reviewResponse.upsert({
      where: { reviewId: id },
      create: {
        reviewId: id,
        authorId: access.user.id,
        body: parsed.data.body,
      },
      update: {
        body: parsed.data.body,
        authorId: access.user.id,
      },
    });

    return ok(response);
  } catch (err) {
    console.error("Review respond error:", err);
    return serverError();
  }
}

// ─── DELETE — remove response ─────────────────────────────────────────────────

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  const authResult = await requireAuth();
  if (!isAuthResult(authResult)) return authResult.response;

  const access = await assertRestaurantAccess(authResult.userId, id);
  if (!access) return forbidden();

  try {
    await db.reviewResponse.delete({ where: { reviewId: id } }).catch(() => {
      // Already deleted — no-op
    });
    return noContent();
  } catch (err) {
    console.error("Delete review response error:", err);
    return serverError();
  }
}
