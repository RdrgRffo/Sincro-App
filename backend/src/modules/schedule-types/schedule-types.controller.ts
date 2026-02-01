import type { Request, Response } from 'express';
import { sendError, sendSuccess } from '../../utils/response';
import type { AuthRequest } from '../../middleware/auth.middleware';
import { isAppError } from '../../common/errors/app-error';
import {
  getScheduleTypes,
  getScheduleTypeById,
  createScheduleType,
  updateScheduleType,
  deleteScheduleType,
  reactivateScheduleType,
} from './schedule-types.service';
import {
  createScheduleTypeSchema,
  updateScheduleTypeSchema,
} from './schedule-types.http.schemas';

function sendScheduleTypeError(res: Response, error: unknown) {
  if (isAppError(error)) {
    return sendError(res, error.message, error.statusCode, error.details, error.code);
  }

  return sendError(res, 'Error al crear tipo de turno', 500, undefined, 'INTERNAL_ERROR');
}

export async function listScheduleTypes(_req: Request, res: Response) {
  try {
    const includeInactive = String(_req.query.includeInactive ?? '').toLowerCase() === 'true'
      || _req.query.includeInactive === '1';
    const scheduleTypes = await getScheduleTypes({ includeInactive });
    return sendSuccess(res, scheduleTypes);
  } catch (error: unknown) {
    return sendScheduleTypeError(res, error);
  }
}

export async function getScheduleType(_req: Request, res: Response) {
  try {
    const scheduleType = await getScheduleTypeById(_req.params.id as string);
    return sendSuccess(res, scheduleType);
  } catch (error: unknown) {
    return sendScheduleTypeError(res, error);
  }
}

export async function createScheduleTypeController(req: AuthRequest, res: Response) {
  const parsed = createScheduleTypeSchema.safeParse(req.body);
  if (!parsed.success) {
    return sendError(res, 'Datos inválidos', 400, parsed.error.flatten(), 'BAD_REQUEST');
  }

  try {
    const scheduleType = await createScheduleType(parsed.data, { id: req.user!.id, ipAddress: req.ip });
    return sendSuccess(res, scheduleType, 'Tipo de turno creado', 201);
  } catch (error: unknown) {
    return sendScheduleTypeError(res, error);
  }
}

export async function updateScheduleTypeController(req: AuthRequest, res: Response) {
  const parsed = updateScheduleTypeSchema.safeParse(req.body);
  if (!parsed.success) {
    return sendError(res, 'Datos inválidos', 400, parsed.error.flatten(), 'BAD_REQUEST');
  }

  try {
    const scheduleType = await updateScheduleType(req.params.id as string, parsed.data, { id: req.user!.id, ipAddress: req.ip });
    return sendSuccess(res, scheduleType);
  } catch (error: unknown) {
    return sendScheduleTypeError(res, error);
  }
}

export async function deleteScheduleTypeController(req: AuthRequest, res: Response) {
  try {
    await deleteScheduleType(req.params.id as string, { id: req.user!.id, ipAddress: req.ip });
    return sendSuccess(res, null, 'Tipo de turno eliminado');
  } catch (error: unknown) {
    return sendScheduleTypeError(res, error);
  }
}

export async function reactivateScheduleTypeController(req: AuthRequest, res: Response) {
  try {
    const scheduleType = await reactivateScheduleType(req.params.id as string, { id: req.user!.id, ipAddress: req.ip });
    return sendSuccess(res, scheduleType, 'Tipo de turno reactivado');
  } catch (error: unknown) {
    return sendScheduleTypeError(res, error);
  }
}
