"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { User, Phone, Users, Loader2 } from "lucide-react";

interface Props {
  restaurantId: string;
  restaurantSlug: string;
  queueLength: number;
}

export function WalkInJoinForm({ restaurantId, restaurantSlug, queueLength }: Props) {
  const router = useRouter();
  const [form, setForm] = useState({
    guestName: "",
    guestPhone: "",
    partySize: 2,
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const set = <K extends keyof typeof form>(k: K, v: (typeof form)[K]) =>
    setForm((prev) => ({ ...prev, [k]: v }));

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      const res = await fetch("/api/v1/walkin", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ restaurantId, ...form }),
      });

      const json = await res.json() as {
        success: boolean;
        data?: { id: string; queuePosition: number };
        error?: { message: string };
      };

      if (!res.ok || !json.success) {
        setError(json.error?.message ?? "Failed to join queue. Please try again.");
        return;
      }

      // Redirect to live queue page
      router.push(
        `/walkin/${restaurantSlug}/queue?id=${json.data!.id}`
      );
    } catch {
      setError("Network error. Please check your connection.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      <div>
        <h2
          className="text-xl font-bold text-[#1A1A1A] mb-1"
          style={{ fontFamily: "Fraunces, serif" }}
        >
          Join the queue
        </h2>
        <p className="text-sm text-[#8B8680]">
          {queueLength === 0
            ? "You'll be seated right away. Enter your details to check in."
            : "Enter your details and we'll notify you when your table is ready."}
        </p>
      </div>

      {/* Name */}
      <div>
        <label className="block text-xs font-semibold text-[#5E5A57] mb-1.5 uppercase tracking-wider">
          Your name
        </label>
        <div className="relative">
          <User
            size={16}
            className="absolute left-3 top-1/2 -translate-y-1/2 text-[#8B8680]"
          />
          <input
            type="text"
            required
            minLength={2}
            maxLength={100}
            placeholder="e.g. Kwame Mensah"
            value={form.guestName}
            onChange={(e) => set("guestName", e.target.value)}
            className="w-full pl-9 pr-4 py-3 rounded-xl border border-[#E8E5E0] bg-white text-sm text-[#1A1A1A] placeholder-[#C5C0BB] focus:outline-none focus:ring-2 focus:ring-[#0F7B5A]/30 focus:border-[#0F7B5A]"
          />
        </div>
      </div>

      {/* Phone */}
      <div>
        <label className="block text-xs font-semibold text-[#5E5A57] mb-1.5 uppercase tracking-wider">
          Phone number
        </label>
        <div className="relative">
          <Phone
            size={16}
            className="absolute left-3 top-1/2 -translate-y-1/2 text-[#8B8680]"
          />
          <input
            type="tel"
            required
            placeholder="0241 234 567"
            value={form.guestPhone}
            onChange={(e) => set("guestPhone", e.target.value)}
            className="w-full pl-9 pr-4 py-3 rounded-xl border border-[#E8E5E0] bg-white text-sm text-[#1A1A1A] placeholder-[#C5C0BB] focus:outline-none focus:ring-2 focus:ring-[#0F7B5A]/30 focus:border-[#0F7B5A]"
          />
        </div>
        <p className="text-xs text-[#8B8680] mt-1">
          We'll send a WhatsApp message when your table is ready.
        </p>
      </div>

      {/* Party size */}
      <div>
        <label className="block text-xs font-semibold text-[#5E5A57] mb-1.5 uppercase tracking-wider">
          Party size
        </label>
        <div className="relative">
          <Users
            size={16}
            className="absolute left-3 top-1/2 -translate-y-1/2 text-[#8B8680]"
          />
          <select
            value={form.partySize}
            onChange={(e) => set("partySize", Number(e.target.value))}
            className="w-full pl-9 pr-4 py-3 rounded-xl border border-[#E8E5E0] bg-white text-sm text-[#1A1A1A] focus:outline-none focus:ring-2 focus:ring-[#0F7B5A]/30 focus:border-[#0F7B5A] appearance-none"
          >
            {Array.from({ length: 20 }, (_, i) => i + 1).map((n) => (
              <option key={n} value={n}>
                {n} {n === 1 ? "person" : "people"}
              </option>
            ))}
          </select>
        </div>
      </div>

      {error && (
        <div className="rounded-xl bg-red-50 border border-red-100 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      )}

      <button
        type="submit"
        disabled={loading}
        className="w-full py-3.5 rounded-xl bg-[#0F7B5A] text-white text-sm font-semibold hover:bg-[#0a6349] transition-colors disabled:opacity-60 flex items-center justify-center gap-2"
      >
        {loading ? (
          <>
            <Loader2 size={16} className="animate-spin" />
            Joining…
          </>
        ) : (
          "Join Queue"
        )}
      </button>

      <p className="text-xs text-center text-[#8B8680]">
        By joining you agree to receive a WhatsApp notification when your table
        is ready. Standard messaging rates may apply.
      </p>
    </form>
  );
}
