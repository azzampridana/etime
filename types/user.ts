import type { Role } from "@/generated/prisma/enums";

export type UserDto = {
  id: string;
  name: string;
  position: string | null;
  email: string;
  role: Role;
  isActive: boolean;
  workSchedule: {
    id: string;
    name: string;
    requiredWorkMinutes: number;
    isActive: boolean;
  };
  createdAt: string;
  updatedAt: string;
};

export type UserListDto = {
  items: UserDto[];
  total: number;
  page: number;
  pageSize: number;
};

// Internal server context only. Actions must obtain identity from Phase 3 auth.
// Null identifies trusted bootstrap/system work, never a browser-supplied actor.
export type UserMutationContext = { actorId: string | null };
