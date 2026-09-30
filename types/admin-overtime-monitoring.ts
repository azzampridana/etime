import type { AdminOvertimeDto } from "@/types/overtime";
import type { OvertimeAuthorizationState } from "@/types/overtime-authorization";

export type OvertimeActivityState = "In Progress" | "Completed" | "Incomplete";
export type OvertimeActivitySummary = {
  id: string; workDate: string; employee: { name: string; position: string | null };
  checkIn: { at: string; timezone: string }; checkOut: { at: string; timezone: string } | null;
  durationMinutes: number | null; state: OvertimeActivityState;
};
export type OvertimeMonitoringDetail = Omit<AdminOvertimeDto, "state" | "employee"> & {
  state: OvertimeActivityState;
  employee: AdminOvertimeDto["employee"] & { position: string | null };
};
export type AuthorizationMonitoringSummary = {
  id: string; workDate: string; employee: { name: string; position: string | null };
  authorizationState: OvertimeAuthorizationState;
  state: OvertimeAuthorizationState | "Activity Started";
  authorization: { note: string | null } | null;
  canGrant: boolean; revoked: boolean;
};
