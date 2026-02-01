import { Request, Response, NextFunction } from 'express';
import { logger } from '../utils/logger';
import { isAppError } from '../common/errors/app-error';
import { sendError } from '../utils/response';
import { z } from 'zod';

type PrismaLikeError = {
  code?: string;
  meta?: {
    target?: string | string[];
    cause?: string;
    modelName?: string;
  };
  message?: string;
};

function getPrismaLikeError(error: unknown): PrismaLikeError | null {
  if (!error || typeof error !== 'object') return null;
  return error as PrismaLikeError;
}

function containsWebhookColumn(target: unknown, message?: string): boolean {
  const normalizedTarget = Array.isArray(target)
    ? target.map((item) => String(item).toLowerCase()).join(',')
    : String(target ?? '').toLowerCase();

  if (normalizedTarget.includes('webhook_url')) return true;
  return typeof message === 'string' && message.toLowerCase().includes('webhook_url');
}

export function errorHandler(err: unknown, _req: Request, res: Response, _next: NextFunction) {
  const message = err instanceof Error ? err.message : String(err);
  logger.error(message, err);

  if (isAppError(err)) {
    return sendError(res, err.message, err.statusCode, err.details, err.code);
  }

  if (err instanceof z.ZodError) {
    return sendError(res, 'Datos inválidos', 400, err.flatten(), 'BAD_REQUEST');
  }

  const prismaError = getPrismaLikeError(err);
  if (prismaError?.code === 'P2000') {
    const isWebhookUrlOverflow = containsWebhookColumn(prismaError.meta?.target, prismaError.message);
    return sendError(
      res,
      isWebhookUrlOverflow
        ? 'La URL del webhook es demasiado larga para el almacenamiento actual'
        : 'Uno de los valores enviados supera el tamaño permitido',
      400,
      undefined,
      'BAD_REQUEST'
    );
  }

  if (prismaError?.code === 'P2002') {
    return sendError(
      res,
      'Conflicto de datos: ya existe un registro con un valor único duplicado',
      409,
      undefined,
      'CONFLICT'
    );
  }

  if (prismaError?.code === 'P2025') {
    return sendError(res, 'Recurso no encontrado', 404, undefined, 'NOT_FOUND');
  }

  return sendError(res, 'Error interno del servidor', 500, undefined, 'INTERNAL_ERROR');
}
