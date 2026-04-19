/**
 * POST /api/v1/admin/menu/reorder
 * Batch-update sortOrder for categories or items after drag-and-drop.
 *
 * Body: { restaurantId, type: "category"|"item", items: [{id, sortOrder}] }
 */

import { NextRequest } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import {
  ok,
  forbidden,
  serverError,
  requireAuth,
  isAuthResult,
  parseBody,
} from "@/lib/utils/api";

const reorderSchema = z.object({
  restaurantId: z.string().cuid(),
  type: z.enum(["category", "item"]),
  items: z.array(
    z.object({ id: z.string().cuid(), sortOrder: z.number().int().min(0) })
  ).min(1).max(100),
});

export async function POST(req: NextRequest) {
  const authResult = await requireAuth();
  if (!isAuthResult(authResult)) return authResult.response;

  const body: unknown = await req.json();
  const parsed = parseBody(reorderSchema, body);
  if (!parsed.success) return parsed.response;

  const { restaurantId, type, items } = parsed.data;

  try {
    const user = await db.user.findUnique({
      where: { clerkId: authResult.userId },
      include: { staffRoles: { where: { restaurantId } } },
    });
    if (!user) return forbidden();
    if (user.role !== "ADMIN" && user.staffRoles.length === 0) return forbidden();

    // Batch update in a transaction
    await db.$transaction(
      items.map(({ id, sortOrder }) =>
        type === "category"
          ? db.menuCategory.update({ where: { id }, data: { sortOrder } })
          : db.menuItem.update({ where: { id }, data: { sortOrder } })
      )
    );

    return ok({ updated: items.length });
  } catch (err) {
    console.error(err);
    return serverError();
  }
}
