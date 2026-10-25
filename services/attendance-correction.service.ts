import "server-only";
import { z } from "zod";
import type { Prisma } from "@/generated/prisma/client";
import { getBusinessDate } from "@/lib/date-time/event-time";
import { localWallTimeToInstant } from "@/lib/date-time/local-wall-time";
import { inTransaction, type DatabaseTransaction } from "@/lib/db/transaction";
import { isUniqueConstraintOn } from "@/lib/db/persistence-error";
import { ApplicationError } from "@/lib/errors/application-error";
import { findUserById } from "@/repositories/user.repository";
import { lockAttendanceUser } from "@/repositories/attendance.repository";
import { createAuditRecord } from "@/repositories/audit.repository";
import { findCorrectionAttendance, findPendingCorrection, createCorrectionRequest, listOwnCorrectionRequests, findOwnCorrectionRequest } from "@/repositories/attendance-correction.repository";
import { submitAttendanceCorrectionSchema, correctionHistorySchema } from "@/schemas/attendance-correction.schema";
import { dailyReportSchema } from "@/schemas/daily-report.schema";
import { toCorrectionDetailDto } from "@/mappers/attendance-correction.mapper";
import type { CorrectionFormContext, CorrectionSummaryDto } from "@/types/attendance-correction";

async function requireEmployee(userId: string, tx?: DatabaseTransaction) {
  const user = await findUserById(userId, tx);
  if (!user?.isActive) throw new ApplicationError("UNAUTHENTICATED", "Please sign in with an active account.");
  if (user.role !== "USER") throw new ApplicationError("FORBIDDEN", "Correction requests are available to employees with USER access only.");
  return user;
}

export function correctionDateBounds(now: Date = new Date()) {
  const today = getBusinessDate(now);
  const calendar = new Date(`${today}T00:00:00.000Z`);
  calendar.setUTCDate(calendar.getUTCDate() - 30);
  const from = calendar.toISOString().slice(0, 10);
  calendar.setUTCDate(calendar.getUTCDate() + 29);
  return { from, to: calendar.toISOString().slice(0, 10) };
}
function eligibleDate(workDate: string, now: Date) {
  const { from, to } = correctionDateBounds(now);
  return workDate >= from && workDate <= to;
}
function requireDate(workDate: string, now: Date) {
  if (!eligibleDate(workDate, now)) throw new ApplicationError("CORRECTION_DATE", "Choose a historical Jakarta business date within the last 30 calendar days.");
}
function pendingError() { return new ApplicationError("CORRECTION_PENDING", "A pending correction request already exists for this work date. Open Correction requests to view it."); }
type Target = NonNullable<Awaited<ReturnType<typeof findCorrectionAttendance>>>;
export function requireCorrectionTarget(target: Target | null, attendanceId: string): Target {
  if (!target || target.id !== attendanceId) throw new ApplicationError("CORRECTION_UNAVAILABLE", "This attendance is unavailable for correction.");
  if (target.checkOutAt) throw new ApplicationError("CORRECTION_COMPLETED", "Completed attendance cannot be corrected through this request.");
  if (target.overtimeAuthorization) throw new ApplicationError("CORRECTION_OVERTIME", "Attendance with an overtime authorization or activity cannot use this correction workflow.");
  if (target.checkOutSource || target.checkOutCorrectionRequestId || target.checkOutLatitude !== null || target.checkOutLongitude !== null ||
    target.checkOutAccuracy !== null || target.checkOutAddress !== null || target.checkOutTimezone !== null || target.checkOutDescription !== null) {
    throw new ApplicationError("CORRECTION_EVIDENCE", "Existing checkout evidence needs administrator review before a correction can be requested.");
  }
  return target;
}
function validReport(target: Target | null) {
  const report = dailyReportSchema.safeParse({ content: target?.dailyReport?.content });
  return report.success ? target!.dailyReport!.content : null;
}
export function attendanceCorrectionSnapshot(row: Target): Prisma.InputJsonObject {
  return {
    version: 1, id: row.id, userId: row.userId, workDate: row.workDate.toISOString().slice(0, 10),
    createdAt: row.createdAt.toISOString(), updatedAt: row.updatedAt.toISOString(), requiredWorkMinutes: row.requiredWorkMinutes,
    checkInAt: row.checkInAt.toISOString(), checkInTimezone: row.checkInTimezone, checkInSource: row.checkInSource,
    checkInLatitude: row.checkInLatitude, checkInLongitude: row.checkInLongitude, checkInAccuracy: row.checkInAccuracy,
    checkInAddress: row.checkInAddress, checkInDescription: row.checkInDescription, checkInCorrectionRequestId: row.checkInCorrectionRequestId,
    checkOutAt: row.checkOutAt?.toISOString() ?? null, checkOutTimezone: row.checkOutTimezone, checkOutSource: row.checkOutSource,
    checkOutLatitude: row.checkOutLatitude, checkOutLongitude: row.checkOutLongitude, checkOutAccuracy: row.checkOutAccuracy,
    checkOutAddress: row.checkOutAddress, checkOutDescription: row.checkOutDescription, checkOutCorrectionRequestId: row.checkOutCorrectionRequestId,
    dailyReport: row.dailyReport ? { id: row.dailyReport.id, content: row.dailyReport.content,
      createdAt: row.dailyReport.createdAt.toISOString(), updatedAt: row.dailyReport.updatedAt.toISOString() } : null,
    overtimeAuthorizationId: row.overtimeAuthorization?.id ?? null,
  };
}

export async function submitAttendanceCorrection(userId: string, raw: unknown) {
  const input = submitAttendanceCorrectionSchema.parse(raw);
  // Reject ineligible work dates before resolving the declared event times.
  requireDate(input.workDate, new Date());
  const checkOutAt = localWallTimeToInstant(input.checkOutLocal, input.checkOutTimezone);
  const proposedCheckIn = input.type === "MISSING_BOTH" ? localWallTimeToInstant(input.checkInLocal, input.checkInTimezone) : null;
  try {
    return await inTransaction(async tx => {
      await lockAttendanceUser(userId, tx);
      const user = await requireEmployee(userId, tx);
      const now = new Date();
      requireDate(input.workDate, now);
      const workDate = new Date(`${input.workDate}T00:00:00.000Z`);
      const record = await findCorrectionAttendance(userId, workDate, tx);
      const target = input.type === "MISSING_CHECKOUT" ? requireCorrectionTarget(record, input.attendanceId) : null;
      if (input.type === "MISSING_BOTH" && record) throw new ApplicationError("ATTENDANCE_EXISTS", "Attendance already exists for this work date. Open its History detail instead.");
      if (await findPendingCorrection(userId, workDate, tx)) throw pendingError();
      const checkInAt = target?.checkInAt ?? proposedCheckIn!;
      const duration = checkOutAt.getTime() - checkInAt.getTime();
      if (!Number.isFinite(duration) || duration <= 0 || duration > 24 * 60 * 60_000) {
        throw new ApplicationError("CORRECTION_DURATION", "Checkout must be after check-in, with a duration of no more than 24 hours.");
      }
      if (checkInAt > now || checkOutAt > now) throw new ApplicationError("CORRECTION_FUTURE", "Requested event times cannot be in the future.");
      if (proposedCheckIn && getBusinessDate(proposedCheckIn) !== input.workDate) {
        throw new ApplicationError("CORRECTION_WORK_DATE", "The check-in's Asia/Jakarta business date must match the selected work date.");
      }
      const existingReport = validReport(target);
      const proposedReport = existingReport ? null : dailyReportSchema.parse({ content: input.proposedDailyReportContent }).content;
      const schedule = user.workSchedule;
      if (input.type === "MISSING_BOTH" && (!schedule?.isActive || !Number.isInteger(schedule.requiredWorkMinutes) || schedule.requiredWorkMinutes < 1 || schedule.requiredWorkMinutes > 65_535)) {
        throw new ApplicationError("SCHEDULE_UNAVAILABLE", "A valid active work schedule is required. Contact an administrator.");
      }
      const request = await createCorrectionRequest({
        userId, attendanceId: target?.id ?? null, workDate, type: input.type,
        requestedCheckInAt: proposedCheckIn, requestedCheckOutAt: checkOutAt,
        requestedCheckInTimezone: input.type === "MISSING_BOTH" ? input.checkInTimezone : null,
        requestedCheckOutTimezone: input.checkOutTimezone, reason: input.reason, proposedDailyReportContent: proposedReport,
        requiredWorkMinutes: input.type === "MISSING_BOTH" ? schedule.requiredWorkMinutes : null,
        snapshotBasis: input.type === "MISSING_BOTH" ? "WORK_SCHEDULE_AT_SUBMISSION" : null,
        snapshotWorkScheduleId: input.type === "MISSING_BOTH" ? schedule.id : null,
        snapshotWorkScheduleName: input.type === "MISSING_BOTH" ? schedule.name : null,
        originalAttendanceSnapshot: target ? attendanceCorrectionSnapshot(target) : { version: 1, attendanceAbsent: true, userId, workDate: input.workDate, capturedAt: now.toISOString() },
        status: "PENDING", pendingSlot: 1, createdAt: now,
      }, tx);
      await createAuditRecord({ actorId: userId, action: "ATTENDANCE_CORRECTION_REQUESTED", entityType: "AttendanceCorrectionRequest", entityId: request.id,
        metadata: { requestId: request.id, employeeId: userId, workDate: input.workDate, type: input.type, submittedAt: now.toISOString() } }, tx);
      return request;
    });
  } catch (error) {
    if (isUniqueConstraintOn(error, "correction_pending_user_date_key", ["userId", "workDate", "pendingSlot"])) throw pendingError();
    throw error;
  }
}

export async function getCorrectionFormContext(userId: string, rawDate: unknown, rawAttendanceId?: unknown): Promise<CorrectionFormContext> {
  await requireEmployee(userId);
  const workDate = z.iso.date().parse(rawDate);
  const attendanceId = rawAttendanceId === undefined ? null : z.uuid().parse(rawAttendanceId);
  requireDate(workDate, new Date());
  const date = new Date(`${workDate}T00:00:00.000Z`);
  const record = await findCorrectionAttendance(userId, date);
  const target = attendanceId ? requireCorrectionTarget(record, attendanceId) : null;
  if (!attendanceId && record) throw new ApplicationError("ATTENDANCE_EXISTS", "Attendance exists for this date. Open its History detail to request a missing checkout.");
  const pending = await findPendingCorrection(userId, date);
  return { workDate, attendanceId: target?.id ?? null, checkInAt: target?.checkInAt.toISOString() ?? null,
    checkInTimezone: target?.checkInTimezone ?? null, existingReportContent: validReport(target), pendingRequestId: pending?.id ?? null };
}
export async function getCorrectionHistory(userId: string, raw: unknown) {
  await requireEmployee(userId);
  const { page } = correctionHistorySchema.parse(raw);
  const pageSize = 15;
  const result = await listOwnCorrectionRequests(userId, page, pageSize);
  const items: CorrectionSummaryDto[] = result.items.map(row => ({ ...row, workDate: row.workDate.toISOString().slice(0, 10), createdAt: row.createdAt.toISOString() }));
  return { items, total: result.total, page, pageSize };
}
export async function getCorrectionDetail(userId: string, rawId: unknown) {
  await requireEmployee(userId);
  const parsed = z.uuid().safeParse(rawId);
  if (!parsed.success) return null;
  const row = await findOwnCorrectionRequest(userId, parsed.data);
  if (!row) return null;
  const canResubmit = row.status === "REJECTED" && eligibleDate(row.workDate.toISOString().slice(0, 10), new Date());
  return toCorrectionDetailDto(row, canResubmit);
}
