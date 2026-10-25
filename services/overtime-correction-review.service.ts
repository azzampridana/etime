import "server-only";
import { isDeepStrictEqual } from "node:util";
import { requireAdmin } from "@/lib/authorization/require-user";
import { assertAdmin } from "@/lib/authorization/policy";
import { ApplicationError } from "@/lib/errors/application-error";
import { inTransaction } from "@/lib/db/transaction";
import { isUniqueConstraintError } from "@/lib/db/persistence-error";
import { getOvertimeState } from "@/lib/overtime/state";
import { lockAttendanceUser } from "@/repositories/attendance.repository";
import { lockAuthorizationAttendance } from "@/repositories/overtime-authorization.repository";
import { findUserById } from "@/repositories/user.repository";
import { findConflictingAttendance } from "@/repositories/attendance-correction.repository";
import { createAuditRecord } from "@/repositories/audit.repository";
import { findOvertimeCorrectionRouting, lockOvertimeCorrectionTarget, lockOvertimeCorrectionRequest,
  findOvertimeCorrectionForDecision, findOwnOvertimeCorrectionTarget, findOvertimeCorrectionParent,
  findOvertimeCorrectionOverlap, applyOvertimeCorrectionCheckout, finalizeOvertimeCorrection } from "@/repositories/overtime-correction.repository";
import { overtimeCorrectionSnapshot } from "@/services/overtime-correction.service";
import { decideOvertimeCorrectionSchema } from "@/schemas/overtime-correction.schema";

function conflict(code: string, message: string): never { throw new ApplicationError(code, message); }

export async function decideOvertimeCorrection(raw: unknown) {
  const actor = await requireAdmin();
  const input = decideOvertimeCorrectionSchema.parse(raw);
  const routing = await findOvertimeCorrectionRouting(input.requestId);
  if (!routing) conflict("NOT_FOUND", "Correction request not found.");
  const parentId = routing.overtime.authorization.attendanceId;
  try {
    return await inTransaction(async tx => {
      for (const id of [...new Set([actor.id, routing.userId])].sort()) await lockAttendanceUser(id, tx);
      await lockAuthorizationAttendance(parentId, tx);
      await lockOvertimeCorrectionTarget(routing.overtimeId, tx);
      await lockOvertimeCorrectionRequest(input.requestId, tx);
      const reviewer = await findUserById(actor.id, tx);
      assertAdmin(reviewer?.isActive ? reviewer : null);
      const request = await findOvertimeCorrectionForDecision(input.requestId, tx);
      if (!request || request.userId !== routing.userId || request.overtimeId !== routing.overtimeId) conflict("STALE_REQUEST", "Request references changed. Reload before reviewing.");
      if (request.status !== "PENDING" || request.pendingSlot !== 1) conflict("DECIDED", "This request is no longer pending. Reload to see its status.");
      if (request.updatedAt.toISOString() !== input.expectedVersion) conflict("STALE_REQUEST", "Request changed. Reload before reviewing.");
      const target = await findOwnOvertimeCorrectionTarget(request.userId, request.overtimeId, tx);
      if (!target || target.authorization.attendanceId !== parentId) conflict("OWNERSHIP_CHANGED", "The session ownership or parent Attendance changed.");
      const now = new Date();
      if (input.decision === "APPROVED") {
        const employee = await findUserById(request.userId, tx);
        if (!employee?.isActive || employee.role !== "USER") conflict("EMPLOYEE_UNAVAILABLE", "Approval requires an active USER employee. Rejection remains available.");
        if (getOvertimeState(target, now) !== "Incomplete") conflict("TARGET_CHANGED", "The session must still be Incomplete without Checkout.");
        if (target.checkOutSource !== null || target.checkOutCorrectionRequestId !== null || target.checkOutLatitude !== null ||
          target.checkOutLongitude !== null || target.checkOutAccuracy !== null || target.checkOutTimezone !== null ||
          target.checkOutAddress !== null || target.checkOutDescription !== null || target.checkOutPhotoPath !== null) {
          conflict("CHECKOUT_EVIDENCE", "Existing Checkout evidence requires review; no evidence will be overwritten.");
        }
        const original = request.originalOvertimeSnapshot;
        if (!original || typeof original !== "object" || Array.isArray(original)) conflict("SNAPSHOT_INVALID", "Original version-1 snapshot is unavailable.");
        const current = overtimeCorrectionSnapshot(target);
        // Revocation after OT start is not a reason to reject a historical correction.
        const comparableOriginal = { ...original, authorizationRevokedAt: null };
        const comparableCurrent = { ...current, authorizationRevokedAt: null };
        if (!isDeepStrictEqual(comparableOriginal, comparableCurrent)) conflict("SNAPSHOT_STALE", "Overtime changed after submission. Approval was not applied; the request remains pending.");
        const start = target.checkInAt;
        const end = request.proposedCheckOutAt;
        const deadline = new Date(start.getTime() + target.maxOpenMinutes * 60_000);
        if (!Number.isFinite(end.getTime()) || end <= start || end > deadline || end > now) conflict("INVALID_INTERVAL", "Proposed Checkout must be after Check-In and no later than the technical deadline or server time.");
        const parent = await findOvertimeCorrectionParent(parentId, tx);
        if (!parent || parent.userId !== request.userId || !parent.checkOutAt || parent.checkOutAt <= parent.checkInAt || parent.checkOutAt > start) {
          conflict("PARENT_CONFLICT", "Parent Attendance must be completed before Overtime starts, with consistent ownership and timestamps.");
        }
        const attendanceOverlap = await findConflictingAttendance(request.userId, start, end, undefined, tx);
        if (attendanceOverlap) conflict("ATTENDANCE_OVERLAP", attendanceOverlap.checkOutAt ? "Proposed overtime overlaps Attendance." : "An Attendance with missing Checkout prevents safely excluding an overlap.");
        const overtimeOverlap = await findOvertimeCorrectionOverlap(request.userId, start, end, target.id, tx);
        if (overtimeOverlap) conflict("OVERTIME_OVERLAP", overtimeOverlap.checkOutAt ? "Proposed overtime overlaps another Overtime session." : "Another Overtime session has no Checkout; its end cannot be inferred from expiry.");
        const applied = await applyOvertimeCorrectionCheckout({ id: target.id, updatedAt: target.updatedAt }, request.id, end, tx);
        if (applied.count !== 1) conflict("TARGET_CHANGED", "Overtime changed during review. No decision was applied.");
        await createAuditRecord({ actorId: actor.id, action: "OVERTIME_CHECKOUT_CORRECTED", entityType: "Overtime", entityId: target.id,
          metadata: { requestId: request.id, employeeId: request.userId, checkOutAt: end.toISOString(), checkOutSource: "ADMIN_CORRECTION", decidedAt: now.toISOString() } }, tx);
      }
      const finalized = await finalizeOvertimeCorrection(request.id, request.updatedAt, { status: input.decision,
        reviewedById: actor.id, reviewedAt: now, reviewNote: input.reviewNote?.trim() || null }, tx);
      if (finalized.count !== 1) conflict("STALE_REQUEST", "Request changed during review. No decision was applied.");
      await createAuditRecord({ actorId: actor.id, action: `OVERTIME_CORRECTION_${input.decision}`, entityType: "OvertimeCorrectionRequest", entityId: request.id,
        metadata: { overtimeId: request.overtimeId, employeeId: request.userId, reviewerId: actor.id, decidedAt: now.toISOString() } }, tx);
      return { id: request.id, overtimeId: request.overtimeId, status: input.decision };
    });
  } catch (error) {
    if (isUniqueConstraintError(error)) conflict("CORRECTION_CONFLICT", "A correction reference conflicts with existing data. Reload and inspect the session before deciding again.");
    throw error;
  }
}
