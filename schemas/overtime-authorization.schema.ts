import { z } from "zod";

export const grantOvertimeAuthorizationSchema = z.object({
  attendanceId: z.uuid(),
  note: z.string().trim().max(1000, "Note must be at most 1,000 characters.").nullish().transform((value) => value || null),
}).strict();
export const revokeOvertimeAuthorizationSchema = z.object({ attendanceId: z.uuid() }).strict();
