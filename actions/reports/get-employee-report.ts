"use server";
import { z } from "zod";
import { requireAdmin } from "@/lib/authorization/require-user";
import { ApplicationError } from "@/lib/errors/application-error";
import { employeeReportDetailSchema } from "@/schemas/report.schema";
import { getEmployeeReportDetail } from "@/services/report.service";
import type { ActionResult } from "@/types/action-result";
import type { EmployeeReportDetail } from "@/types/report";

export async function getEmployeeReportAction(raw: unknown): Promise<ActionResult<EmployeeReportDetail>> {
  try {
    await requireAdmin();
    return { success: true, message: "Report loaded.", data: await getEmployeeReportDetail(employeeReportDetailSchema.parse(raw)) };
  } catch (error) {
    return { success: false, message: error instanceof z.ZodError ? "Select valid report filters and a period of at most 366 days." : error instanceof ApplicationError ? error.message : "Unable to load the report. Please try again." };
  }
}
