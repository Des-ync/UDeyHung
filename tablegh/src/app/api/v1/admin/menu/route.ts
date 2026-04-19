/**
 * GET  /api/v1/admin/menu?restaurantId=  — full menu with categories + items
 * POST /api/v1/admin/menu/categories     — create category
 */

import { NextRequest } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import {
  ok,
  created,
  badRequest,
  forbidden,
  unauthorized,
  serverError,
  requireAuth,
  isAuthResult,
  parseBody,
} from "@/lib/utils/api";

const createCategorySchema = z.object({
  restaurantId: z.string().cuid(),
  name: z.string().min(1).max(60),
  description: z.string().max(300).optional(),
  sortOrder: z.number().int().min(0).optional(),
});

async function assertStaffAccess(clerkId: string, restaurantId: string) {
  const user = await db.user.findUnique({
    where: { clerkId },
    include: { staffRoles: { where: { restaurantId } } },
  });
  if (!user) return null;
  return user.role === "ADMIN" || user.staffRoles.length > 0 ? user : null;
}

export async function GET(req: NextRequest) {
  const authResult = await requireAuth();
  if (!isAuthResult(authResult)) return authResult.response;

  const restaurantId = req.nextUrl.searchParams.get("restaurantId");
  if (!restaurantId) return badRequest("restaurantId required");

  const user = await assertStaffAccess(authResult.userId, restaurantId);
  if (!user) return forbidden();

  try {
    const categories = await db.menuCategory.findMany({
      where: { restaurantId },
      orderBy: { sortOrder: "asc" },
      include: {
        items: { orderBy: { sortOrder: "asc" } },
        _count: { select: { items: true } },
      },
    });
    return ok(categories);
  } catch (err) {
    console.error(err);
    return serverError();
  }
}

export async function POST(req: NextRequest) {
  const authResult = await requireAuth();
  if (!isAuthResult(authResult)) return authResult.response;

  const body: unknown = await req.json();
  const parsed = parseBody(createCategorySchema, body);
  if (!parsed.success) return parsed.response;

  const user = await assertStaffAccess(authResult.userId, parsed.data.restaurantId);
  if (!user) return forbidden();

  try {
    // Auto-assign sort order if not provided
    if (parsed.data.sortOrder === undefined) {
      const maxOrder = await db.menuCategory.aggregate({
        where: { restaurantId: parsed.data.restaurantId },
        _max: { sortOrder: true },
      });
      parsed.data.sortOrder = (maxOrder._max.sortOrder ?? -1) + 1;
    }

    const category = await db.menuCategory.create({ data: parsed.data });
    return created(category);
  } catch (err) {
    console.error(err);
    return serverError();
  }
}
