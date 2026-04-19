/**
 * /walkin/[restaurantSlug]
 *
 * Public walk-in join page. Guests land here after scanning the QR code.
 * Shows the restaurant info, queue count, and a join form.
 */

import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { WalkInJoinForm } from "./WalkInJoinForm";

interface Props {
  params: Promise<{ restaurantSlug: string }>;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { restaurantSlug } = await params;
  const r = await db.restaurant.findUnique({
    where: { slug: restaurantSlug, isActive: true },
    select: { name: true },
  });
  return {
    title: r ? `Join Queue — ${r.name}` : "Walk-In Queue",
  };
}

export default async function WalkInPage({ params }: Props) {
  const { restaurantSlug } = await params;

  const restaurant = await db.restaurant.findUnique({
    where: { slug: restaurantSlug, isActive: true, deletedAt: null },
    select: {
      id: true,
      name: true,
      slug: true,
      neighborhood: true,
      photos: {
        where: { context: "EXTERIOR" },
        orderBy: { sortOrder: "asc" },
        take: 1,
        select: { url: true },
      },
    },
  });

  if (!restaurant) notFound();

  // Current active queue length
  const queueLength = await db.walkInEntry.count({
    where: {
      restaurantId: restaurant.id,
      status: { in: ["QUEUED", "NOTIFIED"] },
    },
  });

  const coverPhoto = restaurant.photos[0]?.url ?? null;

  return (
    <div className="min-h-screen bg-[#FAF7F2] flex flex-col">
      {/* Header */}
      <div className="relative h-48 bg-[#1A1A1A] overflow-hidden">
        {coverPhoto && (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={coverPhoto}
            alt={restaurant.name}
            className="w-full h-full object-cover opacity-60"
          />
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-[#1A1A1A]/80 to-transparent" />
        <div className="absolute bottom-4 left-4 right-4">
          <p className="text-xs font-medium text-[#D4A853] uppercase tracking-wider mb-1">
            Walk-In Queue
          </p>
          <h1 className="text-2xl font-bold text-white font-serif">
            {restaurant.name}
          </h1>
          <p className="text-sm text-white/70 mt-0.5">
            {restaurant.neighborhood.replace(/_/g, " ")}
          </p>
        </div>
      </div>

      {/* Queue status banner */}
      <div
        className={`px-4 py-3 text-center text-sm font-medium ${
          queueLength === 0
            ? "bg-green-50 text-green-700"
            : "bg-amber-50 text-amber-700"
        }`}
      >
        {queueLength === 0
          ? "No wait — walk right in!"
          : queueLength === 1
          ? "1 party ahead of you"
          : `${queueLength} parties ahead of you`}
      </div>

      {/* Join form */}
      <div className="flex-1 flex items-start justify-center p-4 pt-8">
        <div className="w-full max-w-md">
          <WalkInJoinForm
            restaurantId={restaurant.id}
            restaurantSlug={restaurant.slug}
            queueLength={queueLength}
          />
        </div>
      </div>
    </div>
  );
}
