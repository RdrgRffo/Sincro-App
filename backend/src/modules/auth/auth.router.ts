import { Router } from 'express';
import { authMiddleware, AuthRequest } from '../../middleware/auth.middleware';
import {
  changePasswordController,
  loginController,
  logoutController,
  meController,
  refreshController,
} from './auth.controller';
import { loginRateLimiter, refreshRateLimiter, changePasswordRateLimiter } from './auth.rate-limit';

const router = Router();

router.post('/login', loginRateLimiter, loginController);
router.post('/refresh', refreshRateLimiter, refreshController);
router.post('/logout', authMiddleware, (req: AuthRequest, res) => logoutController(req, res));
router.get('/me', authMiddleware, (req: AuthRequest, res) => meController(req, res));
router.patch('/change-password', authMiddleware, changePasswordRateLimiter, (req: AuthRequest, res) => changePasswordController(req, res));

export default router;
