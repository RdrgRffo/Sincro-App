import { prisma } from '../../config/database';
import { REALTIME_EVENTS } from '../../realtime/events';
import { publishRealtimeEvent } from '../../realtime/socket';

export type InAppNotificationType =
  | 'absence_request_sent'
  | 'absence_approved'
  | 'absence_rejected'
  | 'absence_cancelled'
  | 'absence_requested'
  | 'schedule_assigned'
  | 'schedule_modified'
  | 'schedule_deleted'
  | 'schedule_removed'
  | 'profile_updated'
  | 'password_changed'
  | 'system';

interface CreateInAppNotificationParams {
  userId: string;
  type: InAppNotificationType;
  title: string;
  message: string;
  link?: string;
  metadata?: Record<string, unknown>;
}

function emitNotificationChanged(action: 'created' | 'updated' | 'deleted', id: string, userId: string, actorId: string | null) {
  publishRealtimeEvent(REALTIME_EVENTS.NOTIFICATION_CHANGED, {
    entity: 'notification',
    action,
    id,
    changedAt: new Date().toISOString(),
    actorId,
    meta: { userId },
  });
}

/**
 * Crea una notificación in-app para un usuario específico.
 * Se almacena en la tabla `in_app_notifications` y puede ser consultada
 * desde el frontend para mostrar un badge de notificaciones no leídas.
 */
export async function createInAppNotification(params: CreateInAppNotificationParams) {
  const notification = await prisma.inAppNotification.create({
    data: {
      userId: params.userId,
      type: params.type,
      title: params.title,
      message: params.message,
      link: params.link,
      metadata: params.metadata ? JSON.stringify(params.metadata) : null,
    },
  });
  emitNotificationChanged('created', notification.id, notification.userId, null);
  return notification;
}

/**
 * Crea notificaciones in-app para múltiples usuarios a la vez (batch)
 */
export async function createInAppNotificationBatch(
  notifications: Array<{
    userId: string;
    type: InAppNotificationType;
    title: string;
    message: string;
    link?: string;
    metadata?: Record<string, unknown>;
  }>
) {
  const result = await prisma.inAppNotification.createMany({
    data: notifications.map((n) => ({
      userId: n.userId,
      type: n.type,
      title: n.title,
      message: n.message,
      link: n.link,
      metadata: n.metadata ? JSON.stringify(n.metadata) : null,
    })),
  });
  const affectedUsers = Array.from(new Set(notifications.map((n) => n.userId)));
  affectedUsers.forEach((userId) => {
    emitNotificationChanged('created', `batch:${userId}`, userId, null);
  });
  return result;
}

/**
 * Obtiene las notificaciones no leídas de un usuario
 */
export async function getUnreadNotifications(userId: string) {
  return prisma.inAppNotification.findMany({
    where: { userId, readAt: null },
    orderBy: { createdAt: 'desc' },
    take: 50,
  });
}

/**
 * Obtiene todas las notificaciones de un usuario (con paginación)
 */
export async function getUserNotifications(userId: string, page = 1, pageSize = 20) {
  const skip = (page - 1) * pageSize;

  const [items, total] = await Promise.all([
    prisma.inAppNotification.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      skip,
      take: pageSize,
    }),
    prisma.inAppNotification.count({ where: { userId } }),
  ]);

  return { items, total, page, pageSize, totalPages: Math.ceil(total / pageSize) };
}

/**
 * Marca una notificación como leída
 */
export async function markAsRead(notificationId: string, userId: string) {
  const result = await prisma.inAppNotification.updateMany({
    where: { id: notificationId, userId },
    data: { readAt: new Date() },
  });
  if (result.count > 0) {
    emitNotificationChanged('updated', notificationId, userId, userId);
  }
  return result;
}

/**
 * Marca todas las notificaciones de un usuario como leídas
 */
export async function markAllAsRead(userId: string) {
  const result = await prisma.inAppNotification.updateMany({
    where: { userId, readAt: null },
    data: { readAt: new Date() },
  });
  if (result.count > 0) {
    emitNotificationChanged('updated', `read-all:${userId}`, userId, userId);
  }
  return result;
}

export async function deleteNotification(notificationId: string, userId: string) {
  const result = await prisma.inAppNotification.deleteMany({
    where: { id: notificationId, userId },
  });
  if (result.count > 0) {
    emitNotificationChanged('deleted', notificationId, userId, userId);
  }
  return result;
}

export async function deleteAllNotifications(userId: string) {
  const result = await prisma.inAppNotification.deleteMany({
    where: { userId },
  });
  if (result.count > 0) {
    emitNotificationChanged('deleted', `delete-all:${userId}`, userId, userId);
  }
  return result;
}

/**
 * Cuenta las notificaciones no leídas de un usuario
 */
export async function countUnread(userId: string): Promise<number> {
  return prisma.inAppNotification.count({
    where: { userId, readAt: null },
  });
}
