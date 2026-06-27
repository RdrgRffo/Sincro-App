/**
 * @file in-app-notifications.router.test.ts
 * Tests del router de notificaciones in-app: autenticación, scope de usuario, 404 en recursos inexistentes.
 */

import express from 'express';
import request from 'supertest';

jest.mock('../../src/middleware/auth.middleware', () => ({
  authMiddleware: (req: any, _res: any, next: any) => {
    const userId = req.header('x-test-user-id');
    if (!userId) {
      return _res.status(401).json({ success: false, error: 'No autenticado', code: 'UNAUTHORIZED' });
    }
    req.user = { id: userId, roleName: 'employee', permissions: [], name: 'Test', email: 'test@example.com' };
    return next();
  },
}));

jest.mock('../../src/modules/in-app-notifications/in-app.service', () => ({
  countUnread: jest.fn(),
  getUnreadNotifications: jest.fn(),
  getUserNotifications: jest.fn(),
  markAsRead: jest.fn(),
  markAllAsRead: jest.fn(),
  deleteNotification: jest.fn(),
  deleteAllNotifications: jest.fn(),
}));

import inAppRouter from '../../src/modules/in-app-notifications/in-app.router';
import * as inAppService from '../../src/modules/in-app-notifications/in-app.service';

const mockService = inAppService as jest.Mocked<typeof inAppService>;

const app = express();
app.use(express.json());
app.use('/api/in-app-notifications', inAppRouter);

const USER_A = 'user-a';
const USER_B = 'user-b';
const auth = (userId = USER_A) => ({ 'x-test-user-id': userId });

// ─── Helpers de respuesta por defecto ─────────────────────────────────────────
beforeEach(() => {
  jest.clearAllMocks();
  mockService.countUnread.mockResolvedValue(2);
  mockService.getUnreadNotifications.mockResolvedValue([]);
  mockService.getUserNotifications.mockResolvedValue({ items: [], total: 0, page: 1, pageSize: 20, totalPages: 0 });
  mockService.markAsRead.mockResolvedValue({ count: 1 } as any);
  mockService.markAllAsRead.mockResolvedValue({ count: 3 } as any);
  mockService.deleteNotification.mockResolvedValue({ count: 1 } as any);
  mockService.deleteAllNotifications.mockResolvedValue({ count: 5 } as any);
});

// ══════════════════════════════════════════════════════════════════════════════
describe('GET /api/in-app-notifications/unread-count', () => {
  it('devuelve el contador de no leídas del usuario autenticado', async () => {
    const res = await request(app).get('/api/in-app-notifications/unread-count').set(auth());
    expect(res.status).toBe(200);
    expect(res.body.data.count).toBe(2);
    expect(mockService.countUnread).toHaveBeenCalledWith(USER_A);
  });

  it('rechaza petición sin autenticación con 401', async () => {
    const res = await request(app).get('/api/in-app-notifications/unread-count');
    expect(res.status).toBe(401);
  });

  it('usa el userId del token, no de query params', async () => {
    await request(app)
      .get('/api/in-app-notifications/unread-count?userId=otro-user')
      .set(auth(USER_A));
    expect(mockService.countUnread).toHaveBeenCalledWith(USER_A);
    expect(mockService.countUnread).not.toHaveBeenCalledWith('otro-user');
  });
});

// ══════════════════════════════════════════════════════════════════════════════
describe('GET /api/in-app-notifications/unread', () => {
  it('devuelve notificaciones no leídas sólo del usuario autenticado', async () => {
    mockService.getUnreadNotifications.mockResolvedValue([
      { id: 'notif-1', userId: USER_A, type: 'system', title: 'Hola', message: 'Test', readAt: null, createdAt: new Date() } as any,
    ]);
    const res = await request(app).get('/api/in-app-notifications/unread').set(auth());
    expect(res.status).toBe(200);
    expect(res.body.data).toHaveLength(1);
    expect(mockService.getUnreadNotifications).toHaveBeenCalledWith(USER_A);
  });
});

// ══════════════════════════════════════════════════════════════════════════════
describe('GET /api/in-app-notifications', () => {
  it('devuelve lista paginada de notificaciones', async () => {
    const res = await request(app).get('/api/in-app-notifications').set(auth());
    expect(res.status).toBe(200);
    expect(mockService.getUserNotifications).toHaveBeenCalledWith(USER_A, 1, 20);
  });

  it('respeta page y pageSize de query (máximo 50)', async () => {
    await request(app)
      .get('/api/in-app-notifications?page=2&pageSize=100')
      .set(auth());
    expect(mockService.getUserNotifications).toHaveBeenCalledWith(USER_A, 2, 50);
  });
});

// ══════════════════════════════════════════════════════════════════════════════
describe('PATCH /api/in-app-notifications/:id/read', () => {
  it('marca como leída una notificación propia (200)', async () => {
    const res = await request(app)
      .patch('/api/in-app-notifications/notif-1/read')
      .set(auth());
    expect(res.status).toBe(200);
    expect(mockService.markAsRead).toHaveBeenCalledWith('notif-1', USER_A);
  });

  it('devuelve 404 si la notificación no existe o no pertenece al usuario', async () => {
    mockService.markAsRead.mockResolvedValue({ count: 0 } as any);
    const res = await request(app)
      .patch('/api/in-app-notifications/notif-inexistente/read')
      .set(auth(USER_B));
    expect(res.status).toBe(404);
  });

  it('usa el userId del token para evitar IDOR', async () => {
    await request(app).patch('/api/in-app-notifications/notif-1/read').set(auth(USER_A));
    expect(mockService.markAsRead).toHaveBeenCalledWith('notif-1', USER_A);
  });
});

// ══════════════════════════════════════════════════════════════════════════════
describe('POST /api/in-app-notifications/read-all', () => {
  it('marca todas las notificaciones del usuario como leídas', async () => {
    const res = await request(app).post('/api/in-app-notifications/read-all').set(auth());
    expect(res.status).toBe(200);
    expect(res.body.data.count).toBe(3);
    expect(mockService.markAllAsRead).toHaveBeenCalledWith(USER_A);
  });
});

// ══════════════════════════════════════════════════════════════════════════════
describe('DELETE /api/in-app-notifications', () => {
  it('elimina todas las notificaciones del usuario autenticado', async () => {
    const res = await request(app).delete('/api/in-app-notifications').set(auth());
    expect(res.status).toBe(200);
    expect(res.body.data.count).toBe(5);
    expect(mockService.deleteAllNotifications).toHaveBeenCalledWith(USER_A);
  });
});

// ══════════════════════════════════════════════════════════════════════════════
describe('DELETE /api/in-app-notifications/:id', () => {
  it('elimina una notificación propia (200)', async () => {
    const res = await request(app)
      .delete('/api/in-app-notifications/notif-2')
      .set(auth());
    expect(res.status).toBe(200);
    expect(mockService.deleteNotification).toHaveBeenCalledWith('notif-2', USER_A);
  });

  it('devuelve 404 si la notificación no existe o no pertenece al usuario', async () => {
    mockService.deleteNotification.mockResolvedValue({ count: 0 } as any);
    const res = await request(app)
      .delete('/api/in-app-notifications/notif-ajena')
      .set(auth(USER_B));
    expect(res.status).toBe(404);
  });

  it('usa el userId del token para evitar IDOR en delete', async () => {
    await request(app).delete('/api/in-app-notifications/notif-3').set(auth(USER_A));
    expect(mockService.deleteNotification).toHaveBeenCalledWith('notif-3', USER_A);
  });
});
