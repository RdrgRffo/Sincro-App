import { Request, Response, NextFunction } from 'express';
import { verifyAccessToken } from '../utils/jwt';
import { sendError } from '../utils/response';
import { prisma } from '../config/database';
import { USER_STATUS } from '../config/constants';
import { RoleName, PermissionName } from '../modules/roles/roles.constants';

export interface AuthRequest extends Request {
  user?: {
    id: string;
    email: string;
    roleId: string | null;
    roleName?: RoleName | string;
    permissions?: PermissionName[] | string[];
    visibleBranchIds?: string[];
    name: string;
    status: string;
    branchId: string | null;
    departmentId: string | null;
  };
  file?: Express.Multer.File;
  files?: Express.Multer.File[] | { [fieldname: string]: Express.Multer.File[] };
}

export async function authMiddleware(req: AuthRequest, res: Response, next: NextFunction) {
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith('Bearer ')) {
    return sendError(res, 'Token de acceso requerido', 401);
  }

  const token = authHeader.slice(7);
  try {
    const payload = verifyAccessToken(token);

    const user = await prisma.user.findUnique({
      where: { id: payload.sub },
      select: {
        id: true,
        email: true,
        roleId: true,
        role: {
          select: {
            name: true,
            permissions: {
              select: { name: true },
            },
          },
        },
        name: true,
        status: true,
        branchId: true,
        departmentId: true,
        tokenVersion: true,
        visibleBranches: {
          select: { branchId: true },
        },
      },
    });

    if (!user) {
      return sendError(res, 'Token inválido o usuario no disponible', 401);
    }

    if (user.status !== USER_STATUS.ACTIVE) {
      return sendError(res, 'Tu cuenta no está activa', 403, null, 'FORBIDDEN');
    }

    // VUL-9: Verificar tokenVersion para invalidar tokens al cambiar contraseña
    if (payload.tokenVersion !== undefined && payload.tokenVersion !== user.tokenVersion) {
      return sendError(res, 'Sesión expirada. Inicia sesión nuevamente', 401);
    }

    req.user = {
      id: user.id,
      email: user.email,
      roleId: user.roleId,
      roleName: user.role?.name,
      permissions: user.role?.permissions.map((p) => p.name) || [],
      visibleBranchIds: user.visibleBranches.map((item) => item.branchId),
      name: user.name,
      status: user.status,
      branchId: user.branchId,
      departmentId: user.departmentId,
    };

    return next();
  } catch {
    return sendError(res, 'Token inválido o expirado', 401);
  }
}
