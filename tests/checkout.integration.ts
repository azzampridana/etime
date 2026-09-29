import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { loadEnvConfig } from "@next/env";
import { disconnectDatabase, getPrisma } from "@/lib/db/prisma";
import { ApplicationError } from "@/lib/errors/application-error";
import { checkIn, checkOut, getCurrentAttendance } from "@/services/attendance.service";
import { saveDailyReport } from "@/services/daily-report.service";

loadEnvConfig(process.cwd());
// Tests never call a real geocoder; focused tests inject mocked providers.
process.env.GEOAPIFY_API_KEY = "";
// Direct DB use is restricted to fixture creation, assertions, and scoped cleanup.
async function main() {
  const db = getPrisma();
  const ids: string[] = [];
  const scheduleId = randomUUID();
  let stage = "fixture setup";
  const evidence = { latitude: -6.2, longitude: 106.8, accuracy: 18, timezone: "Asia/Jakarta" };
  const checkoutEvidence = { latitude: -5.1, longitude: 119.4, accuracy: 22, timezone: "Asia/Makassar", description: "  End of shift  " };
  const start = new Date("2026-09-18T16:30:00.123Z");
  const end = new Date("2026-09-19T01:33:59.999Z");
  const domainError = (code: string) => (error: unknown) => error instanceof ApplicationError && error.code === code;
  async function cleanup() {
    await db.dailyReport.deleteMany({ where: { attendance: { userId: { in: ids } } } });
    await db.attendance.deleteMany({ where: { userId: { in: ids } } });
    await db.user.deleteMany({ where: { id: { in: ids } } });
    await db.workSchedule.deleteMany({ where: { id: scheduleId } });
  }
  try {
    const baseline = { users: await db.user.count(), attendance: await db.attendance.count(), reports: await db.dailyReport.count(), schedules: await db.workSchedule.count() };
    await db.workSchedule.create({ data: { id: scheduleId, name: `Checkout test ${scheduleId}`, requiredWorkMinutes: 480 } });
    async function fixture() {
      const id = randomUUID();
      await db.user.create({ data: { id, name: "Checkout fixture", email: `${id}@example.com`, passwordHash: "not-a-login-hash", workScheduleId: scheduleId } });
      ids.push(id);
      return id;
    }
    const user = await fixture();
    stage = "no-open-session and no-report rules";
    await assert.rejects(checkOut(user, checkoutEvidence, () => end), domainError("NO_OPEN_ATTENDANCE"));
    await assert.rejects(saveDailyReport(user, { content: "Work" }), domainError("NO_OPEN_ATTENDANCE"));
    const attendance = await checkIn(user, evidence, () => start);
    assert.equal(attendance.workDate, "2026-09-18");
    await assert.rejects(checkOut(user, checkoutEvidence, () => end), domainError("DAILY_REPORT_REQUIRED"));
    stage = "repeated and concurrent report saves";
    const report = await saveDailyReport(user, { content: "  Inspection\nMaintenance  " });
    assert.equal(report.content, "Inspection\nMaintenance");
    const saved = await Promise.all([saveDailyReport(user, { content: "Update A" }), saveDailyReport(user, { content: "Update B" })]);
    assert.ok(saved.every((item) => item.id === report.id));
    assert.equal(await db.dailyReport.count({ where: { attendanceId: attendance.id } }), 1);
    assert.deepEqual(Object.keys(report).sort(), ["id", "content", "createdAt", "updatedAt"].sort());
    stage = "empty persisted report prerequisite and negative-time safety";
    await db.dailyReport.update({ where: { id: report.id }, data: { content: " \n " } });
    await assert.rejects(checkOut(user, checkoutEvidence, () => end), domainError("DAILY_REPORT_REQUIRED"));
    await saveDailyReport(user, { content: "Saved work" });
    await assert.rejects(checkOut(user, checkoutEvidence, () => new Date(start.getTime() - 1)), domainError("INVALID_CHECKOUT_TIME"));
    assert.equal((await getCurrentAttendance(user))?.checkOutAt, null);
    stage = "inactive identity cannot report or checkout";
    await db.user.update({ where: { id: user }, data: { isActive: false } });
    await assert.rejects(saveDailyReport(user, { content: "Forbidden" }), domainError("UNAUTHENTICATED"));
    await assert.rejects(checkOut(user, checkoutEvidence, () => end), domainError("UNAUTHENTICATED"));
    await db.user.update({ where: { id: user }, data: { isActive: true } });
    stage = "checkout preserves snapshot across midnight, timezone, and schedule changes";
    await db.workSchedule.update({ where: { id: scheduleId }, data: { requiredWorkMinutes: 300, isActive: false } });
    const completed = await checkOut(user, checkoutEvidence, () => end);
    assert.equal(completed.workDate, attendance.workDate);
    assert.equal(completed.checkInAt, attendance.checkInAt);
    assert.equal(completed.checkOutAt, end.toISOString());
    assert.equal(completed.checkOutTimezone, "Asia/Makassar");
    assert.equal(completed.checkInTimezone, "Asia/Jakarta");
    assert.equal(completed.checkOutLatitude, -5.1);
    assert.equal(completed.checkOutDescription, "End of shift");
    assert.equal(completed.requiredWorkMinutes, 480);
    assert.equal(completed.actualDurationMinutes, 543);
    assert.equal(completed.differenceMinutes, 63);
    assert.equal(completed.isOpen, false);
    assert.deepEqual(await getCurrentAttendance(user), completed);
    await assert.rejects(saveDailyReport(user, { content: "Historical change" }), domainError("NO_OPEN_ATTENDANCE"));
    await assert.rejects(checkOut(user, evidence, () => new Date(end.getTime() + 1000)), domainError("NO_OPEN_ATTENDANCE"));
    assert.deepEqual(await getCurrentAttendance(user), completed);
    stage = "own-session lookup and future check-in remain available";
    const outsider = await fixture();
    await assert.rejects(saveDailyReport(outsider, { content: "Not mine" }), domainError("NO_OPEN_ATTENDANCE"));
    assert.equal(await getCurrentAttendance(outsider), null);
    await db.workSchedule.update({ where: { id: scheduleId }, data: { isActive: true } });
    await assert.rejects(checkIn(user, evidence, () => start), domainError("ATTENDANCE_EXISTS"));
    const next = await checkIn(user, evidence, () => new Date("2026-09-20T01:00:00Z"));
    assert.notEqual(next.id, completed.id);
    assert.equal((await getCurrentAttendance(user))?.id, next.id);
    stage = "double checkout preserves winning evidence";
    const concurrentUser = await fixture();
    await checkIn(concurrentUser, evidence, () => start);
    await saveDailyReport(concurrentUser, { content: "Work complete" });
    const outcomes = await Promise.allSettled([
      checkOut(concurrentUser, checkoutEvidence, () => end),
      checkOut(concurrentUser, { ...checkoutEvidence, latitude: 10 }, () => new Date(end.getTime() + 60_000)),
    ]);
    const winner = outcomes.find((outcome) => outcome.status === "fulfilled");
    assert.equal(outcomes.filter((outcome) => outcome.status === "fulfilled").length, 1);
    assert.ok(winner?.status === "fulfilled");
    assert.deepEqual(await getCurrentAttendance(concurrentUser), winner.value);
    const loser = outcomes.find((outcome) => outcome.status === "rejected");
    assert.ok(loser?.status === "rejected" && domainError("NO_OPEN_ATTENDANCE")(loser.reason));
    stage = "report update versus checkout race";
    for (let attempt = 0; attempt < 3; attempt++) {
      const racer = await fixture();
      const opened = await checkIn(racer, evidence, () => start);
      await saveDailyReport(racer, { content: "Before race" });
      const operations = [() => saveDailyReport(racer, { content: "Concurrent update" }), () => checkOut(racer, checkoutEvidence, () => end)];
      if (attempt % 2) operations.reverse();
      const raced = await Promise.allSettled(operations.map((operation) => operation()));
      assert.ok(raced.some((outcome) => outcome.status === "fulfilled" && "isOpen" in outcome.value && !outcome.value.isOpen));
      const historical = await db.dailyReport.findUniqueOrThrow({ where: { attendanceId: opened.id } });
      await assert.rejects(saveDailyReport(racer, { content: "After checkout" }), domainError("NO_OPEN_ATTENDANCE"));
      assert.deepEqual(await db.dailyReport.findUniqueOrThrow({ where: { attendanceId: opened.id } }), historical);
      assert.equal(await db.dailyReport.count({ where: { attendanceId: opened.id } }), 1);
    }
    stage = "cleanup";
    await cleanup();
    assert.deepEqual({ users: await db.user.count(), attendance: await db.attendance.count(), reports: await db.dailyReport.count(), schedules: await db.workSchedule.count() }, baseline);
    console.log("Phase 6 integration passed: report save/update/uniqueness, persisted prerequisite, active identity, owner scoping, clock safety, snapshot, midnight/timezones, future check-in, double checkout, report/checkout races, and cleanup.");
  } catch {
    console.error(`Phase 6 integration failed during ${stage}. Sensitive details omitted.`);
    process.exitCode = 1;
  } finally {
    await cleanup();
    await disconnectDatabase();
  }
}
void main();
