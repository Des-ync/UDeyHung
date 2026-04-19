/**
 * Cloudflare R2 storage client.
 * R2 is S3-compatible — uses AWS SDK v3 S3 client pointed at R2 endpoint.
 *
 * Image pipeline:
 * 1. Client requests a presigned upload URL from /api/v1/admin/upload
 * 2. Client uploads directly to R2 (no server memory usage)
 * 3. After upload, server uses Sharp to verify + compress to WebP (via separate endpoint)
 *
 * Alternative for MVP: server-side upload with Sharp compression inline.
 * We implement the server-side path for simplicity.
 */

import { S3Client, PutObjectCommand, DeleteObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import sharp from "sharp";

const R2_ACCOUNT_ID = process.env["R2_ACCOUNT_ID"];
const R2_ACCESS_KEY_ID = process.env["R2_ACCESS_KEY_ID"];
const R2_SECRET_ACCESS_KEY = process.env["R2_SECRET_ACCESS_KEY"];
const R2_BUCKET_NAME = process.env["R2_BUCKET_NAME"] ?? "tablegh-media";
const R2_PUBLIC_URL = process.env["R2_PUBLIC_URL"] ?? "";

function getR2Client(): S3Client {
  if (!R2_ACCOUNT_ID || !R2_ACCESS_KEY_ID || !R2_SECRET_ACCESS_KEY) {
    throw new Error("R2 credentials not configured");
  }
  return new S3Client({
    region: "auto",
    endpoint: `https://${R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
    credentials: {
      accessKeyId: R2_ACCESS_KEY_ID,
      secretAccessKey: R2_SECRET_ACCESS_KEY,
    },
  });
}

export type ImageVariant = "original" | "thumbnail" | "menu";

const VARIANTS: Record<ImageVariant, { width: number; height: number; quality: number }> = {
  original:  { width: 1920, height: 1280, quality: 85 },
  thumbnail: { width: 400,  height: 300,  quality: 80 },
  menu:      { width: 800,  height: 600,  quality: 82 },
};

/**
 * Process an image buffer with Sharp:
 * - Resize to max dimensions (fit: cover)
 * - Convert to WebP
 * - Max file size ~1MB enforced by quality reduction
 */
export async function processImage(
  buffer: Buffer,
  variant: ImageVariant = "original"
): Promise<Buffer> {
  const config = VARIANTS[variant];

  let pipeline = sharp(buffer)
    .resize(config.width, config.height, {
      fit: "cover",
      withoutEnlargement: true,
    })
    .webp({ quality: config.quality });

  const result = await pipeline.toBuffer();

  // Enforce 1MB max by reducing quality iteratively
  if (result.length > 1_000_000 && variant === "original") {
    let quality = config.quality - 10;
    let output = result;
    while (output.length > 1_000_000 && quality >= 50) {
      output = await sharp(buffer)
        .resize(config.width, config.height, { fit: "cover", withoutEnlargement: true })
        .webp({ quality })
        .toBuffer();
      quality -= 10;
    }
    return output;
  }

  return result;
}

export interface UploadResult {
  key: string;
  url: string;
  thumbnailKey?: string;
  thumbnailUrl?: string;
  sizeBytes: number;
}

/**
 * Upload a processed image to R2 and return the public URL.
 * Also creates a thumbnail variant.
 */
export async function uploadImage(
  buffer: Buffer,
  key: string, // e.g., "restaurants/abc123/photo-uuid.webp"
  contentType = "image/webp"
): Promise<UploadResult> {
  const client = getR2Client();

  // Process original
  const processedBuffer = await processImage(buffer, "original");

  await client.send(
    new PutObjectCommand({
      Bucket: R2_BUCKET_NAME,
      Key: key,
      Body: processedBuffer,
      ContentType: contentType,
      CacheControl: "public, max-age=31536000, immutable",
    })
  );

  // Process + upload thumbnail
  const thumbKey = key.replace(/\.webp$/, "_thumb.webp");
  const thumbBuffer = await processImage(buffer, "thumbnail");

  await client.send(
    new PutObjectCommand({
      Bucket: R2_BUCKET_NAME,
      Key: thumbKey,
      Body: thumbBuffer,
      ContentType: "image/webp",
      CacheControl: "public, max-age=31536000, immutable",
    })
  );

  return {
    key,
    url: `${R2_PUBLIC_URL}/${key}`,
    thumbnailKey: thumbKey,
    thumbnailUrl: `${R2_PUBLIC_URL}/${thumbKey}`,
    sizeBytes: processedBuffer.length,
  };
}

/**
 * Upload a menu item photo (smaller dimensions).
 */
export async function uploadMenuItemPhoto(
  buffer: Buffer,
  key: string
): Promise<UploadResult> {
  const client = getR2Client();

  const processedBuffer = await processImage(buffer, "menu");

  await client.send(
    new PutObjectCommand({
      Bucket: R2_BUCKET_NAME,
      Key: key,
      Body: processedBuffer,
      ContentType: "image/webp",
      CacheControl: "public, max-age=31536000, immutable",
    })
  );

  return {
    key,
    url: `${R2_PUBLIC_URL}/${key}`,
    sizeBytes: processedBuffer.length,
  };
}

/**
 * Delete an object from R2.
 */
export async function deleteFromR2(key: string): Promise<void> {
  const client = getR2Client();
  await client.send(
    new DeleteObjectCommand({ Bucket: R2_BUCKET_NAME, Key: key })
  );
}

/**
 * Generate a presigned upload URL for direct client-side upload (v2 feature).
 * Returned to the client, which uploads directly without going through the server.
 */
export async function presignedUploadUrl(
  key: string,
  contentType: string,
  expiresIn = 300 // 5 minutes
): Promise<string> {
  const client = getR2Client();
  return getSignedUrl(
    client,
    new PutObjectCommand({
      Bucket: R2_BUCKET_NAME,
      Key: key,
      ContentType: contentType,
    }),
    { expiresIn }
  );
}

/**
 * Validate uploaded file before processing.
 */
export function validateImageFile(
  buffer: Buffer,
  originalName: string
): { valid: true } | { valid: false; error: string } {
  // Max 10MB raw upload (will be compressed)
  if (buffer.length > 10 * 1024 * 1024) {
    return { valid: false, error: "File too large (max 10MB)" };
  }

  // Check magic bytes for JPEG / PNG / WebP / GIF
  const magic = buffer.slice(0, 4);
  const isJpeg = magic[0] === 0xff && magic[1] === 0xd8;
  const isPng = magic[0] === 0x89 && magic[1] === 0x50;
  const isWebP =
    magic[0] === 0x52 && magic[1] === 0x49 && magic[2] === 0x46 && magic[3] === 0x46;

  if (!isJpeg && !isPng && !isWebP) {
    return { valid: false, error: "Only JPEG, PNG, and WebP images are allowed" };
  }

  return { valid: true };
}
