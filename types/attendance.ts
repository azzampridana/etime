import type { DailyReportDto } from "@/types/daily-report";

export type AttendanceDto = {
  id: string;
  workDate: string;
  requiredWorkMinutes: number;
  checkInAt: string;
  checkInLatitude: number;
  checkInLongitude: number;
  checkInAccuracy: number;
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
