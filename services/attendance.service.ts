import "server-only";
import { resolveEventAddress, type ReverseGeocoder } from "@/lib/geolocation/reverse-geocoding";

import { getBusinessDate } from "@/lib/date-time/event-time";
import { isUniqueConstraintError } from "@/lib/db/persistence-error";
import { inTransaction } from "@/lib/db/transaction";
import { ApplicationError } from "@/lib/errors/application-error";
import { toAttendanceDto } from "@/mappers/attendance.mapper";
import { closeAttendanceRecord, createAttendanceRecord, findAttendanceByUserAndWorkDate, findAttendanceByOwner, listAttendanceHistory } from "@/repositories/attendance.repository";
import { checkInSchema, checkOutSchema, attendanceHistorySchema } from "@/schemas/attendance.schema";
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

// userId is supplied only by the authenticated server boundary. The clock is a test seam.
export async function checkIn(userId: string, raw: unknown, clock: () => Date = () => new Date(), geocoder?: ReverseGeocoder) {
  const input = checkInSchema.parse(raw);
  const address = await resolveEventAddress(input, geocoder);
  try {
    return await inTransaction(async (tx) => {
      const user = await lockActiveAttendanceUser(userId, tx);
      if (!user.workSchedule.isActive) throw new ApplicationError("SCHEDULE_UNAVAILABLE", "Your work schedule is unavailable. Please contact an administrator.");
      const checkInAt = clock();
      const workDate = new Date(`${getBusinessDate(checkInAt)}T00:00:00.000Z`);
      if (await findAttendanceByUserAndWorkDate(userId, workDate, tx)) throw duplicateAttendance();
      return toAttendanceDto(await createAttendanceRecord({
        userId, workDate, checkInAt, requiredWorkMinutes: user.workSchedule.requiredWorkMinutes,
        checkInLatitude: input.latitude, checkInLongitude: input.longitude, checkInAccuracy: input.accuracy,
        checkInTimezone: input.timezone, checkInDescription: input.description, checkInAddress: address,
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

export async function checkOut(userId: string, raw: unknown, clock: () => Date = () => new Date(), geocoder?: ReverseGeocoder) {
  const input = checkOutSchema.parse(raw);
  const address = await resolveEventAddress(input, geocoder);
  return inTransaction(async (tx) => {
    await lockActiveAttendanceUser(userId, tx);
    const checkOutAt = clock();
    const attendance = await requireOpenAttendance(userId, tx, input.attendanceId, checkOutAt);
    if (!dailyReportSchema.safeParse({ content: attendance.dailyReport?.content }).success) {
      throw new ApplicationError("DAILY_REPORT_REQUIRED", "Save a valid Daily Report before checking out.");
    }
    if (!Number.isFinite(checkOutAt.getTime()) || checkOutAt < attendance.checkInAt) {
      throw new ApplicationError("INVALID_CHECKOUT_TIME", "Checkout time cannot be earlier than check-in. Please try again.");
    }
    return toAttendanceDto(await closeAttendanceRecord(attendance.id, {
      checkOutAt, checkOutLatitude: input.latitude, checkOutLongitude: input.longitude,
      checkOutAccuracy: input.accuracy, checkOutTimezone: input.timezone, checkOutDescription: input.description, checkOutAddress: address,
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
