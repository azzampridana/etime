import "server-only";
import { Prisma } from "@/generated/prisma/client";
import type { OvertimeAuthorizationMonitoringQuery } from "@/schemas/admin-overtime-monitoring.schema";
import { getPrisma } from "@/lib/db/prisma";
import type { DatabaseTransaction } from "@/lib/db/transaction";
import { adminAttendanceSelect } from "@/repositories/attendance.repository";
import type { AdminOvertimeAuthorizationQuery } from "@/schemas/admin-query.schema";

const authorizationSelect = {
  id: true, attendanceId: true, grantedAt: true, revokedAt: true, note: true,
  grantedBy: { select: { id: true, name: true, email: true } },
} satisfies Prisma.OvertimeAuthorizationSelect;
const workspaceSelect = { ...adminAttendanceSelect, overtimeAuthorization: { select: authorizationSelect } } satisfies Prisma.AttendanceSelect;
export type AuthorizationAttendanceRecord = Prisma.AttendanceGetPayload<{ select: typeof workspaceSelect }>;

/** Serialize transitions on the existing parent even before an authorization row exists. */
export async function lockAuthorizationAttendance(attendanceId: string, tx: DatabaseTransaction) {
  await tx.$queryRaw`SELECT id FROM Attendance WHERE id = ${attendanceId} FOR UPDATE`;
}
export function findAuthorizationAttendance(attendanceId: string, tx?: DatabaseTransaction) {
  return (tx ?? getPrisma()).attendance.findUnique({ where: { id: attendanceId }, select: workspaceSelect });
}
export function saveAuthorizationGrant(attendanceId: string, grantedById: string, grantedAt: Date, note: string | null, tx: DatabaseTransaction) {
  return tx.overtimeAuthorization.upsert({
    where: { attendanceId },
    create: { attendanceId, grantedById, grantedAt, note },
    update: { grantedById, grantedAt, note, revokedAt: null },
    select: authorizationSelect,
  });
}
export function saveAuthorizationRevoke(attendanceId: string, revokedAt: Date, tx: DatabaseTransaction) {
  return tx.overtimeAuthorization.update({ where: { attendanceId }, data: { revokedAt }, select: authorizationSelect });
}
export async function listAuthorizationAttendanceRecords(input: AdminOvertimeAuthorizationQuery) {
  const where: Prisma.AttendanceWhereInput = {
    checkOutAt: { not: null },
    workDate: { gte: new Date(`${input.from}T00:00:00.000Z`), lte: new Date(`${input.to}T00:00:00.000Z`) },
    userId: input.userId,
    ...(input.search ? { user: { OR: [{ name: { contains: input.search } }, { email: { contains: input.search } }] } } : {}),
    ...(input.state === "not-authorized" ? { overtimeAuthorization: { is: null } }
      : input.state === "authorized" ? { overtimeAuthorization: { is: { revokedAt: null } } }
        : input.state === "revoked" ? { overtimeAuthorization: { is: { revokedAt: { not: null } } } } : {}),
  };
  const db = getPrisma();
  const [items, total] = await db.$transaction([
    db.attendance.findMany({ where, select: workspaceSelect, orderBy: [{ workDate: "desc" }, { checkInAt: "desc" }, { id: "desc" }], skip: (input.page - 1) * input.pageSize, take: input.pageSize }),
    db.attendance.count({ where }),
  ]);
  return { items, total };
}

const authorizationListSelect = {
  id: true, workDate: true, checkOutAt: true,
  user: { select: { name: true, position: true, isActive: true } },
  overtimeAuthorization: { select: { revokedAt: true, note: true, overtime: { select: { id: true } } } },
} satisfies Prisma.AttendanceSelect;

export async function listAuthorizationMonitoringRecords(input: OvertimeAuthorizationMonitoringQuery) {
  // Activity Started takes precedence; revokedAt remains separately visible.
  const state = Prisma.sql`CASE WHEN o.id IS NOT NULL THEN 'Activity Started' WHEN oa.id IS NULL THEN 'Not Authorized' WHEN oa.revokedAt IS NOT NULL THEN 'Revoked' ELSE 'Authorized' END`;
  const labels = { used: "Activity Started", "not-authorized": "Not Authorized", revoked: "Revoked", authorized: "Authorized" };
  const where = Prisma.sql`a.checkOutAt IS NOT NULL AND a.workDate >= ${input.from} AND a.workDate <= ${input.to}
    ${input.userId ? Prisma.sql`AND a.userId = ${input.userId}` : Prisma.empty}
    ${input.search ? Prisma.sql`AND (LOCATE(${input.search}, u.name) > 0 OR LOCATE(${input.search}, u.email) > 0)` : Prisma.empty}
    ${input.state !== "all" ? Prisma.sql`AND (${state}) = ${labels[input.state]}` : Prisma.empty}`;
  const columns = { employee: Prisma.sql`u.name`, date: Prisma.sql`a.workDate`, status: state };
  const direction = input.order === "asc" ? Prisma.sql`ASC` : Prisma.sql`DESC`;
  const order = input.sort && input.order ? Prisma.sql`${columns[input.sort]} ${direction}, a.id ${direction}` : Prisma.sql`a.workDate DESC, a.checkInAt DESC, a.id DESC`;
  const joins = Prisma.sql`FROM Attendance a JOIN User u ON u.id = a.userId LEFT JOIN OvertimeAuthorization oa ON oa.attendanceId = a.id LEFT JOIN Overtime o ON o.authorizationId = oa.id`;
  return getPrisma().$transaction(async tx => {
    const [count] = await tx.$queryRaw<{ total: bigint }[]>(Prisma.sql`SELECT COUNT(*) AS total ${joins} WHERE ${where}`);
    const ids = await tx.$queryRaw<{ id: string }[]>(Prisma.sql`SELECT a.id ${joins} WHERE ${where} ORDER BY ${order} LIMIT ${input.pageSize} OFFSET ${(input.page - 1) * input.pageSize}`);
    const rows = ids.length ? await tx.attendance.findMany({ where: { id: { in: ids.map(row => row.id) } }, select: authorizationListSelect }) : [];
    const byId = new Map(rows.map(row => [row.id, row]));
    return { total: Number(count.total), items: ids.map(row => byId.get(row.id)!) };
  }, { isolationLevel: "RepeatableRead" });
}
