import assert from "node:assert/strict";
import test from "node:test";
import { dailyReportSchema, DAILY_REPORT_MAX_LENGTH } from "@/schemas/daily-report.schema";
import { checkOutSchema } from "@/schemas/attendance.schema";
import { elapsedWholeMinutes } from "@/lib/date-time/duration";
import { formatDurationMinutes, formatSignedDurationMinutes } from "@/lib/date-time/format-duration";

test("Daily Report trims multiline content, bounds length, and rejects authoritative fields", () => {
  assert.equal(dailyReportSchema.parse({ content: "  Inspection\nMaintenance  " }).content, "Inspection\nMaintenance");
  assert.ok(dailyReportSchema.safeParse({ content: "a".repeat(DAILY_REPORT_MAX_LENGTH) }).success);
  for (const content of ["", " \n\t ", "a".repeat(DAILY_REPORT_MAX_LENGTH + 1)]) assert.equal(dailyReportSchema.safeParse({ content }).success, false);
  for (const field of ["userId", "attendanceId", "workDate", "checkOutAt", "hasDailyReport", "isCompleted"]) {
    assert.equal(dailyReportSchema.safeParse({ content: "Inspection", [field]: "untrusted" }).success, false);
  }
});

test("checkout requires valid fresh event evidence and rejects client authority", () => {
  const evidence = { latitude: -5.1, longitude: 119.4, accuracy: 20, timezone: "Asia/Makassar" };
  assert.equal(checkOutSchema.parse(evidence).description, null);
  assert.equal(checkOutSchema.parse({ ...evidence, description: "   " }).description, null);
  assert.equal(checkOutSchema.parse({ ...evidence, description: "  End of shift  " }).description, "End of shift");
  for (const patch of [{ latitude: 91 }, { longitude: -181 }, { accuracy: -1 }, { accuracy: NaN }, { accuracy: Infinity }, { timezone: "invalid" }, { timezone: "+08:00" }, { latitude: undefined }, { longitude: "119" }]) {
    assert.equal(checkOutSchema.safeParse({ ...evidence, ...patch }).success, false);
  }
  for (const field of ["userId", "attendanceId", "workDate", "checkInAt", "checkOutAt", "requiredWorkMinutes", "actualDuration", "difference", "hasDailyReport", "isCompleted"]) {
    assert.equal(checkOutSchema.safeParse({ ...evidence, [field]: "untrusted" }).success, false);
  }
});

test("duration uses absolute instants and whole elapsed minutes without rounding stored timestamps", () => {
  const start = new Date("2026-09-18T08:00:00+07:00");
  assert.equal(elapsedWholeMinutes(start, new Date("2026-09-18T18:00:00+08:00")), 540);
  assert.equal(elapsedWholeMinutes(start, new Date("2026-09-18T16:00:00+07:00")), 480);
  assert.equal(elapsedWholeMinutes(start, new Date("2026-09-18T08:01:59.999+07:00")), 1);
  assert.equal(elapsedWholeMinutes(start, start), 0);
  assert.throws(() => elapsedWholeMinutes(start, new Date(start.getTime() - 1)), RangeError);
  assert.throws(() => elapsedWholeMinutes(start, new Date(NaN)), RangeError);
  assert.equal(formatDurationMinutes(543), "9h 03m");
  assert.equal(formatSignedDurationMinutes(63), "+1h 03m");
  assert.equal(formatSignedDurationMinutes(-30), "-30m");
  assert.equal(formatSignedDurationMinutes(0), "0m");
});
