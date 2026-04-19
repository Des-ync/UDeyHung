/**
 * Unit tests for the sliding-window rate limiter.
 *
 * We mock ioredis so tests run without a real Redis instance.
 * The Lua script is not exercised here (that's an integration concern);
 * instead we verify the wrapper's behaviour:
 *   - Returns null (allowed) when Redis eval returns count ≤ limit
 *   - Returns 429 NextResponse when Redis eval returns count > limit
 *   - Fails open (returns null) when Redis throws
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

// ─── Mock ioredis before importing the module under test ──────────────────────

const mockEval = vi.fn();
const mockOn = vi.fn();
const mockStatus = { value: "ready" as string };

vi.mock("ioredis", () => {
  return {
    default: vi.fn().mockImplementation(() => ({
      get status() { return mockStatus.value; },
      eval: mockEval,
      on: mockOn,
    })),
  };
});

// Import AFTER mock setup so the module picks up the mocked Redis
import { checkIPLimit, checkPhoneBookingLimit } from "@/lib/utils/rateLimit";

// ─── Helpers ──────────────────────────────────────────────────────────────────

function makeReq(ip: string): NextRequest {
  return new NextRequest("http://localhost/api/test", {
    headers: { "x-forwarded-for": ip },
  });
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe("checkIPLimit", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockStatus.value = "ready";
  });

  it("returns null when under the limit", async () => {
    mockEval.mockResolvedValue(50); // 50 ≤ 100
    const result = await checkIPLimit(makeReq("1.2.3.4"));
    expect(result).toBeNull();
  });

  it("returns null at exactly the limit", async () => {
    mockEval.mockResolvedValue(100); // 100 ≤ 100
    const result = await checkIPLimit(makeReq("1.2.3.4"));
    expect(result).toBeNull();
  });

  it("returns 429 response when over the limit", async () => {
    mockEval.mockResolvedValue(101); // 101 > 100
    const result = await checkIPLimit(makeReq("1.2.3.4"));
    expect(result).not.toBeNull();
    expect(result!.status).toBe(429);
  });

  it("includes rate limit headers on 429", async () => {
    mockEval.mockResolvedValue(200);
    const result = await checkIPLimit(makeReq("1.2.3.4"));
    expect(result!.headers.get("X-RateLimit-Limit")).toBe("100");
    expect(result!.headers.get("X-RateLimit-Remaining")).toBe("0");
    expect(result!.headers.get("Retry-After")).toBe("60");
  });

  it("uses x-real-ip when x-forwarded-for is absent", async () => {
    mockEval.mockResolvedValue(1);
    const req = new NextRequest("http://localhost/api/test", {
      headers: { "x-real-ip": "5.6.7.8" },
    });
    await checkIPLimit(req);
    // Key should contain the IP
    const evalKey = mockEval.mock.calls[0]?.[2] as string;
    expect(evalKey).toContain("5.6.7.8");
  });

  it("fails open (returns null) when Redis throws", async () => {
    mockEval.mockRejectedValue(new Error("connection refused"));
    const result = await checkIPLimit(makeReq("1.2.3.4"));
    // Fail open — don't block the request
    expect(result).toBeNull();
  });

  it("segments keys by IP — different IPs don't share a limit", async () => {
    mockEval.mockResolvedValue(101);
    await checkIPLimit(makeReq("10.0.0.1"));
    await checkIPLimit(makeReq("10.0.0.2"));

    const key1 = mockEval.mock.calls[0]?.[2] as string;
    const key2 = mockEval.mock.calls[1]?.[2] as string;
    expect(key1).not.toBe(key2);
    expect(key1).toContain("10.0.0.1");
    expect(key2).toContain("10.0.0.2");
  });
});

describe("checkPhoneBookingLimit", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockStatus.value = "ready";
  });

  it("returns null when under the daily limit", async () => {
    mockEval.mockResolvedValue(5); // 5 ≤ 10
    const result = await checkPhoneBookingLimit("+233241234567");
    expect(result).toBeNull();
  });

  it("returns 429 when limit exceeded", async () => {
    mockEval.mockResolvedValue(11); // 11 > 10
    const result = await checkPhoneBookingLimit("+233241234567");
    expect(result).not.toBeNull();
    expect(result!.status).toBe(429);
  });

  it("normalises the phone to digits for the Redis key", async () => {
    mockEval.mockResolvedValue(1);
    await checkPhoneBookingLimit("+233 24 123 4567");
    const key = mockEval.mock.calls[0]?.[2] as string;
    // Key should contain only digits, no + or spaces
    expect(key).toMatch(/^rl:phone:\d+$/);
  });

  it("produces the same key for the same E.164 number", async () => {
    mockEval.mockResolvedValue(1);
    await checkPhoneBookingLimit("+233241234567");
    await checkPhoneBookingLimit("+233241234567");
    // Both calls use the same digits, so same key
    const key1 = mockEval.mock.calls[0]?.[2] as string;
    const key2 = mockEval.mock.calls[1]?.[2] as string;
    expect(key1).toBe(key2);
  });

  it("fails open when Redis is unavailable", async () => {
    mockEval.mockRejectedValue(new Error("timeout"));
    const result = await checkPhoneBookingLimit("+233241234567");
    expect(result).toBeNull();
  });
});
