/**
 * POST /api/v1/reviews/:id/flag — Flag a review as inappropriate.
 *
 * Any authenticated user may flag. Staff/admin see flagged reviews in the
 * admin panel and can choose to moderate.
 */

import { NextRequest } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import {
  ok,
  notFound,
  badRequest,
  serverError,
  requireAuth,
  isAuthResult,
  parseBody,
} from "@/lib/utils/api";

const flagSchema = z.object({
  reason: z
    .enum(["SPAM", "OFFENSIVE", "FAKE", "OFF_TOPIC", "OTHER"])
    .default("OTHER"),
});

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  const authResult = await requireAuth();
  if (!isAuthResult(authResult)) return authResult.response;

  const body: unknown = await req.json().catch(() => ({}));
  const parsed = parseBody(flagSchema, body);
  if (!parsed.success) return parsed.response;

  try {
    const review = await db.review.findUnique({ where: { id } });
    if (!review) return notFound("Review");
    if (review.isFlagged) return badRequest("Review is already flagged");

    const updated = await db.review.update({
      where: { id },
      data: {
        isFlagged: true,
        flagReason: parsed.data.reason,
      },
    });

    return ok({ id: updated.id, isFlagged: true, flagReason: updated.flagReason });
  } catch (err) {
    console.error("Flag review error:", err);
    return serverError();
  }
}
