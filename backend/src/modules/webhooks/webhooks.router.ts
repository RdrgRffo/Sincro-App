import { Router, Response, NextFunction, RequestHandler } from 'express';
import { z } from 'zod';
import { authMiddleware, AuthRequest } from '../../middleware/auth.middleware';
import { requirePermission } from '../../middleware/permission.middleware';
import { sendSuccess, sendError } from '../../utils/response';
import { prisma } from '../../config/database';
import { sendToWebhook } from '../notifications/notifications.service';
import { buildTestCard } from '../notifications/notifications.templates';
import { createWebhook, updateWebhook, deleteWebhook } from './webhooks.service';
import { canBypassWebhookScope, webhookBranchScopeWhere } from './webhooks.access';

const router = Router();

const getParam = (value: string | string[] | undefined): string | undefined => (
  Array.isArray(value) ? value[0] : value
);

const asyncRoute = (handler: RequestHandler): RequestHandler => {
  return (req, res, next) => {
    Promise.resolve(handler(req, res, next)).catch(next);
  };
};

function isPrismaColumnTooLongError(error: unknown, columnName: string): boolean {
  if (!error || typeof error !== 'object') {
    return false;
  }

  const candidate = error as {
    code?: unknown;
    meta?: { target?: unknown };
    message?: unknown;
  };

  if (candidate.code !== 'P2000') {
    return false;
  }

  const target = candidate.meta?.target;
  if (Array.isArray(target)) {
    return target.some((item) => String(item).toLowerCase().includes(columnName.toLowerCase()));
  }

  if (typeof target === 'string') {
    return target.toLowerCase().includes(columnName.toLowerCase());
  }

  return typeof candidate.message === 'string' && candidate.message.toLowerCase().includes(columnName.toLowerCase());
}

function handleWebhookPersistenceError(error: unknown, res: Response): boolean {
  if (isPrismaColumnTooLongError(error, 'webhook_url')) {
    sendError(
      res,
      'La URL del webhook es demasiado larga para el almacenamiento actual',
      400,
      { fieldErrors: { webhookUrl: ['URL demasiado larga'] } },
      'BAD_REQUEST'
    );
    return true;
  }

  return false;
}

const webhookSchema = z
  .object({
    name: z.string().min(2),
    webhookUrl: z.string().url('URL inválida'),
    enabled: z.boolean().default(true),
    notifyModifications: z.boolean().default(true),
    notifyLastMinute: z.boolean().default(true),
    fridayReminderEnabled: z.boolean().default(true),
    mondayAbsenceReminderEnabled: z.boolean().default(true),
    fridayReminderTime: z.string().default('12:00'),
    departmentId: z.string().optional(),
    branchId: z.string().optional(),
  })
  .transform((d) => ({
    ...d,
    departmentId: d.departmentId?.trim() || undefined,
    branchId: d.branchId?.trim() || undefined,
  }));

/** PATCH: campos opcionales; sucursal+departamento se validan en el servicio. */
const webhookUpdateSchema = z.object({
  name: z.string().min(2).optional(),
  webhookUrl: z.string().url('URL inválida').optional(),
  enabled: z.boolean().optional(),
  notifyModifications: z.boolean().optional(),
  notifyLastMinute: z.boolean().optional(),
  fridayReminderEnabled: z.boolean().optional(),
  mondayAbsenceReminderEnabled: z.boolean().optional(),
  fridayReminderTime: z.string().optional(),
  departmentId: z.string().optional(),
  branchId: z.string().optional(),
});

router.get('/', authMiddleware, requirePermission('webhooks:view'), asyncRoute(async (req: AuthRequest, res: Response) => {
  const where = canBypassWebhookScope(req.user!) ? {} : webhookBranchScopeWhere(req.user!);
  const webhooks = await prisma.webhookConfig.findMany({
    where,
    orderBy: { createdAt: 'desc' },
    include: {
      department: { select: { id: true, name: true } },
      branch: { select: { id: true, name: true } },
    },
  });
  return sendSuccess(res, webhooks);
}));

router.post('/', authMiddleware, requirePermission('webhooks:manage'), asyncRoute(async (req: AuthRequest, res: Response, next: NextFunction) => {
  const parsed = webhookSchema.safeParse(req.body);
  if (!parsed.success) return sendError(res, 'Datos inválidos', 400, parsed.error.flatten(), 'BAD_REQUEST');

  try {
    const webhook = await createWebhook(parsed.data, req.user!.id, req.ip);
    return sendSuccess(res, webhook, 'Webhook creado', 201);
  } catch (error) {
    if (handleWebhookPersistenceError(error, res)) {
      return;
    }
    return next(error);
  }
}));

router.patch('/:id', authMiddleware, requirePermission('webhooks:manage'), asyncRoute(async (req: AuthRequest, res: Response, next: NextFunction) => {
  const id = getParam(req.params.id);
  if (!id) return sendError(res, 'ID de webhook invalido', 400, null, 'BAD_REQUEST');

  const parsed = webhookUpdateSchema.safeParse(req.body);
  if (!parsed.success) return sendError(res, 'Datos inválidos', 400, parsed.error.flatten(), 'BAD_REQUEST');

  try {
    const webhook = await updateWebhook(id, parsed.data, req.user!.id, req.ip);
    return sendSuccess(res, webhook, 'Webhook actualizado');
  } catch (error) {
    if (handleWebhookPersistenceError(error, res)) {
      return;
    }
    return next(error);
  }
}));

router.delete('/:id', authMiddleware, requirePermission('webhooks:manage'), asyncRoute(async (req: AuthRequest, res: Response) => {
  const id = getParam(req.params.id);
  if (!id) return sendError(res, 'ID de webhook invalido', 400, null, 'BAD_REQUEST');

  await deleteWebhook(id, req.user!.id, req.ip);
  return sendSuccess(res, null, 'Webhook eliminado');
}));

router.post('/:id/test', authMiddleware, requirePermission('webhooks:manage'), asyncRoute(async (req: AuthRequest, res: Response) => {
  const id = getParam(req.params.id);
  if (!id) return sendError(res, 'ID de webhook invalido', 400, null, 'BAD_REQUEST');

  const webhook = await prisma.webhookConfig.findUnique({ where: { id } });
  if (!webhook) return sendError(res, 'Webhook no encontrado', 404);

  const card = buildTestCard(webhook.name);
  const result = await sendToWebhook({
    webhookConfigId: webhook.id,
    webhookUrl: webhook.webhookUrl,
    payload: card,
    type: 'test',
    message: `Prueba de webhook: ${webhook.name}`,
    sentByUserId: req.user!.id,
  });

  if (result.status === 'failed') {
    return sendError(res, `Error al enviar: ${result.errorMessage}`, 500);
  }
  return sendSuccess(res, null, 'Mensaje de prueba enviado correctamente');
}));

export default router;
