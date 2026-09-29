import type { UserRecord } from "@/repositories/user.repository";
import type { UserDto } from "@/types/user";

export function toUserDto(user: UserRecord): UserDto {
  return {
    id: user.id,
    name: user.name,
    position: user.position,
    email: user.email,
    role: user.role,
    isActive: user.isActive,
    workSchedule: {
      id: user.workSchedule.id,
      name: user.workSchedule.name,
      requiredWorkMinutes: user.workSchedule.requiredWorkMinutes,
      isActive: user.workSchedule.isActive,
    },
    createdAt: user.createdAt.toISOString(),
    updatedAt: user.updatedAt.toISOString(),
  };
}
