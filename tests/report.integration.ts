import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import path from "node:path";
import { tmpdir } from "node:os";
import ExcelJS from "exceljs";
import { loadEnvConfig } from "@next/env";
import { getPrisma, disconnectDatabase } from "@/lib/db/prisma";
import { LocalStorage } from "@/lib/storage/local-storage";
import { listReport, getReportExport } from "@/services/report.service";
import { checkIn } from "@/services/attendance.service";
import { buildReportWorkbook } from "@/lib/reports/excel";
import { createMonitoringFixture } from "./admin-overtime.fixture";

loadEnvConfig(process.cwd());
// Tests never call a real geocoder; focused tests inject mocked providers.
process.env.GEOAPIFY_API_KEY = "";
let stage = "fixtures";
async function main() {
  const db = getPrisma(), root = await mkdtemp(path.join(tmpdir(), "etime-report-test-"));
  let fixture: Awaited<ReturnType<typeof createMonitoringFixture>> | undefined;
  try {
    fixture = await createMonitoringFixture(new LocalStorage(root));
    const { worker, inactive, other, marker, rows } = fixture;
    const first = rows.find(row => row.userId === worker.id && row.workDate === "2026-09-01")!;
    await db.dailyReport.update({ where: { attendanceId: first.attendanceId }, data: { content: "=1+1\nMultiline report preserved" } });
    await db.workSchedule.update({ where: { id: worker.workSchedule.id }, data: { requiredWorkMinutes: 300 } });
    const opened = await checkIn(other.id, { latitude: -6.2, longitude: 106.8, accuracy: 12, timezone: "Asia/Jakarta" }, () => new Date("2026-09-04T01:00:00Z"));
    const before = await fixture.snapshot();
    const query = { from: "2026-09-01", to: "2026-09-04", search: marker, page: 2, pageSize: 1 };
    stage = "report queries and mapped data";
    const preview = await listReport(query), exported = await getReportExport(query);
    assert.equal(preview.total, 7); assert.equal(preview.items.length, 1); assert.equal(exported.items.length, 7);
    assert.equal(new Set(exported.items.map(row => row.id)).size, 7);
    assert.equal(preview.items[0].id, exported.items[1].id);
    const historical = exported.items.find(row => row.id === first.attendanceId)!;
    assert.equal(historical.workDate, "2026-09-01"); assert.equal(historical.requiredWorkMinutes, 480);
    assert.equal(historical.actualDurationMinutes, 480); assert.equal(historical.differenceMinutes, 0);
    assert.equal(historical.overtime!.durationMinutes, 555); assert.equal(historical.authorizationState, "Revoked");
    assert.equal(historical.overtime!.checkIn.timezone, "Asia/Jakarta"); assert.equal(historical.overtime!.checkOut!.timezone, "Asia/Makassar");
    assert.equal(historical.overtime!.checkOut!.at.slice(0, 10), "2026-09-02");
    const open = exported.items.find(row => row.id === opened.id)!;
    assert.equal(open.actualDurationMinutes, null); assert.equal(open.differenceMinutes, null); assert.equal(open.checkOutAt, null);
    assert.equal(exported.items.find(row => row.overtime?.isOpen)!.overtime!.durationMinutes, null);
    const day = await getReportExport({ ...query, from: "2026-09-01", to: "2026-09-01" });
    assert.equal(day.items.length, 2); assert.ok(day.items.some(row => row.employee.id === inactive.id));
    assert.equal((await listReport({ ...query, userId: inactive.id })).total, 3);
    stage = "workbook values";
    const workbook = new ExcelJS.Workbook(); await workbook.xlsx.load(await buildReportWorkbook(exported.items, exported.filters));
    const sheet = workbook.getWorksheet("Attendance Report")!;
    assert.equal(sheet.rowCount - 4, 7);
    const excelRow = sheet.getRow(exported.items.indexOf(historical) + 5);
    assert.equal(excelRow.getCell(2).value, "2026-09-01");
    assert.equal(excelRow.getCell(14).value, 480); assert.equal(excelRow.getCell(15).value, 480); assert.equal(excelRow.getCell(31).value, 555);
    assert.equal(excelRow.getCell(17).value, "'=1+1\nMultiline report preserved");
    assert.equal(excelRow.getCell(17).type, ExcelJS.ValueType.String); assert.equal(excelRow.getCell(17).alignment.wrapText, true);
    assert.match(String(excelRow.getCell(23).value), /WIB/); assert.match(String(excelRow.getCell(27).value), /WITA/);
    assert.ok(!JSON.stringify(exported.items).includes("passwordHash")); assert.ok(!JSON.stringify(exported.items).includes("PhotoPath"));
    assert.deepEqual(await fixture.snapshot(), before);
    console.log("PASS reports: workDate, historical requirement, separate durations, cross-midnight zones, inactive/revoked history, one row per attendance, export across pages, literal multiline workbook and read-only evidence.");
  } finally { await fixture?.cleanup(); await rm(root, { recursive: true, force: true }); await disconnectDatabase(); }
}
main().catch((error: unknown) => { console.error(`Report integration failed during ${stage}.`); if (error instanceof assert.AssertionError) console.error(error.message); process.exitCode = 1; });
