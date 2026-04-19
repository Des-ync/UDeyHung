/**
 * GET /api/v1/walkin/[id]/stream
 *
 * Server-Sent Events endpoint for real-time walk-in queue position.
 * Polls the database every 10 s and pushes updates to the client.
 * Automatically closes when the guest is SEATED, CANCELLED, or NO_SHOW.
 *
 * SSE event format:
 *   data: { queuePosition, estimatedWaitMinutes, status }
 *
 * Keep-alive:
 *   ": ping" comment every 25 s (prevents proxy timeout)
 */

import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

export const dynamic = "force-dynamic";

const POLL_INTERVAL_MS = 10_000;
const KEEPALIVE_INTERVAL_MS = 25_000;
const MAX_LIFETIME_MS = 2 * 60 * 60 * 1000; // 2 hours — client reconnects
const AVG_MINS_PER_PARTY = 20;

const TERMINAL_STATUSES = new Set(["SEATED", "CANCELLED", "NO_SHOW"]);

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    async start(controller) {
      let aborted = false;
      req.signal.addEventListener("abort", () => {
        aborted = true;
        controller.close();
      });

      // Helper: send an SSE data event
      function send(payload: unknown) {
        try {
          controller.enqueue(
            encoder.encode(`data: ${JSON.stringify(payload)}\n\n`)
          );
        } catch {
          aborted = true;
        }
      }

      // Helper: send keep-alive comment
      function keepAlive() {
        try {
          controller.enqueue(encoder.encode(": ping\n\n"));
        } catch {
          aborted = true;
        }
      }

      // Initial existence check
      const first = await db.walkInEntry.findUnique({
        where: { id },
        select: { id: true },
      });
      if (!first) {
        send({ error: "not_found" });
        controller.close();
        return;
      }

      let lastKeepalive = Date.now();
      const startedAt = Date.now();

      while (!aborted) {
        // Cap connection lifetime so stale tabs don't leak resources
        if (Date.now() - startedAt > MAX_LIFETIME_MS) {
          send({ error: "timeout", message: "Connection expired. Reconnecting…" });
          break;
        }
        const entry = await db.walkInEntry.findUnique({
          where: { id },
          include: {
            restaurant: { select: { defaultTurnTime: true } },
          },
        });

        if (!entry) {
          send({ error: "not_found" });
          break;
        }

        if (TERMINAL_STATUSES.has(entry.status)) {
          send({ status: entry.status, queuePosition: 0, estimatedWaitMinutes: 0 });
          break;
        }

        // Recompute live position
        const ahead = await db.walkInEntry.count({
          where: {
            restaurantId: entry.restaurantId,
            status: { in: ["QUEUED", "NOTIFIED"] },
            createdAt: { lt: entry.createdAt },
          },
        });
        const turnTime = entry.restaurant.defaultTurnTime ?? AVG_MINS_PER_PARTY;
        const queuePosition = ahead + 1;
        const estimatedWaitMinutes = ahead * turnTime;

        send({ queuePosition, estimatedWaitMinutes, status: entry.status });

        // Sleep POLL_INTERVAL_MS — wake early on abort
        const sleepEnd = Date.now() + POLL_INTERVAL_MS;
        while (!aborted && Date.now() < sleepEnd) {
          await new Promise((r) => setTimeout(r, 200));

          // Keep-alive every 25 s
          if (Date.now() - lastKeepalive >= KEEPALIVE_INTERVAL_MS) {
            keepAlive();
            lastKeepalive = Date.now();
          }
        }
      }

      try {
        controller.close();
      } catch {
        // already closed
      }
    },
  });

  return new NextResponse(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no",
    },
  });
}
