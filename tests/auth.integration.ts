import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { loadEnvConfig } from "@next/env";
import { disconnectDatabase, getPrisma } from "@/lib/db/prisma";
import { seedEnvironmentSchema } from "@/schemas/seed.schema";
import { createUser } from "@/services/user.service";

// Opt-in integration verification against a running local production build.
// Direct DB access here is restricted to fixture setup, inspection, and cleanup.
loadEnvConfig(process.cwd());
// Tests never call a real geocoder; focused tests inject mocked providers.
process.env.GEOAPIFY_API_KEY = "";
const base = new URL(process.env.NEXTAUTH_URL ?? "http://localhost:3000");
if (!["localhost", "127.0.0.1"].includes(base.hostname)) {
  throw new Error("Integration verification requires a local application URL.");
}

class BrowserSession {
  private cookies = new Map<string, string>();

  async request(path: string, init: RequestInit = {}) {
    const headers = new Headers(init.headers);
    headers.set("Cookie", [...this.cookies].map(([key, value]) => `${key}=${value}`).join("; "));
    if (init.method === "POST") headers.set("Origin", base.origin);
    const response = await fetch(new URL(path, base), { ...init, headers, redirect: "manual" });
    for (const cookie of response.headers.getSetCookie()) {
      const [pair] = cookie.split(";");
      const split = pair.indexOf("=");
      const name = pair.slice(0, split);
      const value = pair.slice(split + 1);
      if (value) this.cookies.set(name, value);
      else this.cookies.delete(name);
    }
    return response;
  }

  async submitForm(path: string, fields: Record<string, string> = {}) {
    const page = await this.request(path);
    assert.equal(page.status, 200);
    const html = await page.text();
    const form = new FormData();
    for (const [input] of html.matchAll(/<input[^>]*type="hidden"[^>]*>/g)) {
      const name = /name="([^"]+)"/.exec(input)?.[1];
      const value = /value="([^"]*)"/.exec(input)?.[1] ?? "";
      if (name) form.set(name, value.replaceAll("&quot;", '"').replaceAll("&#x27;", "'").replaceAll("&amp;", "&"));
    }
    assert.ok([...form.keys()].some((key) => key.startsWith("$ACTION_")));
    for (const [key, value] of Object.entries(fields)) form.set(key, value);
    return this.request(path, { method: "POST", body: form });
  }
}

function checkRedirect(response: Response, path: string) {
  assert.ok([303, 307].includes(response.status));
  assert.equal(new URL(response.headers.get("Location") ?? "", base).pathname, path);
}

async function main() {
  const db = getPrisma();
  const fixtureIds: string[] = [];
  let stage = "bootstrap verification";
  try {
    const environment = seedEnvironmentSchema.parse(process.env);
    const originalAdmin = await db.user.findUniqueOrThrow({ where: { email: environment.SEED_ADMIN_EMAIL } });
    const baseline = { users: await db.user.count(), audits: await db.auditLog.count() };
    const password = `test-${randomUUID()}`;
    async function fixture(role: "ADMIN" | "USER", isActive = true) {
      const user = await createUser({
        name: "Temporary authentication test", email: `auth-test-${randomUUID()}@example.com`,
        password, role, isActive, workScheduleId: originalAdmin.workScheduleId,
      }, { actorId: null });
      fixtureIds.push(user.id);
      return user;
    }
    const admin = await fixture("ADMIN");
    const user = await fixture("USER");
    const inactive = await fixture("USER", false);

    stage = "unauthenticated route protection";
    const guest = new BrowserSession();
    assert.equal((await guest.request("/api/reports/export")).status, 401);
    checkRedirect(await guest.request("/home"), "/login");
    checkRedirect(await guest.request("/admin"), "/login");
    checkRedirect(await guest.request("/"), "/login");
    for (const route of ["/attendance", "/overtime", "/admin/users", "/admin/users/new", "/admin/users/work-schedules", `/admin/users/${user.id}/edit`, "/admin/attendance", `/admin/attendance/${randomUUID()}`, "/admin/overtime", "/admin/overtime/activity", "/admin/reports"]) {
      checkRedirect(await guest.request(route), "/login");
    }

    stage = "seeded ADMIN login and logout";
    const seedSession = new BrowserSession();
    checkRedirect(await seedSession.submitForm("/login", { email: environment.SEED_ADMIN_EMAIL, password: environment.SEED_ADMIN_PASSWORD }), "/");
    assert.equal((await seedSession.request("/admin")).status, 200);
    checkRedirect(await seedSession.submitForm("/admin"), "/login");
    checkRedirect(await seedSession.request("/admin"), "/login");

    stage = "generic credential failures";
    for (const credentials of [
      { email: user.email, password: "incorrect-password" },
      { email: `unknown-${randomUUID()}@example.com`, password },
      { email: inactive.email, password },
    ]) {
      const failed = new BrowserSession();
      const response = await failed.submitForm("/login", credentials);
      assert.equal(response.status, 200);
      assert.ok((await response.text()).includes("Invalid email or password."));
      checkRedirect(await failed.request("/home"), "/login");
    }

    stage = "USER login, routing, and logout";
    const userSession = new BrowserSession();
    checkRedirect(await userSession.submitForm("/login", { email: user.email, password }), "/");
    checkRedirect(await userSession.request("/"), "/home");
    assert.equal((await userSession.request("/home")).status, 200);
    checkRedirect(await userSession.request("/admin"), "/home");
    checkRedirect(await userSession.request("/login"), "/home");
    for (const route of ["/attendance", "/overtime"]) {
      const response = await userSession.request(route);
      assert.equal(response.status, 200);
      assert.ok((await response.text()).includes(route === "/attendance" ? "Regular attendance" : "No overtime authorization is currently available"));
    }
    for (const route of ["/admin/users", "/admin/users/new", "/admin/users/work-schedules", `/admin/users/${user.id}/edit`, "/admin/attendance", `/admin/attendance/${randomUUID()}`, "/admin/overtime", "/admin/overtime/activity", "/admin/reports"]) {
      checkRedirect(await userSession.request(route), "/home");
    }
    assert.equal((await userSession.request("/api/reports/export")).status, 403);
    checkRedirect(await userSession.submitForm("/home"), "/login");
    checkRedirect(await userSession.request("/home"), "/login");
    assert.equal(await (await userSession.request("/api/auth/session")).json(), null);

    stage = "ADMIN identity and safe session";
    const adminSession = new BrowserSession();
    checkRedirect(await adminSession.submitForm("/login", { email: admin.email, password }), "/");
    checkRedirect(await adminSession.request("/"), "/admin");
    checkRedirect(await adminSession.request("/login"), "/admin");
    assert.equal((await adminSession.request("/admin")).status, 200);
    assert.equal((await adminSession.request("/admin/users/work-schedules")).status, 200);
    const reportExport = await adminSession.request(`/api/reports/export?userId=${admin.id}`);
    assert.equal(reportExport.status, 200);
    assert.ok(reportExport.headers.get("Content-Type")?.includes("spreadsheetml.sheet"));
    assert.ok(reportExport.headers.get("Content-Disposition")?.endsWith('.xlsx"'));
    assert.equal(Buffer.from(await reportExport.arrayBuffer()).subarray(0, 2).toString(), "PK");
    assert.equal((await adminSession.request("/api/reports/export?from=bad")).status, 400);
    assert.equal((await adminSession.request("/api/reports/export?from=2026-09-01&from=2026-09-02")).status, 400);
    for (const route of ["/admin/users", "/admin/attendance", "/admin/overtime", "/admin/overtime/activity", "/admin/reports"]) {
      const response = await adminSession.request(route);
      assert.equal(response.status, 200);
      const html = await response.text();
      assert.ok(html.includes(route === "/admin/users" ? "Manage accounts" : route === "/admin/attendance" ? "regular attendance monitoring" : route === "/admin/overtime" ? "Overtime authorization" : route === "/admin/overtime/activity" ? "Overtime activity" : "Factual regular attendance and overtime reporting"));
    }
    const session = await (await adminSession.request("/api/auth/session")).json();
    assert.deepEqual(Object.keys(session.user).sort(), ["email", "id", "name", "role"]);
    assert.equal(session.user.id, admin.id);

    stage = "existing session respects demotion and deactivation";
    await db.user.update({ where: { id: admin.id }, data: { role: "USER" } });
    checkRedirect(await adminSession.request("/admin/reports"), "/home");
    assert.equal((await adminSession.request("/api/reports/export")).status, 403);
    checkRedirect(await adminSession.request("/admin"), "/home");
    checkRedirect(await adminSession.request("/login"), "/home");
    await db.user.update({ where: { id: admin.id }, data: { isActive: false } });
    checkRedirect(await adminSession.request("/admin/reports"), "/login");
    assert.equal((await adminSession.request("/api/reports/export")).status, 401);
    checkRedirect(await adminSession.request("/admin"), "/login");
    checkRedirect(await adminSession.request("/home"), "/login");
    checkRedirect(await adminSession.request("/attendance"), "/login");
    checkRedirect(await adminSession.request("/overtime"), "/login");
    checkRedirect(await adminSession.request("/admin/users"), "/login");
    assert.equal((await adminSession.request("/login")).status, 200);

    stage = "seed preservation and fixture cleanup";
    assert.deepEqual(await db.user.findUniqueOrThrow({ where: { id: originalAdmin.id } }), originalAdmin);
    await db.auditLog.deleteMany({ where: { entityId: { in: fixtureIds } } });
    await db.user.deleteMany({ where: { id: { in: fixtureIds } } });
    assert.equal(await db.user.count(), baseline.users);
    assert.equal(await db.auditLog.count(), baseline.audits);
    console.log("Authentication HTTP integration passed: ADMIN/USER login, generic failures, safe session, logout, redirects, demotion, deactivation, and fixture cleanup.");
  } catch {
    // Never print assertions containing identities, response bodies, cookies, or hashes.
    console.error(`Authentication integration failed during ${stage}. Sensitive details omitted.`);
    process.exitCode = 1;
  } finally {
    try {
      await db.auditLog.deleteMany({ where: { entityId: { in: fixtureIds } } });
      await db.user.deleteMany({ where: { id: { in: fixtureIds } } });
    } catch {
      console.error("Temporary authentication fixture cleanup failed; local database review is needed.");
      process.exitCode = 1;
    }
    await disconnectDatabase();
  }
}

void main();
