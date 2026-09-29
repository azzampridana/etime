import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import test from "node:test";
import { hashPassword, verifyPassword } from "@/lib/auth/password";
import { toUserDto } from "@/mappers/user.mapper";
import { createUserSchema, listUsersSchema, passwordSchema, setUserActiveStatusSchema, updateUserSchema } from "@/schemas/user.schema";

const userInput = {
  name: "  Example Worker  ", email: "  WORKER@EXAMPLE.COM ",
  password: "a-test-password", workScheduleId: randomUUID(),
};

test("creation normalizes identity and defaults only the intended fields", () => {
  const value = createUserSchema.parse(userInput);
  assert.equal(value.name, "Example Worker");
  assert.equal(value.email, "worker@example.com");
  assert.equal(value.role, "USER");
  assert.equal(value.isActive, true);
  assert.equal(createUserSchema.safeParse({ ...userInput, role: "SUPERADMIN" }).success, false);
  assert.equal(createUserSchema.safeParse({ ...userInput, actorId: randomUUID() }).success, false);
  assert.equal(createUserSchema.safeParse({ ...userInput, workScheduleId: "bad-id" }).success, false);
});

test("password updates preserve omission and empty values without trimming passwords", () => {
  const input = { id: randomUUID(), name: "Worker", email: "worker@example.com", role: "USER", workScheduleId: randomUUID() };
  assert.equal(updateUserSchema.parse(input).password, undefined);
  assert.equal(updateUserSchema.parse({ ...input, password: "" }).password, undefined);
  assert.equal(updateUserSchema.parse({ ...input, password: "  password  " }).password, "  password  ");
  assert.equal(updateUserSchema.safeParse({ ...input, password: "short" }).success, false);
});

test("bcrypt input limit measures UTF-8 bytes, not just characters", () => {
  assert.equal(passwordSchema.safeParse("a".repeat(72)).success, true);
  assert.equal(passwordSchema.safeParse("a".repeat(73)).success, false);
  assert.equal(passwordSchema.safeParse("é".repeat(36)).success, true);
  assert.equal(passwordSchema.safeParse("é".repeat(37)).success, false);
});

test("passwords are salted and verify without plaintext storage", async () => {
  const password = "test-password-123";
  const first = await hashPassword(password);
  const second = await hashPassword(password);
  assert.notEqual(first, password);
  assert.notEqual(first, second);
  assert.equal(await verifyPassword(password, first), true);
  assert.equal(await verifyPassword("incorrect", first), false);
  assert.equal(await verifyPassword("a".repeat(73), first), false);
});

test("listing is bounded and status rejects coerced booleans", () => {
  assert.deepEqual(listUsersSchema.parse({}), { page: 1, pageSize: 20 });
  for (const input of [{ page: 0 }, { pageSize: 101 }, { pageSize: -1 }]) {
    assert.equal(listUsersSchema.safeParse(input).success, false);
  }
  assert.equal(setUserActiveStatusSchema.safeParse({ id: randomUUID(), isActive: "false" }).success, false);
});

test("DTO explicitly excludes secrets even when the source has extra fields", () => {
  const date = new Date("2026-09-17T00:00:00Z");
  const record = {
    id: randomUUID(), name: "Worker", position: null, email: "worker@example.com", role: "USER" as const,
    isActive: true, workScheduleId: userInput.workScheduleId, passwordHash: "sensitive-test-sentinel",
    workSchedule: { id: userInput.workScheduleId, name: "Default", requiredWorkMinutes: 480, isActive: true },
    createdAt: date, updatedAt: date,
  };
  const dto = toUserDto(record);
  assert.equal("passwordHash" in dto, false);
  assert.equal(JSON.stringify(dto).includes("sensitive-test-sentinel"), false);
  assert.equal(dto.createdAt, date.toISOString());
});
