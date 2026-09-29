"use server";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireAdmin } from "@/lib/authorization/require-user";
import { ApplicationError } from "@/lib/errors/application-error";
import { saveWorkSchedule } from "@/services/work-schedule.service";
import type { ActionResult } from "@/types/action-result";

export async function saveWorkScheduleAction(input: unknown): Promise<ActionResult> {
  try {
    const admin = await requireAdmin(); await saveWorkSchedule(input, admin.id);
    revalidatePath("/admin/users/work-schedules"); revalidatePath("/admin/users/new");
    revalidatePath("/admin/users/[id]/edit", "page"); revalidatePath("/home");
    return { success: true, message: "Duration policy saved. Historical attendance is unchanged." };
  } catch (error) {
    if (error instanceof z.ZodError) return { success: false, message: "Check the name and whole-number required minutes.", fieldErrors: z.flattenError(error).fieldErrors };
    return { success: false, message: error instanceof ApplicationError ? error.message : "Unable to save the duration policy." };
  }
}
