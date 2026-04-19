/**
 * GET /api/v1/restaurants/:slug
 * Full restaurant detail with menu, photos, reviews, and today's hours.
 */

import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { ok, notFound, serverError } from "@/lib/utils/api";
import { toZonedTime } from "date-fns-tz";
import { ACCRA_TZ, isOpenNow } from "@/lib/utils/slots";
import { DayOfWeek } from "@prisma/client";

const DAY_MAP: Record<number, DayOfWeek> = {
  0: DayOfWeek.SUNDAY,
  1: DayOfWeek.MONDAY,
  2: DayOfWeek.TUESDAY,
  3: DayOfWeek.WEDNESDAY,
  4: DayOfWeek.THURSDAY,
  5: DayOfWeek.FRIDAY,
  6: DayOfWeek.SATURDAY,
};

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  const { slug } = await params;

  try {
    const restaurant = await db.restaurant.findFirst({
      where: { slug, isActive: true, deletedAt: null },
      include: {
        photos: { orderBy: [{ context: "asc" }, { sortOrder: "asc" }] },
        operatingHours: { orderBy: { dayOfWeek: "asc" } },
        menuCategories: {
          where: { isActive: true },
          orderBy: { sortOrder: "asc" },
          include: {
            items: {
              where: { isAvailable: true },
              orderBy: { sortOrder: "asc" },
            },
          },
        },
        reviews: {
          where: { isFlagged: false },
          orderBy: { createdAt: "desc" },
          take: 10,
          include: {
            user: { select: { id: true, name: true } },
            response: true,
          },
        },
        _count: { select: { reviews: true, favorites: true } },
      },
    });

    if (!restaurant) return notFound("Restaurant");

    const now = toZonedTime(new Date(), ACCRA_TZ);
    const todayDow = DAY_MAP[now.getDay()] as DayOfWeek;
    const todayHours = restaurant.operatingHours.find(
      (h) => h.dayOfWeek === todayDow
    );

    const openStatus = todayHours && !todayHours.isClosed
      ? isOpenNow(todayHours.openTime, todayHours.closeTime)
      : false;

    return ok({
      id: restaurant.id,
      slug: restaurant.slug,
      name: restaurant.name,
      description: restaurant.description,
      shortBio: restaurant.shortBio,
      neighborhood: restaurant.neighborhood,
      address: restaurant.address,
      latitude: Number(restaurant.latitude),
      longitude: Number(restaurant.longitude),
      googleMapsUrl: restaurant.googleMapsUrl,
      appleMapsUrl: restaurant.appleMapsUrl,
      phone: restaurant.phone,
      whatsappPhone: restaurant.whatsappPhone,
      email: restaurant.email,
      websiteUrl: restaurant.websiteUrl,
      instagramHandle: restaurant.instagramHandle,
      cuisineTags: restaurant.cuisineTags,
      venueCategories: restaurant.venueCategories,
      dishSpecialties: restaurant.dishSpecialties,
      priceLevel: restaurant.priceLevel,
      features: restaurant.features,
      ratingAvg: Number(restaurant.ratingAvg),
      ratingCount: restaurant.ratingCount,
      reviewCount: restaurant._count.reviews,
      favoriteCount: restaurant._count.favorites,
      depositEnabled: restaurant.depositEnabled,
      depositAmountPesewas: restaurant.depositAmountPesewas,
      depositRequiredDays: restaurant.depositRequiredDays,
      isOpenNow: openStatus,
      todayHours: todayHours
        ? {
            openTime: todayHours.openTime,
            closeTime: todayHours.closeTime,
            isClosed: todayHours.isClosed,
          }
        : null,
      operatingHours: restaurant.operatingHours.map((h) => ({
        dayOfWeek: h.dayOfWeek,
        openTime: h.openTime,
        closeTime: h.closeTime,
        isClosed: h.isClosed,
      })),
      photos: restaurant.photos.map((p) => ({
        url: p.url,
        thumbnailUrl: p.thumbnailUrl,
        context: p.context,
        altText: p.altText,
      })),
      menu: restaurant.menuCategories.map((cat) => ({
        id: cat.id,
        name: cat.name,
        description: cat.description,
        items: cat.items.map((item) => ({
          id: item.id,
          name: item.name,
          description: item.description,
          pricePesewas: item.pricePesewas,
          photoUrl: item.photoUrl,
          dietaryTags: item.dietaryTags,
          dishSpecialties: item.dishSpecialties,
          isSignatureDish: item.isSignatureDish,
        })),
      })),
      recentReviews: restaurant.reviews.map((r) => ({
        id: r.id,
        rating: r.rating,
        body: r.body,
        photoUrls: r.photoUrls,
        isVerified: r.isVerified,
        createdAt: r.createdAt,
        author: { id: r.user.id, name: r.user.name },
        response: r.response
          ? { body: r.response.body, createdAt: r.response.createdAt }
          : null,
      })),
    });
  } catch (err) {
    console.error("Restaurant detail error:", err);
    return serverError();
  }
}
