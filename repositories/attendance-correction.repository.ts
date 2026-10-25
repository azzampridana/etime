import "server-only";
import type { Prisma } from "@/generated/prisma/client";
import { getPrisma } from "@/lib/db/prisma";
import type { DatabaseTransaction } from "@/lib/db/transaction";

export function findCorrectionAttendance(userId: string, workDate: Date, tx?: DatabaseTransaction) {
  return (tx ?? getPrisma()).attendance.findUnique({ where: { userId_workDate: { userId, workDate } },
    include: { dailyReport: true, overtimeAuthorization: { select: { id: true } } } });
}
export function findPendingCorrection(userId: string, workDate: Date, tx?: DatabaseTransaction) {
  return (tx ?? getPrisma()).attendanceCorrectionRequest.findFirst({ where: { userId, workDate, status: "PENDING" }, select: { id: true } });
}
export function createCorrectionRequest(data: Prisma.AttendanceCorrectionRequestUncheckedCreateInput, tx: DatabaseTransaction) {
  return tx.attendanceCorrectionRequest.create({ data, select: { id: true } });
}
const summarySelect = {
  id: true, workDate: true, type: true, status: true, createdAt: true,
} satisfies Prisma.AttendanceCorrectionRequestSelect;
export async function listOwnCorrectionRequests(userId: string, page: number, pageSize: number) {
  const db = getPrisma();
  const [items, total] = await db.$transaction([
    db.attendanceCorrectionRequest.findMany({ where: { userId }, select: summarySelect,
      orderBy: [{ createdAt: "desc" }, { id: "desc" }], skip: (page - 1) * pageSize, take: pageSize }),
    db.attendanceCorrectionRequest.count({ where: { userId } }),
  ]);
  return { items, total };
}
const detailSelect = {
  ...summarySelect, attendanceId: true, requestedCheckInAt: true, requestedCheckOutAt: true,
  requestedCheckInTimezone: true, requestedCheckOutTimezone: true, reason: true,
  proposedDailyReportContent: true, reviewedAt: true, reviewNote: true,
  reviewedBy: { select: { name: true } },
  originalAttendanceSnapshot: true,
} satisfies Prisma.AttendanceCorrectionRequestSelect;
export type CorrectionDetailRecord = Prisma.AttendanceCorrectionRequestGetPayload<{ select: typeof detailSelect }>;
export function findOwnCorrectionRequest(userId: string, id: string) {
  return getPrisma().attendanceCorrectionRequest.findFirst({ where: { id, userId }, select: detailSelect });
}

export function findCorrectionRouting(id: string) {
  return getPrisma().attendanceCorrectionRequest.findUnique({ where: { id }, select: { userId: true } });
}
export async function lockCorrectionRequest(id: string, tx: DatabaseTransaction) {
  await tx.$queryRaw`SELECT id FROM attendancecorrectionrequest WHERE id = ${id} FOR UPDATE`;
}
export function findCorrectionForDecision(id: string, tx: DatabaseTransaction) {
  return tx.attendanceCorrectionRequest.findUnique({ where: { id } });
}
export type CorrectionDecisionRecord = NonNullable<Awaited<ReturnType<typeof findCorrectionForDecision>>>;

export function findConflictingAttendance(userId: string, start: Date, end: Date, excludeId: string | undefined, tx: DatabaseTransaction) {
  return tx.attendance.findFirst({ where: { userId, ...(excludeId ? { id: { not: excludeId } } : {}),
    checkInAt: { lt: end }, OR: [{ checkOutAt: null }, { checkOutAt: { gt: start } }] }, select: { id: true, checkOutAt: true } });
}
export function findConflictingOvertime(userId: string, start: Date, end: Date, tx: DatabaseTransaction) {
  // Missing checkout is unbounded, including expired sessions; policy expiry is not evidence of an endpoint.
  return tx.overtime.findFirst({ where: { authorization: { attendance: { userId } },
    checkInAt: { lt: end }, OR: [{ checkOutAt: null }, { checkOutAt: { gt: start } }] }, select: { id: true, checkOutAt: true } });
}
export function applyCorrectionCheckout(target: { id: string; userId: string; updatedAt: Date }, request: CorrectionDecisionRecord, tx: DatabaseTransaction) {
  return tx.attendance.updateMany({ where: { ...target, checkOutAt: null,
    checkOutSource: null, checkOutCorrectionRequestId: null, checkOutLatitude: null, checkOutLongitude: null,
    checkOutAccuracy: null, checkOutAddress: null, checkOutTimezone: null, checkOutDescription: null },
    data: { checkOutAt: request.requestedCheckOutAt, checkOutTimezone: request.requestedCheckOutTimezone,
      checkOutSource: "ADMIN_CORRECTION", checkOutCorrectionRequestId: request.id } });
}
export function createCorrectionAttendance(data: Prisma.AttendanceUncheckedCreateInput, tx: DatabaseTransaction) {
  return tx.attendance.create({ data, select: { id: true } });
}
export function createCorrectionDailyReport(attendanceId: string, content: string, tx: DatabaseTransaction) {
  // Never upsert: a report appearing concurrently must not be overwritten.
  return tx.dailyReport.create({ data: { attendanceId, content }, select: { id: true } });
}
export function finalizeCorrectionRequest(id: string, expectedVersion: Date, data: {
  status: "APPROVED" | "REJECTED"; reviewedById: string; reviewedAt: Date; reviewNote: string | null;
  appliedApprovalSnapshot?: Prisma.InputJsonObject;
}, tx: DatabaseTransaction) {
  return tx.attendanceCorrectionRequest.updateMany({ where: { id, updatedAt: expectedVersion, status: "PENDING", pendingSlot: 1 },
    data: { ...data, pendingSlot: null, updatedAt: data.reviewedAt } });
}

const adminSummarySelect = { ...summarySelect, reviewedAt: true,
  user: { select: { name: true, email: true, isActive: true } }, reviewedBy: { select: { name: true } },
} satisfies Prisma.AttendanceCorrectionRequestSelect;
export async function listAdminCorrectionRecords(status: "ALL" | "PENDING" | "APPROVED" | "REJECTED", page: number, pageSize: number) {
  const db = getPrisma();
  const where = status === "ALL" ? {} : { status };
  const [items, total] = await db.$transaction([
    db.attendanceCorrectionRequest.findMany({ where, select: adminSummarySelect,
      orderBy: [{ createdAt: "desc" }, { id: "desc" }], skip: (page - 1) * pageSize, take: pageSize }),
    db.attendanceCorrectionRequest.count({ where }),
  ]);
  return { items, total };
}
export function findAdminCorrectionRecord(id: string) {
  return getPrisma().attendanceCorrectionRequest.findUnique({ where: { id }, select: {
    ...detailSelect, userId: true, user: adminSummarySelect.user, updatedAt: true, requiredWorkMinutes: true,
    snapshotBasis: true, snapshotWorkScheduleName: true, snapshotWorkScheduleId: true, appliedApprovalSnapshot: true,
  } });
}
