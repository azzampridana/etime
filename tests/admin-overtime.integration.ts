import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { mkdtemp, rm } from "node:fs/promises";
import path from "node:path";
import { tmpdir } from "node:os";
import { loadEnvConfig } from "@next/env";
import { getPrisma, disconnectDatabase } from "@/lib/db/prisma";
import { LocalStorage } from "@/lib/storage/local-storage";
import { listAdminOvertime, getAdminOvertimeDetail, readOvertimePhoto } from "@/services/overtime.service";
import { formatAdminEventTime } from "@/lib/date-time/event-time";
import { ApplicationError } from "@/lib/errors/application-error";
import { createMonitoringFixture } from "./admin-overtime.fixture";

loadEnvConfig(process.cwd());
// Tests never call a real geocoder; focused tests inject mocked providers.
process.env.GEOAPIFY_API_KEY = "";
async function main() {
  const db = getPrisma(), root = await mkdtemp(path.join(tmpdir(), "etime-admin-overtime-")), storage = new LocalStorage(root);
  let fixture: Awaited<ReturnType<typeof createMonitoringFixture>> | undefined;
  const counts = () => Promise.all([db.user.count(), db.attendance.count(), db.dailyReport.count(), db.overtimeAuthorization.count(), db.overtime.count(), db.auditLog.count(), db.workSchedule.count()]);
  const baseline = await counts();
  const rejects = (promise: Promise<unknown>, code: string) => assert.rejects(promise, (error: unknown) => error instanceof ApplicationError && error.code === code);
  try {
    fixture = await createMonitoringFixture(storage);
    const { admin, worker, inactive, other, marker, rows } = fixture;
    const before = await fixture.snapshot();
    const query = { from: "2026-09-01", to: "2026-09-03", search: marker };
    const all = await listAdminOvertime(query);
    const expected = [...rows].sort((a, b) => b.workDate.localeCompare(a.workDate) || b.id.localeCompare(a.id)).map(row => row.id);
    assert.equal(all.total, 6); assert.deepEqual(all.items.map(row => row.id), expected);
    assert.deepEqual((await listAdminOvertime(query)).items, all.items);
    assert.equal((await listAdminOvertime({ ...query, page: 2, pageSize: 2 })).items[0].id, expected[2]);
    assert.equal((await listAdminOvertime({ ...query, page: 99 })).items.length, 0);
    assert.equal((await listAdminOvertime({ ...query, userId: inactive.id })).total, 3);
    assert.equal((await listAdminOvertime({ ...query, search: worker.email })).total, 3);
    assert.equal((await listAdminOvertime({ ...query, from: "2026-09-02", to: "2026-09-02" })).total, 2);
    assert.equal((await listAdminOvertime({ ...query, state: "completed" })).total, 5);
    const opened = (await listAdminOvertime({ ...query, state: "open" })).items[0];
    assert.equal(opened.state, "Open"); assert.equal(opened.durationMinutes, null); assert.equal(opened.checkOut, null);
    assert.equal((await listAdminOvertime({ ...query, userId: inactive.id, state: "open" })).total, 0);
    for (const invalid of [{ page: 0 }, { pageSize: 101 }, { userId: "bad" }, { from: "2026-09-04" }, { state: "approved" }, { from: ["2026-09-01"] }]) await assert.rejects(listAdminOvertime({ ...query, ...invalid }));
    await assert.rejects(getAdminOvertimeDetail("invalid")); await rejects(getAdminOvertimeDetail(randomUUID()), "OVERTIME_NOT_FOUND");
    for (const item of all.items) {
      const detail = await getAdminOvertimeDetail(item.id);
      assert.deepEqual(detail, item); assert.deepEqual(Object.keys(detail.employee).sort(), ["email", "id", "name"]);
      assert.ok(!JSON.stringify(detail).includes("passwordHash")); assert.ok(!JSON.stringify(detail).includes("PhotoPath")); assert.ok(!JSON.stringify(detail).includes(root));
      assert.equal(detail.workDate, rows.find(row => row.id === item.id)!.workDate);
      if (detail.checkOut) assert.equal(detail.durationMinutes, 555);
      assert.match(detail.checkIn.photoUrl, /^\/api\/overtime\//);
    }
    const closed = all.items.find(row => row.employee.id === worker.id && row.workDate === "2026-09-01")!;
    assert.equal(closed.authorizationRevoked, true); assert.ok(closed.authorization.revokedAt);
    assert.match(formatAdminEventTime(closed.checkIn.at, closed.checkIn.timezone), /WIB/);
    assert.match(formatAdminEventTime(closed.checkOut!.at, closed.checkOut!.timezone), /WITA/);
    const foreign = all.items.find(row => row.workDate === "2026-09-02")!;
    assert.match(formatAdminEventTime(foreign.checkIn.at, foreign.checkIn.timezone), /WIT/);
    assert.match(formatAdminEventTime(foreign.checkOut!.at, foreign.checkOut!.timezone), /America\/Los_Angeles/);
    assert.ok((await readOvertimePhoto(admin.id, closed.id, "check-in", storage)).length);
    assert.ok((await readOvertimePhoto(admin.id, closed.id, "check-out", storage)).length);
    assert.ok((await readOvertimePhoto(worker.id, closed.id, "check-in", storage)).length);
    await rejects(readOvertimePhoto(other.id, closed.id, "check-in", storage), "PHOTO_NOT_FOUND");
    await rejects(readOvertimePhoto(inactive.id, closed.id, "check-in", storage), "UNAUTHENTICATED");
    await db.user.update({ where: { id: admin.id }, data: { role: "USER" } });
    await rejects(readOvertimePhoto(admin.id, closed.id, "check-in", storage), "PHOTO_NOT_FOUND");
    await db.user.update({ where: { id: admin.id }, data: { role: "ADMIN", isActive: false } });
    await rejects(readOvertimePhoto(admin.id, closed.id, "check-in", storage), "UNAUTHENTICATED");
    await db.user.update({ where: { id: admin.id }, data: { isActive: true } });
    // A former administrator still retains ordinary ownership rights.
    await db.user.update({ where: { id: worker.id }, data: { role: "ADMIN" } });
    await db.user.update({ where: { id: worker.id }, data: { role: "USER" } });
    assert.ok((await readOvertimePhoto(worker.id, closed.id, "check-in", storage)).length);
    const stored = before.overtime.find(row => row.id === closed.id)!;
    await storage.delete(stored.checkInPhotoPath);
    await assert.rejects(readOvertimePhoto(admin.id, closed.id, "check-in", storage));
    assert.deepEqual(await getAdminOvertimeDetail(closed.id), closed);
    assert.deepEqual(await fixture.snapshot(), before, "Monitoring and photo reads never mutate evidence or audits.");
    await fixture.cleanup(); fixture = undefined; assert.deepEqual(await counts(), baseline);
    console.log("PASS admin overtime: filters, pagination, deterministic ties, details, duration/timezones, history, photo roles, missing files, read-only evidence and cleanup");
  } finally { await fixture?.cleanup(); await rm(root, { recursive: true, force: true }); await disconnectDatabase(); }
}
main().catch(() => { console.error("Admin overtime integration failed."); process.exitCode = 1; });
