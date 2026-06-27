/**
 * @file auth.rate-limit.test.ts
 * Tests del rate limiter de login (VUL-4).
 *
 * Verifica que:
 * - Tras superar el umbral, responde 429 con TOO_MANY_REQUESTS
 * - No ejecuta el handler de login cuando está rate-limited
 * - Otro identificador desde la misma IP no se ve afectado
 * - Los endpoints no login (refresh, etc.) no tienen rate limit
 */

import express from 'express';
import request from 'supertest';
import rateLimit, { ipKeyGenerator } from 'express-rate-limit';

// ── Middleware mock de auth ──────────────────────────────────────────────────
jest.mock('../../src/middleware/auth.middleware', () => ({
  authMiddleware: (req: any, _res: any, next: any) => {
    req.user = { id: 'test-user', roleName: 'admin', permissions: [] };
    next();
  },
}));

// ── App de prueba ────────────────────────────────────────────────────────────
const app = express();
app.use(express.json());

let loginHandlerCalled = false;

/**
 * Crea un rate limiter de prueba con ventana corta (1s) y límite bajo (3)
 * para poder testear sin esperar 15 minutos.
 * Usa el mismo keyGenerator que el real pero con ventana/límite de test.
 */
function createTestLimiter() {
  return rateLimit({
    windowMs: 1000,   // 1 segundo
    max: 3,            // 3 intentos
    standardHeaders: true,
    legacyHeaders: false,
    skipSuccessfulRequests: false, // Todos los intentos cuentan (incluso los 200)
    keyGenerator: (req) => {
      const identifier = req.body?.identifier ?? req.body?.email;
      if (identifier && typeof identifier === 'string' && identifier.trim().length > 0) {
        return `login:${identifier.trim().toLowerCase()}`;
      }
      // Fallback: usar ipKeyGenerator para compatibilidad IPv6
      const clientIp = req.ip ?? 'unknown';
      return `login:ip:${ipKeyGenerator(clientIp)}`;
    },
    handler: (_req, res) => {
      res.status(429).json({
        success: false,
        error: 'Demasiados intentos de inicio de sesión. Inténtalo de nuevo.',
        code: 'TOO_MANY_REQUESTS',
      });
    },
  });
}

const testLimiter = createTestLimiter();

app.post('/api/auth/login', testLimiter, (_req, res) => {
  loginHandlerCalled = true;
  res.json({ success: true, data: { token: 'mock-token' } });
});

// Endpoint sin rate limit (refresh, logout, etc.)
app.post('/api/auth/refresh', (_req, res) => {
  res.json({ success: true, data: { accessToken: 'refreshed' } });
});

describe('POST /api/auth/login - Rate Limiting (VUL-4)', () => {
  beforeEach(() => {
    loginHandlerCalled = false;
  });

  it('permite hasta 3 intentos para el mismo identifier', async () => {
    for (let i = 1; i <= 3; i++) {
      const response = await request(app)
        .post('/api/auth/login')
        .send({ identifier: 'user@test.com', password: 'wrong' });

      expect(response.status).toBe(200);
      expect(loginHandlerCalled).toBe(true);
      loginHandlerCalled = false;
    }
  });

  it('responde 429 con TOO_MANY_REQUESTS al 4º intento del mismo identifier', async () => {
    // Consumir los 3 intentos permitidos
    for (let i = 0; i < 3; i++) {
      await request(app)
        .post('/api/auth/login')
        .send({ identifier: 'rate-limited@test.com', password: 'wrong' });
    }

    // 4º intento → debe ser rate-limited
    const response = await request(app)
      .post('/api/auth/login')
      .send({ identifier: 'rate-limited@test.com', password: 'wrong' });

    expect(response.status).toBe(429);
    expect(response.body.success).toBe(false);
    expect(response.body.code).toBe('TOO_MANY_REQUESTS');
    // La respuesta debe ser la del rate limiter, no la del handler
    expect(response.body.data).toBeUndefined();
  });

  it('no bloquea otro identifier aunque comparta IP', async () => {
    // Consumir los 3 intentos del primer usuario
    for (let i = 0; i < 3; i++) {
      await request(app)
        .post('/api/auth/login')
        .send({ identifier: 'first@test.com', password: 'wrong' });
    }

    // El segundo usuario con identifier diferente debe poder loguearse
    loginHandlerCalled = false;
    const response = await request(app)
      .post('/api/auth/login')
      .send({ identifier: 'second@test.com', password: 'wrong' });

    expect(response.status).toBe(200);
    expect(loginHandlerCalled).toBe(true);
  });

  it('no afecta a endpoints sin rate limit (ej: /refresh)', async () => {
    // Consumir los 3 intentos
    for (let i = 0; i < 3; i++) {
      await request(app)
        .post('/api/auth/login')
        .send({ identifier: 'refresh-test@test.com', password: 'wrong' });
    }

    // /refresh debe funcionar sin problema
    const response = await request(app)
      .post('/api/auth/refresh')
      .send({ refreshToken: 'some-token' });

    expect(response.status).toBe(200);
  });

  it('usa email como fallback cuando no hay identifier', async () => {
    for (let i = 0; i < 3; i++) {
      await request(app)
        .post('/api/auth/login')
        .send({ email: 'email-only@test.com', password: 'wrong' });
    }

    const response = await request(app)
      .post('/api/auth/login')
      .send({ email: 'email-only@test.com', password: 'wrong' });

    expect(response.status).toBe(429);
    expect(response.body.code).toBe('TOO_MANY_REQUESTS');
  });

  it('normaliza a minúsculas el identifier', async () => {
    for (let i = 0; i < 3; i++) {
      await request(app)
        .post('/api/auth/login')
        .send({ identifier: 'CaseMix@Test.com', password: 'wrong' });
    }

    // Mismo email pero con mayúsculas distintas → misma clave
    const response = await request(app)
      .post('/api/auth/login')
      .send({ identifier: 'CASEMIX@test.COM', password: 'wrong' });

    expect(response.status).toBe(429);
  });
});
