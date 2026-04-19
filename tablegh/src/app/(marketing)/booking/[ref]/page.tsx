import { notFound } from "next/navigation";
import Link from "next/link";
import { db } from "@/lib/db";
import { minutesToDisplay, formatDateGH } from "@/lib/utils/slots";
import { formatGHS } from "@/lib/utils/currency";
import {
  CheckCircle2,
  Calendar,
  Clock,
  Users,
  MapPin,
  Phone,
  Share2,
  X,
} from "lucide-react";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Booking Confirmed | TableGH",
  robots: "noindex",
};

async function getReservation(ref: string) {
  return db.reservation.findUnique({
    where: { ref },
    include: {
      restaurant: {
        select: {
          name: true,
          slug: true,
          address: true,
          phone: true,
          neighborhood: true,
          googleMapsUrl: true,
          photos: {
            where: { context: "EXTERIOR" },
            take: 1,
            select: { url: true },
          },
        },
      },
      payment: { select: { status: true, amountPesewas: true } },
    },
  });
}

export default async function BookingConfirmationPage({
  params,
  searchParams,
}: {
  params: Promise<{ ref: string }>;
  searchParams: Promise<{ payment?: string }>;
}) {
  const { ref } = await params;
  const { payment } = await searchParams;
  const reservation = await getReservation(ref);
  if (!reservation) notFound();

  const cancelUrl = `/api/v1/reservations/${ref}`;
  const appUrl = process.env["NEXT_PUBLIC_APP_URL"] ?? "https://tablegh.com";
  const shareText = `I've got a table at ${reservation.restaurant.name} on ${formatDateGH(reservation.date)} at ${minutesToDisplay(reservation.timeSlot)} — TableGH ref: ${reservation.ref}`;
  const whatsappShare = `https://wa.me/?text=${encodeURIComponent(shareText + "\n" + appUrl + "/booking/" + reservation.ref)}`;

  const isConfirmed = ["CONFIRMED", "SEATED", "COMPLETED"].includes(reservation.status);
  const isPending = reservation.status === "PENDING";

  return (
    <div className="min-h-screen bg-[#FAF7F2] py-12">
      <div className="max-w-lg mx-auto px-4">
        {/* Status header */}
        <div
          className={`rounded-3xl p-8 text-center mb-6 ${
            isConfirmed
              ? "bg-[#0F7B5A] text-white"
              : isPending
              ? "bg-[#F59E0B] text-white"
              : "bg-[#EF4444] text-white"
          }`}
        >
          <CheckCircle2 size={48} className="mx-auto mb-4 opacity-90" aria-hidden="true" />
          <h1
            className="text-2xl font-bold mb-2"
            style={{ fontFamily: "Fraunces, serif" }}
          >
            {isConfirmed
              ? "You're all set!"
              : isPending
              ? "Awaiting payment"
              : "Booking cancelled"}
          </h1>
          <p className="opacity-80 text-sm">
            {isConfirmed
              ? `See you at ${reservation.restaurant.name}`
              : isPending
              ? "Complete your deposit to confirm"
              : "This reservation was cancelled"}
          </p>
          <div className="mt-4 px-4 py-2 rounded-xl bg-white/20 font-mono font-bold tracking-widest text-lg">
            {reservation.ref}
          </div>
        </div>

        {/* Details card */}
        <div className="bg-white rounded-2xl p-6 space-y-4 mb-4">
          <h2 className="font-semibold text-[#1A1A1A]">
            {reservation.restaurant.name}
          </h2>

          <div className="grid grid-cols-2 gap-4 text-sm">
            <div className="flex items-center gap-2 text-[#5E5A57]">
              <Calendar size={15} className="text-[#0F7B5A]" aria-hidden="true" />
              <div>
                <p className="text-xs text-[#8B8680]">Date</p>
                <p className="font-medium text-[#1A1A1A]">
                  {formatDateGH(reservation.date)}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2 text-[#5E5A57]">
              <Clock size={15} className="text-[#0F7B5A]" aria-hidden="true" />
              <div>
                <p className="text-xs text-[#8B8680]">Time</p>
                <p className="font-medium text-[#1A1A1A]">
                  {minutesToDisplay(reservation.timeSlot)}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2 text-[#5E5A57]">
              <Users size={15} className="text-[#0F7B5A]" aria-hidden="true" />
              <div>
                <p className="text-xs text-[#8B8680]">Party</p>
                <p className="font-medium text-[#1A1A1A]">
                  {reservation.partySize}{" "}
                  {reservation.partySize === 1 ? "guest" : "guests"}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2 text-[#5E5A57]">
              <Phone size={15} className="text-[#0F7B5A]" aria-hidden="true" />
              <div>
                <p className="text-xs text-[#8B8680]">Contact</p>
                <p className="font-medium text-[#1A1A1A] text-xs">
                  {reservation.guestPhone}
                </p>
              </div>
            </div>
          </div>

          <div className="flex items-start gap-2 pt-2 border-t border-[#E8E5E0]">
            <MapPin size={15} className="text-[#0F7B5A] mt-0.5 flex-shrink-0" aria-hidden="true" />
            <div>
              <p className="text-sm text-[#1A1A1A]">{reservation.restaurant.address}</p>
              {reservation.restaurant.googleMapsUrl && (
                <a
                  href={reservation.restaurant.googleMapsUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-xs text-[#0F7B5A] hover:underline"
                >
                  Open in Google Maps →
                </a>
              )}
            </div>
          </div>

          {reservation.specialReqs && (
            <div className="pt-2 border-t border-[#E8E5E0]">
              <p className="text-xs text-[#8B8680] mb-1">Special requests</p>
              <p className="text-sm text-[#5E5A57]">{reservation.specialReqs}</p>
            </div>
          )}
        </div>

        {/* Deposit pending notice */}
        {isPending && reservation.depositPesewas && (
          <div className="bg-[#F59E0B]/10 border border-[#F59E0B]/20 rounded-2xl p-4 mb-4">
            <p className="font-medium text-sm text-[#1A1A1A] mb-1">
              Deposit required:{" "}
              <strong>{formatGHS(reservation.depositPesewas)}</strong>
            </p>
            <p className="text-xs text-[#5E5A57] mb-3">
              Pay your deposit to secure this table.
            </p>
            <Link
              href={`/booking/${reservation.ref}/pay`}
              className="block w-full py-2.5 rounded-xl bg-[#F59E0B] text-white text-sm font-semibold text-center"
            >
              Pay deposit →
            </Link>
          </div>
        )}

        {/* WhatsApp reminder notice */}
        {isConfirmed && (
          <div className="flex items-start gap-3 p-4 rounded-xl bg-[#25D366]/10 border border-[#25D366]/20 mb-4">
            <span className="text-xl" aria-hidden="true">📱</span>
            <p className="text-sm text-[#5E5A57]">
              We've sent your confirmation to{" "}
              <strong>{reservation.guestPhone}</strong> via WhatsApp. You'll
              also get reminders 24h and 2h before your booking.
            </p>
          </div>
        )}

        {/* Actions */}
        <div className="space-y-3">
          {/* Share on WhatsApp */}
          <a
            href={whatsappShare}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center justify-center gap-2 w-full py-3 rounded-xl bg-[#25D366] text-white font-semibold text-sm"
          >
            <Share2 size={16} aria-hidden="true" />
            Share on WhatsApp
          </a>

          {/* Cancel link (only for pending/confirmed) */}
          {(isPending || isConfirmed) && (
            <Link
              href={`/booking/${reservation.ref}/cancel`}
              className="flex items-center justify-center gap-2 w-full py-3 rounded-xl border border-[#E8E5E0] text-[#8B8680] text-sm hover:text-[#EF4444] hover:border-[#EF4444]/30 transition-colors"
            >
              <X size={16} aria-hidden="true" />
              Cancel reservation
            </Link>
          )}

          <Link
            href="/"
            className="block text-center text-sm text-[#0F7B5A] hover:underline"
          >
            Discover more restaurants →
          </Link>
        </div>
      </div>
    </div>
  );
}
