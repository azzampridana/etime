import assert from "node:assert/strict";
import test from "node:test";
import { adminAttendanceQuerySchema, adminUsersQuerySchema, defaultAttendanceRange } from "@/schemas/admin-query.schema";
import { formatAdminEventTime } from "@/lib/date-time/event-time";

test("admin URL filters normalize pagination and reject malformed input", () => {
  assert.deepEqual(adminUsersQuerySchema.parse({ search: "  Alice  ", page: "2", pageSize: "5", status: "inactive", role: "USER" }), { search: "Alice", page: 2, pageSize: 5, isActive: false, role: "USER" });
  assert.equal(adminUsersQuerySchema.parse({}).pageSize, 20);
  for (const patch of [{ page: "0" }, { page: "-1" }, { page: "1.5" }, { page: ["1", "2"] }, { pageSize: "101" }, { role: "SUPERADMIN" }, { status: "enabled" }, { search: "a".repeat(101) }]) {
    assert.equal(adminUsersQuerySchema.safeParse(patch).success, false);
  }
  for (const patch of [{ from: "2026-02-30" }, { from: "2026-10-01", to: "2026-09-01" }, { userId: "arbitrary" }, { state: "late" }, { pageSize: 500 }, { to: ["2026-09-18"] }]) {
    assert.equal(adminAttendanceQuerySchema.safeParse(patch).success, false);
  }
  assert.equal(adminAttendanceQuerySchema.parse({ userId: "", from: "2026-09-01", to: "2026-09-18" }).userId, undefined);
});

test("default attendance range uses Jakarta calendar month across UTC midnight", () => {
  assert.deepEqual(defaultAttendanceRange(new Date("2026-08-31T18:00:00Z")), { from: "2026-09-01", to: "2026-09-01" });
});

test("admin event display preserves each event zone and uses appropriate labels", () => {
  const at = "2026-09-18T01:00:00Z";
  for (const [zone, time, label] of [["Asia/Jakarta", "08:00", "WIB"], ["Asia/Makassar", "09:00", "WITA"], ["Asia/Jayapura", "10:00", "WIT"]]) {
    const text = formatAdminEventTime(at, zone);
    assert.ok(text.includes(time) && text.includes(zone) && text.endsWith(label));
  }
  const other = formatAdminEventTime(at, "America/Los_Angeles");
  assert.ok(other.includes("17 Sept 2026, 18:00") && other.includes("America/Los_Angeles"));
  assert.equal(other.includes("WIB"), false);
});
