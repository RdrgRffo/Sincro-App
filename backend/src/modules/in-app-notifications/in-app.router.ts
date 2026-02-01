import { Router, Response } from 'express';
import { authMiddleware, AuthRequest } from '../../middleware/auth.middleware';
import { sendSuccess, sendError, sendPaginated } from '../../utils/response';
import {
  getUnreadNotifications,
  getUserNotifications,
  markAsRead,
  markAllAsRead,
  countUnread,
  deleteNotification,
  deleteAllNotifications,
} from './in-app.service';

const router = Router();

// Todas las rutas requieren autenticación (cualquier rol, incluso employee)
// GET /api/in-app-notifications/unread-count - Contador de no leídas
router.get('/unread-count', authMiddleware, async (req: AuthRequest, res: Response) => {
  const count = await countUnread(req.user!.id);
  return sendSuccess(res, { count });
});

// GET /api/in-app-notifications/unread - No leídas
router.get('/unread', authMiddleware, async (req: AuthRequest, res: Response) => {
  const notifications = await getUnreadNotifications(req.user!.id);
  return sendSuccess(res, notifications);
});

// GET /api/in-app-notifications - Todas (paginadas)
router.get('/', authMiddleware, async (req: AuthRequest, res: Response) => {
  const page = parseInt(req.query.page as string) || 1;
  const pageSize = Math.min(parseInt(req.query.pageSize as string) || 20, 50);
  const result = await getUserNotifications(req.user!.id, page, pageSize);
  return sendPaginated(res, result.items, result.total, result.page, result.pageSize);
});

// PATCH /api/in-app-notifications/:id/read - Marcar como leída
router.patch('/:id/read', authMiddleware, async (req: AuthRequest, res: Response) => {
  const id = req.params.id as string;
  if (!id) return sendError(res, 'ID de notificación inválido', 400);

  const result = await markAsRead(id, req.user!.id);
  if (result.count === 0) return sendError(res, 'Notificación no encontrada', 404);
  return sendSuccess(res, null, 'Notificación marcada como leída');
});

// POST /api/in-app-notifications/read-all - Marcar todas como leídas
router.post('/read-all', authMiddleware, async (req: AuthRequest, res: Response) => {
  const result = await markAllAsRead(req.user!.id);
  return sendSuccess(res, { count: result.count }, 'Todas las notificaciones marcadas como leídas');
});

// DELETE /api/in-app-notifications - Eliminar todas las notificaciones propias
router.delete('/', authMiddleware, async (req: AuthRequest, res: Response) => {
  const result = await deleteAllNotifications(req.user!.id);
  return sendSuccess(res, { count: result.count }, 'Todas las notificaciones eliminadas');
});

// DELETE /api/in-app-notifications/:id - Eliminar notificación propia
router.delete('/:id', authMiddleware, async (req: AuthRequest, res: Response) => {
  const id = req.params.id as string;
  if (!id) return sendError(res, 'ID de notificación inválido', 400);

  const result = await deleteNotification(id, req.user!.id);
  if (result.count === 0) return sendError(res, 'Notificación no encontrada', 404);
  return sendSuccess(res, null, 'Notificación eliminada');
});

export default router;
