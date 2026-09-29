import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import sharp from "sharp";
import { loadEnvConfig } from "@next/env";
import { createMonitoringFixture } from "./admin-overtime.fixture";
import { LocalStorage } from "@/lib/storage/local-storage";
import { getPrisma, disconnectDatabase } from "@/lib/db/prisma";
import { updateUser } from "@/services/user.service";
import { checkIn, checkOut, getHomeAttendance } from "@/services/attendance.service";
import { saveDailyReport } from "@/services/daily-report.service";
import { grantOvertimeAuthorization } from "@/services/overtime-authorization.service";
import { overtimeCheckIn, overtimeCheckOut } from "@/services/overtime.service";
import { saveWorkSchedule } from "@/services/work-schedule.service";
import { processEvidencePhoto } from "@/lib/photos/process-photo";
import type { ReverseGeocoder } from "@/lib/geolocation/reverse-geocoding";

loadEnvConfig(process.cwd());
// Explicitly prevent real provider calls from reused fixtures.
process.env.GEOAPIFY_API_KEY = "";
let stage = "fixtures";
async function main() {
  const root = await mkdtemp(path.join(tmpdir(), "etime-adjustment-")), storage = new LocalStorage(root), db = getPrisma();
  let fixture: Awaited<ReturnType<typeof createMonitoringFixture>> | undefined;
  try {
    fixture = await createMonitoringFixture(storage);
    const { other: worker, admin } = fixture;
    assert.equal(worker.position, "Site Engineer");
    const input = { id: worker.id, name: worker.name, email: worker.email, role: worker.role, workScheduleId: worker.workSchedule.id, password: undefined };
    assert.equal((await updateUser({ ...input, position: " Supervisor " }, { actorId: admin.id })).position, "Supervisor");
    assert.equal((await updateUser({ ...input, position: " " }, { actorId: admin.id })).position, null);
    const evidence = { latitude: -6.2, longitude: 106.8, accuracy: 12, timezone: "Asia/Jakarta", description: "Inspection" };
    const success: ReverseGeocoder = async () => "Jalan Sudirman, Jakarta, Jakarta";
    const failure: ReverseGeocoder = async () => { throw new Error("Mock provider unavailable"); };
    const clock = (value: string) => () => new Date(value);
    const today = clock("2026-09-18T12:00:00Z");
    stage = "Home states, 11:00-19:00 regular session and snapshots";
    assert.equal(await getHomeAttendance(worker.id, today), null);
    const opened = await checkIn(worker.id, evidence, clock("2026-09-18T04:00:00Z"), success);
    assert.equal(opened.checkInAddress, "Jalan Sudirman, Jakarta"); assert.equal(opened.requiredWorkMinutes, 480);
    assert.equal((await getHomeAttendance(worker.id, today))?.isOpen, true);
    assert.equal((await getHomeAttendance(worker.id, clock("2026-09-19T12:00:00Z")))?.id, opened.id);
    await saveWorkSchedule({ id: worker.workSchedule.id, name: worker.workSchedule.name, requiredWorkMinutes: 300, isActive: true }, admin.id);
    await saveDailyReport(worker.id, { content: "Flexible working day" });
    const completed = await checkOut(worker.id, evidence, today, success);
    assert.equal(completed.checkOutAddress, "Jalan Sudirman, Jakarta"); assert.equal(completed.actualDurationMinutes, 480); assert.equal(completed.requiredWorkMinutes, 480); assert.equal(completed.differenceMinutes, 0);
    assert.equal((await getHomeAttendance(worker.id, today))?.isOpen, false);
    assert.equal(await getHomeAttendance(worker.id, clock("2026-09-19T12:00:00Z")), null);
    stage = "overtime addresses and watermark metadata";
    const bytes = await sharp({ create: { width: 600, height: 400, channels: 3, background: "white" } }).jpeg().toBuffer();
    const photo = new File([new Uint8Array(bytes)], "test.jpg", { type: "image/jpeg" });
    const watermarkAddresses: (string | null | undefined)[] = [];
    const processor: typeof processEvidencePhoto = async (buffer, metadata) => { watermarkAddresses.push(metadata.address); return processEvidencePhoto(buffer, metadata); };
    await grantOvertimeAuthorization(admin.id, { attendanceId: opened.id });
    await overtimeCheckIn(worker.id, evidence, photo, { storage, geocoder: success, processPhoto: processor, clock: clock("2026-09-18T13:00:00Z") });
    const overtime = await overtimeCheckOut(worker.id, { ...evidence, timezone: "Asia/Makassar" }, photo, { storage, geocoder: success, processPhoto: processor, clock: clock("2026-09-19T00:00:00Z") });
    assert.equal(overtime.checkIn.address, "Jalan Sudirman, Jakarta"); assert.equal(overtime.checkOut?.address, "Jalan Sudirman, Jakarta");
    assert.deepEqual(watermarkAddresses, ["Jalan Sudirman, Jakarta", "Jalan Sudirman, Jakarta"]);
    stage = "all four events survive geocoding failure";
    const next = await checkIn(worker.id, evidence, clock("2026-09-19T04:00:00Z"), failure);
    assert.equal(next.checkInAddress, null); assert.equal(next.requiredWorkMinutes, 300);
    await saveDailyReport(worker.id, { content: "Provider outage day" });
    assert.equal((await checkOut(worker.id, evidence, clock("2026-09-19T12:00:00Z"), failure)).checkOutAddress, null);
    await grantOvertimeAuthorization(admin.id, { attendanceId: next.id });
    assert.equal((await overtimeCheckIn(worker.id, evidence, photo, { storage, geocoder: failure, clock: clock("2026-09-19T13:00:00Z") })).checkIn.address, null);
    assert.equal((await overtimeCheckOut(worker.id, evidence, photo, { storage, geocoder: failure, clock: clock("2026-09-19T14:00:00Z") })).checkOut?.address, null);
    assert.equal((await db.attendance.findUniqueOrThrow({ where: { id: opened.id } })).requiredWorkMinutes, 480);
    const audit = await db.auditLog.findMany({ where: { entityId: worker.id, action: "USER_UPDATED" } });
    assert.ok(audit.some(row => JSON.stringify(row.metadata).includes("Supervisor")));
    console.log("PASS domain adjustment: position persistence/blank/audit, duration policy, flexible hours/snapshot, Home states/open priority, four geocoded events/watermarks and four provider-failure fallbacks.");
  } finally {
    if (fixture) await db.auditLog.deleteMany({ where: { entityId: fixture.other.workSchedule.id, entityType: "WorkSchedule" } });
    await fixture?.cleanup(); await rm(root, { recursive: true, force: true }); await disconnectDatabase();
  }
}
main().catch((error: unknown) => { console.error(`Adjustment integration failed during ${stage}.`); if (error instanceof assert.AssertionError) console.error(error.message); process.exitCode = 1; });
