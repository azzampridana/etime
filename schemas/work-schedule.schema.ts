import { z } from "zod";
export const workScheduleSchema = z.strictObject({
  id: z.uuid().optional(), name: z.string().trim().min(1).max(100),
  requiredWorkMinutes: z.number().int().min(1).max(65_535), isActive: z.boolean(),
});
