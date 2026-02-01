/**
 * @file auth.rate-limit.ts
 * Rate limiters para endpoints sensibles de autenticación.
 *
 * - login: clave por identidad normalizada con fallback por IP
 * - refresh: clave por IP (rotación de tokens)
 * - change-password: clave por usuario autenticado
 * - reset-password / force-password-change: clave por IP (operaciones de administrador)
 *
 * Los rate limiters con skipSuccessfulRequests=true no consumen cuota en peticiones exitosas.
 */

import rateLimit, { ipKeyGenerator } from 'express-rate-limit';
import type { Request } from 'express';

/**
 * Extrae la clave de rate limiting del body de login.
 * Prioriza `identifier`, luego `email`, y como fallback usa la IP
 * mediante ipKeyGenerator (compatible con IPv6).
 */
function loginKeyGenerator(req: Request): string {
  const identifier = req.body?.identifier ?? req.body?.email;
  if (identifier && typeof identifier === 'string' && identifier.trim().length > 0) {
    return `login:${identifier.trim().toLowerCase()}`;
  }
  // Fallback: usar ipKeyGenerator que maneja IPv6 correctamente
  const clientIp = req.ip ?? req.socket.remoteAddress ?? 'unknown';
  return `login:ip:${ipKeyGenerator(clientIp)}`;
}

/**
 * Generador de clave por IP para rate limiters genéricos.
 */
function ipKeyGeneratorFn(req: Request): string {
  const clientIp = req.ip ?? req.socket.remoteAddress ?? 'unknown';
  return `rl:ip:${ipKeyGenerator(clientIp)}`;
}

/**
 * Generador de clave por usuario autenticado (para endpoints que requieren authMiddleware).
 */
function userKeyGenerator(req: Request): string {
  const userId = (req as any).user?.id;
  if (userId) {
    return `rl:user:${userId}`;
  }
  return ipKeyGeneratorFn(req);
}

/**
 * Middleware de rate limiting para POST /api/auth/login.
 *
 * - Ventana: 15 minutos
 * - Máximo: 10 intentos por identidad
 * - skipSuccessfulRequests: true (logins correctos no descuentan)
 * - Respuesta JSON normalizada con código TOO_MANY_REQUESTS
 */
export const loginRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutos
  max: 10,                   // 10 intentos por ventana
  standardHeaders: true,     // RateLimit-* headers estándar
  legacyHeaders: false,      // Sin headers X-RateLimit-* (deprecados)
  skipSuccessfulRequests: true, // Logins exitosos no consumen cuota
  keyGenerator: loginKeyGenerator,
  handler: (_req, res) => {
    res.status(429).json({
      success: false,
      error: 'Demasiados intentos de inicio de sesión. Inténtalo de nuevo en 15 minutos.',
      code: 'TOO_MANY_REQUESTS',
    });
  },
});

/**
 * Middleware de rate limiting para POST /api/auth/refresh.
 *
 * - Ventana: 15 minutos
 * - Máximo: 20 rotaciones por IP
 * - skipSuccessfulRequests: true (rotaciones exitosas no descuentan)
 */
export const refreshRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
  skipSuccessfulRequests: true,
  keyGenerator: ipKeyGeneratorFn,
  handler: (_req, res) => {
    res.status(429).json({
      success: false,
      error: 'Demasiadas solicitudes de renovación de sesión. Inténtalo de nuevo en 15 minutos.',
      code: 'TOO_MANY_REQUESTS',
    });
  },
});

/**
 * Middleware de rate limiting para PATCH /api/auth/change-password.
 *
 * - Ventana: 60 minutos
 * - Máximo: 5 cambios por usuario
 * - skipSuccessfulRequests: true (cambios exitosos no descuentan)
 */
export const changePasswordRateLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 5,
  standardHeaders: true,
  legacyHeaders: false,
  skipSuccessfulRequests: true,
  keyGenerator: userKeyGenerator,
  handler: (_req, res) => {
    res.status(429).json({
      success: false,
      error: 'Demasiados cambios de contraseña. Inténtalo de nuevo en 60 minutos.',
      code: 'TOO_MANY_REQUESTS',
    });
  },
});

/**
 * Middleware de rate limiting para POST /api/users/:id/reset-password y /force-password-change.
 *
 * - Ventana: 60 minutos
 * - Máximo: 10 operaciones por IP
 * - skipSuccessfulRequests: true (operaciones exitosas no descuentan)
 */
export const adminPasswordRateLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  skipSuccessfulRequests: true,
  keyGenerator: ipKeyGeneratorFn,
  handler: (_req, res) => {
    res.status(429).json({
      success: false,
      error: 'Demasiadas operaciones de administración de contraseñas. Inténtalo de nuevo en 60 minutos.',
      code: 'TOO_MANY_REQUESTS',
    });
  },
});
