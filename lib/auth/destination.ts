import type { Role } from "@/generated/prisma/enums";

export function getLoginDestination(role: Role): "/admin" | "/home" {
  return role === "ADMIN" ? "/admin" : "/home";
}
