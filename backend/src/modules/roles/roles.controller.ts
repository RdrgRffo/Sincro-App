import { Request, Response } from 'express';
import * as service from './roles.service';
import { sendSuccess, sendError } from '../../utils/response';
import { isAppError } from '../../common/errors/app-error';
import { CreateRoleSchema, UpdateRoleSchema } from './roles.http.schemas';

function sendRoleError(res: Response, error: unknown) {
  if (isAppError(error)) {
    return sendError(res, error.message, error.statusCode, error.details, error.code);
  }

  throw error;
}

export async function listRolesController(_req: Request, res: Response) {
  try {
    const roles = await service.listRoles();
    return sendSuccess(res, roles);
  } catch (error: unknown) {
    return sendRoleError(res, error);
  }
}

export async function getRoleController(req: Request, res: Response) {
  try {
    const role = await service.getRole(req.params.id as string);
    return sendSuccess(res, role);
  } catch (error: unknown) {
    return sendRoleError(res, error);
  }
}

export async function createRoleController(req: Request, res: Response) {
  const parsed = CreateRoleSchema.safeParse(req.body);
  if (!parsed.success) {
    return sendError(res, 'Datos inválidos', 400, parsed.error.flatten(), 'BAD_REQUEST');
  }

  try {
    const role = await service.createRole(parsed.data);
    return sendSuccess(res, role, 'Rol creado', 201);
  } catch (error: unknown) {
    return sendRoleError(res, error);
  }
}

export async function updateRoleController(req: Request, res: Response) {
  const parsed = UpdateRoleSchema.safeParse(req.body);
  if (!parsed.success) {
    return sendError(res, 'Datos inválidos', 400, parsed.error.flatten(), 'BAD_REQUEST');
  }

  try {
    const role = await service.updateRole(req.params.id as string, parsed.data);
    return sendSuccess(res, role);
  } catch (error: unknown) {
    return sendRoleError(res, error);
  }
}

export async function deleteRoleController(req: Request, res: Response) {
  try {
    await service.deleteRole(req.params.id as string);
    return sendSuccess(res, null, 'Rol eliminado');
  } catch (error: unknown) {
    return sendRoleError(res, error);
  }
}

export async function listPermissionsController(_req: Request, res: Response) {
  try {
    const perms = await service.listPermissions();
    return sendSuccess(res, perms);
  } catch (error: unknown) {
    return sendRoleError(res, error);
  }
}
