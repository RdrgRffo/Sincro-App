import { Response } from 'express';
import { AuthRequest } from '../../middleware/auth.middleware';
import { sendPaginated, sendError, sendSuccess } from '../../utils/response';
import { getAuditLogById, listAuditLogs, rollbackAudit, exportAuditLogsCsv } from './audit.service';
import { auditIdParamsSchema, listAuditQuerySchema } from './audit.http.schemas';
import { isAppError } from '../../common/errors/app-error';

/**
 * @description Despliega el volcado paginado de los registros de auditoría aplicando filtros relacionales y de viabilidad (reversibilidad).
 * @param req @param res
 */
export async function listAuditLogsController(req: AuthRequest, res: Response) {
  const parsed = listAuditQuerySchema.safeParse(req.query);
  if (!parsed.success) {
    return sendError(res, 'Parámetros inválidos', 400, parsed.error.flatten(), 'BAD_REQUEST');
  }

  try {
    const { logs, total } = await listAuditLogs({
      ...parsed.data,
      from: parsed.data.from ? new Date(parsed.data.from) : undefined,
      to: parsed.data.to ? new Date(parsed.data.to) : undefined,
    });

    return sendPaginated(res, logs, total, parsed.data.page, parsed.data.limit);
  } catch (error: unknown) {
    if (isAppError(error)) {
      return sendError(res, error.message, error.statusCode, error.details, error.code);
    }
    throw error;
  }
}

/**
 * @description Responde con la radiografía completa del rastro JSON (antes/después) resuelto a partir de un ID validado.
 * @param req @param res
 */
export async function getAuditLogController(req: AuthRequest, res: Response) {
  const parsed = auditIdParamsSchema.safeParse(req.params);
  if (!parsed.success) {
    return sendError(res, 'Identificador de auditoría inválido', 400, parsed.error.flatten(), 'BAD_REQUEST');
  }

  try {
    const log = await getAuditLogById(parsed.data.id);
    return sendSuccess(res, log);
  } catch (error: unknown) {
    if (isAppError(error)) {
      return sendError(res, error.message, error.statusCode, error.details, error.code);
    }
    throw error;
  }
}

/**
 * @description Ejecuta la orden HTTPS de forzar la regresión del registro (rollback), propagando el autor y contexto de red al core.
 * @param req @param res
 */
export async function rollbackAuditController(req: AuthRequest, res: Response) {
  const parsed = auditIdParamsSchema.safeParse(req.params);
  if (!parsed.success) {
    return sendError(res, 'Identificador de auditoría inválido', 400, parsed.error.flatten(), 'BAD_REQUEST');
  }

  try {
    const result = await rollbackAudit(parsed.data.id, req.user!.id, req.ip);
    return sendSuccess(res, result, 'Rollback realizado con éxito');
  } catch (error: unknown) {
    if (isAppError(error)) {
      return sendError(res, error.message, error.statusCode, error.details, error.code);
    }
    throw error;
  }
}

/**
 * @description Exporta logs de auditoría a CSV con los mismos filtros que el listado.
 */
export async function exportAuditLogsCsvController(req: AuthRequest, res: Response) {
  const parsed = listAuditQuerySchema.safeParse(req.query);
  if (!parsed.success) {
    return sendError(res, 'Parámetros inválidos', 400, parsed.error.flatten(), 'BAD_REQUEST');
  }

  try {
    const csv = await exportAuditLogsCsv({
      ...parsed.data,
      from: parsed.data.from ? new Date(parsed.data.from) : undefined,
      to: parsed.data.to ? new Date(parsed.data.to) : undefined,
    });

    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="audit-logs-${new Date().toISOString().split('T')[0]}.csv"`);
    return res.status(200).send(csv);
  } catch (error: unknown) {
    if (isAppError(error)) {
      return sendError(res, error.message, error.statusCode, error.details, error.code);
    }
    throw error;
  }
}
