import "server-only";

import { requireAdmin } from "@/lib/authorization/require-user";
import type { UserMutationContext } from "@/types/user";

// No browser-provided identity or environment bypass is accepted.
export async function requireUserAdministration(): Promise<UserMutationContext> {
  const admin = await requireAdmin();
  return { actorId: admin.id };
}
