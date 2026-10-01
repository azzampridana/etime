import { z } from "zod";
import { attendanceEvidenceSchema } from "@/schemas/attendance.schema";

export const MAX_PHOTO_INPUT_BYTES = 10 * 1024 * 1024;
export const OVERTIME_LOCATION_MAX_AGE_MS = 5 * 60 * 1000;
export const OVERTIME_LOCATION_MAX_FUTURE_SKEW_MS = 30_000;
export const overtimeLocationSchema = attendanceEvidenceSchema.omit({ description: true }).extend({
  acquiredAt: z.number().int().positive(),
  event: z.enum(["check-in", "check-out"]),
});
export const overtimeEvidenceSchema = attendanceEvidenceSchema.extend({
  description: z.string().trim().min(1, "A description is required.").max(1000),
  locationReceipt: z.string().min(1).max(12000),
});
export const overtimePhotoSchema = z.instanceof(File, { message: "A photo is required." })
  .refine((file) => file.size > 0, "A photo is required.")
  .refine((file) => file.size <= MAX_PHOTO_INPUT_BYTES, "Photo must be 10 MB or smaller.");
export type OvertimeEvidence = z.infer<typeof overtimeEvidenceSchema>;

export function parseOvertimeForm(form: FormData) {
  const entries: Record<string, unknown> = {};
  for (const [key, value] of form.entries()) {
    if (key in entries) throw new z.ZodError([{ code: "custom", path: [key], message: "Duplicate field." }]);
    entries[key] = value;
  }
  const photo = overtimePhotoSchema.parse(entries.photo);
  delete entries.photo;
  for (const field of ["latitude", "longitude", "accuracy"]) {
    if (typeof entries[field] === "string" && entries[field].trim() !== "") entries[field] = Number(entries[field]);
  }
  return { evidence: overtimeEvidenceSchema.parse(entries), photo };
}
