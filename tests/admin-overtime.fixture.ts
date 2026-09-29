import { randomUUID } from "node:crypto";
import sharp from "sharp";
import { getPrisma } from "@/lib/db/prisma";
import type { StorageService } from "@/lib/storage/storage";
import { createUser } from "@/services/user.service";
import { checkIn, checkOut } from "@/services/attendance.service";
import { saveDailyReport } from "@/services/daily-report.service";
import { grantOvertimeAuthorization, revokeOvertimeAuthorization } from "@/services/overtime-authorization.service";
import { overtimeCheckIn, overtimeCheckOut } from "@/services/overtime.service";

/** UUID-scoped fixtures shared by database and production-browser monitoring tests. */
export async function createMonitoringFixture(storage: StorageService) {
  const db = getPrisma(), ids: string[] = [], scheduleId = randomUUID();
  const marker = `monitor-${randomUUID()}`, password = randomUUID();
  async function cleanup() {
    const authorizations = await db.overtimeAuthorization.findMany({ where: { attendance: { userId: { in: ids } } }, select: { id: true } });
    const authorizationIds = authorizations.map(row => row.id);
    const rows = await db.overtime.findMany({ where: { authorizationId: { in: authorizationIds } } });
    for (const row of rows) for (const key of [row.checkInPhotoPath, row.checkOutPhotoPath]) if (key) await storage.delete(key);
    await db.overtime.deleteMany({ where: { authorizationId: { in: authorizationIds } } });
    await db.overtimeAuthorization.deleteMany({ where: { id: { in: authorizationIds } } });
    await db.dailyReport.deleteMany({ where: { attendance: { userId: { in: ids } } } });
    await db.attendance.deleteMany({ where: { userId: { in: ids } } });
    await db.auditLog.deleteMany({ where: { entityId: { in: [...ids, ...authorizationIds] } } });
    await db.user.deleteMany({ where: { id: { in: ids } } });
    await db.workSchedule.deleteMany({ where: { id: scheduleId } });
  }
  async function snapshot() {
    return {
      attendance: await db.attendance.findMany({ where: { userId: { in: ids } }, include: { dailyReport: true }, orderBy: { id: "asc" } }),
      authorizations: await db.overtimeAuthorization.findMany({ where: { attendance: { userId: { in: ids } } }, orderBy: { id: "asc" } }),
      overtime: await db.overtime.findMany({ where: { authorization: { attendance: { userId: { in: ids } } } }, orderBy: { id: "asc" } }),
      audits: await db.auditLog.findMany({ where: { actorId: { in: ids } }, orderBy: { id: "asc" } }),
    };
  }
  try {
    await db.workSchedule.create({ data: { id: scheduleId, name: marker, requiredWorkMinutes: 480 } });
    async function user(label: string, role: "ADMIN" | "USER" = "USER") {
      const row = await createUser({ name: `${marker} ${label}`, position: " Site Engineer ", email: `${randomUUID()}@example.com`, password, role, isActive: true, workScheduleId: scheduleId }, { actorId: null });
      ids.push(row.id); return row;
    }
    const admin = await user("admin", "ADMIN"), worker = await user("worker"), inactive = await user("inactive"), other = await user("other");
    const bytes = await sharp({ create: { width: 600, height: 400, channels: 3, background: "#b7d9dd" } }).jpeg().toBuffer();
    const photo = new File([new Uint8Array(bytes)], "test.jpg", { type: "image/jpeg" });
    const evidence = { latitude: -6.2, longitude: 106.8, accuracy: 12, timezone: "Asia/Jakarta", description: `Recorded monitoring evidence. ${"Detailed evening inspection observations. ".repeat(18)}` };
    const clock = (value: string) => () => new Date(value);
    const rows = [];
    for (const person of [worker, inactive]) for (const day of [1, 2, 3]) {
      const date = `2026-09-0${day}`;
      const regular = await checkIn(person.id, evidence, clock(`${date}T01:00:00Z`));
      await saveDailyReport(person.id, { content: "Historical regular report" });
      await checkOut(person.id, evidence, clock(`${date}T09:00:00Z`));
      await grantOvertimeAuthorization(admin.id, { attendanceId: regular.id, note: "Evening inspection authorization" });
      const opened = await overtimeCheckIn(person.id, { ...evidence, timezone: day === 2 ? "Asia/Jayapura" : "Asia/Jakarta" }, photo, { storage, clock: clock(`${date}T16:00:00Z`) });
      if (day === 1) await revokeOvertimeAuthorization(admin.id, { attendanceId: regular.id });
      if (!(person.id === worker.id && day === 3)) {
        await overtimeCheckOut(person.id, { ...evidence, timezone: day === 2 ? "America/Los_Angeles" : "Asia/Makassar", description: "Finished evening inspection" }, photo, { storage, clock: clock(`2026-09-0${day + 1}T01:15:59Z`) });
      }
      rows.push({ id: opened.id, attendanceId: regular.id, userId: person.id, workDate: date });
    }
    await db.user.update({ where: { id: inactive.id }, data: { isActive: false } });
    return { admin, worker, inactive, other, rows, marker, password, snapshot, cleanup };
  } catch (error) { await cleanup(); throw error; }
}
