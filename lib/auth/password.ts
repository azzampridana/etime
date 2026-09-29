import "server-only";

import bcrypt from "bcrypt";
import { passwordSchema } from "@/schemas/user.schema";

const PASSWORD_COST = 12;

export function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(passwordSchema.parse(password), PASSWORD_COST);
}

export async function verifyPassword(password: string, hash: string): Promise<boolean> {
  if (new TextEncoder().encode(password).length > 72) return false;
  return bcrypt.compare(password, hash);
}
