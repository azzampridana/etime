import "server-only";
import { getOvertimeState } from "@/lib/overtime/state";
import { snapshotOvertimePolicy } from "@/services/overtime-policy.service";
import { resolveEventAddress, type ReverseGeocoder } from "@/lib/geolocation/reverse-geocoding";
import { randomUUID } from "node:crypto";
import { z } from "zod";
import { inTransaction, type DatabaseTransaction } from "@/lib/db/transaction";
import { ApplicationError } from "@/lib/errors/application-error";
import { findUserById } from "@/repositories/user.repository";
import { lockActiveAttendanceUser } from "@/services/attendance-context";
import { lockAuthorizationAttendance } from "@/repositories/overtime-authorization.repository";
import { findLatestOvertimeAttendance, findOpenOvertime, findOvertimeById, createOvertime, closeOvertime } from "@/repositories/overtime.repository";
import { overtimeEvidenceSchema, overtimePhotoSchema, overtimeLocationSchema, OVERTIME_LOCATION_MAX_AGE_MS } from "@/schemas/overtime.schema";
import { signOvertimeLocation, readOvertimeLocation } from "@/lib/geolocation/overtime-location-receipt";
import { processEvidencePhoto } from "@/lib/photos/process-photo";
import { getStorage } from "@/lib/storage/local-storage";
import type { StorageService } from "@/lib/storage/storage";
import { toOvertimeDto } from "@/mappers/overtime.mapper";
import type { HomeOvertimeSummary, OvertimePageDto } from "@/types/overtime";
import { findHomeOvertimeAttendance } from "@/repositories/overtime.repository";
import { adminOvertimeQuerySchema } from "@/schemas/admin-query.schema";
import { listAdminOvertimeRecords, findAdminOvertimeById } from "@/repositories/overtime.repository";
import { toAdminOvertimeDto } from "@/mappers/overtime.mapper";

async function requireActive(userId: string) {
  const user = await findUserById(userId);
  if (!user?.isActive) throw new ApplicationError("UNAUTHENTICATED", "Please sign in with an active account.");
  return user;
}
async function resolveStart(userId: string, tx?: DatabaseTransaction, now = new Date()) {
  if (await findOpenOvertime(userId, tx, now)) throw new ApplicationError("OVERTIME_OPEN", "An overtime session is already open. Finish it before starting another.");
  // Only the latest regular attendance is actionable; never fall back to older grants.
  const attendance = await findLatestOvertimeAttendance(userId, tx);
  if (!attendance?.checkOutAt) throw new ApplicationError("ATTENDANCE_INCOMPLETE", "Complete your latest regular attendance before starting overtime.");
  const authorization = attendance.overtimeAuthorization;
  if (!authorization || authorization.revokedAt) throw new ApplicationError("NO_AUTHORIZATION", "No active overtime authorization is available for your latest attendance.");
  if (authorization.overtime) throw new ApplicationError("OVERTIME_EXISTS", "Overtime has already been recorded for this authorization.");
  return { attendance, authorization };
}
async function resolveClose(userId: string, tx?: DatabaseTransaction, now = new Date()) {
  const overtime = await findOpenOvertime(userId, tx, now) ?? await findOpenOvertime(userId, tx);
  if (!overtime || overtime.checkOutAt) throw new ApplicationError("NO_OPEN_OVERTIME", "No open overtime session was found. It may already be completed.");
  if (getOvertimeState(overtime, now) === "Incomplete") throw new ApplicationError("OVERTIME_EXPIRED", "This overtime session has exceeded the allowed checkout window and is now incomplete.");
  return overtime;
}
type Dependencies = { storage?: StorageService; clock?: () => Date; processPhoto?: typeof processEvidencePhoto; transaction?: typeof inTransaction; geocoder?: ReverseGeocoder };

function requireFreshLocation(expiresAt: number, now: number) {
  if (now >= expiresAt) throw new ApplicationError("LOCATION_EXPIRED", "Location expired. Get your location again and capture a new photo.");
}

export async function prepareOvertimeLocation(userId: string, raw: unknown, dependencies: Pick<Dependencies, "geocoder" | "clock"> = {}) {
  const input = overtimeLocationSchema.parse(raw);
  const clock = () => (dependencies.clock ?? (() => new Date()))().getTime();
  const now = clock();
  // Client time is freshness metadata only; reject future/stale acquisition claims.
  if (input.acquiredAt > now) throw new ApplicationError("LOCATION_CLOCK", "Your device clock is ahead of the server. Correct it and get your location again.");
  const expiresAt = input.acquiredAt + OVERTIME_LOCATION_MAX_AGE_MS;
  requireFreshLocation(expiresAt, now);
  await requireActive(userId);
  const targetId = input.event === "check-in" ? (await resolveStart(userId, undefined, new Date(clock()))).authorization.id : (await resolveClose(userId, undefined, new Date(clock()))).id;
  const address = await resolveEventAddress(input, dependencies.geocoder);
  requireFreshLocation(expiresAt, clock());
  return { receipt: signOvertimeLocation({ ...input, userId, targetId, expiresAt, address }), address, expiresAt };
}

async function mutate(userId: string, raw: unknown, rawPhoto: unknown, event: "check-in" | "check-out", dependencies: Dependencies) {
  const evidence = overtimeEvidenceSchema.parse(raw);
  const photo = overtimePhotoSchema.parse(rawPhoto);
  const receipt = readOvertimeLocation(evidence.locationReceipt);
  const now = () => (dependencies.clock ?? (() => new Date()))();
  requireFreshLocation(receipt.expiresAt, now().getTime());
  if (receipt.userId !== userId || receipt.event !== event || receipt.latitude !== evidence.latitude || receipt.longitude !== evidence.longitude || receipt.accuracy !== evidence.accuracy || receipt.timezone !== evidence.timezone) {
    throw new ApplicationError("LOCATION_INVALID", "Location evidence changed. Get your location and capture a new photo.");
  }
  await requireActive(userId);
  const start = event === "check-in" ? await resolveStart(userId, undefined, now()) : null;
  const opened = event === "check-out" ? await resolveClose(userId, undefined, now()) : null;
  const attendance = start?.attendance ?? opened!.authorization.attendance;
  if (receipt.targetId !== (start?.authorization.id ?? opened!.id)) throw new ApplicationError("LOCATION_INVALID", "The overtime event changed. Get your location and capture a new photo.");
  const at = (dependencies.clock ?? (() => new Date()))();
  const previousAt = start?.attendance.checkOutAt ?? opened!.checkInAt;
  if (!Number.isFinite(at.getTime()) || at < previousAt!) throw new ApplicationError("INVALID_EVENT_TIME", "The server time precedes the previous event. Please try again later.");
  const address = receipt.address;
  const bytes = await (dependencies.processPhoto ?? processEvidencePhoto)(Buffer.from(await photo.arrayBuffer()), { ...evidence, address, event, at });
  const storage = dependencies.storage ?? getStorage();
  const key = `attendance/overtime/${attendance.workDate.toISOString().slice(0, 10).replaceAll("-", "/")}/${userId}/${event === "check-in" ? "checkin" : "checkout"}-${randomUUID()}.jpg`;
  await storage.upload(key, bytes);
  let result;
  try {
    result = await (dependencies.transaction ?? inTransaction)(async tx => {
      await lockActiveAttendanceUser(userId, tx);
      await lockAuthorizationAttendance(attendance.id, tx);
      requireFreshLocation(receipt.expiresAt, now().getTime());
      if (event === "check-in") {
        const current = await resolveStart(userId, tx, now());
        if (current.authorization.id !== start!.authorization.id) throw new ApplicationError("ELIGIBILITY_CHANGED", "Overtime eligibility changed. Refresh and try again.");
        const maxOpenMinutes = await snapshotOvertimePolicy(tx);
        requireFreshLocation(receipt.expiresAt, now().getTime());
        return createOvertime({ authorizationId: current.authorization.id, maxOpenMinutes, checkInAt: at,
          checkInLatitude: evidence.latitude, checkInLongitude: evidence.longitude, checkInAccuracy: evidence.accuracy,
          checkInTimezone: evidence.timezone, checkInDescription: evidence.description, checkInPhotoPath: key, checkInAddress: address }, tx);
      }
      const current = await resolveClose(userId, tx, now());
      if (current.id !== opened!.id) throw new ApplicationError("OVERTIME_CHANGED", "The overtime session changed. Refresh and try again.");
      requireFreshLocation(receipt.expiresAt, now().getTime());
      // Revocation blocks starts, never closure of an already committed session.
      return closeOvertime(current.id, { checkOutAt: at, checkOutLatitude: evidence.latitude,
        checkOutLongitude: evidence.longitude, checkOutAccuracy: evidence.accuracy, checkOutTimezone: evidence.timezone,
        checkOutDescription: evidence.description, checkOutPhotoPath: key, checkOutAddress: address }, tx);
    });
  } catch (error) {
    await storage.delete(key).catch(() => { console.error("Overtime photo compensation failed; storage maintenance is required."); });
    throw error;
  }
  // Mapping happens after compensation's scope: never delete committed evidence.
  return toOvertimeDto(result, now());
}
export function overtimeCheckIn(userId: string, input: unknown, photo: unknown, dependencies: Dependencies = {}) { return mutate(userId, input, photo, "check-in", dependencies); }
export function overtimeCheckOut(userId: string, input: unknown, photo: unknown, dependencies: Dependencies = {}) { return mutate(userId, input, photo, "check-out", dependencies); }
export async function getOvertimePage(userId: string): Promise<OvertimePageDto> {
  await requireActive(userId);
  const now = new Date();
  const active = await findOpenOvertime(userId, undefined, now);
  if (active && getOvertimeState(active, now) === "Open") return { state: "open", overtime: toOvertimeDto(active, now) };
  const previous = await findOpenOvertime(userId);
  const previousIncomplete = previous && getOvertimeState(previous, now) === "Incomplete" ? { workDate: previous.authorization.attendance.workDate.toISOString().slice(0, 10) } : undefined;
  const latest = await findLatestOvertimeAttendance(userId);
  const authorization = latest?.overtimeAuthorization;
  if (authorization?.overtime) {
    const overtime = toOvertimeDto(authorization.overtime, now);
    return { state: overtime.state === "Open" ? "open" : overtime.state === "Incomplete" ? "incomplete" : "completed", overtime, previousIncomplete };
  }
  if (latest?.checkOutAt && authorization && !authorization.revokedAt) return { state: "authorized", workDate: latest.workDate.toISOString().slice(0, 10), note: authorization.note, previousIncomplete };
  return { state: "unavailable", previousIncomplete, message: "No overtime authorization is currently available for your latest regular attendance. Complete regular attendance and ask your administrator if overtime is needed." };
}
/** Home summarizes the resolved attendance only, never an unrelated older grant. */
export async function getHomeOvertime(userId: string, attendanceId: string): Promise<HomeOvertimeSummary | null> {
  await requireActive(userId);
  const attendance = await findHomeOvertimeAttendance(userId, attendanceId);
  const authorization = attendance?.overtimeAuthorization;
  const overtime = authorization?.overtime;
  // Existing activity remains evidence even when its authorization is revoked.
  if (overtime) return {
    state: getOvertimeState(overtime, new Date()) === "Incomplete" ? "incomplete" : overtime.checkOutAt ? "completed" : "open",
    checkIn: { at: overtime.checkInAt.toISOString(), timezone: overtime.checkInTimezone },
    checkOut: overtime.checkOutAt && overtime.checkOutTimezone
      ? { at: overtime.checkOutAt.toISOString(), timezone: overtime.checkOutTimezone } : null,
  };
  return attendance?.checkOutAt && authorization && !authorization.revokedAt
    ? { state: "authorized" } : null;
}
export async function readOvertimePhoto(userId: string, rawId: unknown, rawEvent: unknown, storage: StorageService = getStorage()) {
  const user = await requireActive(userId);
  const id = z.uuid().parse(rawId);
  const event = z.enum(["check-in", "check-out"]).parse(rawEvent);
  const row = await findOvertimeById(id);
  if (!row || (row.authorization.attendance.userId !== userId && user.role !== "ADMIN")) throw new ApplicationError("PHOTO_NOT_FOUND", "Photo evidence is unavailable.");
  const key = event === "check-in" ? row.checkInPhotoPath : row.checkOutPhotoPath;
  if (!key) throw new ApplicationError("PHOTO_NOT_FOUND", "Photo evidence is unavailable.");
  return storage.read(key);
}

/** Internal read operations: each calling admin page independently requires ADMIN. */
export async function listAdminOvertime(raw: unknown) {
  const input = adminOvertimeQuerySchema.parse(raw);
  const now = new Date();
  const result = await listAdminOvertimeRecords(input, now);
  return { items: result.items.map(row => toAdminOvertimeDto(row, now)), total: result.total, page: input.page, pageSize: input.pageSize };
}
export async function getAdminOvertimeDetail(rawId: unknown) {
  const row = await findAdminOvertimeById(z.uuid().parse(rawId));
  if (!row) throw new ApplicationError("OVERTIME_NOT_FOUND", "Overtime not found.");
  return toAdminOvertimeDto(row);
}
