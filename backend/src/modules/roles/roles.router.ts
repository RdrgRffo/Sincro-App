import { Router, Response } from 'express';
import { authMiddleware, AuthRequest } from '../../middleware/auth.middleware';
import { requirePermission } from '../../middleware/permission.middleware';
import * as ctrl from './roles.controller';

const router = Router();

router.get('/permissions', authMiddleware, requirePermission('settings:view'), (req: AuthRequest, res: Response) => ctrl.listPermissionsController(req, res));
router.get('/', authMiddleware, requirePermission('settings:view'), (req: AuthRequest, res: Response) => ctrl.listRolesController(req, res));
router.get('/:id', authMiddleware, requirePermission('settings:view'), (req: AuthRequest, res: Response) => ctrl.getRoleController(req, res));
router.post('/', authMiddleware, requirePermission('settings:manage'), (req: AuthRequest, res: Response) => ctrl.createRoleController(req, res));
router.patch('/:id', authMiddleware, requirePermission('settings:manage'), (req: AuthRequest, res: Response) => ctrl.updateRoleController(req, res));
router.delete('/:id', authMiddleware, requirePermission('settings:manage'), (req: AuthRequest, res: Response) => ctrl.deleteRoleController(req, res));

export default router;
