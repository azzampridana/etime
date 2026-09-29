import "server-only";

import type { DatabaseTransaction } from "@/lib/db/transaction";
import { ApplicationError } from "@/lib/errors/application-error";
import { findAttendanceByOwner, lockAttendanceUser } from "@/repositories/attendance.repository";
import { getBusinessDate } from "@/lib/date-time/event-time";
import { findUserById } from "@/repositories/user.repository";

export async function lockActiveAttendanceUser(userId: string, tx: DatabaseTransaction) {
  await lockAttendanceUser(userId, tx);
  const user = await findUserById(userId, tx);
  if (!user?.isActive) throw new ApplicationError("UNAUTHENTICATED", "Please sign in with an active account.");
  return user;
}

export async function requireOpenAttendance(userId: string, tx: DatabaseTransaction, attendanceId: string, at: Date = new Date()) {
  const attendance = await findAttendanceByOwner(attendanceId, userId, tx);
  if (!attendance || attendance.checkOutAt) throw new ApplicationError("NO_OPEN_ATTENDANCE", "This attendance is unavailable or already completed. Refresh Today.");
  if (attendance.workDate.toISOString().slice(0, 10) !== getBusinessDate(at)) {
    throw new ApplicationError("ATTENDANCE_EXPIRED", "This attendance is no longer actionable for today. Its checkout remains missing. Open Today for the current attendance.");
  }
  return attendance;
}
