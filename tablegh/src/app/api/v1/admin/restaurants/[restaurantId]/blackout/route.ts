/**
 * POST   /api/v1/admin/restaurants/:restaurantId/blackout
 * DELETE /api/v1/admin/restaurants/:restaurantId/blackout?date=YYYY-MM-DD
 *
 * Manage blackout dates for a restaurant.
 */

import { NextRequest } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import {
  ok,
  noContent,
  badRequest,
  forbidden,
  serverError,
  requireAuth,
  isAuthResult,
  parseBody,
} from "@/lib/utils/api";

const createSchema = z.object({
  date: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, "Date must be YYYY-MM-DD")
    .transform((s) => new Date(s + "T00:00:00Z")),
  reason: z.string().max(100).optional(),
});

async function assertAccess(clerkId: string, restaurantId: string) {
  const user = await db.user.findUnique({
    where: { clerkId },
    include: { staffRoles: { where: { restaurantId } } },
  });
  if (!user) return null;
  return user.role === "ADMIN" || user.staffRoles.length > 0 ? user : null;
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ restaurantId: string }> }
) {
  const { restaurantId } = await params;

  const authResult = await requireAuth();
  if (!isAuthResult(authResult)) return authResult.response;

  const user = await assertAccess(authResult.userId, restaurantId);
  if (!user) return forbidden();

  const body: unknown = await req.json();
  const parsed = parseBody(createSchema, body);
  if (!parsed.success) return parsed.response;

  try {
    const entry = await db.blackoutDate.upsert({
      where: {
        restaurantId_date: { restaurantId, date: parsed.data.date },
      },
      create: {
        restaurantId,
        date: parsed.data.date,
        reason: parsed.data.reason,
      },
      update: {
        reason: parsed.data.reason,
      },
    });
    return ok(entry);
  } catch (err) {
    console.error(err);
    return serverError();
  }
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ restaurantId: string }> }
) {
  const { restaurantId } = await params;

  const authResult = await requireAuth();
  if (!isAuthResult(authResult)) return authResult.response;

  const user = await assertAccess(authResult.userId, restaurantId);
  if (!user) return forbidden();

  const dateStr = req.nextUrl.searchParams.get("date");
  if (!dateStr || !/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) {
    return badRequest("date query param required (YYYY-MM-DD)");
  }

  const date = new Date(dateStr + "T00:00:00Z");

  try {
    await db.blackoutDate.deleteMany({ where: { restaurantId, date } });
    return noContent();
  } catch (err) {
    console.error(err);
    return serverError();
  }
}
