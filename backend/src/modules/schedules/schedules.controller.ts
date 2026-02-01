import { Response } from 'express';
import { sendError, sendSuccess } from '../../utils/response';
import { AuthRequest } from '../../middleware/auth.middleware';
import { isAppError } from '../../common/errors/app-error';
import { prisma } from '../../config/database';
import {
  createScheduleEntry,
  createScheduleEntriesBulk,
  deleteScheduleEntry,
  getScheduleAlerts,
  getScheduleByIdForActor,
  listSchedulesForActor,
  listWeekSchedulesForActor,
  updateScheduleEntry,
} from './schedules.service';
import { getWeeklySummary, getWeeklySummaries, getTeamWeeklySummaries, countTeamWeeklySummaries, recalculateWeeklySummary } from './weekly-summary.service';
import {
  createScheduleBodySchema,
  createScheduleBulkBodySchema,
  deleteScheduleBodySchema,
  listSchedulesQuerySchema,
  listWeekSchedulesQuerySchema,
  scheduleIdParamsSchema,
  teamWeeklySummaryParamsSchema,
  teamWeeklySummaryQuerySchema,
  updateScheduleBodySchema,
  weekParamsSchema,
  weeklySummaryParamsSchema,
  weeklySummaryQuerySchema,
} from './schedules.http.schemas';

/**
 * @description Despacha un catálogo de guardias sujeto a una fecha de inicio, fin o usuario particular extraídos del query string.
 * @param req @param res
 */
export async function listSchedulesController(req: AuthRequest, res: Response) {
  const parsed = listSchedulesQuerySchema.safeParse(req.query);
  if (!parsed.success) {
    return sendError(res, 'Parámetros inválidos', 400, parsed.error.flatten(), 'BAD_REQUEST');
  }

  try {
    const schedules = await listSchedulesForActor(parsed.data, {
      id: req.user!.id,
      roleName: req.user!.roleName!,
      branchId: req.user!.branchId,
      visibleBranchIds: req.user!.visibleBranchIds,
    });
    return sendSuccess(res, schedules);
  } catch (error: unknown) {
    if (isAppError(error)) return sendError(res, error.message, error.statusCode, error.details, error.code);
    throw error;
  }
}

/**
 * @description Responde con una matriz estática representativa de la semana ISO (lunes-domingo) ideal de cara al frontend dashboard.
 * @param req @param res
 */
export async function listWeekSchedulesController(req: AuthRequest, res: Response) {
  const parsed = weekParamsSchema.safeParse(req.params);
  if (!parsed.success) {
    return sendError(res, 'Parámetros de semana inválidos', 400, parsed.error.flatten(), 'BAD_REQUEST');
  }

  const parsedQuery = listWeekSchedulesQuerySchema.safeParse(req.query);
  if (!parsedQuery.success) {
    return sendError(res, 'Parámetros inválidos', 400, parsedQuery.error.flatten(), 'BAD_REQUEST');
  }

  try {
    const result = await listWeekSchedulesForActor(parsed.data.year, parsed.data.week, parsedQuery.data.branchId, parsedQuery.data.departmentId, parsedQuery.data.userId, {
      id: req.user!.id,
      roleName: req.user!.roleName!,
      branchId: req.user!.branchId,
      visibleBranchIds: req.user!.visibleBranchIds,
    });
    return sendSuccess(res, result);

  } catch (error: unknown) {
    if (isAppError(error)) return sendError(res, error.message, error.statusCode, error.details, error.code);
    throw error;
  }
}

/**
 * @description Devuelve la información pormenorizada de una guardia o falla devolviendo error si su ID es inválido/desaparecido.
 * @param req @param res
 */
export async function getScheduleController(req: AuthRequest, res: Response) {
  const parsed = scheduleIdParamsSchema.safeParse(req.params);
  if (!parsed.success) {
    return sendError(res, 'Parámetros inválidos', 400, parsed.error.flatten(), 'BAD_REQUEST');
  }

  try {
    const schedule = await getScheduleByIdForActor(parsed.data.id, {
      roleName: req.user!.roleName!,
      branchId: req.user!.branchId,
      visibleBranchIds: req.user!.visibleBranchIds,
    });
    return sendSuccess(res, schedule);
  } catch (error: unknown) {
    if (isAppError(error)) return sendError(res, error.message, error.statusCode, error.details, error.code);
    throw error;
  }
}

/**
 * @description Analiza el payload de guardias protegiendo la inserción de empalmes horarios e inyectando autoría en el servicio auditor.
 * @param req @param res
 */
export async function createScheduleController(req: AuthRequest, res: Response) {
  const parsedBody = createScheduleBodySchema.safeParse(req.body);
  if (!parsedBody.success) {
    return sendError(res, 'Datos inválidos', 400, parsedBody.error.flatten(), 'BAD_REQUEST');
  }

  try {
    const schedule = await createScheduleEntry(parsedBody.data, {
      id: req.user!.id,
      email: req.user!.email,
      name: req.user!.name,
      roleName: req.user!.roleName!,
      branchId: req.user!.branchId,
      ipAddress: req.ip,
    });
    return sendSuccess(res, schedule, 'Guardia creada', 201);
  } catch (error: unknown) {
    if (isAppError(error)) return sendError(res, error.message, error.statusCode, error.details, error.code);
    throw error;
  }
}

/**
 * @description Crea multiples turnos en un solo request con validaciones comunes.
 * @param req @param res
 */
export async function createScheduleBulkController(req: AuthRequest, res: Response) {
  const parsedBody = createScheduleBulkBodySchema.safeParse(req.body);
  if (!parsedBody.success) {
    return sendError(res, 'Datos inválidos', 400, parsedBody.error.flatten(), 'BAD_REQUEST');
  }

  try {
    const schedules = await createScheduleEntriesBulk(parsedBody.data.items, {
      id: req.user!.id,
      email: req.user!.email,
      name: req.user!.name,
      roleName: req.user!.roleName!,
      branchId: req.user!.branchId,
      ipAddress: req.ip,
    });
    return sendSuccess(res, schedules, 'Guardias creadas', 201);
  } catch (error: unknown) {
    if (isAppError(error)) return sendError(res, error.message, error.statusCode, error.details, error.code);
    throw error;
  }
}

/**
 * @description Vuelca las actualizaciones de un turno validando la congruencia paramétrica-body, notificando posteriormente a los miembros.
 * @param req @param res
 */
export async function updateScheduleController(req: AuthRequest, res: Response) {
  const parsedParams = scheduleIdParamsSchema.safeParse(req.params);
  if (!parsedParams.success) {
    return sendError(res, 'Parámetros inválidos', 400, parsedParams.error.flatten(), 'BAD_REQUEST');
  }

  const parsedBody = updateScheduleBodySchema.safeParse(req.body);
  if (!parsedBody.success) {
    return sendError(res, 'Datos inválidos', 400, parsedBody.error.flatten(), 'BAD_REQUEST');
  }

  try {
    const schedule = await updateScheduleEntry(parsedParams.data.id, parsedBody.data, {
      id: req.user!.id,
      email: req.user!.email,
      name: req.user!.name,
      roleName: req.user!.roleName!,
      branchId: req.user!.branchId,
      ipAddress: req.ip,
    });
    return sendSuccess(res, schedule, 'Guardia actualizada');
  } catch (error: unknown) {
    if (isAppError(error)) return sendError(res, error.message, error.statusCode, error.details, error.code);
    throw error;
  }
}

/**
 * @description Elimina lógicamente un asiento de guardia propagando de forma opcional el `reason` en el body hacia logs de auditoría remotos.
 * @param req @param res
 */
export async function deleteScheduleController(req: AuthRequest, res: Response) {
  const parsedParams = scheduleIdParamsSchema.safeParse(req.params);
  if (!parsedParams.success) {
    return sendError(res, 'Parámetros inválidos', 400, parsedParams.error.flatten(), 'BAD_REQUEST');
  }

  const parsedBody = deleteScheduleBodySchema.safeParse(req.body ?? {});
  if (!parsedBody.success) {
    return sendError(res, 'Datos inválidos', 400, parsedBody.error.flatten(), 'BAD_REQUEST');
  }

  try {
    await deleteScheduleEntry(parsedParams.data.id, parsedBody.data.reason, {
      id: req.user!.id,
      email: req.user!.email,
      name: req.user!.name,
      roleName: req.user!.roleName!,
      branchId: req.user!.branchId,
      ipAddress: req.ip,
    });
    return sendSuccess(res, null, 'Guardia eliminada');
  } catch (error: unknown) {
    if (isAppError(error)) return sendError(res, error.message, error.statusCode, error.details, error.code);
    throw error;
  }
}

/**
 * @description Devuelve el resumen semanal de horas trabajadas para un usuario en una semana específica.
 * @param req @param res
 */
export async function getWeeklySummaryController(req: AuthRequest, res: Response) {
  const parsed = weeklySummaryParamsSchema.safeParse(req.params);
  if (!parsed.success) {
    return sendError(res, 'Parámetros inválidos', 400, parsed.error.flatten(), 'BAD_REQUEST');
  }

  try {
    const summary = await getWeeklySummary(parsed.data.userId, parsed.data.year, parsed.data.week);
    return sendSuccess(res, summary);
  } catch (error: unknown) {
    if (isAppError(error)) return sendError(res, error.message, error.statusCode, error.details, error.code);
    throw error;
  }
}

/**
 * @description Devuelve los resúmenes semanales de un usuario para un rango de semanas.
 * @param req @param res
 */
export async function getWeeklySummariesController(req: AuthRequest, res: Response) {
  const parsedParams = weeklySummaryParamsSchema.safeParse(req.params);
  if (!parsedParams.success) {
    return sendError(res, 'Parámetros inválidos', 400, parsedParams.error.flatten(), 'BAD_REQUEST');
  }

  const parsedQuery = weeklySummaryQuerySchema.safeParse(req.query);
  if (!parsedQuery.success) {
    return sendError(res, 'Parámetros inválidos', 400, parsedQuery.error.flatten(), 'BAD_REQUEST');
  }

  try {
    const { userId, year } = parsedParams.data;
    const { fromWeek, toWeek } = parsedQuery.data;

    if (fromWeek && toWeek) {
      const summaries = await getWeeklySummaries(userId, year, fromWeek, toWeek);
      return sendSuccess(res, summaries);
    }

    // Si no hay rango, devolver solo la semana especificada
    const summary = await getWeeklySummary(userId, year, parsedParams.data.week);
    return sendSuccess(res, summary ? [summary] : []);
  } catch (error: unknown) {
    if (isAppError(error)) return sendError(res, error.message, error.statusCode, error.details, error.code);
    throw error;
  }
}

/**
 * @description Devuelve el resumen semanal de horas de todo un equipo (departamento/sucursal).
 * Soporta paginación via page/pageSize query params.
 * @param req @param res
 */
export async function getTeamWeeklySummaryController(req: AuthRequest, res: Response) {
  const parsedParams = teamWeeklySummaryParamsSchema.safeParse(req.params);
  if (!parsedParams.success) {
    return sendError(res, 'Parámetros inválidos', 400, parsedParams.error.flatten(), 'BAD_REQUEST');
  }

  const parsedQuery = teamWeeklySummaryQuerySchema.safeParse(req.query);
  if (!parsedQuery.success) {
    return sendError(res, 'Parámetros inválidos', 400, parsedQuery.error.flatten(), 'BAD_REQUEST');
  }

  try {
    const { year, week } = parsedParams.data;
    const { branchId, departmentId, page, pageSize } = parsedQuery.data;
    const roleName = req.user!.roleName!;

    const buildPaginatedResponse = async (filters: { branchId?: string; departmentId?: string }) => {
      const [summaries, total] = await Promise.all([
        getTeamWeeklySummaries(year, week, { ...filters, page, pageSize }),
        countTeamWeeklySummaries(filters),
      ]);
      const p = page ?? 1;
      const ps = pageSize ?? 200;
      return sendSuccess(res, {
        data: summaries,
        pagination: {
          page: p,
          pageSize: ps,
          total,
          totalPages: Math.ceil(total / ps),
        },
      });
    };

    // department_manager solo puede ver su propio departamento
    if (roleName === 'department_manager') {
      const user = await prisma.user.findUnique({
        where: { id: req.user!.id },
        select: { id: true, departmentId: true },
      });
      if (!user) {
        return sendError(res, 'Usuario no encontrado', 404, null, 'NOT_FOUND');
      }
      const userDeptId = user.departmentId;
      if (!userDeptId) {
        return sendError(res, 'No tienes un departamento asignado', 403, null, 'FORBIDDEN');
      }
      if (departmentId && departmentId !== userDeptId) {
        return sendError(res, 'Solo puedes ver el resumen de tu departamento', 403, null, 'FORBIDDEN');
      }
      return buildPaginatedResponse({ departmentId: userDeptId });
    }

    // general_manager solo puede ver su sucursal
    if (roleName === 'general_manager') {
      const userBranchId = req.user!.branchId;
      if (!userBranchId) {
        return sendError(res, 'No tienes una sucursal asignada', 403, null, 'FORBIDDEN');
      }
      if (branchId && branchId !== userBranchId) {
        return sendError(res, 'Solo puedes ver el resumen de tu sucursal', 403, null, 'FORBIDDEN');
      }
      return buildPaginatedResponse({ branchId: userBranchId, departmentId });
    }

    // admin puede filtrar por sucursal y/o departamento
    return buildPaginatedResponse({ branchId, departmentId });
  } catch (error: unknown) {
    if (isAppError(error)) return sendError(res, error.message, error.statusCode, error.details, error.code);
    throw error;
  }
}

/**
 * @description Devuelve alertas de turnos próximos sin personal o con personal único.
 * @param req @param res
 */
export async function getScheduleAlertsController(req: AuthRequest, res: Response) {
  try {
    const alerts = await getScheduleAlerts({
      id: req.user!.id,
      email: req.user!.email,
      name: req.user!.name,
      roleName: req.user!.roleName!,
      branchId: req.user!.branchId,
      ipAddress: req.ip,
    });
    return sendSuccess(res, alerts);
  } catch (error: unknown) {
    if (isAppError(error)) return sendError(res, error.message, error.statusCode, error.details, error.code);
    throw error;
  }
}

export async function getMyWeeklySummaryController(req: AuthRequest, res: Response) {
  const parsed = weekParamsSchema.safeParse(req.params);
  if (!parsed.success) {
    return sendError(res, 'Parámetros inválidos', 400, parsed.error.flatten(), 'BAD_REQUEST');
  }

  try {
    const userId = req.user!.id;
    const { year, week } = parsed.data;

    let summary = await getWeeklySummary(userId, year, week);

    // Si no existe, recalcular sobre la marcha
    if (!summary) {
      summary = await recalculateWeeklySummary(userId, year, week);
    }

    return sendSuccess(res, summary);
  } catch (error: unknown) {
    if (isAppError(error)) return sendError(res, error.message, error.statusCode, error.details, error.code);
    throw error;
  }
}
