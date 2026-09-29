import { z } from "zod";
import { passwordSchema, userEmailSchema, userNameSchema } from "@/schemas/user.schema";

export const seedEnvironmentSchema = z.object({
  SEED_ADMIN_EMAIL: userEmailSchema,
  SEED_ADMIN_PASSWORD: passwordSchema,
  SEED_ADMIN_NAME: userNameSchema,
});
