import { Response, NextFunction } from 'express';
import { AuthRequest } from './auth.middleware';
import { PermissionName } from '../modules/roles/roles.constants';
import { sendError } from '../utils/response';

export function requirePermission(...requiredPermissions: PermissionName[]) {
  return (req: AuthRequest, res: Response, next: NextFunction) => {
    if (!req.user) {
      return sendError(res, 'No autorizado', 401);
    }

    if (req.user.status === 'locked' || req.user.status === 'disabled') {
      return sendError(res, 'La cuenta está bloqueada o deshabilitada', 403);
    }

    const userPermissions = req.user.permissions || [];

    // Si no se requiere ningún permiso específico, o si el usuario tiene TODOS los permisos requeridos
    const hasPermission = requiredPermissions.every(perm => userPermissions.includes(perm));

    if (!hasPermission) {
      return sendError(res, 'No tienes los permisos necesarios para realizar esta acción', 403);
    }

    return next();
  };
}

export function requireAnyPermission(...requiredPermissions: PermissionName[]) {
  return (req: AuthRequest, res: Response, next: NextFunction) => {
    if (!req.user) {
      return sendError(res, 'No autorizado', 401);
    }

    if (req.user.status === 'locked' || req.user.status === 'disabled') {
      return sendError(res, 'La cuenta está bloqueada o deshabilitada', 403);
    }

    const userPermissions = req.user.permissions || [];
    const hasAny = requiredPermissions.some((perm) => userPermissions.includes(perm));

    if (!hasAny) {
      return sendError(res, 'No tienes los permisos necesarios para realizar esta acción', 403);
    }

    return next();
  };
}
