// Opt-in production browser verification. Playwright is supplied by the test environment,
// not an application dependency. See README for environment variables and invocation.
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { pathToFileURL } from "node:url";
import { mkdir } from "node:fs/promises";
import { join } from "node:path";
import nextEnv from "@next/env";
import { getPrisma, disconnectDatabase } from "../lib/db/prisma.ts";
import { createUser } from "../services/user.service.ts";
import { checkIn, checkOut } from "../services/attendance.service.ts";
import { saveDailyReport } from "../services/daily-report.service.ts";

nextEnv.loadEnvConfig(process.cwd());
const base = process.env.TEST_BASE_URL ?? "http://127.0.0.1:3000";
assert.ok(["127.0.0.1", "localhost"].includes(new URL(base).hostname), "Local server required.");
assert.ok(process.env.PLAYWRIGHT_MODULE_PATH, "Set PLAYWRIGHT_MODULE_PATH to Playwright's index.mjs.");
const { chromium } = await import(pathToFileURL(process.env.PLAYWRIGHT_MODULE_PATH).href);
const db = getPrisma();
const ids = [];
const scheduleId = randomUUID();
const marker = `browser-authorization-${randomUUID()}`;
const password = randomUUID();
let browser;
let stage = "fixtures";
async function cleanup() {
  const records = await db.overtimeAuthorization.findMany({ where: { attendance: { userId: { in: ids } } }, select: { id: true } });
  await db.auditLog.deleteMany({ where: { entityId: { in: [...ids, ...records.map(row => row.id)] } } });
  await db.overtimeAuthorization.deleteMany({ where: { id: { in: records.map(row => row.id) } } });
  await db.dailyReport.deleteMany({ where: { attendance: { userId: { in: ids } } } });
  await db.attendance.deleteMany({ where: { userId: { in: ids } } });
  await db.user.deleteMany({ where: { id: { in: ids } } });
  await db.workSchedule.deleteMany({ where: { id: scheduleId } });
}
try {
  await db.workSchedule.create({ data: { id: scheduleId, name: marker, requiredWorkMinutes: 480 } });
  async function fixture(role) {
    const user = await createUser({ name: `${marker} ${role}`, email: `${randomUUID()}@example.com`, password, role, isActive: true, workScheduleId: scheduleId }, { actorId: null });
    ids.push(user.id); return user;
  }
  const admin = await fixture("ADMIN"), worker = await fixture("USER");
  const evidence = { latitude: -6.2, longitude: 106.8, accuracy: 12, timezone: "Asia/Jakarta" };
  const attendances = [];
  for (let day = 1; day <= 7; day++) {
    const date = `2026-09-${String(day).padStart(2, "0")}`;
    const record = await checkIn(worker.id, evidence, () => new Date(`${date}T16:30:00Z`));
    await saveDailyReport(worker.id, { content: `Browser report ${day}\nRead-only evidence` });
    if (day < 7) await checkOut(worker.id, { ...evidence, timezone: "Asia/Makassar", description: "Finished inspection" }, () => new Date(new Date(`${date}T16:30:00Z`).getTime() + 9 * 3600000));
    attendances.push(record);
  }
  const original = await db.attendance.findMany({ where: { userId: worker.id }, include: { dailyReport: true }, orderBy: { id: "asc" } });
  browser = await chromium.launch({ headless: true, ...(process.env.BROWSER_EXECUTABLE ? { executablePath: process.env.BROWSER_EXECUTABLE } : {}) });
  const context = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
  const page = await context.newPage();
  async function login(targetPage, user) {
    await targetPage.goto(`${base}/login`);
    await targetPage.getByLabel("Email", { exact: true }).fill(user.email);
    await targetPage.getByLabel("Password", { exact: true }).fill(password);
    await targetPage.getByRole("button", { name: "Sign In", exact: true }).click();
    await targetPage.waitForURL(`${base}${user.role === "ADMIN" ? "/admin" : "/home"}`);
    await targetPage.waitForLoadState("networkidle");
  }
  const url = `${base}/admin/overtime?from=2026-09-01&to=2026-09-30&userId=${worker.id}&pageSize=5`;
  const visibleTable = () => page.getByRole("table");
  const rows = () => visibleTable().locator("tbody > tr");
  async function settle() { await page.waitForLoadState("networkidle"); await visibleTable().waitFor(); }
  async function workspace() { await page.goto(url); await settle(); }
  stage = "login and completed-only pagination";
  await login(page, admin); await workspace();
  assert.equal(await rows().count(), 5);
  assert.equal(await rows().first().locator("td").first().innerText(), "2026-09-06");
  const next = page.getByRole("link", { name: "Next", exact: true });
  await next.click(); await page.waitForURL(u => u.searchParams.get("page") === "2"); await settle();
  assert.equal(await rows().count(), 1);
  assert.equal(await rows().first().locator("td").first().innerText(), "2026-09-01");
  await workspace();
  stage = "grant confirmation, pending controls and server action capture";
  const requests = {};
  let capture = "grant";
  page.on("request", request => {
    if (request.method() === "POST" && request.headers()["next-action"]) requests[capture] = { headers: request.headers(), body: request.postData() };
  });
  await rows().first().getByRole("button", { name: "Grant", exact: true }).click();
  const grantForm = page.getByRole("form", { name: `Grant overtime for ${worker.name}`, exact: true });
  assert.ok((await grantForm.innerText()).includes("2026-09-06"));
  await grantForm.getByRole("textbox").fill("  Browser approved  ");
  let release;
  const gate = new Promise(resolve => { release = resolve; });
  await page.route("**/admin/overtime**", async route => {
    if (route.request().method() === "POST") await gate;
    await route.continue();
  });
  await grantForm.getByRole("button", { name: "Confirm grant", exact: true }).click();
  await page.getByRole("button", { name: "Saving…", exact: true }).waitFor();
  assert.ok(await page.getByRole("button", { name: "Saving…", exact: true }).isDisabled());
  assert.ok(await grantForm.getByRole("button", { name: "Cancel", exact: true }).isDisabled());
  release();
  await rows().first().getByRole("button", { name: "Revoke", exact: true }).waitFor(); await settle();
  await page.unroute("**/admin/overtime**");
  assert.equal(await rows().first().getByRole("status").innerText(), "Overtime authorized.");
  assert.ok((await rows().first().innerText()).includes("Browser approved"));
  const auth = await db.overtimeAuthorization.findUniqueOrThrow({ where: { attendanceId: attendances[5].id } });
  assert.equal(auth.grantedById, admin.id); assert.equal(auth.note, "Browser approved");
  stage = "revoke and re-authorize visible current row";
  capture = "revoke";
  await rows().first().getByRole("button", { name: "Revoke", exact: true }).click();
  await page.getByRole("button", { name: "Confirm revoke", exact: true }).click();
  await rows().first().getByRole("button", { name: "Re-authorize", exact: true }).waitFor(); await settle();
  assert.ok((await rows().first().innerText()).includes("Revoked"));
  await page.getByLabel("Authorization state", { exact: true }).selectOption("revoked");
  await page.getByRole("button", { name: "Apply filters", exact: true }).click();
  await page.waitForURL(u => u.searchParams.get("state") === "revoked"); await settle();
  assert.equal(await rows().count(), 1);
  await rows().first().getByRole("button", { name: "Re-authorize", exact: true }).click();
  await page.getByRole("form", { name: `Re-authorize overtime for ${worker.name}` }).getByRole("textbox").fill("");
  capture = "regrant";
  await page.getByRole("button", { name: "Confirm re-authorize", exact: true }).click();
  // A re-authorized row correctly leaves the active Revoked filter.
  await visibleTable().getByText("No completed attendance matches these filters.", { exact: true }).waitFor(); await settle();
  assert.equal((await db.overtimeAuthorization.findUniqueOrThrow({ where: { attendanceId: attendances[5].id } })).id, auth.id);
  stage = "filters and attendance details";
  await page.getByLabel("Authorization state", { exact: true }).selectOption("authorized");
  await page.getByRole("button", { name: "Apply filters", exact: true }).click();
  await page.waitForURL(u => u.searchParams.get("state") === "authorized"); await settle();
  assert.equal(await rows().count(), 1);
  await rows().first().getByRole("link", { name: "Attendance details", exact: true }).click();
  await page.waitForURL(`${base}/admin/attendance/${attendances[5].id}`); await page.waitForLoadState("networkidle");
  await page.getByRole("heading", { name: "Attendance details", exact: true }).waitFor();
  for (const text of ["Browser report 6", "Asia/Jakarta", "Asia/Makassar", "Finished inspection"]) {
    stage = `settled attendance detail: ${text}`;
    await page.getByRole("main").getByText(text, { exact: false }).first().waitFor();
  }
  stage = "responsive workspace and confirmation overflow";
  await workspace();
  for (const width of [375, 768, 1024, 1440]) {
    await page.setViewportSize({ width, height: 1000 }); await settle();
    assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1));
    await rows().first().getByRole("button", { name: "Revoke", exact: true }).click();
    assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1));
    await page.getByRole("button", { name: "Cancel", exact: true }).click();
    assert.ok(await rows().first().getByRole("button", { name: "Revoke", exact: true }).evaluate(element => element === document.activeElement));
    if (process.env.TEST_SCREENSHOT_DIR) {
      await mkdir(process.env.TEST_SCREENSHOT_DIR, { recursive: true });
      await page.getByRole("region", { name: "Overtime authorization", exact: true }).evaluate(element => { element.scrollLeft = 0; });
      await page.screenshot({ path: join(process.env.TEST_SCREENSHOT_DIR, `authorization-${width}.png`), fullPage: true });
    }
  }
  stage = "direct action authorization and actor spoofing";
  assert.ok(requests.grant && requests.revoke);
  async function replay(targetContext, request, body = request.body) {
    const response = await targetContext.request.post(`${base}/admin/overtime`, { headers: { "next-action": request.headers["next-action"], "content-type": request.headers["content-type"], Origin: base }, data: body });
    const text = await response.text();
    assert.ok(text.includes('"success":false'));
  }
  const guest = await browser.newContext();
  const workerContext = await browser.newContext();
  await login(await workerContext.newPage(), worker);
  for (const request of [requests.grant, requests.revoke]) { await replay(guest, request); await replay(workerContext, request); }
  const payload = JSON.parse(requests.grant.body);
  payload[0].actorId = worker.id;
  await replay(context, requests.grant, JSON.stringify(payload));
  await db.user.update({ where: { id: admin.id }, data: { role: "USER" } });
  for (const request of [requests.grant, requests.revoke]) await replay(context, request);
  await db.user.update({ where: { id: admin.id }, data: { role: "ADMIN", isActive: false } });
  for (const request of [requests.grant, requests.revoke]) await replay(context, request);
  await db.user.update({ where: { id: admin.id }, data: { isActive: true } });
  stage = "safe error feedback and unchanged evidence";
  await db.user.update({ where: { id: worker.id }, data: { isActive: false } });
  await workspace();
  await rows().nth(1).getByRole("button", { name: "Grant", exact: true }).click();
  await page.getByRole("button", { name: "Confirm grant", exact: true }).click();
  await page.getByRole("alert").filter({ hasText: "inactive user" }).waitFor();
  assert.deepEqual(await db.attendance.findMany({ where: { userId: worker.id }, include: { dailyReport: true }, orderBy: { id: "asc" } }), original);
  assert.ok(!(await page.content()).includes("passwordHash"));
  const audits = await db.auditLog.findMany({ where: { entityId: auth.id } });
  assert.equal(audits.length, 3); assert.ok(audits.every(row => row.actorId === admin.id));
  console.log("Phase 8 production browser passed: completed-only rows, current visible table after streamed navigation, pagination, filters, lifecycle/notes, pending/error feedback, details, 375/768/1024/1440 overflow, direct action security, spoof rejection and immutable attendance.");
} catch (error) {
  const line = /overtime-authorization\.browser\.mjs:(\d+):/.exec(error.stack ?? "")?.[1] ?? "unknown";
  console.error(`Phase 8 browser failed during ${stage} (${error.name}, test line ${line}). Sensitive details omitted.`); process.exitCode = 1;
} finally { if (browser) await browser.close(); await cleanup(); await disconnectDatabase(); }
