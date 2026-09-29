import "server-only";

import { hashPassword } from "@/lib/auth/password";
import { isUniqueConstraintError } from "@/lib/db/persistence-error";
import { inTransaction, type DatabaseTransaction } from "@/lib/db/transaction";
import { ApplicationError } from "@/lib/errors/application-error";
import { toUserDto } from "@/mappers/user.mapper";
import { createAuditRecord } from "@/repositories/audit.repository";
import { assertAdmin } from "@/lib/authorization/policy";
import { lockAttendanceUser } from "@/repositories/attendance.repository";
import { createUserRecord, deleteUserRecord, findUserDeletionDependencies, findUserByEmail, findUserById, listUserRecords, setUserActiveStatusRecord, updateUserRecord } from "@/repositories/user.repository";
import { findWorkScheduleById } from "@/repositories/work-schedule.repository";
import { createUserSchema, listUsersSchema, setUserActiveStatusSchema, updateUserSchema, userIdSchema, type CreateUserInput, type ListUsersInput, type SetUserActiveStatusInput, type UpdateUserInput } from "@/schemas/user.schema";
import type { UserListDto, UserMutationContext } from "@/types/user";

async function requireUser(id: string, tx?: DatabaseTransaction) {
  const user = await findUserById(id, tx);
  if (!user) throw new ApplicationError("USER_NOT_FOUND", "User not found.");
  return user;
}

async function requireUsableSchedule(id: string, tx: DatabaseTransaction) {
  const schedule = await findWorkScheduleById(id, tx);
  if (!schedule) throw new ApplicationError("SCHEDULE_NOT_FOUND", "Work schedule not found.");
  if (!schedule.isActive) throw new ApplicationError("SCHEDULE_INACTIVE", "Work schedule is inactive.");
}

async function requireUniqueEmail(email: string, tx: DatabaseTransaction, excludingId?: string) {
  const existing = await findUserByEmail(email, tx);
  if (existing && existing.id !== excludingId) {
    throw new ApplicationError("EMAIL_EXISTS", "Email is already in use.");
  }
}

async function withEmailConflictHandling<T>(operation: () => Promise<T>): Promise<T> {
  try {
    return await operation();
  } catch (error) {
    if (isUniqueConstraintError(error)) {
      throw new ApplicationError("EMAIL_EXISTS", "Email is already in use.");
    }
    throw error;
  }
}

export async function createUser(raw: CreateUserInput, context: UserMutationContext) {
  const input = createUserSchema.parse(raw);
  const passwordHash = await hashPassword(input.password);
  return withEmailConflictHandling(() => inTransaction(async (tx) => {
    await requireUsableSchedule(input.workScheduleId, tx);
    await requireUniqueEmail(input.email, tx);
    const user = await createUserRecord({
      name: input.name, position: input.position ?? null, email: input.email, role: input.role,
      isActive: input.isActive, workScheduleId: input.workScheduleId, passwordHash,
    }, tx);
    await createAuditRecord({
      actorId: context.actorId, action: "USER_CREATED", entityType: "User", entityId: user.id,
      metadata: { role: user.role, position: user.position, isActive: user.isActive, workScheduleId: user.workScheduleId },
    }, tx);
    return toUserDto(user);
  }));
}

export async function updateUser(raw: UpdateUserInput, context: UserMutationContext) {
  const input = updateUserSchema.parse(raw);
  if (input.id === context.actorId && input.role !== "ADMIN") {
    throw new ApplicationError("SELF_DEMOTION", "You cannot remove your own ADMIN access.");
  }
  const passwordHash = input.password === undefined ? undefined : await hashPassword(input.password);
  return withEmailConflictHandling(() => inTransaction(async (tx) => {
    await requireUser(input.id, tx);
    await requireUsableSchedule(input.workScheduleId, tx);
    await requireUniqueEmail(input.email, tx, input.id);
    const user = await updateUserRecord(input.id, {
      name: input.name, position: input.position, email: input.email, role: input.role,
      workScheduleId: input.workScheduleId,
      ...(passwordHash === undefined ? {} : { passwordHash }),
    }, tx);
    await createAuditRecord({
      actorId: context.actorId, action: "USER_UPDATED", entityType: "User", entityId: user.id,
      metadata: { role: user.role, position: user.position, workScheduleId: user.workScheduleId, passwordChanged: passwordHash !== undefined },
    }, tx);
    return toUserDto(user);
  }));
}

export async function setUserActiveStatus(raw: SetUserActiveStatusInput, context: UserMutationContext) {
  const input = setUserActiveStatusSchema.parse(raw);
  if (input.id === context.actorId && !input.isActive) {
    throw new ApplicationError("SELF_DEACTIVATION", "You cannot deactivate your own account.");
  }
  return inTransaction(async (tx) => {
    const existing = await requireUser(input.id, tx);
    if (existing.isActive === input.isActive) return toUserDto(existing);
    if (input.isActive) await requireUsableSchedule(existing.workScheduleId, tx);
    const user = await setUserActiveStatusRecord(input.id, input.isActive, tx);
    await createAuditRecord({
      actorId: context.actorId, action: input.isActive ? "USER_ACTIVATED" : "USER_DEACTIVATED",
      entityType: "User", entityId: user.id, metadata: { isActive: user.isActive },
    }, tx);
    return toUserDto(user);
  });
}

export async function getUserById(id: string) {
  return toUserDto(await requireUser(userIdSchema.parse(id)));
}

export async function deleteUser(rawId: string, context: UserMutationContext) {
  const id = userIdSchema.parse(rawId);
  if (!context.actorId) throw new ApplicationError("FORBIDDEN", "An authenticated administrator is required.");
  if (id === context.actorId) throw new ApplicationError("SELF_DELETE", "You cannot delete your own account.");
  const actorId = context.actorId;
  return inTransaction(async (tx) => {
    // Reuse the same user-row lock as attendance/grant mutations before reading dependencies.
    for (const userId of [id, actorId].sort()) await lockAttendanceUser(userId, tx);
    const actor = await requireUser(actorId, tx);
    assertAdmin(actor.isActive ? actor : null);
    const user = await requireUser(id, tx);
    const dependencies = await findUserDeletionDependencies(id, tx);
    // Attendance protects its DailyReport, authorization and overtime descendants too.
    // Issued grants retain a required, restricted grantedById reference, even if unused.
    if (dependencies.attendance || dependencies.grant) {
      throw new ApplicationError("USER_HAS_HISTORY", "This user cannot be deleted because operational history already exists. Deactivate the account instead.");
    }
    // Administrative audits are not blockers: existing actor FKs use SetNull on deletion.
    // Audit rows and generic entityType/entityId subject references remain historical evidence.
    await deleteUserRecord(id, tx);
    await createAuditRecord({
      actorId, action: "USER_DELETED", entityType: "User", entityId: id,
      metadata: { name: user.name, email: user.email, role: user.role, isActive: user.isActive },
    }, tx);
    return { id };
  });
}

export async function listUsers(raw: ListUsersInput): Promise<UserListDto> {
  const input = listUsersSchema.parse(raw);
  const { items, total } = await listUserRecords(input);
  return { items: items.map(toUserDto), total, page: input.page, pageSize: input.pageSize };
}
