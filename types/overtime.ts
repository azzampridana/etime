export type OvertimeEventDto = {
  at: string; latitude: number; longitude: number; accuracy: number;
  timezone: string; description: string; address: string | null; photoUrl: string;
};
export type OvertimeDto = {
  state: "Open" | "Completed" | "Incomplete";
  id: string; workDate: string; authorizationRevoked: boolean; isOpen: boolean;
  checkIn: OvertimeEventDto; checkOut: OvertimeEventDto | null; durationMinutes: number | null;
};
export type HomeOvertimeSummary =
  | { state: "authorized" }
  | { state: "open" | "completed" | "incomplete";
      checkIn: { at: string; timezone: string };
      checkOut: { at: string; timezone: string } | null };
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
