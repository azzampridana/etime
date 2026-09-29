import type { DefaultSession } from "next-auth";
import type { Role } from "@/generated/prisma/enums";
import type { AuthenticatedUser } from "@/types/auth";

declare module "next-auth" {
  interface Session {
    user: AuthenticatedUser & DefaultSession["user"];
  }

  interface User {
    role: Role;
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    role?: Role;
  }
}
