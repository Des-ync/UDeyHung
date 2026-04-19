/**
 * POST /api/v1/admin/upload
 *
 * Accepts multipart/form-data with fields:
 *   - file:         the image binary
 *   - restaurantId: cuid
 *   - context:      "EXTERIOR" | "INTERIOR" | "DISH" | "MENU" | "AMBIANCE"
 *   - itemId?:      menu item id (when context = MENU)
 *
 * Processing pipeline:
 * 1. Parse + validate multipart body
 * 2. Check magic bytes (JPEG/PNG/WebP only)
 * 3. Process with Sharp → WebP (max ~1MB)
 * 4. Upload original + thumbnail to R2
 * 5. Create Photo record in DB
 *
 * Returns: { url, thumbnailUrl, photoId }
 */

import { NextRequest } from "next/server";
import { v4 as uuidv4 } from "uuid";
import { db } from "@/lib/db";
import {
  ok,
  badRequest,
  forbidden,
  unauthorized,
  serverError,
  requireAuth,
  isAuthResult,
} from "@/lib/utils/api";
import {
  uploadImage,
  uploadMenuItemPhoto,
  validateImageFile,
} from "@/lib/storage/r2";
import { PhotoContext } from "@prisma/client";

const ALLOWED_CONTEXTS = new Set<string>(Object.values(PhotoContext));

export async function POST(req: NextRequest) {
  const authResult = await requireAuth();
  if (!isAuthResult(authResult)) return authResult.response;
  const { userId: clerkId } = authResult;

  try {
    // Parse multipart form
    const formData = await req.formData();
    const file = formData.get("file");
    const restaurantId = formData.get("restaurantId");
    const context = formData.get("context");
    const itemId = formData.get("itemId") as string | null;

    if (!(file instanceof File)) return badRequest("No file provided");
    if (typeof restaurantId !== "string") return badRequest("restaurantId required");
    if (typeof context !== "string" || !ALLOWED_CONTEXTS.has(context)) {
      return badRequest(`Invalid context. Must be one of: ${[...ALLOWED_CONTEXTS].join(", ")}`);
    }

    // Auth check
    const user = await db.user.findUnique({
      where: { clerkId },
      include: { staffRoles: { where: { restaurantId } } },
    });
    if (!user) return unauthorized();
    if (user.role !== "ADMIN" && user.staffRoles.length === 0) return forbidden();

    // Validate file
    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    const validation = validateImageFile(buffer, file.name);
    if (!validation.valid) return badRequest(validation.error);

    // Build R2 key: restaurants/{id}/{context}/{uuid}.webp
    const photoId = uuidv4();
    const key = `restaurants/${restaurantId}/${context.toLowerCase()}/${photoId}.webp`;

    // Upload (will also create thumbnail)
    const isMenuContext = context === "MENU" || context === "DISH";
    const uploadResult = isMenuContext
      ? await uploadMenuItemPhoto(buffer, key)
      : await uploadImage(buffer, key);

    // Count existing photos for sort order
    const existingCount = await db.photo.count({ where: { restaurantId } });

    // Create Photo record
    const photo = await db.photo.create({
      data: {
        id: photoId,
        restaurantId,
        url: uploadResult.url,
        thumbnailUrl: uploadResult.thumbnailUrl ?? null,
        context: context as PhotoContext,
        sortOrder: existingCount,
      },
    });

    // If this is a menu item photo, update the item
    if (itemId && (context === "MENU" || context === "DISH")) {
      await db.menuItem.update({
        where: { id: itemId, restaurantId },
        data: { photoUrl: uploadResult.url },
      }).catch(() => {/* item might not exist — non-fatal */});
    }

    return ok({
      photoId: photo.id,
      url: photo.url,
      thumbnailUrl: photo.thumbnailUrl,
      sizeBytes: uploadResult.sizeBytes,
    });
  } catch (err) {
    console.error("Upload error:", err);
    return serverError(
      err instanceof Error ? err.message : "Upload failed"
    );
  }
}

// Required for Next.js App Router to parse FormData correctly
export const dynamic = "force-dynamic";
