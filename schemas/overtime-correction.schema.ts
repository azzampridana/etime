import { z } from "zod";

export const submitOvertimeCorrectionSchema = z.strictObject({
  overtimeId: z.uuid(),
  checkOutLocal: z.string().regex(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/, "Enter a Checkout date and time in WIB."),
  reason: z.string().trim().min(1, "Explain why Checkout was missed.").max(2000),
});
export const overtimeCorrectionHistorySchema = z.object({
  page: z.coerce.number().int().min(1).max(100000).catch(1),
});
export const adminOvertimeCorrectionQuerySchema = z.object({
  status: z.enum(["PENDING", "APPROVED", "REJECTED"]).default("PENDING"),
  page: z.coerce.number().int().min(1).max(100000).default(1),
});
const decisionBase = { requestId: z.uuid(), expectedVersion: z.iso.datetime({ precision: 3 }) };
export const decideOvertimeCorrectionSchema = z.discriminatedUnion("decision", [
  z.strictObject({ ...decisionBase, decision: z.literal("APPROVED"), reviewNote: z.string().trim().max(2000).optional() }),
  z.strictObject({ ...decisionBase, decision: z.literal("REJECTED"), reviewNote: z.string().trim().min(1, "A rejection reason is required.").max(2000) }),
]);
