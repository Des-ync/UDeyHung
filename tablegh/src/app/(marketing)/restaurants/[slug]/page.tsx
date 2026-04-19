import type { Metadata } from "next";
import { notFound } from "next/navigation";
import Image from "next/image";
import { auth } from "@clerk/nextjs/server";
import { db } from "@/lib/db";
import { BookingWidget } from "@/components/booking/BookingWidget";
import { ReviewsSection } from "@/components/restaurant/ReviewsSection";
import { formatGHS } from "@/lib/utils/currency";
import { minutesToDisplay, ACCRA_TZ, isOpenNow } from "@/lib/utils/slots";
import { toZonedTime } from "date-fns-tz";
import { DayOfWeek, ReservationStatus } from "@prisma/client";
import { MapPin, Phone, Globe, Star, Clock } from "lucide-react";
import { PRICE_LEVEL_LABELS } from "@/lib/utils/currency";

// Schema.org structured data for SEO
function RestaurantJsonLd({
  name,
  description,
  address,
  ratingAvg,
  ratingCount,
  phone,
  url,
  imageUrl,
}: {
  name: string;
  description: string;
  address: string;
  ratingAvg: number;
  ratingCount: number;
  phone: string;
  url: string;
  imageUrl?: string | null;
}) {
  const data = {
    "@context": "https://schema.org",
    "@type": "Restaurant",
    name,
    description,
    address: {
      "@type": "PostalAddress",
      streetAddress: address,
      addressLocality: "Accra",
      addressCountry: "GH",
    },
    aggregateRating: {
      "@type": "AggregateRating",
      ratingValue: ratingAvg,
      reviewCount: ratingCount,
      bestRating: 5,
      worstRating: 1,
    },
    telephone: phone,
    url,
    ...(imageUrl ? { image: imageUrl } : {}),
    servesCuisine: [],
  };

  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(data) }}
    />
  );
}

const DAY_MAP: Record<number, DayOfWeek> = {
  0: "SUNDAY", 1: "MONDAY", 2: "TUESDAY", 3: "WEDNESDAY",
  4: "THURSDAY", 5: "FRIDAY", 6: "SATURDAY",
};

const DAY_LABELS: Record<DayOfWeek, string> = {
  MONDAY: "Mon", TUESDAY: "Tue", WEDNESDAY: "Wed", THURSDAY: "Thu",
  FRIDAY: "Fri", SATURDAY: "Sat", SUNDAY: "Sun",
};

async function getRestaurant(slug: string) {
  return db.restaurant.findFirst({
    where: { slug, isActive: true, deletedAt: null },
    include: {
      photos: { orderBy: [{ context: "asc" }, { sortOrder: "asc" }] },
      operatingHours: { orderBy: { dayOfWeek: "asc" } },
      menuCategories: {
        where: { isActive: true },
        orderBy: { sortOrder: "asc" },
        include: {
          items: { where: { isAvailable: true }, orderBy: { sortOrder: "asc" } },
        },
      },
    },
  });
}

/**
 * Find the oldest COMPLETED reservation for this user at this restaurant
 * that has no review yet. Returns the reservationId, or null.
 */
async function getPendingReviewReservationId(
  clerkId: string,
  restaurantId: string
): Promise<string | null> {
  const user = await db.user.findUnique({
    where: { clerkId },
    select: { id: true },
  });
  if (!user) return null;

  const res = await db.reservation.findFirst({
    where: {
      userId: user.id,
      restaurantId,
      status: ReservationStatus.COMPLETED,
      review: null,
    },
    orderBy: { startsAt: "asc" },
    select: { id: true },
  });

  return res?.id ?? null;
}

async function getIsStaff(clerkId: string, restaurantId: string): Promise<boolean> {
  const user = await db.user.findUnique({
    where: { clerkId },
    select: {
      role: true,
      staffRoles: {
        where: { restaurantId },
        select: { id: true },
      },
    },
  });
  if (!user) return false;
  return user.role === "ADMIN" || user.staffRoles.length > 0;
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const r = await getRestaurant(slug);
  if (!r) return {};

  const appUrl = process.env["NEXT_PUBLIC_APP_URL"] ?? "https://tablegh.com";
  return {
    title: `${r.name} — ${r.neighborhood} | TableGH`,
    description: r.metaDescription ?? r.shortBio,
    openGraph: {
      title: r.name,
      description: r.shortBio,
      images: r.photos[0] ? [{ url: r.photos[0].url }] : [],
      url: `${appUrl}/restaurants/${r.slug}`,
    },
  };
}

export default async function RestaurantDetailPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const { userId: clerkId } = await auth();

  const [restaurant] = await Promise.all([getRestaurant(slug)]);
  if (!restaurant) notFound();

  // Auth-gated: resolved only for signed-in users
  const [pendingReviewReservationId, isStaff] = clerkId
    ? await Promise.all([
        getPendingReviewReservationId(clerkId, restaurant.id),
        getIsStaff(clerkId, restaurant.id),
      ])
    : [null, false];

  const now = toZonedTime(new Date(), ACCRA_TZ);
  const todayDow = DAY_MAP[now.getDay()] as DayOfWeek;
  const todayHours = restaurant.operatingHours.find((h) => h.dayOfWeek === todayDow);
  const openNow =
    todayHours && !todayHours.isClosed
      ? isOpenNow(todayHours.openTime, todayHours.closeTime)
      : false;

  const heroPhotos = restaurant.photos.slice(0, 5);
  const appUrl = process.env["NEXT_PUBLIC_APP_URL"] ?? "https://tablegh.com";

  return (
    <>
      <RestaurantJsonLd
        name={restaurant.name}
        description={restaurant.description}
        address={restaurant.address}
        ratingAvg={Number(restaurant.ratingAvg)}
        ratingCount={restaurant.ratingCount}
        phone={restaurant.phone}
        url={`${appUrl}/restaurants/${restaurant.slug}`}
        imageUrl={restaurant.photos[0]?.url}
      />

      {/* Hero photos */}
      <section className="relative h-80 sm:h-[480px] grid grid-cols-4 grid-rows-2 gap-1 bg-[#1A1A1A]">
        {heroPhotos.slice(0, 5).map((photo, i) => (
          <div
            key={photo.id}
            className={`relative overflow-hidden ${
              i === 0 ? "col-span-2 row-span-2" : "col-span-1 row-span-1"
            }`}
          >
            <Image
              src={photo.url}
              alt={photo.altText ?? `${restaurant.name} photo ${i + 1}`}
              fill
              className="object-cover"
              priority={i === 0}
              sizes={i === 0 ? "50vw" : "25vw"}
            />
          </div>
        ))}
      </section>

      {/* Main content */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Left column: info + menu + reviews */}
          <div className="lg:col-span-2 space-y-8">
            {/* Header */}
            <div>
              <div className="flex items-start justify-between gap-4 flex-wrap">
                <div>
                  <h1
                    className="text-4xl font-bold text-[#1A1A1A]"
                    style={{ fontFamily: "Fraunces, serif" }}
                  >
                    {restaurant.name}
                  </h1>
                  <div className="flex flex-wrap items-center gap-3 mt-2 text-sm text-[#5E5A57]">
                    <span className="flex items-center gap-1">
                      <MapPin size={14} aria-hidden="true" />
                      {restaurant.neighborhood.replace(/_/g, " ")}
                    </span>
                    <span
                      className="font-bold"
                      style={{ color: "#D4A853" }}
                      aria-label={`Price level: ${PRICE_LEVEL_LABELS[restaurant.priceLevel]}`}
                    >
                      {PRICE_LEVEL_LABELS[restaurant.priceLevel]}
                    </span>
                    <span
                      className={`flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${
                        openNow
                          ? "bg-[#10B981]/10 text-[#10B981]"
                          : "bg-[#EF4444]/10 text-[#EF4444]"
                      }`}
                    >
                      <Clock size={11} aria-hidden="true" />
                      {openNow
                        ? `Open · Closes ${todayHours ? minutesToDisplay(todayHours.closeTime) : ""}`
                        : "Closed now"}
                    </span>
                  </div>
                </div>

                <div className="text-right">
                  <div className="flex items-center gap-1 text-[#1A1A1A]">
                    <Star size={18} fill="#D4A853" stroke="none" aria-hidden="true" />
                    <span className="text-2xl font-bold" style={{ fontFamily: "Fraunces, serif" }}>
                      {Number(restaurant.ratingAvg).toFixed(1)}
                    </span>
                  </div>
                  <p className="text-sm text-[#8B8680]">{restaurant.ratingCount} reviews</p>
                </div>
              </div>

              <p className="mt-4 text-[#5E5A57] leading-relaxed">{restaurant.description}</p>

              {/* Tags */}
              <div className="flex flex-wrap gap-2 mt-4">
                {restaurant.cuisineTags.map((tag) => (
                  <span
                    key={tag}
                    className="px-3 py-1 rounded-full bg-[#FAF7F2] border border-[#E8E5E0] text-xs text-[#5E5A57] capitalize"
                  >
                    {tag.toLowerCase().replace(/_/g, " ")}
                  </span>
                ))}
                {restaurant.features.slice(0, 5).map((feat) => (
                  <span
                    key={feat}
                    className="px-3 py-1 rounded-full bg-[#0F7B5A]/8 text-xs text-[#0F7B5A] capitalize"
                  >
                    {feat.toLowerCase().replace(/_/g, " ")}
                  </span>
                ))}
              </div>
            </div>

            {/* Contact & Hours */}
            <div className="grid sm:grid-cols-2 gap-6">
              <div className="space-y-3">
                <h2 className="font-semibold text-[#1A1A1A]">Contact</h2>
                <div className="space-y-2 text-sm text-[#5E5A57]">
                  <p className="flex items-center gap-2">
                    <Phone size={14} aria-hidden="true" />
                    {restaurant.phone}
                  </p>
                  <p className="flex items-center gap-2">
                    <MapPin size={14} aria-hidden="true" />
                    {restaurant.address}
                  </p>
                  {restaurant.googleMapsUrl && (
                    <a
                      href={restaurant.googleMapsUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-2 text-[#0F7B5A] hover:underline"
                    >
                      <Globe size={14} aria-hidden="true" />
                      Open in Google Maps
                    </a>
                  )}
                </div>
              </div>

              <div>
                <h2 className="font-semibold text-[#1A1A1A] mb-3">Hours</h2>
                <div className="space-y-1.5 text-sm">
                  {restaurant.operatingHours.map((h) => {
                    const isToday = h.dayOfWeek === todayDow;
                    return (
                      <div
                        key={h.dayOfWeek}
                        className={`flex justify-between gap-4 ${isToday ? "font-medium text-[#0F7B5A]" : "text-[#5E5A57]"}`}
                      >
                        <span>{DAY_LABELS[h.dayOfWeek]}</span>
                        <span>
                          {h.isClosed
                            ? "Closed"
                            : `${minutesToDisplay(h.openTime)} – ${minutesToDisplay(h.closeTime)}`}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>

            {/* Menu */}
            <div>
              <h2
                className="text-2xl font-bold text-[#1A1A1A] mb-6"
                style={{ fontFamily: "Fraunces, serif" }}
              >
                Menu
              </h2>
              <div className="space-y-8">
                {restaurant.menuCategories.map((category) => (
                  <div key={category.id}>
                    <h3 className="font-semibold text-[#1A1A1A] mb-3 pb-2 border-b border-[#E8E5E0]">
                      {category.name}
                    </h3>
                    <div className="space-y-3">
                      {category.items.map((item) => (
                        <div
                          key={item.id}
                          className="flex items-start gap-4 py-2"
                        >
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="font-medium text-[#1A1A1A] text-sm">
                                {item.name}
                              </span>
                              {item.isSignatureDish && (
                                <span className="px-1.5 py-0.5 rounded text-xs bg-[#D4A853]/15 text-[#D4A853] font-medium">
                                  Signature
                                </span>
                              )}
                              {item.dietaryTags.map((tag) => (
                                <span
                                  key={tag}
                                  className="px-1.5 py-0.5 rounded text-xs bg-[#10B981]/10 text-[#10B981]"
                                  title={tag}
                                >
                                  {tag === "VEGETARIAN"
                                    ? "V"
                                    : tag === "VEGAN"
                                    ? "VG"
                                    : tag === "GLUTEN_FREE"
                                    ? "GF"
                                    : tag === "HALAL"
                                    ? "H"
                                    : tag.startsWith("SPICY")
                                    ? "🌶️".repeat(Number(tag.slice(-1)))
                                    : tag}
                                </span>
                              ))}
                            </div>
                            {item.description && (
                              <p className="text-xs text-[#8B8680] mt-0.5 line-clamp-2">
                                {item.description}
                              </p>
                            )}
                          </div>
                          <span className="font-semibold text-sm text-[#1A1A1A] flex-shrink-0">
                            {formatGHS(item.pricePesewas)}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Reviews */}
            <ReviewsSection
              restaurantSlug={restaurant.slug}
              restaurantName={restaurant.name}
              pendingReviewReservationId={pendingReviewReservationId ?? undefined}
              isStaff={isStaff}
            />
          </div>

          {/* Right column: sticky booking widget */}
          <div className="lg:col-span-1">
            <div className="sticky top-6">
              <BookingWidget
                restaurantSlug={restaurant.slug}
                restaurantId={restaurant.id}
                restaurantName={restaurant.name}
              />
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
