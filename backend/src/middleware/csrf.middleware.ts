import { Request, Response, NextFunction } from 'express';
import crypto from 'crypto';
import { env } from '../config/env';

const CSRF_COOKIE_NAME = 'csrf-token';
const CSRF_HEADER_NAME = 'x-csrf-token';
const SAFE_METHODS = ['GET', 'HEAD', 'OPTIONS'];

/**
 * Genera un token CSRF y lo establece como cookie (httpOnly=false para que JS lo lea).
 * El frontend debe leer la cookie y enviarla en el header X-CSRF-Token.
 */
export function csrfMiddleware(req: Request, res: Response, next: NextFunction): void {
  // Los métodos seguros (GET, HEAD, OPTIONS) no necesitan validación CSRF
  if (SAFE_METHODS.includes(req.method)) {
    // Aún así, aseguramos que la cookie exista para futuras peticiones mutativas
    if (!req.cookies?.[CSRF_COOKIE_NAME]) {
      const token = crypto.randomBytes(32).toString('hex');
      res.cookie(CSRF_COOKIE_NAME, token, {
        httpOnly: false,  // El frontend necesita leerla con js-cookie o similar
        secure: env.NODE_ENV === 'production',
        sameSite: 'strict',
        path: '/',
      });
    }
    return next();
  }

  // Para métodos mutativos (POST, PUT, PATCH, DELETE), validamos el token
  const cookieToken = req.cookies?.[CSRF_COOKIE_NAME];
  const headerToken = req.headers[CSRF_HEADER_NAME] as string | undefined;

  // En desarrollo, permitir token CSRF de prueba desde variable de entorno
  const testCsrfToken = env.NODE_ENV !== 'production' ? env.CSRF_TEST_TOKEN : undefined;
  if (testCsrfToken && headerToken === testCsrfToken) {
    // Rotamos el token después de usarlo (para prevenir reuso)
    const newToken = crypto.randomBytes(32).toString('hex');
    res.cookie(CSRF_COOKIE_NAME, newToken, {
      httpOnly: false,
      secure: env.NODE_ENV === 'production',
      sameSite: 'strict',
      path: '/',
    });
    return next();
  }

  if (!cookieToken || !headerToken) {
    res.status(403).json({
      success: false,
      message: 'CSRF token missing',
      code: 'CSRF_TOKEN_MISSING',
    });
    return;
  }

  // Comparación segura en tiempo constante
  if (cookieToken.length !== headerToken.length ||
      !crypto.timingSafeEqual(Buffer.from(cookieToken), Buffer.from(headerToken))) {
    res.status(403).json({
      success: false,
      message: 'CSRF token mismatch',
      code: 'CSRF_TOKEN_MISMATCH',
    });
    return;
  }

  // Rotamos el token después de usarlo (para prevenir reuso)
  const newToken = crypto.randomBytes(32).toString('hex');
  res.cookie(CSRF_COOKIE_NAME, newToken, {
    httpOnly: false,
    secure: env.NODE_ENV === 'production',
    sameSite: 'strict',
    path: '/',
  });

  next();
}
