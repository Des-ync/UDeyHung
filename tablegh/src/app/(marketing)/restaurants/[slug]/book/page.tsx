"use client";

import { useState, useEffect } from "react";
import { useSearchParams, useRouter, useParams } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useMutation } from "@tanstack/react-query";
import { minutesToDisplay, formatDateGH } from "@/lib/utils/slots";
import { ghPhoneSchema } from "@/lib/validations";
import {
  Users,
  Calendar,
  Clock,
  Phone,
  User,
  MessageSquare,
  Loader2,
  CheckCircle2,
  ChevronLeft,
} from "lucide-react";
import confetti from "canvas-confetti";

const bookingFormSchema = z.object({
  guestName: z.string().min(2, "Please enter your full name").max(100),
  guestPhone: ghPhoneSchema,
  occasion: z
    .enum([
      "BIRTHDAY",
      "ANNIVERSARY",
      "BUSINESS",
      "DATE_NIGHT",
      "CASUAL",
      "CELEBRATION",
      "OTHER",
    ])
    .optional(),
  specialReqs: z
    .string()
    .max(280, "Keep it under 280 characters")
    .optional(),
});

type BookingFormValues = z.infer<typeof bookingFormSchema>;

interface CreateReservationResponse {
  data: {
    id: string;
    ref: string;
    status: string;
    restaurantName: string;
    depositRequired: boolean;
    depositPesewas: number | null;
    depositAmountDisplay: string | null;
  };
}

export default function BookPage() {
  const router = useRouter();
  const params = useParams();
  const searchParams = useSearchParams();
  const slug = params["slug"] as string;

  const date = searchParams.get("date") ?? "";
  const timeSlot = Number(searchParams.get("timeSlot") ?? "0");
  const partySize = Number(searchParams.get("partySize") ?? "2");

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<BookingFormValues>({
    resolver: zodResolver(bookingFormSchema),
    defaultValues: { occasion: "CASUAL" },
  });

  const [restaurantId, setRestaurantId] = useState<string | null>(null);

  // Fetch restaurant ID from slug
  useEffect(() => {
    fetch(`/api/v1/restaurants/${slug}`)
      .then((r) => r.json())
      .then((data: { data?: { id: string } }) => {
        setRestaurantId(data.data?.id ?? null);
      })
      .catch(console.error);
  }, [slug]);

  const mutation = useMutation({
    mutationFn: async (values: BookingFormValues) => {
      if (!restaurantId) throw new Error("Restaurant not found");
      const res = await fetch("/api/v1/reservations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          restaurantId,
          partySize,
          date,
          timeSlot,
          ...values,
        }),
      });
      if (!res.ok) {
        const err = (await res.json()) as { error?: { message?: string } };
        throw new Error(err.error?.message ?? "Booking failed");
      }
      return res.json() as Promise<CreateReservationResponse>;
    },
    onSuccess: (data) => {
      // 🎉 Confetti on success
      confetti({
        particleCount: 120,
        spread: 80,
        origin: { y: 0.5 },
        colors: ["#0F7B5A", "#D4A853", "#FAF7F2"],
      });
      router.push(`/booking/${data.data.ref}`);
    },
  });

  const onSubmit = handleSubmit((values) => mutation.mutate(values));

  const displayDate = date
    ? formatDateGH(new Date(date + "T00:00:00Z"))
    : "—";

  return (
    <div className="min-h-screen bg-[#FAF7F2] py-8">
      <div className="max-w-lg mx-auto px-4">
        {/* Back button */}
        <button
          onClick={() => router.back()}
          className="flex items-center gap-1 text-sm text-[#8B8680] hover:text-[#1A1A1A] mb-6 transition-colors"
        >
          <ChevronLeft size={16} aria-hidden="true" />
          Back
        </button>

        {/* Booking summary card */}
        <div className="bg-[#0F7B5A] rounded-2xl p-5 text-white mb-6">
          <h1
            className="text-xl font-bold mb-4"
            style={{ fontFamily: "Fraunces, serif" }}
          >
            Confirm your table
          </h1>
          <div className="grid grid-cols-3 gap-4 text-sm">
            <div className="flex items-center gap-2">
              <Calendar size={16} aria-hidden="true" className="opacity-70" />
              <div>
                <p className="opacity-70 text-xs">Date</p>
                <p className="font-medium">{displayDate}</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Clock size={16} aria-hidden="true" className="opacity-70" />
              <div>
                <p className="opacity-70 text-xs">Time</p>
                <p className="font-medium">{minutesToDisplay(timeSlot)}</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Users size={16} aria-hidden="true" className="opacity-70" />
              <div>
                <p className="opacity-70 text-xs">Guests</p>
                <p className="font-medium">
                  {partySize} {partySize === 1 ? "person" : "people"}
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Error state */}
        {mutation.error && (
          <div className="mb-4 p-3 rounded-xl bg-[#EF4444]/10 border border-[#EF4444]/20 text-[#EF4444] text-sm">
            {mutation.error.message}
          </div>
        )}

        {/* Form */}
        <form onSubmit={onSubmit} className="space-y-4" noValidate>
          <div className="bg-white rounded-2xl p-5 space-y-4">
            <h2 className="font-semibold text-[#1A1A1A]">Your details</h2>

            {/* Name */}
            <div>
              <label
                htmlFor="guestName"
                className="block text-sm font-medium text-[#5E5A57] mb-1.5"
              >
                <User size={14} className="inline mr-1.5" aria-hidden="true" />
                Full name
              </label>
              <input
                id="guestName"
                type="text"
                autoComplete="name"
                {...register("guestName")}
                className="w-full rounded-xl border border-[#E8E5E0] px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#0F7B5A] bg-[#FAF7F2]"
                placeholder="Kwame Mensah"
                aria-describedby={errors.guestName ? "guestName-error" : undefined}
              />
              {errors.guestName && (
                <p id="guestName-error" className="text-xs text-[#EF4444] mt-1" role="alert">
                  {errors.guestName.message}
                </p>
              )}
            </div>

            {/* Phone */}
            <div>
              <label
                htmlFor="guestPhone"
                className="block text-sm font-medium text-[#5E5A57] mb-1.5"
              >
                <Phone size={14} className="inline mr-1.5" aria-hidden="true" />
                Phone number
              </label>
              <input
                id="guestPhone"
                type="tel"
                autoComplete="tel"
                {...register("guestPhone")}
                className="w-full rounded-xl border border-[#E8E5E0] px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#0F7B5A] bg-[#FAF7F2]"
                placeholder="024 123 4567"
                aria-describedby={errors.guestPhone ? "guestPhone-error" : undefined}
              />
              <p className="text-xs text-[#8B8680] mt-1">
                Confirmation sent via WhatsApp
              </p>
              {errors.guestPhone && (
                <p id="guestPhone-error" className="text-xs text-[#EF4444] mt-1" role="alert">
                  {errors.guestPhone.message}
                </p>
              )}
            </div>

            {/* Occasion */}
            <div>
              <label
                htmlFor="occasion"
                className="block text-sm font-medium text-[#5E5A57] mb-1.5"
              >
                Occasion
              </label>
              <select
                id="occasion"
                {...register("occasion")}
                className="w-full rounded-xl border border-[#E8E5E0] px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#0F7B5A] bg-[#FAF7F2]"
              >
                <option value="CASUAL">Just dining</option>
                <option value="BIRTHDAY">🎂 Birthday</option>
                <option value="ANNIVERSARY">💍 Anniversary</option>
                <option value="DATE_NIGHT">🌹 Date night</option>
                <option value="BUSINESS">💼 Business dinner</option>
                <option value="CELEBRATION">🥂 Celebration</option>
                <option value="OTHER">Other</option>
              </select>
            </div>

            {/* Special requests */}
            <div>
              <label
                htmlFor="specialReqs"
                className="block text-sm font-medium text-[#5E5A57] mb-1.5"
              >
                <MessageSquare
                  size={14}
                  className="inline mr-1.5"
                  aria-hidden="true"
                />
                Special requests{" "}
                <span className="font-normal text-[#8B8680]">(optional)</span>
              </label>
              <textarea
                id="specialReqs"
                {...register("specialReqs")}
                rows={3}
                maxLength={280}
                className="w-full rounded-xl border border-[#E8E5E0] px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#0F7B5A] bg-[#FAF7F2] resize-none"
                placeholder="Allergies, dietary needs, high chair required, surprise cake..."
                aria-describedby={errors.specialReqs ? "specialReqs-error" : undefined}
              />
              {errors.specialReqs && (
                <p id="specialReqs-error" className="text-xs text-[#EF4444] mt-1" role="alert">
                  {errors.specialReqs.message}
                </p>
              )}
            </div>
          </div>

          {/* WhatsApp notice */}
          <div className="flex items-start gap-3 p-4 rounded-xl bg-[#25D366]/10 border border-[#25D366]/20">
            <span className="text-xl" aria-hidden="true">📱</span>
            <div>
              <p className="text-sm font-medium text-[#1A1A1A]">
                Confirmation via WhatsApp
              </p>
              <p className="text-xs text-[#5E5A57] mt-0.5">
                You'll receive your booking ref, reminders 24h and 2h before,
                and a cancel link — all on WhatsApp.
              </p>
            </div>
          </div>

          <button
            type="submit"
            disabled={mutation.isPending}
            className="w-full py-4 rounded-xl font-semibold text-white text-base transition-all flex items-center justify-center gap-2 disabled:opacity-60"
            style={{ background: "#0F7B5A" }}
          >
            {mutation.isPending ? (
              <>
                <Loader2 size={18} className="animate-spin" aria-hidden="true" />
                Confirming...
              </>
            ) : (
              <>
                <CheckCircle2 size={18} aria-hidden="true" />
                Confirm reservation
              </>
            )}
          </button>

          <p className="text-xs text-center text-[#8B8680]">
            By reserving, you agree to our{" "}
            <a href="/terms" className="underline">
              Terms
            </a>{" "}
            and{" "}
            <a href="/privacy" className="underline">
              Privacy Policy
            </a>
            .
          </p>
        </form>
      </div>
    </div>
  );
}
