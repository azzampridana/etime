import { z } from "zod";
export const userPayslipPageSchema = z.coerce.number().int().min(1).max(1000000).default(1);
