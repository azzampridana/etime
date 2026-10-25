import { z } from "zod";
import { isValidTimeZone } from "@/lib/date-time/event-time";
import { dailyReportSchema } from "@/schemas/daily-report.schema";

const localTime = z.string().regex(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/, "Enter a local date and time.");
const zone = z.string().trim().min(1).max(100).refine(isValidTimeZone, "Enter a valid IANA timezone.");
const common = {
  workDate: z.iso.date(), checkOutLocal: localTime, checkOutTimezone: zone,
  reason: z.string().trim().min(1, "Explain why a correction is needed.").max(2000),
};
export const submitAttendanceCorrectionSchema = z.discriminatedUnion("type", [
  z.strictObject({ ...common, type: z.literal("MISSING_CHECKOUT"), attendanceId: z.uuid(),
    proposedDailyReportContent: dailyReportSchema.shape.content.optional() }),
  z.strictObject({ ...common, type: z.literal("MISSING_BOTH"), checkInLocal: localTime, checkInTimezone: zone,
    proposedDailyReportContent: dailyReportSchema.shape.content }),
]);
export const correctionHistorySchema = z.object({ page: z.coerce.number().int().min(1).max(100000).catch(1) });
export type SubmitAttendanceCorrectionInput = z.input<typeof submitAttendanceCorrectionSchema>;

const decisionBase = { requestId: z.uuid(), expectedVersion: z.iso.datetime({ precision: 3 }) };
export const approveAttendanceCorrectionSchema = z.strictObject({ ...decisionBase,
  decision: z.literal("APPROVED"), reviewNote: z.string().trim().max(2000).optional() });
export const rejectAttendanceCorrectionSchema = z.strictObject({ ...decisionBase,
  decision: z.literal("REJECTED"), reviewNote: z.string().trim().min(1, "A rejection reason is required.").max(2000) });
export const decideAttendanceCorrectionSchema = z.discriminatedUnion("decision", [approveAttendanceCorrectionSchema, rejectAttendanceCorrectionSchema]);

export const adminCorrectionQuerySchema = z.object({
  status: z.enum(["ALL", "PENDING", "APPROVED", "REJECTED"]).default("PENDING"),
  page: z.coerce.number().int().min(1).max(100000).default(1),
});
