"use client";

import Link from "next/link";
import Image from "next/image";
import { motion } from "framer-motion";
import { Star, MapPin, Heart, Clock } from "lucide-react";
import { PRICE_LEVEL_LABELS } from "@/lib/utils/currency";
import type { PriceLevel, Neighborhood } from "@prisma/client";

interface RestaurantCard {
  id: string;
  slug: string;
  name: string;
  shortBio: string;
  neighborhood: Neighborhood;
  cuisineTags: string[];
  priceLevel: PriceLevel;
  ratingAvg: number;
  ratingCount: number;
  coverPhoto: string | null;
  features: string[];
  isOpenNow: boolean;
  distanceKm?: number;
}

interface RestaurantGridProps {
  title: string;
  subtitle?: string;
  restaurants: RestaurantCard[];
  variant?: "grid" | "scroll";
  accentColor?: "primary" | "accent";
}

const NEIGHBORHOOD_LABELS: Record<string, string> = {
  OSU: "Osu",
  CANTONMENTS: "Cantonments",
  AIRPORT_RESIDENTIAL: "Airport Res.",
  EAST_LEGON: "East Legon",
  LABONE: "Labone",
  RIDGE: "Ridge",
  DZORWULU: "Dzorwulu",
  SPINTEX: "Spintex",
  TEMA: "Tema",
  ACHIMOTA: "Achimota",
  NORTH_LEGON: "North Legon",
};

export function RestaurantGrid({
  title,
  subtitle,
  restaurants,
  variant = "grid",
  accentColor = "primary",
}: RestaurantGridProps) {
  if (restaurants.length === 0) return null;

  const accentStyle =
    accentColor === "accent"
      ? { color: "#D4A853" }
      : { color: "#0F7B5A" };

  return (
    <section>
      <div className="flex items-end justify-between mb-6">
        <div>
          <h2
            className="text-3xl font-bold text-[#1A1A1A] text-balance"
            style={{ fontFamily: "Fraunces, serif", ...accentStyle }}
          >
            {title}
          </h2>
          {subtitle && (
            <p className="text-[#8B8680] mt-1 text-base">{subtitle}</p>
          )}
        </div>
        <Link
          href={`/search?${new URLSearchParams({ q: title }).toString()}`}
          className="text-sm font-medium hover:underline hidden sm:block"
          style={{ color: "#0F7B5A" }}
          aria-label={`View all ${title}`}
        >
          View all →
        </Link>
      </div>

      <div
        className={
          variant === "scroll"
            ? "flex gap-5 overflow-x-auto pb-4 snap-x snap-mandatory scrollbar-hide"
            : "grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5"
        }
      >
        {restaurants.map((restaurant, i) => (
          <motion.div
            key={restaurant.id}
            initial={{ opacity: 0, y: 12 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.4, delay: i * 0.05 }}
            className={variant === "scroll" ? "flex-none w-72 snap-start" : ""}
          >
            <RestaurantCardComponent restaurant={restaurant} />
          </motion.div>
        ))}
      </div>
    </section>
  );
}

function RestaurantCardComponent({ restaurant }: { restaurant: RestaurantCard }) {
  return (
    <Link
      href={`/restaurants/${restaurant.slug}`}
      className="group block rounded-2xl overflow-hidden bg-white card-hover"
      style={{ boxShadow: "0 1px 3px rgba(26,26,26,0.08), 0 4px 16px rgba(26,26,26,0.06)" }}
      aria-label={`View ${restaurant.name}`}
    >
      {/* Cover image */}
      <div className="relative aspect-[4/3] overflow-hidden bg-[#E8E5E0]">
        {restaurant.coverPhoto ? (
          <Image
            src={restaurant.coverPhoto}
            alt={`${restaurant.name} — exterior`}
            fill
            className="object-cover transition-transform duration-500 group-hover:scale-105"
            sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 25vw"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-[#8B8680]">
            <span className="text-4xl">🍽️</span>
          </div>
        )}

        {/* Open now badge */}
        <div className="absolute top-3 left-3">
          <span
            className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${
              restaurant.isOpenNow
                ? "bg-[#10B981]/90 text-white"
                : "bg-[#1A1A1A]/60 text-[#C4BFB9]"
            }`}
          >
            <Clock size={10} aria-hidden="true" />
            {restaurant.isOpenNow ? "Open" : "Closed"}
          </span>
        </div>

        {/* Favourite button */}
        <button
          className="absolute top-3 right-3 w-8 h-8 rounded-full bg-white/90 backdrop-blur flex items-center justify-center shadow hover:scale-110 transition-transform"
          aria-label={`Save ${restaurant.name}`}
          onClick={(e) => e.preventDefault()}
        >
          <Heart size={15} className="text-[#8B8680]" aria-hidden="true" />
        </button>

        {/* Price level */}
        <div className="absolute bottom-3 right-3 px-2 py-0.5 rounded-md bg-[#1A1A1A]/70 backdrop-blur text-[#D4A853] text-xs font-bold tracking-wide">
          {PRICE_LEVEL_LABELS[restaurant.priceLevel]}
        </div>
      </div>

      {/* Card body */}
      <div className="p-4">
        <div className="flex items-start justify-between gap-2 mb-1">
          <h3 className="font-semibold text-[#1A1A1A] text-base leading-tight group-hover:text-[#0F7B5A] transition-colors line-clamp-1">
            {restaurant.name}
          </h3>
          <div className="flex items-center gap-1 flex-shrink-0">
            <Star
              size={13}
              fill="#D4A853"
              stroke="none"
              aria-hidden="true"
            />
            <span className="text-sm font-medium text-[#1A1A1A]">
              {restaurant.ratingAvg.toFixed(1)}
            </span>
            <span className="text-xs text-[#8B8680]">
              ({restaurant.ratingCount})
            </span>
          </div>
        </div>

        <p className="text-[#8B8680] text-sm line-clamp-2 leading-relaxed mb-3">
          {restaurant.shortBio}
        </p>

        <div className="flex items-center gap-3 text-xs text-[#8B8680]">
          <span className="flex items-center gap-1">
            <MapPin size={11} aria-hidden="true" />
            {NEIGHBORHOOD_LABELS[restaurant.neighborhood] ?? restaurant.neighborhood}
          </span>
          {restaurant.distanceKm !== undefined && (
            <span>{restaurant.distanceKm} km away</span>
          )}
          {restaurant.cuisineTags[0] && (
            <span className="px-2 py-0.5 rounded-full bg-[#FAF7F2] border border-[#E8E5E0] capitalize text-[#5E5A57]">
              {restaurant.cuisineTags[0].toLowerCase().replace("_", " ")}
            </span>
          )}
        </div>
      </div>
    </Link>
  );
}
