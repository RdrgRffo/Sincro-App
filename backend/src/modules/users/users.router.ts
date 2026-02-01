import { Router, Response, NextFunction, Request } from 'express';
import multer, { MulterError } from 'multer';
import { authMiddleware, AuthRequest } from '../../middleware/auth.middleware';
import { requirePermission } from '../../middleware/permission.middleware';
import {
  changeUserRoleController,
  changeUserStatusController,
  createUserController,
  deleteUserController,
  getUserController,
  listUserSchedulesController,
  listUsersController,
  forcePasswordChangeController,
  reactivateUserController,
  resetPasswordController,
  updateUserController,
  importUsersCsvController,
} from './users.controller';
import { adminPasswordRateLimiter } from '../auth/auth.rate-limit';
import { CSV_IMPORT_MAX_FILE_SIZE_BYTES } from './users.constants';
import { sendError } from '../../utils/response';

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: CSV_IMPORT_MAX_FILE_SIZE_BYTES },
  fileFilter: (_req, file, cb) => {
    const allowed = ['text/csv', 'application/vnd.ms-excel', 'application/csv', 'text/plain'];
    if (allowed.includes(file.mimetype) || file.originalname.toLowerCase().endsWith('.csv')) {
      cb(null, true);
    } else {
      cb(new Error('Solo se permiten archivos CSV'));
    }
  },
});

/** Middleware que convierte errores de multer en respuestas JSON normalizadas. */
function handleMulterError(err: unknown, _req: Request, res: Response, next: NextFunction) {
  if (err instanceof MulterError) {
    if (err.code === 'LIMIT_FILE_SIZE') {
      return sendError(res, `El archivo supera el límite máximo de ${CSV_IMPORT_MAX_FILE_SIZE_BYTES / 1024 / 1024} MB`, 413);
    }
    return sendError(res, `Error al procesar el archivo: ${err.message}`, 400);
  }
  if (err instanceof Error) {
    return sendError(res, err.message, 400);
  }
  return next(err);
}


const router = Router();

// List users
router.get('/', authMiddleware, requirePermission('users:view'), (req: AuthRequest, res: Response) => listUsersController(req, res));

// Get single user
router.get('/:id', authMiddleware, requirePermission('users:view'), (req: AuthRequest, res: Response) => getUserController(req, res));

// Import CSV
router.post('/import', authMiddleware, requirePermission('users:create'), upload.single('file'), handleMulterError, (req: AuthRequest, res: Response) => importUsersCsvController(req, res));


// Create user
router.post('/', authMiddleware, requirePermission('users:create'), (req: AuthRequest, res: Response) => createUserController(req, res));

// Update user
router.patch('/:id', authMiddleware, requirePermission('users:update'), (req: AuthRequest, res: Response) => updateUserController(req, res));

// Change status
router.patch('/:id/status', authMiddleware, requirePermission('users:update'), (req: AuthRequest, res: Response) => changeUserStatusController(req, res));

// Change role
router.patch('/:id/role', authMiddleware, requirePermission('users:update'), (req: AuthRequest, res: Response) => changeUserRoleController(req, res));

// Reset password
router.post('/:id/reset-password', authMiddleware, requirePermission('users:update'), adminPasswordRateLimiter, (req: AuthRequest, res: Response) => resetPasswordController(req, res));

// Force password change without resetting password
router.post('/:id/force-password-change', authMiddleware, requirePermission('users:update'), adminPasswordRateLimiter, (req: AuthRequest, res: Response) => forcePasswordChangeController(req, res));

// Soft delete user
router.delete('/:id', authMiddleware, requirePermission('users:delete'), (req: AuthRequest, res: Response) => deleteUserController(req, res));

// Reactivate user (restore inactive user)
router.post('/:id/reactivate', authMiddleware, requirePermission('users:update'), (req: AuthRequest, res: Response) => reactivateUserController(req, res));

// Get user schedules
router.get('/:id/schedules', authMiddleware, requirePermission('schedules:view'), (req: AuthRequest, res: Response) => listUserSchedulesController(req, res));

export default router;
