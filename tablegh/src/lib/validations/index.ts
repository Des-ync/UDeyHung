import { z } from "zod";
import {
  CuisineTag,
  VenueCategory,
  Neighborhood,
  PriceLevel,
  OccasionType,
  ReservationStatus,
} from "@prisma/client";
import { normalizeGhPhone } from "@/lib/utils/phone";

// ─────────────────────────────────────────────────────────────────────────────
// Shared primitives
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Validates + normalizes a Ghanaian phone number to E.164.
 */
export const ghPhoneSchema = z
  .string()
  .transform((val, ctx) => {
    const result = normalizeGhPhone(val);
    if (!result.success) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: result.error,
      });
      return z.NEVER;
    }
    return result.e164;
  })
  .pipe(z.string().regex(/^\+233[2-9]\d{8}$/, "Invalid Ghanaian phone number"));

export const pesewasSchema = z
  .number()
  .int("Amount must be a whole number of pesewas")
  .nonnegative("Amount cannot be negative");

export const partySizeSchema = z
  .number()
  .int()
  .min(1, "Party size must be at least 1")
  .max(20, "Party size cannot exceed 20");

// Date as ISO string (YYYY-MM-DD) — validated and returned as Date
export const dateSchema = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "Date must be in YYYY-MM-DD format")
  .transform((s) => new Date(s + "T00:00:00Z"));

// Time slot as minutes since midnight (0–1439)
export const timeSlotSchema = z
  .number()
  .int()
  .min(0)
  .max(1439)
  .refine((n) => n % 30 === 0, "Time slot must be on 30-minute increment");

// Pagination
export const paginationSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(50).default(20),
});

// ─────────────────────────────────────────────────────────────────────────────
// Auth
// ─────────────────────────────────────────────────────────────────────────────

export const signUpSchema = z.object({
  phone: ghPhoneSchema,
  name: z.string().min(2, "Name must be at least 2 characters").max(100),
  email: z.string().email().optional(),
  consentGiven: z
    .boolean()
    .refine((v) => v === true, "You must agree to the privacy policy"),
});

export const verifyOtpSchema = z.object({
  phone: ghPhoneSchema,
  code: z.string().length(6, "OTP must be 6 digits").regex(/^\d+$/),
});

// ─────────────────────────────────────────────────────────────────────────────
// Restaurant Search
// ─────────────────────────────────────────────────────────────────────────────

export const restaurantSearchSchema = z
  .object({
    q: z.string().max(100).optional(),
    cuisine: z.array(z.nativeEnum(CuisineTag)).optional(),
    neighborhood: z.array(z.nativeEnum(Neighborhood)).optional(),
    priceLevel: z.array(z.nativeEnum(PriceLevel)).optional(),
    venueCategory: z.array(z.nativeEnum(VenueCategory)).optional(),
    minRating: z.coerce.number().min(1).max(5).optional(),
    openNow: z
      .string()
      .optional()
      .transform((v) => v === "true"),
    features: z.array(z.string()).optional(),
    // For distance sort
    lat: z.coerce.number().min(-90).max(90).optional(),
    lng: z.coerce.number().min(-180).max(180).optional(),
    sortBy: z
      .enum(["relevance", "rating", "distance", "price_asc", "price_desc"])
      .default("relevance"),
  })
  .merge(paginationSchema);

export type RestaurantSearchParams = z.infer<typeof restaurantSearchSchema>;

// ─────────────────────────────────────────────────────────────────────────────
// Reservations
// ─────────────────────────────────────────────────────────────────────────────

export const createReservationSchema = z.object({
  restaurantId: z.string().cuid(),
  partySize: partySizeSchema,
  date: dateSchema,
  timeSlot: timeSlotSchema,
  guestName: z.string().min(2).max(100),
  guestPhone: ghPhoneSchema,
  occasion: z.nativeEnum(OccasionType).optional(),
  specialReqs: z
    .string()
    .max(280, "Special requests cannot exceed 280 characters")
    .optional(),
});

export type CreateReservationInput = z.infer<typeof createReservationSchema>;

export const modifyReservationSchema = z
  .object({
    partySize: partySizeSchema.optional(),
    date: dateSchema.optional(),
    timeSlot: timeSlotSchema.optional(),
    occasion: z.nativeEnum(OccasionType).optional(),
    specialReqs: z.string().max(280).optional(),
  })
  .refine(
    (data) => Object.values(data).some((v) => v !== undefined),
    "At least one field must be provided"
  );

export const cancelReservationSchema = z.object({
  reason: z.string().max(280).optional(),
});

export const listReservationsSchema = z
  .object({
    status: z.nativeEnum(ReservationStatus).optional(),
    restaurantId: z.string().cuid().optional(),
    fromDate: dateSchema.optional(),
    toDate: dateSchema.optional(),
  })
  .merge(paginationSchema);

// ─────────────────────────────────────────────────────────────────────────────
// Waitlist
// ─────────────────────────────────────────────────────────────────────────────

export const joinWaitlistSchema = z.object({
  restaurantId: z.string().cuid(),
  partySize: partySizeSchema,
  date: dateSchema,
  desiredTime: timeSlotSchema,
});

// ─────────────────────────────────────────────────────────────────────────────
// Walk-in Queue
// ─────────────────────────────────────────────────────────────────────────────

export const joinWalkInSchema = z.object({
  restaurantId: z.string().cuid(),
  guestName: z.string().min(2).max(100),
  guestPhone: ghPhoneSchema,
  partySize: partySizeSchema,
});

// ─────────────────────────────────────────────────────────────────────────────
// Reviews
// ─────────────────────────────────────────────────────────────────────────────

export const createReviewSchema = z.object({
  reservationId: z.string().cuid(),
  rating: z.number().int().min(1).max(5),
  body: z.string().max(1000).optional(),
  // photoUrls uploaded separately via presigned URL endpoint
  photoUrls: z.array(z.string().url()).max(5).optional(),
});

export const respondToReviewSchema = z.object({
  body: z.string().min(10).max(500),
});

// ─────────────────────────────────────────────────────────────────────────────
// Admin: Menu
// ─────────────────────────────────────────────────────────────────────────────

export const createMenuItemSchema = z.object({
  categoryId: z.string().cuid(),
  name: z.string().min(2).max(100),
  description: z.string().max(300).optional(),
  pricePesewas: pesewasSchema.min(100, "Price must be at least ₵1.00"),
  dietaryTags: z.array(z.string()).optional(),
  dishSpecialties: z.array(z.string()).optional(),
  isSignatureDish: z.boolean().optional(),
  sortOrder: z.number().int().min(0).optional(),
});

export const updateMenuItemSchema = createMenuItemSchema.partial().extend({
  isAvailable: z.boolean().optional(),
});

// ─────────────────────────────────────────────────────────────────────────────
// Admin: Restaurant settings
// ─────────────────────────────────────────────────────────────────────────────

export const updateRestaurantSettingsSchema = z.object({
  description: z.string().max(1000).optional(),
  phone: ghPhoneSchema.optional(),
  email: z.string().email().optional(),
  defaultTurnTime: z.number().int().min(30).max(300).optional(),
  depositEnabled: z.boolean().optional(),
  depositAmountPesewas: pesewasSchema.optional(),
  depositRequiredDays: z.array(z.string()).optional(),
  depositRefundHours: z.number().int().min(1).max(48).optional(),
  features: z.array(z.string()).optional(),
});

// ─────────────────────────────────────────────────────────────────────────────
// Payments
// ─────────────────────────────────────────────────────────────────────────────

export const initiateDepositSchema = z.object({
  reservationId: z.string().cuid(),
  // "card" | "momo"
  paymentMethod: z.enum(["card", "momo"]),
  // Required for MoMo
  momoPhone: ghPhoneSchema.optional(),
}).refine(
  (data) => data.paymentMethod !== "momo" || !!data.momoPhone,
  { message: "MoMo phone is required for mobile money payments", path: ["momoPhone"] }
);
