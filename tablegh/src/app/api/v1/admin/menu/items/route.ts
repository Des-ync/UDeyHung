/**
 * POST /api/v1/admin/menu/items — create menu item
 * PATCH /api/v1/admin/menu/items/:id — update (see [id]/route.ts)
 * DELETE /api/v1/admin/menu/items/:id — delete
 */

import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import {
  created,
  forbidden,
  serverError,
  requireAuth,
  isAuthResult,
  parseBody,
} from "@/lib/utils/api";
import { createMenuItemSchema } from "@/lib/validations";
import { DietaryTag, DishSpecialty } from "@prisma/client";

export async function POST(req: NextRequest) {
  const authResult = await requireAuth();
  if (!isAuthResult(authResult)) return authResult.response;
  const { userId: clerkId } = authResult;

  const body: unknown = await req.json();
  const parsed = parseBody(createMenuItemSchema, body);
  if (!parsed.success) return parsed.response;

  try {
    const user = await db.user.findUnique({ where: { clerkId } });
    if (!user) return forbidden();

    // Verify category belongs to a restaurant this user manages
    const category = await db.menuCategory.findUnique({
      where: { id: parsed.data.categoryId },
    });
    if (!category) return forbidden();

    const canAccess =
      user.role === "ADMIN" ||
      (await db.restaurantStaff.findUnique({
        where: {
          userId_restaurantId: {
            userId: user.id,
            restaurantId: category.restaurantId,
          },
        },
      })) !== null;
    if (!canAccess) return forbidden();

    // Auto-assign sort order
    const maxOrder = await db.menuItem.aggregate({
      where: { categoryId: parsed.data.categoryId },
      _max: { sortOrder: true },
    });

    const item = await db.menuItem.create({
      data: {
        restaurantId: category.restaurantId,
        categoryId: parsed.data.categoryId,
        name: parsed.data.name,
        description: parsed.data.description,
        pricePesewas: parsed.data.pricePesewas,
        isSignatureDish: parsed.data.isSignatureDish ?? false,
        sortOrder: parsed.data.sortOrder ?? (maxOrder._max.sortOrder ?? -1) + 1,
        dietaryTags: {
          set: (parsed.data.dietaryTags ?? []) as DietaryTag[],
        },
        dishSpecialties: {
          set: (parsed.data.dishSpecialties ?? []) as DishSpecialty[],
        },
      },
    });

    return created(item);
  } catch (err) {
    console.error(err);
    return serverError();
  }
}
