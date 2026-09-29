import "server-only";
import ExcelJS from "exceljs";
import { formatAdminEventTime } from "@/lib/date-time/event-time";
import { assertReportExportLimit } from "@/lib/reports/export-limit";
import type { ReportQuery } from "@/schemas/report.schema";
import type { ReportDto } from "@/types/report";
import type { EmployeeReportQuery } from "@/schemas/report.schema";
import type { EmployeeReportExportRow, EmployeeReportSummary } from "@/types/report";

/** Keep text literal, including formula triggers hidden behind whitespace. */
export function sanitizeExcelText(value: string): string {
  return /^[\s\u0000-\u001f]*[=+\-@]/.test(value) ? `'${value}` : value;
}
function eventTime(at: string | null, timezone: string | null) {
  return at && timezone ? formatAdminEventTime(at, timezone) : null;
}
function location(latitude: number | null, longitude: number | null, accuracy: number | null, address: string | null) {
  return latitude === null || longitude === null ? null : `${latitude}, ${longitude} · ±${accuracy} m${address ? `\n${address}` : ""}`;
}
export function reportFilename(filters: Pick<ReportQuery, "from" | "to">) {
  return `etime-attendance-${filters.from}-to-${filters.to}.xlsx`;
}
export async function buildReportWorkbook(items: ReportDto[], filters: ReportQuery) {
  assertReportExportLimit(items.length);
  const workbook = new ExcelJS.Workbook();
  workbook.creator = "ETime";
  const sheet = workbook.addWorksheet("Attendance Report", { views: [{ state: "frozen", ySplit: 4 }] });
  const headers = ["Attendance ID", "Work Date", "Employee Name", "Employee Email", "Regular State",
    "Regular Check-In Local", "Regular Check-In Timezone", "Regular Check-In Location", "Regular Check-In Description",
    "Regular Check-Out Local", "Regular Check-Out Timezone", "Regular Check-Out Location", "Regular Check-Out Description",
    "Regular Duration (minutes)", "Required Duration (minutes)", "Difference (minutes)", "Daily Report",
    "Overtime Authorization State", "Authorization Granted At (UTC)", "Authorization Revoked At (UTC)", "Authorization Note",
    "OT State", "OT Check-In Local", "OT Check-In Timezone", "OT Check-In Location", "OT Check-In Description",
    "OT Check-Out Local", "OT Check-Out Timezone", "OT Check-Out Location", "OT Check-Out Description", "OT Duration (minutes)"];
  sheet.columns = headers.map(header => ({ width: /Description|Report|Note|Location/.test(header) ? 45 : /Local|Email|ID/.test(header) ? 34 : 24 }));
  const add = (values: (string | number | null)[]) => sheet.addRow(values.map(value => typeof value === "string" ? sanitizeExcelText(value) : value));
  add(["ETime Attendance Report"]); sheet.getRow(1).font = { bold: true, size: 16 };
  add([`Work dates: ${filters.from} to ${filters.to}; User: ${filters.userId ?? "All"}; Search: ${filters.search || "None"}; Regular state: ${filters.state}; Rows: ${items.length}. Address geocoding: Geoapify (https://www.geoapify.com/)`]);
  sheet.mergeCells(2, 1, 2, 8); sheet.getRow(2).alignment = { wrapText: true, vertical: "top" }; sheet.getRow(2).height = 32;
  add([]); add(headers);
  sheet.getRow(4).font = { bold: true, color: { argb: "FFFFFFFF" } };
  sheet.getRow(4).fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF145E59" } };
  sheet.getRow(4).alignment = { wrapText: true }; sheet.getRow(4).height = 32;
  sheet.autoFilter = { from: { row: 4, column: 1 }, to: { row: 4, column: headers.length } };
  for (const row of items) {
    const overtime = row.overtime, checkIn = overtime?.checkIn, checkOut = overtime?.checkOut;
    const excelRow = add([row.id, row.workDate, row.employee.name, row.employee.email, row.isOpen ? "Open" : "Completed",
      eventTime(row.checkInAt, row.checkInTimezone), row.checkInTimezone, location(row.checkInLatitude, row.checkInLongitude, row.checkInAccuracy, row.checkInAddress), row.checkInDescription,
      eventTime(row.checkOutAt, row.checkOutTimezone), row.checkOutTimezone, location(row.checkOutLatitude, row.checkOutLongitude, row.checkOutAccuracy, row.checkOutAddress), row.checkOutDescription,
      row.actualDurationMinutes, row.requiredWorkMinutes, row.differenceMinutes, row.dailyReport?.content ?? null,
      row.authorizationState, row.authorization?.grantedAt ?? null, row.authorization?.revokedAt ?? null, row.authorization?.note ?? null,
      overtime ? overtime.isOpen ? "Open" : "Completed" : null,
      checkIn ? eventTime(checkIn.at, checkIn.timezone) : null, checkIn?.timezone ?? null, checkIn ? location(checkIn.latitude, checkIn.longitude, checkIn.accuracy, checkIn.address) : null, checkIn?.description ?? null,
      checkOut ? eventTime(checkOut.at, checkOut.timezone) : null, checkOut?.timezone ?? null, checkOut ? location(checkOut.latitude, checkOut.longitude, checkOut.accuracy, checkOut.address) : null, checkOut?.description ?? null,
      overtime?.durationMinutes ?? null]);
    excelRow.alignment = { vertical: "top", wrapText: true };
  }
  return workbook.xlsx.writeBuffer();
}

export async function buildEmployeeReportWorkbook({ items, summaries, filters }: {
  items: EmployeeReportExportRow[]; summaries: EmployeeReportSummary[]; filters: EmployeeReportQuery;
}) {
  assertReportExportLimit(items.length);
  assertReportExportLimit(summaries.length);
  const workbook = new ExcelJS.Workbook();
  workbook.creator = "ETime";
  function worksheet(name: string, headers: string[]) {
    const sheet = workbook.addWorksheet(name, { views: [{ state: "frozen", ySplit: 4 }] });
    sheet.columns = headers.map(header => ({ width: /Description|Report|Address|Note/.test(header) ? 45 : /Check In|Check Out|Email/.test(header) ? 34 : 23 }));
    const add = (values: (string | number | null)[]) => {
      const row = sheet.addRow(values.map(value => typeof value === "string" ? sanitizeExcelText(value) : value));
      row.alignment = { vertical: "top", wrapText: true };
      return row;
    };
    add([`ETime — ${name}`]).font = { bold: true, size: 16 };
    add([`Work dates: ${filters.from} to ${filters.to}; Search: ${filters.search || "None"}. Required/Difference totals compare completed regular records only. No breaks are deducted; regular and OT remain separate. Address source: Geoapify (https://www.geoapify.com/).`]);
    sheet.mergeCells(2, 1, 2, Math.min(headers.length, 8)); sheet.getRow(2).height = 45;
    add([]); const header = add(headers);
    header.font = { bold: true, color: { argb: "FFFFFFFF" } };
    header.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF145E59" } }; header.height = 32;
    sheet.autoFilter = { from: { row: 4, column: 1 }, to: { row: 4, column: headers.length } };
    return { sheet, add };
  }
  const summary = worksheet("Employee Summary", ["No.", "Employee", "Email", "Position", "Attendance", "Completed", "Incomplete", "Working",
    "Regular Hours", "Average Regular Hours", "Required Hours (completed)", "Difference Hours (completed)", "OT Sessions", "OT Hours"]);
  for (const column of [9, 10, 11, 12, 14]) summary.sheet.getColumn(column).numFmt = "0.00";
  summaries.forEach((row, index) => summary.add([index + 1, row.name, row.email, row.position, row.attendance, row.completed, row.incomplete, row.working,
    row.regularMinutes / 60, row.averageMinutes === null ? null : row.averageMinutes / 60,
    row.requiredMinutes === null ? null : row.requiredMinutes / 60, row.differenceMinutes === null ? null : row.differenceMinutes / 60, row.overtimeSessions, row.overtimeMinutes / 60]));
  const attendance = worksheet("Attendance Detail", ["Attendance ID", "Employee", "Email", "Position", "Work Date", "Status",
    "Check In", "Check In Timezone", "Check In Description", "Check In Address", "Check In Latitude", "Check In Longitude", "Check In Accuracy (m)",
    "Check Out", "Check Out Timezone", "Check Out Description", "Check Out Address", "Check Out Latitude", "Check Out Longitude", "Check Out Accuracy (m)",
    "Actual Duration (minutes)", "Required Duration (minutes)", "Difference (minutes)", "Daily Report",
    "Authorization State", "Granted At (UTC)", "Revoked At (UTC)", "Authorization Note"]);
  const overtime = worksheet("Overtime Detail", ["Overtime ID", "Employee", "Email", "Position", "Work Date", "Status",
    "OT Check In", "Check In Timezone", "Check In Description", "Check In Address", "Check In Latitude", "Check In Longitude", "Check In Accuracy (m)",
    "OT Check Out", "Check Out Timezone", "Check Out Description", "Check Out Address", "Check Out Latitude", "Check Out Longitude", "Check Out Accuracy (m)", "OT Duration (minutes)"]);
  for (const row of items) {
    const closed = row.checkOutAt !== null;
    attendance.add([row.id, row.employee.name, row.employee.email, row.employee.position, row.workDate, row.state,
      eventTime(row.checkInAt, row.checkInTimezone), row.checkInTimezone, row.checkInDescription, row.checkInAddress, row.checkInLatitude, row.checkInLongitude, row.checkInAccuracy,
      eventTime(row.checkOutAt, row.checkOutTimezone), closed ? row.checkOutTimezone : null, closed ? row.checkOutDescription : null, closed ? row.checkOutAddress : null,
      closed ? row.checkOutLatitude : null, closed ? row.checkOutLongitude : null, closed ? row.checkOutAccuracy : null,
      row.actualDurationMinutes, row.requiredWorkMinutes, row.differenceMinutes, row.dailyReport?.content ?? null,
      row.authorizationState, row.authorization?.grantedAt ?? null, row.authorization?.revokedAt ?? null, row.authorization?.note ?? null]);
    const ot = row.overtime;
    if (!ot) continue;
    const checkIn = ot.checkIn, checkOut = ot.checkOut;
    overtime.add([ot.id, row.employee.name, row.employee.email, row.employee.position, row.workDate, checkOut ? "Completed" : "In Progress",
      eventTime(checkIn.at, checkIn.timezone), checkIn.timezone, checkIn.description, checkIn.address, checkIn.latitude, checkIn.longitude, checkIn.accuracy,
      eventTime(checkOut?.at ?? null, checkOut?.timezone ?? null), checkOut?.timezone ?? null, checkOut?.description ?? null, checkOut?.address ?? null,
      checkOut?.latitude ?? null, checkOut?.longitude ?? null, checkOut?.accuracy ?? null, ot.durationMinutes]);
  }
  return workbook.xlsx.writeBuffer();
}
