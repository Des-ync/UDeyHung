"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { Users, Calendar, Clock, Loader2 } from "lucide-react";
import { formatDateGH } from "@/lib/utils/slots";

interface AvailabilitySlot {
  timeSlot: number;
  displayTime: string;
  isAvailable: boolean;
  availableTableCount: number;
}

interface BookingWidgetProps {
  restaurantSlug: string;
  restaurantId: string;
  restaurantName: string;
}

const PARTY_SIZES = Array.from({ length: 20 }, (_, i) => i + 1);

export function BookingWidget({
  restaurantSlug,
  restaurantId,
  restaurantName,
}: BookingWidgetProps) {
  const router = useRouter();
  const [partySize, setPartySize] = useState(2);
  const [date, setDate] = useState(() => {
    // Default to tomorrow
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    return tomorrow.toISOString().split("T")[0] ?? "";
  });
  const [selectedSlot, setSelectedSlot] = useState<number | null>(null);

  const { data, isLoading, error } = useQuery({
    queryKey: ["availability", restaurantSlug, date, partySize],
    queryFn: async () => {
      const res = await fetch(
        `/api/v1/restaurants/${restaurantSlug}/availability?date=${date}&partySize=${partySize}`
      );
      if (!res.ok) throw new Error("Failed to fetch availability");
      const json = (await res.json()) as {
        data: {
          slots: AvailabilitySlot[];
          depositRequired: boolean;
          depositAmountPesewas: number | null;
          reason: string | null;
        };
      };
      return json.data;
    },
    enabled: !!date,
  });

  function handleContinue() {
    if (!selectedSlot) return;
    router.push(
      `/restaurants/${restaurantSlug}/book?` +
        new URLSearchParams({
          date,
          timeSlot: String(selectedSlot),
          partySize: String(partySize),
        }).toString()
    );
  }

  const minDate = new Date().toISOString().split("T")[0] ?? "";
  const maxDate = (() => {
    const d = new Date();
    d.setDate(d.getDate() + 90);
    return d.toISOString().split("T")[0] ?? "";
  })();

  return (
    <div className="bg-white rounded-2xl p-6 shadow-lg space-y-5">
      <h3
        className="text-lg font-semibold text-[#1A1A1A]"
        style={{ fontFamily: "Fraunces, serif" }}
      >
        Make a reservation
      </h3>

      {/* Party size */}
      <div>
        <label
          htmlFor="party-size"
          className="block text-sm font-medium text-[#5E5A57] mb-1.5"
        >
          <Users size={14} className="inline mr-1.5" aria-hidden="true" />
          Party size
        </label>
        <select
          id="party-size"
          value={partySize}
          onChange={(e) => {
            setPartySize(Number(e.target.value));
            setSelectedSlot(null);
          }}
          className="w-full rounded-xl border border-[#E8E5E0] px-3 py-2.5 text-sm text-[#1A1A1A] focus:outline-none focus:ring-2 focus:ring-[#0F7B5A] bg-[#FAF7F2]"
        >
          {PARTY_SIZES.map((n) => (
            <option key={n} value={n}>
              {n} {n === 1 ? "person" : "people"}
            </option>
          ))}
        </select>
      </div>

      {/* Date */}
      <div>
        <label
          htmlFor="booking-date"
          className="block text-sm font-medium text-[#5E5A57] mb-1.5"
        >
          <Calendar size={14} className="inline mr-1.5" aria-hidden="true" />
          Date
        </label>
        <input
          id="booking-date"
          type="date"
          value={date}
          min={minDate}
          max={maxDate}
          onChange={(e) => {
            setDate(e.target.value);
            setSelectedSlot(null);
          }}
          className="w-full rounded-xl border border-[#E8E5E0] px-3 py-2.5 text-sm text-[#1A1A1A] focus:outline-none focus:ring-2 focus:ring-[#0F7B5A] bg-[#FAF7F2]"
        />
      </div>

      {/* Time slots */}
      <div>
        <p className="block text-sm font-medium text-[#5E5A57] mb-2">
          <Clock size={14} className="inline mr-1.5" aria-hidden="true" />
          Available times
        </p>

        {isLoading && (
          <div className="flex items-center justify-center py-6 text-[#8B8680]">
            <Loader2 size={20} className="animate-spin mr-2" aria-hidden="true" />
            Checking availability...
          </div>
        )}

        {error && (
          <p className="text-sm text-[#EF4444] py-2">
            Could not load availability. Try again.
          </p>
        )}

        {data?.reason === "CLOSED" && (
          <p className="text-sm text-[#8B8680] py-2 text-center">
            Closed on this day
          </p>
        )}

        {data?.reason === "BLACKOUT_DATE" && (
          <p className="text-sm text-[#8B8680] py-2 text-center">
            Unavailable on this date
          </p>
        )}

        {data && !data.reason && (
          <div
            className="grid grid-cols-3 gap-1.5 max-h-52 overflow-y-auto pr-1"
            role="listbox"
            aria-label="Available time slots"
          >
            {data.slots.map((slot) => (
              <button
                key={slot.timeSlot}
                role="option"
                aria-selected={selectedSlot === slot.timeSlot}
                disabled={!slot.isAvailable}
                onClick={() => setSelectedSlot(slot.timeSlot)}
                className={`
                  py-2 px-1 rounded-xl text-xs font-medium transition-all
                  ${
                    !slot.isAvailable
                      ? "bg-[#F5F2ED] text-[#C4BFB9] cursor-not-allowed"
                      : selectedSlot === slot.timeSlot
                      ? "bg-[#0F7B5A] text-white shadow-md scale-105"
                      : "bg-[#FAF7F2] border border-[#E8E5E0] text-[#1A1A1A] hover:border-[#0F7B5A] hover:text-[#0F7B5A]"
                  }
                `}
              >
                {slot.displayTime}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Deposit notice */}
      {data?.depositRequired && data.depositAmountPesewas && (
        <div className="flex items-start gap-2 p-3 rounded-xl bg-[#D4A853]/10 border border-[#D4A853]/20">
          <span className="text-[#D4A853] text-lg leading-none mt-0.5" aria-hidden="true">₵</span>
          <p className="text-xs text-[#5E5A57]">
            A{" "}
            <strong>₵{(data.depositAmountPesewas / 100).toFixed(0)} deposit per guest</strong>{" "}
            is required for this date. Refundable if cancelled 4+ hours before.
          </p>
        </div>
      )}

      {/* CTA */}
      <button
        onClick={handleContinue}
        disabled={!selectedSlot}
        className="w-full py-3 rounded-xl font-semibold text-white transition-all disabled:opacity-40 disabled:cursor-not-allowed"
        style={{ background: selectedSlot ? "#0F7B5A" : "#8B8680" }}
        aria-label={selectedSlot ? "Continue to booking" : "Select a time to continue"}
      >
        {selectedSlot ? "Continue →" : "Select a time"}
      </button>

      <p className="text-xs text-center text-[#8B8680]">
        Free cancellation up to 2 hours before
      </p>
    </div>
  );
}
