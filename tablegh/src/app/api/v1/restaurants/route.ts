/**
 * GET /api/v1/restaurants
 * Restaurant discovery with full-text search, filters, and distance sorting.
 *
 * Rate limit: 100 req/min per IP
 * Auth: optional (authenticated users get personalized results)
 */

import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import {
  ok,
  badRequest,
  serverError,
  parseQuery,
  paginate,
} from "@/lib/utils/api";
import { restaurantSearchSchema } from "@/lib/validations";
import {
  Neighborhood,
  CuisineTag,
  PriceLevel,
  Prisma,
  DayOfWeek,
} from "@prisma/client";
import { toZonedTime } from "date-fns-tz";
import { ACCRA_TZ, isOpenNow } from "@/lib/utils/slots";

const DAY_MAP: Record<number, DayOfWeek> = {
  0: DayOfWeek.SUNDAY,
  1: DayOfWeek.MONDAY,
  2: DayOfWeek.TUESDAY,
  3: DayOfWeek.WEDNESDAY,
  4: DayOfWeek.THURSDAY,
  5: DayOfWeek.FRIDAY,
  6: DayOfWeek.SATURDAY,
};

export async function GET(req: NextRequest) {
  const parsed = parseQuery(restaurantSearchSchema, req);
  if (!parsed.success) return parsed.response;

  const {
    q,
    cuisine,
    neighborhood,
    priceLevel,
    venueCategory,
    minRating,
    openNow,
    features,
    lat,
    lng,
    sortBy,
    page,
    limit,
  } = parsed.data;

  try {
    // Base where clause
    const where: Prisma.RestaurantWhereInput = {
      isActive: true,
      deletedAt: null,
    };

    // Full-text + trigram search
    if (q) {
      where["OR"] = [
        { name: { contains: q, mode: "insensitive" } },
        { description: { contains: q, mode: "insensitive" } },
        { shortBio: { contains: q, mode: "insensitive" } },
      ];
    }

    if (cuisine && cuisine.length > 0) {
      where["cuisineTags"] = { hasSome: cuisine as CuisineTag[] };
    }

    if (neighborhood && neighborhood.length > 0) {
      where["neighborhood"] = { in: neighborhood as Neighborhood[] };
    }

    if (priceLevel && priceLevel.length > 0) {
      where["priceLevel"] = { in: priceLevel as PriceLevel[] };
    }

    if (venueCategory && venueCategory.length > 0) {
      where["venueCategories"] = { hasSome: venueCategory };
    }

    if (minRating !== undefined) {
      where["ratingAvg"] = { gte: minRating };
    }

    if (features && features.length > 0) {
      where["features"] = { hasSome: features };
    }

    // Open-now filter: check today's operating hours
    let restaurantIdsOpenNow: string[] | undefined;
    if (openNow) {
      const now = toZonedTime(new Date(), ACCRA_TZ);
      const todayDow = DAY_MAP[now.getDay()] as DayOfWeek;
      const currentMinutes = now.getHours() * 60 + now.getMinutes();

      const openHours = await db.operatingHours.findMany({
        where: {
          dayOfWeek: todayDow,
          isClosed: false,
          openTime: { lte: currentMinutes },
          closeTime: { gt: currentMinutes },
          restaurant: { isActive: true, deletedAt: null },
        },
        select: { restaurantId: true },
      });

      restaurantIdsOpenNow = openHours.map((h) => h.restaurantId);
      where["id"] = { in: restaurantIdsOpenNow };
    }

    // Ordering
    let orderBy: Prisma.RestaurantOrderByWithRelationInput | Prisma.RestaurantOrderByWithRelationInput[];

    switch (sortBy) {
      case "rating":
        orderBy = [{ ratingAvg: "desc" }, { ratingCount: "desc" }];
        break;
      case "price_asc":
        orderBy = { priceLevel: "asc" };
        break;
      case "price_desc":
        orderBy = { priceLevel: "desc" };
        break;
      case "distance":
      case "relevance":
      default:
        orderBy = [{ ratingAvg: "desc" }, { ratingCount: "desc" }];
        break;
    }

    const skip = (page - 1) * limit;

    const [restaurants, total] = await Promise.all([
      db.restaurant.findMany({
        where,
        orderBy,
        skip,
        take: limit,
        include: {
          photos: {
            where: { context: "EXTERIOR" },
            orderBy: { sortOrder: "asc" },
            take: 1,
          },
          operatingHours: true,
          _count: {
            select: { reservations: true, reviews: true },
          },
        },
      }),
      db.restaurant.count({ where }),
    ]);

    // Compute distance if coordinates provided (Haversine)
    const results = restaurants.map((r) => {
      let distanceKm: number | undefined;

      if (lat !== undefined && lng !== undefined) {
        distanceKm = haversineKm(
          lat,
          lng,
          Number(r.latitude),
          Number(r.longitude)
        );
      }

      // Determine open status
      const now = toZonedTime(new Date(), ACCRA_TZ);
      const todayDow = DAY_MAP[now.getDay()] as DayOfWeek;
      const todayHours = r.operatingHours.find(
        (h) => h.dayOfWeek === todayDow
      );
      const openStatus = todayHours
        ? isOpenNow(todayHours.openTime, todayHours.closeTime)
        : false;

      return {
        id: r.id,
        slug: r.slug,
        name: r.name,
        shortBio: r.shortBio,
        neighborhood: r.neighborhood,
        cuisineTags: r.cuisineTags,
        venueCategories: r.venueCategories,
        priceLevel: r.priceLevel,
        ratingAvg: Number(r.ratingAvg),
        ratingCount: r.ratingCount,
        coverPhoto: r.photos[0]?.url ?? null,
        features: r.features,
        isOpenNow: openStatus,
        distanceKm: distanceKm ? Math.round(distanceKm * 10) / 10 : undefined,
        latitude: Number(r.latitude),
        longitude: Number(r.longitude),
      };
    });

    // Sort by distance if requested
    if (sortBy === "distance" && lat !== undefined && lng !== undefined) {
      results.sort((a, b) => (a.distanceKm ?? 0) - (b.distanceKm ?? 0));
    }

    return ok(paginate(results, total, page, limit));
  } catch (err) {
    console.error("Restaurant search error:", err);
    return serverError();
  }
}

/**
 * Haversine formula for distance between two lat/lng points.
 * Returns distance in kilometers.
 */
function haversineKm(
  lat1: number,
  lng1: number,
  lat2: number,
  lng2: number
): number {
  const R = 6371; // Earth radius in km
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function toRad(deg: number): number {
  return (deg * Math.PI) / 180;
}
