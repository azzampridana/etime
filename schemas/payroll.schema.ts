import { z } from "zod";

const year = z.number().int().min(2000).max(2100);
const month = z.number().int().min(1).max(12);
const version = z.number().int().min(1).max(2147483646);
const optionalBankText = z.string().trim().max(100).nullish().transform(value => value || null);
// JSON numbers must be safe integers. Decimal strings support the full DECIMAL(18,0) range.
const amount = z.union([
  z.string().trim().regex(/^(0|[1-9]\d{0,17})$/, "Use nonnegative whole rupiah, up to 18 digits."),
  z.number().int().min(0).max(Number.MAX_SAFE_INTEGER).transform(String),
]);
const item = z.strictObject({
  name: z.string().trim().min(1).max(200),
  category: z.enum(["EARNING", "DEDUCTION"]),
  amount,
  sortOrder: z.number().int().min(0).max(9999),
});
function validateItems(rows: { sortOrder: number; category: string; id?: string }[], ctx: z.RefinementCtx) {
  const positions = new Set<string>();
  const ids = new Set<string>();
  rows.forEach((row, index) => {
    const key = `${row.category}:${row.sortOrder}`;
    if (positions.has(key)) ctx.addIssue({ code: "custom", path: [index, "sortOrder"], message: "Order must be unique within each category." });
    positions.add(key);
    if (row.id) {
      if (ids.has(row.id)) ctx.addIssue({ code: "custom", path: [index, "id"], message: "Item IDs must be unique." });
      ids.add(row.id);
    }
  });
}
const items = z.array(item).max(100).superRefine(validateItems);
const updateItems = z.array(item.extend({ id: z.uuid().optional() })).max(100).superRefine(validateItems);

export const payslipIdSchema = z.uuid();
export const createPayrollDraftSchema = z.strictObject({
  userId: z.uuid(), year, month, bankName: optionalBankText, accountNumber: optionalBankText, items,
});
// Complete replacement of editable draft fields; recipient/period/snapshots are immutable.
export const updatePayrollDraftSchema = z.strictObject({
  version, bankName: optionalBankText, accountNumber: optionalBankText, items: updateItems,
});
export const deletePayrollDraftSchema = z.strictObject({ version });
export const publishPayrollSchema = z.strictObject({ version });
export const fillPayrollBankSchema = z.strictObject({ version, replaceExisting: z.boolean().default(false) });
export const initializePayrollSchema = z.strictObject({ year, month });
export const listPayrollSchema = z.strictObject({
  year: z.coerce.number().int().min(2000).max(2100).optional(),
  month: z.coerce.number().int().min(1).max(12).optional(),
  status: z.enum(["DRAFT", "PUBLISHED"]).optional(),
  userId: z.uuid().optional(),
  page: z.coerce.number().int().min(1).max(1000000).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
});
export type PayrollItemsInput = z.output<typeof createPayrollDraftSchema>["items"];
export type ListPayrollInput = z.output<typeof listPayrollSchema>;
