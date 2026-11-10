import "server-only";
import { requireAdmin } from "@/lib/authorization/require-user";
import { inTransaction } from "@/lib/db/transaction";
import { ApplicationError } from "@/lib/errors/application-error";
import { employeeIdSchema } from "@/schemas/employee.schema";
import { createContactSchema, updateContactSchema, deleteContactSchema, contactPageSchema } from "@/schemas/employee-contact.schema";
import { lockEmployeeAdminActor } from "@/services/employee.service";
import { findEmployeeRecord, lockEmployeeRecord, updateEmployeeRecord } from "@/repositories/employee.repository";
import { listContactRecords, countContactRecords, findContactRecord, clearContactPrimary, createContactRecord, updateContactRecord, deleteContactRecord } from "@/repositories/employee-contact.repository";
import { createAuditRecord } from "@/repositories/audit.repository";
const conflict = () => new ApplicationError("EMPLOYEE_CONFLICT", "Profile or contacts changed. Reload before trying again.");

export async function listEmployeeContacts(rawId: unknown, rawPage: unknown) {
  await requireAdmin(); const id = employeeIdSchema.parse(rawId), page = contactPageSchema.parse(rawPage);
  return inTransaction(async tx => {
    const employee = await findEmployeeRecord(id, tx);
    if (!employee) throw new ApplicationError("EMPLOYEE_NOT_FOUND", "Employee not found.");
    return { items: await listContactRecords(id, page, tx), total: await countContactRecords(id, tx),
      page, pageSize: 20, employeeVersion: employee.version };
  });
}
export async function mutateEmployeeContact(rawId: unknown, rawContactId: unknown, raw: unknown, operation: "create" | "update" | "delete") {
  const actor = await requireAdmin(), employeeId = employeeIdSchema.parse(rawId);
  const contactId = operation === "create" ? undefined : employeeIdSchema.parse(rawContactId);
  const input = operation === "create" ? createContactSchema.parse(raw) : operation === "update" ? updateContactSchema.parse(raw) : deleteContactSchema.parse(raw);
  return inTransaction(async tx => {
    await lockEmployeeAdminActor(actor.id, tx);
    // Every contact writer locks the same parent, including primary demotions.
    await lockEmployeeRecord(employeeId, tx);
    const employee = await findEmployeeRecord(employeeId, tx);
    if (!employee) {
      // Temporary E4.6 diagnostic for PUT only; never log record identifiers.
      if (process.env.NODE_ENV === "development" && operation === "update") console.info("[EmployeeContact] EMPLOYEE_NOT_FOUND");
      throw new ApplicationError("EMPLOYEE_NOT_FOUND", "Employee not found.");
    }
    if (employee.version !== input.employeeVersion) throw conflict();
    const before = contactId ? await findContactRecord(employeeId, contactId, tx) : null;
    if (contactId && !before) {
      if (process.env.NODE_ENV === "development" && operation === "update") console.info("[EmployeeContact] CONTACT_NOT_FOUND");
      throw new ApplicationError("EMPLOYEE_NOT_FOUND", "Contact not found for this Employee.");
    }
    if (before && (!("version" in input) || before.version !== input.version)) throw conflict();
    let entityId = contactId;
    let fields: string[] = [];
    let demoted = 0;
    if (operation === "delete") {
      if (!contactId || !("version" in input)) throw conflict();
      if ((await deleteContactRecord(employeeId, contactId, input.version, tx)).count !== 1) throw conflict();
    } else {
      if (!("name" in input)) throw conflict();
      // Turning Emergency off takes priority over a stale isPrimary=true input.
      const data = { name: input.name, relationship: input.relationship, phoneNumber: input.phoneNumber,
        address: input.address, isEmergencyContact: input.isEmergencyContact, isPrimary: input.isEmergencyContact && input.isPrimary };
      fields = (Object.keys(data) as (keyof typeof data)[]).filter(key => !before || data[key] !== before[key]);
      if (data.isPrimary) demoted = (await clearContactPrimary(employeeId, contactId, tx)).count;
      if (contactId && "version" in input) {
        if (typeof input.version !== "number") throw conflict();
        if ((await updateContactRecord(employeeId, contactId, input.version, data, tx)).count !== 1) throw conflict();
      } else entityId = (await createContactRecord({ ...data, employeeId }, tx)).id;
    }
    if ((await updateEmployeeRecord(employeeId, input.employeeVersion, {}, tx)).count !== 1) throw conflict();
    await createAuditRecord({ actorId: actor.id, action: `EMPLOYEE_CONTACT_${operation === "create" ? "CREATED" : operation === "update" ? "UPDATED" : "DELETED"}`,
      entityType: "EmployeeFamilyContact", entityId: entityId ?? employeeId,
      metadata: { employeeId, fields, demotedPrimaryCount: demoted, employeeVersion: input.employeeVersion + 1 } }, tx);
    return { id: entityId, employeeVersion: input.employeeVersion + 1 };
  });
}
