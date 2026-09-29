import "server-only";

import { redirect } from "next/navigation";
import { cache } from "react";
import { requireAdmin, requireUser } from "@/lib/authorization/require-user";
import { ApplicationError } from "@/lib/errors/application-error";

// Page redirects stay separate from action/domain errors.
// Deduplicate layout/page checks only within the current server render.
// Page checks remain necessary when Next.js reuses an existing layout.
export const requirePageUser = cache(async (adminOnly = false) => {
  try {
    return await (adminOnly ? requireAdmin() : requireUser());
  } catch (error) {
    if (error instanceof ApplicationError) {
      if (error.code === "UNAUTHENTICATED") redirect("/login");
      if (error.code === "FORBIDDEN") redirect("/home");
    }
    throw error;
  }
});
