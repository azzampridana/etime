import "server-only";

import type { Prisma } from "@/generated/prisma/client";
import { getPrisma } from "@/lib/db/prisma";
import type { DatabaseTransaction } from "@/lib/db/transaction";

export function findWorkScheduleById(id: string, tx?: DatabaseTransaction) {
  return (tx ?? getPrisma()).workSchedule.findUnique({ where: { id } });
}

export function ensureWorkScheduleRecord(data: Prisma.WorkScheduleCreateInput, tx: DatabaseTransaction) {
  return tx.workSchedule.upsert({ where: { name: data.name }, create: data, update: {} });
}

export function listActiveWorkScheduleRecords() {
  return getPrisma().workSchedule.findMany({
    where: { isActive: true }, orderBy: [{ name: "asc" }, { id: "asc" }], take: 100,
    select: { id: true, name: true, requiredWorkMinutes: true },
  });
}

export function listWorkScheduleRecords() {
  return getPrisma().workSchedule.findMany({ orderBy: [{ name: "asc" }, { id: "asc" }], take: 100 });
}
export function saveWorkScheduleRecord(input: { id?: string; name: string; requiredWorkMinutes: number; isActive: boolean }, tx: DatabaseTransaction) {
  const { id, ...data } = input;
  return id ? tx.workSchedule.update({ where: { id }, data }) : tx.workSchedule.create({ data });
}
