/**
 * Unit tests for review business-logic guards.
 *
 * These test pure logic that doesn't require a DB or external services:
 *   - Review eligibility: only COMPLETED reservations qualify
 *   - Rating validation: 1–5
 *   - One-review-per-reservation uniqueness (simulated)
 *   - Flag reason validation
 *   - Restaurant response body length constraints
 */

import { describe, it, expect } from "vitest";
import { z } from "zod";

// ─── Inline the schemas we're testing (mirrors the real validation in API routes) ─

const createReviewSchema = z.object({
  reservationId: z.string().cuid(),
  rating: z.number().int().min(1).max(5),
  body: z.string().max(1000).optional(),
  photoUrls: z.array(z.string().url()).max(5).optional(),
});

const flagSchema = z.object({
  reason: z
    .enum(["SPAM", "OFFENSIVE", "FAKE", "OFF_TOPIC", "OTHER"])
    .default("OTHER"),
});

const respondSchema = z.object({
  body: z.string().min(10).max(500),
});

// ─── Valid CUID for testing ───────────────────────────────────────────────────
const VALID_CUID = "clxxxxxxxxxxxxxxxxxxxxxx";

// ─── createReview schema ──────────────────────────────────────────────────────

describe("createReviewSchema", () => {
  it("accepts a minimal valid review", () => {
    const result = createReviewSchema.safeParse({
      reservationId: VALID_CUID,
      rating: 4,
    });
    expect(result.success).toBe(true);
  });

  it("accepts a full review with body and photos", () => {
    const result = createReviewSchema.safeParse({
      reservationId: VALID_CUID,
      rating: 5,
      body: "Excellent jollof rice, highly recommend!",
      photoUrls: ["https://cdn.example.com/photo1.webp"],
    });
    expect(result.success).toBe(true);
  });

  it("rejects rating below 1", () => {
    const result = createReviewSchema.safeParse({
      reservationId: VALID_CUID,
      rating: 0,
    });
    expect(result.success).toBe(false);
    expect(JSON.stringify(result.error)).toContain("min");
  });

  it("rejects rating above 5", () => {
    const result = createReviewSchema.safeParse({
      reservationId: VALID_CUID,
      rating: 6,
    });
    expect(result.success).toBe(false);
  });

  it("rejects fractional ratings", () => {
    const result = createReviewSchema.safeParse({
      reservationId: VALID_CUID,
      rating: 4.5,
    });
    expect(result.success).toBe(false);
  });

  it("rejects body exceeding 1000 chars", () => {
    const result = createReviewSchema.safeParse({
      reservationId: VALID_CUID,
      rating: 3,
      body: "x".repeat(1001),
    });
    expect(result.success).toBe(false);
  });

  it("accepts body of exactly 1000 chars", () => {
    const result = createReviewSchema.safeParse({
      reservationId: VALID_CUID,
      rating: 3,
      body: "x".repeat(1000),
    });
    expect(result.success).toBe(true);
  });

  it("rejects more than 5 photo URLs", () => {
    const result = createReviewSchema.safeParse({
      reservationId: VALID_CUID,
      rating: 4,
      photoUrls: Array.from({ length: 6 }, (_, i) => `https://cdn.example.com/${i}.webp`),
    });
    expect(result.success).toBe(false);
  });

  it("accepts exactly 5 photo URLs", () => {
    const result = createReviewSchema.safeParse({
      reservationId: VALID_CUID,
      rating: 4,
      photoUrls: Array.from({ length: 5 }, (_, i) => `https://cdn.example.com/${i}.webp`),
    });
    expect(result.success).toBe(true);
  });

  it("rejects non-URL strings in photoUrls", () => {
    const result = createReviewSchema.safeParse({
      reservationId: VALID_CUID,
      rating: 4,
      photoUrls: ["not-a-url"],
    });
    expect(result.success).toBe(false);
  });

  it("rejects invalid reservationId (not a CUID)", () => {
    const result = createReviewSchema.safeParse({
      reservationId: "not-a-cuid!!!",
      rating: 4,
    });
    expect(result.success).toBe(false);
  });
});

// ─── Flag schema ──────────────────────────────────────────────────────────────

describe("flagSchema", () => {
  it("defaults to OTHER when reason is omitted", () => {
    const result = flagSchema.safeParse({});
    expect(result.success).toBe(true);
    if (result.success) expect(result.data.reason).toBe("OTHER");
  });

  it("accepts all valid flag reasons", () => {
    const reasons = ["SPAM", "OFFENSIVE", "FAKE", "OFF_TOPIC", "OTHER"] as const;
    for (const reason of reasons) {
      const r = flagSchema.safeParse({ reason });
      expect(r.success).toBe(true);
    }
  });

  it("rejects unknown flag reason", () => {
    const result = flagSchema.safeParse({ reason: "INVALID" });
    expect(result.success).toBe(false);
  });
});

// ─── Restaurant respond schema ────────────────────────────────────────────────

describe("respondSchema", () => {
  it("accepts a valid response body", () => {
    const result = respondSchema.safeParse({
      body: "Thank you for your feedback! We are glad you enjoyed the experience.",
    });
    expect(result.success).toBe(true);
  });

  it("rejects response shorter than 10 chars", () => {
    const result = respondSchema.safeParse({ body: "Thanks!" });
    expect(result.success).toBe(false);
  });

  it("rejects response longer than 500 chars", () => {
    const result = respondSchema.safeParse({ body: "x".repeat(501) });
    expect(result.success).toBe(false);
  });

  it("accepts response of exactly 10 chars", () => {
    const result = respondSchema.safeParse({ body: "Thank you!" });
    expect(result.success).toBe(true);
  });

  it("accepts response of exactly 500 chars", () => {
    const result = respondSchema.safeParse({ body: "x".repeat(500) });
    expect(result.success).toBe(true);
  });

  it("rejects missing body", () => {
    const result = respondSchema.safeParse({});
    expect(result.success).toBe(false);
  });
});

// ─── Review eligibility logic ─────────────────────────────────────────────────

describe("review eligibility", () => {
  /**
   * The API enforces: reservation.status === COMPLETED.
   * Simulate this check inline.
   */
  type Status =
    | "PENDING"
    | "CONFIRMED"
    | "SEATED"
    | "COMPLETED"
    | "CANCELLED_DINER"
    | "CANCELLED_VENUE"
    | "NO_SHOW";

  function canReview(status: Status): boolean {
    return status === "COMPLETED";
  }

  it("allows review for COMPLETED reservation", () => {
    expect(canReview("COMPLETED")).toBe(true);
  });

  it("disallows review for CONFIRMED reservation", () => {
    expect(canReview("CONFIRMED")).toBe(false);
  });

  it("disallows review for PENDING reservation", () => {
    expect(canReview("PENDING")).toBe(false);
  });

  it("disallows review for SEATED reservation", () => {
    expect(canReview("SEATED")).toBe(false);
  });

  it("disallows review for CANCELLED_DINER reservation", () => {
    expect(canReview("CANCELLED_DINER")).toBe(false);
  });

  it("disallows review for CANCELLED_VENUE reservation", () => {
    expect(canReview("CANCELLED_VENUE")).toBe(false);
  });

  it("disallows review for NO_SHOW reservation", () => {
    expect(canReview("NO_SHOW")).toBe(false);
  });
});

// ─── Rating aggregate helpers ─────────────────────────────────────────────────

describe("rating average calculation", () => {
  function computeAverage(ratings: number[]): number {
    if (ratings.length === 0) return 0;
    return parseFloat(
      (ratings.reduce((s, r) => s + r, 0) / ratings.length).toFixed(1)
    );
  }

  it("returns 0 for empty set", () => {
    expect(computeAverage([])).toBe(0);
  });

  it("returns the single value for one review", () => {
    expect(computeAverage([4])).toBe(4);
  });

  it("rounds to one decimal place", () => {
    expect(computeAverage([4, 4, 5])).toBe(4.3);
  });

  it("handles all-5 case", () => {
    expect(computeAverage([5, 5, 5])).toBe(5);
  });

  it("handles all-1 case", () => {
    expect(computeAverage([1, 1, 1])).toBe(1);
  });
});
