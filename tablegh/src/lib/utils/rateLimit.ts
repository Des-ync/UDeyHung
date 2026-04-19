/**
 * Sliding-window rate limiter backed by Redis (ioredis).
 *
 * Algorithm: sorted-set sliding window.
 * Each request is recorded as a member with score = timestamp-ms.
 * The Lua script atomically:
 *   1. Removes members outside the current window
 *   2. Adds the new request
 *   3. Returns the current count
 *   4. Sets the key TTL to windowMs so it expires automatically
 *
 * Two limiters exposed:
 *   checkIPLimit(req)   — 100 req/min per IP (general API protection)
 *   checkPhoneLimit(phone) — 10 bookings/day per E.164 phone number
 */

import Redis from "ioredis";
import { NextRequest, NextResponse } from "next/server";
import { tooManyRequests } from "./api";

// ─── Redis client (singleton) ─────────────────────────────────────────────────

let _redis: Redis | null = null;

function getRedis(): Redis {
  if (_redis && _redis.status === "ready") return _redis;

  const url = process.env["REDIS_URL"];
  if (!url) {
    throw new Error("REDIS_URL environment variable not set");
  }

  _redis = new Redis(url, {
    // Upstash requires TLS when using rediss:// scheme
    tls: url.startsWith("rediss://") ? {} : undefined,
    maxRetriesPerRequest: 1,
    connectTimeout: 5_000,
    lazyConnect: true,
    enableOfflineQueue: false,
  });

  _redis.on("error", (err) => {
    // Log but do not crash — rate limiting failures are non-fatal
    console.error("[rateLimit] Redis error:", err.message);
  });

  return _redis;
}

// ─── Lua script ───────────────────────────────────────────────────────────────

/**
 * KEYS[1]    — the rate limit key (e.g. "rl:ip:1.2.3.4")
 * ARGV[1]    — current timestamp in ms
 * ARGV[2]    — window size in ms
 * ARGV[3]    — max allowed requests in the window
 *
 * Returns: current count after this request (number)
 */
const SLIDING_WINDOW_LUA = `
local key      = KEYS[1]
local now      = tonumber(ARGV[1])
local windowMs = tonumber(ARGV[2])
local limit    = tonumber(ARGV[3])

local windowStart = now - windowMs

-- Remove old entries outside the window
redis.call('ZREMRANGEBYSCORE', key, '-inf', windowStart)

-- Count current entries
local count = redis.call('ZCARD', key)

if count < limit then
  -- Add this request with score = current timestamp (use timestamp+random suffix to avoid key collision)
  redis.call('ZADD', key, now, now .. '-' .. math.random(1, 1000000))
  count = count + 1
end

-- Expire the key after 2x window so Redis cleans up
redis.call('PEXPIRE', key, windowMs * 2)

return count
`;

// ─── Core check function ──────────────────────────────────────────────────────

interface RateLimitResult {
  allowed: boolean;
  count: number;
  limit: number;
}

async function checkLimit(
  key: string,
  windowMs: number,
  maxRequests: number
): Promise<RateLimitResult> {
  try {
    const redis = getRedis();
    const now = Date.now();

    const count = (await redis.eval(
      SLIDING_WINDOW_LUA,
      1,
      key,
      String(now),
      String(windowMs),
      String(maxRequests)
    )) as number;

    return { allowed: count <= maxRequests, count, limit: maxRequests };
  } catch (err) {
    // If Redis is unavailable, fail open — better to let a request through than
    // to take down the service with a hard rate limit failure.
    console.error("[rateLimit] check failed, failing open:", err);
    return { allowed: true, count: 0, limit: maxRequests };
  }
}

// ─── IP-based limit: 100 req/min ──────────────────────────────────────────────

const IP_WINDOW_MS = 60 * 1000; // 1 minute
const IP_MAX_REQUESTS = 100;

/**
 * Returns a 429 NextResponse if the IP has exceeded 100 req/min, null otherwise.
 * Usage: const limited = await checkIPLimit(req); if (limited) return limited;
 */
export async function checkIPLimit(
  req: NextRequest
): Promise<NextResponse | null> {
  const ip =
    req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
    req.headers.get("x-real-ip") ??
    "unknown";

  const key = `rl:ip:${ip}`;
  const result = await checkLimit(key, IP_WINDOW_MS, IP_MAX_REQUESTS);

  if (!result.allowed) {
    const res = tooManyRequests(
      `Too many requests. Limit: ${IP_MAX_REQUESTS} per minute.`
    );
    res.headers.set("X-RateLimit-Limit", String(IP_MAX_REQUESTS));
    res.headers.set("X-RateLimit-Remaining", "0");
    res.headers.set("Retry-After", "60");
    return res;
  }

  return null;
}

// ─── Phone-based limit: 10 bookings/day ──────────────────────────────────────

const PHONE_WINDOW_MS = 24 * 60 * 60 * 1000; // 24 hours
const PHONE_MAX_BOOKINGS = 10;

/**
 * Returns a 429 NextResponse if this phone number has made 10+ bookings today,
 * null otherwise.
 */
export async function checkPhoneBookingLimit(
  phone: string
): Promise<NextResponse | null> {
  // Normalise: strip non-digits for the key
  const normalised = phone.replace(/\D/g, "");
  const key = `rl:phone:${normalised}`;
  const result = await checkLimit(key, PHONE_WINDOW_MS, PHONE_MAX_BOOKINGS);

  if (!result.allowed) {
    return tooManyRequests(
      `Booking limit reached. Maximum ${PHONE_MAX_BOOKINGS} bookings per 24 hours per phone number.`
    );
  }

  return null;
}
