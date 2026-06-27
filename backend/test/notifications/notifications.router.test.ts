import express from 'express';
import request from 'supertest';

jest.mock('../../src/middleware/auth.middleware', () => {
  const { DEFAULT_ROLE_PERMISSIONS } = require('../../src/modules/roles/roles.constants');
  return {
    authMiddleware: (req: any, res: any, next: any) => {
      const role = req.header('x-test-role') as any;

      if (!role) {
        return res.status(401).json({
          success: false,
          error: 'Token de acceso requerido',
          code: 'UNAUTHORIZED',
        });
      }

      const permissions = DEFAULT_ROLE_PERMISSIONS[role] || [];
      req.user = {
        id: 'test-user',
        roleName: role,
        permissions,
        name: 'Test User',
        email: 'test@example.com',
        status: 'active',
        branchId: req.header('x-test-branch-id') || null,
        visibleBranchIds: [],
      };
      next();
    },
  };
});

jest.mock('../../src/modules/notifications/notifications.service', () => ({
  resendNotification: jest.fn(),
  sendToWebhook: jest.fn(),
}));

jest.mock('../../src/modules/notifications/notifications.scheduler', () => ({
  sendFridaySummary: jest.fn(),
  sendMondayAbsenceSummary: jest.fn(),
}));

jest.mock('../../src/modules/notifications/notifications.templates', () => ({
  buildAnnouncementCard: jest.fn(() => ({ type: 'message', body: 'card' })),
}));

import notificationsRouter from '../../src/modules/notifications/notifications.router';
import * as notificationsService from '../../src/modules/notifications/notifications.service';
import * as notificationsScheduler from '../../src/modules/notifications/notifications.scheduler';
import { prismaMock } from '../config/singleton';

const app = express();
app.use(express.json());
app.use('/api/notifications', notificationsRouter);

describe('notifications.router', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    prismaMock.notificationLog.findMany.mockResolvedValue([] as any);
    prismaMock.notificationLog.count.mockResolvedValue(0 as any);
    prismaMock.notificationLog.findUnique.mockResolvedValue({ webhookConfigId: 'wh-1' } as any);
    prismaMock.webhookConfig.findMany.mockResolvedValue([
      { id: 'wh-1', webhookUrl: 'https://example.com/wh1' },
      { id: 'wh-2', webhookUrl: 'https://example.com/wh2' },
    ] as any);
    prismaMock.webhookConfig.count.mockResolvedValue(1 as any);
    (notificationsService.sendToWebhook as jest.Mock).mockResolvedValue({ success: true });
    (notificationsService.resendNotification as jest.Mock).mockResolvedValue({ id: 'log-1', status: 'sent' });
  });

  it('returns paginated logs on GET /logs', async () => {
    const response = await request(app)
      .get('/api/notifications/logs?page=1&limit=20')
      .set('x-test-role', 'admin');

    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);
    expect(prismaMock.notificationLog.findMany).toHaveBeenCalledTimes(1);
    expect(prismaMock.notificationLog.count).toHaveBeenCalledTimes(1);
  });

  it('resends notification by id', async () => {
    const response = await request(app)
      .post('/api/notifications/resend/log-1')
      .set('x-test-role', 'admin');

    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);
    expect(notificationsService.resendNotification).toHaveBeenCalledWith('log-1', 'test-user');
  });

  it('returns 401 on announce when role header is missing', async () => {
    const response = await request(app).post('/api/notifications/announce').send({ message: 'Aviso' });

    expect(response.status).toBe(401);
    expect(response.body).toEqual({
      success: false,
      error: 'Token de acceso requerido',
      code: 'UNAUTHORIZED',
    });
  });

  it('returns 403 on announce for employee', async () => {
    const response = await request(app)
      .post('/api/notifications/announce')
      .set('x-test-role', 'employee')
      .send({ message: 'Aviso' });

    expect(response.status).toBe(403);
    expect(notificationsService.sendToWebhook).not.toHaveBeenCalled();
  });

  it('allows announce for general_manager (notifications:send, not webhook CRUD)', async () => {
    const response = await request(app)
      .post('/api/notifications/announce')
      .set('x-test-role', 'general_manager')
      .set('x-test-branch-id', 'branch-tfn')
      .send({ message: 'Aviso GM' });

    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);
    expect(notificationsService.sendToWebhook).toHaveBeenCalled();
  });

  it('returns 403 on announce for general_manager when webhook ids are outside branch scope', async () => {
    prismaMock.webhookConfig.count.mockResolvedValueOnce(0 as any);

    const response = await request(app)
      .post('/api/notifications/announce')
      .set('x-test-role', 'general_manager')
      .set('x-test-branch-id', 'branch-tfn')
      .send({ message: 'X', webhookConfigIds: ['foreign-wh'] });

    expect(response.status).toBe(403);
    expect(notificationsService.sendToWebhook).not.toHaveBeenCalled();
  });

  it('validates message on announce endpoint', async () => {
    const response = await request(app)
      .post('/api/notifications/announce')
      .set('x-test-role', 'admin')
      .send({});

    expect(response.status).toBe(400);
    expect(response.body.success).toBe(false);
    expect(response.body.code).toBe('BAD_REQUEST');
  });

  it('sends to specific webhook ids when provided', async () => {
    prismaMock.webhookConfig.findMany.mockResolvedValueOnce([
      { id: 'wh-1', webhookUrl: 'https://example.com/wh1' },
    ] as any);

    const response = await request(app)
      .post('/api/notifications/announce')
      .set('x-test-role', 'admin')
      .send({ message: 'Mensaje importante', webhookConfigIds: ['wh-1'] });

    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);
    expect(response.body.data.sent).toBe(1);
    expect(notificationsService.sendToWebhook).toHaveBeenCalledTimes(1);
  });

  it('sends announcement to all enabled webhooks', async () => {
    const response = await request(app)
      .post('/api/notifications/announce')
      .set('x-test-role', 'admin')
      .send({ message: 'Guardia activa' });

    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);
    expect(response.body.data.sent).toBe(2);
    expect(notificationsService.sendToWebhook).toHaveBeenCalledTimes(2);
  });

  it('passes explicit webhook ids to friday summary', async () => {
    (notificationsScheduler.sendFridaySummary as jest.Mock).mockResolvedValueOnce([{ success: true }]);

    const response = await request(app)
      .post('/api/notifications/friday-summary')
      .set('x-test-role', 'admin')
      .send({ webhookConfigIds: ['wh-1'] });

    expect(response.status).toBe(200);
    expect(notificationsScheduler.sendFridaySummary).toHaveBeenCalledWith('test-user', ['wh-1']);
  });

  it('passes explicit webhook ids to absence summary', async () => {
    (notificationsScheduler.sendMondayAbsenceSummary as jest.Mock).mockResolvedValueOnce([{ success: true }]);

    const response = await request(app)
      .post('/api/notifications/absence-summary')
      .set('x-test-role', 'admin')
      .send({ webhookConfigIds: ['wh-2'] });

    expect(response.status).toBe(200);
    expect(notificationsScheduler.sendMondayAbsenceSummary).toHaveBeenCalledWith('test-user', ['wh-2']);
  });

  it('keeps an empty webhook id list scoped to zero announcement targets', async () => {
    prismaMock.webhookConfig.findMany.mockResolvedValueOnce([] as any);

    const response = await request(app)
      .post('/api/notifications/announce')
      .set('x-test-role', 'admin')
      .send({ message: 'Sin destinatarios', webhookConfigIds: [] });

    expect(response.status).toBe(200);
    expect(response.body.data.sent).toBe(0);
    expect(prismaMock.webhookConfig.findMany).toHaveBeenCalled();
    const announceFind = prismaMock.webhookConfig.findMany.mock.calls.find(
      (c) => Array.isArray((c[0] as { where?: { AND?: unknown[] } })?.where?.AND),
    );
    expect((announceFind?.[0] as { where: { AND: unknown[] } }).where).toEqual(
      expect.objectContaining({
        AND: expect.arrayContaining([{ enabled: true }, { id: { in: [] } }]),
      }),
    );
    expect(notificationsService.sendToWebhook).not.toHaveBeenCalled();
  });
});
