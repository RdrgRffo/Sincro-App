/**
 * @file in-app-notifications.service.test.ts
 * Tests del servicio de notificaciones in-app: CRUD, paginación, marcado como leído.
 */

jest.mock('../../src/config/database', () => {
  const inAppNotification = {
    create: jest.fn(),
    createMany: jest.fn(),
    findMany: jest.fn(),
    count: jest.fn(),
    updateMany: jest.fn(),
    deleteMany: jest.fn(),
  };
  return {
    prisma: {
      $connect: jest.fn(),
      $disconnect: jest.fn(),
      $on: jest.fn(),
      $use: jest.fn(),
      $transaction: jest.fn(),
      $extends: jest.fn(),
      inAppNotification,
    },
  };
});

jest.mock('../../src/realtime/socket', () => ({
  publishRealtimeEvent: jest.fn(),
}));

import { prisma } from '../../src/config/database';
import {
  createInAppNotification,
  createInAppNotificationBatch,
  getUnreadNotifications,
  getUserNotifications,
  markAsRead,
  markAllAsRead,
  countUnread,
  deleteNotification,
  deleteAllNotifications,
} from '../../src/modules/in-app-notifications/in-app.service';
import { publishRealtimeEvent } from '../../src/realtime/socket';

const mockModel = prisma.inAppNotification as unknown as {
  create: jest.Mock;
  createMany: jest.Mock;
  findMany: jest.Mock;
  count: jest.Mock;
  updateMany: jest.Mock;
  deleteMany: jest.Mock;
};

describe('in-app-notifications.service', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('createInAppNotification', () => {
    it('crea una notificación con metadata como string JSON', async () => {
      const params = {
        userId: 'user-1',
        type: 'absence_approved' as const,
        title: 'Ausencia aprobada',
        message: 'Tu ausencia ha sido aprobada',
        link: '/ausencias',
        metadata: { approvedBy: 'admin-1' },
      };

      mockModel.create.mockResolvedValue({ id: 'notif-1', ...params, metadata: JSON.stringify(params.metadata), readAt: null, createdAt: new Date() });

      const result = await createInAppNotification(params);

      expect(mockModel.create).toHaveBeenCalledWith({
        data: {
          userId: 'user-1',
          type: 'absence_approved',
          title: 'Ausencia aprobada',
          message: 'Tu ausencia ha sido aprobada',
          link: '/ausencias',
          metadata: JSON.stringify({ approvedBy: 'admin-1' }),
        },
      });
      expect(result.id).toBe('notif-1');
    });

    it('crea notificación sin link ni metadata', async () => {
      const params = {
        userId: 'user-2',
        type: 'system' as const,
        title: 'Bienvenido',
        message: 'Bienvenido al sistema',
      };

      mockModel.create.mockResolvedValue({ id: 'notif-2', ...params, metadata: null, link: null, readAt: null, createdAt: new Date() });

      const result = await createInAppNotification(params);

      expect(mockModel.create).toHaveBeenCalledWith({
        data: {
          userId: 'user-2',
          type: 'system',
          title: 'Bienvenido',
          message: 'Bienvenido al sistema',
          link: undefined,
          metadata: null,
        },
      });
      expect(result.id).toBe('notif-2');
    });
  });

  describe('createInAppNotificationBatch', () => {
    it('crea múltiples notificaciones con createMany', async () => {
      const notifications = [
        { userId: 'user-1', type: 'schedule_assigned' as const, title: 'Turno asignado', message: 'Te asignaron un turno' },
        { userId: 'user-2', type: 'schedule_assigned' as const, title: 'Turno asignado', message: 'Te asignaron un turno' },
      ];

      mockModel.createMany.mockResolvedValue({ count: 2 });

      const result = await createInAppNotificationBatch(notifications);

      expect(mockModel.createMany).toHaveBeenCalledWith({
        data: notifications.map(n => ({
          userId: n.userId,
          type: n.type,
          title: n.title,
          message: n.message,
          link: undefined,
          metadata: null,
        })),
      });
      expect(result.count).toBe(2);
    });
  });

  describe('getUnreadNotifications', () => {
    it('retorna notificaciones no leídas ordenadas por fecha descendente', async () => {
      const mockNotifs = [
        { id: 'n1', userId: 'user-1', type: 'system', title: 'Test', message: 'Msg', readAt: null, createdAt: new Date() },
      ];
      mockModel.findMany.mockResolvedValue(mockNotifs);

      const result = await getUnreadNotifications('user-1');

      expect(mockModel.findMany).toHaveBeenCalledWith({
        where: { userId: 'user-1', readAt: null },
        orderBy: { createdAt: 'desc' },
        take: 50,
      });
      expect(result).toEqual(mockNotifs);
    });
  });

  describe('getUserNotifications', () => {
    it('retorna notificaciones paginadas con total', async () => {
      const mockItems = [{ id: 'n1', userId: 'user-1', type: 'system', title: 'Test', message: 'Msg', readAt: null, createdAt: new Date() }];
      mockModel.findMany.mockResolvedValue(mockItems);
      mockModel.count.mockResolvedValue(1);

      const result = await getUserNotifications('user-1', 1, 20);

      expect(mockModel.findMany).toHaveBeenCalledWith({
        where: { userId: 'user-1' },
        orderBy: { createdAt: 'desc' },
        skip: 0,
        take: 20,
      });
      expect(result).toEqual({
        items: mockItems,
        total: 1,
        page: 1,
        pageSize: 20,
        totalPages: 1,
      });
    });

    it('calcula totalPages correctamente', async () => {
      mockModel.findMany.mockResolvedValue([]);
      mockModel.count.mockResolvedValue(25);

      const result = await getUserNotifications('user-1', 1, 10);

      expect(result.totalPages).toBe(3);
    });
  });

  describe('markAsRead', () => {
    it('marca una notificación como leída', async () => {
      mockModel.updateMany.mockResolvedValue({ count: 1 });

      await markAsRead('notif-1', 'user-1');

      expect(mockModel.updateMany).toHaveBeenCalledWith({
        where: { id: 'notif-1', userId: 'user-1' },
        data: { readAt: expect.any(Date) },
      });
    });
  });

  describe('markAllAsRead', () => {
    it('marca todas las no leídas como leídas', async () => {
      mockModel.updateMany.mockResolvedValue({ count: 3 });

      const result = await markAllAsRead('user-1');

      expect(mockModel.updateMany).toHaveBeenCalledWith({
        where: { userId: 'user-1', readAt: null },
        data: { readAt: expect.any(Date) },
      });
      expect(result.count).toBe(3);
    });
  });

  describe('countUnread', () => {
    it('retorna el conteo de no leídas', async () => {
      mockModel.count.mockResolvedValue(5);

      const result = await countUnread('user-1');

      expect(mockModel.count).toHaveBeenCalledWith({
        where: { userId: 'user-1', readAt: null },
      });
      expect(result).toBe(5);
    });
  });

  describe('deleteNotification', () => {
    it('elimina notificación del usuario dueño', async () => {
      mockModel.deleteMany.mockResolvedValue({ count: 1 });

      const result = await deleteNotification('notif-1', 'user-1');

      expect(mockModel.deleteMany).toHaveBeenCalledWith({
        where: { id: 'notif-1', userId: 'user-1' },
      });
      expect(result.count).toBe(1);
      expect(publishRealtimeEvent).toHaveBeenCalled();
    });
  });

  describe('deleteAllNotifications', () => {
    it('elimina todas las notificaciones del usuario', async () => {
      mockModel.deleteMany.mockResolvedValue({ count: 3 });

      const result = await deleteAllNotifications('user-1');

      expect(mockModel.deleteMany).toHaveBeenCalledWith({
        where: { userId: 'user-1' },
      });
      expect(result.count).toBe(3);
      expect(publishRealtimeEvent).toHaveBeenCalled();
    });
  });
});
