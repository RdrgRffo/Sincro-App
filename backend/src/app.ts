import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import cookieParser from 'cookie-parser';
import rateLimit from 'express-rate-limit';
import { env } from './config/env';
import { errorHandler } from './middleware/errorHandler.middleware';
import { csrfMiddleware } from './middleware/csrf.middleware';
import authRouter from './modules/auth/auth.router';
import usersRouter from './modules/users/users.router';
import schedulesRouter from './modules/schedules/schedules.router';
import scheduleTypesRouter from './modules/schedule-types/schedule-types.router';
import webhooksRouter from './modules/webhooks/webhooks.router';
import notificationsRouter from './modules/notifications/notifications.router';
import auditRouter from './modules/audit/audit.router';
import branchesRouter from './modules/branches/branches.router';
import departmentsRouter from './modules/departments/departments.router';
import rolesRouter from './modules/roles/roles.router';
import absencesRouter from './modules/absences/absences.router';
import shiftPresetsRouter from './modules/shift-presets/shift-presets.router';
import inAppNotificationsRouter from './modules/in-app-notifications/in-app.router';
import planningRouter from './modules/planning/planning.router';
import skillsRouter from './modules/skills/skills.router';
import { sendSuccess } from './utils/response';
import { openApiDocument } from './docs/openapi';
import { prisma } from './config/database';

const app = express();

app.use(helmet());

// Support comma-separated list of origins (e.g. localhost + LAN IP)
const allowedOrigins = env.CORS_ORIGIN.split(',').map((o) => o.trim());
app.use(cors({
  origin: (origin, callback) => {
    // En desarrollo, permitimos cualquier origen para facilitar pruebas en red (móviles, otros PCs)
    if (env.NODE_ENV !== 'production') {
      return callback(null, true);
    }
    
    // En producción, somos estrictos con la lista de orígenes permitidos
    if (!origin) return callback(null, true);
    if (allowedOrigins.includes(origin)) return callback(null, true);
    
    callback(null, false);
  },
  credentials: true,
}));
app.use(cookieParser());
app.use(express.json({ limit: '5mb' }));
app.use(express.urlencoded({ extended: true }));

// Rate limiting: global API limiter and stricter limits for sensitive endpoints
const globalApiLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 300, // 300 requests per minute per IP
  standardHeaders: true,
  legacyHeaders: false,
});

const strictLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 60, // 60 requests per minute per IP
  standardHeaders: true,
  legacyHeaders: false,
});

app.use('/api/', globalApiLimiter);


// CSRF protection — aplicado después de cookieParser, antes de las rutas
// Se excluye /api/auth porque login/refresh usan tokens JWT y no tienen cookie CSRF aún
app.use((req, res, next) => {
  if (req.path.startsWith('/api/auth') || req.path === '/health' || req.path === '/api/health') {
    return next();
  }
  return csrfMiddleware(req, res, next);
});

async function healthHandler(_req: express.Request, res: express.Response) {
  let dbStatus: 'connected' | 'disconnected';
  try {
    await prisma.$queryRaw`SELECT 1`;
    dbStatus = 'connected';
  } catch {
    dbStatus = 'disconnected';
  }

  return sendSuccess(res, { status: 'ok', database: dbStatus, timestamp: new Date().toISOString() });
}

app.get('/health', healthHandler);
app.get('/api/health', healthHandler);
app.get('/api/docs/openapi.json', (_req, res) => {
  return res.json(openApiDocument);
});

app.use('/api/auth', authRouter);
app.use('/api/users', usersRouter);
app.use('/api/schedules', schedulesRouter);
app.use('/api/schedule-types', scheduleTypesRouter);
// Add stricter rate limiting on scheduling and planning endpoints
app.use('/api/schedules', strictLimiter);
app.use('/api/branches', branchesRouter);
app.use('/api/departments', departmentsRouter);
app.use('/api/webhooks', webhooksRouter);
app.use('/api/notifications', notificationsRouter);
app.use('/api/audit', auditRouter);
app.use('/api/roles', rolesRouter);
app.use('/api/absences', absencesRouter);
app.use('/api/shift-presets', shiftPresetsRouter);
app.use('/api/in-app-notifications', inAppNotificationsRouter);
app.use('/api/planning', planningRouter);
app.use('/api/planning', strictLimiter);
app.use('/api/skills', skillsRouter);

app.use(errorHandler);

export default app;
