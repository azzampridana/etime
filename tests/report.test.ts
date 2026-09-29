import assert from "node:assert/strict";
import test from "node:test";
import ExcelJS from "exceljs";
import { buildReportWorkbook, sanitizeExcelText } from "@/lib/reports/excel";
import { MAX_REPORT_EXPORT_ROWS, assertReportExportLimit } from "@/lib/reports/export-limit";
import { reportQuerySchema } from "@/schemas/report.schema";
import type { ReportDto } from "@/types/report";

test("report filters reuse validated work-date boundaries; exports reject overflow without truncation", async () => {
  for (const input of [{ from: "2026-09-03", to: "2026-09-01" }, { from: ["2026-09-01"] }, { userId: "invalid" }, { pageSize: 101 }]) assert.equal(reportQuerySchema.safeParse(input).success, false);
  assert.doesNotThrow(() => assertReportExportLimit(MAX_REPORT_EXPORT_ROWS));
  assert.throws(() => assertReportExportLimit(MAX_REPORT_EXPORT_ROWS + 1), /Narrow the date range/);
  await assert.rejects(buildReportWorkbook(Array<ReportDto>(MAX_REPORT_EXPORT_ROWS + 1), reportQuerySchema.parse({})), /Narrow the date range/);
});

test("Excel text neutralizes formula prefixes without damaging ordinary/multiline text; empty workbook is valid", async () => {
  for (const text of ["=1+1", "+SUM(A1)", "-1+1", "@SUM(A1)", " \t=1+1", "\r\n@evil"]) assert.equal(sanitizeExcelText(text), `'${text}`);
  for (const text of ["Ordinary text", "First line\nSecond line", "", "Inspection - completed"]) assert.equal(sanitizeExcelText(text), text);
  const bytes = await buildReportWorkbook([], reportQuerySchema.parse({ from: "2026-09-01", to: "2026-09-03" }));
  const workbook = new ExcelJS.Workbook(); await workbook.xlsx.load(bytes);
  const sheet = workbook.getWorksheet("Attendance Report")!;
  assert.equal(sheet.rowCount, 4); assert.equal(sheet.getCell("A4").value, "Attendance ID");
});
