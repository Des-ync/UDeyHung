/**
 * GET  /api/v1/admin/tables?restaurantId=
 * POST /api/v1/admin/tables          — create table
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
import { TableCapacity } from "@prisma/client";

const createTableSchema = z.object({
  restaurantId: z.string().cuid(),
  label: z.string().min(1).max(20),
  capacity: z.nativeEnum(TableCapacity),
  minGuests: z.number().int().min(1),
  maxGuests: z.number().int().min(1).max(30),
  notes: z.string().max(200).optional(),
}).refine((d) => d.minGuests <= d.maxGuests, {
  message: "minGuests cannot exceed maxGuests",
  path: ["minGuests"],
});

async function assertStaffAccess(clerkId: string, restaurantId: string) {
  const user = await db.user.findUnique({
    where: { clerkId },
    include: { staffRoles: { where: { restaurantId } } },
  });
  if (!user) return null;
  if (user.role !== "ADMIN" && user.staffRoles.length === 0) return null;
  return user;
}

export async function GET(req: NextRequest) {
  const authResult = await requireAuth();
  if (!isAuthResult(authResult)) return authResult.response;

  const restaurantId = req.nextUrl.searchParams.get("restaurantId");
  if (!restaurantId) return badRequest("restaurantId required");

  const user = await assertStaffAccess(authResult.userId, restaurantId);
  if (!user) return forbidden();

  try {
    const tables = await db.restaurantTable.findMany({
      where: { restaurantId },
      orderBy: { label: "asc" },
    });
    return ok(tables);
  } catch (err) {
    console.error(err);
    return serverError();
  }
}

export async function POST(req: NextRequest) {
  const authResult = await requireAuth();
  if (!isAuthResult(authResult)) return authResult.response;

  const body: unknown = await req.json();
  const parsed = parseBody(createTableSchema, body);
  if (!parsed.success) return parsed.response;

  const user = await assertStaffAccess(authResult.userId, parsed.data.restaurantId);
  if (!user) return forbidden();

  try {
    // Ensure label is unique within the restaurant
    const existing = await db.restaurantTable.findFirst({
      where: { restaurantId: parsed.data.restaurantId, label: parsed.data.label },
    });
    if (existing) return badRequest(`A table named "${parsed.data.label}" already exists`);

    const table = await db.restaurantTable.create({ data: parsed.data });
    return created(table);
  } catch (err) {
    console.error(err);
    return serverError();
  }
}
