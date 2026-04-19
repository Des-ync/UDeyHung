"use client";

import { useQuery } from "@tanstack/react-query";
import Link from "next/link";
import {
  CalendarDays,
  MapPin,
  UtensilsCrossed,
  BarChart3,
  Users,
  Star,
  Clock,
  CheckCircle2,
  AlertCircle,
  Loader2,
  TrendingUp,
  XCircle,
} from "lucide-react";

// ─── Types ────────────────────────────────────────────────────────────────────

interface DashboardData {
  restaurant: {
    id: string;
    name: string;
    isActive: boolean;
    defaultTurnTime: number;
    ratingAvg: number;
    ratingCount: number;
  };
  today: {
    total: number;
    pending: number;
    confirmed: number;
    seated: number;
    completed: number;
    noShows: number;
    totalCovers: number;
  };
  upcoming: UpcomingReservation[];
  meta: {
    activeTableCount: number;
    totalMenuItems: number;
    ratingAvg: number;
    ratingCount: number;
  };
}

interface UpcomingReservation {
  id: string;
  ref: string;
  guestName: string;
  partySize: number;
  timeSlot: number;
  startsAt: string;
  status: string;
  occasion: string | null;
  specialReqs: string | null;
  tableLabel: string | null;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function minutesToDisplay(minutes: number): string {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  const suffix = h >= 12 ? "PM" : "AM";
  const displayH = h > 12 ? h - 12 : h === 0 ? 12 : h;
  return `${displayH}:${m.toString().padStart(2, "0")} ${suffix}`;
}

const STATUS_STYLES: Record<
  string,
  { label: string; dot: string; text: string }
> = {
  CONFIRMED: {
    label: "Confirmed",
    dot: "bg-blue-500",
    text: "text-blue-700",
  },
  PENDING: { label: "Pending", dot: "bg-amber-400", text: "text-amber-700" },
  SEATED: { label: "Seated", dot: "bg-[#0F7B5A]", text: "text-[#0F7B5A]" },
  COMPLETED: {
    label: "Completed",
    dot: "bg-gray-400",
    text: "text-gray-600",
  },
  NO_SHOW: { label: "No-show", dot: "bg-red-400", text: "text-red-600" },
};

// ─── KPI Card ─────────────────────────────────────────────────────────────────

function KpiCard({
  label,
  value,
  sub,
  icon: Icon,
  color = "green",
}: {
  label: string;
  value: string | number;
  sub?: string;
  icon: React.ElementType;
  color?: "green" | "gold" | "blue" | "red" | "gray";
}) {
  const iconColor = {
    green: "text-[#0F7B5A] bg-[#0F7B5A]/10",
    gold: "text-[#D4A853] bg-[#D4A853]/10",
    blue: "text-blue-600 bg-blue-50",
    red: "text-red-600 bg-red-50",
    gray: "text-gray-500 bg-gray-100",
  }[color];

  return (
    <div className="bg-white rounded-2xl border border-[#E8E5E0] p-5 flex items-start gap-4">
      <div className={`p-2.5 rounded-xl flex-shrink-0 ${iconColor}`}>
        <Icon size={20} />
      </div>
      <div className="min-w-0">
        <p className="text-2xl font-bold text-[#1A1A1A] tabular-nums">
          {value}
        </p>
        <p className="text-sm text-[#5E5A57] mt-0.5">{label}</p>
        {sub && <p className="text-xs text-[#8B8680] mt-0.5">{sub}</p>}
      </div>
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

export function AdminDashboard({ restaurantId }: { restaurantId: string }) {
  const { data, isLoading, error } = useQuery<DashboardData>({
    queryKey: ["admin-dashboard", restaurantId],
    queryFn: async () => {
      const res = await fetch(
        `/api/v1/admin/dashboard?restaurantId=${restaurantId}`
      );
      if (!res.ok) throw new Error("Failed to load dashboard");
      const json = await res.json();
      return json.data as DashboardData;
    },
    refetchInterval: 60_000, // refresh every minute
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
        <span>Failed to load dashboard data. Please refresh.</span>
      </div>
    );
  }

  const { restaurant, today, upcoming, meta } = data;

  const now = new Date();
  const hour = now.getHours();
  const greeting =
    hour < 12 ? "Good morning" : hour < 17 ? "Good afternoon" : "Good evening";

  const todayDate = now.toLocaleDateString("en-GH", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: "Africa/Accra",
  });

  const QUICK_LINKS = [
    {
      href: `/admin/${restaurantId}/reservations`,
      icon: CalendarDays,
      label: "Reservations",
      desc: "Calendar & management",
    },
    {
      href: `/admin/${restaurantId}/floor-plan`,
      icon: MapPin,
      label: "Floor Plan",
      desc: "Tables & seating",
    },
    {
      href: `/admin/${restaurantId}/menu`,
      icon: UtensilsCrossed,
      label: "Menu",
      desc: "Items & categories",
    },
    {
      href: `/admin/${restaurantId}/analytics`,
      icon: BarChart3,
      label: "Analytics",
      desc: "Trends & heatmap",
    },
  ];

  return (
    <div className="p-6 max-w-5xl mx-auto space-y-8">
      {/* Greeting */}
      <div>
        <h1
          className="text-2xl font-bold text-[#1A1A1A]"
          style={{ fontFamily: "Fraunces, serif" }}
        >
          {greeting},{" "}
          <span className="text-[#0F7B5A]">{restaurant.name}</span>
        </h1>
        <p className="text-sm text-[#8B8680] mt-1">{todayDate}</p>
        {!restaurant.isActive && (
          <div className="mt-3 flex items-center gap-2 px-4 py-2.5 bg-amber-50 border border-amber-200 rounded-xl text-sm text-amber-700">
            <AlertCircle size={15} />
            This restaurant is currently set to inactive (hidden from guests).
          </div>
        )}
      </div>

      {/* Today KPIs */}
      <section>
        <h2 className="text-sm font-semibold text-[#5E5A57] uppercase tracking-wide mb-3">
          Today at a glance
        </h2>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
          <KpiCard
            label="Total bookings"
            value={today.total}
            icon={CalendarDays}
            color="green"
          />
          <KpiCard
            label="Pending"
            value={today.pending}
            icon={Clock}
            color="gold"
          />
          <KpiCard
            label="Confirmed"
            value={today.confirmed}
            icon={CheckCircle2}
            color="blue"
          />
          <KpiCard
            label="Seated now"
            value={today.seated}
            icon={Users}
            color="green"
          />
          <KpiCard
            label="Covers today"
            value={today.totalCovers}
            icon={TrendingUp}
            color="gold"
          />
          <KpiCard
            label="No-shows"
            value={today.noShows}
            icon={XCircle}
            color="red"
          />
        </div>
      </section>

      {/* Quick links + meta stats side by side */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Upcoming reservations */}
        <section className="lg:col-span-2">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-sm font-semibold text-[#5E5A57] uppercase tracking-wide">
              Upcoming (next 24 h)
            </h2>
            <Link
              href={`/admin/${restaurantId}/reservations`}
              className="text-xs text-[#0F7B5A] hover:underline"
            >
              View all →
            </Link>
          </div>

          <div className="bg-white rounded-2xl border border-[#E8E5E0] divide-y divide-[#E8E5E0]">
            {upcoming.length === 0 ? (
              <div className="py-10 text-center text-sm text-[#8B8680]">
                No upcoming reservations in the next 24 hours.
              </div>
            ) : (
              upcoming.map((res) => {
                const s = STATUS_STYLES[res.status] ?? STATUS_STYLES["PENDING"]!;
                return (
                  <div
                    key={res.id}
                    className="flex items-center gap-3 px-4 py-3"
                  >
                    {/* Time */}
                    <div className="w-16 flex-shrink-0 text-center">
                      <p className="text-sm font-semibold text-[#1A1A1A] tabular-nums">
                        {minutesToDisplay(res.timeSlot)}
                      </p>
                      <p className="text-[10px] text-[#8B8680]">
                        {new Date(res.startsAt).toLocaleDateString("en-GH", {
                          weekday: "short",
                          timeZone: "Africa/Accra",
                        })}
                      </p>
                    </div>

                    {/* Guest info */}
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-[#1A1A1A] truncate">
                        {res.guestName}
                      </p>
                      <p className="text-xs text-[#8B8680]">
                        {res.partySize}{" "}
                        {res.partySize === 1 ? "guest" : "guests"}
                        {res.tableLabel && ` · Table ${res.tableLabel}`}
                        {res.occasion && ` · ${res.occasion.replace("_", " ")}`}
                      </p>
                    </div>

                    {/* Status badge */}
                    <div className="flex items-center gap-1.5 flex-shrink-0">
                      <span
                        className={`w-1.5 h-1.5 rounded-full ${s.dot}`}
                      />
                      <span className={`text-xs font-medium ${s.text}`}>
                        {s.label}
                      </span>
                    </div>

                    {/* Ref */}
                    <span className="text-xs text-[#C5C0BB] font-mono flex-shrink-0">
                      {res.ref}
                    </span>
                  </div>
                );
              })
            )}
          </div>
        </section>

        {/* Right column: restaurant stats + quick links */}
        <section className="space-y-4">
          {/* Restaurant stats */}
          <div>
            <h2 className="text-sm font-semibold text-[#5E5A57] uppercase tracking-wide mb-3">
              Restaurant
            </h2>
            <div className="bg-white rounded-2xl border border-[#E8E5E0] divide-y divide-[#E8E5E0]">
              <div className="flex items-center justify-between px-4 py-3">
                <span className="text-sm text-[#5E5A57]">Active tables</span>
                <span className="text-sm font-semibold text-[#1A1A1A]">
                  {meta.activeTableCount}
                </span>
              </div>
              <div className="flex items-center justify-between px-4 py-3">
                <span className="text-sm text-[#5E5A57]">Menu items</span>
                <span className="text-sm font-semibold text-[#1A1A1A]">
                  {meta.totalMenuItems}
                </span>
              </div>
              <div className="flex items-center justify-between px-4 py-3">
                <span className="text-sm text-[#5E5A57]">Rating</span>
                <span className="text-sm font-semibold text-[#1A1A1A] flex items-center gap-1">
                  <Star
                    size={13}
                    className="text-[#D4A853] fill-[#D4A853]"
                  />
                  {meta.ratingAvg > 0
                    ? `${meta.ratingAvg.toFixed(1)} (${meta.ratingCount})`
                    : "No reviews yet"}
                </span>
              </div>
              <div className="flex items-center justify-between px-4 py-3">
                <span className="text-sm text-[#5E5A57]">Turn time</span>
                <span className="text-sm font-semibold text-[#1A1A1A]">
                  {restaurant.defaultTurnTime} min
                </span>
              </div>
            </div>
          </div>

          {/* Quick links */}
          <div>
            <h2 className="text-sm font-semibold text-[#5E5A57] uppercase tracking-wide mb-3">
              Quick links
            </h2>
            <div className="grid grid-cols-2 gap-2">
              {QUICK_LINKS.map(({ href, icon: Icon, label, desc }) => (
                <Link
                  key={href}
                  href={href}
                  className="bg-white rounded-xl border border-[#E8E5E0] px-3 py-3 hover:border-[#0F7B5A]/40 hover:bg-[#F0FAF6] transition-colors group"
                >
                  <Icon
                    size={18}
                    className="text-[#0F7B5A] mb-1.5 group-hover:scale-110 transition-transform"
                  />
                  <p className="text-xs font-semibold text-[#1A1A1A]">
                    {label}
                  </p>
                  <p className="text-[11px] text-[#8B8680] mt-0.5">{desc}</p>
                </Link>
              ))}
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}
