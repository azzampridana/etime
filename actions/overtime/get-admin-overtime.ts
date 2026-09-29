"use server";
import { z } from "zod";
import { requireAdmin } from "@/lib/authorization/require-user";
import { ApplicationError } from "@/lib/errors/application-error";
import { getOvertimeMonitoringDetail } from "@/services/admin-overtime-monitoring.service";
import type { ActionResult } from "@/types/action-result";
import type { OvertimeMonitoringDetail } from "@/types/admin-overtime-monitoring";

export async function getAdminOvertimeAction(id: unknown): Promise<ActionResult<OvertimeMonitoringDetail>> {
  try {
    await requireAdmin();
    return { success: true, message: "Overtime loaded.", data: await getOvertimeMonitoringDetail(z.uuid().parse(id)) };
  } catch (error) {
    return { success: false, message: error instanceof z.ZodError ? "Invalid overtime ID." : error instanceof ApplicationError ? error.message : "Unable to load overtime. Please try again." };
  }
}
