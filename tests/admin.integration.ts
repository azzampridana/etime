import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { loadEnvConfig } from "@next/env";
import { getPrisma, disconnectDatabase } from "@/lib/db/prisma";
import { createUser, updateUser, setUserActiveStatus, listUsers } from "@/services/user.service";
import { checkIn, checkOut, listAdminAttendance, getAdminAttendance } from "@/services/attendance.service";
import { saveDailyReport } from "@/services/daily-report.service";
import { ApplicationError } from "@/lib/errors/application-error";

loadEnvConfig(process.cwd());
// Tests never call a real geocoder; focused tests inject mocked providers.
process.env.GEOAPIFY_API_KEY = "";
async function main() {
  const db = getPrisma();
  const ids: string[] = [];
  const scheduleIds = [randomUUID(), randomUUID()];
  const marker = `admin-${randomUUID()}`;
  let stage = "fixtures";
  async function cleanup() {
    await db.dailyReport.deleteMany({ where: { attendance: { userId: { in: ids } } } });
    await db.attendance.deleteMany({ where: { userId: { in: ids } } });
    await db.auditLog.deleteMany({ where: { entityId: { in: ids } } });
    await db.user.deleteMany({ where: { id: { in: ids } } });
    await db.workSchedule.deleteMany({ where: { id: { in: scheduleIds } } });
  }
  try {
    const baseline = { users: await db.user.count(), attendance: await db.attendance.count(), reports: await db.dailyReport.count(), audits: await db.auditLog.count(), schedules: await db.workSchedule.count() };
    for (const [index, id] of scheduleIds.entries()) await db.workSchedule.create({ data: { id, name: `${marker}-${index}`, requiredWorkMinutes: index ? 420 : 480 } });
    const password = `test-${randomUUID()}`;
    async function fixture(role: "ADMIN" | "USER", actorId: string | null) {
      const user = await createUser({ name: `${marker} worker`, email: `${randomUUID()}@example.com`, password, role, isActive: true, workScheduleId: scheduleIds[0] }, { actorId });
      ids.push(user.id); return user;
    }
    const admin = await fixture("ADMIN", null);
    const user = await fixture("USER", admin.id);
    const other = await fixture("USER", admin.id);
    stage = "User create/update, safe conflicts, password preservation, search/pagination, and audit";
    await assert.rejects(createUser({ name: user.name, email: user.email, password, role: "USER", isActive: true, workScheduleId: scheduleIds[0] }, { actorId: admin.id }), (error: unknown) => error instanceof ApplicationError && error.code === "EMAIL_EXISTS");
    const original = await db.user.findUniqueOrThrow({ where: { id: user.id } });
    const updated = await updateUser({ id: user.id, name: `${marker} updated`, email: user.email, role: "USER", workScheduleId: scheduleIds[0], password: undefined }, { actorId: admin.id });
    assert.equal((await db.user.findUniqueOrThrow({ where: { id: user.id } })).passwordHash, original.passwordHash);
    assert.equal("passwordHash" in updated, false);
    assert.equal((await listUsers({ search: marker, page: 1, pageSize: 1 })).items.length, 1);
    assert.equal((await listUsers({ search: marker, role: "USER", page: 1, pageSize: 20 })).total, 2);
    assert.equal((await listUsers({ search: user.email, page: 1, pageSize: 20 })).total, 1);
    stage = "monitoring fixtures through real worker services";
    const evidence = { latitude: -6.2, longitude: 106.8, accuracy: 18, timezone: "Asia/Jakarta" };
    const first = await checkIn(user.id, evidence, () => new Date("2026-09-01T01:00:00Z"));
    await saveDailyReport(user.id, { content: "Inspection\nMaintenance" });
    await checkOut(user.id, { ...evidence, timezone: "Asia/Makassar" }, () => new Date("2026-09-01T10:03:59Z"));
    const second = await checkIn(user.id, { ...evidence, timezone: "Asia/Jayapura" }, () => new Date("2026-09-02T01:00:00Z"));
    await saveDailyReport(user.id, { content: "Second day" });
    await checkOut(user.id, evidence, () => new Date("2026-09-02T08:30:00Z"));
    const open = await checkIn(other.id, { ...evidence, timezone: "America/Los_Angeles" }, () => new Date("2026-09-03T01:00:00Z"));
    const range = { from: "2026-09-01", to: "2026-09-03", search: marker, pageSize: 20 };
    stage = "date/user/state filters, deterministic order, and pagination";
    const all = await listAdminAttendance(range);
    assert.equal(all.total, 3);
    assert.deepEqual(all.items.map((item) => item.id), [open.id, second.id, first.id]);
    assert.equal((await listAdminAttendance({ ...range, from: "2026-09-02", to: "2026-09-02" })).total, 2);
    assert.equal((await listAdminAttendance({ ...range, userId: user.id })).total, 2);
    assert.equal((await listAdminAttendance({ ...range, state: "open" })).items[0].id, open.id);
    assert.equal((await listAdminAttendance({ ...range, state: "completed" })).total, 2);
    assert.equal((await listAdminAttendance({ ...range, page: 2, pageSize: 1 })).items[0].id, second.id);
    assert.deepEqual((await listAdminAttendance(range)).items.map((item) => item.id), all.items.map((item) => item.id));
    stage = "detail DTO, durations, and historical schedule snapshot";
    await updateUser({ id: user.id, name: updated.name, email: user.email, role: "USER", workScheduleId: scheduleIds[1], password: undefined }, { actorId: admin.id });
    const historical = await getAdminAttendance(first.id);
    assert.equal(historical.requiredWorkMinutes, 480);
    assert.equal(historical.actualDurationMinutes, 543);
    assert.equal(historical.differenceMinutes, 63);
    assert.equal(historical.dailyReport?.content, "Inspection\nMaintenance");
    assert.equal(historical.checkInAddress, null);
    assert.equal(historical.checkOutTimezone, "Asia/Makassar");
    assert.deepEqual(Object.keys(historical.employee).sort(), ["email", "id", "name"]);
    assert.equal((await getAdminAttendance(second.id)).differenceMinutes, -30);
    const opened = await getAdminAttendance(open.id);
    assert.equal(opened.actualDurationMinutes, null);
    assert.equal(opened.differenceMinutes, null);
    stage = "deactivation preserves history and open evidence; activation and audit";
    const originalEvidence = await db.attendance.findMany({ where: { userId: { in: [user.id, other.id] } }, orderBy: { id: "asc" } });
    await setUserActiveStatus({ id: user.id, isActive: false }, { actorId: admin.id });
    await setUserActiveStatus({ id: other.id, isActive: false }, { actorId: admin.id });
    assert.equal((await listAdminAttendance(range)).total, 3);
    assert.deepEqual(await db.attendance.findMany({ where: { userId: { in: [user.id, other.id] } }, orderBy: { id: "asc" } }), originalEvidence);
    await setUserActiveStatus({ id: user.id, isActive: true }, { actorId: admin.id });
    const audits = await db.auditLog.findMany({ where: { entityId: user.id } });
    assert.ok(audits.every((audit) => audit.actorId === admin.id));
    for (const action of ["USER_CREATED", "USER_UPDATED", "USER_DEACTIVATED", "USER_ACTIVATED"]) assert.ok(audits.some((audit) => audit.action === action));
    stage = "cleanup";
    await cleanup();
    assert.deepEqual({ users: await db.user.count(), attendance: await db.attendance.count(), reports: await db.dailyReport.count(), audits: await db.auditLog.count(), schedules: await db.workSchedule.count() }, baseline);
    console.log("Admin integration passed: User management/audit, search/pagination, attendance filters/order/details, event zones, historical duration snapshot, inactive history/open evidence, and cleanup.");
  } catch { console.error(`Admin integration failed during ${stage}. Sensitive details omitted.`); process.exitCode = 1; }
  finally { await cleanup(); await disconnectDatabase(); }
}
void main();
