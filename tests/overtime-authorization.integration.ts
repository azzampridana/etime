import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { loadEnvConfig } from "@next/env";
import { getPrisma, disconnectDatabase } from "@/lib/db/prisma";
import { createUser, updateUser, setUserActiveStatus } from "@/services/user.service";
import { checkIn, checkOut } from "@/services/attendance.service";
import { saveDailyReport } from "@/services/daily-report.service";
import { grantOvertimeAuthorization as grant, revokeOvertimeAuthorization as revoke, listOvertimeAuthorizations as list } from "@/services/overtime-authorization.service";
import { ApplicationError } from "@/lib/errors/application-error";

loadEnvConfig(process.cwd());
// Tests never call a real geocoder; focused tests inject mocked providers.
process.env.GEOAPIFY_API_KEY = "";
async function main() {
  const db = getPrisma();
  const ids: string[] = [];
  const schedules = [randomUUID(), randomUUID()];
  const marker = `authorization-${randomUUID()}`;
  let stage = "fixtures";
  const counts = async () => Promise.all([db.user.count(), db.workSchedule.count(), db.attendance.count(), db.dailyReport.count(), db.auditLog.count(), db.overtimeAuthorization.count()]);
  async function cleanup() {
    const records = await db.overtimeAuthorization.findMany({ where: { attendance: { userId: { in: ids } } }, select: { id: true } });
    await db.auditLog.deleteMany({ where: { entityId: { in: [...ids, ...records.map((row) => row.id)] } } });
    await db.overtimeAuthorization.deleteMany({ where: { id: { in: records.map((row) => row.id) } } });
    await db.dailyReport.deleteMany({ where: { attendance: { userId: { in: ids } } } });
    await db.attendance.deleteMany({ where: { userId: { in: ids } } });
    await db.user.deleteMany({ where: { id: { in: ids } } });
    await db.workSchedule.deleteMany({ where: { id: { in: schedules } } });
  }
  const rejects = (operation: Promise<unknown>, code: string) => assert.rejects(operation, (error: unknown) => error instanceof ApplicationError && error.code === code);
  try {
    const baseline = await counts();
    for (const [index, id] of schedules.entries()) await db.workSchedule.create({ data: { id, name: `${marker}-${index}`, requiredWorkMinutes: index ? 420 : 480 } });
    async function fixture(role: "ADMIN" | "USER") {
      const user = await createUser({ name: `${marker} ${role}`, email: `${randomUUID()}@example.com`, password: randomUUID(), role, isActive: true, workScheduleId: schedules[0] }, { actorId: null });
      ids.push(user.id); return user;
    }
    const admin = await fixture("ADMIN");
    const otherAdmin = await fixture("ADMIN");
    const worker = await fixture("USER");
    const evidence = { latitude: -6.2, longitude: 106.8, accuracy: 12, timezone: "Asia/Jakarta", description: "Arrival" };
    const first = await checkIn(worker.id, evidence, () => new Date("2026-09-18T16:30:00Z"));
    await saveDailyReport(worker.id, { content: "Historical report\nInspection completed." });
    await checkOut(worker.id, { ...evidence, timezone: "Asia/Makassar", description: "Departure" }, () => new Date("2026-09-19T01:30:00Z"));
    const second = await checkIn(worker.id, evidence, () => new Date("2026-09-20T01:00:00Z"));
    await saveDailyReport(worker.id, { content: "Short shift" });
    await checkOut(worker.id, evidence, () => new Date("2026-09-20T02:00:00Z"));
    const third = await checkIn(otherAdmin.id, evidence, () => new Date("2026-09-20T01:00:00Z"));
    await saveDailyReport(otherAdmin.id, { content: "Admin work" });
    await checkOut(otherAdmin.id, evidence, () => new Date("2026-09-20T02:00:00Z"));
    const open = await checkIn(worker.id, evidence, () => new Date("2026-09-21T01:00:00Z"));
    const original = await db.attendance.findMany({ where: { userId: { in: ids } }, include: { dailyReport: true }, orderBy: { id: "asc" } });
    const range = { from: "2026-09-01", to: "2026-09-30", search: marker };
    stage = "eligibility and authoritative fields";
    await rejects(grant(admin.id, { attendanceId: randomUUID() }), "ATTENDANCE_NOT_FOUND");
    await rejects(grant(admin.id, { attendanceId: open.id }), "ATTENDANCE_OPEN");
    await assert.rejects(grant(admin.id, { attendanceId: "invalid" }));
    for (const field of ["actorId", "grantedById", "userId", "workDate", "grantedAt", "revokedAt"]) {
      await assert.rejects(grant(admin.id, { attendanceId: first.id, [field]: "spoof" }));
      await assert.rejects(revoke(admin.id, { attendanceId: first.id, [field]: "spoof" }));
    }
    stage = "concurrent duplicate grants and server timestamp";
    const beforeGrant = Date.now();
    const granted = await Promise.all([grant(admin.id, { attendanceId: first.id, note: "  Approved  " }), grant(admin.id, { attendanceId: first.id, note: "  Approved  " })]);
    assert.equal(await db.overtimeAuthorization.count({ where: { attendanceId: first.id } }), 1);
    const authorization = granted[0].item.authorization!;
    assert.equal(authorization.note, "Approved"); assert.equal(authorization.grantedBy.id, admin.id);
    assert.ok(Date.parse(authorization.grantedAt) >= beforeGrant && Date.parse(authorization.grantedAt) <= Date.now());
    assert.equal(granted[0].item.workDate, "2026-09-18");
    assert.equal(granted[0].item.authorizationState, "Authorized");
    assert.equal(await db.auditLog.count({ where: { entityId: authorization.id } }), 1);
    await assert.rejects(db.overtimeAuthorization.create({ data: { attendanceId: first.id, grantedById: admin.id, grantedAt: new Date() } }));
    const beforeDuplicate = await db.overtimeAuthorization.findUniqueOrThrow({ where: { id: authorization.id } });
    await grant(otherAdmin.id, { attendanceId: first.id, note: "Must not overwrite" });
    assert.deepEqual(await db.overtimeAuthorization.findUniqueOrThrow({ where: { id: authorization.id } }), beforeDuplicate);
    stage = "revoke, repeated revoke, regrant and audit history";
    const beforeRevoke = Date.now();
    const revoked = await revoke(otherAdmin.id, { attendanceId: first.id });
    assert.ok(Date.parse(revoked.item.authorization!.revokedAt!) >= beforeRevoke);
    const revokedRecord = await db.overtimeAuthorization.findUniqueOrThrow({ where: { id: authorization.id } });
    await revoke(admin.id, { attendanceId: first.id });
    assert.deepEqual(await db.overtimeAuthorization.findUniqueOrThrow({ where: { id: authorization.id } }), revokedRecord);
    assert.equal(await db.auditLog.count({ where: { entityId: authorization.id } }), 2);
    const regranted = await grant(otherAdmin.id, { attendanceId: first.id, note: "  " });
    assert.equal(regranted.item.authorization!.id, authorization.id);
    assert.equal(regranted.item.authorization!.revokedAt, null);
    assert.equal(regranted.item.authorization!.note, null);
    assert.ok(Date.parse(regranted.item.authorization!.grantedAt) > Date.parse(authorization.grantedAt));
    const audits = await db.auditLog.findMany({ where: { entityId: authorization.id }, orderBy: { createdAt: "asc" } });
    assert.deepEqual(audits.map((row) => row.action), ["OVERTIME_AUTHORIZATION_GRANTED", "OVERTIME_AUTHORIZATION_REVOKED", "OVERTIME_AUTHORIZATION_REGRANTED"]);
    assert.deepEqual(audits.map((row) => row.actorId), [admin.id, otherAdmin.id, otherAdmin.id]);
    assert.ok(audits.every((row) => JSON.stringify(row.metadata).includes('"workDate":"2026-09-18"')));
    stage = "filters, ties, pagination, duration independence and admin target";
    assert.equal((await list({ ...range, state: "authorized" })).total, 1);
    assert.equal((await list({ ...range, state: "not-authorized" })).total, 2);
    await grant(admin.id, { attendanceId: second.id }); // Negative difference is eligible.
    await revoke(admin.id, { attendanceId: second.id });
    assert.equal((await list({ ...range, state: "revoked" })).items[0].id, second.id);
    assert.equal((await list({ ...range, userId: worker.id })).total, 2);
    assert.equal((await list({ ...range, from: "2026-09-18", to: "2026-09-18" })).total, 1);
    assert.equal((await list({ ...range, search: worker.email })).total, 2);
    const ordered = [second.id, third.id].sort().reverse().concat(first.id);
    assert.deepEqual((await list(range)).items.map((row) => row.id), ordered);
    assert.equal((await list({ ...range, page: 2, pageSize: 1 })).items[0].id, ordered[1]);
    assert.equal((await list({ ...range, page: 4, pageSize: 1 })).items.length, 0);
    await grant(otherAdmin.id, { attendanceId: third.id }); // Self and ADMIN targets remain valid.
    stage = "grant/revoke race leaves one valid logical record";
    await Promise.all([grant(admin.id, { attendanceId: second.id }), revoke(otherAdmin.id, { attendanceId: second.id })]);
    assert.equal(await db.overtimeAuthorization.count({ where: { attendanceId: second.id } }), 1);
    const raced = await db.overtimeAuthorization.findUniqueOrThrow({ where: { attendanceId: second.id } });
    assert.ok(raced.revokedAt === null || raced.revokedAt >= raced.grantedAt);
    stage = "database-backed actor security and inactive target history";
    await rejects(grant(worker.id, { attendanceId: first.id }), "FORBIDDEN");
    await rejects(revoke(worker.id, { attendanceId: first.id }), "FORBIDDEN");
    await db.user.update({ where: { id: admin.id }, data: { isActive: false } });
    await rejects(grant(admin.id, { attendanceId: first.id }), "UNAUTHENTICATED");
    await rejects(revoke(admin.id, { attendanceId: first.id }), "UNAUTHENTICATED");
    await db.user.update({ where: { id: admin.id }, data: { isActive: true, role: "USER" } });
    await rejects(grant(admin.id, { attendanceId: first.id }), "FORBIDDEN");
    await rejects(revoke(admin.id, { attendanceId: first.id }), "FORBIDDEN");
    await setUserActiveStatus({ id: worker.id, isActive: false }, { actorId: otherAdmin.id });
    await rejects(grant(otherAdmin.id, { attendanceId: first.id }), "USER_INACTIVE");
    assert.equal((await list({ ...range, userId: worker.id })).total, 2);
    await revoke(otherAdmin.id, { attendanceId: first.id }); // Inactive targets can still be revoked.
    stage = "snapshot, safe DTO and immutable regular evidence";
    await updateUser({ id: worker.id, name: worker.name, email: worker.email, role: "USER", workScheduleId: schedules[1], password: undefined }, { actorId: otherAdmin.id });
    const historical = (await list({ ...range, from: "2026-09-18", to: "2026-09-18" })).items[0];
    assert.equal(historical.requiredWorkMinutes, 480); assert.equal(historical.actualDurationMinutes, 540); assert.equal(historical.differenceMinutes, 60);
    assert.equal(historical.workDate, "2026-09-18"); assert.equal(historical.checkOutTimezone, "Asia/Makassar");
    assert.ok(!JSON.stringify(historical).includes("passwordHash"));
    assert.deepEqual(await db.attendance.findMany({ where: { userId: { in: ids } }, include: { dailyReport: true }, orderBy: { id: "asc" } }), original);
    stage = "cleanup";
    await cleanup(); assert.deepEqual(await counts(), baseline);
    console.log("Overtime authorization integration passed: eligibility, spoof rejection, lifecycle/audit, server times, unique/concurrent grants, grant/revoke race, filters/order/pages, inactive history, actor security, snapshots and unchanged evidence.");
  } catch { console.error(`Overtime authorization integration failed during ${stage}. Sensitive details omitted.`); process.exitCode = 1; }
  finally { await cleanup(); await disconnectDatabase(); }
}
void main();
