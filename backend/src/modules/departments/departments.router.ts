import { Router, Response } from 'express';
import { authMiddleware, AuthRequest } from '../../middleware/auth.middleware';
import { requirePermission } from '../../middleware/permission.middleware';
import {
  assignDepartmentManagerController,
  createDepartmentController,
  deleteDepartmentController,
  hardDeleteDepartmentController,
  listDepartmentsController,
  listDepartmentBranchesController,
  listDepartmentMembersController,
  reactivateDepartmentController,
  removeDepartmentManagerController,
  updateDepartmentController,
} from './departments.controller';

const router = Router();

router.get('/', authMiddleware, requirePermission('departments:view'), (req: AuthRequest, res: Response) => listDepartmentsController(req, res));
router.get('/:departmentId/branches', authMiddleware, requirePermission('departments:view'), (req: AuthRequest, res: Response) => listDepartmentBranchesController(req, res));
router.get('/:departmentId/members', authMiddleware, requirePermission('departments:view'), (req: AuthRequest, res: Response) => listDepartmentMembersController(req, res));
router.post('/', authMiddleware, requirePermission('departments:create'), (req: AuthRequest, res: Response) => createDepartmentController(req, res));
router.patch('/:departmentId', authMiddleware, requirePermission('departments:update'), (req: AuthRequest, res: Response) => updateDepartmentController(req, res));
router.delete('/:departmentId', authMiddleware, requirePermission('departments:delete'), (req: AuthRequest, res: Response) => deleteDepartmentController(req, res));
router.patch('/:departmentId/reactivate', authMiddleware, requirePermission('departments:update'), (req: AuthRequest, res: Response) => reactivateDepartmentController(req, res));
router.delete('/:departmentId/permanent', authMiddleware, requirePermission('departments:delete'), (req: AuthRequest, res: Response) => hardDeleteDepartmentController(req, res));
router.patch('/:departmentId/manager', authMiddleware, requirePermission('departments:update'), (req: AuthRequest, res: Response) => assignDepartmentManagerController(req, res));
router.delete('/:departmentId/manager', authMiddleware, requirePermission('departments:update'), (req: AuthRequest, res: Response) => removeDepartmentManagerController(req, res));

export default router;
