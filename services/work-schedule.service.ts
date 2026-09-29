import "server-only";

import { listActiveWorkScheduleRecords } from "@/repositories/work-schedule.repository";
import type { WorkScheduleOption } from "@/types/work-schedule";
import { listWorkScheduleRecords, saveWorkScheduleRecord } from "@/repositories/work-schedule.repository";
import { workScheduleSchema } from "@/schemas/work-schedule.schema";
import { inTransaction } from "@/lib/db/transaction";
import { isUniqueConstraintError } from "@/lib/db/persistence-error";
import { ApplicationError } from "@/lib/errors/application-error";
import { createAuditRecord } from "@/repositories/audit.repository";

export function listActiveWorkSchedules(): Promise<WorkScheduleOption[]> {
  return listActiveWorkScheduleRecords();
}

export async function listWorkSchedules() {
  return (await listWorkScheduleRecords()).map(({ id, name, requiredWorkMinutes, isActive }) => ({ id, name, requiredWorkMinutes, isActive }));
}
export async function saveWorkSchedule(raw: unknown, actorId: string) {
  const input = workScheduleSchema.parse(raw);
  try {
    await inTransaction(async tx => {
      const row = await saveWorkScheduleRecord(input, tx);
      await createAuditRecord({ actorId, action: input.id ? "WORK_SCHEDULE_UPDATED" : "WORK_SCHEDULE_CREATED", entityType: "WorkSchedule", entityId: row.id,
        metadata: { name: row.name, requiredWorkMinutes: row.requiredWorkMinutes, isActive: row.isActive } }, tx);
    });
  } catch (error) {
    if (isUniqueConstraintError(error)) throw new ApplicationError("SCHEDULE_NAME_EXISTS", "A duration policy with this name already exists.");
    throw error;
  }
}
