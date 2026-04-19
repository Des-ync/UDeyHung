/**
 * GET   /api/v1/admin/restaurants/:restaurantId/settings
 * PATCH /api/v1/admin/restaurants/:restaurantId/settings
 *
 * Returns/updates restaurant profile, operating hours, deposit config.
 * Blackout dates managed separately via sub-routes below.
 */

import { NextRequest } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import {
  ok,
  badRequest,
  forbidden,
  unauthorized,
  serverError,
  requireAuth,
  isAuthResult,
  parseBody,
} from "@/lib/utils/api";
import { DayOfWeek } from "@prisma/client";

// ─── Validation ───────────────────────────────────────────────────────────────

const operatingHoursSchema = z
  .array(
    z.object({
      dayOfWeek: z.nativeEnum(DayOfWeek),
      openTime: z.number().int().min(0).max(1439),
      closeTime: z.number().int().min(0).max(1439),
      isClosed: z.boolean(),
    })
  )
  .min(1)
  .max(7);

const patchSchema = z.object({
  description: z.string().max(1000).optional(),
  shortBio: z.string().max(160).optional(),
  phone: z.string().optional(),
  whatsappPhone: z.string().optional(),
  email: z.string().email().optional(),
  websiteUrl: z.string().url().optional().or(z.literal("")),
  instagramHandle: z.string().max(60).optional(),
  defaultTurnTime: z.number().int().min(30).max(300).optional(),
  isActive: z.boolean().optional(),
  depositEnabled: z.boolean().optional(),
  depositAmountPesewas: z.number().int().nonnegative().optional(),
  depositRequiredDays: z.array(z.nativeEnum(DayOfWeek)).optional(),
  depositRefundHours: z.number().int().min(1).max(48).optional(),
  operatingHours: operatingHoursSchema.optional(),
});

// ─── Auth helper ──────────────────────────────────────────────────────────────

async function assertAccess(clerkId: string, restaurantId: string) {
  const user = await db.user.findUnique({
    where: { clerkId },
    include: { staffRoles: { where: { restaurantId } } },
  });
  if (!user) return null;
  if (user.role === "ADMIN" || user.staffRoles.length > 0) return user;
  return null;
}

// ─── GET ──────────────────────────────────────────────────────────────────────

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ restaurantId: string }> }
) {
  const { restaurantId } = await params;

  const authResult = await requireAuth();
  if (!isAuthResult(authResult)) return authResult.response;

  const user = await assertAccess(authResult.userId, restaurantId);
  if (!user) return forbidden();

  try {
    const [restaurant, operatingHours, blackoutDates] = await Promise.all([
      db.restaurant.findUnique({
        where: { id: restaurantId },
        select: {
          id: true,
          name: true,
          slug: true,
          description: true,
          shortBio: true,
          phone: true,
          whatsappPhone: true,
          email: true,
          websiteUrl: true,
          instagramHandle: true,
          defaultTurnTime: true,
          isActive: true,
          depositEnabled: true,
          depositAmountPesewas: true,
          depositRequiredDays: true,
          depositRefundHours: true,
          neighborhood: true,
          address: true,
        },
      }),
      db.operatingHours.findMany({
        where: { restaurantId },
        orderBy: { dayOfWeek: "asc" },
      }),
      db.blackoutDate.findMany({
        where: {
          restaurantId,
          date: { gte: new Date() }, // only future blackout dates
        },
        orderBy: { date: "asc" },
        take: 30,
      }),
    ]);

    if (!restaurant) return forbidden();

    return ok({ restaurant, operatingHours, blackoutDates });
  } catch (err) {
    console.error(err);
    return serverError();
  }
}

// ─── PATCH ────────────────────────────────────────────────────────────────────

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ restaurantId: string }> }
) {
  const { restaurantId } = await params;

  const authResult = await requireAuth();
  if (!isAuthResult(authResult)) return authResult.response;

  const user = await assertAccess(authResult.userId, restaurantId);
  if (!user) return forbidden();

  const body: unknown = await req.json();
  const parsed = parseBody(patchSchema, body);
  if (!parsed.success) return parsed.response;

  const { operatingHours: hoursPayload, ...restaurantFields } = parsed.data;

  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const updateData: Record<string, any> = {};

    for (const [k, v] of Object.entries(restaurantFields)) {
      if (v !== undefined) updateData[k] = v;
    }

    await db.$transaction(async (tx) => {
      if (Object.keys(updateData).length > 0) {
        await tx.restaurant.update({
          where: { id: restaurantId },
          data: updateData,
        });
      }

      if (hoursPayload) {
        for (const hours of hoursPayload) {
          await tx.operatingHours.upsert({
            where: {
              restaurantId_dayOfWeek: {
                restaurantId,
                dayOfWeek: hours.dayOfWeek,
              },
            },
            create: { restaurantId, ...hours },
            update: {
              openTime: hours.openTime,
              closeTime: hours.closeTime,
              isClosed: hours.isClosed,
            },
          });
        }
      }
    });

    return ok({ updated: true });
  } catch (err) {
    console.error(err);
    return serverError();
  }
}
