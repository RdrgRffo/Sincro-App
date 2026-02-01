import { createAppError } from '../../common/errors/error-catalog';
import { findRoleByName } from '../roles/roles.repository';
import { updateUserRecord } from '../users/users.repository';
import type { TransactionClient } from '../../common/transactions/transaction.utils';

/**
 * Asegura que un usuario tenga un rol específico.
 * Si ya lo tiene, no hace nada.
 * Si no lo tiene, actualiza el rol.
 */
export async function ensureUserRole(
  userId: string,
  roleName: string,
  tx: TransactionClient,
): Promise<void> {
  const user = await tx.user.findUnique({
    where: { id: userId },
    select: { id: true, role: { select: { name: true } } },
  });
  if (!user) throw createAppError('NOT_FOUND', 'Usuario no encontrado');

  const currentRoleName = user.role?.name;
  if (currentRoleName === roleName) return; // ya tiene el rol

  const role = await findRoleByName(roleName);
  if (!role) throw createAppError('NOT_FOUND', `Rol "${roleName}" no encontrado`);

  await updateUserRecord(userId, { roleId: role.id }, tx);
}

/**
 * Hace downgrade de un usuario a 'employee' si ya no es manager de ninguna entidad.
 * @param userId - ID del usuario
 * @param countRemaining - función que devuelve cuántas entidades sigue gestionando
 * @param tx - cliente de transacción
 */
export async function downgradeManagerIfLast(
  userId: string,
  countRemaining: (tx: TransactionClient) => Promise<number>,
  tx: TransactionClient,
): Promise<void> {
  const remaining = await countRemaining(tx);
  if (remaining > 0) return; // sigue siendo manager de otras entidades

  const employeeRole = await findRoleByName('employee');
  if (!employeeRole) throw createAppError('NOT_FOUND', 'Rol "employee" no encontrado');

  await updateUserRecord(userId, { roleId: employeeRole.id }, tx);
}
