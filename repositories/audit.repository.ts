import "server-only";

import type { Prisma } from "@/generated/prisma/client";
import type { DatabaseTransaction } from "@/lib/db/transaction";

type AuditInput = {
  actorId: string | null;
  action: string;
  entityType: string;
  entityId: string;
  metadata?: Prisma.InputJsonObject;
};

export function createAuditRecord(data: AuditInput, tx: DatabaseTransaction) {
  return tx.auditLog.create({ data });
}
