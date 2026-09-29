import type { AttendanceDto } from "@/types/attendance";

export type AdminAttendanceDto = AttendanceDto & {
  employee: { id: string; name: string; email: string };
};
export type AdminAttendanceListDto = {
  items: AdminAttendanceSummaryDto[];
  total: number;
  page: number;
  pageSize: number;
};

export type AdminAttendanceState = "Working" | "Completed" | "Incomplete" | null;
export type AdminAttendanceDetailDto = AdminAttendanceDto & {
  employee: AdminAttendanceDto["employee"] & { position: string | null };
  state: AdminAttendanceState;
};
export type AdminAttendanceSummaryDto = Pick<AttendanceDto,
  "id" | "workDate" | "checkInAt" | "checkInTimezone" | "checkOutAt" | "checkOutTimezone"> & {
  employee: { name: string; position: string | null };
  state: AdminAttendanceState;
};
