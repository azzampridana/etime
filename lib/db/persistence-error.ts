import "server-only";

import { Prisma } from "@/generated/prisma/client";
import { z } from "zod";

export function isUniqueConstraintError(error: unknown): boolean {
  return error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002";
}

const adapterUniqueError = z.object({ cause: z.object({ kind: z.literal("UniqueConstraintViolation"),
  constraint: z.object({ index: z.string().optional(), fields: z.array(z.string()).optional() }) }) });

/** Unknown adapter metadata deliberately remains an unclassified persistence error. */
export function isUniqueConstraintOn(error: unknown, constraint: string, fields: readonly string[]): boolean {
  if (!(error instanceof Prisma.PrismaClientKnownRequestError) || error.code !== "P2002") return false;
  const matches = (value: unknown) => typeof value === "string"
    ? value === constraint || value.endsWith(`.${constraint}`)
    : Array.isArray(value) && value.length === fields.length && fields.every(field => value.includes(field));
  const target = error.meta?.target;
  if (matches(target)) return true;
  // Prisma 7's MariaDB adapter exposes the parsed index under this nested cause.
  const adapter = adapterUniqueError.safeParse(error.meta?.driverAdapterError);
  return adapter.success && (matches(adapter.data.cause.constraint.index) || matches(adapter.data.cause.constraint.fields));
}
