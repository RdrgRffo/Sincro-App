import { Router, Response } from 'express';
import { authMiddleware, AuthRequest } from '../../middleware/auth.middleware';
import { requirePermission } from '../../middleware/permission.middleware';
import {
  createScheduleBulkController,
  createScheduleController,
  deleteScheduleController,
  getMyWeeklySummaryController,
  getScheduleAlertsController,
  getScheduleController,
  getTeamWeeklySummaryController,
  getWeeklySummariesController,
  getWeeklySummaryController,
  listSchedulesController,
  listWeekSchedulesController,
  updateScheduleController,
} from './schedules.controller';

const router = Router();

// Get schedules in date range
router.get('/', authMiddleware, requirePermission('schedules:view'), (req: AuthRequest, res: Response) => listSchedulesController(req, res));

// Get weekly schedules
router.get('/week/:year/:week', authMiddleware, requirePermission('schedules:view'), (req: AuthRequest, res: Response) => listWeekSchedulesController(req, res));

// My weekly work summary (authenticated user)
router.get('/weekly-summary/me/:year/:week', authMiddleware, requirePermission('schedules:view'), (req: AuthRequest, res: Response) => getMyWeeklySummaryController(req, res));

// Weekly work summary (single week)
router.get('/my-weekly-summary/:year/:week', authMiddleware, requirePermission('schedules:view'), (req: AuthRequest, res: Response) => getMyWeeklySummaryController(req, res));

// Legacy alias kept for compatibility
router.get('/weekly-summary/:userId/:year/:week', authMiddleware, requirePermission('schedules:view'), (req: AuthRequest, res: Response) => getWeeklySummaryController(req, res));

// Weekly work summaries (range)
router.get('/weekly-summary/:userId/:year', authMiddleware, requirePermission('schedules:view'), (req: AuthRequest, res: Response) => getWeeklySummariesController(req, res));

// Team weekly summary (admin/manager view)
router.get('/team-weekly-summary/:year/:week', authMiddleware, requirePermission('schedules:view'), (req: AuthRequest, res: Response) => getTeamWeeklySummaryController(req, res));

// Get schedule alerts (unassigned/solo)
router.get('/alerts', authMiddleware, requirePermission('schedules:view'), (req: AuthRequest, res: Response) => getScheduleAlertsController(req, res));

// Get single schedule
router.get('/:id', authMiddleware, requirePermission('schedules:view'), (req: AuthRequest, res: Response) => getScheduleController(req, res));

// Create schedule
router.post('/', authMiddleware, requirePermission('schedules:create'), (req: AuthRequest, res: Response) => createScheduleController(req, res));

// Bulk create schedules
router.post('/bulk', authMiddleware, requirePermission('schedules:create'), (req: AuthRequest, res: Response) => createScheduleBulkController(req, res));

// Update schedule
router.patch('/:id', authMiddleware, requirePermission('schedules:update'), (req: AuthRequest, res: Response) => updateScheduleController(req, res));

// Delete schedule
router.delete('/:id', authMiddleware, requirePermission('schedules:delete'), (req: AuthRequest, res: Response) => deleteScheduleController(req, res));

export default router;
