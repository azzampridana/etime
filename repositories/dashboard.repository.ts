import "server-only";
import type { Prisma } from "@/generated/prisma/client";
import { getPrisma } from "@/lib/db/prisma";
import { adminAttendanceOrder } from "@/repositories/attendance.repository";

const summarySelect = {
  id: true, checkInAt: true, checkInTimezone: true, checkOutAt: true, checkOutTimezone: true,
  user: { select: { name: true, position: true, isActive: true } },
} satisfies Prisma.AttendanceSelect;

/** Counts stay in the database; neither table loads history or photo evidence. */
export async function readDashboardRecords(workDate: Date) {
  const db = getPrisma();
  const [working, completed, authorized, overtimeInProgress, overtimeCompleted, historicalIncomplete, openOvertime, candidates, recent, activityEvents] = await db.$transaction([
    db.attendance.count({ where: { workDate, checkOutAt: null } }),
    db.attendance.count({ where: { workDate, checkOutAt: { not: null } } }),
    db.overtimeAuthorization.count({ where: {
      revokedAt: null, overtime: { is: null },
      attendance: { workDate, checkOutAt: { not: null }, user: { isActive: true } },
    } }),
    db.overtime.count({ where: { authorization: { attendance: { workDate } }, checkOutAt: null } }),
    db.overtime.count({ where: { authorization: { attendance: { workDate } }, checkOutAt: { not: null } } }),
    db.attendance.count({ where: { workDate: { lt: workDate }, checkOutAt: null } }),
    db.overtime.count({ where: { checkOutAt: null } }),
    db.attendance.findMany({
      where: { workDate, checkOutAt: { not: null } }, take: 8,
      orderBy: [{ checkOutAt: "desc" }, { id: "desc" }],
      select: { ...summarySelect, overtimeAuthorization: { select: {
        revokedAt: true, overtime: { select: { checkOutAt: true } },
      } } },
    }),
    db.attendance.findMany({ where: { workDate }, take: 8, orderBy: adminAttendanceOrder, select: summarySelect }),
    // Complete current-date event counts, independent of the eight-row preview.
    db.attendance.findMany({ where: { workDate }, select: { checkInAt: true, checkOutAt: true } }),
  ]);
  return { working, completed, authorized, overtimeInProgress, overtimeCompleted, historicalIncomplete, openOvertime, candidates, recent, activityEvents };
}
