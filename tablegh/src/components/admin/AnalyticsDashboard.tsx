"use client";

/**
 * Analytics dashboard.
 * - KPI cards
 * - Covers-per-day sparkline (pure CSS/SVG — no chart lib dep for MVP)
 * - Peak times heatmap (color-scaled grid)
 * - Status breakdown bar
 * - Top party sizes
 */

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  Users,
  TrendingUp,
  AlertTriangle,
  DollarSign,
  Calendar,
  RefreshCw,
  BarChart3,
} from "lucide-react";
import { formatGHS } from "@/lib/utils/currency";

// ─── Types ────────────────────────────────────────────────────────────────────

interface AnalyticsData {
  kpis: {
    totalReservations: number;
    totalCovers: number;
    avgPartySize: number;
    noShowRate: number;
    noShowCount: number;
    cancelledCount: number;
    depositRevenuePesewas: number;
    fromDate: string;
    toDate: string;
  };
  coversPerDay: Array<{ date: string; covers: number }>;
  heatmap: Array<{
    day: string;
    dayIndex: number;
    timeSlot: number;
    displayTime: string;
    value: number;
  }>;
  maxHeatmapValue: number;
  statusBreakdown: Record<string, number>;
  topPartySizes: Array<{ size: number; count: number }>;
}

type DateRange = "7d" | "30d" | "90d";

const DATE_RANGES: Record<DateRange, { label: string; days: number }> = {
  "7d":  { label: "Last 7 days",  days: 7 },
  "30d": { label: "Last 30 days", days: 30 },
  "90d": { label: "Last 90 days", days: 90 },
};

function dateRangeDates(range: DateRange) {
  const to = new Date();
  const from = new Date();
  from.setDate(from.getDate() - (DATE_RANGES[range].days - 1));
  return {
    from: from.toISOString().split("T")[0]!,
    to: to.toISOString().split("T")[0]!,
  };
}

// ─── Component ───────────────────────────────────────────────────────────────

export function AnalyticsDashboard({ restaurantId }: { restaurantId: string }) {
  const [range, setRange] = useState<DateRange>("30d");
  const { from, to } = dateRangeDates(range);

  const { data, isLoading, isError } = useQuery({
    queryKey: ["admin-analytics", restaurantId, from, to],
    queryFn: async () => {
      const params = new URLSearchParams({ restaurantId, from, to });
      const res = await fetch(`/api/v1/admin/analytics?${params}`);
      if (!res.ok) throw new Error("Failed to fetch analytics");
      const json = (await res.json()) as { data: AnalyticsData };
      return json.data;
    },
  });

  return (
    <div className="p-6 max-w-6xl mx-auto space-y-8">
      {/* Header + range picker */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <h1
          className="text-2xl font-bold text-[#1A1A1A]"
          style={{ fontFamily: "Fraunces, serif" }}
        >
          Analytics
        </h1>
        <div className="flex rounded-xl border border-[#E8E5E0] overflow-hidden">
          {(Object.keys(DATE_RANGES) as DateRange[]).map((r) => (
            <button
              key={r}
              onClick={() => setRange(r)}
              className={`px-3 py-2 text-xs font-medium transition-colors ${
                range === r
                  ? "bg-[#0F7B5A] text-white"
                  : "text-[#5E5A57] hover:bg-[#F5F2ED]"
              }`}
            >
              {DATE_RANGES[r].label}
            </button>
          ))}
        </div>
      </div>

      {isLoading && (
        <div className="flex items-center gap-2 text-[#8B8680] py-12">
          <RefreshCw size={18} className="animate-spin" /> Loading analytics...
        </div>
      )}

      {isError && (
        <div className="bg-[#FEE2E2] text-[#991B1B] p-4 rounded-xl text-sm">
          Failed to load analytics data.
        </div>
      )}

      {data && (
        <>
          {/* KPI cards */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <KpiCard
              icon={<Users size={20} />}
              label="Total covers"
              value={data.kpis.totalCovers.toLocaleString()}
              sub={`${data.kpis.totalReservations} reservations`}
              color="#0F7B5A"
            />
            <KpiCard
              icon={<TrendingUp size={20} />}
              label="Avg party size"
              value={data.kpis.avgPartySize.toFixed(1)}
              sub="guests per booking"
              color="#3B82F6"
            />
            <KpiCard
              icon={<AlertTriangle size={20} />}
              label="No-show rate"
              value={`${data.kpis.noShowRate}%`}
              sub={`${data.kpis.noShowCount} no-shows`}
              color={data.kpis.noShowRate > 10 ? "#EF4444" : "#F59E0B"}
            />
            <KpiCard
              icon={<DollarSign size={20} />}
              label="Deposit revenue"
              value={formatGHS(data.kpis.depositRevenuePesewas)}
              sub="from deposits collected"
              color="#D4A853"
            />
          </div>

          {/* Covers per day sparkline */}
          <div className="bg-white rounded-2xl border border-[#E8E5E0] p-5">
            <h2 className="font-semibold text-[#1A1A1A] mb-4 flex items-center gap-2">
              <BarChart3 size={17} className="text-[#0F7B5A]" />
              Covers per day
            </h2>
            <CoversChart data={data.coversPerDay} />
          </div>

          {/* Peak times heatmap */}
          <div className="bg-white rounded-2xl border border-[#E8E5E0] p-5 overflow-x-auto">
            <h2 className="font-semibold text-[#1A1A1A] mb-4 flex items-center gap-2">
              <Calendar size={17} className="text-[#0F7B5A]" />
              Peak times heatmap
              <span className="text-xs text-[#8B8680] font-normal">
                (covers by day × time)
              </span>
            </h2>
            <PeakHeatmap
              cells={data.heatmap}
              maxValue={data.maxHeatmapValue}
            />
          </div>

          {/* Bottom row: status breakdown + party sizes */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <div className="bg-white rounded-2xl border border-[#E8E5E0] p-5">
              <h2 className="font-semibold text-[#1A1A1A] mb-4">
                Status breakdown
              </h2>
              <StatusBreakdown
                breakdown={data.statusBreakdown}
                total={data.kpis.totalReservations}
              />
            </div>

            <div className="bg-white rounded-2xl border border-[#E8E5E0] p-5">
              <h2 className="font-semibold text-[#1A1A1A] mb-4">
                Popular party sizes
              </h2>
              <PartySizeChart sizes={data.topPartySizes} />
            </div>
          </div>
        </>
      )}
    </div>
  );
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function KpiCard({
  icon,
  label,
  value,
  sub,
  color,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  sub: string;
  color: string;
}) {
  return (
    <div className="bg-white rounded-2xl border border-[#E8E5E0] p-5">
      <div className="flex items-center justify-between mb-3">
        <p className="text-xs font-medium text-[#8B8680] uppercase tracking-wide">
          {label}
        </p>
        <div
          className="p-2 rounded-xl"
          style={{ background: `${color}15`, color }}
          aria-hidden="true"
        >
          {icon}
        </div>
      </div>
      <p
        className="text-3xl font-bold"
        style={{ fontFamily: "Fraunces, serif", color }}
      >
        {value}
      </p>
      <p className="text-xs text-[#8B8680] mt-1">{sub}</p>
    </div>
  );
}

/** SVG-based sparkline bar chart — no external library needed. */
function CoversChart({
  data,
}: {
  data: Array<{ date: string; covers: number }>;
}) {
  if (data.length === 0) return <p className="text-sm text-[#8B8680]">No data</p>;

  const max = Math.max(...data.map((d) => d.covers), 1);
  const H = 120;
  const barW = Math.max(4, Math.floor(800 / data.length) - 2);

  return (
    <div className="overflow-x-auto">
      <svg
        width={Math.max(600, data.length * (barW + 2))}
        height={H + 28}
        aria-label="Covers per day bar chart"
        role="img"
      >
        {data.map((d, i) => {
          const barH = Math.round((d.covers / max) * H);
          const x = i * (barW + 2);
          return (
            <g key={d.date}>
              <rect
                x={x}
                y={H - barH}
                width={barW}
                height={barH}
                rx={3}
                fill="#0F7B5A"
                opacity={0.8}
              />
              {/* Show label every ~7 bars to avoid overlap */}
              {i % Math.ceil(data.length / 10) === 0 && (
                <text
                  x={x + barW / 2}
                  y={H + 16}
                  textAnchor="middle"
                  fontSize={9}
                  fill="#8B8680"
                >
                  {d.date.slice(5)} {/* MM-DD */}
                </text>
              )}
              <title>{`${d.date}: ${d.covers} covers`}</title>
            </g>
          );
        })}
      </svg>
    </div>
  );
}

/** Color-scaled heatmap grid: rows = time slots, columns = days */
function PeakHeatmap({
  cells,
  maxValue,
}: {
  cells: AnalyticsData["heatmap"];
  maxValue: number;
}) {
  const DAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
  const timeSlots = [
    ...new Set(cells.map((c) => c.timeSlot)),
  ].sort((a, b) => a - b);

  // Build lookup: day × timeSlot → value
  const lookup = new Map<string, number>();
  cells.forEach((c) => lookup.set(`${c.dayIndex}-${c.timeSlot}`, c.value));

  function heatColor(value: number): string {
    if (value === 0) return "#F5F2ED";
    const intensity = value / maxValue;
    // Interpolate from light green to deep green
    const r = Math.round(15 + (1 - intensity) * (250 - 15));
    const g = Math.round(123 + (1 - intensity) * (250 - 123));
    const b = Math.round(90 + (1 - intensity) * (240 - 90));
    return `rgb(${r},${g},${b})`;
  }

  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: `60px repeat(7, 1fr)`,
        gap: 2,
        minWidth: 400,
      }}
      role="grid"
      aria-label="Peak times heatmap"
    >
      {/* Header row */}
      <div />
      {DAYS.map((d) => (
        <div
          key={d}
          className="text-xs font-semibold text-[#5E5A57] text-center pb-1"
        >
          {d}
        </div>
      ))}

      {/* Time rows */}
      {timeSlots.map((slot) => (
        <>
          <div
            key={`label-${slot}`}
            className="text-xs text-[#8B8680] flex items-center justify-end pr-2"
            style={{ height: 24 }}
          >
            {cells.find((c) => c.timeSlot === slot)?.displayTime}
          </div>
          {DAYS.map((_, dayIndex) => {
            const value = lookup.get(`${dayIndex}-${slot}`) ?? 0;
            return (
              <div
                key={`${dayIndex}-${slot}`}
                className="rounded-sm flex items-center justify-center text-xs font-medium transition-colors"
                style={{
                  height: 24,
                  background: heatColor(value),
                  color: value > maxValue * 0.6 ? "white" : "#5E5A57",
                }}
                title={`${DAYS[dayIndex]} ${cells.find((c) => c.timeSlot === slot)?.displayTime}: ${value} covers`}
                role="gridcell"
                aria-label={`${value} covers`}
              >
                {value > 0 ? value : ""}
              </div>
            );
          })}
        </>
      ))}
    </div>
  );
}

const STATUS_LABELS: Record<string, [string, string]> = {
  CONFIRMED:       ["#10B981", "Confirmed"],
  COMPLETED:       ["#0F7B5A", "Completed"],
  SEATED:          ["#3B82F6", "Seated"],
  PENDING:         ["#F59E0B", "Pending"],
  CANCELLED_DINER: ["#9CA3AF", "Cancelled"],
  CANCELLED_VENUE: ["#9CA3AF", "Cancelled (Venue)"],
  NO_SHOW:         ["#EF4444", "No Show"],
};

function StatusBreakdown({
  breakdown,
  total,
}: {
  breakdown: Record<string, number>;
  total: number;
}) {
  const sorted = Object.entries(breakdown).sort((a, b) => b[1] - a[1]);

  return (
    <div className="space-y-3">
      {sorted.map(([status, count]) => {
        const [color, label] = STATUS_LABELS[status] ?? ["#8B8680", status];
        const pct = total > 0 ? Math.round((count / total) * 100) : 0;
        return (
          <div key={status}>
            <div className="flex items-center justify-between text-sm mb-1">
              <span className="text-[#5E5A57]">{label}</span>
              <span className="font-medium text-[#1A1A1A]">
                {count} ({pct}%)
              </span>
            </div>
            <div className="h-2 rounded-full bg-[#F5F2ED] overflow-hidden">
              <div
                className="h-full rounded-full transition-all duration-500"
                style={{ width: `${pct}%`, background: color }}
              />
            </div>
          </div>
        );
      })}
    </div>
  );
}

function PartySizeChart({
  sizes,
}: {
  sizes: Array<{ size: number; count: number }>;
}) {
  if (sizes.length === 0)
    return <p className="text-sm text-[#8B8680]">No data</p>;

  const maxCount = Math.max(...sizes.map((s) => s.count), 1);

  return (
    <div className="space-y-2">
      {sizes.map(({ size, count }) => {
        const pct = Math.round((count / maxCount) * 100);
        return (
          <div key={size} className="flex items-center gap-3">
            <span className="text-sm font-medium text-[#1A1A1A] w-16 flex-shrink-0">
              {size} {size === 1 ? "guest" : "guests"}
            </span>
            <div className="flex-1 h-5 rounded-lg bg-[#F5F2ED] overflow-hidden">
              <div
                className="h-full rounded-lg flex items-center px-2 text-xs font-medium text-white transition-all duration-500"
                style={{ width: `${pct}%`, background: "#0F7B5A", minWidth: 28 }}
              >
                {count}
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
