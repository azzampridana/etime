import "server-only";

import type { Prisma } from "@/generated/prisma/client";
import type { DatabaseTransaction } from "@/lib/db/transaction";

export const dailyReportSelect = {
  id: true, content: true, createdAt: true, updatedAt: true,
} satisfies Prisma.DailyReportSelect;
export type DailyReportRecord = Prisma.DailyReportGetPayload<{ select: typeof dailyReportSelect }>;

export function upsertDailyReportRecord(attendanceId: string, content: string, tx: DatabaseTransaction) {
  return tx.dailyReport.upsert({
    where: { attendanceId }, create: { attendanceId, content }, update: { content }, select: dailyReportSelect,
  });
}
