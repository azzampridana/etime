import "server-only";
import { isDeepStrictEqual } from "node:util";
import { z } from "zod";
import type { Prisma } from "@/generated/prisma/client";
import { assertAdmin } from "@/lib/authorization/policy";
import { getBusinessDate, isValidTimeZone } from "@/lib/date-time/event-time";
import { inTransaction } from "@/lib/db/transaction";
import { isUniqueConstraintOn } from "@/lib/db/persistence-error";
import { ApplicationError } from "@/lib/errors/application-error";
import { findUserById } from "@/repositories/user.repository";
import { lockAttendanceUser } from "@/repositories/attendance.repository";
import { createAuditRecord } from "@/repositories/audit.repository";
import { findCorrectionRouting, lockCorrectionRequest, findCorrectionForDecision, findCorrectionAttendance,
  findConflictingAttendance, findConflictingOvertime, applyCorrectionCheckout, createCorrectionAttendance,
  createCorrectionDailyReport, finalizeCorrectionRequest } from "@/repositories/attendance-correction.repository";
import { decideAttendanceCorrectionSchema } from "@/schemas/attendance-correction.schema";
import { dailyReportSchema } from "@/schemas/daily-report.schema";
import { attendanceCorrectionSnapshot, requireCorrectionTarget } from "@/services/attendance-correction.service";

function conflict(code: string, message: string): never { throw new ApplicationError(code, message); }
function reportProposal(content: string | null): string {
  const result = dailyReportSchema.safeParse({ content });
  if (!result.success) conflict("CORRECTION_REPORT_REQUIRED", "The submitted proposal does not contain a valid Daily Report.");
  return result.data.content;
}
const absenceSnapshot = z.object({ version: z.literal(1), attendanceAbsent: z.literal(true), userId: z.uuid(), workDate: z.iso.date(), capturedAt: z.iso.datetime() });

/** actorId must come from requireAdmin, never from the decision payload. */
export async function decideAttendanceCorrection(actorId: string, raw: unknown) {
  const input = decideAttendanceCorrectionSchema.parse(raw);
  const routing = await findCorrectionRouting(input.requestId);
  if (!routing) conflict("CORRECTION_NOT_FOUND", "Correction request not found.");
  try {
    return await inTransaction(async tx => {
      // No consistent reads before all user locks; matches grant/delete and normal employee-first mutations.
      for (const id of [...new Set([actorId, routing.userId])].sort()) await lockAttendanceUser(id, tx);
      await lockCorrectionRequest(input.requestId, tx);
      const actor = await findUserById(actorId, tx);
      assertAdmin(actor?.isActive ? actor : null);
      const request = await findCorrectionForDecision(input.requestId, tx);
      if (!request || request.userId !== routing.userId) conflict("CORRECTION_NOT_FOUND", "Correction request is unavailable. Refresh before reviewing.");
      const employee = await findUserById(request.userId, tx);
      if (!employee?.isActive) conflict("EMPLOYEE_INACTIVE", "The employee is inactive. A decision cannot be applied.");
      if (request.status !== "PENDING") conflict("CORRECTION_DECIDED", "This request has already been decided.");
      if (request.pendingSlot !== 1 || request.updatedAt.toISOString() !== input.expectedVersion) {
        conflict("CORRECTION_VERSION", "The request changed. Refresh before reviewing.");
      }
      const now = new Date();
      let appliedAttendanceId: string | null = null;
      let appliedApprovalSnapshot: Prisma.InputJsonObject | undefined;
      if (input.decision === "APPROVED") {
        const target = await findCorrectionAttendance(request.userId, request.workDate, tx);
        let start: Date;
        let proposedReport: string | null = null;
        if (request.type === "MISSING_CHECKOUT") {
          if (!request.attendanceId) conflict("CORRECTION_SNAPSHOT", "The request has no original Attendance reference.");
          const original = requireCorrectionTarget(target, request.attendanceId);
          const snapshot = request.originalAttendanceSnapshot;
          if (!snapshot || typeof snapshot !== "object" || Array.isArray(snapshot)) conflict("CORRECTION_SNAPSHOT", "The original Attendance snapshot is unavailable.");
          const current = attendanceCorrectionSnapshot(original);
          if (!isDeepStrictEqual(snapshot.dailyReport, current.dailyReport)) conflict("CORRECTION_REPORT_STALE", "Daily Report changed after submission. Approval was not applied.");
          if (!isDeepStrictEqual(snapshot, current)) conflict("CORRECTION_ATTENDANCE_STALE", "Attendance changed after submission. Approval was not applied.");
          if (request.requestedCheckInAt || request.requestedCheckInTimezone) conflict("CORRECTION_PROPOSAL", "A missing-checkout proposal cannot replace Check In.");
          start = original.checkInAt;
          if (original.dailyReport) {
            if (!dailyReportSchema.safeParse({ content: original.dailyReport.content }).success) {
              conflict("CORRECTION_REPORT_INVALID", "The existing Daily Report is invalid and cannot be silently replaced by approval.");
            }
          } else proposedReport = reportProposal(request.proposedDailyReportContent);
        } else {
          if (target || request.attendanceId) conflict("CORRECTION_ATTENDANCE_EXISTS", "Attendance already exists for this work date. Approval was not applied.");
          const snapshot = absenceSnapshot.safeParse(request.originalAttendanceSnapshot);
          if (!snapshot.success || snapshot.data.userId !== request.userId || snapshot.data.workDate !== request.workDate.toISOString().slice(0, 10)) {
            conflict("CORRECTION_SNAPSHOT", "The original absence snapshot is invalid.");
          }
          if (request.snapshotBasis !== "WORK_SCHEDULE_AT_SUBMISSION" || !z.uuid().safeParse(request.snapshotWorkScheduleId).success ||
            !request.snapshotWorkScheduleName?.trim() || !Number.isInteger(request.requiredWorkMinutes) ||
            request.requiredWorkMinutes === null || request.requiredWorkMinutes < 1 || request.requiredWorkMinutes > 65_535) {
            conflict("CORRECTION_SCHEDULE", "The submitted work-duration snapshot is invalid.");
          }
          if (!request.requestedCheckInAt || !request.requestedCheckInTimezone || !isValidTimeZone(request.requestedCheckInTimezone)) {
            conflict("CORRECTION_INTERVAL", "The submitted Check-In timestamp or timezone is invalid.");
          }
          start = request.requestedCheckInAt;
          if (getBusinessDate(start) !== request.workDate.toISOString().slice(0, 10)) conflict("CORRECTION_WORK_DATE", "The proposed Check In does not match the Jakarta work date.");
          proposedReport = reportProposal(request.proposedDailyReportContent);
        }
        const end = request.requestedCheckOutAt;
        const duration = end.getTime() - start.getTime();
        if (!isValidTimeZone(request.requestedCheckOutTimezone) || !Number.isFinite(duration) || duration <= 0 || duration > 86_400_000 || start > now || end > now) {
          conflict("CORRECTION_INTERVAL", "The historical interval must be in the past, positive, and no longer than 24 hours.");
        }
        const attendanceConflict = await findConflictingAttendance(request.userId, start, end, request.type === "MISSING_CHECKOUT" ? request.attendanceId! : undefined, tx);
        if (attendanceConflict) conflict("CORRECTION_ATTENDANCE_OVERLAP", attendanceConflict.checkOutAt
          ? "The proposed interval overlaps another Attendance."
          : "Another Attendance has no checkout; its interval cannot safely be excluded.");
        const overtimeConflict = await findConflictingOvertime(request.userId, start, end, tx);
        if (overtimeConflict) conflict("CORRECTION_OVERTIME_OVERLAP", overtimeConflict.checkOutAt
          ? "The proposed interval overlaps recorded Overtime."
          : "Overtime has no checkout; its interval cannot safely be excluded.");
        // Authorizations have no scheduled start/end window. A target-linked authorization was
        // rejected above; other authorizations are checked through their actual overtime intervals.
        if (request.type === "MISSING_CHECKOUT") {
          const original = requireCorrectionTarget(target, request.attendanceId!);
          const updated = await applyCorrectionCheckout({ id: original.id, userId: original.userId, updatedAt: original.updatedAt }, request, tx);
          if (updated.count !== 1) conflict("CORRECTION_ATTENDANCE_STALE", "Attendance changed during review. Approval was not applied.");
          appliedAttendanceId = original.id;
        } else {
          const created = await createCorrectionAttendance({ userId: request.userId, workDate: request.workDate,
            requiredWorkMinutes: request.requiredWorkMinutes!, checkInAt: start, checkOutAt: end,
            checkInTimezone: request.requestedCheckInTimezone!, checkOutTimezone: request.requestedCheckOutTimezone,
            checkInSource: "ADMIN_CORRECTION", checkOutSource: "ADMIN_CORRECTION",
            checkInCorrectionRequestId: request.id, checkOutCorrectionRequestId: request.id,
            checkInLatitude: null, checkInLongitude: null, checkInAccuracy: null,
            checkOutLatitude: null, checkOutLongitude: null, checkOutAccuracy: null,
            checkInAddress: null, checkOutAddress: null, checkInDescription: null, checkOutDescription: null }, tx);
          appliedAttendanceId = created.id;
        }
        if (proposedReport !== null) await createCorrectionDailyReport(appliedAttendanceId, proposedReport, tx);
        const applied = await findCorrectionAttendance(request.userId, request.workDate, tx);
        if (!applied) conflict("CORRECTION_PERSISTENCE", "Unable to read the applied correction.");
        appliedApprovalSnapshot = attendanceCorrectionSnapshot(applied);
      }
      const updated = await finalizeCorrectionRequest(request.id, request.updatedAt, { status: input.decision,
        reviewedById: actorId, reviewedAt: now, reviewNote: input.reviewNote?.trim() || null,
        ...(appliedApprovalSnapshot ? { appliedApprovalSnapshot } : {}) }, tx);
      if (updated.count !== 1) conflict("CORRECTION_VERSION", "The request changed during review. No decision was applied.");
      const metadata = { requestId: request.id, employeeId: request.userId, reviewerId: actorId,
        workDate: request.workDate.toISOString().slice(0, 10), type: request.type, decidedAt: now.toISOString(), appliedAttendanceId };
      await createAuditRecord({ actorId, action: `ATTENDANCE_CORRECTION_${input.decision}`, entityType: "AttendanceCorrectionRequest", entityId: request.id, metadata }, tx);
      if (appliedAttendanceId) await createAuditRecord({ actorId,
        action: request.type === "MISSING_CHECKOUT" ? "ATTENDANCE_CHECKOUT_CORRECTED" : "ATTENDANCE_CREATED_BY_CORRECTION",
        entityType: "Attendance", entityId: appliedAttendanceId, metadata }, tx);
      return { id: request.id, status: input.decision, attendanceId: appliedAttendanceId };
    });
  } catch (error) {
    if (isUniqueConstraintOn(error, "Attendance_userId_workDate_key", ["userId", "workDate"]) ||
        isUniqueConstraintOn(error, "attendance_userId_workDate_key", ["userId", "workDate"])) {
      conflict("CORRECTION_ATTENDANCE_EXISTS", "Attendance was created for this date. Refresh before reviewing.");
    }
    if (isUniqueConstraintOn(error, "DailyReport_attendanceId_key", ["attendanceId"]) ||
        isUniqueConstraintOn(error, "dailyreport_attendanceId_key", ["attendanceId"])) {
      conflict("CORRECTION_REPORT_STALE", "A Daily Report appeared during review. No correction was applied.");
    }
    throw error;
  }
}
