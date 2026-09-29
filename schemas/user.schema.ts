import { z } from "zod";
import { Role } from "@/generated/prisma/enums";

export const userIdSchema = z.uuid();
export const userNameSchema = z.string().trim().min(1).max(100);
export const userPositionSchema = z.string().trim().max(100).nullable().transform(value => value || null).optional();
export const userEmailSchema = z.string().trim().toLowerCase().pipe(z.email().max(254));
export const passwordSchema = z.string().min(8).max(72).refine(
  (password) => new TextEncoder().encode(password).length <= 72,
  "Password must not exceed 72 UTF-8 bytes.",
);

const userFields = {
  name: userNameSchema,
  position: userPositionSchema,
  email: userEmailSchema,
  role: z.enum(Role),
  workScheduleId: z.uuid(),
};

export const createUserSchema = z.strictObject({
  ...userFields,
  password: passwordSchema,
  role: userFields.role.default(Role.USER),
  isActive: z.boolean().default(true),
});

export const updateUserSchema = z.strictObject({
  id: userIdSchema,
  ...userFields,
  password: z.union([z.literal(""), passwordSchema]).optional()
    .transform((value) => value === "" ? undefined : value),
});

export const setUserActiveStatusSchema = z.strictObject({
  id: userIdSchema,
  isActive: z.boolean(),
});

export const listUsersSchema = z.strictObject({
  page: z.number().int().min(1).max(100_000).default(1),
  pageSize: z.number().int().min(1).max(100).default(20),
  search: z.string().trim().max(100).optional(),
  role: z.enum(Role).optional(),
  isActive: z.boolean().optional(),
  sort: z.enum(["name", "email", "position", "status"]).optional(),
  order: z.enum(["asc", "desc"]).optional(),
});

export type CreateUserInput = z.infer<typeof createUserSchema>;
export type UpdateUserInput = z.infer<typeof updateUserSchema>;
export type SetUserActiveStatusInput = z.infer<typeof setUserActiveStatusSchema>;
export type ListUsersInput = z.infer<typeof listUsersSchema>;
