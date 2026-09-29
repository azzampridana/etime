import { loadEnvConfig } from "@next/env";
import { verifyPassword } from "@/lib/auth/password";
import { disconnectDatabase, getPrisma } from "@/lib/db/prisma";
import { seedEnvironmentSchema } from "@/schemas/seed.schema";
import { DEFAULT_WORK_SCHEDULE_NAME } from "@/services/bootstrap.service";

// Read-only infrastructure verification. Outputs booleans, never records or credentials.
async function main() {
  loadEnvConfig(process.cwd());
  try {
    const environment = seedEnvironmentSchema.parse(process.env);
    const db = getPrisma();
    const admin = await db.user.findUnique({ where: { email: environment.SEED_ADMIN_EMAIL } });
    const schedule = await db.workSchedule.findUnique({ where: admin ? { id: admin.workScheduleId } : { name: DEFAULT_WORK_SCHEDULE_NAME } });
    const checks = {
      defaultScheduleExists: !!schedule,
      defaultScheduleCorrect: schedule?.requiredWorkMinutes === 480 && schedule.isActive,
      adminExists: !!admin,
      adminRoleCorrect: admin?.role === "ADMIN",
      adminActive: admin?.isActive === true,
      adminScheduleCorrect: !!schedule && admin?.workScheduleId === schedule.id,
      bcryptHashStored: !!admin && /^\$2[ab]\$12\$/.test(admin.passwordHash),
      plaintextNotStored: !!admin && admin.passwordHash !== environment.SEED_ADMIN_PASSWORD,
      seedPasswordVerifies: !!admin && await verifyPassword(environment.SEED_ADMIN_PASSWORD, admin.passwordHash),
      uniqueSchedule: await db.workSchedule.count({ where: { id: schedule?.id ?? "missing" } }) === 1,
      uniqueAdmin: await db.user.count({ where: { email: environment.SEED_ADMIN_EMAIL } }) === 1,
      auditSchemaAccessible: (await db.auditLog.count()) >= 0,
      bootstrapAuditExists: !!admin && (await db.auditLog.count({ where: { entityId: admin.id, action: "USER_CREATED", actorId: null } })) === 1,
    };
    console.log(JSON.stringify(checks, null, 2));
    if (Object.values(checks).some((passed) => !passed)) process.exitCode = 1;
  } catch {
    console.error("Read-only database verification failed. No credentials or records were logged.");
    process.exitCode = 1;
  } finally {
    await disconnectDatabase();
  }
}

void main();
