import { z } from "zod";
import { requireAdmin } from "@/lib/authorization/require-user";
import { ApplicationError } from "@/lib/errors/application-error";
import { getEmployeeReportExport } from "@/services/report.service";
import { buildEmployeeReportWorkbook, reportFilename } from "@/lib/reports/excel";
import type { AdminSearchParams } from "@/schemas/admin-query.schema";

export const runtime = "nodejs";
export async function GET(request: Request) {
  const headers = { "Cache-Control": "private, no-store", "X-Content-Type-Options": "nosniff" };
  try {
    await requireAdmin();
    const params = new URL(request.url).searchParams;
    const input: AdminSearchParams = {};
    for (const key of new Set(params.keys())) {
      const values = params.getAll(key);
      input[key] = values.length === 1 ? values[0] : values;
    }
    const data = await getEmployeeReportExport(input);
    const buffer = await buildEmployeeReportWorkbook(data);
    return new Response(new Uint8Array(buffer), { headers: { ...headers,
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="${reportFilename(data.filters)}"`,
    } });
  } catch (error) {
    if (error instanceof z.ZodError) return Response.json({ message: "Invalid report filters. Select an ordered date range of at most 366 days." }, { status: 400, headers });
    if (error instanceof ApplicationError) {
      const status = error.code === "UNAUTHENTICATED" ? 401 : error.code === "FORBIDDEN" ? 403 : 400;
      return Response.json({ message: error.message }, { status, headers });
    }
    return Response.json({ message: "Unable to export the report. Please try again." }, { status: 500, headers });
  }
}
