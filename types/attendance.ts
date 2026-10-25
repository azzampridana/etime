import type { DailyReportDto } from "@/types/daily-report";

export type AttendanceEventSource = "NORMAL" | "ADMIN_CORRECTION";
export type AttendanceProvenance = {
  checkInSource: AttendanceEventSource;
  checkOutSource: AttendanceEventSource | null;
  checkInCorrectionRequestId: string | null;
  checkOutCorrectionRequestId: string | null;
};

export type AttendanceDto = AttendanceProvenance & {
  id: string;
  workDate: string;
  requiredWorkMinutes: number;
  checkInAt: string;
  checkInLatitude: number | null;
  checkInLongitude: number | null;
  checkInAccuracy: number | null;
  checkInAddress: string | null;
  checkInTimezone: string;
  checkInDescription: string | null;
  checkOutAt: string | null;
  checkOutLatitude: number | null;
  checkOutLongitude: number | null;
  checkOutAccuracy: number | null;
  checkOutAddress: string | null;
  checkOutTimezone: string | null;
  checkOutDescription: string | null;
  dailyReport: DailyReportDto | null;
  actualDurationMinutes: number | null;
  differenceMinutes: number | null;
  isOpen: boolean;
};
