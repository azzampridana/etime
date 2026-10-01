import "server-only";
import { resolveEventAddress, type ReverseGeocoder } from "@/lib/geolocation/reverse-geocoding";

import { getBusinessDate } from "@/lib/date-time/event-time";
import { isUniqueConstraintError } from "@/lib/db/persistence-error";
import { inTransaction } from "@/lib/db/transaction";
import { ApplicationError } from "@/lib/errors/application-error";
import { toAttendanceDto } from "@/mappers/attendance.mapper";
import { closeAttendanceRecord, createAttendanceRecord, findAttendanceByUserAndWorkDate, findAttendanceByOwner, listAttendanceHistory } from "@/repositories/attendance.repository";
import { checkInSchema, checkOutSchema, attendanceHistorySchema, attendanceLocationSchema, ATTENDANCE_LOCATION_MAX_AGE_MS, ATTENDANCE_LOCATION_MAX_FUTURE_SKEW_MS } from "@/schemas/attendance.schema";
import { readAttendanceLocation, signAttendanceLocation, type AttendanceLocationReceipt } from "@/lib/geolocation/attendance-location-receipt";
import type { LocationEvidence } from "@/lib/geolocation/acquire-location";
import type { AttendanceDto } from "@/types/attendance";
import { dailyReportSchema } from "@/schemas/daily-report.schema";
import { lockActiveAttendanceUser, requireOpenAttendance } from "@/services/attendance-context";
import { adminAttendanceMonitoringQuerySchema } from "@/schemas/admin-query.schema";
import { userIdSchema } from "@/schemas/user.schema";
import { findAdminAttendanceById, listAdminAttendanceRecords } from "@/repositories/attendance.repository";
import { toAdminAttendanceDto } from "@/mappers/attendance.mapper";
import type { AdminAttendanceListDto, AdminAttendanceState, AdminAttendanceDetailDto } from "@/types/admin-attendance";
import type { Prisma } from "@/generated/prisma/client";

function duplicateAttendance() {
  return new ApplicationError("ATTENDANCE_EXISTS", "You have already checked in for this work date.");
}

function requireFreshLocation(expiresAt: number, at: Date) {
  if (at.getTime() >= expiresAt) throw new ApplicationError("LOCATION_EXPIRED", "Location expired. Get your location again.");
}

function requireLocationContext(receipt: AttendanceLocationReceipt, at: Date) {
  requireFreshLocation(receipt.expiresAt, at);
  if (receipt.businessDate !== getBusinessDate(at)) throw new ApplicationError("LOCATION_INVALID", "The attendance date changed. Get your location again.");
}

function verifyLocation(userId: string, input: LocationEvidence & { locationReceipt: string }, event: AttendanceLocationReceipt["event"], at: Date, attendanceId?: string) {
  const receipt = readAttendanceLocation(input.locationReceipt);
  requireLocationContext(receipt, at);
  if (receipt.userId !== userId || receipt.event !== event ||
    (receipt.event === "CHECK_OUT" && receipt.attendanceId !== attendanceId) ||
    receipt.latitude !== input.latitude || receipt.longitude !== input.longitude ||
    receipt.accuracy !== input.accuracy || receipt.timezone !== input.timezone) {
    throw new ApplicationError("LOCATION_INVALID", "Location evidence changed. Get your location again.");
  }
  return receipt;
}

export async function prepareAttendanceLocation(userId: string, raw: unknown, clock: () => Date = () => new Date(), geocoder?: ReverseGeocoder) {
  const input = attendanceLocationSchema.parse(raw);
  const serverValidationAt = clock();
  if (input.acquiredAt - serverValidationAt.getTime() > ATTENDANCE_LOCATION_MAX_FUTURE_SKEW_MS) {
    throw new ApplicationError("LOCATION_CLOCK", "Your device clock is ahead of the server. Correct it and get your location again.");
  }
  const effectiveAcquiredAt = Math.min(input.acquiredAt, serverValidationAt.getTime());
  const expiresAt = effectiveAcquiredAt + ATTENDANCE_LOCATION_MAX_AGE_MS;
  requireFreshLocation(expiresAt, serverValidationAt);
  const businessDate = getBusinessDate(serverValidationAt);
  await inTransaction(async tx => {
    const user = await lockActiveAttendanceUser(userId, tx);
    if (input.event === "CHECK_IN") {
      if (!user.workSchedule.isActive) throw new ApplicationError("SCHEDULE_UNAVAILABLE", "Your work schedule is unavailable. Please contact an administrator.");
      if (await findAttendanceByUserAndWorkDate(userId, new Date(`${businessDate}T00:00:00.000Z`), tx)) throw duplicateAttendance();
    } else {
      await requireOpenAttendance(userId, tx, input.attendanceId, clock());
    }
  });
  // External geocoding stays outside the transaction; final submission uses this signed snapshot.
  const address = await resolveEventAddress(input, geocoder);
  const receipt = { ...input, userId, businessDate, expiresAt, address };
  const preparedAt = clock();
  requireLocationContext(receipt, preparedAt);
  return { receipt: signAttendanceLocation(receipt), address, expiresAt, remainingMilliseconds: expiresAt - preparedAt.getTime() };
}

// userId is supplied only by the authenticated server boundary. The clock is a test seam.
export async function checkIn(userId: string, raw: unknown, clock: () => Date = () => new Date(), legacyGeocoder?: ReverseGeocoder) {
  // Retain the existing call signature; geocoding now belongs exclusively to receipt preparation.
  void legacyGeocoder;
  const input = checkInSchema.parse(raw);
  const receipt = verifyLocation(userId, input, "CHECK_IN", clock());
  try {
    return await inTransaction(async (tx) => {
      const user = await lockActiveAttendanceUser(userId, tx);
      if (!user.workSchedule.isActive) throw new ApplicationError("SCHEDULE_UNAVAILABLE", "Your work schedule is unavailable. Please contact an administrator.");
      const workDate = new Date(`${receipt.businessDate}T00:00:00.000Z`);
      if (await findAttendanceByUserAndWorkDate(userId, workDate, tx)) throw duplicateAttendance();
      const checkInAt = clock();
      requireLocationContext(receipt, checkInAt);
      return toAttendanceDto(await createAttendanceRecord({
        userId, workDate, checkInAt, requiredWorkMinutes: user.workSchedule.requiredWorkMinutes,
        checkInLatitude: input.latitude, checkInLongitude: input.longitude, checkInAccuracy: input.accuracy,
        checkInTimezone: input.timezone, checkInDescription: input.description, checkInAddress: receipt.address,
      }, tx));
    });
  } catch (error) {
    if (isUniqueConstraintError(error)) throw duplicateAttendance();
    throw error;
  }
}

export async function getOpenAttendance(userId: string) {
  const attendance = await getCurrentAttendance(userId);
  return attendance?.isOpen ? attendance : null;
}

export async function checkOut(userId: string, raw: unknown, clock: () => Date = () => new Date(), legacyGeocoder?: ReverseGeocoder) {
  // Retain the existing call signature; never geocode again or accept unsigned evidence here.
  void legacyGeocoder;
  const input = checkOutSchema.parse(raw);
  const receipt = verifyLocation(userId, input, "CHECK_OUT", clock(), input.attendanceId);
  return inTransaction(async (tx) => {
    await lockActiveAttendanceUser(userId, tx);
    const attendance = await requireOpenAttendance(userId, tx, input.attendanceId, clock());
    if (!dailyReportSchema.safeParse({ content: attendance.dailyReport?.content }).success) {
      throw new ApplicationError("DAILY_REPORT_REQUIRED", "Save a valid Daily Report before checking out.");
    }
    const checkOutAt = clock();
    requireLocationContext(receipt, checkOutAt);
    if (!Number.isFinite(checkOutAt.getTime()) || checkOutAt < attendance.checkInAt) {
      throw new ApplicationError("INVALID_CHECKOUT_TIME", "Checkout time cannot be earlier than check-in. Please try again.");
    }
    return toAttendanceDto(await closeAttendanceRecord(attendance.id, {
      checkOutAt, checkOutLatitude: input.latitude, checkOutLongitude: input.longitude,
      checkOutAccuracy: input.accuracy, checkOutTimezone: input.timezone, checkOutDescription: input.description, checkOutAddress: receipt.address,
    }, tx));
  });
}

/** Today and Home share the server-authoritative business date. */
export async function getCurrentAttendance(userId: string, clock: () => Date = () => new Date()) {
  const workDate = new Date(`${getBusinessDate(clock())}T00:00:00.000Z`);
  const record = await findAttendanceByUserAndWorkDate(userId, workDate);
  return record ? toAttendanceDto(record) : null;
}

/** Historical missing checkouts never replace today's Home attendance. */
export async function getHomeAttendance(userId: string, clock: () => Date = () => new Date()) {
  return getCurrentAttendance(userId, clock);
}

function withUserState(attendance: AttendanceDto, businessDate: string) {
  const state: "Completed" | "Incomplete" | "Working" = attendance.checkOutAt ? "Completed" : attendance.workDate < businessDate ? "Incomplete" : "Working";
  return { ...attendance, state };
}

export async function getAttendanceHistory(userId: string, raw: unknown, clock: () => Date = () => new Date()) {
  const { page } = attendanceHistorySchema.parse(raw);
  const businessDate = getBusinessDate(clock());
  const pageSize = 15;
  const result = await listAttendanceHistory(userId, new Date(`${businessDate}T00:00:00.000Z`), page, pageSize);
  return { items: result.items.map(record => withUserState(toAttendanceDto(record), businessDate)), total: result.total, page, pageSize };
}

export async function getUserAttendanceDetail(userId: string, rawId: unknown) {
  const record = await findAttendanceByOwner(userIdSchema.parse(rawId), userId);
  return record ? withUserState(toAttendanceDto(record), getBusinessDate()) : null;
}

// ADMIN authorization is enforced by every page/action that exposes these reads.
function monitoringState(workDate: string, checkOutAt: Date | string | null, today: string): AdminAttendanceState {
  if (checkOutAt) return "Completed";
  if (workDate < today) return "Incomplete";
  return workDate === today ? "Working" : null;
}

export async function listAdminAttendance(raw: unknown): Promise<AdminAttendanceListDto> {
  const input = adminAttendanceMonitoringQuerySchema.parse(raw);
  const today = getBusinessDate();
  const date = new Date(`${today}T00:00:00.000Z`);
  const states = {
    completed: { checkOutAt: { not: null } },
    incomplete: { checkOutAt: null, workDate: { lt: date } },
    working: { checkOutAt: null, workDate: date },
  } satisfies Record<string, Prisma.AttendanceWhereInput>;
  let groups: Prisma.AttendanceWhereInput[] = input.state === "all" ? [{}] : [states[input.state]];
  if (input.sort === "status" && input.state === "all") {
    groups = [states.completed, states.incomplete, states.working];
    if (input.order === "desc") groups.reverse();
    // Unexpected future open records remain visible, without claiming they are Working.
    groups.push({ checkOutAt: null, workDate: { gt: date } });
  }
  const { items, total } = await listAdminAttendanceRecords(input, groups);
  return { items: items.map(record => ({ id: record.id, workDate: record.workDate.toISOString().slice(0, 10),
    checkInAt: record.checkInAt.toISOString(), checkInTimezone: record.checkInTimezone,
    checkOutAt: record.checkOutAt?.toISOString() ?? null, checkOutTimezone: record.checkOutTimezone,
    employee: record.user, state: monitoringState(record.workDate.toISOString().slice(0, 10), record.checkOutAt, today),
  })), total, page: input.page, pageSize: input.pageSize };
}

export async function getAdminAttendance(id: string): Promise<AdminAttendanceDetailDto> {
  const record = await findAdminAttendanceById(userIdSchema.parse(id));
  if (!record) throw new ApplicationError("ATTENDANCE_NOT_FOUND", "Attendance not found.");
  const item = toAdminAttendanceDto(record);
  return { ...item, employee: { ...item.employee, position: record.user.position },
    state: monitoringState(item.workDate, item.checkOutAt, getBusinessDate()) };
}
