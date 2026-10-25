export type OvertimeEventDto = {
  at: string; latitude: number | null; longitude: number | null; accuracy: number | null;
  timezone: string | null; description: string | null; address: string | null; photoUrl: string | null;
};
export type OvertimeDto = {
  checkOutSource: "NORMAL" | "ADMIN_CORRECTION" | null;
  checkOutCorrectionRequestId: string | null;
  state: "Open" | "Completed" | "Incomplete";
  id: string; workDate: string; authorizationRevoked: boolean; isOpen: boolean;
  checkIn: OvertimeEventDto; checkOut: OvertimeEventDto | null; durationMinutes: number | null;
};
export type HomeOvertimeSummary =
  | { state: "authorized" }
  | { state: "open" | "completed" | "incomplete";
      checkIn: { at: string; timezone: string };
      checkOut: { at: string; timezone: string | null } | null };
export type OvertimePageDto = (
  | { state: "unavailable"; message: string }
  | { state: "authorized"; workDate: string; note: string | null }
  | { state: "open" | "completed" | "incomplete"; overtime: OvertimeDto }
) & { previousIncomplete?: { workDate: string } };

export type AdminOvertimeDto = OvertimeDto & {
  state: "Open" | "Completed" | "Incomplete";
  employee: { id: string; name: string; email: string; position: string | null };
  attendanceId: string;
  authorization: { id: string; grantedAt: string; revokedAt: string | null; note: string | null };
};
