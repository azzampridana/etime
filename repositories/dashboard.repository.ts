import "server-only";
import { Prisma } from "@/generated/prisma/client";
import { overtimeWindowSql } from "@/repositories/overtime.repository";
import { getPrisma } from "@/lib/db/prisma";
import { adminAttendanceOrder } from "@/repositories/attendance.repository";

const summarySelect = {
  id: true, checkInAt: true, checkInTimezone: true, checkOutAt: true, checkOutTimezone: true,
  user: { select: { name: true, position: true, isActive: true } },
} satisfies Prisma.AttendanceSelect;

/** Counts stay in the database; neither table loads history or photo evidence. */
export async function readDashboardRecords(workDate: Date, now: Date) {
  const db = getPrisma();
  const countOvertime = (incomplete: boolean, todayOnly: boolean) => db.$queryRaw<{ total: bigint }[]>(Prisma.sql`
    SELECT COUNT(*) AS total FROM overtime o JOIN overtimeauthorization oa ON oa.id = o.authorizationId
    JOIN attendance a ON a.id = oa.attendanceId WHERE ${overtimeWindowSql(now, incomplete)}
    ${todayOnly ? Prisma.sql`AND a.workDate = ${workDate}` : Prisma.empty}`);
  const [working, completed, authorized, inProgressRows, overtimeCompleted, historicalIncomplete, openRows, candidates, recent, activityEvents, incompleteTodayRows, incompleteRows] = await db.$transaction([
    db.attendance.count({ where: { workDate, checkOutAt: null } }),
    db.attendance.count({ where: { workDate, checkOutAt: { not: null } } }),
    db.overtimeAuthorization.count({ where: {
      revokedAt: null, overtime: { is: null },
      attendance: { workDate, checkOutAt: { not: null }, user: { isActive: true } },
    } }),
    countOvertime(false, true),
    db.overtime.count({ where: { authorization: { attendance: { workDate } }, checkOutAt: { not: null } } }),
    db.attendance.count({ where: { workDate: { lt: workDate }, checkOutAt: null } }),
    countOvertime(false, false),
    db.attendance.findMany({
      where: { workDate, checkOutAt: { not: null } }, take: 8,
      orderBy: [{ checkOutAt: "desc" }, { id: "desc" }],
      select: { ...summarySelect, overtimeAuthorization: { select: {
        revokedAt: true, overtime: { select: { maxOpenMinutes: true, checkInAt: true, checkOutAt: true } },
      } } },
    }),
    db.attendance.findMany({ where: { workDate }, take: 8, orderBy: adminAttendanceOrder, select: summarySelect }),
    // Complete current-date event counts, independent of the eight-row preview.
    db.attendance.findMany({ where: { workDate }, select: { checkInAt: true, checkOutAt: true } }),
    countOvertime(true, true),
    countOvertime(true, false),
  ]);
  return { working, completed, authorized, overtimeInProgress: Number(inProgressRows[0].total), overtimeCompleted, historicalIncomplete,
    openOvertime: Number(openRows[0].total), candidates, recent, activityEvents,
    overtimeIncomplete: Number(incompleteTodayRows[0].total), incompleteOvertime: Number(incompleteRows[0].total) };
}
