import "server-only";

import { auth } from "@/auth";
import { resolveActiveUser } from "@/services/auth.service";

export async function getCurrentUser() {
  const session = await auth();
  return resolveActiveUser(session?.user.id);
}
