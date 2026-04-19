/**
 * PATCH  /api/v1/admin/menu/items/:id — update menu item
 * DELETE /api/v1/admin/menu/items/:id — delete menu item
 */

import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import {
  ok,
  noContent,
  forbidden,
  notFound,
  serverError,
  requireAuth,
  isAuthResult,
  parseBody,
} from "@/lib/utils/api";
import { updateMenuItemSchema } from "@/lib/validations";
import { DietaryTag, DishSpecialty } from "@prisma/client";
import { deleteFromR2 } from "@/lib/storage/r2";

async function assertItemAccess(clerkId: string, itemId: string) {
  const user = await db.user.findUnique({ where: { clerkId } });
  if (!user) return null;

  const item = await db.menuItem.findUnique({ where: { id: itemId } });
  if (!item) return null;

  if (user.role === "ADMIN") return { user, item };

  const staff = await db.restaurantStaff.findUnique({
    where: {
      userId_restaurantId: { userId: user.id, restaurantId: item.restaurantId },
    },
  });
  return staff ? { user, item } : null;
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const authResult = await requireAuth();
  if (!isAuthResult(authResult)) return authResult.response;

  const access = await assertItemAccess(authResult.userId, id);
  if (!access) return forbidden();
  if (!access.item) return notFound("Menu item");

  const body: unknown = await req.json();
  const parsed = parseBody(updateMenuItemSchema, body);
  if (!parsed.success) return parsed.response;

  try {
    const updated = await db.menuItem.update({
      where: { id },
      data: {
        ...(parsed.data.name !== undefined && { name: parsed.data.name }),
        ...(parsed.data.description !== undefined && { description: parsed.data.description }),
        ...(parsed.data.pricePesewas !== undefined && { pricePesewas: parsed.data.pricePesewas }),
        ...(parsed.data.isAvailable !== undefined && { isAvailable: parsed.data.isAvailable }),
        ...(parsed.data.isSignatureDish !== undefined && { isSignatureDish: parsed.data.isSignatureDish }),
        ...(parsed.data.sortOrder !== undefined && { sortOrder: parsed.data.sortOrder }),
        ...(parsed.data.dietaryTags !== undefined && {
          dietaryTags: { set: parsed.data.dietaryTags as DietaryTag[] },
        }),
        ...(parsed.data.dishSpecialties !== undefined && {
          dishSpecialties: { set: parsed.data.dishSpecialties as DishSpecialty[] },
        }),
      },
    });
    return ok(updated);
  } catch (err) {
    console.error(err);
    return serverError();
  }
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const authResult = await requireAuth();
  if (!isAuthResult(authResult)) return authResult.response;

  const access = await assertItemAccess(authResult.userId, id);
  if (!access) return forbidden();
  if (!access.item) return notFound("Menu item");

  try {
    // Remove photo from R2 if present
    if (access.item.photoUrl) {
      const r2PublicUrl = process.env["R2_PUBLIC_URL"] ?? "";
      const key = access.item.photoUrl.replace(r2PublicUrl + "/", "");
      await deleteFromR2(key).catch(console.error);
    }

    await db.menuItem.delete({ where: { id } });
    return noContent();
  } catch (err) {
    console.error(err);
    return serverError();
  }
}
