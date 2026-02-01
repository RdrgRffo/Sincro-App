import * as repo from './roles.repository';
import { CreateRoleSchema, UpdateRoleSchema } from './roles.http.schemas';
import { z } from 'zod';
import { prisma } from '../../config/database';
import { logAuditOrThrow, sanitizeSnapshot } from '../audit/audit.service';
import { executeInTransaction } from '../../common/transactions/transaction.utils';
import { createAppError } from '../../common/errors/error-catalog';

export async function listRoles() {
  return repo.findRoles();
}

export async function getRole(id: string) {
  const role = await repo.findRoleById(id);
  if (!role) throw createAppError('NOT_FOUND', 'Role no encontrado');
  return role;
}

export async function createRole(payload: z.infer<typeof CreateRoleSchema>) {
  const data = CreateRoleSchema.parse(payload);
  return executeInTransaction(async (tx) => {
    const role = await repo.createRole(data);
    await logAuditOrThrow({
      userId: 'system',
      action: 'CREATE_ROLE',
      entityType: 'Role',
      entityId: role.id,
      detailsJson: { before: null, after: sanitizeSnapshot(role) },
    }, tx);
    return role;
  });
}

export async function updateRole(id: string, payload: z.infer<typeof UpdateRoleSchema>) {
  const data = UpdateRoleSchema.parse(payload);
  const role = await repo.findRoleById(id);
  if (!role) throw createAppError('NOT_FOUND', 'Role no encontrado');
  if (role.isSystem && data.name && data.name !== role.name) {
     throw createAppError('BAD_REQUEST', 'No se puede cambiar el nombre de un rol de sistema');
  }
  return executeInTransaction(async (tx) => {
    const updated = await repo.updateRole(id, data);
    await logAuditOrThrow({
      userId: 'system',
      action: 'UPDATE_ROLE',
      entityType: 'Role',
      entityId: id,
      detailsJson: { before: sanitizeSnapshot(role), after: sanitizeSnapshot(updated) },
    }, tx);
    return updated;
  });
}

export async function deleteRole(id: string) {
  const role = await repo.findRoleById(id);
  if (!role) throw createAppError('NOT_FOUND', 'Role no encontrado');
  if (role.isSystem) {
    throw createAppError('BAD_REQUEST', 'No se pueden borrar roles de sistema');
  }

  // Verificar si hay usuarios asignados a este rol
  const userCount = await prisma.user.count({ where: { roleId: id } });
  if (userCount > 0) {
    throw createAppError(
      'BAD_REQUEST',
      `No se puede eliminar el rol: ${userCount} usuario(s) están asignados a este rol. Reasigna los usuarios a otro rol primero.`,
      { linkedUsers: userCount },
    );
  }

  return executeInTransaction(async (tx) => {
    await repo.deleteRole(id);
    await logAuditOrThrow({
      userId: 'system',
      action: 'DELETE_ROLE',
      entityType: 'Role',
      entityId: id,
      detailsJson: { before: sanitizeSnapshot(role), after: null },
    }, tx);
  });
}


export async function listPermissions() {
  return repo.getPermissions();
}
