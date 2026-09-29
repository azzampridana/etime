import type { AdminAttendanceDto } from "@/types/admin-attendance";

export type OvertimeAuthorizationDto = {
  id: string;
  attendanceId: string;
  grantedAt: string;
  revokedAt: string | null;
  note: string | null;
  grantedBy: { id: string; name: string; email: string };
};
export type OvertimeAuthorizationState = "Not Authorized" | "Authorized" | "Revoked";
export type OvertimeAuthorizationAttendanceDto = AdminAttendanceDto & {
  authorization: OvertimeAuthorizationDto | null;
  authorizationState: OvertimeAuthorizationState;
};
