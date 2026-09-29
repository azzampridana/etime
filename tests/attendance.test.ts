import assert from "node:assert/strict";
import test from "node:test";
import { getLocalWorkDate, isValidTimeZone, formatEventTime } from "@/lib/date-time/event-time";
import { checkInSchema } from "@/schemas/attendance.schema";
import { toAttendanceDto } from "@/mappers/attendance.mapper";

const evidence = { latitude: -6.2, longitude: 106.8, accuracy: 18, timezone: "Asia/Jakarta" };

test("check-in validates mandatory numeric GPS and normalizes optional description", () => {
  assert.equal(checkInSchema.parse(evidence).description, null);
  assert.equal(checkInSchema.parse({ ...evidence, description: "  " }).description, null);
  assert.equal(checkInSchema.parse({ ...evidence, description: "  Site inspection  " }).description, "Site inspection");
  for (const patch of [
    { latitude: 91 }, { latitude: -91 }, { latitude: "0" }, { latitude: NaN },
    { longitude: 181 }, { longitude: -181 }, { accuracy: -1 }, { accuracy: Infinity },
    { accuracy: 40_000_001 }, { accuracy: undefined }, { timezone: "invalid/zone" },
    { timezone: "+07:00" }, { timezone: "" }, { description: "a".repeat(1001) },
    { userId: "caller" }, { workDate: "2026-09-18" }, { checkInAt: "2026-09-18" }, { requiredWorkMinutes: 1 },
  ]) assert.equal(checkInSchema.safeParse({ ...evidence, ...patch }).success, false);
  assert.ok(checkInSchema.safeParse({ ...evidence, latitude: -90, longitude: 180, accuracy: 0 }).success);
});

test("work dates use event zones across both sides of UTC midnight", () => {
  const instant = new Date("2026-09-18T17:30:00.000Z");
  for (const zone of ["Asia/Jakarta", "Asia/Makassar", "Asia/Jayapura"]) {
    assert.ok(isValidTimeZone(zone));
    assert.equal(getLocalWorkDate(instant, zone), "2026-09-19");
  }
  assert.equal(getLocalWorkDate(new Date("2026-09-18T01:00:00Z"), "America/Los_Angeles"), "2026-09-17");
  assert.equal(getLocalWorkDate(new Date("2026-09-18T16:30:00Z"), "Asia/Jakarta"), "2026-09-18");
  assert.equal(getLocalWorkDate(new Date("2026-09-18T16:30:00Z"), "Asia/Makassar"), "2026-09-19");
  assert.match(formatEventTime(instant.toISOString(), "Asia/Jakarta"), /19 Sept 2026, 00:30 \(Asia\/Jakarta\)/);
});

test("attendance DTO explicitly selects safe fields and serializes dates", () => {
  const record = {
    id: "attendance", workDate: new Date("2026-09-19T00:00:00Z"), requiredWorkMinutes: 450,
    checkInAt: new Date("2026-09-18T17:30:00Z"), checkInLatitude: -6.2, checkInLongitude: 106.8,
    checkInAccuracy: 18, checkInAddress: null, checkInTimezone: "Asia/Jakarta", checkInDescription: null, checkOutAt: null,
    checkOutLatitude: null, checkOutLongitude: null, checkOutAccuracy: null, checkOutAddress: null, checkOutTimezone: null, checkOutDescription: null, dailyReport: null,
    ...{ user: { passwordHash: "private" }, userId: "private", createdAt: new Date() },
  };
  const dto = toAttendanceDto(record);
  assert.equal(dto.workDate, "2026-09-19");
  assert.equal(dto.checkInAt, "2026-09-18T17:30:00.000Z");
  assert.equal(dto.isOpen, true);
  assert.deepEqual(Object.keys(dto).sort(), ["id", "workDate", "requiredWorkMinutes", "checkInAt", "checkInLatitude", "checkInLongitude", "checkInAccuracy", "checkInAddress", "checkInTimezone", "checkInDescription", "isOpen", "checkOutAt", "checkOutLatitude", "checkOutLongitude", "checkOutAccuracy", "checkOutAddress", "checkOutTimezone", "checkOutDescription", "dailyReport", "actualDurationMinutes", "differenceMinutes"].sort());
  assert.equal(dto.actualDurationMinutes, null);
  assert.equal(dto.differenceMinutes, null);
  for (const [minutes, difference] of [[450, 0], [420, -30], [513, 63]]) {
    const completed = toAttendanceDto({ ...record, checkOutAt: new Date(record.checkInAt.getTime() + minutes * 60_000 + 59_999) });
    assert.equal(completed.actualDurationMinutes, minutes);
    assert.equal(completed.differenceMinutes, difference);
  }
});
