import type { AdminAttendanceDto } from "@/types/admin-attendance";
import type { OvertimeDto } from "@/types/overtime";
import type { OvertimeAuthorizationState } from "@/types/overtime-authorization";

export type ReportDto = AdminAttendanceDto & {
  authorizationState: OvertimeAuthorizationState;
  authorization: { id: string; grantedAt: string; revokedAt: string | null; note: string | null } | null;
  overtime: OvertimeDto | null;
};

export type EmployeeReportSummary = {
  id: string; name: string; email: string; position: string | null;
  attendance: number; completed: number; incomplete: number; working: number;
  regularMinutes: number; averageMinutes: number | null; requiredMinutes: number | null;
  differenceMinutes: number | null; overtimeSessions: number; overtimeMinutes: number;
};
export type EmployeeReportAttendance = {
  id: string; workDate: string; checkInAt: string; checkInTimezone: string;
  checkOutAt: string | null; checkOutTimezone: string | null;
  actualMinutes: number | null; requiredMinutes: number; differenceMinutes: number | null;
  state: "Completed" | "Working" | "Incomplete" | null; hasDailyReport: boolean;
};
export type EmployeeReportOvertime = {
  id: string; workDate: string; checkInAt: string; checkInTimezone: string;
  checkOutAt: string | null; checkOutTimezone: string | null; durationMinutes: number | null;
  state: "In Progress" | "Completed";
};
export type EmployeeReportDetail = {
  summary: EmployeeReportSummary; from: string; to: string;
  attendance: EmployeeReportAttendance[]; overtime: EmployeeReportOvertime[];
};
export type EmployeeReportExportRow = ReportDto & {
  employee: ReportDto["employee"] & { position: string | null };
  state: EmployeeReportAttendance["state"];
};
