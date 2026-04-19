/**
 * GET /api/v1/restaurants/[slug]/qr
 *
 * Returns a PNG QR code encoding the walk-in join URL for this restaurant.
 * Used by admin staff to display/print at the venue entrance.
 * Requires restaurant staff or owner auth.
 */

import { NextRequest, NextResponse } from "next/server";
import QRCode from "qrcode";
import { db } from "@/lib/db";
import { notFound, forbidden, serverError, requireAuth, isAuthResult } from "@/lib/utils/api";

async function assertAccess(clerkId: string, restaurantId: string) {
  const user = await db.user.findUnique({
    where: { clerkId },
    include: { staffRoles: { where: { restaurantId } } },
  });
  if (!user) return false;
  return user.role === "ADMIN" || user.staffRoles.length > 0;
}

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  const authResult = await requireAuth();
  if (!isAuthResult(authResult)) return authResult.response;

  const { slug } = await params;

  try {
    const restaurant = await db.restaurant.findUnique({
      where: { slug, isActive: true, deletedAt: null },
      select: { id: true, name: true },
    });

    if (!restaurant) return notFound("Restaurant");

    const hasAccess = await assertAccess(authResult.userId, restaurant.id);
    if (!hasAccess) return forbidden();

    const baseUrl =
      process.env["NEXT_PUBLIC_APP_URL"] ?? "https://tablegh.com";
    const walkinUrl = `${baseUrl}/walkin/${slug}`;

    const qrBuffer = await QRCode.toBuffer(walkinUrl, {
      type: "png",
      width: 400,
      margin: 2,
      color: { dark: "#1A1A1A", light: "#FFFFFF" },
      errorCorrectionLevel: "M",
    });

    return new NextResponse(qrBuffer, {
      headers: {
        "Content-Type": "image/png",
        "Cache-Control": "public, max-age=86400",
        "Content-Disposition": `inline; filename="tablegh-walkin-${slug}.png"`,
      },
    });
  } catch (err) {
    console.error("QR generation error:", err);
    return serverError();
  }
}
