import { ApplicationError } from "@/lib/errors/application-error";

export const MAX_REPORT_EXPORT_ROWS = 1_000;
export function assertReportExportLimit(count: number) {
  if (count > MAX_REPORT_EXPORT_ROWS) throw new ApplicationError("REPORT_EXPORT_LIMIT", `Excel export is limited to ${MAX_REPORT_EXPORT_ROWS.toLocaleString("en-US")} rows. Narrow the date range or employee filters and try again.`);
}
