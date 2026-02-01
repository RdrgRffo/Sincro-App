import { Router } from 'express';
import { authMiddleware } from '../../middleware/auth.middleware';
import { requirePermission } from '../../middleware/permission.middleware';
import {
  listShiftPresetsController,
  getShiftPresetController,
  createShiftPresetController,
  updateShiftPresetController,
  deleteShiftPresetController,
  reactivateShiftPresetController,
  applyShiftPresetController,
  previewShiftPresetController,
} from './shift-presets.controller';

const router = Router();

router.use(authMiddleware);

router.get('/', requirePermission('shift_presets:read'), listShiftPresetsController);
router.get('/:id', requirePermission('shift_presets:read'), getShiftPresetController);
router.post('/', requirePermission('shift_presets:create'), createShiftPresetController);
router.patch('/:id', requirePermission('shift_presets:update'), updateShiftPresetController);
router.delete('/:id', requirePermission('shift_presets:delete'), deleteShiftPresetController);
router.patch('/:id/reactivate', requirePermission('shift_presets:update'), reactivateShiftPresetController);
router.post('/:id/apply', requirePermission('shift_presets:create'), applyShiftPresetController);
router.post('/:id/preview', requirePermission('shift_presets:read'), previewShiftPresetController);

export default router;
