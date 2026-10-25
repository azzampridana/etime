export type CorrectionSummaryDto = {
  id: string; workDate: string; type: "MISSING_CHECKOUT" | "MISSING_BOTH";
  status: "PENDING" | "APPROVED" | "REJECTED"; createdAt: string;
};
export type CorrectionDetailDto = CorrectionSummaryDto & {
  attendanceId: string | null; requestedCheckInAt: string | null; requestedCheckOutAt: string;
  requestedCheckInTimezone: string | null; requestedCheckOutTimezone: string;
  reason: string; proposedDailyReportContent: string | null;
  originalCheckInAt: string | null; originalCheckInTimezone: string | null; existingReportContent: string | null;
  reviewedAt: string | null; reviewerName: string | null; reviewNote: string | null;
  canResubmit: boolean;
};
export type CorrectionFormContext = {
  workDate: string; attendanceId: string | null; checkInAt: string | null; checkInTimezone: string | null;
  existingReportContent: string | null; pendingRequestId: string | null;
};
