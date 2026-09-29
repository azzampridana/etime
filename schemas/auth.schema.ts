import { z } from "zod";
import { userEmailSchema } from "@/schemas/user.schema";

export const loginSchema = z.object({
  email: userEmailSchema,
  // Login validates bounds, not the policy for creating a new password.
  password: z.string().min(1).max(72).refine(
    (value) => new TextEncoder().encode(value).length <= 72,
  ),
});
