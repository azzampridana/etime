import type { AttendanceProvenance } from "@/types/attendance";

/** References also block eligibility if a legacy/inconsistent source flag says NORMAL. */
export function isCorrectionAffectedAttendance(attendance: AttendanceProvenance): boolean {
  return attendance.checkInSource === "ADMIN_CORRECTION" || attendance.checkOutSource === "ADMIN_CORRECTION" ||
    attendance.checkInCorrectionRequestId != null || attendance.checkOutCorrectionRequestId != null;
}
