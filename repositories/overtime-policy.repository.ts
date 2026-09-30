import "server-only";
import { getPrisma } from "@/lib/db/prisma";
import type { DatabaseTransaction } from "@/lib/db/transaction";

const COMPANY_POLICY_ID = 1;
export function findOvertimePolicy() {
  return getPrisma().overtimePolicy.findUnique({ where: { id: COMPANY_POLICY_ID } });
}
export async function lockOvertimePolicy(tx: DatabaseTransaction) {
  const rows = await tx.$queryRaw<{ id: number; maxOpenMinutes: number }[]>`
    SELECT id, maxOpenMinutes FROM overtimepolicy WHERE id = ${COMPANY_POLICY_ID} FOR UPDATE`;
  return rows[0] ?? null;
}
export function saveOvertimePolicyRecord(maxOpenMinutes: number, tx: DatabaseTransaction) {
  return tx.overtimePolicy.upsert({ where: { id: COMPANY_POLICY_ID },
    create: { id: COMPANY_POLICY_ID, maxOpenMinutes }, update: { maxOpenMinutes } });
}
