import { Response } from 'express';
import { sendError, sendPaginated, sendSuccess } from '../../utils/response';
import { AuthRequest } from '../../middleware/auth.middleware';
import { isAppError } from '../../common/errors/app-error';
import {
  changeUserRole,
  changeUserStatus,
  createUser,
  deleteUser,
  getUserById,
  getUserSchedules,
  getUsersList,
  reactivateUser,
  resetUserPassword,
  forceUserPasswordChange,
  updateUser,
  importUsersCsv,
} from './users.service';
import { decodeCsvBuffer, parseUserCsv } from '../../utils/csv';
import {
  changeRoleBodySchema,
  changeStatusBodySchema,
  createUserBodySchema,
  listUsersQuerySchema,
  resetPasswordBodySchema,
  updateUserBodySchema,
  userIdParamsSchema,
  userSchedulesQuerySchema,
} from './users.http.schemas';

/**
 * @description Orquesta la consulta paginada de usuarios validando la sintaxis del query antes de contactar al servicio.
 * @param req @param res
 */
export async function listUsersController(req: AuthRequest, res: Response) {
  const parsedQuery = listUsersQuerySchema.safeParse(req.query);
  if (!parsedQuery.success) return sendError(res, 'Parámetros inválidos', 400, parsedQuery.error.flatten(), 'BAD_REQUEST');

  try {
    const { users, total } = await getUsersList(parsedQuery.data, { id: req.user!.id, ipAddress: req.ip });
    return sendPaginated(res, users, total, parsedQuery.data.page, parsedQuery.data.limit);
  } catch (error: unknown) {
    if (isAppError(error)) return sendError(res, error.message, error.statusCode, error.details, error.code);
    throw error;
  }
}

/**
 * @description Reactiva un usuario inactivo, restaurando su estado a activo.
 * @param req @param res
 */
export async function reactivateUserController(req: AuthRequest, res: Response) {
  const parsedParams = userIdParamsSchema.safeParse(req.params);
  if (!parsedParams.success) return sendError(res, 'Parámetros inválidos', 400, parsedParams.error.flatten(), 'BAD_REQUEST');

  try {
    const updated = await reactivateUser(parsedParams.data.id, { id: req.user!.id, ipAddress: req.ip });
    return sendSuccess(res, updated, 'Usuario reactivado');
  } catch (error: unknown) {
    if (isAppError(error)) return sendError(res, error.message, error.statusCode, error.details, error.code);
    throw error;
  }
}

/**
 * @description Responde con detalles específicos del usuario encapsulando y lanzando errores operacionales si ocurren.
 * @param req @param res
 */
export async function getUserController(req: AuthRequest, res: Response) {
  const parsedParams = userIdParamsSchema.safeParse(req.params);
  if (!parsedParams.success) return sendError(res, 'Parámetros inválidos', 400, parsedParams.error.flatten(), 'BAD_REQUEST');

  try {
    const actor = {
      id: req.user!.id,
      roleName: req.user!.roleName,
      branchId: req.user!.branchId,
      visibleBranchIds: req.user!.visibleBranchIds ?? [],
    };
    const user = await getUserById(parsedParams.data.id, actor);
    return sendSuccess(res, user);
  } catch (error: unknown) {
    if (isAppError(error)) return sendError(res, error.message, error.statusCode, error.details, error.code);
    throw error;
  }
}

/**
 * @description Valida el pipeline HTTP de creación de usuario e inyecta la autoría (actor) pasándola al core de negocio.
 * @param req @param res
 */
export async function createUserController(req: AuthRequest, res: Response) {
  const parsedBody = createUserBodySchema.safeParse(req.body);
  if (!parsedBody.success) return sendError(res, 'Datos inválidos', 400, parsedBody.error.flatten(), 'BAD_REQUEST');

  try {
    // Forzar siempre forcePasswordChange: true
    const user = await createUser({ ...parsedBody.data, forcePasswordChange: true }, { id: req.user!.id, ipAddress: req.ip });
    return sendSuccess(res, user, 'Usuario creado', 201);
  } catch (error: unknown) {
    if (isAppError(error)) return sendError(res, error.message, error.statusCode, error.details, error.code);
    throw error;
  }
}

/**
 * @description Centraliza la carga intercediendo el buffer, decodificando y llamando al servicio transaccional.
 */
export async function importUsersCsvController(req: AuthRequest, res: Response) {
  if (!req.file) return sendError(res, 'No se proporcionó ningún archivo CSV', 400);

  try {
    const csvContent = decodeCsvBuffer(req.file.buffer);
    const rows = parseUserCsv(csvContent);
    const result = await importUsersCsv(rows, { id: req.user!.id, ipAddress: req.ip });
    return sendSuccess(res, result, 'Importación completada');
  } catch (error: unknown) {
    if (isAppError(error)) return sendError(res, error.message, error.statusCode, error.details, error.code);
    throw error;
  }
}

/**
 * @description Verifica mutaciones parciales de perfil devolviendo formato unificado y gestionando bloqueos de identidad.
 * @param req @param res
 */
export async function updateUserController(req: AuthRequest, res: Response) {
  const parsedParams = userIdParamsSchema.safeParse(req.params);
  if (!parsedParams.success) return sendError(res, 'Parámetros inválidos', 400, parsedParams.error.flatten(), 'BAD_REQUEST');

  const parsedBody = updateUserBodySchema.safeParse(req.body);
  if (!parsedBody.success) return sendError(res, 'Datos inválidos', 400, parsedBody.error.flatten(), 'BAD_REQUEST');

  try {
    const updated = await updateUser(parsedParams.data.id, parsedBody.data, { id: req.user!.id, ipAddress: req.ip });
    return sendSuccess(res, updated, 'Usuario actualizado');
  } catch (error: unknown) {
    if (isAppError(error)) return sendError(res, error.message, error.statusCode, error.details, error.code);
    throw error;
  }
}

/**
 * @description Enruta solicitudes administrativas para bloquear/desbloquear o habilitar acceso de usuarios en el sistema.
 * @param req @param res
 */
export async function changeUserStatusController(req: AuthRequest, res: Response) {
  const parsedParams = userIdParamsSchema.safeParse(req.params);
  if (!parsedParams.success) return sendError(res, 'Parámetros inválidos', 400, parsedParams.error.flatten(), 'BAD_REQUEST');

  const parsedBody = changeStatusBodySchema.safeParse(req.body);
  if (!parsedBody.success) return sendError(res, 'Estado inválido', 400, parsedBody.error.flatten(), 'BAD_REQUEST');

  try {
    await changeUserStatus(parsedParams.data.id, parsedBody.data.status, { id: req.user!.id, ipAddress: req.ip });
    return sendSuccess(res, null, `Estado actualizado a ${parsedBody.data.status}`);
  } catch (error: unknown) {
    if (isAppError(error)) return sendError(res, error.message, error.statusCode, error.details, error.code);
    throw error;
  }
}

/**
 * @description Actualiza la jerarquía de roles validando los parámetros frente a la estructura Zod definida.
 * @param req @param res
 */
export async function changeUserRoleController(req: AuthRequest, res: Response) {
  const parsedParams = userIdParamsSchema.safeParse(req.params);
  if (!parsedParams.success) return sendError(res, 'Parámetros inválidos', 400, parsedParams.error.flatten(), 'BAD_REQUEST');

  const parsedBody = changeRoleBodySchema.safeParse(req.body);
  if (!parsedBody.success) return sendError(res, 'Rol inválido', 400, parsedBody.error.flatten(), 'BAD_REQUEST');

  try {
    await changeUserRole(parsedParams.data.id, parsedBody.data, { id: req.user!.id, ipAddress: req.ip });
    return sendSuccess(res, null, 'Rol actualizado');
  } catch (error: unknown) {
    if (isAppError(error)) return sendError(res, error.message, error.statusCode, error.details, error.code);
    throw error;
  }
}

/**
 * @description Controla el restablecimiento forzoso de claves en cuentas administradas interceptando aserciones de falla.
 * @param req @param res
 */
export async function resetPasswordController(req: AuthRequest, res: Response) {
  const parsedParams = userIdParamsSchema.safeParse(req.params);
  if (!parsedParams.success) return sendError(res, 'Parámetros inválidos', 400, parsedParams.error.flatten(), 'BAD_REQUEST');

  const parsedBody = resetPasswordBodySchema.safeParse(req.body);
  if (!parsedBody.success) return sendError(res, 'La contraseña debe tener al menos 8 caracteres', 400, parsedBody.error.flatten(), 'BAD_REQUEST');

  try {
    await resetUserPassword(parsedParams.data.id, parsedBody.data.newPassword, { id: req.user!.id, ipAddress: req.ip });
    return sendSuccess(res, null, 'Contraseña restablecida. El usuario deberá cambiarla en el próximo inicio de sesión');
  } catch (error: unknown) {
    if (isAppError(error)) return sendError(res, error.message, error.statusCode, error.details, error.code);
    throw error;
  }
}

/**
 * @description Fuerza al usuario a pasar por el flujo obligatorio de cambio de contraseña en su siguiente uso.
 * @param req @param res
 */
export async function forcePasswordChangeController(req: AuthRequest, res: Response) {
  const parsedParams = userIdParamsSchema.safeParse(req.params);
  if (!parsedParams.success) return sendError(res, 'Parámetros inválidos', 400, parsedParams.error.flatten(), 'BAD_REQUEST');

  try {
    await forceUserPasswordChange(parsedParams.data.id, { id: req.user!.id, ipAddress: req.ip });
    return sendSuccess(res, null, 'Cambio de contraseña forzado');
  } catch (error: unknown) {
    if (isAppError(error)) return sendError(res, error.message, error.statusCode, error.details, error.code);
    throw error;
  }
}

/**
 * @description Traduce la petición HTTP DELETE en una eliminación temporal lógica (soft-delete) delegando permisos.
 * @param req @param res
 */
export async function deleteUserController(req: AuthRequest, res: Response) {
  const parsedParams = userIdParamsSchema.safeParse(req.params);
  if (!parsedParams.success) return sendError(res, 'Parámetros inválidos', 400, parsedParams.error.flatten(), 'BAD_REQUEST');

  try {
    await deleteUser(parsedParams.data.id, { id: req.user!.id, ipAddress: req.ip });
    return sendSuccess(res, null, 'Usuario eliminado');
  } catch (error: unknown) {
    if (isAppError(error)) return sendError(res, error.message, error.statusCode, error.details, error.code);
    throw error;
  }
}

/**
 * @description Despacha por HTTP informes cronológicos de turnos del individuo parseando fechas `from/to` seguras.
 * @param req @param res
 */
export async function listUserSchedulesController(req: AuthRequest, res: Response) {
  const parsedParams = userIdParamsSchema.safeParse(req.params);
  if (!parsedParams.success) return sendError(res, 'Parámetros inválidos', 400, parsedParams.error.flatten(), 'BAD_REQUEST');

  const parsedQuery = userSchedulesQuerySchema.safeParse(req.query);
  if (!parsedQuery.success) return sendError(res, 'Parámetros inválidos', 400, parsedQuery.error.flatten(), 'BAD_REQUEST');

  try {
    const schedules = await getUserSchedules(
      parsedParams.data.id,
      {
        id: req.user!.id,
        roleName: req.user!.roleName,
        branchId: req.user!.branchId,
        visibleBranchIds: req.user!.visibleBranchIds,
      },
      parsedQuery.data.from,
      parsedQuery.data.to,
    );
    return sendSuccess(res, schedules);
  } catch (error: unknown) {
    if (isAppError(error)) return sendError(res, error.message, error.statusCode, error.details, error.code);
    throw error;
  }
}
