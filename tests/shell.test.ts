import assert from "node:assert/strict";
import test from "node:test";
import { formatDurationMinutes } from "@/lib/date-time/format-duration";
import { isNavigationActive } from "@/lib/navigation";

test("duration display uses supplied minutes including partial hours", () => {
  for (const [minutes, expected] of [[480, "8h"], [450, "7h 30m"], [420, "7h"], [45, "45m"], [0, "0m"]] as const) {
    assert.equal(formatDurationMinutes(minutes), expected);
  }
  assert.throws(() => formatDurationMinutes(-1), RangeError);
});

test("active navigation distinguishes dashboard and path segment boundaries", () => {
  assert.equal(isNavigationActive("/admin", "/admin"), true);
  assert.equal(isNavigationActive("/admin/users", "/admin"), false);
  assert.equal(isNavigationActive("/admin/users/example", "/admin/users"), true);
  assert.equal(isNavigationActive("/admin/users-other", "/admin/users"), false);
  assert.equal(isNavigationActive("/attendance", "/attendance"), true);
});
