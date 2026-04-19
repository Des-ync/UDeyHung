"use client";

/**
 * QueueTracker — client component that connects to the SSE stream and
 * renders the live queue position.
 */

import { useEffect, useState, useRef } from "react";
import Link from "next/link";
import { Clock, CheckCircle, XCircle, Users, Loader2 } from "lucide-react";

interface QueueState {
  queuePosition: number;
  estimatedWaitMinutes: number;
  status: "QUEUED" | "NOTIFIED" | "SEATED" | "CANCELLED" | "NO_SHOW";
  error?: string;
}

interface Props {
  entryId: string;
  restaurantSlug: string;
}

export function QueueTracker({ entryId, restaurantSlug }: Props) {
  const [state, setState] = useState<QueueState | null>(null);
  const [connectionStatus, setConnectionStatus] = useState<
    "connecting" | "connected" | "closed"
  >("connecting");
  const [cancelling, setCancelling] = useState(false);
  const esRef = useRef<EventSource | null>(null);

  useEffect(() => {
    let reconnectTimer: ReturnType<typeof setTimeout> | null = null;
    let attempt = 0;
    let stopped = false;

    function connect() {
      if (stopped) return;
      const es = new EventSource(`/api/v1/walkin/${entryId}/stream`);
      esRef.current = es;

      es.onopen = () => {
        setConnectionStatus("connected");
        attempt = 0; // reset backoff on successful connect
      };

      es.onmessage = (event: MessageEvent<string>) => {
        try {
          const data = JSON.parse(event.data) as QueueState;
          setState(data);
          if (data.status === "SEATED" || data.status === "CANCELLED" || data.status === "NO_SHOW" || data.error) {
            stopped = true;
            setConnectionStatus("closed");
            es.close();
          }
        } catch {
          // malformed event — ignore
        }
      };

      es.onerror = () => {
        es.close();
        if (stopped) return;
        setConnectionStatus("connecting");
        // Exponential backoff: 1s, 2s, 4s, 8s, max 30s
        const delay = Math.min(1000 * 2 ** attempt, 30_000);
        attempt++;
        reconnectTimer = setTimeout(connect, delay);
      };
    }

    connect();

    return () => {
      stopped = true;
      esRef.current?.close();
      if (reconnectTimer) clearTimeout(reconnectTimer);
    };
  }, [entryId]);

  async function handleCancel() {
    if (!confirm("Are you sure you want to leave the queue?")) return;
    setCancelling(true);
    try {
      await fetch(`/api/v1/walkin/${entryId}`, { method: "DELETE" });
      esRef.current?.close();
      setState((prev) => prev ? { ...prev, status: "CANCELLED" } : null);
      setConnectionStatus("closed");
    } finally {
      setCancelling(false);
    }
  }

  // ── Connecting ──
  if (connectionStatus === "connecting" && !state) {
    return (
      <div className="text-center py-16 space-y-3">
        <Loader2 size={32} className="animate-spin text-[#0F7B5A] mx-auto" />
        <p className="text-sm text-[#8B8680]">Connecting to queue…</p>
      </div>
    );
  }

  if (!state) return null;

  // ── Seated ──
  if (state.status === "SEATED") {
    return (
      <div className="text-center space-y-4 py-8">
        <div className="w-20 h-20 rounded-full bg-green-100 flex items-center justify-center mx-auto">
          <CheckCircle size={40} className="text-green-600" />
        </div>
        <div>
          <h2
            className="text-2xl font-bold text-[#1A1A1A]"
            style={{ fontFamily: "Fraunces, serif" }}
          >
            Enjoy your meal!
          </h2>
          <p className="text-sm text-[#8B8680] mt-1">
            Your table is ready. Please head to the host stand.
          </p>
        </div>
        <Link
          href={`/restaurants/${restaurantSlug}`}
          className="inline-block text-sm text-[#0F7B5A] hover:underline font-medium"
        >
          View restaurant →
        </Link>
      </div>
    );
  }

  // ── Cancelled / No-show ──
  if (state.status === "CANCELLED" || state.status === "NO_SHOW") {
    return (
      <div className="text-center space-y-4 py-8">
        <div className="w-20 h-20 rounded-full bg-[#F5F2ED] flex items-center justify-center mx-auto">
          <XCircle size={40} className="text-[#8B8680]" />
        </div>
        <div>
          <h2
            className="text-xl font-bold text-[#1A1A1A]"
            style={{ fontFamily: "Fraunces, serif" }}
          >
            {state.status === "CANCELLED"
              ? "You've left the queue"
              : "Queue entry expired"}
          </h2>
          <p className="text-sm text-[#8B8680] mt-1">
            {state.status === "CANCELLED"
              ? "Scan the QR code to rejoin if you change your mind."
              : "The 15-minute window passed. Please scan the QR code to rejoin."}
          </p>
        </div>
        <Link
          href={`/walkin/${restaurantSlug}`}
          className="inline-block px-5 py-2.5 rounded-xl bg-[#0F7B5A] text-white text-sm font-semibold hover:bg-[#0a6349] transition-colors"
        >
          Rejoin queue
        </Link>
      </div>
    );
  }

  // ── Error ──
  if (state.error) {
    return (
      <div className="text-center py-12 text-sm text-[#8B8680]">
        Queue entry not found. Please scan the QR code again.
      </div>
    );
  }

  // ── Queued / Notified ──
  const isFirst = state.queuePosition === 1;
  const isNotified = state.status === "NOTIFIED";

  return (
    <div className="space-y-6">
      {/* Notified banner */}
      {isNotified && (
        <div className="rounded-xl bg-amber-50 border border-amber-100 px-4 py-3 text-sm text-amber-700 font-medium text-center">
          Your table is almost ready — please head to the host stand!
        </div>
      )}

      {/* Position card */}
      <div className="bg-white rounded-2xl border border-[#E8E5E0] p-6 text-center shadow-sm">
        <p className="text-xs font-semibold text-[#8B8680] uppercase tracking-wider mb-2">
          Your position
        </p>

        {isFirst ? (
          <>
            <div className="text-6xl font-bold text-[#0F7B5A] mb-1" style={{ fontFamily: "Fraunces, serif" }}>
              Next!
            </div>
            <p className="text-sm text-[#5E5A57]">
              You're up next — please make your way to the host stand.
            </p>
          </>
        ) : (
          <>
            <div
              className="text-7xl font-bold text-[#1A1A1A] mb-1 tabular-nums"
              style={{ fontFamily: "Fraunces, serif" }}
            >
              #{state.queuePosition}
            </div>
            <p className="text-sm text-[#5E5A57]">
              {state.queuePosition - 1}{" "}
              {state.queuePosition - 1 === 1 ? "party" : "parties"} ahead of you
            </p>
          </>
        )}
      </div>

      {/* Wait time */}
      {state.estimatedWaitMinutes > 0 && (
        <div className="flex items-center gap-3 bg-white rounded-xl border border-[#E8E5E0] px-4 py-3">
          <Clock size={18} className="text-[#D4A853] flex-shrink-0" />
          <div>
            <p className="text-xs text-[#8B8680]">Estimated wait</p>
            <p className="text-sm font-semibold text-[#1A1A1A]">
              ~{state.estimatedWaitMinutes} minutes
            </p>
          </div>
        </div>
      )}

      {/* Connection status */}
      <div className="flex items-center justify-between text-xs text-[#C5C0BB]">
        <span className="flex items-center gap-1.5">
          <span
            className={`w-1.5 h-1.5 rounded-full ${
              connectionStatus === "connected"
                ? "bg-green-500 animate-pulse"
                : "bg-[#C5C0BB]"
            }`}
          />
          {connectionStatus === "connected"
            ? "Live updates"
            : "Reconnecting…"}
        </span>
        <span>Auto-refreshes every 10s</span>
      </div>

      {/* Cancel button */}
      <button
        onClick={handleCancel}
        disabled={cancelling}
        className="w-full py-2.5 rounded-xl border border-[#E8E5E0] text-sm text-[#8B8680] hover:border-red-200 hover:text-red-500 transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
      >
        {cancelling ? (
          <Loader2 size={14} className="animate-spin" />
        ) : null}
        Leave queue
      </button>
    </div>
  );
}
