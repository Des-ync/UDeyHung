"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import Link from "next/link";
import {
  CalendarDays,
  Heart,
  Star,
  Trophy,
  Clock,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  RotateCcw,
  MapPin,
  Loader2,
  AlertCircle,
  Sparkles,
  ChevronRight,
} from "lucide-react";
import { formatGHS } from "@/lib/utils/currency";

// ─── Types ────────────────────────────────────────────────────────────────────

interface RestaurantSnap {
  id: string;
  slug: string;
  name: string;
  neighborhood: string;
  photos: { thumbnailUrl: string | null; url: string }[];
}

interface Reservation {
  id: string;
  ref: string;
  status: string;
  partySize: number;
  date: string;
  timeSlot: number;
  startsAt: string;
  occasion: string | null;
  canRebook: boolean;
  canReview: boolean;
  restaurant: RestaurantSnap;
  review: { id: string; rating: number } | null;
}

interface PointsTransaction {
  id: string;
  points: number;
  description: string;
  createdAt: string;
}

interface FavoriteRestaurant {
  id: string;
  slug: string;
  name: string;
  neighborhood: string;
  priceLevel: string;
  cuisineTags: string[];
  ratingAvg: number;
  ratingCount: number;
  photos: { thumbnailUrl: string | null; url: string }[];
}

interface DinerData {
  user: {
    id: string;
    name: string;
    phone: string;
    email: string | null;
    loyaltyPoints: number;
    tier: "BRONZE" | "SILVER" | "GOLD";
    nextTierPoints: number | null;
    pointsToNextTier: number;
  };
  reservations: Reservation[];
  pointsHistory: PointsTransaction[];
  favorites: FavoriteRestaurant[];
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function minutesToDisplay(m: number): string {
  const h = Math.floor(m / 60);
  const min = m % 60;
  const suffix = h >= 12 ? "PM" : "AM";
  const dh = h > 12 ? h - 12 : h === 0 ? 12 : h;
  return `${dh}:${min.toString().padStart(2, "0")} ${suffix}`;
}

const STATUS_META: Record<string, { label: string; icon: React.ElementType; color: string }> = {
  CONFIRMED:       { label: "Confirmed",   icon: CheckCircle2,  color: "text-blue-600" },
  PENDING:         { label: "Pending",     icon: Clock,         color: "text-amber-600" },
  SEATED:          { label: "Seated",      icon: CheckCircle2,  color: "text-[#0F7B5A]" },
  COMPLETED:       { label: "Completed",   icon: CheckCircle2,  color: "text-[#8B8680]" },
  CANCELLED_DINER: { label: "Cancelled",   icon: XCircle,       color: "text-red-500" },
  CANCELLED_VENUE: { label: "Venue cancelled", icon: XCircle,   color: "text-red-500" },
  NO_SHOW:         { label: "No-show",     icon: AlertTriangle, color: "text-red-600" },
};

const TIER_META = {
  BRONZE: { label: "Bronze",   color: "text-[#8B6914]",  bg: "bg-[#FEF3C7]",  next: 100 },
  SILVER: { label: "Silver",   color: "text-[#6B7280]",  bg: "bg-[#F3F4F6]",  next: 500 },
  GOLD:   { label: "Gold",     color: "text-[#D4A853]",  bg: "bg-[#FEF9EE]",  next: null },
};

const PRICE_LABELS: Record<string, string> = {
  BUDGET: "₵", MODERATE: "₵₵", UPSCALE: "₵₵₵", FINE: "₵₵₵₵",
};

// ─── Sub-components ───────────────────────────────────────────────────────────

function TabButton({
  active,
  onClick,
  icon: Icon,
  label,
  count,
}: {
  active: boolean;
  onClick: () => void;
  icon: React.ElementType;
  label: string;
  count?: number;
}) {
  return (
    <button
      onClick={onClick}
      className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium transition-colors ${
        active
          ? "bg-[#0F7B5A] text-white"
          : "text-[#5E5A57] hover:bg-[#E8E5E0]"
      }`}
    >
      <Icon size={15} />
      {label}
      {count !== undefined && count > 0 && (
        <span
          className={`text-xs px-1.5 py-0.5 rounded-full font-medium ${
            active ? "bg-white/20 text-white" : "bg-[#E8E5E0] text-[#5E5A57]"
          }`}
        >
          {count}
        </span>
      )}
    </button>
  );
}

function ReservationCard({
  res,
  onRebook,
}: {
  res: Reservation;
  onRebook: (res: Reservation) => void;
}) {
  const s = STATUS_META[res.status] ?? STATUS_META["COMPLETED"]!;
  const Icon = s.icon;
  const photo =
    res.restaurant.photos[0]?.thumbnailUrl ?? res.restaurant.photos[0]?.url;

  const bookingDate = new Date(res.startsAt).toLocaleDateString("en-GH", {
    weekday: "short",
    day: "numeric",
    month: "short",
    year: "numeric",
    timeZone: "Africa/Accra",
  });

  return (
    <div className="bg-white border border-[#E8E5E0] rounded-2xl overflow-hidden flex">
      {/* Photo strip */}
      <div className="w-20 sm:w-28 flex-shrink-0 bg-[#F5F2ED] relative">
        {photo ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={photo} alt="" className="w-full h-full object-cover" />
        ) : (
          <div className="w-full h-full flex items-center justify-center">
            <MapPin size={20} className="text-[#C5C0BB]" />
          </div>
        )}
      </div>

      {/* Content */}
      <div className="flex-1 p-4 min-w-0">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <Link
              href={`/restaurants/${res.restaurant.slug}`}
              className="font-semibold text-[#1A1A1A] hover:text-[#0F7B5A] transition-colors text-sm truncate block"
            >
              {res.restaurant.name}
            </Link>
            <p className="text-xs text-[#8B8680] mt-0.5">
              {bookingDate} · {minutesToDisplay(res.timeSlot)} ·{" "}
              {res.partySize} {res.partySize === 1 ? "guest" : "guests"}
            </p>
          </div>

          <div className="flex items-center gap-1 flex-shrink-0">
            <Icon size={13} className={s.color} />
            <span className={`text-xs font-medium ${s.color}`}>{s.label}</span>
          </div>
        </div>

        <p className="text-[10px] text-[#C5C0BB] font-mono mt-1">{res.ref}</p>

        {/* Actions */}
        <div className="flex items-center gap-2 mt-3 flex-wrap">
          {res.canRebook && (
            <button
              onClick={() => onRebook(res)}
              className="flex items-center gap-1.5 text-xs px-3 py-1.5 bg-[#0F7B5A] text-white rounded-lg hover:bg-[#0a6349] transition-colors"
            >
              <RotateCcw size={11} />
              Rebook
            </button>
          )}

          {res.canReview && (
            <Link
              href={`/restaurants/${res.restaurant.slug}?review=${res.id}`}
              className="flex items-center gap-1.5 text-xs px-3 py-1.5 border border-[#D4A853] text-[#9A7235] rounded-lg hover:bg-[#FEF9EE] transition-colors"
            >
              <Star size={11} />
              Leave a review
            </Link>
          )}

          {res.review && (
            <span className="flex items-center gap-1 text-xs text-[#8B8680]">
              <Star size={11} className="text-[#D4A853] fill-[#D4A853]" />
              You rated {res.review.rating}/5
            </span>
          )}

          {(res.status === "CONFIRMED" || res.status === "PENDING") && (
            <Link
              href={`/booking/${res.ref}`}
              className="text-xs text-[#0F7B5A] hover:underline"
            >
              View booking →
            </Link>
          )}
        </div>
      </div>
    </div>
  );
}

function LoyaltyCard({ user, history }: { user: DinerData["user"]; history: PointsTransaction[] }) {
  const tier = TIER_META[user.tier];
  const progress =
    user.tier === "GOLD"
      ? 100
      : user.tier === "SILVER"
        ? Math.round(((user.loyaltyPoints - 100) / 400) * 100)
        : Math.round((user.loyaltyPoints / 100) * 100);

  return (
    <div className="bg-white border border-[#E8E5E0] rounded-2xl overflow-hidden">
      {/* Header */}
      <div className={`px-5 py-4 ${tier.bg} border-b border-[#E8E5E0]`}>
        <div className="flex items-center justify-between">
          <div>
            <div className="flex items-center gap-2">
              <Trophy size={18} className={tier.color} />
              <span className={`font-bold text-lg ${tier.color}`} style={{ fontFamily: "Fraunces, serif" }}>
                {tier.label} Member
              </span>
            </div>
            <p className="text-sm text-[#5E5A57] mt-0.5">
              <span className="font-semibold text-[#1A1A1A] tabular-nums">
                {user.loyaltyPoints.toLocaleString()}
              </span>{" "}
              points
            </p>
          </div>
          <div className="text-right">
            <p className="text-xs text-[#8B8680]">10 pts per booking</p>
            {user.nextTierPoints && (
              <p className="text-xs text-[#0F7B5A] mt-0.5">
                {user.pointsToNextTier} pts to next tier
              </p>
            )}
          </div>
        </div>

        {/* Progress bar */}
        {user.tier !== "GOLD" && (
          <div className="mt-3">
            <div className="h-2 bg-white/50 rounded-full overflow-hidden">
              <div
                className={`h-full rounded-full transition-all ${
                  user.tier === "SILVER" ? "bg-[#D4A853]" : "bg-[#8B6914]"
                }`}
                style={{ width: `${Math.min(progress, 100)}%` }}
              />
            </div>
            <div className="flex justify-between text-[10px] text-[#8B8680] mt-1">
              <span>{user.tier === "SILVER" ? "100" : "0"}</span>
              <span>{user.tier === "SILVER" ? "500 (Gold)" : "100 (Silver)"}</span>
            </div>
          </div>
        )}
      </div>

      {/* Recent points */}
      {history.length > 0 && (
        <div className="divide-y divide-[#E8E5E0]">
          {history.map((tx) => (
            <div key={tx.id} className="flex items-center justify-between px-5 py-3">
              <p className="text-sm text-[#3D3936] truncate flex-1">
                {tx.description}
              </p>
              <span
                className={`text-sm font-semibold tabular-nums flex-shrink-0 ml-3 ${
                  tx.points > 0 ? "text-[#0F7B5A]" : "text-red-500"
                }`}
              >
                {tx.points > 0 ? "+" : ""}
                {tx.points} pts
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function FavoriteCard({
  r,
  onUnsave,
}: {
  r: FavoriteRestaurant;
  onUnsave: (id: string) => void;
}) {
  const photo = r.photos[0]?.thumbnailUrl ?? r.photos[0]?.url;

  return (
    <div className="bg-white border border-[#E8E5E0] rounded-2xl overflow-hidden group">
      {/* Photo */}
      <div className="relative h-32 bg-[#F5F2ED]">
        {photo ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={photo}
            alt={r.name}
            className="w-full h-full object-cover"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center">
            <MapPin size={24} className="text-[#C5C0BB]" />
          </div>
        )}
        <button
          onClick={() => onUnsave(r.id)}
          className="absolute top-2 right-2 p-1.5 bg-white/80 backdrop-blur-sm rounded-full hover:bg-white transition-colors"
          aria-label="Remove from saved"
        >
          <Heart size={14} className="text-red-500 fill-red-500" />
        </button>
      </div>

      {/* Info */}
      <div className="p-3">
        <Link
          href={`/restaurants/${r.slug}`}
          className="font-semibold text-sm text-[#1A1A1A] hover:text-[#0F7B5A] transition-colors line-clamp-1"
        >
          {r.name}
        </Link>
        <p className="text-xs text-[#8B8680] mt-0.5">
          {r.neighborhood.replace(/_/g, " ")} ·{" "}
          <span className="text-[#D4A853] font-medium">
            {PRICE_LABELS[r.priceLevel] ?? "₵"}
          </span>
        </p>
        <div className="flex items-center gap-1 mt-1.5">
          <Star size={11} className="text-[#D4A853] fill-[#D4A853]" />
          <span className="text-xs text-[#3D3936] tabular-nums">
            {r.ratingAvg.toFixed(1)}
          </span>
          <span className="text-xs text-[#C5C0BB]">({r.ratingCount})</span>
        </div>
      </div>
    </div>
  );
}

// ─── Rebook modal: pre-fill the booking widget for the same restaurant ────────

function RebookBanner({
  res,
  onClose,
}: {
  res: Reservation;
  onClose: () => void;
}) {
  return (
    <div className="bg-[#F0FAF6] border border-[#0F7B5A]/20 rounded-2xl p-4 flex items-start gap-4">
      <Sparkles size={20} className="text-[#0F7B5A] flex-shrink-0 mt-0.5" />
      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold text-[#1A1A1A]">
          Rebook at {res.restaurant.name}
        </p>
        <p className="text-xs text-[#5E5A57] mt-0.5">
          {res.partySize} {res.partySize === 1 ? "guest" : "guests"}
          {res.occasion ? ` · ${res.occasion.replace(/_/g, " ")}` : ""}
          {" — "}just choose a new date and time.
        </p>
        <div className="flex gap-2 mt-3 flex-wrap">
          <Link
            href={`/restaurants/${res.restaurant.slug}/book?partySize=${res.partySize}${
              res.occasion ? `&occasion=${res.occasion}` : ""
            }`}
            className="flex items-center gap-1.5 text-xs px-3 py-2 bg-[#0F7B5A] text-white rounded-lg hover:bg-[#0a6349] transition-colors"
          >
            <CalendarDays size={12} />
            Choose date & time
          </Link>
          <button
            onClick={onClose}
            className="text-xs px-3 py-2 border border-[#E8E5E0] rounded-lg hover:bg-[#F5F2ED] text-[#5E5A57]"
          >
            Dismiss
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Main Dashboard ───────────────────────────────────────────────────────────

type Tab = "bookings" | "saved" | "points";

export function DinerDashboard() {
  const qc = useQueryClient();
  const [activeTab, setActiveTab] = useState<Tab>("bookings");
  const [rebookTarget, setRebookTarget] = useState<Reservation | null>(null);
  const [statusFilter, setStatusFilter] = useState<string>("all");

  const { data, isLoading, error } = useQuery<DinerData>({
    queryKey: ["me"],
    queryFn: async () => {
      const res = await fetch("/api/v1/me");
      if (!res.ok) throw new Error("Failed to load profile");
      const json = await res.json();
      return json.data as DinerData;
    },
  });

  const unsaveMutation = useMutation({
    mutationFn: async (restaurantId: string) => {
      await fetch("/api/v1/me/favorites", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ restaurantId }),
      });
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["me"] }),
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="animate-spin text-[#0F7B5A]" size={28} />
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="flex items-center gap-2 text-red-600 p-6">
        <AlertCircle size={18} />
        <span>Failed to load dashboard.</span>
      </div>
    );
  }

  const { user, reservations, pointsHistory, favorites } = data;

  const filteredReservations =
    statusFilter === "all"
      ? reservations
      : statusFilter === "upcoming"
        ? reservations.filter((r) =>
            ["PENDING", "CONFIRMED", "SEATED"].includes(r.status)
          )
        : reservations.filter((r) =>
            ["COMPLETED", "CANCELLED_DINER", "CANCELLED_VENUE", "NO_SHOW"].includes(
              r.status
            )
          );

  const upcomingCount = reservations.filter((r) =>
    ["PENDING", "CONFIRMED", "SEATED"].includes(r.status)
  ).length;

  return (
    <div className="max-w-4xl mx-auto px-4 py-8 space-y-6">
      {/* Welcome header */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1
            className="text-2xl font-bold text-[#1A1A1A]"
            style={{ fontFamily: "Fraunces, serif" }}
          >
            Hello, {user.name.split(" ")[0]}
          </h1>
          <p className="text-sm text-[#8B8680] mt-0.5">
            {user.phone} {user.email ? `· ${user.email}` : ""}
          </p>
        </div>

        {/* Loyalty pill */}
        <div
          className={`flex items-center gap-2 px-3 py-2 rounded-xl ${TIER_META[user.tier].bg}`}
        >
          <Trophy size={15} className={TIER_META[user.tier].color} />
          <span className={`text-sm font-semibold ${TIER_META[user.tier].color}`}>
            {TIER_META[user.tier].label}
          </span>
          <span className="text-sm font-bold tabular-nums text-[#1A1A1A]">
            {user.loyaltyPoints.toLocaleString()} pts
          </span>
        </div>
      </div>

      {/* Rebook banner */}
      {rebookTarget && (
        <RebookBanner
          res={rebookTarget}
          onClose={() => setRebookTarget(null)}
        />
      )}

      {/* Tabs */}
      <div className="flex gap-2 flex-wrap">
        <TabButton
          active={activeTab === "bookings"}
          onClick={() => setActiveTab("bookings")}
          icon={CalendarDays}
          label="Bookings"
          count={upcomingCount}
        />
        <TabButton
          active={activeTab === "saved"}
          onClick={() => setActiveTab("saved")}
          icon={Heart}
          label="Saved"
          count={favorites.length}
        />
        <TabButton
          active={activeTab === "points"}
          onClick={() => setActiveTab("points")}
          icon={Trophy}
          label="Points"
        />
      </div>

      {/* ── Bookings tab ── */}
      {activeTab === "bookings" && (
        <div className="space-y-4">
          {/* Sub-filter */}
          <div className="flex gap-2">
            {(["all", "upcoming", "past"] as const).map((f) => (
              <button
                key={f}
                onClick={() => setStatusFilter(f)}
                className={`text-xs px-3 py-1.5 rounded-lg font-medium border transition-colors capitalize ${
                  statusFilter === f
                    ? "bg-[#1A1A1A] text-white border-[#1A1A1A]"
                    : "bg-white text-[#5E5A57] border-[#E8E5E0] hover:border-[#1A1A1A]/30"
                }`}
              >
                {f}
              </button>
            ))}
          </div>

          {filteredReservations.length === 0 ? (
            <div className="text-center py-12 border-2 border-dashed border-[#E8E5E0] rounded-2xl">
              <CalendarDays size={36} className="mx-auto mb-3 text-[#C5C0BB]" />
              <p className="text-sm text-[#8B8680]">No bookings here yet.</p>
              <Link
                href="/"
                className="inline-flex items-center gap-1.5 mt-3 text-sm text-[#0F7B5A] font-medium hover:underline"
              >
                Discover restaurants
                <ChevronRight size={14} />
              </Link>
            </div>
          ) : (
            <div className="space-y-3">
              {filteredReservations.map((res) => (
                <ReservationCard
                  key={res.id}
                  res={res}
                  onRebook={(r) => {
                    setRebookTarget(r);
                    window.scrollTo({ top: 0, behavior: "smooth" });
                  }}
                />
              ))}
            </div>
          )}
        </div>
      )}

      {/* ── Saved tab ── */}
      {activeTab === "saved" && (
        <div>
          {favorites.length === 0 ? (
            <div className="text-center py-12 border-2 border-dashed border-[#E8E5E0] rounded-2xl">
              <Heart size={36} className="mx-auto mb-3 text-[#C5C0BB]" />
              <p className="text-sm text-[#8B8680]">No saved restaurants yet.</p>
              <Link
                href="/"
                className="inline-flex items-center gap-1.5 mt-3 text-sm text-[#0F7B5A] font-medium hover:underline"
              >
                Explore restaurants
                <ChevronRight size={14} />
              </Link>
            </div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
              {favorites.map((r) => (
                <FavoriteCard
                  key={r.id}
                  r={r}
                  onUnsave={(id) => unsaveMutation.mutate(id)}
                />
              ))}
            </div>
          )}
        </div>
      )}

      {/* ── Points tab ── */}
      {activeTab === "points" && (
        <LoyaltyCard user={user} history={pointsHistory} />
      )}
    </div>
  );
}
