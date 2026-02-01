import { Router, Response } from 'express';
import { Prisma } from '@prisma/client';
import { authMiddleware, AuthRequest } from '../../middleware/auth.middleware';
import { requireAnyPermission, requirePermission } from '../../middleware/permission.middleware';
import { sendSuccess, sendError, sendPaginated } from '../../utils/response';
import { prisma } from '../../config/database';
import { resendNotification, sendToWebhook } from './notifications.service';
import { sendFridaySummary, sendMondayAbsenceSummary } from './notifications.scheduler';
import { buildAnnouncementCard } from './notifications.templates';
import {
  assertWebhookLogResendAllowed,
  findWebhooksForManualAnnounce,
  notificationLogScopeWhere,
  resolveFridaySummaryWebhookIds,
  resolveAbsenceSummaryWebhookIds,
} from '../webhooks/webhooks.access';

const router = Router();

const getParam = (value: string | string[] | undefined): string | undefined => (
  Array.isArray(value) ? value[0] : value
);

router.get('/logs', authMiddleware, requirePermission('webhooks:view'), async (req: AuthRequest, res: Response) => {
  const page = parseInt(req.query.page as string) || 1;
  const limit = Math.min(parseInt(req.query.limit as string) || 20, 100);
  const { type, status } = req.query;

  const filters: Prisma.NotificationLogWhereInput[] = [];
  if (typeof type === 'string') filters.push({ type });
  if (typeof status === 'string') filters.push({ status });
  const logScope = notificationLogScopeWhere(req.user!);
  if (logScope) filters.push(logScope);
  const where: Prisma.Args<typeof prisma.notificationLog, 'findMany'>['where'] =
    filters.length > 0 ? { AND: filters } : {};

  const [logs, total] = await Promise.all([
    prisma.notificationLog.findMany({
      where,
      include: {
        webhookConfig: { select: { id: true, name: true } },
        sentBy: { select: { id: true, name: true } },
      },
      orderBy: { sentAt: 'desc' },
      skip: (page - 1) * limit,
      take: limit,
    }),
    prisma.notificationLog.count({ where }),
  ]);

  return sendPaginated(res, logs, total, page, limit);
});

router.post('/resend/:logId', authMiddleware, requireAnyPermission('webhooks:manage', 'notifications:send'), async (req: AuthRequest, res: Response) => {
  try {
    const logId = getParam(req.params.logId);
    if (!logId) return sendError(res, 'logId invalido', 400);

    await assertWebhookLogResendAllowed(req.user!, logId);
    const result = await resendNotification(logId, req.user!.id);
    return sendSuccess(res, result, 'Notificación reenviada');
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Error al reenviar';
    const status = /fuera de tu sede|ámbito/i.test(message) ? 403 : 400;
    return sendError(res, message, status);
  }
});

router.post('/friday-summary', authMiddleware, requireAnyPermission('webhooks:manage', 'notifications:send'), async (req: AuthRequest, res: Response) => {
  try {
    const { webhookConfigIds } = req.body;
    const rawIds: string[] | undefined = Array.isArray(webhookConfigIds) ? webhookConfigIds : undefined;
    const ids = await resolveFridaySummaryWebhookIds(req.user!, rawIds);
    const results = await sendFridaySummary(req.user!.id, ids);
    return sendSuccess(res, { sent: results.length }, `Resumen enviado a ${results.length} webhook(s)`);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Error al enviar resumen';
    const status = /ámbito/i.test(message) ? 403 : 500;
    return sendError(res, message, status);
  }
});

router.post('/absence-summary', authMiddleware, requireAnyPermission('webhooks:manage', 'notifications:send'), async (req: AuthRequest, res: Response) => {
  try {
    const { webhookConfigIds } = req.body;
    const rawIds: string[] | undefined = Array.isArray(webhookConfigIds) ? webhookConfigIds : undefined;
    const ids = await resolveAbsenceSummaryWebhookIds(req.user!, rawIds);
    const results = await sendMondayAbsenceSummary(req.user!.id, ids);
    return sendSuccess(res, { sent: results.length }, `Resumen de ausencias enviado a ${results.length} webhook(s)`);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Error al enviar resumen';
    const status = /ámbito/i.test(message) ? 403 : 500;
    return sendError(res, message, status);
  }
});

router.post('/announce', authMiddleware, requireAnyPermission('webhooks:manage', 'notifications:send'), async (req: AuthRequest, res: Response) => {
  const { message, webhookConfigIds } = req.body;
  if (!message) return sendError(res, 'Mensaje requerido', 400);

  const card = buildAnnouncementCard(message, req.user!.name);

  try {
    const ids = Array.isArray(webhookConfigIds) ? (webhookConfigIds as string[]) : undefined;
    const webhooks = await findWebhooksForManualAnnounce(req.user!, ids);

    const results = [];
    for (const wh of webhooks) {
      const result = await sendToWebhook({
        webhookConfigId: wh.id,
        webhookUrl: wh.webhookUrl,
        payload: card,
        type: 'manual_announcement',
        message,
        sentByUserId: req.user!.id,
      });
      results.push(result);
    }

    return sendSuccess(res, { sent: results.length }, 'Anuncio enviado');
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Error al enviar anuncio';
    const status = /ámbito/i.test(msg) ? 403 : 500;
    return sendError(res, msg, status);
  }
});

export default router;
