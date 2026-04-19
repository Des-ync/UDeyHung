"use client";

/**
 * /search — split-view restaurant discovery.
 *
 * Layout:
 *  - Desktop: left 420 px panel (filters + scrollable list) | right map (flex-1)
 *  - Mobile: stacked — search bar + filters, then map (40 vh), then card list
 *
 * Data flow:
 *  1. URL search params initialise filter state.
 *  2. TanStack Query fetches /api/v1/restaurants with active filters (limit=50).
 *  3. All results are passed to MapView for clustered display.
 *  4. onBoundsChange from MapView filters the sidebar list to visible restaurants.
 *  5. Filter changes update URL (shallow) so the page is shareable.
 */

import { Suspense, useState, useCallback, useMemo, useEffect } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import {
  Search,
  SlidersHorizontal,
  X,
  Star,
  MapPin,
  Clock,
  ChevronDown,
  ChevronUp,
  Loader2,
} from "lucide-react";
import Link from "next/link";
import Image from "next/image";
import { MapView, type MapRestaurant } from "@/components/restaurant/MapView";
import {
  PRICE_LABELS,
  NEIGHBORHOOD_LABELS,
  CUISINE_LABELS,
} from "@/lib/utils/mapUtils";

// ─── Types ─────────────────────────────────────────────────────────────────────

interface SearchResult {
  id: string;
  slug: string;
  name: string;
  shortBio: string;
  neighborhood: string;
  cuisineTags: string[];
  priceLevel: string;
  ratingAvg: number;
  ratingCount: number;
  coverPhoto: string | null;
  features: string[];
  isOpenNow: boolean;
  distanceKm?: number;
  latitude: number;
  longitude: number;
}

interface Bounds {
  north: number;
  south: number;
  east: number;
  west: number;
}

// ─── Filter config ─────────────────────────────────────────────────────────────

const PRICE_LEVELS = ["BUDGET", "MODERATE", "UPSCALE", "FINE"] as const;

const CUISINE_OPTIONS = [
  "GHANAIAN", "NIGERIAN", "LEBANESE", "CHINESE", "INDIAN",
  "ITALIAN", "CONTINENTAL", "SEAFOOD", "VEGAN", "MEDITERRANEAN",
  "AMERICAN", "BARBECUE", "PIZZA", "SUSHI",
] as const;

const NEIGHBORHOOD_OPTIONS = [
  "OSU", "EAST_LEGON", "CANTONMENTS", "AIRPORT_RESIDENTIAL",
  "LABONE", "RIDGE", "DZORWULU", "SPINTEX", "TEMA",
  "ACHIMOTA", "NORTH_LEGON",
] as const;

const SORT_OPTIONS = [
  { value: "relevance", label: "Best match" },
  { value: "rating", label: "Top rated" },
  { value: "distance", label: "Nearest first" },
  { value: "price_asc", label: "Price: low→high" },
  { value: "price_desc", label: "Price: high→low" },
] as const;

// ─── Fetch helper ──────────────────────────────────────────────────────────────

function buildApiUrl(filters: SearchFilters, userLat?: number, userLng?: number): string {
  const p = new URLSearchParams();
  if (filters.q) p.set("q", filters.q);
  filters.cuisines.forEach((c) => p.append("cuisine", c));
  filters.neighborhoods.forEach((n) => p.append("neighborhood", n));
  filters.priceLevels.forEach((pl) => p.append("priceLevel", pl));
  if (filters.openNow) p.set("openNow", "true");
  p.set("sortBy", filters.sortBy);
  p.set("limit", "50");
  if (userLat !== undefined) p.set("lat", String(userLat));
  if (userLng !== undefined) p.set("lng", String(userLng));
  return `/api/v1/restaurants?${p.toString()}`;
}

// ─── Filter state type ─────────────────────────────────────────────────────────

interface SearchFilters {
  q: string;
  cuisines: string[];
  neighborhoods: string[];
  priceLevels: string[];
  openNow: boolean;
  sortBy: string;
}

function filtersFromParams(sp: URLSearchParams): SearchFilters {
  return {
    q: sp.get("q") ?? "",
    cuisines: sp.getAll("cuisine"),
    neighborhoods: sp.getAll("neighborhood"),
    priceLevels: sp.getAll("priceLevel"),
    openNow: sp.get("openNow") === "true",
    sortBy: sp.get("sortBy") ?? "relevance",
  };
}

function filtersToParams(f: SearchFilters): URLSearchParams {
  const p = new URLSearchParams();
  if (f.q) p.set("q", f.q);
  f.cuisines.forEach((c) => p.append("cuisine", c));
  f.neighborhoods.forEach((n) => p.append("neighborhood", n));
  f.priceLevels.forEach((pl) => p.append("priceLevel", pl));
  if (f.openNow) p.set("openNow", "true");
  if (f.sortBy !== "relevance") p.set("sortBy", f.sortBy);
  return p;
}

// ─── Main component ────────────────────────────────────────────────────────────

export default function SearchPage() {
  return (
    <Suspense fallback={<SearchSkeleton />}>
      <SearchPageInner />
    </Suspense>
  );
}

function SearchPageInner() {
  const searchParams = useSearchParams();
  const router = useRouter();

  const [filters, setFilters] = useState<SearchFilters>(() =>
    filtersFromParams(searchParams)
  );
  const [debouncedQ, setDebouncedQ] = useState(filters.q);
  const [bounds, setBounds] = useState<Bounds | null>(null);
  const [showFilters, setShowFilters] = useState(false);
  const [userCoords, setUserCoords] = useState<{ lat: number; lng: number } | null>(null);
  const [geoError, setGeoError] = useState(false);

  // Request geolocation when distance sort is selected
  useEffect(() => {
    if (filters.sortBy !== "distance" || userCoords) return;
    if (!navigator.geolocation) {
      setGeoError(true);
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setUserCoords({ lat: pos.coords.latitude, lng: pos.coords.longitude });
        setGeoError(false);
      },
      () => setGeoError(true),
      { enableHighAccuracy: false, timeout: 10_000 }
    );
  }, [filters.sortBy, userCoords]);

  // Debounce text search
  useEffect(() => {
    const t = setTimeout(() => setDebouncedQ(filters.q), 350);
    return () => clearTimeout(t);
  }, [filters.q]);

  // Sync filters → URL (shallow)
  useEffect(() => {
    const qs = filtersToParams({ ...filters, q: debouncedQ }).toString();
    router.replace(`/search${qs ? `?${qs}` : ""}`, { scroll: false });
  }, [debouncedQ, filters.cuisines, filters.neighborhoods, filters.priceLevels, filters.openNow, filters.sortBy, router]);

  const { data, isFetching } = useQuery({
    queryKey: ["restaurants-search", debouncedQ, filters.cuisines, filters.neighborhoods, filters.priceLevels, filters.openNow, filters.sortBy, userCoords],
    queryFn: async () => {
      const url = buildApiUrl({ ...filters, q: debouncedQ }, userCoords?.lat, userCoords?.lng);
      const res = await fetch(url);
      if (!res.ok) throw new Error("Search failed");
      const json = await res.json() as { data: { items: SearchResult[] } };
      return json.data.items;
    },
    staleTime: 30_000,
    placeholderData: (prev) => prev,
  });

  const allRestaurants = data ?? [];

  // Filter sidebar list by map bounds
  const visibleRestaurants = useMemo(() => {
    if (!bounds) return allRestaurants;
    return allRestaurants.filter(
      (r) =>
        r.latitude >= bounds.south &&
        r.latitude <= bounds.north &&
        r.longitude >= bounds.west &&
        r.longitude <= bounds.east
    );
  }, [allRestaurants, bounds]);

  // Convert to MapRestaurant format
  const mapRestaurants: MapRestaurant[] = useMemo(
    () =>
      allRestaurants.map((r) => ({
        id: r.id,
        slug: r.slug,
        name: r.name,
        neighborhood: r.neighborhood,
        priceLevel: r.priceLevel,
        cuisineTags: r.cuisineTags,
        ratingAvg: r.ratingAvg,
        ratingCount: r.ratingCount,
        coverPhoto: r.coverPhoto,
        isOpenNow: r.isOpenNow,
        latitude: r.latitude,
        longitude: r.longitude,
      })),
    [allRestaurants]
  );

  const handleBoundsChange = useCallback((b: Bounds) => {
    setBounds(b);
  }, []);

  const updateFilter = <K extends keyof SearchFilters>(key: K, val: SearchFilters[K]) => {
    setFilters((prev) => ({ ...prev, [key]: val }));
  };

  const toggleArray = (key: "cuisines" | "neighborhoods" | "priceLevels", value: string) => {
    setFilters((prev) => {
      const arr = prev[key];
      return {
        ...prev,
        [key]: arr.includes(value) ? arr.filter((v) => v !== value) : [...arr, value],
      };
    });
  };

  const hasActiveFilters =
    filters.cuisines.length > 0 ||
    filters.neighborhoods.length > 0 ||
    filters.priceLevels.length > 0 ||
    filters.openNow;

  const clearFilters = () =>
    setFilters((prev) => ({
      ...prev,
      cuisines: [],
      neighborhoods: [],
      priceLevels: [],
      openNow: false,
    }));

  return (
    <div className="flex flex-col lg:flex-row h-[calc(100vh-64px)] overflow-hidden bg-[#FAF7F2]">
      {/* ── Left panel ── */}
      <div className="flex flex-col w-full lg:w-[420px] lg:flex-shrink-0 h-full overflow-hidden border-r border-[#E8E5E0] bg-white">
        {/* Search + filter toggle bar */}
        <div className="p-4 border-b border-[#E8E5E0] space-y-3 flex-shrink-0">
          <div className="relative">
            <Search
              size={16}
              className="absolute left-3 top-1/2 -translate-y-1/2 text-[#8B8680]"
            />
            <input
              type="search"
              placeholder="Search restaurants…"
              value={filters.q}
              onChange={(e) => updateFilter("q", e.target.value)}
              className="w-full pl-9 pr-4 py-2.5 rounded-xl border border-[#E8E5E0] bg-[#FAF7F2] text-sm text-[#1A1A1A] placeholder-[#C5C0BB] focus:outline-none focus:ring-2 focus:ring-[#0F7B5A]/30 focus:border-[#0F7B5A]"
            />
            {filters.q && (
              <button
                onClick={() => updateFilter("q", "")}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-[#8B8680] hover:text-[#1A1A1A]"
              >
                <X size={14} />
              </button>
            )}
          </div>

          <div className="flex items-center gap-2">
            {/* Sort */}
            <select
              value={filters.sortBy}
              onChange={(e) => updateFilter("sortBy", e.target.value)}
              className="flex-1 text-xs py-2 px-3 rounded-xl border border-[#E8E5E0] bg-white text-[#1A1A1A] focus:outline-none focus:ring-2 focus:ring-[#0F7B5A]/30"
            >
              {SORT_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>

            {/* Open now */}
            <button
              onClick={() => updateFilter("openNow", !filters.openNow)}
              className={`flex items-center gap-1.5 text-xs px-3 py-2 rounded-xl border font-medium transition-colors flex-shrink-0 ${
                filters.openNow
                  ? "bg-[#0F7B5A] text-white border-[#0F7B5A]"
                  : "bg-white text-[#5E5A57] border-[#E8E5E0] hover:border-[#0F7B5A]/40"
              }`}
            >
              <Clock size={12} />
              Open now
            </button>

            {/* Filter toggle */}
            <button
              onClick={() => setShowFilters((v) => !v)}
              className={`flex items-center gap-1.5 text-xs px-3 py-2 rounded-xl border font-medium transition-colors flex-shrink-0 ${
                hasActiveFilters
                  ? "bg-[#0F7B5A]/10 text-[#0F7B5A] border-[#0F7B5A]/30"
                  : "bg-white text-[#5E5A57] border-[#E8E5E0] hover:border-[#0F7B5A]/40"
              }`}
            >
              <SlidersHorizontal size={12} />
              Filters
              {hasActiveFilters && (
                <span className="w-4 h-4 rounded-full bg-[#0F7B5A] text-white text-[10px] flex items-center justify-center">
                  {filters.cuisines.length + filters.neighborhoods.length + filters.priceLevels.length}
                </span>
              )}
              {showFilters ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
            </button>
          </div>

          {/* Expanded filter panel */}
          {showFilters && (
            <FilterPanel
              filters={filters}
              toggleArray={toggleArray}
              onClear={clearFilters}
              hasActive={hasActiveFilters}
            />
          )}
        </div>

        {/* Geolocation hint when distance sort selected without location */}
        {filters.sortBy === "distance" && !userCoords && (
          <div className="px-4 py-2 border-b border-[#E8E5E0] bg-amber-50 text-xs text-amber-700">
            {geoError
              ? "Location access denied. Results sorted by rating instead."
              : "Requesting your location for distance sorting…"}
          </div>
        )}

        {/* Results count */}
        <div className="px-4 py-2.5 border-b border-[#E8E5E0] flex items-center justify-between flex-shrink-0">
          <p className="text-xs text-[#8B8680]">
            {isFetching ? (
              <span className="flex items-center gap-1.5">
                <Loader2 size={12} className="animate-spin" />
                Searching…
              </span>
            ) : (
              <>
                <span className="font-semibold text-[#1A1A1A]">{visibleRestaurants.length}</span>
                {bounds ? " in this area" : " restaurants"}
                {allRestaurants.length !== visibleRestaurants.length && (
                  <span className="text-[#C5C0BB]"> ({allRestaurants.length} total)</span>
                )}
              </>
            )}
          </p>
          {bounds && (
            <button
              onClick={() => setBounds(null)}
              className="text-xs text-[#0F7B5A] hover:underline"
            >
              Show all
            </button>
          )}
        </div>

        {/* Scrollable list */}
        <div className="flex-1 overflow-y-auto">
          {visibleRestaurants.length === 0 && !isFetching ? (
            <EmptyState hasFilters={hasActiveFilters || !!filters.q} />
          ) : (
            <ul className="divide-y divide-[#F5F2ED]">
              {visibleRestaurants.map((r) => (
                <li key={r.id}>
                  <RestaurantListCard restaurant={r} />
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>

      {/* ── Map panel ── */}
      <div className="flex-1 h-64 lg:h-full relative">
        <MapView
          restaurants={mapRestaurants}
          onBoundsChange={handleBoundsChange}
        />
        {isFetching && (
          <div className="absolute top-3 left-1/2 -translate-x-1/2 bg-white shadow-md rounded-full px-3 py-1.5 flex items-center gap-2 text-xs text-[#1A1A1A] font-medium pointer-events-none">
            <Loader2 size={12} className="animate-spin text-[#0F7B5A]" />
            Updating map…
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Filter panel ──────────────────────────────────────────────────────────────

function FilterPanel({
  filters,
  toggleArray,
  onClear,
  hasActive,
}: {
  filters: SearchFilters;
  toggleArray: (key: "cuisines" | "neighborhoods" | "priceLevels", value: string) => void;
  onClear: () => void;
  hasActive: boolean;
}) {
  const [showMoreCuisines, setShowMoreCuisines] = useState(false);
  const [showMoreNeighborhoods, setShowMoreNeighborhoods] = useState(false);

  const cuisineList = showMoreCuisines ? CUISINE_OPTIONS : CUISINE_OPTIONS.slice(0, 6);
  const neighborhoodList = showMoreNeighborhoods
    ? NEIGHBORHOOD_OPTIONS
    : NEIGHBORHOOD_OPTIONS.slice(0, 5);

  return (
    <div className="space-y-4 pt-1">
      {/* Price level */}
      <div>
        <p className="text-xs font-semibold text-[#5E5A57] uppercase tracking-wider mb-2">
          Price
        </p>
        <div className="flex gap-2 flex-wrap">
          {PRICE_LEVELS.map((pl) => (
            <button
              key={pl}
              onClick={() => toggleArray("priceLevels", pl)}
              className={`px-3 py-1.5 rounded-lg border text-xs font-medium transition-colors ${
                filters.priceLevels.includes(pl)
                  ? "bg-[#0F7B5A] text-white border-[#0F7B5A]"
                  : "bg-white text-[#5E5A57] border-[#E8E5E0] hover:border-[#0F7B5A]/40"
              }`}
            >
              {PRICE_LABELS[pl]}
            </button>
          ))}
        </div>
      </div>

      {/* Cuisine */}
      <div>
        <p className="text-xs font-semibold text-[#5E5A57] uppercase tracking-wider mb-2">
          Cuisine
        </p>
        <div className="flex gap-2 flex-wrap">
          {cuisineList.map((c) => (
            <button
              key={c}
              onClick={() => toggleArray("cuisines", c)}
              className={`px-3 py-1 rounded-full border text-xs transition-colors ${
                filters.cuisines.includes(c)
                  ? "bg-[#0F7B5A] text-white border-[#0F7B5A]"
                  : "bg-[#FAF7F2] text-[#5E5A57] border-[#E8E5E0] hover:border-[#0F7B5A]/40"
              }`}
            >
              {CUISINE_LABELS[c] ?? c}
            </button>
          ))}
          <button
            onClick={() => setShowMoreCuisines((v) => !v)}
            className="px-3 py-1 rounded-full border text-xs border-[#E8E5E0] text-[#8B8680] hover:text-[#0F7B5A]"
          >
            {showMoreCuisines ? "Less" : `+${CUISINE_OPTIONS.length - 6} more`}
          </button>
        </div>
      </div>

      {/* Neighborhood */}
      <div>
        <p className="text-xs font-semibold text-[#5E5A57] uppercase tracking-wider mb-2">
          Neighborhood
        </p>
        <div className="flex gap-2 flex-wrap">
          {neighborhoodList.map((n) => (
            <button
              key={n}
              onClick={() => toggleArray("neighborhoods", n)}
              className={`px-3 py-1 rounded-full border text-xs transition-colors ${
                filters.neighborhoods.includes(n)
                  ? "bg-[#0F7B5A] text-white border-[#0F7B5A]"
                  : "bg-[#FAF7F2] text-[#5E5A57] border-[#E8E5E0] hover:border-[#0F7B5A]/40"
              }`}
            >
              {NEIGHBORHOOD_LABELS[n] ?? n}
            </button>
          ))}
          <button
            onClick={() => setShowMoreNeighborhoods((v) => !v)}
            className="px-3 py-1 rounded-full border text-xs border-[#E8E5E0] text-[#8B8680] hover:text-[#0F7B5A]"
          >
            {showMoreNeighborhoods ? "Less" : `+${NEIGHBORHOOD_OPTIONS.length - 5} more`}
          </button>
        </div>
      </div>

      {hasActive && (
        <button
          onClick={onClear}
          className="text-xs text-red-500 hover:underline font-medium"
        >
          Clear all filters
        </button>
      )}
    </div>
  );
}

// ─── Restaurant list card ──────────────────────────────────────────────────────

function RestaurantListCard({ restaurant }: { restaurant: SearchResult }) {
  return (
    <Link
      href={`/restaurants/${restaurant.slug}`}
      className="flex gap-3 p-4 hover:bg-[#FAF7F2] transition-colors group"
    >
      {/* Thumbnail */}
      <div className="relative w-20 h-20 rounded-xl overflow-hidden flex-shrink-0 bg-[#E8E5E0]">
        {restaurant.coverPhoto ? (
          <Image
            src={restaurant.coverPhoto}
            alt={restaurant.name}
            fill
            className="object-cover"
            sizes="80px"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-2xl">
            🍽️
          </div>
        )}
      </div>

      {/* Info */}
      <div className="flex-1 min-w-0">
        <div className="flex items-start justify-between gap-2">
          <p className="text-sm font-semibold text-[#1A1A1A] line-clamp-1 group-hover:text-[#0F7B5A] transition-colors">
            {restaurant.name}
          </p>
          <span
            className={`text-[10px] px-1.5 py-0.5 rounded flex-shrink-0 font-medium ${
              restaurant.isOpenNow
                ? "bg-green-50 text-green-700"
                : "bg-[#F5F2ED] text-[#8B8680]"
            }`}
          >
            {restaurant.isOpenNow ? "Open" : "Closed"}
          </span>
        </div>

        <p className="text-xs text-[#8B8680] mt-0.5 line-clamp-2 leading-relaxed">
          {restaurant.shortBio}
        </p>

        <div className="flex items-center gap-2 mt-1.5 text-xs text-[#8B8680]">
          <span className="flex items-center gap-0.5">
            <Star size={11} fill="#D4A853" stroke="none" />
            <span className="text-[#1A1A1A] font-medium">
              {restaurant.ratingAvg.toFixed(1)}
            </span>
            <span>({restaurant.ratingCount})</span>
          </span>
          <span className="text-[#C5C0BB]">·</span>
          <span className="text-[#D4A853] font-medium">
            {PRICE_LABELS[restaurant.priceLevel] ?? "₵"}
          </span>
          <span className="text-[#C5C0BB]">·</span>
          <span className="flex items-center gap-0.5">
            <MapPin size={10} />
            {NEIGHBORHOOD_LABELS[restaurant.neighborhood] ?? restaurant.neighborhood}
          </span>
          {restaurant.distanceKm !== undefined && (
            <>
              <span className="text-[#C5C0BB]">·</span>
              <span>{restaurant.distanceKm} km</span>
            </>
          )}
        </div>
      </div>
    </Link>
  );
}

// ─── Empty state ───────────────────────────────────────────────────────────────

function EmptyState({ hasFilters }: { hasFilters: boolean }) {
  return (
    <div className="flex flex-col items-center justify-center h-full py-16 px-6 text-center">
      <div className="text-4xl mb-3">🗺️</div>
      <p className="text-sm font-semibold text-[#1A1A1A] mb-1">
        {hasFilters ? "No restaurants match your filters" : "No restaurants in this area"}
      </p>
      <p className="text-xs text-[#8B8680]">
        {hasFilters
          ? "Try removing some filters or adjusting your search."
          : "Pan or zoom the map to explore more of Accra."}
      </p>
    </div>
  );
}

// ─── Loading skeleton ──────────────────────────────────────────────────────────

function SearchSkeleton() {
  return (
    <div className="flex h-[calc(100vh-64px)] overflow-hidden">
      <div className="w-full lg:w-[420px] border-r border-[#E8E5E0] bg-white flex flex-col">
        <div className="p-4 border-b border-[#E8E5E0] space-y-3">
          <div className="h-10 rounded-xl bg-[#F5F2ED] animate-pulse" />
          <div className="flex gap-2">
            <div className="flex-1 h-9 rounded-xl bg-[#F5F2ED] animate-pulse" />
            <div className="w-24 h-9 rounded-xl bg-[#F5F2ED] animate-pulse" />
            <div className="w-20 h-9 rounded-xl bg-[#F5F2ED] animate-pulse" />
          </div>
        </div>
        <div className="flex-1 p-4 space-y-4">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="flex gap-3 animate-pulse">
              <div className="w-20 h-20 rounded-xl bg-[#F5F2ED]" />
              <div className="flex-1 space-y-2 pt-1">
                <div className="h-4 bg-[#F5F2ED] rounded w-3/4" />
                <div className="h-3 bg-[#F5F2ED] rounded w-full" />
                <div className="h-3 bg-[#F5F2ED] rounded w-1/2" />
              </div>
            </div>
          ))}
        </div>
      </div>
      <div className="flex-1 bg-[#E8E5E0] animate-pulse" />
    </div>
  );
}
