import "server-only";

import { Role } from "@/generated/prisma/enums";
import { hashPassword } from "@/lib/auth/password";
import { isUniqueConstraintError } from "@/lib/db/persistence-error";
import { inTransaction } from "@/lib/db/transaction";
import { ApplicationError } from "@/lib/errors/application-error";
import { createAuditRecord } from "@/repositories/audit.repository";
import { createUserRecord, findUserByEmail } from "@/repositories/user.repository";
import { ensureWorkScheduleRecord, findWorkScheduleById } from "@/repositories/work-schedule.repository";
import { seedEnvironmentSchema } from "@/schemas/seed.schema";

export const DEFAULT_WORK_SCHEDULE_NAME = "Standard 8 Hours";

export async function seedInitialAdmin(environment: unknown): Promise<void> {
  const input = seedEnvironmentSchema.parse(environment);
  // Retry a competing seed's unique insert once. Existing records are never overwritten.
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const existing = await findUserByEmail(input.SEED_ADMIN_EMAIL);
      const passwordHash = existing ? undefined : await hashPassword(input.SEED_ADMIN_PASSWORD);
      await inTransaction(async (tx) => {
        const schedule = existing ? await findWorkScheduleById(existing.workScheduleId, tx) : await ensureWorkScheduleRecord({
          name: DEFAULT_WORK_SCHEDULE_NAME,
          requiredWorkMinutes: 480, isActive: true,
        }, tx);
        if (!schedule) throw new ApplicationError("SEED_CONFLICT", "Existing bootstrap schedule needs administrator review.");
        const admin = await findUserByEmail(input.SEED_ADMIN_EMAIL, tx);
        if (admin) {
          if (admin.role !== Role.ADMIN || !admin.isActive || admin.workScheduleId !== schedule.id || !schedule.isActive) {
            throw new ApplicationError("SEED_CONFLICT", "Existing bootstrap records need administrator review; no records were overwritten.");
          }
          return;
        }
        if (!schedule.isActive || !passwordHash) {
          throw new ApplicationError("SEED_CONFLICT", "Bootstrap records changed; retry after administrator review.");
        }
        const user = await createUserRecord({
          name: input.SEED_ADMIN_NAME, email: input.SEED_ADMIN_EMAIL, passwordHash,
          role: Role.ADMIN, isActive: true, workScheduleId: schedule.id,
        }, tx);
        await createAuditRecord({
          actorId: null, action: "USER_CREATED", entityType: "User", entityId: user.id,
          metadata: { source: "bootstrap", role: Role.ADMIN, workScheduleId: schedule.id },
        }, tx);
      });
      return;
    } catch (error) {
      if (attempt === 0 && isUniqueConstraintError(error)) continue;
      throw error;
    }
  }
}
