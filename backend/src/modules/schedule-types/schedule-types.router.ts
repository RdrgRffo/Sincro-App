import { Router } from 'express';
import { authMiddleware } from '../../middleware/auth.middleware';
import { requirePermission } from '../../middleware/permission.middleware';
import { SCHEDULE_TYPE_PERMISSIONS } from './schedule-types.constants';
import {
  listScheduleTypes,
  getScheduleType,
  createScheduleTypeController,
  updateScheduleTypeController,
  deleteScheduleTypeController,
  reactivateScheduleTypeController,
} from './schedule-types.controller';

const router = Router();

// GET /schedule-types - List all active schedule types
router.get('/', authMiddleware, requirePermission(SCHEDULE_TYPE_PERMISSIONS.READ), listScheduleTypes);

// GET /schedule-types/:id - Get schedule type by ID
router.get('/:id', authMiddleware, requirePermission(SCHEDULE_TYPE_PERMISSIONS.READ), getScheduleType);

// POST /schedule-types - Create new schedule type
router.post(
  '/',
  authMiddleware,
  requirePermission(SCHEDULE_TYPE_PERMISSIONS.CREATE),
  createScheduleTypeController,
);

// PUT /schedule-types/:id - Update schedule type
router.put(
  '/:id',
  authMiddleware,
  requirePermission(SCHEDULE_TYPE_PERMISSIONS.UPDATE),
  updateScheduleTypeController,
);

// DELETE /schedule-types/:id - Soft delete schedule type
router.delete(
  '/:id',
  authMiddleware,
  requirePermission(SCHEDULE_TYPE_PERMISSIONS.DELETE),
  deleteScheduleTypeController,
);

// PATCH /schedule-types/:id/reactivate - Reactivate a soft-deleted schedule type
router.patch(
  '/:id/reactivate',
  authMiddleware,
  requirePermission(SCHEDULE_TYPE_PERMISSIONS.UPDATE),
  reactivateScheduleTypeController,
);

export default router;
