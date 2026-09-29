import assert from "node:assert/strict";
import test from "node:test";
import { createGeoapifyGeocoder, resolveEventAddress, normalizeAddress } from "@/lib/geolocation/reverse-geocoding";
import { userPositionSchema } from "@/schemas/user.schema";
import { workScheduleSchema } from "@/schemas/work-schedule.schema";
import { checkInSchema, checkOutSchema } from "@/schemas/attendance.schema";
import { overtimeEvidenceSchema } from "@/schemas/overtime.schema";
import { mapsUrl } from "@/lib/geolocation/maps-url";

test("position and duration-only policy validate without introducing shift semantics", () => {
  assert.equal(userPositionSchema.parse("  Site Engineer  "), "Site Engineer");
  assert.equal(userPositionSchema.parse("   "), null); assert.equal(userPositionSchema.parse(null), null);
  assert.equal(userPositionSchema.safeParse("x".repeat(101)).success, false);
  assert.equal(workScheduleSchema.safeParse({ name: "Flexible", requiredWorkMinutes: 480, isActive: true }).success, true);
  assert.equal(workScheduleSchema.safeParse({ name: "Flexible", requiredWorkMinutes: 480.5, isActive: true }).success, false);
  const evidence = { latitude: -6.2, longitude: 106.8, accuracy: 12, timezone: "Asia/Jakarta", description: "Inspection", address: "Untrusted address" };
  for (const schema of [checkInSchema, checkOutSchema, overtimeEvidenceSchema]) assert.equal(schema.safeParse(evidence).success, false);
  assert.equal(new URL(mapsUrl(-6.2, 106.8)).searchParams.get("query"), "-6.2,106.8");
});

test("Geoapify response normalization, failures and timeout remain non-blocking with mocked HTTP", async () => {
  const coordinates = { latitude: -6.2, longitude: 106.8 };
  const mockFetch: typeof fetch = async (url, options) => {
    const request = new URL(String(url)); assert.equal(request.hostname, "api.geoapify.com");
    assert.equal(request.searchParams.get("lat"), "-6.2"); assert.equal(options?.cache, "no-store"); assert.ok(options?.signal);
    return Response.json({ results: [{ formatted: " Jalan Sudirman , Jakarta, Jakarta , Indonesia " }] });
  };
  assert.equal(await resolveEventAddress(coordinates, createGeoapifyGeocoder("mock-key", mockFetch)), "Jalan Sudirman, Jakarta, Indonesia");
  assert.equal(normalizeAddress("x".repeat(600))?.length, 500);
  for (const response of [new Response("rate limited", { status: 429 }), new Response("unavailable", { status: 503 }), Response.json({ results: [] }), Response.json({ results: [{ formatted: 42 }] }), new Response("invalid json")]) {
    assert.equal(await resolveEventAddress(coordinates, createGeoapifyGeocoder("mock-key", async () => response)), null);
  }
  assert.equal(await resolveEventAddress(coordinates, async () => { throw new Error("Mock network failure"); }), null);
  let signal: AbortSignal | undefined;
  assert.equal(await resolveEventAddress(coordinates, async (_coordinates, abort) => { signal = abort; return new Promise(() => {}); }, 5), null);
  assert.equal(signal?.aborted, true);
  assert.equal(await resolveEventAddress(coordinates, createGeoapifyGeocoder(undefined, async () => { throw new Error("Must not request without a key"); })), null);
});
