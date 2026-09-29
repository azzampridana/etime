import "server-only";

import { getCurrentUser } from "@/lib/auth/current-user";
import { assertAdmin, assertAuthenticatedUser } from "@/lib/authorization/policy";

export async function requireUser() {
  return assertAuthenticatedUser(await getCurrentUser());
}

export async function requireAdmin() {
  return assertAdmin(await getCurrentUser());
}
