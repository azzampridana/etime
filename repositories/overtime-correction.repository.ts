import "server-only";
import type { Prisma } from "@/generated/prisma/client";
import { getPrisma } from "@/lib/db/prisma";
import type { DatabaseTransaction } from "@/lib/db/transaction";

export function findOwnOvertimeCorrectionTarget(userId: string, id: string, tx?: DatabaseTransaction) {
  return (tx ?? getPrisma()).overtime.findFirst({ where: { id, authorization: { attendance: { userId } } },
    include: { authorization: { select: { id: true, attendanceId: true, grantedAt: true, revokedAt: true,
      attendance: { select: { userId: true, workDate: true } } } } } });
}
export async function lockOvertimeCorrectionTarget(id: string, tx: DatabaseTransaction) {
  await tx.$queryRaw`SELECT id FROM overtime WHERE id = ${id} FOR UPDATE`;
}
export function findBlockingOvertimeCorrection(overtimeId: string, tx?: DatabaseTransaction) {
  return (tx ?? getPrisma()).overtimeCorrectionRequest.findFirst({
    where: { overtimeId, OR: [{ status: { in: ["PENDING", "APPROVED"] } }, { pendingSlot: 1 }] },
    select: { id: true, status: true }, orderBy: [{ createdAt: "desc" }, { id: "desc" }],
  });
}
export function createOvertimeCorrection(data: Prisma.OvertimeCorrectionRequestUncheckedCreateInput, tx: DatabaseTransaction) {
  return tx.overtimeCorrectionRequest.create({ data, select: { id: true } });
}
const summarySelect = { id: true, overtimeId: true, status: true, createdAt: true, proposedCheckOutAt: true } satisfies Prisma.OvertimeCorrectionRequestSelect;
export async function listOwnOvertimeCorrections(userId: string, page: number, pageSize: number) {
  const db = getPrisma();
  const [items, total] = await db.$transaction([
    db.overtimeCorrectionRequest.findMany({ where: { userId }, select: summarySelect,
      orderBy: [{ createdAt: "desc" }, { id: "desc" }], skip: (page - 1) * pageSize, take: pageSize }),
    db.overtimeCorrectionRequest.count({ where: { userId } }),
  ]);
  return { items, total };
}
export function findOwnOvertimeCorrection(userId: string, id: string) {
  return getPrisma().overtimeCorrectionRequest.findFirst({ where: { id, userId }, select: {
    ...summarySelect, reason: true, originalOvertimeSnapshot: true, reviewedAt: true, reviewNote: true,
    reviewedBy: { select: { name: true } },
  } });
}

export function findOvertimeCorrectionRouting(id: string) {
  return getPrisma().overtimeCorrectionRequest.findUnique({ where: { id }, select: {
    userId: true, overtimeId: true, overtime: { select: { authorization: { select: { attendanceId: true } } } },
  } });
}
export async function lockOvertimeCorrectionRequest(id: string, tx: DatabaseTransaction) {
  await tx.$queryRaw`SELECT id FROM overtimecorrectionrequest WHERE id = ${id} FOR UPDATE`;
}
export function findOvertimeCorrectionForDecision(id: string, tx: DatabaseTransaction) {
  return tx.overtimeCorrectionRequest.findUnique({ where: { id } });
}
export function findOvertimeCorrectionParent(id: string, tx: DatabaseTransaction) {
  return tx.attendance.findUnique({ where: { id }, select: { id: true, userId: true, checkInAt: true, checkOutAt: true } });
}
export function findOvertimeCorrectionOverlap(userId: string, start: Date, end: Date, excludeId: string, tx: DatabaseTransaction) {
  return tx.overtime.findFirst({ where: { id: { not: excludeId }, authorization: { attendance: { userId } },
    checkInAt: { lt: end }, OR: [{ checkOutAt: null }, { checkOutAt: { gt: start } }] }, select: { id: true, checkOutAt: true } });
}
export function applyOvertimeCorrectionCheckout(target: { id: string; updatedAt: Date }, requestId: string, at: Date, tx: DatabaseTransaction) {
  return tx.overtime.updateMany({ where: { ...target, checkOutAt: null, checkOutSource: null, checkOutCorrectionRequestId: null,
    checkOutLatitude: null, checkOutLongitude: null, checkOutAccuracy: null, checkOutTimezone: null,
    checkOutAddress: null, checkOutDescription: null, checkOutPhotoPath: null },
    data: { checkOutAt: at, checkOutSource: "ADMIN_CORRECTION", checkOutCorrectionRequestId: requestId } });
}
export function finalizeOvertimeCorrection(id: string, expectedVersion: Date, data: {
  status: "APPROVED" | "REJECTED"; reviewedById: string; reviewedAt: Date; reviewNote: string | null;
}, tx: DatabaseTransaction) {
  return tx.overtimeCorrectionRequest.updateMany({ where: { id, updatedAt: expectedVersion, status: "PENDING", pendingSlot: 1 },
    data: { ...data, pendingSlot: null, updatedAt: data.reviewedAt } });
}
const adminSelect = { ...summarySelect, updatedAt: true, pendingSlot: true, reason: true, reviewedAt: true, reviewNote: true,
  user: { select: { id: true, name: true, position: true, isActive: true } },
  reviewedBy: { select: { name: true } },
} satisfies Prisma.OvertimeCorrectionRequestSelect;
export async function listAdminOvertimeCorrections(status: "PENDING" | "APPROVED" | "REJECTED", page: number, pageSize: number) {
  const db = getPrisma();
  const [items, total] = await db.$transaction([
    db.overtimeCorrectionRequest.findMany({ where: { status }, select: adminSelect, orderBy: [{ createdAt: "desc" }, { id: "desc" }], skip: (page - 1) * pageSize, take: pageSize }),
    db.overtimeCorrectionRequest.count({ where: { status } }),
  ]);
  return { items, total };
}
export function findAdminOvertimeCorrection(id: string) {
  return getPrisma().overtimeCorrectionRequest.findUnique({ where: { id }, select: { ...adminSelect, originalOvertimeSnapshot: true,
    overtime: { select: { checkOutAt: true, checkOutSource: true, checkOutCorrectionRequestId: true } },
  } });
}
