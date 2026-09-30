import { z } from "zod";

export const MAX_OVERTIME_POLICY_MINUTES = 48 * 60;
export const overtimePolicySchema = z.strictObject({
  hours: z.number().int().min(0).max(MAX_OVERTIME_POLICY_MINUTES / 60),
  minutes: z.number().int().min(0).max(59),
}).transform(({ hours, minutes }) => ({ maxOpenMinutes: hours * 60 + minutes }))
  .refine(value => value.maxOpenMinutes >= 1 && value.maxOpenMinutes <= MAX_OVERTIME_POLICY_MINUTES,
    { message: "Choose a window between 1 minute and 48 hours." });
