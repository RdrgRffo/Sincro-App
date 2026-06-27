import express from 'express';
import request from 'supertest';

jest.mock('../../src/middleware/auth.middleware', () => {
  const { DEFAULT_ROLE_PERMISSIONS } = require('../../src/modules/roles/roles.constants');
  return {
    authMiddleware: (req: any, _res: any, next: any) => {
      req.user = { 
        id: 'admin-1', 
        roleName: 'admin', 
        permissions: DEFAULT_ROLE_PERMISSIONS['admin'],
        status: 'active'
      };
      next();
    },
  };
});

jest.mock('../../src/modules/webhooks/webhooks.service', () => ({
  createWebhook: jest.fn(),
  updateWebhook: jest.fn(),
  deleteWebhook: jest.fn(),
}));

jest.mock('../../src/modules/notifications/notifications.service', () => ({
  sendToWebhook: jest.fn(),
}));

jest.mock('../../src/modules/notifications/notifications.templates', () => ({
  buildTestCard: jest.fn(() => ({})),
}));

import webhooksRouter from '../../src/modules/webhooks/webhooks.router';
import { errorHandler } from '../../src/middleware/errorHandler.middleware';
import { prisma } from '../../src/config/database';
import * as webhooksService from '../../src/modules/webhooks/webhooks.service';

const prismaMock = prisma as unknown as {
  webhookConfig: {
    findMany: jest.Mock;
    findUnique: jest.Mock;
    update: jest.Mock; // Added for completeness
  };
};

const webhooksServiceMock = webhooksService as jest.Mocked<typeof webhooksService>;

const app = express();
app.use(express.json());
app.use('/api/webhooks', webhooksRouter);
app.use(errorHandler);

function buildWebhookUrl(totalLength: number): string {
  const base = 'https://example.com/';
  if (totalLength <= base.length) {
    return base.slice(0, totalLength);
  }
  return `${base}${'a'.repeat(totalLength - base.length)}`;
}

describe('webhooks.router validation', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    prismaMock.webhookConfig.findUnique.mockResolvedValue({
      id: 'wh-1',
      name: 'Ops Teams',
      webhookUrl: buildWebhookUrl(8000),
    });
  });

  it('acepta URL válida muy larga en POST', async () => {
    webhooksServiceMock.createWebhook.mockResolvedValue({
      id: 'wh-1',
      name: 'Canal guardias',
      webhookUrl: buildWebhookUrl(8000),
      enabled: true,
      notifyModifications: true,
      notifyLastMinute: true,
      fridayReminderEnabled: true,
      mondayAbsenceReminderEnabled: true,
      fridayReminderTime: '12:00',
      createdAt: new Date(),
      updatedAt: new Date(),
    } as any);

    const response = await request(app)
      .post('/api/webhooks')
      .send({
        name: 'Canal guardias',
        webhookUrl: buildWebhookUrl(8000),
      });

    expect(response.status).toBe(201);
    expect(response.body.success).toBe(true);
    expect(webhooksServiceMock.createWebhook).toHaveBeenCalledTimes(1);
  });

  it('rechaza URL inválida en POST con BAD_REQUEST', async () => {
    const response = await request(app)
      .post('/api/webhooks')
      .send({
        name: 'Canal guardias',
        webhookUrl: 'url-invalida',
      });

    expect(response.status).toBe(400);
    expect(response.body.success).toBe(false);
    expect(response.body.code).toBe('BAD_REQUEST');
    expect(webhooksServiceMock.createWebhook).not.toHaveBeenCalled();
  });

  it('rechaza URL inválida en PATCH con BAD_REQUEST', async () => {
    const response = await request(app)
      .patch('/api/webhooks/wh-1')
      .send({
        webhookUrl: 'url-invalida',
      });

    expect(response.status).toBe(400);
    expect(response.body.success).toBe(false);
    expect(response.body.code).toBe('BAD_REQUEST');
    expect(webhooksServiceMock.updateWebhook).not.toHaveBeenCalled();
  });

  it('mapea error P2000 de webhook_url a 400 controlado', async () => {
    webhooksServiceMock.createWebhook.mockRejectedValueOnce({
      code: 'P2000',
      meta: { target: ['webhook_url'] },
      message: 'The provided value for the column is too long for the column\'s type. Column: webhook_url',
    });

    const response = await request(app)
      .post('/api/webhooks')
      .send({
        name: 'Canal guardias',
        webhookUrl: buildWebhookUrl(8000),
      });

    expect(response.status).toBe(400);
    expect(response.body.success).toBe(false);
    expect(response.body.code).toBe('BAD_REQUEST');
    expect(response.body.error).toContain('demasiado larga');
  });
});
