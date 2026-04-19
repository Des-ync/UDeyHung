/**
 * PATCH  /api/v1/admin/tables/:id — update table
 * DELETE /api/v1/admin/tables/:id — deactivate table (soft delete)
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
import { TableCapacity } from "@prisma/client";

const updateTableSchema = z.object({
  label: z.string().min(1).max(20).optional(),
  capacity: z.nativeEnum(TableCapacity).optional(),
  minGuests: z.number().int().min(1).optional(),
  maxGuests: z.number().int().min(1).max(30).optional(),
  notes: z.string().max(200).optional(),
  isActive: z.boolean().optional(),
});

async function assertTableAccess(clerkId: string, tableId: string) {
  const user = await db.user.findUnique({ where: { clerkId } });
  if (!user) return null;

  const table = await db.restaurantTable.findUnique({ where: { id: tableId } });
  if (!table) return null;

  if (user.role === "ADMIN") return { user, table };

  const staff = await db.restaurantStaff.findUnique({
    where: {
      userId_restaurantId: { userId: user.id, restaurantId: table.restaurantId },
    },
  });
  return staff ? { user, table } : null;
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const authResult = await requireAuth();
  if (!isAuthResult(authResult)) return authResult.response;

  const access = await assertTableAccess(authResult.userId, id);
  if (!access) return forbidden();

  const body: unknown = await req.json();
  const parsed = parseBody(updateTableSchema, body);
  if (!parsed.success) return parsed.response;

  try {
    const updated = await db.restaurantTable.update({
      where: { id },
      data: parsed.data,
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

  const access = await assertTableAccess(authResult.userId, id);
  if (!access) return forbidden();

  try {
    // Check for upcoming confirmed reservations on this table
    const upcomingCount = await db.reservation.count({
      where: {
        tableId: id,
        startsAt: { gte: new Date() },
        status: { in: ["PENDING", "CONFIRMED"] },
      },
    });
    if (upcomingCount > 0) {
      return badRequest(
        `Cannot deactivate table with ${upcomingCount} upcoming reservation(s). Reassign them first.`
      );
    }

    await db.restaurantTable.update({ where: { id }, data: { isActive: false } });
    return noContent();
  } catch (err) {
    console.error(err);
    return serverError();
  }
}
