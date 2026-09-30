import "server-only";
import { Prisma } from "@/generated/prisma/client";
import type { OvertimeActivityQuery } from "@/schemas/admin-overtime-monitoring.schema";
import { getPrisma } from "@/lib/db/prisma";
import type { DatabaseTransaction } from "@/lib/db/transaction";
import type { AdminOvertimeQuery } from "@/schemas/admin-query.schema";

export const overtimeSelect = {
  id: true, authorizationId: true, maxOpenMinutes: true, checkInAt: true, checkInLatitude: true, checkInLongitude: true,
  checkInAccuracy: true, checkInAddress: true, checkInTimezone: true, checkInDescription: true, checkInPhotoPath: true,
  checkOutAt: true, checkOutLatitude: true, checkOutLongitude: true, checkOutAccuracy: true,
  checkOutAddress: true, checkOutTimezone: true, checkOutDescription: true, checkOutPhotoPath: true,
  authorization: { select: { revokedAt: true, attendance: { select: { id: true, userId: true, workDate: true } } } },
} satisfies Prisma.OvertimeSelect;
export type OvertimeRecord = Prisma.OvertimeGetPayload<{ select: typeof overtimeSelect }>;

/** SQL equivalent of the snapshot-based domain comparison; alias o is internal. */
export function overtimeWindowSql(now: Date, incomplete = false) {
  return incomplete
    ? Prisma.sql`o.checkOutAt IS NULL AND TIMESTAMPADD(MINUTE, o.maxOpenMinutes, o.checkInAt) < ${now}`
    : Prisma.sql`o.checkOutAt IS NULL AND TIMESTAMPADD(MINUTE, o.maxOpenMinutes, o.checkInAt) >= ${now}`;
}
/** Without now, reads the latest missing-checkout evidence, including stale records. */
export async function findOpenOvertime(userId: string, tx?: DatabaseTransaction, now?: Date) {
  const db = tx ?? getPrisma();
  if (!now) return db.overtime.findFirst({ where: { checkOutAt: null, authorization: { attendance: { userId } } }, orderBy: [{ checkInAt: "desc" }, { id: "desc" }], select: overtimeSelect });
  const [row] = await db.$queryRaw<{ id: string }[]>(Prisma.sql`
    SELECT o.id FROM overtime o JOIN overtimeauthorization oa ON oa.id = o.authorizationId
    JOIN attendance a ON a.id = oa.attendanceId
    WHERE a.userId = ${userId} AND ${overtimeWindowSql(now)} ORDER BY o.checkInAt DESC, o.id DESC LIMIT 1`);
  return row ? db.overtime.findUnique({ where: { id: row.id }, select: overtimeSelect }) : null;
}
/** Read only the overtime summary belonging to Home's applicable attendance. */
export function findHomeOvertimeAttendance(userId: string, attendanceId: string) {
  return getPrisma().attendance.findFirst({
    where: { id: attendanceId, userId },
    select: {
      checkOutAt: true,
      overtimeAuthorization: { select: {
        revokedAt: true,
        overtime: { select: { maxOpenMinutes: true, checkInAt: true, checkInTimezone: true, checkOutAt: true, checkOutTimezone: true } },
      } },
    },
  });
}
export function findLatestOvertimeAttendance(userId: string, tx?: DatabaseTransaction) {
  return (tx ?? getPrisma()).attendance.findFirst({
    // Event chronology stays meaningful when the worker crosses calendar-date boundaries.
    where: { userId }, orderBy: [{ checkInAt: "desc" }, { id: "desc" }],
    select: { id: true, userId: true, workDate: true, checkOutAt: true,
      overtimeAuthorization: { select: { id: true, revokedAt: true, note: true, overtime: { select: overtimeSelect } } } },
  });
}
export function findOvertimeById(id: string) { return getPrisma().overtime.findUnique({ where: { id }, select: overtimeSelect }); }
export function createOvertime(data: Prisma.OvertimeUncheckedCreateInput & { maxOpenMinutes: number }, tx: DatabaseTransaction) {
  return tx.overtime.create({ data, select: overtimeSelect });
}
type CheckoutData = Pick<Prisma.OvertimeUncheckedUpdateInput, "checkOutAt" | "checkOutLatitude" | "checkOutLongitude" | "checkOutAccuracy" | "checkOutTimezone" | "checkOutDescription" | "checkOutPhotoPath" | "checkOutAddress">;
export function closeOvertime(id: string, data: CheckoutData, tx: DatabaseTransaction) {
  return tx.overtime.update({ where: { id, checkOutAt: null }, data, select: overtimeSelect });
}

const adminOvertimeSelect = {
  ...overtimeSelect,
  authorization: { select: {
    id: true, grantedAt: true, revokedAt: true, note: true,
    attendance: { select: { id: true, userId: true, workDate: true, user: { select: { id: true, name: true, email: true, position: true } } } },
  } },
} satisfies Prisma.OvertimeSelect;
export type AdminOvertimeRecord = Prisma.OvertimeGetPayload<{ select: typeof adminOvertimeSelect }>;

export async function listAdminOvertimeRecords(input: AdminOvertimeQuery, now: Date) {
  const where = overtimeMonitoringWhere(input, now);
  return getPrisma().$transaction(async tx => {
    const [count] = await tx.$queryRaw<{ total: bigint }[]>(Prisma.sql`SELECT COUNT(*) AS total ${monitoringJoins} WHERE ${where}`);
    const ids = await tx.$queryRaw<{ id: string }[]>(Prisma.sql`SELECT o.id ${monitoringJoins} WHERE ${where}
      ORDER BY a.workDate DESC, o.checkInAt DESC, o.id DESC LIMIT ${input.pageSize} OFFSET ${(input.page - 1) * input.pageSize}`);
    const rows = ids.length ? await tx.overtime.findMany({ where: { id: { in: ids.map(row => row.id) } }, select: adminOvertimeSelect }) : [];
    const byId = new Map(rows.map(row => [row.id, row]));
    return { total: Number(count.total), items: ids.map(row => byId.get(row.id)!) };
  }, { isolationLevel: "RepeatableRead" });
}
export function findAdminOvertimeById(id: string) {
  return getPrisma().overtime.findUnique({ where: { id }, select: adminOvertimeSelect });
}

const activityListSelect = {
  id: true, maxOpenMinutes: true, checkInAt: true, checkInTimezone: true, checkOutAt: true, checkOutTimezone: true,
  authorization: { select: { attendance: { select: { workDate: true, user: { select: { name: true, position: true } } } } } },
} satisfies Prisma.OvertimeSelect;

const monitoringJoins = Prisma.sql`FROM overtime o JOIN overtimeauthorization oa ON oa.id = o.authorizationId JOIN attendance a ON a.id = oa.attendanceId JOIN user u ON u.id = a.userId`;
function overtimeMonitoringWhere(input: AdminOvertimeQuery | OvertimeActivityQuery, now: Date) {
  return Prisma.sql`a.workDate >= ${input.from} AND a.workDate <= ${input.to}
    ${input.userId ? Prisma.sql`AND a.userId = ${input.userId}` : Prisma.empty}
    ${input.search ? Prisma.sql`AND (LOCATE(${input.search}, u.name) > 0 OR LOCATE(${input.search}, u.email) > 0)` : Prisma.empty}
    ${input.state === "open" ? Prisma.sql`AND ${overtimeWindowSql(now)}` : input.state === "incomplete" ? Prisma.sql`AND ${overtimeWindowSql(now, true)}` : input.state === "completed" ? Prisma.sql`AND o.checkOutAt IS NOT NULL` : Prisma.empty}`;
}
export async function listOvertimeActivityRecords(input: OvertimeActivityQuery, now: Date) {
  const where = overtimeMonitoringWhere(input, now);
  const columns = {
    employee: Prisma.sql`u.name`, date: Prisma.sql`a.workDate`, checkIn: Prisma.sql`o.checkInAt`, checkOut: Prisma.sql`o.checkOutAt`,
    duration: Prisma.sql`FLOOR(TIMESTAMPDIFF(MICROSECOND, o.checkInAt, o.checkOutAt) / 60000000)`,
    status: Prisma.sql`CASE WHEN o.checkOutAt IS NOT NULL THEN 0 WHEN ${overtimeWindowSql(now)} THEN 1 ELSE 2 END`,
  };
  const direction = input.order === "asc" ? Prisma.sql`ASC` : Prisma.sql`DESC`;
  const order = input.sort && input.order
    ? Prisma.sql`${columns[input.sort]} ${direction}, o.id ${direction}`
    : Prisma.sql`a.workDate DESC, o.checkInAt DESC, o.id DESC`;
  const joins = monitoringJoins;
  // SQL is limited to validated expression ordering and bounded IDs; evidence is
  // never loaded for the list. All URL values remain bound parameters.
  return getPrisma().$transaction(async tx => {
    const [count] = await tx.$queryRaw<{ total: bigint }[]>(Prisma.sql`SELECT COUNT(*) AS total ${joins} WHERE ${where}`);
    const ids = await tx.$queryRaw<{ id: string }[]>(Prisma.sql`SELECT o.id ${joins} WHERE ${where} ORDER BY ${order} LIMIT ${input.pageSize} OFFSET ${(input.page - 1) * input.pageSize}`);
    const rows = ids.length ? await tx.overtime.findMany({ where: { id: { in: ids.map(row => row.id) } }, select: activityListSelect }) : [];
    const byId = new Map(rows.map(row => [row.id, row]));
    return { total: Number(count.total), items: ids.map(row => byId.get(row.id)!) };
  }, { isolationLevel: "RepeatableRead" });
}
