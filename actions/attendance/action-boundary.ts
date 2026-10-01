import "server-only";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireUser } from "@/lib/authorization/require-user";
import { ApplicationError } from "@/lib/errors/application-error";
import type { ActionResult } from "@/types/action-result";

export async function runAttendanceAction<T>(operation: (userId: string) => Promise<T>, message: string, revalidate = true): Promise<ActionResult<T> & { locationError?: "expired" | "invalid" }> {
  try {
    const user = await requireUser();
    const data = await operation(user.id);
    if (revalidate) {
      revalidatePath("/attendance");
      revalidatePath("/home");
    }
    return { success: true, message, data };
  } catch (error) {
    if (error instanceof ApplicationError && (error.code === "LOCATION_EXPIRED" || error.code === "LOCATION_INVALID")) {
      return { success: false, message: error.message, locationError: error.code === "LOCATION_EXPIRED" ? "expired" : "invalid" };
    }
    if (error instanceof z.ZodError) {
      return { success: false, message: "Please check the supplied information.", fieldErrors: z.flattenError(error).fieldErrors };
    }
    return { success: false, message: error instanceof ApplicationError ? error.message : "Unable to complete the operation. Please try again." };
  }
}
