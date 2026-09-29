import { adminAttendanceQuerySchema } from "@/schemas/admin-query.schema";
import type { AdminAttendanceQuery } from "@/schemas/admin-query.schema";
import { z } from "zod";
import { defaultAttendanceRange } from "@/schemas/admin-query.schema";
import { listUsersSchema } from "@/schemas/user.schema";

// Shared work-date, employee, regular-state and bounded pagination semantics.
export const reportQuerySchema = adminAttendanceQuerySchema;
export type ReportQuery = AdminAttendanceQuery;

export const MAX_EMPLOYEE_REPORT_DAYS = 366;
const numberQuery = (schema: z.ZodType<number>) => z.preprocess(value => typeof value === "string" && /^\d+$/.test(value) ? Number(value) : value, schema);
export const employeeReportQuerySchema = z.object({
  from: z.iso.date().optional(), to: z.iso.date().optional(), search: listUsersSchema.shape.search,
  page: numberQuery(listUsersSchema.shape.page),
  pageSize: numberQuery(z.union([z.literal(15), z.literal(30), z.literal(50)]).default(15)).catch(15),
  sort: z.enum(["employee", "attendance", "completed", "incomplete", "regular", "average", "overtime", "overtimeHours"]).optional().catch(undefined),
  order: z.enum(["asc", "desc"]).optional().catch(undefined),
}).transform(input => {
  const range = defaultAttendanceRange();
  return { ...input, from: input.from ?? range.from, to: input.to ?? range.to,
    sort: input.sort && input.order ? input.sort : undefined, order: input.sort && input.order ? input.order : undefined };
}).refine(input => input.from <= input.to && (Date.parse(input.to) - Date.parse(input.from)) / 86_400_000 < MAX_EMPLOYEE_REPORT_DAYS,
  { message: `Select an ordered date range of at most ${MAX_EMPLOYEE_REPORT_DAYS} days.`, path: ["to"] });
export type EmployeeReportQuery = z.output<typeof employeeReportQuerySchema>;
export const employeeReportDetailSchema = z.object({ employeeId: z.uuid(), filters: employeeReportQuerySchema });
