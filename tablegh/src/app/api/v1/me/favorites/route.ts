/**
 * POST   /api/v1/me/favorites          — toggle save (creates or deletes)
 * Body: { restaurantId: string }
 * Returns: { saved: boolean, restaurantId }
 */

import { NextRequest } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import {
  ok,
  unauthorized,
  badRequest,
  serverError,
  requireAuth,
  isAuthResult,
  parseBody,
} from "@/lib/utils/api";

const toggleSchema = z.object({
  restaurantId: z.string().cuid(),
});

export async function POST(req: NextRequest) {
  const authResult = await requireAuth();
  if (!isAuthResult(authResult)) return authResult.response;

  const body: unknown = await req.json();
  const parsed = parseBody(toggleSchema, body);
  if (!parsed.success) return parsed.response;

  const { restaurantId } = parsed.data;

  try {
    const user = await db.user.findUnique({
      where: { clerkId: authResult.userId },
      select: { id: true },
    });
    if (!user) return unauthorized();

    const existing = await db.favorite.findUnique({
      where: { userId_restaurantId: { userId: user.id, restaurantId } },
    });

    if (existing) {
      await db.favorite.delete({
        where: { userId_restaurantId: { userId: user.id, restaurantId } },
      });
      return ok({ saved: false, restaurantId });
    } else {
      await db.favorite.create({ data: { userId: user.id, restaurantId } });
      return ok({ saved: true, restaurantId });
    }
  } catch (err) {
    console.error("Toggle favorite error:", err);
    return serverError();
  }
}
