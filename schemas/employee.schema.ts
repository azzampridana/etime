import { z } from "zod";

const optionalText = (max: number) => z.string().trim().max(max).nullish().transform(value => value || null);
const dateOnly = z.union([z.literal(""), z.iso.date()]).nullish().transform(value => value || null);
export const employeeIdSchema = z.uuid();
export const employmentStatuses = ["ACTIVE", "INACTIVE", "RESIGNED", "TERMINATED"] as const;
export const genders = ["MALE", "FEMALE", "OTHER"] as const;
export const maritalStatuses = ["SINGLE", "MARRIED", "DIVORCED", "WIDOWED"] as const;
export const employmentTypes = ["PERMANENT", "CONTRACT", "PROBATION", "INTERN", "FREELANCE"] as const;
const fields = {
  npwp: optionalText(32), placeOfBirth: optionalText(100), dateOfBirth: dateOnly,
  gender: z.enum(genders).nullable().default(null), maritalStatus: z.enum(maritalStatuses).nullable().default(null),
  employmentType: z.enum(employmentTypes).nullable().default(null),
  bpjsKesehatanNumber: optionalText(50), bpjsKetenagakerjaanNumber: optionalText(50),
  fullName: z.string().trim().min(1).max(100), nik: optionalText(32),
  phoneNumber: optionalText(50), address: optionalText(5000),
  employeeNumber: optionalText(50), jobTitle: optionalText(100),
  joinDate: dateOnly, employmentStatus: z.enum(employmentStatuses), employmentEndDate: dateOnly,
  bankName: optionalText(100), bankAccountNumber: optionalText(100), bankAccountHolder: optionalText(100),
};
const datesOrdered = (value: { joinDate: string | null; employmentEndDate: string | null }) =>
  !value.joinDate || !value.employmentEndDate || value.employmentEndDate >= value.joinDate;
const dateError = { message: "Employment end date must not precede join date.", path: ["employmentEndDate"] };
export const createEmployeeSchema = z.strictObject({ ...fields, userId: z.uuid().optional() }).refine(datesOrdered, dateError);
export const updateEmployeeSchema = z.strictObject({ ...fields, version: z.number().int().min(1).max(2147483646) }).refine(datesOrdered, dateError);
export const listEmployeesSchema = z.strictObject({
  search: z.string().trim().max(100).default(""),
  page: z.coerce.number().int().min(1).max(1000000).default(1),
  pageSize: z.coerce.number().pipe(z.union([z.literal(15), z.literal(30), z.literal(50)])).default(15),
  sort: z.enum(["name", "position", "status"]).default("name"),
  order: z.enum(["asc", "desc"]).default("asc"),
});
export type EmployeeListInput = z.output<typeof listEmployeesSchema>;
export type EmployeeInput = Omit<z.output<typeof createEmployeeSchema>, "userId">;
export const employeeLinkOptionsSchema = z.strictObject({ kind: z.enum(["employee", "user"]), search: z.string().trim().max(100).default("") });
