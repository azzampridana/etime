import "server-only";

import type { Prisma } from "@/generated/prisma/client";
import { getPrisma } from "@/lib/db/prisma";

export type DatabaseTransaction = Prisma.TransactionClient;

export function inTransaction<T>(operation: (tx: DatabaseTransaction) => Promise<T>) {
  return getPrisma().$transaction(operation);
}
