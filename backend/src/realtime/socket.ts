import { Server as HttpServer } from 'http';
import { Server, Socket } from 'socket.io';
import { env } from '../config/env';
import { verifyAccessToken, type AccessTokenPayload } from '../utils/jwt';
import { logger } from '../utils/logger';
import type { RealtimeEventName, RealtimeEventPayload } from './events';

interface SocketData {
  user: AccessTokenPayload;
}

let io: Server | null = null;
let emittedEventCount = 0;

function extractToken(socket: Socket): string | null {
  const authToken = typeof socket.handshake.auth?.token === 'string'
    ? socket.handshake.auth.token
    : null;

  if (authToken) return authToken;

  const authHeader = socket.handshake.headers.authorization;
  if (typeof authHeader === 'string' && authHeader.startsWith('Bearer ')) {
    return authHeader.slice(7);
  }

  return null;
}

export function initializeSocketServer(httpServer: HttpServer) {
  // Importante intranet/produccion:
  // CORS_ORIGIN debe listar los orígenes reales del frontend (DNS/IP), separados por coma.
  // Ejemplo: "http://intranet-app:5173,http://10.0.0.25:5173"
  const allowedOrigins = env.CORS_ORIGIN.split(',').map((origin) => origin.trim());

  io = new Server(httpServer, {
    cors: {
      origin: (origin, callback) => {
        // Mantenemos la misma lógica dinámica que en app.ts para consistencia en red local
        if (env.NODE_ENV !== 'production') {
          return callback(null, true);
        }

        if (!origin || allowedOrigins.includes(origin)) {
          callback(null, true);
        } else {
          callback(new Error('CORS origin is not allowed'));
        }
      },
      credentials: true,
    },
  });

  io.use((socket: Socket, next) => {
    const token = extractToken(socket);
    if (!token) {
      logger.warn(`Realtime auth error: missing token socket=${socket.id}`);
      next(new Error('AUTH_MISSING_TOKEN'));
      return;
    }

    try {
      const payload = verifyAccessToken(token);
      (socket.data as SocketData).user = payload;
      next();
    } catch {
      logger.warn(`Realtime auth error: invalid token socket=${socket.id}`);
      next(new Error('AUTH_INVALID_TOKEN'));
    }
  });

  io.on('connection', (socket: Socket) => {
    const socketData = socket.data as SocketData;
    logger.info(`Realtime connected: ${socket.id} user=${socketData.user.sub}`);

    socket.on('disconnect', (reason) => {
      logger.info(`Realtime disconnected: ${socket.id} reason=${reason}`);
    });
  });

  return io;
}

export function publishRealtimeEvent(event: RealtimeEventName, payload: RealtimeEventPayload) {
  if (!io) return;
  emittedEventCount += 1;
  logger.debug(`Realtime emit #${emittedEventCount}: ${event} id=${payload.id}`);
  io.emit(event, payload);
}
