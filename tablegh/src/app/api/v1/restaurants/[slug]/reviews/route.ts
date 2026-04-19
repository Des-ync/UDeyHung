/**
 * GET /api/v1/restaurants/:slug/reviews
 *
 * Public — paginated, excludes flagged reviews unless caller is admin/staff.
 * Query: ?page=1&limit=10&sort=recent|highest|lowest
 */

import { NextRequest } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import {
  ok,
  notFound,
  serverError,
  paginate,
} from "@/lib/utils/api";
import { Prisma } from "@prisma/client";

const querySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(20).default(10),
  sort: z.enum(["recent", "highest", "lowest"]).default("recent"),
});

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  const { slug } = await params;

  const qResult = querySchema.safeParse(
    Object.fromEntries(req.nextUrl.searchParams)
  );
  const { page, limit, sort } = qResult.success
    ? qResult.data
    : { page: 1, limit: 10, sort: "recent" as const };

  try {
    const restaurant = await db.restaurant.findUnique({
      where: { slug },
      select: { id: true },
    });
    if (!restaurant) return notFound("Restaurant");

    const orderBy: Prisma.ReviewOrderByWithRelationInput =
      sort === "highest"
        ? { rating: "desc" }
        : sort === "lowest"
          ? { rating: "asc" }
          : { createdAt: "desc" };

    const where: Prisma.ReviewWhereInput = {
      restaurantId: restaurant.id,
      isFlagged: false,
    };

    const [reviews, total] = await Promise.all([
      db.review.findMany({
        where,
        orderBy,
        skip: (page - 1) * limit,
        take: limit,
        select: {
          id: true,
          rating: true,
          body: true,
          photoUrls: true,
          isVerified: true,
          createdAt: true,
          user: { select: { id: true, name: true } },
          response: {
            select: {
              id: true,
              body: true,
              createdAt: true,
            },
          },
        },
      }),
      db.review.count({ where }),
    ]);

    // Summary stats for display
    const ratingAgg = await db.review.aggregate({
      where: { restaurantId: restaurant.id, isFlagged: false },
      _avg: { rating: true },
      _count: { id: true },
    });

    // Per-star breakdown
    const breakdown = await db.review.groupBy({
      by: ["rating"],
      where: { restaurantId: restaurant.id, isFlagged: false },
      _count: { id: true },
    });

    const starBreakdown = [5, 4, 3, 2, 1].map((star) => ({
      star,
      count: breakdown.find((b) => b.rating === star)?._count.id ?? 0,
    }));

    return ok({
      ...paginate(reviews, total, page, limit),
      summary: {
        average: Number((ratingAgg._avg.rating ?? 0).toFixed(1)),
        total: ratingAgg._count.id,
        breakdown: starBreakdown,
      },
    });
  } catch (err) {
    console.error("List reviews error:", err);
    return serverError();
  }
}
