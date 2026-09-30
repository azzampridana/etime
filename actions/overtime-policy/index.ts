"use server";
import { z } from "zod";
import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/authorization/require-user";
import { ApplicationError } from "@/lib/errors/application-error";
import { saveOvertimePolicy } from "@/services/overtime-policy.service";
import type { ActionResult } from "@/types/action-result";

export async function saveOvertimePolicyAction(input: unknown): Promise<ActionResult> {
  try {
    const admin = await requireAdmin();
    await saveOvertimePolicy(input, admin.id);
    revalidatePath("/admin/users/work-schedules");
    return { success: true, message: "Overtime policy saved. Existing sessions keep their original checkout window." };
  } catch (error) {
    if (error instanceof z.ZodError) return { success: false, message: "Use whole-number hours and minutes: 1 minute to 48 hours total, with minutes from 0 to 59." };
    return { success: false, message: error instanceof ApplicationError ? error.message : "Unable to save overtime policy." };
  }
}
