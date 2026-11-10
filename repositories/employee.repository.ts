import "server-only";
import { Prisma } from "@/generated/prisma/client";
import { getPrisma } from "@/lib/db/prisma";
import type { DatabaseTransaction } from "@/lib/db/transaction";
import type { EmployeeListInput } from "@/schemas/employee.schema";

const summarySelect = { id: true, fullName: true, jobTitle: true, employeeNumber: true,
  employmentStatus: true, joinDate: true, bankName: true, bankAccountNumber: true, bankAccountHolder: true,
  user: { select: { id: true, email: true } } } satisfies Prisma.EmployeeSelect;
const detailSelect = { ...summarySelect, userId: true, nik: true, phoneNumber: true, address: true,
  npwp: true, placeOfBirth: true, dateOfBirth: true, gender: true, maritalStatus: true,
  employmentType: true, bpjsKesehatanNumber: true, bpjsKetenagakerjaanNumber: true,
  employmentEndDate: true, version: true } satisfies Prisma.EmployeeSelect;
export type EmployeeSummaryRecord = Prisma.EmployeeGetPayload<{ select: typeof summarySelect }>;
export type EmployeeDetailRecord = Prisma.EmployeeGetPayload<{ select: typeof detailSelect }>;
// Narrow banking projection for Payroll; no personal-profile fields leave this lookup.
export async function findEmployeeBankByUserId(userId: string, tx: DatabaseTransaction) {
  const rows = await tx.$queryRaw<{ bankName: string | null; bankAccountNumber: string | null }[]>`
    SELECT bankName, bankAccountNumber FROM employee WHERE userId = ${userId} FOR UPDATE`;
  return rows[0] ?? null;
}
export function listEmployeeRecords({ search, page, pageSize, sort, order }: EmployeeListInput) {
  const columns = { name: Prisma.sql`e.fullName`, position: Prisma.sql`e.jobTitle`, status: Prisma.sql`e.employmentStatus` };
  const direction = order === "desc" ? Prisma.sql`DESC` : Prisma.sql`ASC`;
  const orderBy: Prisma.EmployeeOrderByWithRelationInput[] = [
    sort === "position" ? { jobTitle: order } : sort === "status" ? { employmentStatus: order } : { fullName: order }, { id: "asc" },
  ];
  return getPrisma().$transaction(async tx => {
    // LOCATE follows the existing monitoring search pattern, avoiding adapter LIKE collation issues.
    const where = search ? Prisma.sql`WHERE LOCATE(${search}, e.fullName) > 0
      OR LOCATE(${search}, e.employeeNumber) > 0 OR LOCATE(${search}, u.email) > 0` : Prisma.empty;
    const counts = await tx.$queryRaw<{ total: bigint }[]>(Prisma.sql`
      SELECT COUNT(*) AS total FROM employee e LEFT JOIN user u ON u.id = e.userId ${where}`);
    const total = Number(counts[0].total);
    const currentPage = Math.min(page, Math.max(1, Math.ceil(total / pageSize)));
    const ids = await tx.$queryRaw<{ id: string }[]>(Prisma.sql`
      SELECT e.id FROM employee e LEFT JOIN user u ON u.id = e.userId ${where}
      ORDER BY ${columns[sort]} ${direction}, e.id ASC LIMIT ${pageSize} OFFSET ${(currentPage - 1) * pageSize}`);
    const items = await tx.employee.findMany({ where: { id: { in: ids.map(row => row.id) } },
      select: summarySelect, orderBy });
    return { items, total, page: currentPage, pageSize };
  });
}
export function findEmployeeRecord(id: string, tx?: DatabaseTransaction) {
  return (tx ?? getPrisma()).employee.findUnique({ where: { id }, select: detailSelect });
}
export async function lockEmployeeRecord(id: string, tx: DatabaseTransaction) {
  await tx.$queryRaw`SELECT id FROM employee WHERE id = ${id} FOR UPDATE`;
}
export function findEmployeeByLinkedUser(userId: string, tx: DatabaseTransaction) {
  return tx.employee.findUnique({ where: { userId }, select: { id: true } });
}
export function linkUnassignedEmployee(id: string, userId: string, tx: DatabaseTransaction) {
  return tx.employee.updateMany({ where: { id, userId: null }, data: { userId, version: { increment: 1 } } });
}
export function listUnlinkedEmployeeOptions(search: string) {
  return getPrisma().$queryRaw<{ id: string; label: string }[]>(Prisma.sql`
    SELECT id, CONCAT(fullName, CASE WHEN employeeNumber IS NULL THEN '' ELSE CONCAT(' · ', employeeNumber) END) AS label
    FROM employee WHERE userId IS NULL AND (LOCATE(${search}, fullName) > 0 OR LOCATE(${search}, COALESCE(employeeNumber, '')) > 0)
    ORDER BY fullName, id LIMIT 30`);
}
export function listUnlinkedUserOptions(search: string) {
  return getPrisma().$queryRaw<{ id: string; label: string }[]>(Prisma.sql`
    SELECT u.id, CONCAT(u.name, ' · ', u.email) AS label FROM user u
    WHERE u.role = 'USER' AND NOT EXISTS (SELECT 1 FROM employee e WHERE e.userId = u.id)
    AND (LOCATE(${search}, u.name) > 0 OR LOCATE(${search}, u.email) > 0)
    ORDER BY u.name, u.id LIMIT 30`);
}
export function createEmployeeRecord(data: Prisma.EmployeeCreateInput, tx: DatabaseTransaction) {
  return tx.employee.create({ data, select: detailSelect });
}
export function updateEmployeeRecord(id: string, version: number, data: Prisma.EmployeeUpdateManyMutationInput, tx: DatabaseTransaction) {
  return tx.employee.updateMany({ where: { id, version }, data: { ...data, version: { increment: 1 } } });
}
