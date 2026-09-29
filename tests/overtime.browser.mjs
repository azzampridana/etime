// Opt-in local production browser tests. All evidence uses an explicitly isolated temp root.
import assert from "node:assert/strict";
import { randomUUID, randomBytes } from "node:crypto";
import { pathToFileURL } from "node:url";
import path from "node:path";
import { tmpdir } from "node:os";
import { mkdir } from "node:fs/promises";
import nextEnv from "@next/env";
import sharp from "sharp";
import { getPrisma, disconnectDatabase } from "../lib/db/prisma.ts";
import { LocalStorage } from "../lib/storage/local-storage.ts";
import { createUser } from "../services/user.service.ts";
import { checkIn, checkOut } from "../services/attendance.service.ts";
import { saveDailyReport } from "../services/daily-report.service.ts";
import { grantOvertimeAuthorization as grant, revokeOvertimeAuthorization as revoke } from "../services/overtime-authorization.service.ts";

nextEnv.loadEnvConfig(process.cwd());
const base = process.env.TEST_BASE_URL ?? "http://127.0.0.1:3000";
assert.ok(["127.0.0.1", "localhost"].includes(new URL(base).hostname));
const storageRoot = path.resolve(process.env.TEST_STORAGE_ROOT ?? "");
assert.equal(path.dirname(storageRoot), path.resolve(tmpdir()), "An isolated temp storage directory is required.");
assert.ok(path.basename(storageRoot).startsWith("etime-phase9-browser-"));
assert.ok(process.env.PLAYWRIGHT_MODULE_PATH);
const { chromium } = await import(pathToFileURL(process.env.PLAYWRIGHT_MODULE_PATH).href);
const db = getPrisma(), storage = new LocalStorage(storageRoot), ids = [], scheduleId = randomUUID(), password = randomUUID();
let browser, stage = "fixtures";
async function cleanup() {
  const authorizations = await db.overtimeAuthorization.findMany({ where: { attendance: { userId: { in: ids } } }, select: { id: true } });
  const authorizationIds = authorizations.map(row => row.id);
  const records = await db.overtime.findMany({ where: { authorizationId: { in: authorizationIds } } });
  for (const row of records) for (const key of [row.checkInPhotoPath, row.checkOutPhotoPath]) if (key) await storage.delete(key);
  await db.overtime.deleteMany({ where: { authorizationId: { in: authorizationIds } } });
  await db.overtimeAuthorization.deleteMany({ where: { id: { in: authorizationIds } } });
  await db.dailyReport.deleteMany({ where: { attendance: { userId: { in: ids } } } });
  await db.attendance.deleteMany({ where: { userId: { in: ids } } });
  await db.auditLog.deleteMany({ where: { entityId: { in: [...ids, ...authorizationIds] } } });
  await db.user.deleteMany({ where: { id: { in: ids } } });
  await db.workSchedule.deleteMany({ where: { id: scheduleId } });
}
try {
  await db.workSchedule.create({ data: { id: scheduleId, name: `browser-overtime-${scheduleId}`, requiredWorkMinutes: 480 } });
  async function fixture(name, role = "USER") {
    const user = await createUser({ name, email: `${randomUUID()}@example.com`, password, role, isActive: true, workScheduleId: scheduleId }, { actorId: null });
    ids.push(user.id); return user;
  }
  const admin = await fixture("Overtime administrator", "ADMIN"), worker = await fixture("Overtime worker"), other = await fixture("Other worker");
  const evidence = { latitude: -6.2, longitude: 106.8, accuracy: 12, timezone: "Asia/Jakarta" };
  const regular = await checkIn(worker.id, evidence, () => new Date("2026-09-01T01:00:00Z"));
  await saveDailyReport(worker.id, { content: "Browser regular report" });
  await checkOut(worker.id, evidence, () => new Date("2026-09-01T09:00:00Z"));
  const original = await db.attendance.findUniqueOrThrow({ where: { id: regular.id }, include: { dailyReport: true } });
  const photo = await sharp(randomBytes(1600 * 1200 * 3), { raw: { width: 1600, height: 1200, channels: 3 } }).jpeg({ quality: 98 }).toBuffer();
  assert.ok(photo.length > 1024 * 1024 && photo.length < 10 * 1024 * 1024, "Exercise a real upload above Next's former 1 MB default.");
  browser = await chromium.launch({ headless: true, ...(process.env.BROWSER_EXECUTABLE ? { executablePath: process.env.BROWSER_EXECUTABLE } : {}) });
  const context = await browser.newContext({ viewport: { width: 375, height: 850 }, timezoneId: "Asia/Jakarta", geolocation: { latitude: -6.2, longitude: 106.8, accuracy: 12 } });
  let page = await context.newPage();
  async function login(target, user) {
    await target.goto(`${base}/login`); await target.getByLabel("Email", { exact: true }).fill(user.email); await target.getByLabel("Password", { exact: true }).fill(password);
    await target.getByRole("button", { name: "Sign In", exact: true }).click(); await target.waitForURL(`${base}${user.role === "ADMIN" ? "/admin" : "/home"}`); await target.waitForLoadState("networkidle");
  }
  async function overtime(heading) {
    await page.goto(`${base}/overtime`); await page.getByRole("heading", { name: heading, exact: true }).waitFor(); await page.waitForLoadState("networkidle");
  }
  async function responsive(state) {
    for (const width of [320, 375, 390, 430]) {
      await page.setViewportSize({ width, height: 850 });
      assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), `${state} overflow at ${width}`);
      if (process.env.TEST_SCREENSHOT_DIR && width === 375) {
        await mkdir(process.env.TEST_SCREENSHOT_DIR, { recursive: true });
        await page.screenshot({ path: path.join(process.env.TEST_SCREENSHOT_DIR, `overtime-${state}-${width}.png`), fullPage: true });
      }
    }
  }
  stage = "unavailable and authorized states";
  await login(page, worker); await overtime("Overtime");
  await page.getByText(/No overtime authorization is currently available/).waitFor(); await responsive("unavailable");
  await grant(admin.id, { attendanceId: regular.id, note: "Inspect the evening work area" });
  await overtime("Overtime authorized"); await responsive("authorized");
  const submit = () => page.getByRole("button", { name: "Overtime Check In", exact: true });
  assert.ok(await submit().isDisabled());
  stage = "GPS permission error and retry";
  await page.evaluate(() => { Object.defineProperty(navigator, "geolocation", { configurable: true, value: { getCurrentPosition: (_success, failure) => failure({ code: 1 }) } }); });
  await page.getByRole("button", { name: "Get location", exact: true }).click();
  await page.getByRole("alert").filter({ hasText: "Location permission is required" }).waitFor();
  await page.getByRole("button", { name: "Try Again", exact: true }).waitFor();
  await context.grantPermissions(["geolocation"]); await page.reload(); await page.getByRole("heading", { name: "Overtime authorized", exact: true }).waitFor();
  await page.getByRole("button", { name: "Get location", exact: true }).click(); await page.getByText("Location detected", { exact: true }).waitFor();
  assert.ok(await submit().isDisabled());
  await page.getByLabel("Overtime description (required)").fill(" ");
  await page.getByLabel("Photo evidence (required)").setInputFiles({ name: "camera.jpg", mimeType: "image/jpeg", buffer: photo });
  await page.getByAltText("Selected photo preview (not yet saved)").waitFor(); assert.ok(await submit().isDisabled());
  const longDescription = `Evening inspection. ${"Detailed field observations ".repeat(25)}`;
  await page.getByLabel("Overtime description (required)").fill(longDescription);
  stage = "corrupt-photo feedback without mutation";
  await page.getByLabel("Photo evidence (required)").setInputFiles({ name: "fake.jpg", mimeType: "image/jpeg", buffer: Buffer.from("not a photo") });
  await submit().click(); await page.getByRole("status").filter({ hasText: "Photo could not be processed" }).waitFor();
  assert.equal(await db.overtime.count({ where: { authorization: { attendance: { userId: worker.id } } } }), 0);
  await page.getByLabel("Photo evidence (required)").setInputFiles({ name: "camera.jpg", mimeType: "image/jpeg", buffer: photo });
  stage = "check-in pending and persisted open state";
  let checkInRequest;
  const captureCheckIn = request => {
    if (request.method() === "POST" && request.headers()["next-action"]) checkInRequest = { headers: request.headers(), body: request.postDataBuffer() };
  };
  page.on("request", captureCheckIn);
  async function submitWithPending(button) {
    let release; const gate = new Promise(resolve => { release = resolve; });
    await page.route("**/overtime", async route => { if (route.request().method() === "POST") await gate; await route.continue(); });
    const response = page.waitForResponse(result => result.request().method() === "POST" && new URL(result.url()).pathname === "/overtime");
    await button.click(); await page.getByRole("button", { name: "Saving overtime…", exact: true }).waitFor();
    assert.ok(await page.getByRole("button", { name: "Saving overtime…", exact: true }).isDisabled());
    assert.ok(await page.getByLabel("Photo evidence (required)").isDisabled()); release();
    await response;
    await page.unroute("**/overtime");
  }
  await submitWithPending(submit());
  await page.getByRole("heading", { name: "Overtime in progress", exact: true }).waitFor();
  page.off("request", captureCheckIn);
  await overtime("Overtime in progress");
  assert.ok(await page.getByRole("button", { name: "Overtime Check Out", exact: true }).isDisabled());
  const row = await db.overtime.findFirstOrThrow({ where: { authorization: { attendance: { userId: worker.id } } } });
  assert.equal(row.checkInTimezone, "Asia/Jakarta");
  const imageUrl = `/api/overtime/${row.id}/photo/check-in`;
  const response = await context.request.get(`${base}${imageUrl}`);
  assert.equal(response.status(), 200); assert.ok(response.headers()["cache-control"].includes("no-store"));
  assert.equal(response.headers()["content-type"], "image/jpeg");
  const processed = await response.body(); assert.ok(!processed.equals(photo)); assert.equal((await sharp(processed).metadata()).format, "jpeg");
  assert.ok(processed.length <= 1024 * 1024, "Noisy fixture should meet the adaptive-compression target.");
  await page.getByAltText("Processed overtime Check-In photo evidence").waitFor(); await responsive("open");
  stage = "protected photo ownership, guest and inactive access";
  const guest = await browser.newContext(), otherContext = await browser.newContext();
  await login(await otherContext.newPage(), other);
  async function deniedAction(targetContext) {
    assert.ok(checkInRequest?.body);
    const response = await targetContext.request.post(`${base}/overtime`, { headers: { Origin: base, "next-action": checkInRequest.headers["next-action"], "content-type": checkInRequest.headers["content-type"] }, data: checkInRequest.body });
    assert.ok((await response.text()).includes('"success":false'));
  }
  await deniedAction(guest); await deniedAction(otherContext);
  assert.equal((await guest.request.get(`${base}${imageUrl}`)).status(), 401);
  assert.equal((await otherContext.request.get(`${base}${imageUrl}`)).status(), 404);
  assert.equal((await context.request.get(`${base}/api/overtime/${randomUUID()}/photo/check-in`)).status(), 404);
  assert.equal((await context.request.get(`${base}/api/overtime/${row.id}/photo/check-out`)).status(), 404);
  await db.user.update({ where: { id: worker.id }, data: { isActive: false } });
  await deniedAction(context);
  assert.equal((await context.request.get(`${base}${imageUrl}`)).status(), 401);
  await db.user.update({ where: { id: worker.id }, data: { isActive: true } });
  stage = "revocation after start, fresh checkout evidence and different timezone";
  await revoke(admin.id, { attendanceId: regular.id });
  const checkoutContext = await browser.newContext({ viewport: { width: 375, height: 850 }, timezoneId: "Asia/Makassar", geolocation: { latitude: -5.1, longitude: 119.4, accuracy: 9 }, permissions: ["geolocation"] });
  await checkoutContext.addCookies(await context.cookies()); page = await checkoutContext.newPage();
  await overtime("Overtime in progress"); await page.getByText(/You can still check out this existing session/).waitFor();
  await page.getByRole("button", { name: "Get location", exact: true }).click(); await page.getByText("Location detected", { exact: true }).waitFor();
  await page.getByLabel("Overtime description (required)").fill("Completed evening inspection in another region.");
  assert.ok(await page.getByRole("button", { name: "Overtime Check Out", exact: true }).isDisabled());
  await page.getByLabel("Photo evidence (required)").setInputFiles({ name: "checkout.png", mimeType: "image/png", buffer: await sharp(photo).png().toBuffer() });
  const checkoutButton = page.getByRole("button", { name: "Overtime Check Out", exact: true });
  await checkoutButton.scrollIntoViewIfNeeded();
  const buttonBox = await checkoutButton.boundingBox(), navBox = await page.getByRole("navigation").boundingBox();
  assert.ok(buttonBox && navBox && buttonBox.y + buttonBox.height <= navBox.y + 1, "Submit control must clear bottom navigation");
  await submitWithPending(checkoutButton);
  await page.getByRole("heading", { name: "Overtime completed", exact: true }).waitFor(); await overtime("Overtime completed");
  await page.getByText(/OT Duration:/).waitFor();
  await page.getByAltText("Processed overtime Check-Out photo evidence").waitFor(); await responsive("completed");
  const completed = await db.overtime.findUniqueOrThrow({ where: { id: row.id } });
  assert.equal(completed.checkOutTimezone, "Asia/Makassar"); assert.equal(completed.checkOutLatitude, -5.1);
  assert.notEqual(completed.checkInPhotoPath, completed.checkOutPhotoPath);
  assert.equal((await checkoutContext.request.get(`${base}/api/overtime/${row.id}/photo/check-out`)).status(), 200);
  assert.equal((await otherContext.request.get(`${base}/api/overtime/${row.id}/photo/check-out`)).status(), 404);
  assert.deepEqual(await db.attendance.findUniqueOrThrow({ where: { id: regular.id }, include: { dailyReport: true } }), original);
  stage = "worker regular workflow regression with shared geolocation";
  const otherPage = await otherContext.newPage(); await otherContext.grantPermissions(["geolocation"]); await otherContext.setGeolocation({ latitude: -6.2, longitude: 106.8, accuracy: 10 });
  await otherPage.goto(`${base}/attendance`); await otherPage.getByRole("button", { name: "Get location", exact: true }).click(); await otherPage.getByText("Location detected", { exact: true }).waitFor();
  await otherPage.getByRole("button", { name: "Check In", exact: true }).click();
  await otherPage.getByRole("heading", { name: "Daily Report", exact: true }).waitFor();
  await otherPage.getByLabel("Work completed", { exact: true }).fill("Regular workflow regression report");
  await otherPage.getByRole("button", { name: "Save Daily Report", exact: true }).click();
  await otherPage.getByText("Your report is saved. You can update it until checkout.", { exact: true }).waitFor();
  await otherPage.getByRole("button", { name: "Get location", exact: true }).click(); await otherPage.getByText("Location detected", { exact: true }).waitFor();
  await otherPage.getByRole("button", { name: "Check Out", exact: true }).click();
  await otherPage.getByRole("heading", { name: "Completed attendance", exact: true }).first().waitFor();
  console.log(`Phase 9 production browser passed: 320/375/390/430px, persisted states, GPS error/retry, required inputs, generated photo preview, corrupt-image feedback, pending states, protected photos/actions, different checkout timezone, revoked-session closure, duration, bottom navigation, overflow and full regular workflow. Input ${photo.length} bytes; processed ${processed.length} bytes. No physical camera/GPS testing performed.`);
} catch (error) {
  const line = /overtime\.browser\.mjs:(\d+):/.exec(error.stack ?? "")?.[1] ?? "unknown";
  console.error(`Overtime browser failed during ${stage} (${error.name}, line ${line}). Sensitive details omitted.`); process.exitCode = 1;
} finally { if (browser) await browser.close(); await cleanup(); await disconnectDatabase(); }
