import "server-only";

import { Prisma } from "@/generated/prisma/client";
import { getPrisma } from "@/lib/db/prisma";
import type { DatabaseTransaction } from "@/lib/db/transaction";
import { dailyReportSelect } from "@/repositories/daily-report.repository";
import type { AdminAttendanceQuery, AdminAttendanceMonitoringQuery } from "@/schemas/admin-query.schema";

const attendanceSelect = {
  id: true, workDate: true, requiredWorkMinutes: true, checkInAt: true,
  checkInLatitude: true, checkInLongitude: true, checkInAccuracy: true,
  checkInAddress: true, checkInTimezone: true, checkInDescription: true, checkOutAt: true,
  checkOutLatitude: true, checkOutLongitude: true, checkOutAccuracy: true,
  checkOutAddress: true, checkOutTimezone: true, checkOutDescription: true,
  dailyReport: { select: dailyReportSelect },
} satisfies Prisma.AttendanceSelect;

export type AttendanceRecord = Prisma.AttendanceGetPayload<{ select: typeof attendanceSelect }>;

/** All attendance/report mutations lock the parent first, before any consistent reads. */
export async function lockAttendanceUser(userId: string, tx: DatabaseTransaction) {
  await tx.$queryRaw`SELECT id FROM user WHERE id = ${userId} FOR UPDATE`;
}

export function findOpenAttendanceByUser(userId: string, tx?: DatabaseTransaction) {
  return (tx ?? getPrisma()).attendance.findFirst({
    where: { userId, checkOutAt: null }, orderBy: { checkInAt: "desc" }, select: attendanceSelect,
  });
}

export function findAttendanceByUserAndWorkDate(userId: string, workDate: Date, tx?: DatabaseTransaction) {
  return (tx ?? getPrisma()).attendance.findUnique({ where: { userId_workDate: { userId, workDate } }, select: attendanceSelect });
}

export function findAttendanceByOwner(id: string, userId: string, tx?: DatabaseTransaction) {
  return (tx ?? getPrisma()).attendance.findFirst({ where: { id, userId }, select: attendanceSelect });
}

export async function listAttendanceHistory(userId: string, before: Date, page: number, pageSize: number) {
  const db = getPrisma();
  const where = { userId, workDate: { lt: before } };
  const [items, total] = await db.$transaction([
    db.attendance.findMany({ where, select: attendanceSelect, orderBy: [{ workDate: "desc" }, { checkInAt: "desc" }, { id: "desc" }], skip: (page - 1) * pageSize, take: pageSize }),
    db.attendance.count({ where }),
  ]);
  return { items, total };
}

export function createAttendanceRecord(data: Prisma.AttendanceUncheckedCreateInput, tx: DatabaseTransaction) {
  return tx.attendance.create({ data, select: attendanceSelect });
}

export function findLatestCompletedAttendanceByUser(userId: string) {
  return getPrisma().attendance.findFirst({
    where: { userId, checkOutAt: { not: null } }, orderBy: [{ checkInAt: "desc" }, { id: "desc" }], select: attendanceSelect,
  });
}

type CheckoutData = Required<Pick<Prisma.AttendanceUncheckedUpdateInput,
  "checkOutAt" | "checkOutLatitude" | "checkOutLongitude" | "checkOutAccuracy" | "checkOutTimezone" | "checkOutDescription" | "checkOutAddress">>;

export function closeAttendanceRecord(id: string, data: CheckoutData, tx: DatabaseTransaction) {
  // Guard the transition as well as holding the parent lock; never overwrite closed evidence.
  return tx.attendance.update({ where: { id, checkOutAt: null }, data, select: attendanceSelect });
}

export const adminAttendanceSelect = {
  ...attendanceSelect, user: { select: { id: true, name: true, email: true } },
} satisfies Prisma.AttendanceSelect;
export type AdminAttendanceRecord = Prisma.AttendanceGetPayload<{ select: typeof adminAttendanceSelect }>;

export const adminAttendanceOrder = [{ workDate: "desc" }, { checkInAt: "desc" }, { id: "desc" }] satisfies Prisma.AttendanceOrderByWithRelationInput[];

export function adminAttendanceWhere(input: AdminAttendanceQuery): Prisma.AttendanceWhereInput {
  return {
    workDate: { gte: new Date(`${input.from}T00:00:00.000Z`), lte: new Date(`${input.to}T00:00:00.000Z`) },
    userId: input.userId,
    ...(input.state === "open" ? { checkOutAt: null } : input.state === "completed" ? { checkOutAt: { not: null } } : {}),
    ...(input.search ? { user: { OR: [{ name: { contains: input.search } }, { email: { contains: input.search } }] } } : {}),
  };
}

const monitoringSelect = {
  id: true, workDate: true, checkInAt: true, checkInTimezone: true,
  checkOutAt: true, checkOutTimezone: true,
  user: { select: { name: true, position: true } },
} satisfies Prisma.AttendanceSelect;

// The service supplies ordered, disjoint state predicates. Count groups before
// applying offset/limit so derived-state sorting covers the entire result set.
export async function listAdminAttendanceRecords(input: AdminAttendanceMonitoringQuery, groups: Prisma.AttendanceWhereInput[]) {
  // Monitoring resolves plain-text search separately; shared Reports filters stay unchanged.
  const base = adminAttendanceWhere({ ...input, state: "all", search: undefined });
  const search = input.search?.trim();
  const order: Prisma.AttendanceOrderByWithRelationInput[] = !input.sort || !input.order || input.sort === "status"
    ? adminAttendanceOrder
    : [input.sort === "employee" ? { user: { name: input.order } }
      : input.sort === "date" ? { workDate: input.order }
      : input.sort === "checkIn" ? { checkInAt: input.order } : { checkOutAt: input.order }, { id: input.order }];
  return getPrisma().$transaction(async tx => {
    const searchRestriction: Prisma.AttendanceWhereInput[] = [];
    if (search) {
      // Same parameterized LOCATE pattern as Overtime; select only matching owner IDs.
      const users = await tx.$queryRaw<{ id: string }[]>(Prisma.sql`
        SELECT u.id FROM user u
        WHERE (LOCATE(${search}, u.name) > 0 OR LOCATE(${search}, u.email) > 0)
        ${input.userId ? Prisma.sql`AND u.id = ${input.userId}` : Prisma.empty}`);
      if (!users.length) return { items: [], total: 0 };
      searchRestriction.push({ userId: { in: users.map(user => user.id) } });
    }
    const predicates = groups.map(group => ({ AND: [base, group, ...searchRestriction] }));
    const counts = await Promise.all(predicates.map(where => tx.attendance.count({ where })));
    let skip = (input.page - 1) * input.pageSize;
    const items: Prisma.AttendanceGetPayload<{ select: typeof monitoringSelect }>[] = [];
    for (let index = 0; index < predicates.length && items.length < input.pageSize; index++) {
      if (skip >= counts[index]) { skip -= counts[index]; continue; }
      items.push(...await tx.attendance.findMany({ where: predicates[index], select: monitoringSelect,
        orderBy: order, skip, take: input.pageSize - items.length }));
      skip = 0;
    }
    return { items, total: counts.reduce((sum, count) => sum + count, 0) };
  }, { isolationLevel: "RepeatableRead" });
}

export function findAdminAttendanceById(id: string) {
  return getPrisma().attendance.findUnique({ where: { id }, select: {
    ...adminAttendanceSelect, user: { select: { id: true, name: true, email: true, position: true } },
  } });
}
