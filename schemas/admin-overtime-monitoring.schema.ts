import { z } from "zod";
import { getBusinessDate } from "@/lib/date-time/event-time";
import { listUsersSchema } from "@/schemas/user.schema";

const numberQuery = (schema: z.ZodType<number>) => z.preprocess(
  value => typeof value === "string" && /^\d+$/.test(value) ? Number(value) : value, schema,
);
const base = z.object({
  from: z.iso.date().optional(), to: z.iso.date().optional(),
  search: listUsersSchema.shape.search,
  userId: z.union([z.literal(""), z.uuid()]).optional().transform(value => value || undefined),
  page: numberQuery(listUsersSchema.shape.page),
  pageSize: numberQuery(z.union([z.literal(15), z.literal(30), z.literal(50)]).default(15)).catch(15),
  order: z.enum(["asc", "desc"]).optional().catch(undefined),
});
function defaults<T extends { from?: string; to?: string }>(input: T) {
  const today = getBusinessDate();
  return { ...input, from: input.from ?? today, to: input.to ?? today };
}
export const overtimeActivityQuerySchema = base.extend({
  state: z.enum(["all", "open", "completed", "incomplete"]).default("all"),
  sort: z.enum(["employee", "date", "checkIn", "checkOut", "duration", "status"]).optional().catch(undefined),
}).transform(input => ({ ...defaults(input), sort: input.sort && input.order ? input.sort : undefined,
  order: input.sort && input.order ? input.order : undefined,
})).refine(input => input.from <= input.to, { message: "Date From must not be after Date To.", path: ["from"] });
export const overtimeAuthorizationMonitoringQuerySchema = base.extend({
  state: z.enum(["all", "not-authorized", "authorized", "revoked", "used"]).default("all"),
  sort: z.enum(["employee", "date", "status"]).optional().catch(undefined),
}).transform(input => ({ ...defaults(input), sort: input.sort && input.order ? input.sort : undefined,
  order: input.sort && input.order ? input.order : undefined,
})).refine(input => input.from <= input.to, { message: "Date From must not be after Date To.", path: ["from"] });
export type OvertimeActivityQuery = z.output<typeof overtimeActivityQuerySchema>;
export type OvertimeAuthorizationMonitoringQuery = z.output<typeof overtimeAuthorizationMonitoringQuerySchema>;
