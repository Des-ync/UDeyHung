import { NextRequest, NextResponse } from "next/server";
import { ZodError, ZodSchema } from "zod";
import { auth } from "@clerk/nextjs/server";

// ─────────────────────────────────────────────────────────────────────────────
// Standard response shapes
// ─────────────────────────────────────────────────────────────────────────────

export function ok<T>(data: T, status = 200) {
  return NextResponse.json({ success: true, data }, { status });
}

export function created<T>(data: T) {
  return ok(data, 201);
}

export function noContent() {
  return new NextResponse(null, { status: 204 });
}

export function badRequest(message: string, details?: unknown) {
  return NextResponse.json(
    { success: false, error: { code: "BAD_REQUEST", message, details } },
    { status: 400 }
  );
}

export function unauthorized(message = "Authentication required") {
  return NextResponse.json(
    { success: false, error: { code: "UNAUTHORIZED", message } },
    { status: 401 }
  );
}

export function forbidden(message = "Insufficient permissions") {
  return NextResponse.json(
    { success: false, error: { code: "FORBIDDEN", message } },
    { status: 403 }
  );
}

export function notFound(resource = "Resource") {
  return NextResponse.json(
    { success: false, error: { code: "NOT_FOUND", message: `${resource} not found` } },
    { status: 404 }
  );
}

export function conflict(message: string) {
  return NextResponse.json(
    { success: false, error: { code: "CONFLICT", message } },
    { status: 409 }
  );
}

export function tooManyRequests(message = "Too many requests") {
  return NextResponse.json(
    { success: false, error: { code: "RATE_LIMITED", message } },
    { status: 429 }
  );
}

export function serverError(message = "Internal server error") {
  return NextResponse.json(
    { success: false, error: { code: "INTERNAL_ERROR", message } },
    { status: 500 }
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Validation helpers
// ─────────────────────────────────────────────────────────────────────────────

export function parseBody<T>(
  schema: ZodSchema<T>,
  data: unknown
): { success: true; data: T } | { success: false; response: NextResponse } {
  const result = schema.safeParse(data);
  if (!result.success) {
    return {
      success: false,
      response: badRequest("Validation failed", formatZodErrors(result.error)),
    };
  }
  return { success: true, data: result.data };
}

export function parseQuery<T>(
  schema: ZodSchema<T>,
  req: NextRequest
): { success: true; data: T } | { success: false; response: NextResponse } {
  // Object.fromEntries drops duplicate keys — build a proper object
  // where keys appearing multiple times become arrays.
  const raw: Record<string, string | string[]> = {};
  for (const [key, value] of req.nextUrl.searchParams.entries()) {
    const existing = raw[key];
    if (existing === undefined) {
      raw[key] = value;
    } else if (Array.isArray(existing)) {
      existing.push(value);
    } else {
      raw[key] = [existing, value];
    }
  }
  return parseBody(schema, raw);
}

function formatZodErrors(error: ZodError) {
  return error.errors.map((e) => ({
    path: e.path.join("."),
    message: e.message,
  }));
}

// ─────────────────────────────────────────────────────────────────────────────
// Auth helpers
// ─────────────────────────────────────────────────────────────────────────────

export async function requireAuth(): Promise<
  { userId: string } | { response: NextResponse }
> {
  const { userId } = await auth();
  if (!userId) return { response: unauthorized() };
  return { userId };
}

export function isAuthResult(
  result: { userId: string } | { response: NextResponse }
): result is { userId: string } {
  return "userId" in result;
}

// ─────────────────────────────────────────────────────────────────────────────
// Pagination
// ─────────────────────────────────────────────────────────────────────────────

export interface PaginatedResponse<T> {
  items: T[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
    hasNext: boolean;
    hasPrev: boolean;
  };
}

export function paginate<T>(
  items: T[],
  total: number,
  page: number,
  limit: number
): PaginatedResponse<T> {
  const totalPages = Math.ceil(total / limit);
  return {
    items,
    pagination: {
      page,
      limit,
      total,
      totalPages,
      hasNext: page < totalPages,
      hasPrev: page > 1,
    },
  };
}
