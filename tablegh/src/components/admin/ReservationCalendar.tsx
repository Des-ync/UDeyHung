"use client";

/**
 * Reservation calendar with day/week views and drag-to-reassign.
 *
 * Architecture:
 * - Grid rows = 30-min time slots (e.g. 10:00–23:30)
 * - Grid columns = tables (one column per active table)
 * - Reservation blocks are positioned by CSS grid-row (slot * 2 since 30min = 1 row)
 * - Drag uses HTML5 drag-and-drop API (no extra dep — works on desktop + touch via polyfill)
 * - On drop: PATCH /api/v1/admin/reservations/:id { tableId }
 */

import { useState, useRef, useCallback } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { addDays, format, startOfWeek } from "date-fns";
import { toZonedTime } from "date-fns-tz";
import { ACCRA_TZ, minutesToDisplay } from "@/lib/utils/slots";
import {
  ChevronLeft,
  ChevronRight,
  CalendarDays,
  List,
  RefreshCw,
  Users,
  Clock,
  AlertCircle,
  CheckCircle2,
  Circle,
} from "lucide-react";
import { ReservationDetailModal } from "@/components/admin/ReservationDetailModal";

// ─── Types ───────────────────────────────────────────────────────────────────

interface CalendarReservation {
  id: string;
  ref: string;
  guestName: string;
  guestPhone: string;
  partySize: number;
  date: string;
  timeSlot: number;
  startsAt: string;
  endsAt: string;
  status: string;
  occasion: string | null;
  specialReqs: string | null;
  tableId: string | null;
  tableLabel: string | null;
  depositRequired: boolean;
  depositPaid: boolean;
  depositPesewas: number | null;
  adminNotes: string | null;
  paymentStatus: string | null;
}

interface CalendarTable {
  id: string;
  label: string;
  capacity: string;
  maxGuests: number;
  minGuests: number;
}

interface CalendarData {
  reservations: CalendarReservation[];
  tables: CalendarTable[];
}

type CalendarView = "day" | "week" | "list";

// ─── Constants ───────────────────────────────────────────────────────────────

// Slots to display: 10:00 AM (600 min) to 11:30 PM (1410 min)
const DISPLAY_START = 600;
const DISPLAY_END = 1410;
const SLOT_HEIGHT_PX = 48; // each 30-min row height

const STATUS_STYLES: Record<string, { bg: string; text: string; border: string; label: string }> = {
  PENDING:          { bg: "#FEF3C7", text: "#92400E", border: "#F59E0B", label: "Pending" },
  CONFIRMED:        { bg: "#D1FAE5", text: "#065F46", border: "#10B981", label: "Confirmed" },
  SEATED:           { bg: "#DBEAFE", text: "#1E40AF", border: "#3B82F6", label: "Seated" },
  COMPLETED:        { bg: "#F3F4F6", text: "#374151", border: "#9CA3AF", label: "Completed" },
  CANCELLED_DINER:  { bg: "#FEE2E2", text: "#991B1B", border: "#EF4444", label: "Cancelled" },
  CANCELLED_VENUE:  { bg: "#FEE2E2", text: "#991B1B", border: "#EF4444", label: "Cancelled (Venue)" },
  NO_SHOW:          { bg: "#FEE2E2", text: "#991B1B", border: "#EF4444", label: "No Show" },
};

// ─── Component ───────────────────────────────────────────────────────────────

export function ReservationCalendar({ restaurantId }: { restaurantId: string }) {
  const qc = useQueryClient();
  const [view, setView] = useState<CalendarView>("day");
  const [date, setDate] = useState(() => {
    const now = toZonedTime(new Date(), ACCRA_TZ);
    return format(now, "yyyy-MM-dd");
  });
  const [selectedReservation, setSelectedReservation] =
    useState<CalendarReservation | null>(null);

  // Drag state
  const draggingId = useRef<string | null>(null);

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ["admin-reservations", restaurantId, date, view === "week" ? "week" : "day"],
    queryFn: async () => {
      const params = new URLSearchParams({
        restaurantId,
        date,
        view: view === "week" ? "week" : "day",
      });
      const res = await fetch(`/api/v1/admin/reservations?${params}`);
      if (!res.ok) throw new Error("Failed to fetch reservations");
      const json = (await res.json()) as { data: CalendarData };
      return json.data;
    },
    refetchInterval: 60_000, // refresh every minute
  });

  const reassignMutation = useMutation({
    mutationFn: async ({ id, tableId }: { id: string; tableId: string }) => {
      const res = await fetch(`/api/v1/admin/reservations/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tableId }),
      });
      if (!res.ok) {
        const err = (await res.json()) as { error?: { message?: string } };
        throw new Error(err.error?.message ?? "Reassignment failed");
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin-reservations", restaurantId] });
    },
    onError: (err: Error) => alert(err.message),
  });

  const statusMutation = useMutation({
    mutationFn: async ({
      id,
      status,
    }: {
      id: string;
      status: string;
      seatNow?: boolean;
      noShow?: boolean;
    }) => {
      const res = await fetch(`/api/v1/admin/reservations/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
      });
      if (!res.ok) throw new Error("Status update failed");
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin-reservations", restaurantId] });
      setSelectedReservation(null);
    },
  });

  // Navigation
  function navigate(dir: 1 | -1) {
    const d = new Date(date + "T00:00:00Z");
    d.setDate(d.getDate() + dir * (view === "week" ? 7 : 1));
    setDate(d.toISOString().split("T")[0]!);
  }

  function goToday() {
    const now = toZonedTime(new Date(), ACCRA_TZ);
    setDate(format(now, "yyyy-MM-dd"));
  }

  // Drag handlers
  const onDragStart = useCallback(
    (e: React.DragEvent, reservationId: string) => {
      draggingId.current = reservationId;
      e.dataTransfer.effectAllowed = "move";
    },
    []
  );

  const onDrop = useCallback(
    (e: React.DragEvent, tableId: string) => {
      e.preventDefault();
      const id = draggingId.current;
      if (!id) return;
      draggingId.current = null;
      reassignMutation.mutate({ id, tableId });
    },
    [reassignMutation]
  );

  const onDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
  }, []);

  // Display date label
  const displayDateLabel =
    view === "week"
      ? (() => {
          const anchor = new Date(date + "T00:00:00Z");
          const mon = startOfWeek(anchor, { weekStartsOn: 1 });
          const sun = addDays(mon, 6);
          return `${format(mon, "d MMM")} – ${format(sun, "d MMM yyyy")}`;
        })()
      : format(new Date(date + "T00:00:00Z"), "EEEE, d MMMM yyyy");

  const reservations = data?.reservations ?? [];
  const tables = data?.tables ?? [];

  // KPI counts for current view
  const kpis = {
    total: reservations.length,
    confirmed: reservations.filter((r) => r.status === "CONFIRMED").length,
    seated: reservations.filter((r) => r.status === "SEATED").length,
    noShow: reservations.filter((r) => r.status === "NO_SHOW").length,
    covers: reservations
      .filter((r) => ["CONFIRMED", "SEATED", "COMPLETED"].includes(r.status))
      .reduce((s, r) => s + r.partySize, 0),
  };

  return (
    <div className="flex flex-col h-screen lg:h-auto min-h-screen bg-[#F5F2ED]">
      {/* Header */}
      <div className="bg-white border-b border-[#E8E5E0] px-6 py-4 sticky top-0 z-20 lg:top-0">
        <div className="flex flex-wrap items-center gap-3 justify-between">
          <div className="flex items-center gap-3">
            {/* Date navigation */}
            <button
              onClick={() => navigate(-1)}
              className="p-1.5 rounded-lg hover:bg-[#F5F2ED] transition-colors"
              aria-label="Previous period"
            >
              <ChevronLeft size={18} />
            </button>
            <h1
              className="text-lg font-bold text-[#1A1A1A] min-w-48 text-center"
              style={{ fontFamily: "Fraunces, serif" }}
            >
              {displayDateLabel}
            </h1>
            <button
              onClick={() => navigate(1)}
              className="p-1.5 rounded-lg hover:bg-[#F5F2ED] transition-colors"
              aria-label="Next period"
            >
              <ChevronRight size={18} />
            </button>
            <button
              onClick={goToday}
              className="px-3 py-1 text-xs font-medium rounded-lg border border-[#E8E5E0] hover:bg-[#F5F2ED] transition-colors"
            >
              Today
            </button>
          </div>

          {/* View toggle + refresh */}
          <div className="flex items-center gap-2">
            <button
              onClick={() => refetch()}
              className="p-1.5 rounded-lg hover:bg-[#F5F2ED] text-[#8B8680] transition-colors"
              aria-label="Refresh"
            >
              <RefreshCw size={16} />
            </button>
            <div className="flex rounded-xl border border-[#E8E5E0] overflow-hidden">
              {(["day", "week", "list"] as const).map((v) => (
                <button
                  key={v}
                  onClick={() => setView(v)}
                  className={`px-3 py-1.5 text-xs font-medium transition-colors capitalize ${
                    view === v
                      ? "bg-[#0F7B5A] text-white"
                      : "text-[#5E5A57] hover:bg-[#F5F2ED]"
                  }`}
                >
                  {v === "day" ? (
                    <span className="flex items-center gap-1">
                      <CalendarDays size={13} />
                      Day
                    </span>
                  ) : v === "week" ? (
                    <span className="flex items-center gap-1">
                      <CalendarDays size={13} />
                      Week
                    </span>
                  ) : (
                    <span className="flex items-center gap-1">
                      <List size={13} />
                      List
                    </span>
                  )}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* KPI bar */}
        <div className="flex flex-wrap gap-4 mt-3 pt-3 border-t border-[#F5F2ED]">
          {[
            { label: "Total", value: kpis.total, color: "#5E5A57" },
            { label: "Confirmed", value: kpis.confirmed, color: "#10B981" },
            { label: "Seated", value: kpis.seated, color: "#3B82F6" },
            { label: "No-shows", value: kpis.noShow, color: "#EF4444" },
            { label: "Covers", value: kpis.covers, color: "#0F7B5A" },
          ].map(({ label, value, color }) => (
            <div key={label} className="text-center min-w-12">
              <p className="text-xl font-bold" style={{ color }}>
                {value}
              </p>
              <p className="text-xs text-[#8B8680]">{label}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Loading / error */}
      {isLoading && (
        <div className="flex items-center justify-center flex-1 text-[#8B8680] gap-2 py-16">
          <RefreshCw size={18} className="animate-spin" />
          Loading reservations...
        </div>
      )}

      {isError && (
        <div className="flex items-center justify-center flex-1 text-[#EF4444] gap-2 py-16">
          <AlertCircle size={18} />
          Failed to load. Check your connection and try again.
        </div>
      )}

      {/* Calendar grid (day/week) */}
      {!isLoading && !isError && view !== "list" && (
        <DayWeekGrid
          reservations={reservations}
          tables={tables}
          view={view}
          date={date}
          onDragStart={onDragStart}
          onDrop={onDrop}
          onDragOver={onDragOver}
          onReservationClick={setSelectedReservation}
          reassigning={reassignMutation.isPending}
        />
      )}

      {/* List view */}
      {!isLoading && !isError && view === "list" && (
        <ListView
          reservations={reservations}
          onReservationClick={setSelectedReservation}
        />
      )}

      {/* Reservation detail modal */}
      {selectedReservation && (
        <ReservationDetailModal
          reservation={selectedReservation}
          onClose={() => setSelectedReservation(null)}
          onStatusChange={(id, status) =>
            statusMutation.mutate({ id, status })
          }
          isMutating={statusMutation.isPending}
        />
      )}
    </div>
  );
}

// ─── Day / Week grid ──────────────────────────────────────────────────────────

function DayWeekGrid({
  reservations,
  tables,
  view,
  date,
  onDragStart,
  onDrop,
  onDragOver,
  onReservationClick,
  reassigning,
}: {
  reservations: CalendarReservation[];
  tables: CalendarTable[];
  view: "day" | "week";
  date: string;
  onDragStart: (e: React.DragEvent, id: string) => void;
  onDrop: (e: React.DragEvent, tableId: string) => void;
  onDragOver: (e: React.DragEvent) => void;
  onReservationClick: (r: CalendarReservation) => void;
  reassigning: boolean;
}) {
  // For week view we generate Mon-Sun columns; each column contains tables
  const days =
    view === "week"
      ? Array.from({ length: 7 }, (_, i) => {
          const anchor = new Date(date + "T00:00:00Z");
          const mon = startOfWeek(anchor, { weekStartsOn: 1 });
          const d = addDays(mon, i);
          return format(d, "yyyy-MM-dd");
        })
      : [date];

  const timeSlots: number[] = [];
  for (let m = DISPLAY_START; m <= DISPLAY_END; m += 30) timeSlots.push(m);

  // Build reservation lookup: day → tableId → list of reservations at that slot
  const resMap = new Map<string, Map<string, CalendarReservation[]>>();
  for (const r of reservations) {
    const day = r.date.split("T")[0]!;
    if (!resMap.has(day)) resMap.set(day, new Map());
    const dayMap = resMap.get(day)!;
    const tId = r.tableId ?? "__unassigned__";
    if (!dayMap.has(tId)) dayMap.set(tId, []);
    dayMap.get(tId)!.push(r);
  }

  // For day view: columns = tables + unassigned column
  // For week view: columns = days (with condensed reservation blocks)
  return (
    <div className="flex-1 overflow-auto">
      <div
        className="min-w-0"
        style={{
          display: "grid",
          gridTemplateColumns: `64px repeat(${view === "day" ? tables.length + 1 : days.length}, minmax(120px, 1fr))`,
        }}
      >
        {/* Header row */}
        <div className="sticky top-0 z-10 bg-white border-b border-r border-[#E8E5E0] px-2 py-3 text-xs text-[#8B8680]" />
        {view === "day"
          ? tables.map((t) => (
              <div
                key={t.id}
                className="sticky top-0 z-10 bg-white border-b border-r border-[#E8E5E0] px-2 py-3 text-center"
                onDragOver={onDragOver}
                onDrop={(e) => onDrop(e, t.id)}
              >
                <p className="text-xs font-semibold text-[#1A1A1A]">{t.label}</p>
                <p className="text-xs text-[#8B8680]">{t.maxGuests} seats</p>
              </div>
            ))
          : days.map((d) => (
              <div
                key={d}
                className="sticky top-0 z-10 bg-white border-b border-r border-[#E8E5E0] px-2 py-3 text-center"
              >
                <p className="text-xs font-semibold text-[#1A1A1A]">
                  {format(new Date(d + "T00:00:00Z"), "EEE")}
                </p>
                <p className="text-xs text-[#8B8680]">
                  {format(new Date(d + "T00:00:00Z"), "d MMM")}
                </p>
              </div>
            ))}

        {/* Unassigned column header (day view only) */}
        {view === "day" && (
          <div className="sticky top-0 z-10 bg-[#FEF3C7] border-b border-r border-[#E8E5E0] px-2 py-3 text-center">
            <p className="text-xs font-semibold text-[#92400E]">Unassigned</p>
          </div>
        )}

        {/* Time rows */}
        {timeSlots.map((slot) => (
          <>
            {/* Time label */}
            <div
              key={`time-${slot}`}
              className="border-b border-r border-[#F0EDE8] flex items-start justify-end pr-2 pt-1"
              style={{ height: SLOT_HEIGHT_PX }}
            >
              <span className="text-xs text-[#8B8680] leading-none">
                {minutesToDisplay(slot)}
              </span>
            </div>

            {/* Table/day columns */}
            {view === "day"
              ? tables.map((t) => {
                  const dayResMap = resMap.get(date);
                  const cellRes =
                    dayResMap?.get(t.id)?.filter(
                      (r) =>
                        r.timeSlot >= slot && r.timeSlot < slot + 30
                    ) ?? [];
                  return (
                    <div
                      key={`${slot}-${t.id}`}
                      className="border-b border-r border-[#F0EDE8] p-1 relative"
                      style={{ height: SLOT_HEIGHT_PX }}
                      onDragOver={onDragOver}
                      onDrop={(e) => onDrop(e, t.id)}
                    >
                      {cellRes.map((r) => (
                        <ReservationBlock
                          key={r.id}
                          reservation={r}
                          onDragStart={onDragStart}
                          onClick={onReservationClick}
                        />
                      ))}
                    </div>
                  );
                })
              : days.map((d) => {
                  const dayResMap = resMap.get(d);
                  // In week view we show ALL tables' reservations in each day cell
                  const cellRes: CalendarReservation[] = [];
                  dayResMap?.forEach((list) => {
                    list.forEach((r) => {
                      if (r.timeSlot >= slot && r.timeSlot < slot + 30) {
                        cellRes.push(r);
                      }
                    });
                  });

                  return (
                    <div
                      key={`${slot}-${d}`}
                      className="border-b border-r border-[#F0EDE8] p-0.5 relative"
                      style={{ height: SLOT_HEIGHT_PX }}
                    >
                      {cellRes.map((r) => (
                        <ReservationBlock
                          key={r.id}
                          reservation={r}
                          onDragStart={onDragStart}
                          onClick={onReservationClick}
                          compact
                        />
                      ))}
                    </div>
                  );
                })}

            {/* Unassigned column (day view) */}
            {view === "day" && (() => {
              const dayResMap = resMap.get(date);
              const unassigned =
                dayResMap?.get("__unassigned__")?.filter(
                  (r) => r.timeSlot >= slot && r.timeSlot < slot + 30
                ) ?? [];
              return (
                <div
                  key={`${slot}-unassigned`}
                  className="border-b border-r border-[#F0EDE8] bg-[#FFFBEB] p-1"
                  style={{ height: SLOT_HEIGHT_PX }}
                >
                  {unassigned.map((r) => (
                    <ReservationBlock
                      key={r.id}
                      reservation={r}
                      onDragStart={onDragStart}
                      onClick={onReservationClick}
                    />
                  ))}
                </div>
              );
            })()}
          </>
        ))}
      </div>
    </div>
  );
}

function ReservationBlock({
  reservation: r,
  onDragStart,
  onClick,
  compact = false,
}: {
  reservation: CalendarReservation;
  onDragStart: (e: React.DragEvent, id: string) => void;
  onClick: (r: CalendarReservation) => void;
  compact?: boolean;
}) {
  const style = STATUS_STYLES[r.status] ?? STATUS_STYLES["CONFIRMED"]!;

  return (
    <div
      draggable
      onDragStart={(e) => onDragStart(e, r.id)}
      onClick={() => onClick(r)}
      title={`${r.guestName} · ${r.partySize} guests · ${minutesToDisplay(r.timeSlot)}`}
      className="rounded cursor-grab active:cursor-grabbing text-xs leading-tight px-1.5 py-0.5 truncate border-l-2 hover:opacity-90 transition-opacity select-none"
      style={{
        background: style.bg,
        color: style.text,
        borderLeftColor: style.border,
      }}
    >
      {compact ? (
        <span className="font-medium">{r.guestName.split(" ")[0]}</span>
      ) : (
        <>
          <span className="font-semibold block truncate">{r.guestName}</span>
          <span className="opacity-80">
            {r.partySize}p · {minutesToDisplay(r.timeSlot)}
          </span>
        </>
      )}
    </div>
  );
}

// ─── List view ────────────────────────────────────────────────────────────────

function ListView({
  reservations,
  onReservationClick,
}: {
  reservations: CalendarReservation[];
  onReservationClick: (r: CalendarReservation) => void;
}) {
  if (reservations.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-[#8B8680]">
        <CalendarDays size={40} className="mb-3 opacity-40" />
        <p className="font-medium">No reservations on this day</p>
      </div>
    );
  }

  return (
    <div className="p-6 max-w-4xl mx-auto space-y-2">
      {reservations.map((r) => {
        const style = STATUS_STYLES[r.status] ?? STATUS_STYLES["CONFIRMED"]!;
        return (
          <button
            key={r.id}
            onClick={() => onReservationClick(r)}
            className="w-full text-left bg-white rounded-xl border border-[#E8E5E0] p-4 hover:border-[#0F7B5A]/40 hover:shadow-sm transition-all"
          >
            <div className="flex items-center gap-4 flex-wrap">
              <div className="w-20 text-center flex-shrink-0">
                <p className="text-base font-bold text-[#1A1A1A]">
                  {minutesToDisplay(r.timeSlot)}
                </p>
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <p className="font-semibold text-[#1A1A1A]">{r.guestName}</p>
                  <span
                    className="text-xs px-2 py-0.5 rounded-full font-medium"
                    style={{ background: style.bg, color: style.text }}
                  >
                    {style.label}
                  </span>
                  {r.tableLabel && (
                    <span className="text-xs text-[#8B8680]">
                      Table {r.tableLabel}
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-3 mt-1 text-xs text-[#8B8680]">
                  <span className="flex items-center gap-1">
                    <Users size={11} />
                    {r.partySize} guests
                  </span>
                  {r.occasion && <span>· {r.occasion.replace(/_/g, " ")}</span>}
                  {r.specialReqs && (
                    <span className="text-[#F59E0B]">· Has special request</span>
                  )}
                  {r.depositRequired && !r.depositPaid && (
                    <span className="text-[#EF4444]">· Deposit unpaid</span>
                  )}
                </div>
              </div>
              <div className="text-right flex-shrink-0">
                <p className="text-xs text-[#8B8680]">{r.ref}</p>
                <p className="text-xs text-[#8B8680]">{r.guestPhone}</p>
              </div>
            </div>
          </button>
        );
      })}
    </div>
  );
}
