import "server-only";
import { z } from "zod";
import { requireUser } from "@/lib/authorization/require-user";
import { ApplicationError } from "@/lib/errors/application-error";
import { getBusinessDate } from "@/lib/date-time/event-time";
import { localWallTimeToInstant } from "@/lib/date-time/local-wall-time";
import { getOvertimeState } from "@/lib/overtime/state";
import { inTransaction } from "@/lib/db/transaction";
import { isUniqueConstraintOn } from "@/lib/db/persistence-error";
import { lockAttendanceUser } from "@/repositories/attendance.repository";
import { findUserById } from "@/repositories/user.repository";
import { createAuditRecord } from "@/repositories/audit.repository";
import { createOvertimeCorrection, findBlockingOvertimeCorrection, findOwnOvertimeCorrection,
  findOwnOvertimeCorrectionTarget, listOwnOvertimeCorrections, lockOvertimeCorrectionTarget } from "@/repositories/overtime-correction.repository";
import { overtimeCorrectionHistorySchema, submitOvertimeCorrectionSchema } from "@/schemas/overtime-correction.schema";

async function employee() {
  const user = await requireUser();
  if (user.role !== "USER") throw new ApplicationError("FORBIDDEN", "Only USER employees may access personal overtime correction requests.");
  return user;
}
type Target = NonNullable<Awaited<ReturnType<typeof findOwnOvertimeCorrectionTarget>>>;
function bounds(row: Target) {
  const deadline = new Date(row.checkInAt.getTime() + row.maxOpenMinutes * 60_000);
  const calendar = new Date(`${getBusinessDate(deadline)}T00:00:00.000Z`);
  calendar.setUTCDate(calendar.getUTCDate() + 30);
  return { deadline, lastSubmissionDate: calendar.toISOString().slice(0, 10) };
}
function unavailable(row: Target, now: Date): string | null {
  if (getOvertimeState(row, now) !== "Incomplete") return "Only Incomplete overtime without Checkout can be submitted.";
  if (getBusinessDate(now) > bounds(row).lastSubmissionDate) return "The 30-calendar-day WIB submission window has closed.";
  return null;
}
export function overtimeCorrectionSnapshot(row: Target) {
  return { version: 1, id: row.id, userId: row.authorization.attendance.userId,
    authorizationId: row.authorizationId, attendanceId: row.authorization.attendanceId,
    workDate: row.authorization.attendance.workDate.toISOString().slice(0, 10),
    authorizationGrantedAt: row.authorization.grantedAt.toISOString(), authorizationRevokedAt: row.authorization.revokedAt?.toISOString() ?? null,
    maxOpenMinutes: row.maxOpenMinutes, checkInAt: row.checkInAt.toISOString(), deadlineAt: bounds(row).deadline.toISOString(),
    checkInLatitude: row.checkInLatitude, checkInLongitude: row.checkInLongitude, checkInAccuracy: row.checkInAccuracy,
    checkInTimezone: row.checkInTimezone, checkInAddress: row.checkInAddress, checkInDescription: row.checkInDescription, checkInPhotoPath: row.checkInPhotoPath,
    checkOutAt: row.checkOutAt?.toISOString() ?? null, checkOutLatitude: row.checkOutLatitude, checkOutLongitude: row.checkOutLongitude,
    checkOutAccuracy: row.checkOutAccuracy, checkOutTimezone: row.checkOutTimezone, checkOutAddress: row.checkOutAddress,
    checkOutDescription: row.checkOutDescription, checkOutPhotoPath: row.checkOutPhotoPath,
    checkOutSource: row.checkOutSource, checkOutCorrectionRequestId: row.checkOutCorrectionRequestId,
    createdAt: row.createdAt.toISOString(), updatedAt: row.updatedAt.toISOString() };
}
export async function getOvertimeCorrectionContext(rawId: unknown) {
  const user = await employee();
  const id = z.uuid().parse(rawId);
  const row = await findOwnOvertimeCorrectionTarget(user.id, id);
  if (!row) throw new ApplicationError("NOT_FOUND", "Overtime session not found.");
  const limits = bounds(row);
  const blocking = await findBlockingOvertimeCorrection(id);
  return { overtimeId: id, checkInAt: row.checkInAt.toISOString(), deadlineAt: limits.deadline.toISOString(),
    lastSubmissionDate: limits.lastSubmissionDate,
    unavailableReason: blocking ? `A ${blocking.status} request already exists for this session.` : unavailable(row, new Date()),
    existingRequestId: blocking?.id ?? null };
}
export async function submitOvertimeCorrection(raw: unknown) {
  const user = await employee();
  const input = submitOvertimeCorrectionSchema.parse(raw);
  const proposedCheckOutAt = localWallTimeToInstant(input.checkOutLocal, "Asia/Jakarta");
  try {
    return await inTransaction(async tx => {
      // Match normal event lock order: employee first, then target session.
      await lockAttendanceUser(user.id, tx);
      const currentUser = await findUserById(user.id, tx);
      if (!currentUser?.isActive || currentUser.role !== "USER") throw new ApplicationError("FORBIDDEN", "An active USER account is required.");
      await lockOvertimeCorrectionTarget(input.overtimeId, tx);
      const row = await findOwnOvertimeCorrectionTarget(user.id, input.overtimeId, tx);
      if (!row) throw new ApplicationError("NOT_FOUND", "Overtime session not found.");
      const now = new Date();
      const reason = unavailable(row, now);
      if (reason) throw new ApplicationError("CORRECTION_UNAVAILABLE", reason);
      if (await findBlockingOvertimeCorrection(row.id, tx)) throw new ApplicationError("CORRECTION_EXISTS", "A pending or approved request already exists. Check your request history.");
      if (proposedCheckOutAt <= row.checkInAt || proposedCheckOutAt > bounds(row).deadline || proposedCheckOutAt > now) {
        throw new ApplicationError("CORRECTION_TIME", "Proposed Checkout must be after Check-In, no later than the technical deadline, and not in the future.");
      }
      const request = await createOvertimeCorrection({ overtimeId: row.id, userId: user.id, reason: input.reason,
        proposedCheckOutAt, originalOvertimeSnapshot: overtimeCorrectionSnapshot(row), status: "PENDING", pendingSlot: 1, createdAt: now }, tx);
      await createAuditRecord({ actorId: user.id, action: "OVERTIME_CORRECTION_REQUESTED", entityType: "OvertimeCorrectionRequest",
        entityId: request.id, metadata: { overtimeId: row.id, requestId: request.id, submittedAt: now.toISOString() } }, tx);
      return request;
    });
  } catch (error) {
    if (isUniqueConstraintOn(error, "ot_correction_pending_key", ["overtimeId", "pendingSlot"])) {
      throw new ApplicationError("CORRECTION_PENDING", "A pending request already exists. Check your request history.");
    }
    throw error;
  }
}
export async function getOvertimeCorrectionHistory(raw: unknown) {
  const user = await employee();
  const { page } = overtimeCorrectionHistorySchema.parse(raw);
  const pageSize = 15;
  const result = await listOwnOvertimeCorrections(user.id, page, pageSize);
  return { ...result, page, pageSize, items: result.items.map(row => ({ ...row,
    createdAt: row.createdAt.toISOString(), proposedCheckOutAt: row.proposedCheckOutAt.toISOString() })) };
}
export async function getOvertimeCorrectionDetail(rawId: unknown) {
  const user = await employee();
  const id = z.uuid().safeParse(rawId);
  if (!id.success) return null;
  const row = await findOwnOvertimeCorrection(user.id, id.data);
  if (!row) return null;
  const original = z.object({ version: z.literal(1), checkInAt: z.iso.datetime(), deadlineAt: z.iso.datetime() }).safeParse(row.originalOvertimeSnapshot);
  return { id: row.id, overtimeId: row.overtimeId, status: row.status, reason: row.reason,
    checkInAt: original.success ? original.data.checkInAt : null, deadlineAt: original.success ? original.data.deadlineAt : null,
    proposedCheckOutAt: row.proposedCheckOutAt.toISOString(), createdAt: row.createdAt.toISOString(),
    reviewedAt: row.reviewedAt?.toISOString() ?? null, reviewNote: row.reviewNote, reviewer: row.reviewedBy?.name ?? null };
}
