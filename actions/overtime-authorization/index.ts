"use server";
import { z } from "zod";
import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/authorization/require-user";
import { ApplicationError } from "@/lib/errors/application-error";
import { grantOvertimeAuthorizationSchema, revokeOvertimeAuthorizationSchema } from "@/schemas/overtime-authorization.schema";
import { grantOvertimeAuthorization, revokeOvertimeAuthorization } from "@/services/overtime-authorization.service";
import type { ActionResult } from "@/types/action-result";
import type { OvertimeAuthorizationAttendanceDto } from "@/types/overtime-authorization";

async function mutate(input: unknown, operation: "grant" | "revoke"): Promise<ActionResult<OvertimeAuthorizationAttendanceDto>> {
  try {
    const admin = await requireAdmin();
    const result = operation === "grant"
      ? await grantOvertimeAuthorization(admin.id, grantOvertimeAuthorizationSchema.parse(input))
      : await revokeOvertimeAuthorization(admin.id, revokeOvertimeAuthorizationSchema.parse(input));
    revalidatePath("/admin/overtime");
    revalidatePath("/admin");
    return { success: true, message: result.message, data: result.item };
  } catch (error) {
    if (error instanceof z.ZodError) return { success: false, message: "Please check the supplied information.", fieldErrors: z.flattenError(error).fieldErrors };
    return { success: false, message: error instanceof ApplicationError ? error.message : "Unable to update authorization. Please try again." };
  }
}
export async function grantOvertimeAuthorizationAction(input: unknown) { return mutate(input, "grant"); }
export async function revokeOvertimeAuthorizationAction(input: unknown) { return mutate(input, "revoke"); }
