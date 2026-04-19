"use client";

import { useState, FormEvent } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Save,
  Loader2,
  AlertCircle,
  CheckCircle2,
  Plus,
  Trash2,
  Clock,
  CalendarOff,
  Settings2,
  Phone,
  Info,
} from "lucide-react";

// ─── Types ────────────────────────────────────────────────────────────────────

interface OperatingHours {
  id: string;
  dayOfWeek: string;
  openTime: number;
  closeTime: number;
  isClosed: boolean;
}

interface BlackoutDate {
  id: string;
  date: string;
  reason: string | null;
}

interface RestaurantData {
  restaurant: {
    id: string;
    name: string;
    slug: string;
    description: string;
    shortBio: string;
    phone: string;
    whatsappPhone: string | null;
    email: string | null;
    websiteUrl: string | null;
    instagramHandle: string | null;
    defaultTurnTime: number;
    isActive: boolean;
    depositEnabled: boolean;
    depositAmountPesewas: number | null;
    depositRequiredDays: string[];
    depositRefundHours: number;
    neighborhood: string;
    address: string;
  };
  operatingHours: OperatingHours[];
  blackoutDates: BlackoutDate[];
}

// ─── Constants ────────────────────────────────────────────────────────────────

const DAYS_OF_WEEK = [
  { key: "MONDAY", label: "Monday", short: "Mon" },
  { key: "TUESDAY", label: "Tuesday", short: "Tue" },
  { key: "WEDNESDAY", label: "Wednesday", short: "Wed" },
  { key: "THURSDAY", label: "Thursday", short: "Thu" },
  { key: "FRIDAY", label: "Friday", short: "Fri" },
  { key: "SATURDAY", label: "Saturday", short: "Sat" },
  { key: "SUNDAY", label: "Sunday", short: "Sun" },
];

// ─── Helpers ──────────────────────────────────────────────────────────────────

function minutesToTime(minutes: number): string {
  const h = Math.floor(minutes / 60)
    .toString()
    .padStart(2, "0");
  const m = (minutes % 60).toString().padStart(2, "0");
  return `${h}:${m}`;
}

function timeToMinutes(time: string): number {
  const [h, m] = time.split(":").map(Number);
  return (h ?? 0) * 60 + (m ?? 0);
}

function formatGHSPesewas(pesewas: number): string {
  return (pesewas / 100).toFixed(2);
}

// ─── Section wrapper ──────────────────────────────────────────────────────────

function Section({
  title,
  icon: Icon,
  children,
}: {
  title: string;
  icon: React.ElementType;
  children: React.ReactNode;
}) {
  return (
    <div className="bg-white rounded-2xl border border-[#E8E5E0] overflow-hidden">
      <div className="flex items-center gap-3 px-6 py-4 border-b border-[#E8E5E0] bg-[#FAF7F2]">
        <Icon size={17} className="text-[#0F7B5A]" />
        <h2 className="font-semibold text-[#1A1A1A] text-sm">{title}</h2>
      </div>
      <div className="p-6">{children}</div>
    </div>
  );
}

// ─── Field ────────────────────────────────────────────────────────────────────

function Field({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <label className="block text-sm font-medium text-[#3D3936] mb-1.5">
        {label}
      </label>
      {children}
      {hint && <p className="text-xs text-[#8B8680] mt-1">{hint}</p>}
    </div>
  );
}

const INPUT_CLS =
  "w-full px-3 py-2.5 border border-[#E8E5E0] rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#0F7B5A]/30 focus:border-[#0F7B5A]";

// ─── Main Component ───────────────────────────────────────────────────────────

export function RestaurantSettings({ restaurantId }: { restaurantId: string }) {
  const qc = useQueryClient();
  const qKey = ["admin-settings", restaurantId];

  const { data, isLoading, error } = useQuery<RestaurantData>({
    queryKey: qKey,
    queryFn: async () => {
      const res = await fetch(
        `/api/v1/admin/restaurants/${restaurantId}/settings`
      );
      if (!res.ok) throw new Error("Failed to load settings");
      const json = await res.json();
      return json.data as RestaurantData;
    },
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
        <span>Failed to load settings. Please refresh.</span>
      </div>
    );
  }

  return (
    <div className="p-6 max-w-3xl mx-auto space-y-6">
      <div>
        <h1
          className="text-2xl font-bold text-[#1A1A1A]"
          style={{ fontFamily: "Fraunces, serif" }}
        >
          Settings
        </h1>
        <p className="text-sm text-[#8B8680] mt-0.5">{data.restaurant.name}</p>
      </div>

      <GeneralSection
        restaurantId={restaurantId}
        data={data}
        onSuccess={() => qc.invalidateQueries({ queryKey: qKey })}
      />

      <HoursSection
        restaurantId={restaurantId}
        operatingHours={data.operatingHours}
        onSuccess={() => qc.invalidateQueries({ queryKey: qKey })}
      />

      <DepositSection
        restaurantId={restaurantId}
        data={data}
        onSuccess={() => qc.invalidateQueries({ queryKey: qKey })}
      />

      <BlackoutSection
        restaurantId={restaurantId}
        blackoutDates={data.blackoutDates}
        onSuccess={() => qc.invalidateQueries({ queryKey: qKey })}
      />
    </div>
  );
}

// ─── General Section ──────────────────────────────────────────────────────────

function GeneralSection({
  restaurantId,
  data,
  onSuccess,
}: {
  restaurantId: string;
  data: RestaurantData;
  onSuccess: () => void;
}) {
  const r = data.restaurant;
  const [description, setDescription] = useState(r.description);
  const [shortBio, setShortBio] = useState(r.shortBio);
  const [phone, setPhone] = useState(r.phone);
  const [whatsappPhone, setWhatsappPhone] = useState(r.whatsappPhone ?? "");
  const [email, setEmail] = useState(r.email ?? "");
  const [websiteUrl, setWebsiteUrl] = useState(r.websiteUrl ?? "");
  const [instagramHandle, setInstagramHandle] = useState(
    r.instagramHandle ?? ""
  );
  const [defaultTurnTime, setDefaultTurnTime] = useState(
    r.defaultTurnTime.toString()
  );
  const [isActive, setIsActive] = useState(r.isActive);
  const [status, setStatus] = useState<"idle" | "saving" | "saved" | "error">(
    "idle"
  );
  const [errorMsg, setErrorMsg] = useState("");

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setStatus("saving");
    setErrorMsg("");
    try {
      const res = await fetch(
        `/api/v1/admin/restaurants/${restaurantId}/settings`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            description,
            shortBio,
            phone,
            whatsappPhone: whatsappPhone || undefined,
            email: email || undefined,
            websiteUrl: websiteUrl || undefined,
            instagramHandle: instagramHandle || undefined,
            defaultTurnTime: parseInt(defaultTurnTime, 10),
            isActive,
          }),
        }
      );
      if (!res.ok) throw new Error("Failed to save");
      setStatus("saved");
      onSuccess();
      setTimeout(() => setStatus("idle"), 2500);
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : "An error occurred");
      setStatus("error");
    }
  }

  return (
    <Section title="General" icon={Settings2}>
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Field label="Short bio (card text)" hint="Up to 160 characters, shown on restaurant cards">
            <textarea
              value={shortBio}
              onChange={(e) => setShortBio(e.target.value)}
              maxLength={160}
              rows={2}
              className={`${INPUT_CLS} resize-none`}
            />
            <p className="text-right text-xs text-[#8B8680] mt-0.5">
              {shortBio.length}/160
            </p>
          </Field>
          <Field label="Turn time (minutes)" hint="Default table turn time for reservations">
            <input
              type="number"
              value={defaultTurnTime}
              onChange={(e) => setDefaultTurnTime(e.target.value)}
              min={30}
              max={300}
              step={15}
              className={INPUT_CLS}
            />
          </Field>
        </div>

        <Field label="Full description" hint="Displayed on the restaurant detail page">
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            maxLength={1000}
            rows={4}
            className={`${INPUT_CLS} resize-none`}
          />
          <p className="text-right text-xs text-[#8B8680] mt-0.5">
            {description.length}/1000
          </p>
        </Field>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Field label="Phone (E.164)">
            <input
              type="tel"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="+233241234567"
              className={INPUT_CLS}
            />
          </Field>
          <Field label="WhatsApp number" hint="Leave blank to use main phone">
            <input
              type="tel"
              value={whatsappPhone}
              onChange={(e) => setWhatsappPhone(e.target.value)}
              placeholder="+233241234567"
              className={INPUT_CLS}
            />
          </Field>
          <Field label="Email">
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="hello@restaurant.gh"
              className={INPUT_CLS}
            />
          </Field>
          <Field label="Website URL">
            <input
              type="url"
              value={websiteUrl}
              onChange={(e) => setWebsiteUrl(e.target.value)}
              placeholder="https://yourrestaurant.com"
              className={INPUT_CLS}
            />
          </Field>
          <Field label="Instagram handle" hint="Without @">
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-[#8B8680]">
                @
              </span>
              <input
                type="text"
                value={instagramHandle}
                onChange={(e) => setInstagramHandle(e.target.value)}
                placeholder="yourrestaurant"
                maxLength={60}
                className={`${INPUT_CLS} pl-7`}
              />
            </div>
          </Field>
        </div>

        {/* Active toggle */}
        <div className="flex items-center gap-3 p-4 rounded-xl bg-[#FAF7F2] border border-[#E8E5E0]">
          <button
            type="button"
            onClick={() => setIsActive((v) => !v)}
            className={`relative w-10 h-5 rounded-full transition-colors flex-shrink-0 ${
              isActive ? "bg-[#0F7B5A]" : "bg-[#E8E5E0]"
            }`}
            role="switch"
            aria-checked={isActive}
          >
            <span
              className={`absolute top-0.5 w-4 h-4 bg-white rounded-full shadow transition-transform ${
                isActive ? "translate-x-5" : "translate-x-0.5"
              }`}
            />
          </button>
          <div>
            <p className="text-sm font-medium text-[#1A1A1A]">
              Restaurant active
            </p>
            <p className="text-xs text-[#8B8680]">
              {isActive
                ? "Visible to guests — accepting reservations"
                : "Hidden from guests — no new bookings"}
            </p>
          </div>
        </div>

        {status === "error" && (
          <p className="text-sm text-red-600 flex items-center gap-1.5">
            <AlertCircle size={14} /> {errorMsg}
          </p>
        )}
        {status === "saved" && (
          <p className="text-sm text-green-700 flex items-center gap-1.5">
            <CheckCircle2 size={14} /> Changes saved.
          </p>
        )}

        <div className="flex justify-end">
          <button
            type="submit"
            disabled={status === "saving"}
            className="flex items-center gap-2 px-5 py-2.5 bg-[#0F7B5A] text-white rounded-xl text-sm font-medium hover:bg-[#0a6349] disabled:opacity-50 transition-colors"
          >
            {status === "saving" ? (
              <Loader2 size={14} className="animate-spin" />
            ) : (
              <Save size={14} />
            )}
            Save Changes
          </button>
        </div>
      </form>
    </Section>
  );
}

// ─── Operating Hours Section ──────────────────────────────────────────────────

interface HoursRowState {
  dayOfWeek: string;
  openTime: string; // "HH:mm"
  closeTime: string;
  isClosed: boolean;
}

function HoursSection({
  restaurantId,
  operatingHours,
  onSuccess,
}: {
  restaurantId: string;
  operatingHours: OperatingHours[];
  onSuccess: () => void;
}) {
  // Build a full 7-day grid with defaults for missing days
  const initial: HoursRowState[] = DAYS_OF_WEEK.map(({ key }) => {
    const existing = operatingHours.find((h) => h.dayOfWeek === key);
    return {
      dayOfWeek: key,
      openTime: existing ? minutesToTime(existing.openTime) : "08:00",
      closeTime: existing ? minutesToTime(existing.closeTime) : "22:00",
      isClosed: existing?.isClosed ?? false,
    };
  });

  const [rows, setRows] = useState<HoursRowState[]>(initial);
  const [status, setStatus] = useState<"idle" | "saving" | "saved" | "error">(
    "idle"
  );
  const [errorMsg, setErrorMsg] = useState("");

  function updateRow(
    index: number,
    patch: Partial<HoursRowState>
  ) {
    setRows((prev) =>
      prev.map((r, i) => (i === index ? { ...r, ...patch } : r))
    );
  }

  async function handleSave() {
    setStatus("saving");
    setErrorMsg("");
    try {
      const res = await fetch(
        `/api/v1/admin/restaurants/${restaurantId}/settings`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            operatingHours: rows.map((r) => ({
              dayOfWeek: r.dayOfWeek,
              openTime: timeToMinutes(r.openTime),
              closeTime: timeToMinutes(r.closeTime),
              isClosed: r.isClosed,
            })),
          }),
        }
      );
      if (!res.ok) throw new Error("Failed to save hours");
      setStatus("saved");
      onSuccess();
      setTimeout(() => setStatus("idle"), 2500);
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : "Error saving hours");
      setStatus("error");
    }
  }

  return (
    <Section title="Operating Hours" icon={Clock}>
      <div className="space-y-2">
        {rows.map((row, i) => {
          const day = DAYS_OF_WEEK[i]!;
          return (
            <div
              key={row.dayOfWeek}
              className={`flex items-center gap-4 px-4 py-3 rounded-xl border transition-colors ${
                row.isClosed
                  ? "bg-[#F5F2ED] border-[#E8E5E0]"
                  : "bg-white border-[#E8E5E0]"
              }`}
            >
              {/* Day label */}
              <span
                className={`text-sm font-medium w-24 flex-shrink-0 ${
                  row.isClosed ? "text-[#8B8680]" : "text-[#1A1A1A]"
                }`}
              >
                {day.label}
              </span>

              {row.isClosed ? (
                <span className="text-sm text-[#8B8680] italic flex-1">
                  Closed
                </span>
              ) : (
                <div className="flex items-center gap-2 flex-1">
                  <input
                    type="time"
                    value={row.openTime}
                    onChange={(e) => updateRow(i, { openTime: e.target.value })}
                    className="px-2.5 py-1.5 border border-[#E8E5E0] rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#0F7B5A]/30 focus:border-[#0F7B5A]"
                  />
                  <span className="text-[#8B8680] text-sm">to</span>
                  <input
                    type="time"
                    value={row.closeTime}
                    onChange={(e) =>
                      updateRow(i, { closeTime: e.target.value })
                    }
                    className="px-2.5 py-1.5 border border-[#E8E5E0] rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#0F7B5A]/30 focus:border-[#0F7B5A]"
                  />
                </div>
              )}

              {/* Closed toggle */}
              <label className="flex items-center gap-1.5 cursor-pointer flex-shrink-0">
                <input
                  type="checkbox"
                  checked={row.isClosed}
                  onChange={(e) => updateRow(i, { isClosed: e.target.checked })}
                  className="w-3.5 h-3.5 accent-[#0F7B5A]"
                />
                <span className="text-xs text-[#8B8680]">Closed</span>
              </label>
            </div>
          );
        })}
      </div>

      {status === "error" && (
        <p className="text-sm text-red-600 flex items-center gap-1.5 mt-4">
          <AlertCircle size={14} /> {errorMsg}
        </p>
      )}
      {status === "saved" && (
        <p className="text-sm text-green-700 flex items-center gap-1.5 mt-4">
          <CheckCircle2 size={14} /> Hours saved.
        </p>
      )}

      <div className="flex justify-end mt-4">
        <button
          onClick={handleSave}
          disabled={status === "saving"}
          className="flex items-center gap-2 px-5 py-2.5 bg-[#0F7B5A] text-white rounded-xl text-sm font-medium hover:bg-[#0a6349] disabled:opacity-50 transition-colors"
        >
          {status === "saving" ? (
            <Loader2 size={14} className="animate-spin" />
          ) : (
            <Save size={14} />
          )}
          Save Hours
        </button>
      </div>
    </Section>
  );
}

// ─── Deposit Section ──────────────────────────────────────────────────────────

function DepositSection({
  restaurantId,
  data,
  onSuccess,
}: {
  restaurantId: string;
  data: RestaurantData;
  onSuccess: () => void;
}) {
  const r = data.restaurant;
  const [enabled, setEnabled] = useState(r.depositEnabled);
  const [amount, setAmount] = useState(
    r.depositAmountPesewas ? formatGHSPesewas(r.depositAmountPesewas) : ""
  );
  const [refundHours, setRefundHours] = useState(
    r.depositRefundHours.toString()
  );
  const [requiredDays, setRequiredDays] = useState<Set<string>>(
    new Set(r.depositRequiredDays)
  );
  const [status, setStatus] = useState<"idle" | "saving" | "saved" | "error">(
    "idle"
  );
  const [errorMsg, setErrorMsg] = useState("");

  function toggleDay(day: string) {
    setRequiredDays((prev) => {
      const next = new Set(prev);
      next.has(day) ? next.delete(day) : next.add(day);
      return next;
    });
  }

  async function handleSave() {
    setStatus("saving");
    setErrorMsg("");
    try {
      const res = await fetch(
        `/api/v1/admin/restaurants/${restaurantId}/settings`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            depositEnabled: enabled,
            depositAmountPesewas: amount
              ? Math.round(parseFloat(amount) * 100)
              : 0,
            depositRequiredDays: [...requiredDays],
            depositRefundHours: parseInt(refundHours, 10),
          }),
        }
      );
      if (!res.ok) throw new Error("Failed to save deposit settings");
      setStatus("saved");
      onSuccess();
      setTimeout(() => setStatus("idle"), 2500);
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : "Error");
      setStatus("error");
    }
  }

  return (
    <Section title="Deposit Settings" icon={Phone}>
      <div className="space-y-5">
        {/* Enable toggle */}
        <div className="flex items-center gap-3 p-4 rounded-xl bg-[#FAF7F2] border border-[#E8E5E0]">
          <button
            type="button"
            onClick={() => setEnabled((v) => !v)}
            className={`relative w-10 h-5 rounded-full transition-colors flex-shrink-0 ${
              enabled ? "bg-[#0F7B5A]" : "bg-[#E8E5E0]"
            }`}
            role="switch"
            aria-checked={enabled}
          >
            <span
              className={`absolute top-0.5 w-4 h-4 bg-white rounded-full shadow transition-transform ${
                enabled ? "translate-x-5" : "translate-x-0.5"
              }`}
            />
          </button>
          <div>
            <p className="text-sm font-medium text-[#1A1A1A]">
              Require deposit
            </p>
            <p className="text-xs text-[#8B8680]">
              {enabled
                ? "Guests must pay a deposit to confirm bookings on selected days"
                : "No deposit required — reservations confirmed immediately"}
            </p>
          </div>
        </div>

        {enabled && (
          <>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Field label="Deposit amount (GHS per guest)">
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-[#8B8680] font-semibold">
                    ₵
                  </span>
                  <input
                    type="number"
                    value={amount}
                    onChange={(e) => setAmount(e.target.value)}
                    placeholder="0.00"
                    min="0"
                    step="0.01"
                    className={`${INPUT_CLS} pl-7`}
                  />
                </div>
              </Field>
              <Field
                label="Refund window (hours before booking)"
                hint="Cancellations before this window get a full refund"
              >
                <input
                  type="number"
                  value={refundHours}
                  onChange={(e) => setRefundHours(e.target.value)}
                  min={1}
                  max={48}
                  className={INPUT_CLS}
                />
              </Field>
            </div>

            <Field label="Required on these days" hint="Deposit not required on unchecked days">
              <div className="flex flex-wrap gap-2 mt-1">
                {DAYS_OF_WEEK.map(({ key, short }) => {
                  const on = requiredDays.has(key);
                  return (
                    <button
                      key={key}
                      type="button"
                      onClick={() => toggleDay(key)}
                      className={`px-3 py-1.5 rounded-lg text-sm font-medium border transition-colors ${
                        on
                          ? "bg-[#0F7B5A] text-white border-[#0F7B5A]"
                          : "bg-white text-[#5E5A57] border-[#E8E5E0] hover:border-[#0F7B5A]/40"
                      }`}
                    >
                      {short}
                    </button>
                  );
                })}
              </div>
            </Field>
          </>
        )}

        {status === "error" && (
          <p className="text-sm text-red-600 flex items-center gap-1.5">
            <AlertCircle size={14} /> {errorMsg}
          </p>
        )}
        {status === "saved" && (
          <p className="text-sm text-green-700 flex items-center gap-1.5">
            <CheckCircle2 size={14} /> Deposit settings saved.
          </p>
        )}

        <div className="flex justify-end">
          <button
            onClick={handleSave}
            disabled={status === "saving"}
            className="flex items-center gap-2 px-5 py-2.5 bg-[#0F7B5A] text-white rounded-xl text-sm font-medium hover:bg-[#0a6349] disabled:opacity-50 transition-colors"
          >
            {status === "saving" ? (
              <Loader2 size={14} className="animate-spin" />
            ) : (
              <Save size={14} />
            )}
            Save Deposit Settings
          </button>
        </div>
      </div>
    </Section>
  );
}

// ─── Blackout Dates Section ───────────────────────────────────────────────────

function BlackoutSection({
  restaurantId,
  blackoutDates,
  onSuccess,
}: {
  restaurantId: string;
  blackoutDates: BlackoutDate[];
  onSuccess: () => void;
}) {
  const qc = useQueryClient();
  const qKey = ["admin-settings", restaurantId];
  const [newDate, setNewDate] = useState("");
  const [newReason, setNewReason] = useState("");
  const [adding, setAdding] = useState(false);
  const [addError, setAddError] = useState("");

  const deleteMutation = useMutation({
    mutationFn: async (date: string) => {
      const res = await fetch(
        `/api/v1/admin/restaurants/${restaurantId}/blackout?date=${date}`,
        { method: "DELETE" }
      );
      if (!res.ok) throw new Error("Failed to delete");
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: qKey });
      onSuccess();
    },
  });

  async function handleAdd() {
    if (!newDate) return;
    setAdding(true);
    setAddError("");
    try {
      const res = await fetch(
        `/api/v1/admin/restaurants/${restaurantId}/blackout`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            date: newDate,
            reason: newReason || undefined,
          }),
        }
      );
      if (!res.ok) throw new Error("Failed to add blackout date");
      setNewDate("");
      setNewReason("");
      qc.invalidateQueries({ queryKey: qKey });
      onSuccess();
    } catch (err) {
      setAddError(err instanceof Error ? err.message : "Error");
    } finally {
      setAdding(false);
    }
  }

  return (
    <Section title="Blackout Dates" icon={CalendarOff}>
      <div className="space-y-4">
        {/* Info */}
        <div className="flex items-start gap-2 text-xs text-[#5E5A57] bg-[#FAF7F2] rounded-xl px-4 py-3 border border-[#E8E5E0]">
          <Info size={14} className="flex-shrink-0 mt-0.5 text-[#8B8680]" />
          <span>
            Blackout dates prevent any new reservations from being made. Existing
            bookings are unaffected.
          </span>
        </div>

        {/* Add form */}
        <div className="flex flex-wrap gap-2">
          <input
            type="date"
            value={newDate}
            onChange={(e) => setNewDate(e.target.value)}
            min={new Date().toISOString().split("T")[0]}
            className="px-3 py-2.5 border border-[#E8E5E0] rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#0F7B5A]/30 focus:border-[#0F7B5A]"
          />
          <input
            type="text"
            value={newReason}
            onChange={(e) => setNewReason(e.target.value)}
            placeholder="Reason (optional)"
            maxLength={100}
            className="flex-1 min-w-[160px] px-3 py-2.5 border border-[#E8E5E0] rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#0F7B5A]/30 focus:border-[#0F7B5A]"
          />
          <button
            onClick={handleAdd}
            disabled={!newDate || adding}
            className="flex items-center gap-1.5 px-4 py-2.5 bg-[#0F7B5A] text-white rounded-xl text-sm font-medium hover:bg-[#0a6349] disabled:opacity-50 transition-colors"
          >
            {adding ? (
              <Loader2 size={14} className="animate-spin" />
            ) : (
              <Plus size={14} />
            )}
            Add
          </button>
        </div>

        {addError && (
          <p className="text-sm text-red-600 flex items-center gap-1.5">
            <AlertCircle size={14} /> {addError}
          </p>
        )}

        {/* List */}
        {blackoutDates.length === 0 ? (
          <p className="text-sm text-[#8B8680] text-center py-4">
            No upcoming blackout dates.
          </p>
        ) : (
          <div className="divide-y divide-[#E8E5E0] border border-[#E8E5E0] rounded-xl overflow-hidden">
            {blackoutDates.map((bd) => {
              const displayDate = new Date(bd.date).toLocaleDateString("en-GH", {
                weekday: "short",
                day: "numeric",
                month: "long",
                year: "numeric",
                timeZone: "UTC",
              });
              return (
                <div
                  key={bd.id}
                  className="flex items-center justify-between px-4 py-3 bg-white hover:bg-[#FAF7F2] transition-colors"
                >
                  <div>
                    <p className="text-sm font-medium text-[#1A1A1A]">
                      {displayDate}
                    </p>
                    {bd.reason && (
                      <p className="text-xs text-[#8B8680]">{bd.reason}</p>
                    )}
                  </div>
                  <button
                    onClick={() =>
                      deleteMutation.mutate(
                        bd.date.toString().split("T")[0] ?? bd.date.toString()
                      )
                    }
                    disabled={deleteMutation.isPending}
                    className="p-1.5 rounded-lg hover:bg-red-50 text-[#8B8680] hover:text-red-600 transition-colors"
                    aria-label="Remove blackout date"
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </Section>
  );
}
