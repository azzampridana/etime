import assert from "node:assert/strict";
import { test } from "node:test";
import { randomUUID } from "node:crypto";
import { grantOvertimeAuthorizationSchema as grant, revokeOvertimeAuthorizationSchema as revoke } from "@/schemas/overtime-authorization.schema";
import { adminOvertimeAuthorizationQuerySchema as query } from "@/schemas/admin-query.schema";
import { authorizationState } from "@/mappers/overtime-authorization.mapper";

test("authorization input normalizes notes and rejects authoritative field spoofing", () => {
  const attendanceId = randomUUID();
  assert.equal(grant.parse({ attendanceId, note: "  Approved  " }).note, "Approved");
  for (const note of [undefined, null, "", "   "]) assert.equal(grant.parse({ attendanceId, note }).note, null);
  assert.ok(grant.safeParse({ attendanceId, note: "a".repeat(1000) }).success);
  assert.ok(!grant.safeParse({ attendanceId, note: "a".repeat(1001) }).success);
  assert.ok(!grant.safeParse({ attendanceId: "invalid" }).success);
  for (const field of ["actorId", "grantedById", "adminId", "userId", "workDate", "grantedAt", "revokedAt"]) {
    assert.ok(!grant.safeParse({ attendanceId, [field]: "spoofed" }).success);
    assert.ok(!revoke.safeParse({ attendanceId, [field]: "spoofed" }).success);
  }
});
test("authorization state is derived without a redundant persisted enum", () => {
  assert.equal(authorizationState(null), "Not Authorized");
  assert.equal(authorizationState({ revokedAt: null }), "Authorized");
  assert.equal(authorizationState({ revokedAt: new Date() }), "Revoked");
});
test("authorization filters validate dates, states and bounded pagination", () => {
  const input = query.parse({ from: "2026-09-18", to: "2026-09-19", state: "revoked", page: "2", pageSize: "5" });
  assert.equal(input.page, 2); assert.equal(input.pageSize, 5);
  for (const bad of [{ pageSize: "101" }, { page: "0" }, { state: "open" }, { from: "2026-02-30" }, { from: "2026-09-19", to: "2026-09-18" }, { userId: "bad" }]) assert.ok(!query.safeParse(bad).success);
});
