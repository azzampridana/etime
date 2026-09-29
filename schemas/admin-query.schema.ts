import { z } from "zod";
import { listUsersSchema } from "@/schemas/user.schema";
import { getLocalWorkDate } from "@/lib/date-time/event-time";
import { ADMIN_REFERENCE_TIMEZONE } from "@/lib/date-time/constants";

export type AdminSearchParams = Record<string, string | string[] | undefined>;
const numberQuery = (schema: z.ZodType<number>) => z.preprocess(
  (value) => typeof value === "string" && /^\d+$/.test(value) ? Number(value) : value, schema,
);
const pagination = { page: numberQuery(listUsersSchema.shape.page), pageSize: numberQuery(listUsersSchema.shape.pageSize) };
const optionalId = z.union([z.literal(""), z.uuid()]).optional().transform((value) => value || undefined);

export const adminUsersQuerySchema = z.object({
  ...pagination,
  pageSize: numberQuery(z.union([z.literal(15), z.literal(30), z.literal(50)]).default(15)).catch(15),
  sort: listUsersSchema.shape.sort.catch(undefined),
  order: listUsersSchema.shape.order.catch(undefined),
  search: listUsersSchema.shape.search,
  role: z.enum(["", "ADMIN", "USER"]).optional(),
  status: z.enum(["", "active", "inactive"]).optional(),
}).transform(({ role, status, ...input }) => listUsersSchema.parse({
  ...input,
  sort: input.sort && input.order ? input.sort : undefined,
  order: input.sort && input.order ? input.order : undefined,
  role: role || undefined, isActive: status ? status === "active" : undefined,
}));

export function defaultAttendanceRange(now = new Date()) {
  const to = getLocalWorkDate(now, ADMIN_REFERENCE_TIMEZONE);
  return { from: `${to.slice(0, 8)}01`, to };
}

const attendanceQueryFields = {
  ...pagination,
  from: z.iso.date().optional(),
  to: z.iso.date().optional(),
  userId: optionalId,
  search: listUsersSchema.shape.search,
};
function withDateRange<T extends { from?: string; to?: string }>(input: T) {
  const defaults = defaultAttendanceRange();
  return { ...input, from: input.from ?? defaults.from, to: input.to ?? defaults.to };
}
export const adminAttendanceQuerySchema = z.object({
  ...attendanceQueryFields,
  state: z.enum(["all", "open", "completed"]).default("all"),
}).transform(withDateRange).refine((input) => input.from <= input.to, { message: "Date From must not be after Date To.", path: ["from"] });

export const adminOvertimeAuthorizationQuerySchema = z.object({
  ...attendanceQueryFields,
  state: z.enum(["all", "not-authorized", "authorized", "revoked"]).default("all"),
}).transform(withDateRange).refine((input) => input.from <= input.to, { message: "Date From must not be after Date To.", path: ["from"] });
export type AdminOvertimeAuthorizationQuery = z.output<typeof adminOvertimeAuthorizationQuerySchema>;

export type AdminAttendanceQuery = z.output<typeof adminAttendanceQuerySchema>;

// Monitoring has its own defaults; Reports and Overtime retain their existing contract.
export const adminAttendanceMonitoringQuerySchema = z.object({
  ...attendanceQueryFields,
  pageSize: numberQuery(z.union([z.literal(15), z.literal(30), z.literal(50)]).default(15)).catch(15),
  state: z.enum(["all", "working", "completed", "incomplete"]).default("all"),
  sort: z.enum(["employee", "date", "checkIn", "checkOut", "status"]).optional().catch(undefined),
  order: z.enum(["asc", "desc"]).optional().catch(undefined),
}).transform(input => {
  const today = getLocalWorkDate(new Date(), ADMIN_REFERENCE_TIMEZONE);
  return { ...input, from: input.from ?? today, to: input.to ?? today,
    sort: input.sort && input.order ? input.sort : undefined,
    order: input.sort && input.order ? input.order : undefined };
}).refine(input => input.from <= input.to, { message: "Date From must not be after Date To.", path: ["from"] });
export type AdminAttendanceMonitoringQuery = z.output<typeof adminAttendanceMonitoringQuerySchema>;

// Activity monitoring shares the established work-date/state/pagination contract.
export const adminOvertimeQuerySchema = adminAttendanceQuerySchema;
export type AdminOvertimeQuery = z.output<typeof adminOvertimeQuerySchema>;
