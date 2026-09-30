import "server-only";
import sharp from "sharp";
import { ApplicationError } from "@/lib/errors/application-error";
import { MAX_PHOTO_INPUT_BYTES } from "@/schemas/overtime.schema";
import { watermarkImage, type WatermarkEvidence } from "@/lib/photos/watermark";

export async function processEvidencePhoto(input: Buffer, evidence: WatermarkEvidence): Promise<Buffer> {
  if (!input.length || input.length > MAX_PHOTO_INPUT_BYTES) throw new ApplicationError("PHOTO_SIZE", "A photo of 10 MB or smaller is required.");
  try {
    const options = { limitInputPixels: 40_000_000, failOn: "warning" as const };
    const metadata = await sharp(input, options).metadata();
    if (!["jpeg", "png", "webp"].includes(metadata.format ?? "") || (metadata.pages ?? 1) !== 1) {
      throw new ApplicationError("PHOTO_FORMAT", "Use a single JPEG, PNG, or WebP photo. HEIC and animated images are not supported.");
    }
    const normalized = await sharp(input, options).rotate().resize({ width: 1600, height: 1600, fit: "inside", withoutEnlargement: true }).flatten({ background: "#fff" }).raw().toBuffer({ resolveWithObject: true });
    const { width, height, channels } = normalized.info;
    if (width < 240 || height < 180) throw new ApplicationError("PHOTO_DIMENSIONS", "Photo must be at least 240 pixels wide and 180 pixels high after rotation for readable evidence.");
    const overlay = await watermarkImage(width, height, evidence);
    let output: Buffer = Buffer.alloc(0);
    for (const quality of [82, 74, 66, 58]) {
      output = await sharp(normalized.data, { raw: { width, height, channels } }).composite([{ input: overlay }]).jpeg({ quality, mozjpeg: true }).toBuffer();
      if (output.length <= 1024 * 1024) break;
    }
    if (output.length > 2 * 1024 * 1024) throw new ApplicationError("PHOTO_OUTPUT_SIZE", "Photo cannot be safely reduced below 2 MB. Please take another photo.");
    return output;
  } catch (error) {
    if (error instanceof ApplicationError) throw error;
    throw new ApplicationError("INVALID_PHOTO", "Photo could not be processed. Use an undamaged JPEG, PNG, or WebP image.");
  }
}
