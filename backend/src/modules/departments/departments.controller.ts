import { Response } from 'express';
import { AuthRequest } from '../../middleware/auth.middleware';
import { sendError, sendSuccess } from '../../utils/response';
import { isAppError } from '../../common/errors/app-error';
import {
  assignDepartmentManagerBodySchema,
  createDepartmentBodySchema,
  departmentIdParamsSchema,
  listDepartmentsQuerySchema,
  removeDepartmentManagerBodySchema,
  updateDepartmentBodySchema,
} from './departments.http.schemas';
import {
  assignDepartmentManager,
  createDepartment,
  deleteDepartment,
  getDepartmentBranches,
  getDepartmentMembers,
  hardDeleteDepartment,
  listDepartments,
  reactivateDepartment,
  removeDepartmentManager,
  updateDepartment,
} from './departments.service';

export async function listDepartmentsController(req: AuthRequest, res: Response) {
  const parsed = listDepartmentsQuerySchema.safeParse(req.query);
  if (!parsed.success) {
    return sendError(res, 'Parámetros inválidos', 400, parsed.error.flatten(), 'BAD_REQUEST');
  }

  try {
    const departments = await listDepartments({
      ...parsed.data,
      actor: req.user
        ? {
            roleName: String(req.user.roleName ?? ''),
            branchId: req.user.branchId,
            visibleBranchIds: req.user.visibleBranchIds,
          }
        : undefined,
    });
    return sendSuccess(res, departments);
  } catch (error: unknown) {
    if (isAppError(error)) return sendError(res, error.message, error.statusCode, error.details, error.code);
    throw error;
  }
}

export async function createDepartmentController(req: AuthRequest, res: Response) {
  const parsedBody = createDepartmentBodySchema.safeParse(req.body);
  if (!parsedBody.success) {
    return sendError(res, 'Datos inválidos', 400, parsedBody.error.flatten(), 'BAD_REQUEST');
  }

  try {
    const created = await createDepartment(parsedBody.data, {
      id: req.user!.id,
      ipAddress: req.ip,
    });
    return sendSuccess(res, created, 'Departamento creado', 201);
  } catch (error: unknown) {
    if (isAppError(error)) return sendError(res, error.message, error.statusCode, error.details, error.code);
    throw error;
  }
}

export async function updateDepartmentController(req: AuthRequest, res: Response) {
  const parsedParams = departmentIdParamsSchema.safeParse(req.params);
  if (!parsedParams.success) {
    return sendError(res, 'Parámetros inválidos', 400, parsedParams.error.flatten(), 'BAD_REQUEST');
  }

  const parsedBody = updateDepartmentBodySchema.safeParse(req.body);
  if (!parsedBody.success) {
    return sendError(res, 'Datos inválidos', 400, parsedBody.error.flatten(), 'BAD_REQUEST');
  }

  try {
    const updated = await updateDepartment(parsedParams.data.departmentId, parsedBody.data, {
      id: req.user!.id,
      ipAddress: req.ip,
    });
    return sendSuccess(res, updated, 'Departamento actualizado');
  } catch (error: unknown) {
    if (isAppError(error)) return sendError(res, error.message, error.statusCode, error.details, error.code);
    throw error;
  }
}

export async function deleteDepartmentController(req: AuthRequest, res: Response) {
  const parsedParams = departmentIdParamsSchema.safeParse(req.params);
  if (!parsedParams.success) {
    return sendError(res, 'Parámetros inválidos', 400, parsedParams.error.flatten(), 'BAD_REQUEST');
  }

  try {
    await deleteDepartment(parsedParams.data.departmentId, {
      id: req.user!.id,
      ipAddress: req.ip,
    });
    return sendSuccess(res, null, 'Departamento desactivado');
  } catch (error: unknown) {
    if (isAppError(error)) return sendError(res, error.message, error.statusCode, error.details, error.code);
    throw error;
  }
}

export async function reactivateDepartmentController(req: AuthRequest, res: Response) {
  const parsedParams = departmentIdParamsSchema.safeParse(req.params);
  if (!parsedParams.success) {
    return sendError(res, 'Parámetros inválidos', 400, parsedParams.error.flatten(), 'BAD_REQUEST');
  }

  try {
    const updated = await reactivateDepartment(parsedParams.data.departmentId, {
      id: req.user!.id,
      ipAddress: req.ip,
    });
    return sendSuccess(res, updated, 'Departamento reactivado');
  } catch (error: unknown) {
    if (isAppError(error)) return sendError(res, error.message, error.statusCode, error.details, error.code);
    throw error;
  }
}

export async function hardDeleteDepartmentController(req: AuthRequest, res: Response) {
  const parsedParams = departmentIdParamsSchema.safeParse(req.params);
  if (!parsedParams.success) {
    return sendError(res, 'Parámetros inválidos', 400, parsedParams.error.flatten(), 'BAD_REQUEST');
  }

  try {
    await hardDeleteDepartment(parsedParams.data.departmentId, {
      id: req.user!.id,
      ipAddress: req.ip,
    });
    return sendSuccess(res, null, 'Departamento eliminado definitivamente');
  } catch (error: unknown) {
    if (isAppError(error)) return sendError(res, error.message, error.statusCode, error.details, error.code);
    throw error;
  }
}

export async function listDepartmentBranchesController(req: AuthRequest, res: Response) {
  const parsedParams = departmentIdParamsSchema.safeParse(req.params);
  if (!parsedParams.success) {
    return sendError(res, 'Parámetros inválidos', 400, parsedParams.error.flatten(), 'BAD_REQUEST');
  }

  try {
    const branches = await getDepartmentBranches(parsedParams.data.departmentId);
    return sendSuccess(res, branches);
  } catch (error: unknown) {
    if (isAppError(error)) return sendError(res, error.message, error.statusCode, error.details, error.code);
    throw error;
  }
}

export async function listDepartmentMembersController(req: AuthRequest, res: Response) {
  const parsedParams = departmentIdParamsSchema.safeParse(req.params);
  if (!parsedParams.success) {
    return sendError(res, 'Parámetros inválidos', 400, parsedParams.error.flatten(), 'BAD_REQUEST');
  }

  try {
    const members = await getDepartmentMembers(parsedParams.data.departmentId);
    return sendSuccess(res, members);
  } catch (error: unknown) {
    if (isAppError(error)) return sendError(res, error.message, error.statusCode, error.details, error.code);
    throw error;
  }
}

export async function assignDepartmentManagerController(req: AuthRequest, res: Response) {
  const parsedParams = departmentIdParamsSchema.safeParse(req.params);
  if (!parsedParams.success) {
    return sendError(res, 'Parámetros inválidos', 400, parsedParams.error.flatten(), 'BAD_REQUEST');
  }

  const parsedBody = assignDepartmentManagerBodySchema.safeParse(req.body);
  if (!parsedBody.success) {
    return sendError(res, 'Datos inválidos', 400, parsedBody.error.flatten(), 'BAD_REQUEST');
  }

  try {
    const updated = await assignDepartmentManager(parsedParams.data.departmentId, parsedBody.data.userId, {
      id: req.user!.id,
      ipAddress: req.ip,
    });
    return sendSuccess(res, updated, 'Manager asignado al departamento');
  } catch (error: unknown) {
    if (isAppError(error)) return sendError(res, error.message, error.statusCode, error.details, error.code);
    throw error;
  }
}

export async function removeDepartmentManagerController(req: AuthRequest, res: Response) {
  const parsedParams = departmentIdParamsSchema.safeParse(req.params);
  if (!parsedParams.success) {
    return sendError(res, 'Parámetros inválidos', 400, parsedParams.error.flatten(), 'BAD_REQUEST');
  }

  const parsedBody = removeDepartmentManagerBodySchema.safeParse(req.body);
  if (!parsedBody.success) {
    return sendError(res, 'Datos inválidos', 400, parsedBody.error.flatten(), 'BAD_REQUEST');
  }

  try {
    const updated = await removeDepartmentManager(parsedParams.data.departmentId, parsedBody.data.userId, {
      id: req.user!.id,
      ipAddress: req.ip,
    });
    return sendSuccess(res, updated, 'Manager removido del departamento');
  } catch (error: unknown) {
    if (isAppError(error)) return sendError(res, error.message, error.statusCode, error.details, error.code);
    throw error;
  }
}
