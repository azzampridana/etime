import { z } from "zod";

export const payrollComponentIdSchema = z.uuid();
const fields = {
  name: z.string().trim().min(1).max(200).transform(value => value.replace(/\s+/gu, " ")),
  category: z.enum(["EARNING", "DEDUCTION"]),
  sortOrder: z.number().int().min(0).max(9999),
  isActive: z.boolean(),
};
const version = z.number().int().min(1).max(2147483646);
export const createPayrollComponentSchema = z.strictObject({ ...fields, isActive: fields.isActive.default(true) });
export const updatePayrollComponentSchema = z.strictObject({ ...fields, version });
export const deactivatePayrollComponentSchema = z.strictObject({ version });
export const listPayrollComponentsSchema = z.strictObject({
  category: fields.category.optional(),
  isActive: z.enum(["true", "false"]).transform(value => value === "true").optional(),
  page: z.coerce.number().int().min(1).max(1000000).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
});
export type CreatePayrollComponentInput = z.output<typeof createPayrollComponentSchema>;
export type ListPayrollComponentsInput = z.output<typeof listPayrollComponentsSchema>;
