"use server";
import { z } from "zod";
import { revalidatePath } from "next/cache";
import { requireUser } from "@/lib/authorization/require-user";
import { ApplicationError } from "@/lib/errors/application-error";
import { parseOvertimeForm } from "@/schemas/overtime.schema";
import { overtimeCheckIn, overtimeCheckOut, prepareOvertimeLocation } from "@/services/overtime.service";
import type { ActionResult } from "@/types/action-result";
import type { OvertimeDto } from "@/types/overtime";

async function mutate(form: FormData, checkout: boolean): Promise<ActionResult<OvertimeDto>> {
  try {
    const user = await requireUser();
    const { evidence, photo } = parseOvertimeForm(form);
    const data = await (checkout ? overtimeCheckOut : overtimeCheckIn)(user.id, evidence, photo);
    revalidatePath("/overtime");
    return { success: true, message: checkout ? "Overtime checked out." : "Overtime checked in.", data };
  } catch (error) {
    if (error instanceof z.ZodError) return { success: false, message: "Please check your location, description, and photo.", fieldErrors: z.flattenError(error).fieldErrors };
    return { success: false, message: error instanceof ApplicationError ? error.message : "Unable to save overtime. Refresh and try again." };
  }
}
export async function overtimeCheckInAction(form: FormData) { return mutate(form, false); }
export async function overtimeCheckOutAction(form: FormData) { return mutate(form, true); }

export async function prepareOvertimeLocationAction(raw: unknown): Promise<ActionResult<Awaited<ReturnType<typeof prepareOvertimeLocation>>>> {
  try {
    const user = await requireUser();
    return { success: true, message: "Location ready.", data: await prepareOvertimeLocation(user.id, raw) };
  } catch (error) {
    return { success: false, message: error instanceof ApplicationError ? error.message : error instanceof z.ZodError ? "Please acquire a valid location again." : "Unable to prepare location. Please try again." };
  }
}
