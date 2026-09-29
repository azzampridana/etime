import "server-only";

import { verifyPassword } from "@/lib/auth/password";
import { findUserCredentialsByEmail, findUserIdentityById } from "@/repositories/user.repository";
import { loginSchema } from "@/schemas/auth.schema";
import { userIdSchema } from "@/schemas/user.schema";
import type { AuthenticatedUser } from "@/types/auth";

type IdentityRecord = NonNullable<Awaited<ReturnType<typeof findUserIdentityById>>>;
type CredentialsRecord = NonNullable<Awaited<ReturnType<typeof findUserCredentialsByEmail>>>;

function toIdentity(user: IdentityRecord): AuthenticatedUser {
  return { id: user.id, name: user.name, email: user.email, role: user.role };
}

// A public dummy hash makes unknown accounts perform the same bcrypt work.
// It is not associated with any account and is never accepted as a credential.
const UNKNOWN_USER_HASH = "$2b$12$R9h/cIPz0gi.URNNX3kh2OPST9/PgBkqquzi.Ss7KIUgO2t0jWMUW";

export async function authenticateCredentials(
  raw: unknown,
  lookup: (email: string) => Promise<CredentialsRecord | null> = findUserCredentialsByEmail,
): Promise<AuthenticatedUser | null> {
  const parsed = loginSchema.safeParse(raw);
  if (!parsed.success) return null;
  const user = await lookup(parsed.data.email);
  const validPassword = await verifyPassword(parsed.data.password, user?.passwordHash ?? UNKNOWN_USER_HASH);
  if (!user || !validPassword || !user.isActive) return null;
  return toIdentity(user);
}

// No global/cache wrapper: every protected request must see current DB state.
// The lookup parameter is a narrow test seam, never a client/action argument.
export async function resolveActiveUser(
  id: unknown,
  lookup: (id: string) => Promise<IdentityRecord | null> = findUserIdentityById,
): Promise<AuthenticatedUser | null> {
  const parsed = userIdSchema.safeParse(id);
  if (!parsed.success) return null;
  const user = await lookup(parsed.data);
  return user?.isActive ? toIdentity(user) : null;
}
