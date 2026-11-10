import "server-only";
import type { Prisma } from "@/generated/prisma/client";
import type { DatabaseTransaction } from "@/lib/db/transaction";
const select = { id: true, name: true, relationship: true, phoneNumber: true, address: true,
  isEmergencyContact: true, isPrimary: true, version: true } satisfies Prisma.EmployeeFamilyContactSelect;
export function listContactRecords(employeeId: string, page: number, tx: DatabaseTransaction) {
  return tx.employeeFamilyContact.findMany({ where: { employeeId }, select, take: 20, skip: (page - 1) * 20,
    orderBy: [{ isPrimary: "desc" }, { createdAt: "asc" }, { id: "asc" }] });
}
export function countContactRecords(employeeId: string, tx: DatabaseTransaction) { return tx.employeeFamilyContact.count({ where: { employeeId } }); }
export function findContactRecord(employeeId: string, id: string, tx: DatabaseTransaction) {
  return tx.employeeFamilyContact.findFirst({ where: { id, employeeId }, select });
}
export function clearContactPrimary(employeeId: string, exceptId: string | undefined, tx: DatabaseTransaction) {
  return tx.employeeFamilyContact.updateMany({ where: { employeeId, isPrimary: true, ...(exceptId ? { id: { not: exceptId } } : {}) },
    data: { isPrimary: false, version: { increment: 1 } } });
}
export function createContactRecord(data: Prisma.EmployeeFamilyContactUncheckedCreateInput, tx: DatabaseTransaction) {
  return tx.employeeFamilyContact.create({ data, select });
}
export function updateContactRecord(employeeId: string, id: string, version: number, data: Prisma.EmployeeFamilyContactUpdateManyMutationInput, tx: DatabaseTransaction) {
  return tx.employeeFamilyContact.updateMany({ where: { employeeId, id, version }, data: { ...data, version: { increment: 1 } } });
}
export function deleteContactRecord(employeeId: string, id: string, version: number, tx: DatabaseTransaction) {
  return tx.employeeFamilyContact.deleteMany({ where: { employeeId, id, version } });
}
