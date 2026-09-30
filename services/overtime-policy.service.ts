import "server-only";
import { DEFAULT_OVERTIME_MAX_OPEN_MINUTES } from "@/lib/overtime/state";
import { overtimePolicySchema } from "@/schemas/overtime-policy.schema";
import { findOvertimePolicy, lockOvertimePolicy, saveOvertimePolicyRecord } from "@/repositories/overtime-policy.repository";
import { createAuditRecord } from "@/repositories/audit.repository";
import { inTransaction, type DatabaseTransaction } from "@/lib/db/transaction";
import { lockActiveAttendanceUser } from "@/services/attendance-context";
import { assertAdmin } from "@/lib/authorization/policy";

export async function getOvertimePolicyMinutes() {
  return (await findOvertimePolicy())?.maxOpenMinutes ?? DEFAULT_OVERTIME_MAX_OPEN_MINUTES;
}
/** Called inside the successful check-in transaction; serialized against policy edits. */
export async function snapshotOvertimePolicy(tx: DatabaseTransaction) {
  return (await lockOvertimePolicy(tx))?.maxOpenMinutes ?? DEFAULT_OVERTIME_MAX_OPEN_MINUTES;
}
export async function saveOvertimePolicy(raw: unknown, actorId: string) {
  const { maxOpenMinutes } = overtimePolicySchema.parse(raw);
  await inTransaction(async tx => {
    const actor = await lockActiveAttendanceUser(actorId, tx);
    assertAdmin(actor);
    const previous = await snapshotOvertimePolicy(tx);
    const policy = await saveOvertimePolicyRecord(maxOpenMinutes, tx);
    await createAuditRecord({ actorId, action: "OVERTIME_POLICY_UPDATED", entityType: "OvertimePolicy", entityId: String(policy.id),
      metadata: { previousMaxOpenMinutes: previous, maxOpenMinutes } }, tx);
  });
}
