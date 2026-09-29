import assert from "node:assert/strict";
import { test } from "node:test";
import { randomUUID } from "node:crypto";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import sharp from "sharp";
import { overtimeEvidenceSchema, overtimePhotoSchema, parseOvertimeForm, MAX_PHOTO_INPUT_BYTES } from "@/schemas/overtime.schema";
import { watermarkLines } from "@/lib/photos/watermark";
import { processEvidencePhoto } from "@/lib/photos/process-photo";
import { LocalStorage, validateStorageKey } from "@/lib/storage/local-storage";
import { ApplicationError } from "@/lib/errors/application-error";

const evidence = { latitude: -6.2, longitude: 106.8, accuracy: 12, timezone: "Asia/Jakarta", description: "  Overtime task  " };
const watermark = { ...evidence, at: new Date("2026-09-18T17:30:00Z"), event: "check-in" as const };
test("overtime requires bounded descriptions, GPS, timezone, photo and rejects client authority", () => {
  assert.equal(overtimeEvidenceSchema.parse(evidence).description, "Overtime task");
  for (const input of [{ description: " " }, { description: "a".repeat(1001) }, { latitude: 91 }, { longitude: -181 }, { accuracy: -1 }, { accuracy: Infinity }, { timezone: "not/a/zone" }, { timezone: "+07:00" }]) assert.ok(!overtimeEvidenceSchema.safeParse({ ...evidence, ...input }).success);
  assert.ok(!overtimePhotoSchema.safeParse(undefined).success);
  assert.ok(!overtimePhotoSchema.safeParse(new File([], "missing.jpg")).success);
  assert.ok(!overtimePhotoSchema.safeParse(new File([new Uint8Array(MAX_PHOTO_INPUT_BYTES + 1)], "large.jpg")).success);
  const form = new FormData();
  for (const [key, value] of Object.entries(evidence)) form.set(key, String(value));
  form.set("photo", new File(["not decoded here"], "untrusted.jpg"));
  assert.equal(parseOvertimeForm(form).evidence.latitude, -6.2);
  for (const key of ["userId", "overtimeId", "attendanceId", "authorizationId", "workDate", "checkInAt", "checkOutAt", "photoPath", "duration", "status"]) {
    form.set(key, "spoof"); assert.throws(() => parseOvertimeForm(form)); form.delete(key);
  }
  form.append("latitude", "0"); assert.throws(() => parseOvertimeForm(form));
});
test("watermark uses server event time, timezone, coordinates, accuracy and optional address only", () => {
  for (const [timezone, label] of [["Asia/Jakarta", "WIB"], ["Asia/Makassar", "WITA"], ["Asia/Jayapura", "WIT"], ["America/New_York", "America/New_York"]]) {
    const lines = watermarkLines({ ...watermark, timezone });
    assert.ok(lines.join(" ").includes(label));
    assert.ok(lines.join(" ").includes("-6.200000")); assert.ok(lines.join(" ").includes("106.800000"));
    assert.ok(lines.join(" ").includes("±12 m")); assert.ok(!lines.join(" ").includes("Overtime task"));
    if (timezone === "Asia/Jakarta") assert.ok(lines[1].includes("00:30"));
  }
  assert.ok(watermarkLines({ ...watermark, event: "check-out", address: "Site & Workshop" }).join(" ").includes("Check-Out"));
  assert.ok(watermarkLines({ ...watermark, address: "Site & Workshop" }).includes("Site & Workshop"));
  assert.equal(watermarkLines({ ...watermark, address: null }).length, 4);
});
test("photo decode, normalization, orientation, watermark pixels and output ceilings", async () => {
  const image = sharp({ create: { width: 600, height: 400, channels: 3, background: "white" } });
  for (const format of ["jpeg", "png", "webp"] as const) {
    const input = await image.clone().toFormat(format).toBuffer();
    const output = await processEvidencePhoto(input, watermark);
    const metadata = await sharp(output).metadata();
    assert.equal(metadata.format, "jpeg"); assert.equal(metadata.width, 600); assert.equal(metadata.height, 400);
    assert.equal(metadata.exif, undefined); assert.ok(output.length <= 2 * 1024 * 1024);
    const bottom = await sharp(output).extract({ left: 0, top: 300, width: 600, height: 100 }).stats();
    assert.ok(bottom.channels[0].mean < 240, "Watermark panel must change the original white pixels");
  }
  const rotated = await processEvidencePhoto(await image.clone().withMetadata({ orientation: 6 }).jpeg().toBuffer(), watermark);
  assert.equal((await sharp(rotated).metadata()).width, 400); assert.equal((await sharp(rotated).metadata()).height, 600);
  const large = await sharp({ create: { width: 4000, height: 3000, channels: 3, background: "navy" } }).jpeg().toBuffer();
  const resized = await sharp(await processEvidencePhoto(large, watermark)).metadata();
  assert.equal(resized.width, 1600); assert.equal(resized.height, 1200);
  for (const bad of [Buffer.from("not an image"), Buffer.from('<svg xmlns="http://www.w3.org/2000/svg" width="500" height="500"/>'), Buffer.alloc(MAX_PHOTO_INPUT_BYTES + 1)]) await assert.rejects(processEvidencePhoto(bad, watermark), ApplicationError);
});
test("local storage publishes complete private files, refuses unsafe keys and never overwrites", async () => {
  const root = await mkdtemp(path.join(tmpdir(), "etime-storage-test-"));
  const key = `attendance/overtime/2026/09/18/${randomUUID()}/checkin-${randomUUID()}.jpg`;
  try {
    const storage = new LocalStorage(root);
    for (const bad of ["../secret", "/absolute.jpg", "C:\\secret.jpg", `${key}\n`, key.replace("attendance/", "../"), key.replaceAll("/", "\\")]) assert.throws(() => validateStorageKey(bad));
    await storage.upload(key, Buffer.from("normalized test bytes"));
    assert.equal((await storage.read(key)).toString(), "normalized test bytes");
    await assert.rejects(storage.upload(key, Buffer.from("replacement")), ApplicationError);
    assert.equal((await storage.read(key)).toString(), "normalized test bytes");
    await storage.delete(key); await storage.delete(key);
    await assert.rejects(storage.read(key), (error: unknown) => error instanceof ApplicationError && !error.message.includes(root));
    await assert.rejects(new LocalStorage(undefined).upload(key, Buffer.from("x")), ApplicationError);
    const fileRoot = path.join(root, "not-a-directory"); await writeFile(fileRoot, "x");
    await assert.rejects(new LocalStorage(fileRoot).upload(key, Buffer.from("x")), ApplicationError);
    await assert.rejects(new LocalStorage(path.resolve("public")).upload(key, Buffer.from("x")), ApplicationError);
  } finally {
    assert.equal(path.dirname(path.resolve(root)), path.resolve(tmpdir()));
    assert.ok(path.basename(root).startsWith("etime-storage-test-"));
    await rm(root, { recursive: true, force: true });
  }
});
