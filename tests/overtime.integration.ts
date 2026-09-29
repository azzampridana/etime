import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { mkdtemp, rm, readdir } from "node:fs/promises";
import path from "node:path";
import { tmpdir } from "node:os";
import sharp from "sharp";
import { loadEnvConfig } from "@next/env";
import { getPrisma, disconnectDatabase } from "@/lib/db/prisma";
import { inTransaction } from "@/lib/db/transaction";
import { LocalStorage } from "@/lib/storage/local-storage";
import type { StorageService } from "@/lib/storage/storage";
import { createUser } from "@/services/user.service";
import { checkIn, checkOut } from "@/services/attendance.service";
import { saveDailyReport } from "@/services/daily-report.service";
import { grantOvertimeAuthorization as grant, revokeOvertimeAuthorization as revoke } from "@/services/overtime-authorization.service";
import { overtimeCheckIn as start, overtimeCheckOut as finish, getOvertimePage, readOvertimePhoto } from "@/services/overtime.service";
import { ApplicationError } from "@/lib/errors/application-error";

loadEnvConfig(process.cwd());
// Tests never call a real geocoder; focused tests inject mocked providers.
process.env.GEOAPIFY_API_KEY = "";
async function main() {
  const db = getPrisma(), ids: string[] = [], scheduleId = randomUUID();
  const root = await mkdtemp(path.join(tmpdir(), "etime-overtime-test-"));
  const storage = new LocalStorage(root);
  let stage = "fixtures";
  const fileCount = async () => (await readdir(root, { recursive: true })).filter(name => name.endsWith(".jpg") || name.endsWith(".tmp")).length;
  const counts = () => Promise.all([db.user.count(), db.attendance.count(), db.dailyReport.count(), db.overtimeAuthorization.count(), db.overtime.count(), db.auditLog.count(), db.workSchedule.count()]);
  async function cleanup() {
    const authorizations = await db.overtimeAuthorization.findMany({ where: { attendance: { userId: { in: ids } } }, select: { id: true } });
    const authorizationIds = authorizations.map(row => row.id);
    await db.overtime.deleteMany({ where: { authorizationId: { in: authorizationIds } } });
    await db.overtimeAuthorization.deleteMany({ where: { id: { in: authorizationIds } } });
    await db.dailyReport.deleteMany({ where: { attendance: { userId: { in: ids } } } });
    await db.attendance.deleteMany({ where: { userId: { in: ids } } });
    await db.auditLog.deleteMany({ where: { entityId: { in: [...ids, ...authorizationIds] } } });
    await db.user.deleteMany({ where: { id: { in: ids } } });
    await db.workSchedule.deleteMany({ where: { id: scheduleId } });
  }
  const rejects = (promise: Promise<unknown>, code: string) => assert.rejects(promise, (error: unknown) => error instanceof ApplicationError && error.code === code);
  const evidence = { latitude: -6.2, longitude: 106.8, accuracy: 12, timezone: "Asia/Jakarta", description: "  Extra inspection  " };
  const clock = (iso: string) => () => new Date(iso);
  const failTransaction: typeof inTransaction = async () => { throw new Error("Injected transaction failure"); };
  function concurrentStorage(): StorageService {
    let arrivals = 0; let release!: () => void;
    const gate = new Promise<void>(resolve => { release = resolve; });
    return { read: key => storage.read(key), delete: key => storage.delete(key), upload: async (key, bytes) => {
      await storage.upload(key, bytes); if (++arrivals === 2) release(); await gate;
    } };
  }
  try {
    const baseline = await counts();
    await db.workSchedule.create({ data: { id: scheduleId, name: `overtime-${scheduleId}`, requiredWorkMinutes: 480 } });
    async function user(role: "USER" | "ADMIN") {
      const record = await createUser({ name: "Overtime test", email: `${randomUUID()}@example.com`, password: randomUUID(), role, isActive: true, workScheduleId: scheduleId }, { actorId: null });
      ids.push(record.id); return record;
    }
    const admin = await user("ADMIN"), worker = await user("USER"), other = await user("USER");
    const jpeg = await sharp({ create: { width: 600, height: 400, channels: 3, background: "white" } }).jpeg().toBuffer();
    const photo = new File([new Uint8Array(jpeg)], "../../untrusted.exe", { type: "application/octet-stream" });
    const deps = { storage, clock: clock("2026-09-01T16:00:00Z") };
    async function regular(day: string, complete = true) {
      const row = await checkIn(worker.id, evidence, clock(`${day}T01:00:00Z`));
      if (complete) { await saveDailyReport(worker.id, { content: "Unchanged regular report" }); await checkOut(worker.id, evidence, clock(`${day}T09:00:00Z`)); }
      return row;
    }
    stage = "eligibility, invalid image and storage failures";
    assert.equal((await getOvertimePage(worker.id)).state, "unavailable");
    await rejects(start(worker.id, evidence, photo, deps), "ATTENDANCE_INCOMPLETE");
    const first = await regular("2026-09-01", false);
    await rejects(start(worker.id, evidence, photo, deps), "ATTENDANCE_INCOMPLETE");
    await saveDailyReport(worker.id, { content: "Unchanged regular report" }); await checkOut(worker.id, evidence, clock("2026-09-01T09:00:00Z"));
    await rejects(start(worker.id, evidence, photo, deps), "NO_AUTHORIZATION");
    await grant(admin.id, { attendanceId: first.id });
    assert.equal((await getOvertimePage(worker.id)).state, "authorized");
    await assert.rejects(start(worker.id, evidence, undefined, deps));
    await rejects(start(worker.id, evidence, new File(["corrupt"], "fake.jpg", { type: "image/jpeg" }), deps), "INVALID_PHOTO");
    await rejects(start(worker.id, evidence, photo, { ...deps, storage: new LocalStorage(undefined) }), "STORAGE_UNAVAILABLE");
    assert.equal(await fileCount(), 0); assert.equal(await db.overtime.count(), baseline[4]);
    stage = "check-in transaction failure compensation";
    await assert.rejects(start(worker.id, evidence, photo, { ...deps, transaction: failTransaction }));
    assert.equal(await fileCount(), 0); assert.equal(await db.overtime.count(), baseline[4]);
    stage = "revocation wins after file write but before final transaction";
    const racingStorage: StorageService = { read: key => storage.read(key), delete: key => storage.delete(key), upload: async (key, bytes) => {
      await storage.upload(key, bytes); await revoke(admin.id, { attendanceId: first.id });
    } };
    await rejects(start(worker.id, evidence, photo, { ...deps, storage: racingStorage }), "NO_AUTHORIZATION");
    assert.equal(await fileCount(), 0);
    await grant(admin.id, { attendanceId: first.id });
    const originalAttendance = await db.attendance.findUniqueOrThrow({ where: { id: first.id }, include: { dailyReport: true } });
    const originalAuthorization = await db.overtimeAuthorization.findUniqueOrThrow({ where: { attendanceId: first.id } });
    stage = "simultaneous check-ins create one row and clean losing photo";
    const sharedStorage = concurrentStorage();
    const starts = await Promise.allSettled([start(worker.id, evidence, photo, { ...deps, storage: sharedStorage }), start(worker.id, evidence, photo, { ...deps, storage: sharedStorage })]);
    assert.equal(starts.filter(result => result.status === "fulfilled").length, 1);
    const opened = starts.find(result => result.status === "fulfilled")!;
    assert.equal(opened.status, "fulfilled"); if (opened.status !== "fulfilled") throw new Error("Expected one successful start");
    const dto = opened.value;
    const stored = await db.overtime.findUniqueOrThrow({ where: { id: dto.id } });
    assert.equal(await fileCount(), 1); assert.equal(stored.checkInAt.toISOString(), "2026-09-01T16:00:00.000Z");
    assert.equal(stored.checkInDescription, "Extra inspection"); assert.equal(stored.checkInLatitude, -6.2);
    assert.ok(stored.checkInPhotoPath.startsWith(`attendance/overtime/2026/09/01/${worker.id}/checkin-`));
    assert.ok(!stored.checkInPhotoPath.includes(root)); assert.ok(!JSON.stringify(dto).includes("PhotoPath"));
    assert.deepEqual(await db.overtimeAuthorization.findUniqueOrThrow({ where: { attendanceId: first.id } }), originalAuthorization);
    await assert.rejects(db.overtime.create({ data: { ...stored, id: randomUUID() } }));
    assert.equal((await getOvertimePage(worker.id)).state, "open");
    stage = "ownership, inactive user and protected photo service";
    assert.ok((await readOvertimePhoto(worker.id, dto.id, "check-in", storage)).length > 0);
    await rejects(readOvertimePhoto(other.id, dto.id, "check-in", storage), "PHOTO_NOT_FOUND");
    await rejects(readOvertimePhoto(worker.id, dto.id, "check-out", storage), "PHOTO_NOT_FOUND");
    await rejects(finish(other.id, evidence, photo, deps), "NO_OPEN_OVERTIME");
    await db.user.update({ where: { id: worker.id }, data: { isActive: false } });
    await rejects(finish(worker.id, evidence, photo, deps), "UNAUTHENTICATED");
    await rejects(readOvertimePhoto(worker.id, dto.id, "check-in", storage), "UNAUTHENTICATED");
    await db.user.update({ where: { id: worker.id }, data: { isActive: true } });
    stage = "multiple authorizations cannot create a second open session";
    const second = await regular("2026-09-02"); await grant(admin.id, { attendanceId: second.id });
    await rejects(start(worker.id, evidence, photo, { storage, clock: clock("2026-09-02T16:00:00Z") }), "OVERTIME_OPEN");
    assert.equal((await getOvertimePage(worker.id)).state, "open");
    stage = "checkout transaction failure preserves old photo and open record";
    const checkout = { ...evidence, latitude: -5.1, longitude: 119.4, accuracy: 9, timezone: "Asia/Makassar", description: "  Finished extra work  " };
    const outDeps = { storage, clock: clock("2026-09-02T01:15:59Z") };
    await assert.rejects(finish(worker.id, checkout, photo, { ...outDeps, transaction: failTransaction }));
    assert.equal(await fileCount(), 1); assert.deepEqual(await db.overtime.findUniqueOrThrow({ where: { id: dto.id } }), stored);
    await rejects(finish(worker.id, checkout, photo, { storage, clock: clock("2026-09-01T15:59:59Z") }), "INVALID_EVENT_TIME");
    stage = "revocation after start permits concurrent checkout with one winner";
    await revoke(admin.id, { attendanceId: first.id });
    const sharedOutStorage = concurrentStorage();
    const finishes = await Promise.allSettled([finish(worker.id, checkout, photo, { ...outDeps, storage: sharedOutStorage }), finish(worker.id, checkout, photo, { ...outDeps, storage: sharedOutStorage })]);
    assert.equal(finishes.filter(result => result.status === "fulfilled").length, 1);
    const completed = await db.overtime.findUniqueOrThrow({ where: { id: dto.id } });
    assert.equal(await fileCount(), 2); assert.notEqual(completed.checkOutPhotoPath, completed.checkInPhotoPath);
    assert.equal(completed.checkOutLatitude, -5.1); assert.equal(completed.checkOutTimezone, "Asia/Makassar");
    assert.equal(completed.checkOutAt!.toISOString(), "2026-09-02T01:15:59.000Z");
    const success = finishes.find(result => result.status === "fulfilled")!;
    if (success.status === "fulfilled") { assert.equal(success.value.durationMinutes, 555); assert.equal(success.value.workDate, "2026-09-01"); }
    assert.ok((await readOvertimePhoto(worker.id, dto.id, "check-out", storage)).length > 0);
    await rejects(finish(worker.id, checkout, photo, outDeps), "NO_OPEN_OVERTIME");
    assert.deepEqual(await db.attendance.findUniqueOrThrow({ where: { id: first.id }, include: { dailyReport: true } }), originalAttendance);
    stage = "latest authorization selection and completed refresh state";
    await revoke(admin.id, { attendanceId: second.id });
    await grant(admin.id, { attendanceId: first.id });
    await rejects(start(worker.id, evidence, photo, { storage, clock: clock("2026-09-02T16:00:00Z") }), "NO_AUTHORIZATION");
    assert.equal((await getOvertimePage(worker.id)).state, "unavailable");
    await grant(admin.id, { attendanceId: second.id });
    const secondOt = await start(worker.id, evidence, photo, { storage, clock: clock("2026-09-02T16:00:00Z") });
    await finish(worker.id, checkout, photo, { storage, clock: clock("2026-09-02T18:15:59Z") });
    const page = await getOvertimePage(worker.id); assert.equal(page.state, "completed");
    if (page.state === "completed") { assert.equal(page.overtime.id, secondOt.id); assert.equal(page.overtime.durationMinutes, 135); }
    await rejects(start(worker.id, evidence, photo, { storage, clock: clock("2026-09-03T16:00:00Z") }), "OVERTIME_EXISTS");
    await revoke(admin.id, { attendanceId: second.id }); assert.equal((await getOvertimePage(worker.id)).state, "completed");
    stage = "different authorizations competing while an older upload is in flight";
    const third = await regular("2026-09-03"); await grant(admin.id, { attendanceId: third.id });
    const interleavedStorage: StorageService = { read: key => storage.read(key), delete: key => storage.delete(key), upload: async (key, bytes) => {
      await storage.upload(key, bytes);
      const fourth = await regular("2026-09-04"); await grant(admin.id, { attendanceId: fourth.id });
      await start(worker.id, evidence, photo, { storage, clock: clock("2026-09-04T16:00:00Z") });
    } };
    const beforeRaceFiles = await fileCount();
    await rejects(start(worker.id, evidence, photo, { storage: interleavedStorage, clock: clock("2026-09-03T16:00:00Z") }), "OVERTIME_OPEN");
    assert.equal(await db.overtime.count({ where: { checkOutAt: null, authorization: { attendance: { userId: worker.id } } } }), 1);
    assert.equal(await fileCount(), beforeRaceFiles + 1);
    await finish(worker.id, checkout, photo, { storage, clock: clock("2026-09-04T17:00:00Z") });
    stage = "cleanup";
    await cleanup(); assert.deepEqual(await counts(), baseline);
    console.log("Overtime integration passed: eligibility/ownership, real images/storage, lifecycle, transaction-failure compensation, concurrent starts/closes, second-open prevention, revoke race/after-start closure, evidence access, timezone/duration, latest selection and immutable regular history.");
  } catch (error) {
    console.error(`Overtime integration failed during ${stage} (${error instanceof Error ? error.name : "unknown"}). Sensitive details omitted.`); process.exitCode = 1;
  } finally {
    await cleanup(); await disconnectDatabase();
    assert.equal(path.dirname(path.resolve(root)), path.resolve(tmpdir())); assert.ok(path.basename(root).startsWith("etime-overtime-test-"));
    await rm(root, { recursive: true, force: true });
  }
}
void main();
