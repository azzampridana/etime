"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { requireUserAdministration } from "@/lib/authorization/user-action-boundary";
import { ApplicationError } from "@/lib/errors/application-error";
import { createUserSchema, listUsersSchema, setUserActiveStatusSchema, updateUserSchema, userIdSchema } from "@/schemas/user.schema";
import { createUser, deleteUser, getUserById, listUsers, setUserActiveStatus, updateUser } from "@/services/user.service";
import type { ActionResult } from "@/types/action-result";
import type { UserDto, UserListDto, UserMutationContext } from "@/types/user";

async function runUserAction<T>(operation: (context: UserMutationContext) => Promise<T>, mutation = false): Promise<ActionResult<T>> {
  try {
    const context = await requireUserAdministration();
    const data = await operation(context);
    if (mutation) {
      revalidatePath("/admin/users");
      revalidatePath("/admin/users/[id]/edit", "page");
      revalidatePath("/admin/attendance");
      revalidatePath("/home");
    }
    return { success: true, message: "Operation completed.", data };
  } catch (error) {
    if (error instanceof z.ZodError) {
      return { success: false, message: "Please check the supplied information.", fieldErrors: z.flattenError(error).fieldErrors };
    }
    return { success: false, message: error instanceof ApplicationError ? error.message : "Unable to complete the operation. Please try again." };
  }
}

export async function createUserAction(input: unknown): Promise<ActionResult<UserDto>> {
  return runUserAction((context) => createUser(createUserSchema.parse(input), context), true);
}

export async function updateUserAction(input: unknown): Promise<ActionResult<UserDto>> {
  return runUserAction((context) => updateUser(updateUserSchema.parse(input), context), true);
}

export async function setUserActiveStatusAction(input: unknown): Promise<ActionResult<UserDto>> {
  return runUserAction((context) => setUserActiveStatus(setUserActiveStatusSchema.parse(input), context), true);
}

export async function getUserAction(id: unknown): Promise<ActionResult<UserDto>> {
  return runUserAction(() => getUserById(userIdSchema.parse(id)));
}

export async function deleteUserAction(id: unknown): Promise<ActionResult<{ id: string }>> {
  return runUserAction((context) => deleteUser(userIdSchema.parse(id), context), true);
}

export async function listUsersAction(input: unknown): Promise<ActionResult<UserListDto>> {
  return runUserAction(() => listUsers(listUsersSchema.parse(input)));
}
