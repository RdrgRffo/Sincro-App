import { AppError, AppErrorCode } from './app-error';

type ErrorCatalogItem = {
  statusCode: number;
  defaultMessage: string;
};

export const ERROR_CATALOG: Record<AppErrorCode, ErrorCatalogItem> = {
  BAD_REQUEST: {
    statusCode: 400,
    defaultMessage: 'Solicitud inválida',
  },
  UNAUTHORIZED: {
    statusCode: 401,
    defaultMessage: 'No autorizado',
  },
  FORBIDDEN: {
    statusCode: 403,
    defaultMessage: 'Acceso denegado',
  },
  NOT_FOUND: {
    statusCode: 404,
    defaultMessage: 'Recurso no encontrado',
  },
  CONFLICT: {
    statusCode: 409,
    defaultMessage: 'Conflicto de datos',
  },
  UNPROCESSABLE_ENTITY: {
    statusCode: 422,
    defaultMessage: 'Regla de negocio no cumplida',
  },
  INTERNAL_ERROR: {
    statusCode: 500,
    defaultMessage: 'Error interno del servidor',
  },
};

export function createAppError(
  code: AppErrorCode,
  message?: string,
  details?: unknown
): AppError {
  const entry = ERROR_CATALOG[code];
  return new AppError(code, entry.statusCode, message ?? entry.defaultMessage, details);
}
