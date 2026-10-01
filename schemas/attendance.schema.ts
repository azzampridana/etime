import { z } from "zod";
import { isValidTimeZone } from "@/lib/date-time/event-time";

export const attendanceEvidenceSchema = z.strictObject({
  latitude: z.number().min(-90).max(90),
  longitude: z.number().min(-180).max(180),
  // Technical sanity bound, not a location eligibility/precision requirement.
  accuracy: z.number().min(0).max(40_000_000),
  timezone: z.string().max(100).refine(isValidTimeZone, "A valid IANA timezone is required."),
  description: z.string().trim().max(1000).optional().transform((value) => value || null),
});

export const ATTENDANCE_LOCATION_MAX_AGE_MS = 300_000;
export const ATTENDANCE_LOCATION_MAX_FUTURE_SKEW_MS = 30_000;
const acquisitionSchema = attendanceEvidenceSchema.omit({ description: true }).extend({ acquiredAt: z.number().int().positive() });
export const attendanceLocationSchema = z.discriminatedUnion("event", [
  acquisitionSchema.extend({ event: z.literal("CHECK_IN") }),
  acquisitionSchema.extend({ event: z.literal("CHECK_OUT"), attendanceId: z.uuid() }),
]);
export const checkInSchema = attendanceEvidenceSchema.extend({ locationReceipt: z.string().min(1).max(12000) });
export const checkOutSchema = checkInSchema.extend({ attendanceId: z.uuid() });

export const attendanceHistorySchema = z.object({ page: z.coerce.number().int().min(1).max(100000).catch(1) });

export type CheckInInput = z.input<typeof checkInSchema>;
