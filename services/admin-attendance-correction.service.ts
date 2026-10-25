import "server-only";
import { z } from "zod";
import { requireAdmin } from "@/lib/authorization/require-user";
import { adminCorrectionQuerySchema } from "@/schemas/attendance-correction.schema";
import { listAdminCorrectionRecords, findAdminCorrectionRecord, findCorrectionAttendance } from "@/repositories/attendance-correction.repository";
import { toCorrectionDetailDto } from "@/mappers/attendance-correction.mapper";
import { getLocalWorkDate } from "@/lib/date-time/event-time";
import { elapsedWholeMinutes } from "@/lib/date-time/duration";

const originalEvidenceSchema = z.object({
  id: z.uuid(), checkInAt: z.iso.datetime(), checkInTimezone: z.string(), requiredWorkMinutes: z.number().int().nonnegative(),
  checkInLatitude: z.number().nullable(), checkInLongitude: z.number().nullable(), checkInAccuracy: z.number().nullable(),
  checkInAddress: z.string().nullable(), checkInDescription: z.string().nullable(), checkInSource: z.enum(["NORMAL", "ADMIN_CORRECTION"]),
});
export async function listAdminCorrections(raw: unknown) {
  await requireAdmin();
  const input = adminCorrectionQuerySchema.parse(raw);
  const pageSize = 20;
  const result = await listAdminCorrectionRecords(input.status, input.page, pageSize);
  return { ...input, pageSize, total: result.total, items: result.items.map(row => ({
    id: row.id, workDate: row.workDate.toISOString().slice(0, 10), type: row.type, status: row.status,
    employee: row.user, submittedAt: row.createdAt.toISOString(), reviewedAt: row.reviewedAt?.toISOString() ?? null,
    reviewer: row.reviewedBy?.name ?? null,
  })) };
}
export async function getAdminCorrectionDetail(id: string) {
  await requireAdmin();
  if (!z.uuid().safeParse(id).success) return null;
  const row = await findAdminCorrectionRecord(id);
  if (!row) return null;
  const detail = toCorrectionDetailDto(row, false);
  const original = originalEvidenceSchema.safeParse(row.originalAttendanceSnapshot);
  const applied = z.object({ id: z.uuid() }).safeParse(row.appliedApprovalSnapshot);
  const current = await findCorrectionAttendance(row.userId, row.workDate);
  const start = detail.requestedCheckInAt ?? detail.originalCheckInAt;
  const end = detail.requestedCheckOutAt;
  const startZone = detail.requestedCheckInTimezone ?? detail.originalCheckInTimezone;
  const validInterval = start && Number.isFinite(Date.parse(start)) && Date.parse(end) > Date.parse(start);
  return { ...detail, employee: row.user, expectedVersion: row.updatedAt.toISOString(),
    original: original.success ? original.data : null,
    currentAttendance: current ? { id: current.id, state: current.checkOutAt ? "Completed" : "Incomplete",
      report: current.dailyReport?.content ?? null } : null,
    appliedAttendanceId: applied.success ? applied.data.id : null,
    schedule: { name: row.snapshotWorkScheduleName, id: row.snapshotWorkScheduleId, basis: row.snapshotBasis, minutes: row.requiredWorkMinutes },
    durationMinutes: validInterval && start ? elapsedWholeMinutes(new Date(start), new Date(end)) : null,
    crossesJakartaMidnight: validInterval && start ? getLocalWorkDate(new Date(start), "Asia/Jakarta") !== getLocalWorkDate(new Date(end), "Asia/Jakarta") : false,
    eventLocalDatesDiffer: validInterval && start && startZone ? getLocalWorkDate(new Date(start), startZone) !== getLocalWorkDate(new Date(end), detail.requestedCheckOutTimezone) : false,
  };
}
