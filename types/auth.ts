import type { Role } from "@/generated/prisma/enums";

export type AuthenticatedUser = {
  id: string;
  name: string;
  email: string;
  role: Role;
};
