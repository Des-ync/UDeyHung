"use client";

/**
 * WalkInQRCode — Admin component to display, download, and manage the
 * walk-in queue for a restaurant.
 *
 * Shows:
 *  - QR code image (fetched from /api/v1/restaurants/[slug]/qr)
 *  - Active queue list with seat/cancel controls
 *  - Live queue count (refetches every 15 s)
 */

import { useState, useEffect, useCallback } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Download,
  RefreshCw,
  CheckCircle,
  XCircle,
  Users,
  Clock,
  Loader2,
} from "lucide-react";

interface WalkInEntry {
  id: string;
  guestName: string;
  partySize: number;
  queuePosition: number;
  estimatedWaitMinutes: number;
  status: "QUEUED" | "NOTIFIED" | "SEATED" | "CANCELLED" | "NO_SHOW";
  createdAt: string;
}

interface Props {
  restaurantId: string;
  restaurantSlug: string;
  restaurantName: string;
}

export function WalkInQRCode({ restaurantId, restaurantSlug, restaurantName }: Props) {
  const qc = useQueryClient();

  // Fetch active queue
  const { data: queue = [], isFetching } = useQuery<WalkInEntry[]>({
    queryKey: ["walkin-queue", restaurantId],
    queryFn: async () => {
      const res = await fetch(
        `/api/v1/admin/walkin?restaurantId=${restaurantId}`
      );
      if (!res.ok) return [];
      const json = await res.json() as { data: WalkInEntry[] };
      return json.data ?? [];
    },
    refetchInterval: 15_000,
  });

  // Seat / cancel mutations
  const statusMutation = useMutation({
    mutationFn: async ({
      id,
      action,
    }: {
      id: string;
      action: "seat" | "cancel";
    }) => {
      const res = await fetch(`/api/v1/admin/walkin/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          status: action === "seat" ? "SEATED" : "CANCELLED",
        }),
      });
      if (!res.ok) throw new Error("Failed to update");
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["walkin-queue", restaurantId] }),
  });

  const activeEntries = queue.filter(
    (e) => e.status === "QUEUED" || e.status === "NOTIFIED"
  );

  const qrUrl = `/api/v1/restaurants/${restaurantSlug}/qr`;

  function handleDownload() {
    const a = document.createElement("a");
    a.href = qrUrl;
    a.download = `tablegh-walkin-${restaurantSlug}.png`;
    a.click();
  }

  return (
    <div className="space-y-6">
      {/* QR code card */}
      <div className="bg-white rounded-2xl border border-[#E8E5E0] p-6">
        <div className="flex items-start justify-between mb-4">
          <div>
            <h3 className="text-base font-semibold text-[#1A1A1A]">
              Walk-In QR Code
            </h3>
            <p className="text-xs text-[#8B8680] mt-0.5">
              Print and display at your entrance for guests to scan.
            </p>
          </div>
          <button
            onClick={handleDownload}
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl border border-[#E8E5E0] text-xs font-medium text-[#5E5A57] hover:border-[#0F7B5A]/40 hover:text-[#0F7B5A] transition-colors"
          >
            <Download size={13} />
            Download PNG
          </button>
        </div>

        <div className="flex flex-col sm:flex-row gap-6 items-center">
          {/* QR image */}
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={qrUrl}
            alt={`Walk-in QR code for ${restaurantName}`}
            width={200}
            height={200}
            className="rounded-xl border border-[#E8E5E0] flex-shrink-0"
          />

          {/* Instructions */}
          <div className="space-y-3 text-sm text-[#5E5A57]">
            <p className="font-semibold text-[#1A1A1A]">How it works</p>
            <ol className="space-y-2 list-decimal list-inside text-xs text-[#5E5A57]">
              <li>Guest scans QR code with their phone camera.</li>
              <li>They enter their name, phone number, and party size.</li>
              <li>They see their live queue position on their phone.</li>
              <li>
                When ready, tap <strong>Seat</strong> below — they'll get a
                WhatsApp notification.
              </li>
            </ol>
            <p className="text-xs text-[#8B8680]">
              Walk-in URL:{" "}
              <span className="font-mono text-[#0F7B5A]">
                tablegh.com/walkin/{restaurantSlug}
              </span>
            </p>
          </div>
        </div>
      </div>

      {/* Active queue */}
      <div className="bg-white rounded-2xl border border-[#E8E5E0]">
        <div className="flex items-center justify-between px-4 py-3 border-b border-[#F5F2ED]">
          <div className="flex items-center gap-2">
            <h3 className="text-sm font-semibold text-[#1A1A1A]">
              Active Queue
            </h3>
            {activeEntries.length > 0 && (
              <span className="px-2 py-0.5 rounded-full bg-[#0F7B5A]/10 text-[#0F7B5A] text-xs font-semibold">
                {activeEntries.length}
              </span>
            )}
          </div>
          <button
            onClick={() =>
              qc.invalidateQueries({ queryKey: ["walkin-queue", restaurantId] })
            }
            className="text-[#8B8680] hover:text-[#0F7B5A] transition-colors"
            title="Refresh"
          >
            <RefreshCw size={14} className={isFetching ? "animate-spin" : ""} />
          </button>
        </div>

        {activeEntries.length === 0 ? (
          <div className="px-4 py-10 text-center text-sm text-[#8B8680]">
            No guests in queue right now.
          </div>
        ) : (
          <ul className="divide-y divide-[#F5F2ED]">
            {activeEntries.map((entry) => (
              <li key={entry.id} className="flex items-center gap-3 px-4 py-3">
                {/* Position badge */}
                <div className="w-8 h-8 rounded-full bg-[#0F7B5A]/10 flex items-center justify-center flex-shrink-0 text-sm font-bold text-[#0F7B5A]">
                  {entry.queuePosition}
                </div>

                {/* Info */}
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-[#1A1A1A] line-clamp-1">
                    {entry.guestName}
                    {entry.status === "NOTIFIED" && (
                      <span className="ml-2 text-[10px] px-1.5 py-0.5 rounded bg-amber-50 text-amber-600 font-semibold">
                        Notified
                      </span>
                    )}
                  </p>
                  <div className="flex items-center gap-2 text-xs text-[#8B8680] mt-0.5">
                    <span className="flex items-center gap-1">
                      <Users size={10} />
                      {entry.partySize} {entry.partySize === 1 ? "person" : "people"}
                    </span>
                    <span>·</span>
                    <span className="flex items-center gap-1">
                      <Clock size={10} />
                      {formatWaitTime(entry.createdAt)}
                    </span>
                  </div>
                </div>

                {/* Actions */}
                <div className="flex items-center gap-1.5 flex-shrink-0">
                  <button
                    onClick={() =>
                      statusMutation.mutate({ id: entry.id, action: "seat" })
                    }
                    disabled={statusMutation.isPending}
                    className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-green-50 text-green-700 text-xs font-medium hover:bg-green-100 transition-colors disabled:opacity-50"
                    title="Mark as seated"
                  >
                    <CheckCircle size={12} />
                    Seat
                  </button>
                  <button
                    onClick={() =>
                      statusMutation.mutate({ id: entry.id, action: "cancel" })
                    }
                    disabled={statusMutation.isPending}
                    className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-[#F5F2ED] text-[#8B8680] text-xs font-medium hover:bg-red-50 hover:text-red-600 transition-colors disabled:opacity-50"
                    title="Remove from queue"
                  >
                    <XCircle size={12} />
                    Remove
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

function formatWaitTime(createdAt: string): string {
  const mins = Math.floor(
    (Date.now() - new Date(createdAt).getTime()) / 60_000
  );
  if (mins < 1) return "Just joined";
  if (mins === 1) return "1 min ago";
  return `${mins} mins ago`;
}
