import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import test from "node:test";
import { hashPassword } from "@/lib/auth/password";
import { getLoginDestination } from "@/lib/auth/destination";
import { assertAdmin, assertAuthenticatedUser } from "@/lib/authorization/policy";
import { ApplicationError } from "@/lib/errors/application-error";
import { loginSchema } from "@/schemas/auth.schema";
import { authenticateCredentials, resolveActiveUser } from "@/services/auth.service";
import type { Role } from "@/generated/prisma/enums";

const identity = { id: randomUUID(), name: "Test User", email: "test@example.com", role: "ADMIN" as Role, isActive: true };
const password = "test-password-for-auth";
const hash = hashPassword(password);

test("login normalizes only email and bounds password input", () => {
  assert.deepEqual(loginSchema.parse({ email: " TEST@EXAMPLE.COM ", password: " a " }), { email: "test@example.com", password: " a " });
  for (const value of ["", "a".repeat(73), "é".repeat(37)]) {
    assert.equal(loginSchema.safeParse({ email: identity.email, password: value }).success, false);
  }
});

test("valid active credentials produce only safe authenticated identity", async () => {
  const passwordHash = await hash;
  let lookupEmail = "";
  const result = await authenticateCredentials({ email: " TEST@EXAMPLE.COM ", password }, async (email) => {
    lookupEmail = email;
    return { ...identity, passwordHash };
  });
  assert.equal(lookupEmail, identity.email);
  assert.deepEqual(result, { id: identity.id, name: identity.name, email: identity.email, role: "ADMIN" });
  assert.equal(JSON.stringify(result).includes(passwordHash), false);
});

test("wrong password, unknown email, and inactive account all fail identically", async () => {
  const passwordHash = await hash;
  const record = { ...identity, passwordHash };
  assert.equal(await authenticateCredentials({ email: identity.email, password: "incorrect" }, async () => record), null);
  assert.equal(await authenticateCredentials({ email: identity.email, password }, async () => null), null);
  assert.equal(await authenticateCredentials({ email: identity.email, password }, async () => ({ ...record, isActive: false })), null);
});

test("malformed login does not query persistence", async () => {
  assert.equal(await authenticateCredentials({ email: "invalid", password }, async () => {
    assert.fail("Invalid input must not query persistence");
  }), null);
});

test("active ADMIN passes admin authorization; USER only passes general authorization", async () => {
  const admin = await resolveActiveUser(identity.id, async () => identity);
  assert.equal(assertAdmin(admin).id, identity.id);
  const user = await resolveActiveUser(identity.id, async () => ({ ...identity, role: "USER" }));
  assert.equal(assertAuthenticatedUser(user).id, identity.id);
  assert.throws(() => assertAdmin(user), (error) => error instanceof ApplicationError && error.code === "FORBIDDEN");
});

test("existing session id respects subsequent role change, deactivation, and deletion", async () => {
  let record: typeof identity | null = { ...identity };
  const lookup = async () => record;
  assert.equal(assertAdmin(await resolveActiveUser(identity.id, lookup)).role, "ADMIN");
  record = { ...identity, role: "USER" };
  const demoted = await resolveActiveUser(identity.id, lookup);
  assert.throws(() => assertAdmin(demoted), (error) => error instanceof ApplicationError && error.code === "FORBIDDEN");
  record = { ...identity, isActive: false };
  const inactive = await resolveActiveUser(identity.id, lookup);
  assert.equal(inactive, null);
  assert.throws(() => assertAuthenticatedUser(inactive), (error) => error instanceof ApplicationError && error.code === "UNAUTHENTICATED");
  record = null;
  assert.equal(await resolveActiveUser(identity.id, lookup), null);
});

test("missing session cannot reach a database lookup or protected identity", async () => {
  const user = await resolveActiveUser(undefined, async () => { assert.fail("No session must not query persistence"); });
  assert.throws(() => assertAdmin(user), (error) => error instanceof ApplicationError && error.code === "UNAUTHENTICATED");
});

test("destinations are fixed internal paths based on authoritative role", () => {
  assert.equal(getLoginDestination("ADMIN"), "/admin");
  assert.equal(getLoginDestination("USER"), "/home");
});
