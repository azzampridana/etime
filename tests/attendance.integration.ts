import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { loadEnvConfig } from "@next/env";
import { disconnectDatabase, getPrisma } from "@/lib/db/prisma";
import { ApplicationError } from "@/lib/errors/application-error";
import { checkIn, getOpenAttendance } from "@/services/attendance.service";

// Opt-in MariaDB test: direct persistence access is only fixture setup/assertion/cleanup.
loadEnvConfig(process.cwd());
// Tests never call a real geocoder; focused tests inject mocked providers.
process.env.GEOAPIFY_API_KEY = "";
async function main() {
  const db = getPrisma();
  const ids: string[] = [];
  const scheduleId = randomUUID();
  let stage = "fixture setup";
  try {
    const baseline = { users: await db.user.count(), attendance: await db.attendance.count(), schedules: await db.workSchedule.count() };
    await db.workSchedule.create({ data: { id: scheduleId, name: `Attendance test ${scheduleId}`, requiredWorkMinutes: 450 } });
    async function fixture(isActive = true) {
      const id = randomUUID();
      await db.user.create({ data: { id, name: "Attendance fixture", email: `${id}@example.com`, passwordHash: "not-a-login-hash", workScheduleId: scheduleId, isActive } });
      ids.push(id);
      return id;
    }
    const evidence = { latitude: -6.2, longitude: 106.8, accuracy: 18, timezone: "Asia/Jakarta", description: "  Site inspection  " };
    const now = new Date("2026-09-18T17:30:00.123Z");
    const userId = await fixture();
    stage = "successful check-in, clock, snapshot, and open lookup";
    const result = await checkIn(userId, evidence, () => now);
    assert.equal(result.checkInAt, now.toISOString());
    assert.equal(result.workDate, "2026-09-19");
    assert.equal(result.requiredWorkMinutes, 450);
    assert.equal(result.checkInDescription, "Site inspection");
    assert.equal(result.checkInAddress, null);
    await db.workSchedule.update({ where: { id: scheduleId }, data: { requiredWorkMinutes: 300 } });
    assert.deepEqual(await getOpenAttendance(userId), result);
    const domainError = (code: string) => (error: unknown) => error instanceof ApplicationError && error.code === code;
    stage = "same-day and cross-date duplicate rejection";
    await assert.rejects(checkIn(userId, evidence, () => now), domainError("ATTENDANCE_EXISTS"));
    await assert.rejects(checkIn(userId, evidence, () => new Date("2026-09-20T00:00:00Z")), domainError("ATTENDANCE_OPEN"));
    stage = "inactive user and inactive schedule rejection";
    await assert.rejects(checkIn(await fixture(false), evidence, () => now), domainError("UNAUTHENTICATED"));
    await db.workSchedule.update({ where: { id: scheduleId }, data: { isActive: false } });
    await assert.rejects(checkIn(await fixture(), evidence, () => now), domainError("SCHEDULE_UNAVAILABLE"));
    await db.workSchedule.update({ where: { id: scheduleId }, data: { isActive: true } });
    stage = "concurrent same-date and different-date requests";
    for (const times of [[now, now], [now, new Date("2026-09-20T00:00:00Z")]]) {
      const concurrentUser = await fixture();
      const outcomes = await Promise.allSettled(times.map((time) => checkIn(concurrentUser, evidence, () => time)));
      assert.equal(outcomes.filter((outcome) => outcome.status === "fulfilled").length, 1);
      assert.equal(await db.attendance.count({ where: { userId: concurrentUser } }), 1);
      const rejected = outcomes.find((outcome) => outcome.status === "rejected");
      assert.ok(rejected?.status === "rejected" && rejected.reason instanceof ApplicationError);
    }
    stage = "database unique constraint";
    const stored = await db.attendance.findUniqueOrThrow({ where: { id: result.id } });
    await assert.rejects(db.attendance.create({ data: { ...stored, id: randomUUID() } }), (error: unknown) => !!error && typeof error === "object" && "code" in error && error.code === "P2002");
    stage = "cleanup verification";
    await db.attendance.deleteMany({ where: { userId: { in: ids } } });
    await db.user.deleteMany({ where: { id: { in: ids } } });
    await db.workSchedule.delete({ where: { id: scheduleId } });
    assert.deepEqual({ users: await db.user.count(), attendance: await db.attendance.count(), schedules: await db.workSchedule.count() }, baseline);
    console.log("Attendance integration passed: server clock, schedule snapshot, open lookup, duplicate/concurrent same- and cross-date requests, active-user/schedule rules, DB uniqueness, and cleanup.");
  } catch {
    console.error(`Attendance integration failed during ${stage}. Sensitive details omitted.`);
    process.exitCode = 1;
  } finally {
    await db.attendance.deleteMany({ where: { userId: { in: ids } } });
    await db.user.deleteMany({ where: { id: { in: ids } } });
    await db.workSchedule.deleteMany({ where: { id: scheduleId } });
    await disconnectDatabase();
  }
}
void main();
