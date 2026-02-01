import { Router } from 'express';
import { authMiddleware } from '../../middleware/auth.middleware';
import { requirePermission } from '../../middleware/permission.middleware';
import { getAuditLogController, listAuditLogsController, rollbackAuditController, exportAuditLogsCsvController } from './audit.controller';

const router = Router();

router.get('/', authMiddleware, requirePermission('audit:view'), listAuditLogsController);
router.get('/export/csv', authMiddleware, requirePermission('audit:view'), exportAuditLogsCsvController);
router.get('/:id', authMiddleware, requirePermission('audit:view'), getAuditLogController);
router.post('/:id/rollback', authMiddleware, requirePermission('settings:update'), rollbackAuditController);

export default router;
