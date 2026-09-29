import type { DailyReportRecord } from "@/repositories/daily-report.repository";
import type { DailyReportDto } from "@/types/daily-report";

export function toDailyReportDto(record: DailyReportRecord): DailyReportDto {
  return { id: record.id, content: record.content, createdAt: record.createdAt.toISOString(), updatedAt: record.updatedAt.toISOString() };
}
