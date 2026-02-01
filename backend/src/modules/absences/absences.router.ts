import { Router, Response } from 'express';
import { authMiddleware, AuthRequest } from '../../middleware/auth.middleware';
import { requirePermission } from '../../middleware/permission.middleware';
import { ABSENCE_PERMISSIONS } from './absences.constants';
import {
  listAbsencesController,
  getAbsenceController,
  createAbsenceController,
  approveAbsenceController,
  rejectAbsenceController,
  cancelAbsenceController,
  getAbsenceCalendarController,
} from './absences.controller';

const router = Router();

// GET /api/absences/calendar — antes de /:id
router.get('/calendar', authMiddleware, requirePermission(ABSENCE_PERMISSIONS.READ), (req: AuthRequest, res: Response) => getAbsenceCalendarController(req, res));

router.get('/', authMiddleware, requirePermission(ABSENCE_PERMISSIONS.READ), (req: AuthRequest, res: Response) => listAbsencesController(req, res));

router.get('/:id', authMiddleware, requirePermission(ABSENCE_PERMISSIONS.READ), (req: AuthRequest, res: Response) => getAbsenceController(req, res));

router.post('/', authMiddleware, requirePermission(ABSENCE_PERMISSIONS.CREATE), (req: AuthRequest, res: Response) => createAbsenceController(req, res));

router.patch('/:id/approve', authMiddleware, requirePermission(ABSENCE_PERMISSIONS.APPROVE), (req: AuthRequest, res: Response) => approveAbsenceController(req, res));

router.patch('/:id/reject', authMiddleware, requirePermission(ABSENCE_PERMISSIONS.APPROVE), (req: AuthRequest, res: Response) => rejectAbsenceController(req, res));

router.delete('/:id', authMiddleware, requirePermission(ABSENCE_PERMISSIONS.CANCEL), (req: AuthRequest, res: Response) => cancelAbsenceController(req, res));

export default router;
