import { Response } from 'express';
import { z } from 'zod';
import { sendError, sendSuccess } from '../../utils/response';
import { AuthRequest } from '../../middleware/auth.middleware';
import { isAppError } from '../../common/errors/app-error';
import {
  branchIdParamsSchema,
  createBranchBodySchema,
  createBranchHolidayBodySchema,
  bulkDeleteBranchHolidayBodySchema,
  bulkUpdateBranchHolidayBodySchema,
  holidayIdParamsSchema,
  listBranchesQuerySchema,
  listBranchHolidaysQuerySchema,
  updateBranchBodySchema,
  updateBranchHolidayBodySchema,
} from './branches.http.schemas';
import {
  createBranch,
  createBranchHoliday,
  bulkDeleteSharedHolidays,
  bulkUpdateSharedHolidays,
  deleteBranch,
  deleteBranchHoliday,
  hardDeleteBranch,
  listBranches,
  listBranchHolidays,
  reactivateBranch,
  updateBranch,
  updateBranchHoliday,
  assignBranchManager,
  removeBranchManager,
} from './branches.service';

export async function listBranchesController(req: AuthRequest, res: Response) {
  const parsed = listBranchesQuerySchema.safeParse(req.query);
  if (!parsed.success) {
    return sendError(res, 'Parámetros inválidos', 400, parsed.error.flatten(), 'BAD_REQUEST');
  }

  try {
    const branches = await listBranches({
      includeInactive: parsed.data.includeInactive,
      actor: req.user
        ? {
            roleName: String(req.user.roleName ?? ''),
            branchId: req.user.branchId,
            visibleBranchIds: req.user.visibleBranchIds,
          }
        : undefined,
    });
    return sendSuccess(res, branches);
  } catch (error: unknown) {
    if (isAppError(error)) return sendError(res, error.message, error.statusCode, error.details, error.code);
    throw error;
  }
}

export async function createBranchController(req: AuthRequest, res: Response) {
  const parsedBody = createBranchBodySchema.safeParse(req.body);
  if (!parsedBody.success) {
    return sendError(res, 'Datos inválidos', 400, parsedBody.error.flatten(), 'BAD_REQUEST');
  }

  try {
    const created = await createBranch(parsedBody.data, {
      id: req.user!.id,
      ipAddress: req.ip,
    });
    return sendSuccess(res, created, 'Sucursal creada', 201);
  } catch (error: unknown) {
    if (isAppError(error)) return sendError(res, error.message, error.statusCode, error.details, error.code);
    throw error;
  }
}

export async function updateBranchController(req: AuthRequest, res: Response) {
  const parsedParams = branchIdParamsSchema.safeParse(req.params);
  if (!parsedParams.success) {
    return sendError(res, 'Parámetros inválidos', 400, parsedParams.error.flatten(), 'BAD_REQUEST');
  }

  const parsedBody = updateBranchBodySchema.safeParse(req.body);
  if (!parsedBody.success) {
    return sendError(res, 'Datos inválidos', 400, parsedBody.error.flatten(), 'BAD_REQUEST');
  }

  try {
    const updated = await updateBranch(parsedParams.data.branchId, parsedBody.data, {
      id: req.user!.id,
      ipAddress: req.ip,
    });
    return sendSuccess(res, updated, 'Sucursal actualizada');
  } catch (error: unknown) {
    if (isAppError(error)) return sendError(res, error.message, error.statusCode, error.details, error.code);
    throw error;
  }
}

export async function deleteBranchController(req: AuthRequest, res: Response) {
  const parsedParams = branchIdParamsSchema.safeParse(req.params);
  if (!parsedParams.success) {
    return sendError(res, 'Parámetros inválidos', 400, parsedParams.error.flatten(), 'BAD_REQUEST');
  }

  try {
    await deleteBranch(parsedParams.data.branchId, {
      id: req.user!.id,
      ipAddress: req.ip,
    });
    return sendSuccess(res, null, 'Sucursal desactivada');
  } catch (error: unknown) {
    if (isAppError(error)) return sendError(res, error.message, error.statusCode, error.details, error.code);
    throw error;
  }
}

export async function reactivateBranchController(req: AuthRequest, res: Response) {
  const parsedParams = branchIdParamsSchema.safeParse(req.params);
  if (!parsedParams.success) {
    return sendError(res, 'Parámetros inválidos', 400, parsedParams.error.flatten(), 'BAD_REQUEST');
  }

  try {
    const updated = await reactivateBranch(parsedParams.data.branchId, {
      id: req.user!.id,
      ipAddress: req.ip,
    });
    return sendSuccess(res, updated, 'Sucursal reactivada');
  } catch (error: unknown) {
    if (isAppError(error)) return sendError(res, error.message, error.statusCode, error.details, error.code);
    throw error;
  }
}

export async function hardDeleteBranchController(req: AuthRequest, res: Response) {
  const parsedParams = branchIdParamsSchema.safeParse(req.params);
  if (!parsedParams.success) {
    return sendError(res, 'Parámetros inválidos', 400, parsedParams.error.flatten(), 'BAD_REQUEST');
  }

  try {
    await hardDeleteBranch(parsedParams.data.branchId, {
      id: req.user!.id,
      ipAddress: req.ip,
    });
    return sendSuccess(res, null, 'Sucursal eliminada definitivamente');
  } catch (error: unknown) {
    if (isAppError(error)) return sendError(res, error.message, error.statusCode, error.details, error.code);
    throw error;
  }
}

export async function listBranchHolidaysController(req: AuthRequest, res: Response) {
  const parsedParams = branchIdParamsSchema.safeParse(req.params);
  if (!parsedParams.success) {
    return sendError(res, 'Parámetros inválidos', 400, parsedParams.error.flatten(), 'BAD_REQUEST');
  }

  const parsedQuery = listBranchHolidaysQuerySchema.safeParse(req.query);
  if (!parsedQuery.success) {
    return sendError(res, 'Parámetros inválidos', 400, parsedQuery.error.flatten(), 'BAD_REQUEST');
  }

  try {
    const holidays = await listBranchHolidays(parsedParams.data.branchId, parsedQuery.data);
    return sendSuccess(res, holidays);
  } catch (error: unknown) {
    if (isAppError(error)) return sendError(res, error.message, error.statusCode, error.details, error.code);
    throw error;
  }
}

export async function createBranchHolidayController(req: AuthRequest, res: Response) {
  const parsedParams = branchIdParamsSchema.safeParse(req.params);
  if (!parsedParams.success) {
    return sendError(res, 'Parámetros inválidos', 400, parsedParams.error.flatten(), 'BAD_REQUEST');
  }

  const parsedBody = createBranchHolidayBodySchema.safeParse(req.body);
  if (!parsedBody.success) {
    return sendError(res, 'Datos inválidos', 400, parsedBody.error.flatten(), 'BAD_REQUEST');
  }

  try {
    const created = await createBranchHoliday(parsedParams.data.branchId, parsedBody.data, {
      id: req.user!.id,
      ipAddress: req.ip,
    });
    return sendSuccess(res, created, 'Festivo creado', 201);
  } catch (error: unknown) {
    if (isAppError(error)) return sendError(res, error.message, error.statusCode, error.details, error.code);
    throw error;
  }
}

export async function updateBranchHolidayController(req: AuthRequest, res: Response) {
  const parsedParams = holidayIdParamsSchema.safeParse(req.params);
  if (!parsedParams.success) {
    return sendError(res, 'Parámetros inválidos', 400, parsedParams.error.flatten(), 'BAD_REQUEST');
  }

  const parsedBody = updateBranchHolidayBodySchema.safeParse(req.body);
  if (!parsedBody.success) {
    return sendError(res, 'Datos inválidos', 400, parsedBody.error.flatten(), 'BAD_REQUEST');
  }

  try {
    const updated = await updateBranchHoliday(parsedParams.data.branchId, parsedParams.data.holidayId, parsedBody.data, {
      id: req.user!.id,
      ipAddress: req.ip,
    });
    return sendSuccess(res, updated, 'Festivo actualizado');
  } catch (error: unknown) {
    if (isAppError(error)) return sendError(res, error.message, error.statusCode, error.details, error.code);
    throw error;
  }
}

export async function deleteBranchHolidayController(req: AuthRequest, res: Response) {
  const parsedParams = holidayIdParamsSchema.safeParse(req.params);
  if (!parsedParams.success) {
    return sendError(res, 'Parámetros inválidos', 400, parsedParams.error.flatten(), 'BAD_REQUEST');
  }

  try {
    await deleteBranchHoliday(parsedParams.data.branchId, parsedParams.data.holidayId, {
      id: req.user!.id,
      ipAddress: req.ip,
    });
    return sendSuccess(res, null, 'Festivo eliminado');
  } catch (error: unknown) {
    if (isAppError(error)) return sendError(res, error.message, error.statusCode, error.details, error.code);
    throw error;
  }
}

export async function bulkUpdateBranchHolidayController(req: AuthRequest, res: Response) {
  const parsedParams = branchIdParamsSchema.safeParse(req.params);
  if (!parsedParams.success) {
    return sendError(res, 'Parámetros inválidos', 400, parsedParams.error.flatten(), 'BAD_REQUEST');
  }
  if (parsedParams.data.branchId !== 'all') {
    return sendError(res, 'La actualización masiva solo aplica para la vista global', 400, null, 'BAD_REQUEST');
  }

  const parsedBody = bulkUpdateBranchHolidayBodySchema.safeParse(req.body);
  if (!parsedBody.success) {
    return sendError(res, 'Datos inválidos', 400, parsedBody.error.flatten(), 'BAD_REQUEST');
  }

  try {
    await bulkUpdateSharedHolidays(parsedBody.data, {
      id: req.user!.id,
      ipAddress: req.ip,
    });
    return sendSuccess(res, null, 'Festivos compartidos actualizados');
  } catch (error: unknown) {
    if (isAppError(error)) return sendError(res, error.message, error.statusCode, error.details, error.code);
    throw error;
  }
}

export async function bulkDeleteBranchHolidayController(req: AuthRequest, res: Response) {
  const parsedParams = branchIdParamsSchema.safeParse(req.params);
  if (!parsedParams.success) {
    return sendError(res, 'Parámetros inválidos', 400, parsedParams.error.flatten(), 'BAD_REQUEST');
  }
  if (parsedParams.data.branchId !== 'all') {
    return sendError(res, 'La eliminación masiva solo aplica para la vista global', 400, null, 'BAD_REQUEST');
  }

  const parsedBody = bulkDeleteBranchHolidayBodySchema.safeParse(req.body);
  if (!parsedBody.success) {
    return sendError(res, 'Datos inválidos', 400, parsedBody.error.flatten(), 'BAD_REQUEST');
  }

  try {
    await bulkDeleteSharedHolidays(parsedBody.data.holidayIds, {
      id: req.user!.id,
      ipAddress: req.ip,
    });
    return sendSuccess(res, null, 'Festivos compartidos eliminados');
  } catch (error: unknown) {
    if (isAppError(error)) return sendError(res, error.message, error.statusCode, error.details, error.code);
    throw error;
  }
}

export async function assignBranchManagerController(req: AuthRequest, res: Response) {
  const parsedParams = branchIdParamsSchema.safeParse(req.params);
  if (!parsedParams.success) {
    return sendError(res, 'Parámetros inválidos', 400, parsedParams.error.flatten(), 'BAD_REQUEST');
  }

  const parsedBody = z.object({ userId: z.string().min(1, 'El userId es obligatorio') }).safeParse(req.body);
  if (!parsedBody.success) {
    return sendError(res, 'Datos inválidos', 400, parsedBody.error.flatten(), 'BAD_REQUEST');
  }

  try {
    const updated = await assignBranchManager(
      parsedParams.data.branchId,
      parsedBody.data.userId,
      { id: req.user!.id, ipAddress: req.ip },
    );
    return sendSuccess(res, updated, 'Manager asignado a la sucursal');
  } catch (error: unknown) {
    if (isAppError(error)) return sendError(res, error.message, error.statusCode, error.details, error.code);
    throw error;
  }
}

export async function removeBranchManagerController(req: AuthRequest, res: Response) {
  const parsedParams = branchIdParamsSchema.safeParse(req.params);
  if (!parsedParams.success) {
    return sendError(res, 'Parámetros inválidos', 400, parsedParams.error.flatten(), 'BAD_REQUEST');
  }

  try {
    const updated = await removeBranchManager(
      parsedParams.data.branchId,
      { id: req.user!.id, ipAddress: req.ip },
    );
    return sendSuccess(res, updated, 'Manager removido de la sucursal');
  } catch (error: unknown) {
    if (isAppError(error)) return sendError(res, error.message, error.statusCode, error.details, error.code);
    throw error;
  }
}
