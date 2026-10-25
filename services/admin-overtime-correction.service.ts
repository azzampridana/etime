import "server-only";
import { z } from "zod";
import { requireAdmin } from "@/lib/authorization/require-user";
import { listAdminOvertimeCorrections, findAdminOvertimeCorrection } from "@/repositories/overtime-correction.repository";
import { adminOvertimeCorrectionQuerySchema } from "@/schemas/overtime-correction.schema";

const snapshotDisplay = z.object({ version: z.literal(1), checkInAt: z.iso.datetime(), deadlineAt: z.iso.datetime(),
  checkOutAt: z.iso.datetime().nullable(), maxOpenMinutes: z.number().int(), workDate: z.iso.date(),
  checkInTimezone: z.string(), checkInLatitude: z.number(), checkInLongitude: z.number(), checkInAccuracy: z.number(),
  checkInAddress: z.string().nullable(), checkInDescription: z.string(),
  authorizationRevokedAt: z.iso.datetime().nullable(),
});
export async function getAdminOvertimeCorrectionList(raw: unknown) {
  await requireAdmin();
  const input = adminOvertimeCorrectionQuerySchema.parse(raw);
  const pageSize = 15;
  const result = await listAdminOvertimeCorrections(input.status, input.page, pageSize);
  return { ...input, pageSize, total: result.total, items: result.items.map(row => ({ id: row.id, overtimeId: row.overtimeId,
    employee: row.user, status: row.status, createdAt: row.createdAt.toISOString(), proposedCheckOutAt: row.proposedCheckOutAt.toISOString() })) };
}
export async function getAdminOvertimeCorrectionDetail(rawId: unknown) {
  await requireAdmin();
  const id = z.uuid().safeParse(rawId);
  if (!id.success) return null;
  const row = await findAdminOvertimeCorrection(id.data);
  if (!row) return null;
  const original = snapshotDisplay.safeParse(row.originalOvertimeSnapshot);
  return { id: row.id, overtimeId: row.overtimeId, employee: row.user, status: row.status,
    expectedVersion: row.updatedAt.toISOString(), canDecide: row.status === "PENDING" && row.pendingSlot === 1,
    original: original.success ? original.data : null, reason: row.reason, proposedCheckOutAt: row.proposedCheckOutAt.toISOString(),
    createdAt: row.createdAt.toISOString(), reviewedAt: row.reviewedAt?.toISOString() ?? null,
    reviewer: row.reviewedBy?.name ?? null, reviewNote: row.reviewNote,
    officialCheckout: { at: row.overtime.checkOutAt?.toISOString() ?? null, source: row.overtime.checkOutSource, requestId: row.overtime.checkOutCorrectionRequestId } };
}
