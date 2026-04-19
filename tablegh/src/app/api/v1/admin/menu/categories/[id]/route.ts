/**
 * PATCH  /api/v1/admin/menu/categories/:id
 * DELETE /api/v1/admin/menu/categories/:id
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

const patchSchema = z.object({
  name: z.string().min(1).max(60).optional(),
  description: z.string().max(300).optional(),
  sortOrder: z.number().int().min(0).optional(),
  isActive: z.boolean().optional(),
});

async function assertCategoryAccess(clerkId: string, categoryId: string) {
  const user = await db.user.findUnique({ where: { clerkId } });
  if (!user) return null;
  const cat = await db.menuCategory.findUnique({ where: { id: categoryId } });
  if (!cat) return null;
  if (user.role === "ADMIN") return { user, cat };
  const staff = await db.restaurantStaff.findUnique({
    where: { userId_restaurantId: { userId: user.id, restaurantId: cat.restaurantId } },
  });
  return staff ? { user, cat } : null;
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const authResult = await requireAuth();
  if (!isAuthResult(authResult)) return authResult.response;

  const access = await assertCategoryAccess(authResult.userId, id);
  if (!access) return forbidden();

  const body: unknown = await req.json();
  const parsed = parseBody(patchSchema, body);
  if (!parsed.success) return parsed.response;

  try {
    const updated = await db.menuCategory.update({ where: { id }, data: parsed.data });
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

  const access = await assertCategoryAccess(authResult.userId, id);
  if (!access) return forbidden();

  try {
    const itemCount = await db.menuItem.count({ where: { categoryId: id } });
    if (itemCount > 0) {
      return badRequest(
        `Cannot delete category with ${itemCount} item(s). Move or delete the items first.`
      );
    }
    await db.menuCategory.delete({ where: { id } });
    return noContent();
  } catch (err) {
    console.error(err);
    return serverError();
  }
}
