import { Router, Response } from 'express';
import { authMiddleware, AuthRequest } from '../../middleware/auth.middleware';
import { requirePermission } from '../../middleware/permission.middleware';
import {
  addCommentController,
  getAvailabilityController,
  getAvailabilityMatrixController,
  getCoverageRisksController,
  getCrisisModeController,
  getEquityController,
  getNotificationPreferencesController,
  getAbsenceImpactController,
  getSubstituteSuggestionsController,
  getTemplatePreviewController,
  getTimelineController,
  listCommentsController,
  updateNotificationPreferencesController,
} from './planning.controller';

const router = Router();

router.get(
  '/coverage-risks',
  authMiddleware,
  requirePermission('planning:view'),
  (req: AuthRequest, res: Response) => getCoverageRisksController(req, res),
);

router.get(
  '/availability',
  authMiddleware,
  requirePermission('planning:view'),
  (req: AuthRequest, res: Response) => getAvailabilityController(req, res),
);

router.get(
  '/substitutes',
  authMiddleware,
  requirePermission('planning:view'),
  (req: AuthRequest, res: Response) => getSubstituteSuggestionsController(req, res),
);

router.get(
  '/availability-matrix',
  authMiddleware,
  requirePermission('planning:view'),
  (req: AuthRequest, res: Response) => getAvailabilityMatrixController(req, res),
);

router.get(
  '/equity',
  authMiddleware,
  requirePermission('planning:view'),
  (req: AuthRequest, res: Response) => getEquityController(req, res),
);

router.get(
  '/timeline',
  authMiddleware,
  requirePermission('planning:view'),
  (req: AuthRequest, res: Response) => getTimelineController(req, res),
);

router.get(
  '/crisis',
  authMiddleware,
  requirePermission('planning:view'),
  (req: AuthRequest, res: Response) => getCrisisModeController(req, res),
);

router.get(
  '/absence-impact',
  authMiddleware,
  requirePermission('absences:read'),
  (req: AuthRequest, res: Response) => getAbsenceImpactController(req, res),
);

router.get(
  '/template-preview',
  authMiddleware,
  requirePermission('planning:view'),
  (req: AuthRequest, res: Response) => getTemplatePreviewController(req, res),
);

router.get(
  '/comments',
  authMiddleware,
  requirePermission('planning:view'),
  (req: AuthRequest, res: Response) => listCommentsController(req, res),
);

router.post(
  '/comments',
  authMiddleware,
  requirePermission('schedules:create'),
  (req: AuthRequest, res: Response) => addCommentController(req, res),
);

router.get(
  '/notification-preferences',
  authMiddleware,
  (req: AuthRequest, res: Response) => getNotificationPreferencesController(req, res),
);

router.patch(
  '/notification-preferences',
  authMiddleware,
  (req: AuthRequest, res: Response) => updateNotificationPreferencesController(req, res),
);

export default router;
