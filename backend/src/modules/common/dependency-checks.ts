import { createAppError } from '../../common/errors/error-catalog';

/**
 * Verifica que un conteo de dependencias sea cero.
 * Si hay dependencias activas, lanza CONFLICT con un mensaje descriptivo.
 */
export async function assertNoDependencies(
  countPromise: Promise<number>,
  entityName: string,
  dependencyName: string,
): Promise<void> {
  const count = await countPromise;
  if (count > 0) {
    throw createAppError(
      'CONFLICT',
      `No se puede eliminar ${entityName}: tiene ${count} ${dependencyName} asociado(s)`,
    );
  }
}

