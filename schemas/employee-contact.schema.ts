import { z } from "zod";
const version = z.number().int().min(1).max(2147483646);
const fields = { name: z.string().trim().min(1).max(100), relationship: z.string().trim().min(1).max(50),
  phoneNumber: z.string().trim().min(1).max(50), address: z.string().trim().max(5000).nullish().transform(value => value || null),
  isEmergencyContact: z.boolean(), isPrimary: z.boolean() };
export const createContactSchema = z.strictObject({ ...fields, employeeVersion: version });
export const updateContactSchema = z.strictObject({ ...fields, employeeVersion: version, version });
export const deleteContactSchema = z.strictObject({ employeeVersion: version, version });
export const contactPageSchema = z.coerce.number().int().min(1).max(1000000).default(1);
export type ContactInput = Omit<z.output<typeof createContactSchema>, "employeeVersion">;
