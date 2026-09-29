import "server-only";

import type { Prisma } from "@/generated/prisma/client";
import { getPrisma } from "@/lib/db/prisma";
import type { DatabaseTransaction } from "@/lib/db/transaction";
import type { ListUsersInput } from "@/schemas/user.schema";

const userSelect = {
  id: true, name: true, position: true, email: true, role: true, isActive: true,
  workScheduleId: true, createdAt: true, updatedAt: true,
  workSchedule: {
    select: { id: true, name: true, requiredWorkMinutes: true, isActive: true },
  },
} satisfies Prisma.UserSelect;

export type UserRecord = Prisma.UserGetPayload<{ select: typeof userSelect }>;

const identitySelect = { id: true, name: true, email: true, role: true, isActive: true } satisfies Prisma.UserSelect;

// Password hash is selected only for the server-side credentials check.
export function findUserCredentialsByEmail(email: string) {
  return getPrisma().user.findUnique({ where: { email }, select: { ...identitySelect, passwordHash: true } });
}

export function findUserIdentityById(id: string) {
  return getPrisma().user.findUnique({ where: { id }, select: identitySelect });
}

export function findUserById(id: string, tx?: DatabaseTransaction) {
  return (tx ?? getPrisma()).user.findUnique({ where: { id }, select: userSelect });
}

export function findUserByEmail(email: string, tx?: DatabaseTransaction) {
  return (tx ?? getPrisma()).user.findUnique({ where: { email }, select: userSelect });
}

export function createUserRecord(data: Prisma.UserUncheckedCreateInput, tx: DatabaseTransaction) {
  return tx.user.create({ data, select: userSelect });
}

export function updateUserRecord(id: string, data: Prisma.UserUncheckedUpdateInput, tx: DatabaseTransaction) {
  return tx.user.update({ where: { id }, data, select: userSelect });
}

export function setUserActiveStatusRecord(id: string, isActive: boolean, tx: DatabaseTransaction) {
  return tx.user.update({ where: { id }, data: { isActive }, select: userSelect });
}

export async function findUserDeletionDependencies(id: string, tx: DatabaseTransaction) {
  const attendance = await tx.attendance.findFirst({ where: { userId: id }, select: { id: true } });
  const grant = await tx.overtimeAuthorization.findFirst({ where: { grantedById: id }, select: { id: true } });
  return { attendance, grant };
}

export function deleteUserRecord(id: string, tx: DatabaseTransaction) {
  return tx.user.delete({ where: { id }, select: { id: true } });
}

export async function listUserRecords(input: ListUsersInput) {
  // Explicit whitelist: URL field names are never used as computed Prisma keys.
  let orderBy: Prisma.UserOrderByWithRelationInput[] = [{ createdAt: "desc" }, { id: "desc" }];
  if (input.sort && input.order) {
    const order = input.order;
    const columns = {
      name: { name: order }, email: { email: order },
      position: { position: order }, status: { isActive: order },
    } satisfies Record<NonNullable<ListUsersInput["sort"]>, Prisma.UserOrderByWithRelationInput>;
    // MariaDB's native nullable ordering is retained; ID resolves equal/null values.
    orderBy = [columns[input.sort], { id: "desc" }];
  }
  const where: Prisma.UserWhereInput = {
    role: input.role,
    isActive: input.isActive,
    ...(input.search ? { OR: [{ name: { contains: input.search } }, { email: { contains: input.search } }] } : {}),
  };
  const [items, total] = await getPrisma().$transaction([
    getPrisma().user.findMany({
      where, select: userSelect, skip: (input.page - 1) * input.pageSize,
      take: input.pageSize, orderBy,
    }),
    getPrisma().user.count({ where }),
  ]);
  return { items, total };
}
