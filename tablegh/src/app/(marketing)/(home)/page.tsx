import type { Metadata } from "next";
import { HeroSection } from "@/components/restaurant/HeroSection";
import { RestaurantGrid } from "@/components/restaurant/RestaurantGrid";
import { db } from "@/lib/db";
import { toZonedTime } from "date-fns-tz";
import { ACCRA_TZ } from "@/lib/utils/slots";
import { DayOfWeek } from "@prisma/client";

export const metadata: Metadata = {
  title: "TableGH — Reserve Your Table in Accra",
  description:
    "Discover and book the best restaurants in Accra. Chop time? Book your spot.",
};

// Revalidate every 5 minutes — restaurants don't change often
export const revalidate = 300;

const DAY_MAP: Record<number, DayOfWeek> = {
  0: "SUNDAY", 1: "MONDAY", 2: "TUESDAY", 3: "WEDNESDAY",
  4: "THURSDAY", 5: "FRIDAY", 6: "SATURDAY",
};

async function getHomepageData() {
  const now = toZonedTime(new Date(), ACCRA_TZ);
  const todayDow = DAY_MAP[now.getDay()] as DayOfWeek;
  const currentMinutes = now.getHours() * 60 + now.getMinutes();

  const [trending, newRestaurants, dateNight, jollofSpots, rooftops, openLate] =
    await Promise.all([
      // Trending: high rating + recent reservations
      db.restaurant.findMany({
        where: { isActive: true, isVerified: true, deletedAt: null },
        orderBy: [{ ratingAvg: "desc" }, { ratingCount: "desc" }],
        take: 8,
        include: {
          photos: { where: { context: "EXTERIOR" }, take: 1 },
          operatingHours: { where: { dayOfWeek: todayDow } },
        },
      }),
      // New on TableGH
      db.restaurant.findMany({
        where: { isActive: true, deletedAt: null },
        orderBy: { createdAt: "desc" },
        take: 6,
        include: {
          photos: { where: { context: "EXTERIOR" }, take: 1 },
          operatingHours: { where: { dayOfWeek: todayDow } },
        },
      }),
      // Best for Date Night: fine dining + upscale, low/no kid-friendly
      db.restaurant.findMany({
        where: {
          isActive: true,
          deletedAt: null,
          priceLevel: { in: ["UPSCALE", "FINE"] },
        },
        orderBy: { ratingAvg: "desc" },
        take: 6,
        include: {
          photos: { where: { context: "EXTERIOR" }, take: 1 },
          operatingHours: { where: { dayOfWeek: todayDow } },
        },
      }),
      // Top Jollof Spots
      db.restaurant.findMany({
        where: {
          isActive: true,
          deletedAt: null,
          dishSpecialties: { has: "JOLLOF" },
        },
        orderBy: { ratingAvg: "desc" },
        take: 6,
        include: {
          photos: { where: { context: "DISH" }, take: 1 },
          operatingHours: { where: { dayOfWeek: todayDow } },
        },
      }),
      // Rooftop Views
      db.restaurant.findMany({
        where: {
          isActive: true,
          deletedAt: null,
          venueCategories: { has: "ROOFTOP" },
        },
        orderBy: { ratingAvg: "desc" },
        take: 6,
        include: {
          photos: { where: { context: "EXTERIOR" }, take: 1 },
          operatingHours: { where: { dayOfWeek: todayDow } },
        },
      }),
      // Open Late: closes after 11 PM (1380 min)
      db.restaurant.findMany({
        where: {
          isActive: true,
          deletedAt: null,
          operatingHours: {
            some: {
              dayOfWeek: todayDow,
              isClosed: false,
              closeTime: { gte: 1380 },
            },
          },
        },
        orderBy: { ratingAvg: "desc" },
        take: 6,
        include: {
          photos: { where: { context: "EXTERIOR" }, take: 1 },
          operatingHours: { where: { dayOfWeek: todayDow } },
        },
      }),
    ]);

  const toCard = (r: (typeof trending)[0]) => ({
    id: r.id,
    slug: r.slug,
    name: r.name,
    shortBio: r.shortBio,
    neighborhood: r.neighborhood,
    cuisineTags: r.cuisineTags,
    priceLevel: r.priceLevel,
    ratingAvg: Number(r.ratingAvg),
    ratingCount: r.ratingCount,
    coverPhoto: r.photos[0]?.url ?? null,
    features: r.features,
    isOpenNow: r.operatingHours[0]
      ? !r.operatingHours[0].isClosed &&
        currentMinutes >= r.operatingHours[0].openTime &&
        currentMinutes < r.operatingHours[0].closeTime
      : false,
  });

  return {
    trending: trending.map(toCard),
    newRestaurants: newRestaurants.map(toCard),
    dateNight: dateNight.map(toCard),
    jollofSpots: jollofSpots.map(toCard),
    rooftops: rooftops.map(toCard),
    openLate: openLate.map(toCard),
  };
}

export default async function HomePage() {
  const data = await getHomepageData();

  return (
    <main>
      <HeroSection />

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16 space-y-16">
        <RestaurantGrid
          title="Trending in Accra"
          subtitle="The restaurants everyone is talking about right now"
          restaurants={data.trending}
        />

        <RestaurantGrid
          title="New on TableGH"
          subtitle="Fresh additions to Accra's dining scene"
          restaurants={data.newRestaurants}
          variant="scroll"
        />

        <RestaurantGrid
          title="Best for Date Night"
          subtitle="Impress your person. We've picked the spots."
          restaurants={data.dateNight}
          variant="scroll"
        />

        <RestaurantGrid
          title="Top Jollof Spots"
          subtitle="The jollof wars are settled here — vote with your fork"
          restaurants={data.jollofSpots}
          variant="scroll"
          accentColor="accent"
        />

        <RestaurantGrid
          title="Rooftop Views"
          subtitle="Accra looks even better from up here"
          restaurants={data.rooftops}
          variant="scroll"
        />

        <RestaurantGrid
          title="Open Late"
          subtitle="Night owls, these ones are still serving"
          restaurants={data.openLate}
          variant="scroll"
        />
      </div>
    </main>
  );
}
