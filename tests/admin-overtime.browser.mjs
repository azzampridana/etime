// Production browser verification with UUID-scoped data and private temporary photos.
import assert from "node:assert/strict";
import path from "node:path";
import { tmpdir } from "node:os";
import { mkdir } from "node:fs/promises";
import { pathToFileURL } from "node:url";
import nextEnv from "@next/env";
import { getPrisma, disconnectDatabase } from "../lib/db/prisma.ts";
import { LocalStorage } from "../lib/storage/local-storage.ts";
import { createMonitoringFixture } from "./admin-overtime.fixture.ts";

nextEnv.loadEnvConfig(process.cwd());
const base = process.env.TEST_BASE_URL ?? "http://127.0.0.1:3000";
assert.ok(["127.0.0.1", "localhost"].includes(new URL(base).hostname));
const storageRoot = path.resolve(process.env.TEST_STORAGE_ROOT ?? "");
assert.equal(path.dirname(storageRoot), path.resolve(tmpdir()));
assert.ok(path.basename(storageRoot).startsWith("etime-phase9-browser-"), "Share the isolated Phase 9 regression storage setup.");
assert.ok(process.env.PLAYWRIGHT_MODULE_PATH);
const { chromium } = await import(pathToFileURL(process.env.PLAYWRIGHT_MODULE_PATH).href);
const db = getPrisma(), storage = new LocalStorage(storageRoot);
let fixture, browser, stage = "fixtures";
try {
  fixture = await createMonitoringFixture(storage);
  const { admin, worker, inactive, other, marker, password, rows } = fixture;
  const before = await fixture.snapshot();
  browser = await chromium.launch({ headless: true, ...(process.env.BROWSER_EXECUTABLE ? { executablePath: process.env.BROWSER_EXECUTABLE } : {}) });
  const adminContext = await browser.newContext({ viewport: { width: 1440, height: 950 } });
  const page = await adminContext.newPage();
  const activity = `${base}/admin/overtime/activity`;
  const query = new URLSearchParams({ from: "2026-09-01", to: "2026-09-03", search: marker, pageSize: "5" });
  async function login(target, person) {
    await target.goto(`${base}/login`); await target.getByLabel("Email", { exact: true }).fill(person.email); await target.getByLabel("Password", { exact: true }).fill(password);
    await target.getByRole("button", { name: "Sign In", exact: true }).click();
    await target.waitForURL(`${base}${person.role === "ADMIN" ? "/admin" : "/home"}`); await target.waitForLoadState("networkidle");
  }
  async function settled(heading) {
    await page.getByRole("heading", { name: heading, exact: true }).waitFor({ state: "visible" });
    await page.waitForLoadState("networkidle");
  }
  const table = () => page.getByRole("table").filter({ visible: true });
  async function list(params = query) { await page.goto(`${activity}?${params}`); await settled("Overtime activity"); }
  async function apply() { await page.getByRole("button", { name: "Apply filters", exact: true }).click(); await settled("Overtime activity"); }
  async function responsive(name) {
    for (const width of [375, 768, 1024, 1440]) {
      await page.setViewportSize({ width, height: 950 });
      assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), `${name} page overflow at ${width}`);
      if (process.env.TEST_SCREENSHOT_DIR) {
        await mkdir(process.env.TEST_SCREENSHOT_DIR, { recursive: true });
        await page.screenshot({ path: path.join(process.env.TEST_SCREENSHOT_DIR, `admin-overtime-${name}-${width}.png`), fullPage: true });
      }
    }
  }
  stage = "authorization/activity navigation and default range";
  await login(page, admin); await page.goto(`${base}/admin/overtime`); await settled("Overtime authorization");
  await page.getByRole("navigation", { name: "Overtime sections" }).getByRole("link", { name: "Activity", exact: true }).click();
  await page.waitForURL(activity); await settled("Overtime activity");
  assert.equal(await page.getByRole("navigation", { name: "Overtime sections" }).getByRole("link", { name: "Activity", exact: true }).getAttribute("aria-current"), "page");
  const today = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Jakarta", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date());
  assert.equal(await page.getByLabel("Date From", { exact: true }).inputValue(), `${today.slice(0, 7)}-01`);
  assert.equal(await page.getByLabel("Date To", { exact: true }).inputValue(), today);
  stage = "pagination with visible current streamed table";
  await list(); assert.equal(await table().locator("tbody tr").count(), 5);
  const firstIds = await table().getByRole("link", { name: "Details", exact: true }).evaluateAll(links => links.map(link => link.getAttribute("href")));
  await page.getByRole("navigation", { name: "Pagination" }).getByRole("link", { name: "Next", exact: true }).click();
  await page.waitForURL(url => url.searchParams.get("page") === "2"); await settled("Overtime activity");
  assert.equal(await table().locator("tbody tr").count(), 1);
  assert.ok(!firstIds.includes(await table().getByRole("link", { name: "Details", exact: true }).getAttribute("href")));
  await page.getByRole("navigation", { name: "Pagination" }).getByRole("link", { name: "Previous", exact: true }).click();
  await page.waitForURL(url => url.searchParams.get("page") === "1"); await settled("Overtime activity");
  assert.deepEqual(await table().getByRole("link", { name: "Details", exact: true }).evaluateAll(links => links.map(link => link.getAttribute("href"))), firstIds);
  await responsive("list");
  stage = "state, employee, work-date filters and empty/invalid states";
  await page.getByLabel("State", { exact: true }).selectOption("open"); await apply();
  await page.waitForURL(url => url.searchParams.get("state") === "open"); await settled("Overtime activity");
  assert.equal(await table().locator("tbody tr").count(), 1);
  const cells = await table().locator("tbody tr").first().locator("td").allTextContents();
  assert.equal(cells[3], "—"); assert.equal(cells[4], "Open"); assert.equal(cells[5], "—");
  await table().getByRole("link", { name: "Details", exact: true }).click(); await settled("Overtime details");
  await page.getByText("Checkout evidence and final overtime duration are not yet available.").waitFor();
  assert.equal(await page.getByRole("heading", { name: "Overtime Check-Out", exact: true }).count(), 0);
  await responsive("open");
  await list(); await page.getByLabel("State", { exact: true }).selectOption("completed"); await apply();
  await page.waitForURL(url => url.searchParams.get("state") === "completed"); await settled("Overtime activity");
  assert.equal(await table().locator("tbody tr").count(), 5);
  await page.getByLabel("Employee name or email").fill(inactive.email); await apply();
  await page.waitForURL(url => url.searchParams.get("search") === inactive.email); await settled("Overtime activity");
  assert.equal(await table().locator("tbody tr").count(), 3);
  await page.getByLabel("Date From", { exact: true }).fill("2026-09-01"); await page.getByLabel("Date To", { exact: true }).fill("2026-09-01"); await apply();
  await page.waitForURL(url => url.searchParams.get("to") === "2026-09-01"); await settled("Overtime activity");
  assert.equal(await table().locator("tbody tr").count(), 1);
  await list(); await page.getByLabel("User", { exact: true }).fill(inactive.email);
  await page.getByRole("button", { name: "Find users", exact: true }).click();
  await page.getByRole("button", { name: `${inactive.name} · ${inactive.email}`, exact: true }).click(); await apply();
  await page.waitForURL(url => url.searchParams.get("userId") === inactive.id); await settled("Overtime activity");
  assert.equal(await table().locator("tbody tr").count(), 3);
  await list(new URLSearchParams({ ...Object.fromEntries(query), search: "no-match-" + marker }));
  await table().getByText("No overtime activity matches these filters.").waitFor();
  await page.goto(`${activity}?pageSize=999`); await settled("Overtime activity");
  assert.equal(await table().count(), 0);
  stage = "completed revoked/inactive detail, protected evidence and timezone display";
  const closed = rows.find(row => row.userId === inactive.id && row.workDate === "2026-09-01");
  const detailUrl = `${activity}/${closed.id}`;
  await page.goto(detailUrl); await settled("Overtime details");
  await page.getByText("Authorization: Revoked", { exact: true }).waitFor();
  await page.getByText("Work date: 2026-09-01", { exact: true }).waitFor();
  await page.getByText("OT Duration: 9h 15m", { exact: true }).waitFor();
  await page.getByRole("heading", { name: "Overtime Check-Out", exact: true }).waitFor();
  assert.match(await page.locator("main").innerText(), /WIB/); assert.match(await page.locator("main").innerText(), /WITA/);
  for (const event of ["Check-In", "Check-Out"]) {
    const img = page.getByAltText(`Processed overtime ${event} photo evidence`);
    await img.scrollIntoViewIfNeeded();
    await page.waitForFunction(image => image.complete && image.naturalWidth > 0, await img.elementHandle());
  }
  assert.equal(await page.getByRole("button", { name: /edit|delete|approve|reject|check out/i }).count(), 0);
  assert.ok(!(await page.content()).includes("passwordHash")); assert.ok(!(await page.content()).includes(storageRoot));
  await responsive("completed");
  const foreign = rows.find(row => row.workDate === "2026-09-02");
  await page.goto(`${activity}/${foreign.id}`); await settled("Overtime details");
  assert.match(await page.locator("main").innerText(), /WIT/); assert.match(await page.locator("main").innerText(), /America\/Los_Angeles/);
  stage = "guest, USER, stale ADMIN and owner photo authorization";
  const ownerRow = rows.find(row => row.userId === worker.id && row.workDate === "2026-09-01");
  const photoUrl = `${base}/api/overtime/${ownerRow.id}/photo/check-in`;
  const adminPhoto = await adminContext.request.get(photoUrl); assert.equal(adminPhoto.status(), 200);
  assert.match(adminPhoto.headers()["content-type"], /image\/jpeg/); assert.match(adminPhoto.headers()["cache-control"], /private.*no-store/);
  const guest = await browser.newContext(), owner = await browser.newContext(), outsider = await browser.newContext();
  async function denied(context, destination) {
    for (const route of [activity, detailUrl]) {
      const response = await context.request.get(route, { maxRedirects: 0 });
      assert.equal(response.status(), 307); assert.ok(response.headers().location.includes(destination));
    }
  }
  await denied(guest, "/login"); assert.equal((await guest.request.get(photoUrl)).status(), 401);
  await login(await owner.newPage(), worker); await denied(owner, "/home"); assert.equal((await owner.request.get(photoUrl)).status(), 200);
  await login(await outsider.newPage(), other); await denied(outsider, "/home"); assert.equal((await outsider.request.get(photoUrl)).status(), 404);
  await db.user.update({ where: { id: admin.id }, data: { role: "USER" } });
  await denied(adminContext, "/home"); assert.equal((await adminContext.request.get(photoUrl)).status(), 404);
  await db.user.update({ where: { id: admin.id }, data: { role: "ADMIN", isActive: false } });
  await denied(adminContext, "/login"); assert.equal((await adminContext.request.get(photoUrl)).status(), 401);
  await db.user.update({ where: { id: admin.id }, data: { isActive: true } });
  await db.user.update({ where: { id: worker.id }, data: { isActive: false } });
  assert.equal((await owner.request.get(photoUrl)).status(), 401);
  await db.user.update({ where: { id: worker.id }, data: { isActive: true } });
  stage = "missing-photo fallback preserves readable detail";
  const persisted = before.overtime.find(row => row.id === closed.id);
  await storage.delete(persisted.checkInPhotoPath);
  await page.goto(detailUrl); await settled("Overtime details");
  // Lazy loading may defer the failed request until the evidence enters the viewport.
  const missingImage = page.getByAltText("Processed overtime Check-In photo evidence");
  if (await missingImage.count()) await missingImage.scrollIntoViewIfNeeded().catch(() => {});
  await page.getByRole("status").filter({ hasText: "Photo evidence is unavailable." }).waitFor();
  await page.getByText("OT Duration: 9h 15m", { exact: true }).waitFor();
  await page.getByRole("navigation", { name: "Overtime sections" }).getByRole("link", { name: "Authorization", exact: true }).click();
  await page.waitForURL(`${base}/admin/overtime`); await settled("Overtime authorization");
  assert.deepEqual(await fixture.snapshot(), before, "All monitoring reads preserve evidence and audit records.");
  console.log("PASS production admin overtime: navigation, filters, pagination/current streamed UI, history, detail, photos/fallback, stale-role authorization, read-only evidence and 375/768/1024/1440px");
} catch (error) { console.error(`Admin overtime browser failed during: ${stage}`); throw error; }
finally { await browser?.close(); await fixture?.cleanup(); await disconnectDatabase(); }
