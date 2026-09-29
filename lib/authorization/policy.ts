import { ApplicationError } from "@/lib/errors/application-error";
import type { AuthenticatedUser } from "@/types/auth";

// These checks take the result of resolveActiveUser, never raw JWT claims.
export function assertAuthenticatedUser(user: AuthenticatedUser | null): AuthenticatedUser {
  if (!user) throw new ApplicationError("UNAUTHENTICATED", "Please sign in to continue.");
  return user;
}

export function assertAdmin(user: AuthenticatedUser | null): AuthenticatedUser {
  const activeUser = assertAuthenticatedUser(user);
  if (activeUser.role !== "ADMIN") throw new ApplicationError("FORBIDDEN", "You do not have permission to perform this operation.");
  return activeUser;
}
