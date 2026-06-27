/**
 * @file auth.router.test.ts
 * Tests del router de autenticación: login, refresh, logout, me, change-password.
 */

import express from 'express';
import request from 'supertest';

jest.mock('../../src/middleware/auth.middleware', () => {
  const { DEFAULT_ROLE_PERMISSIONS } = require('../../src/modules/roles/roles.constants');
  return {
    authMiddleware: (req: any, res: any, next: any) => {
      const role = req.header('x-test-role') as any;

      if (!role) {
        return res.status(401).json({
          success: false,
          error: 'Token de acceso requerido',
          code: 'UNAUTHORIZED',
        });
      }

      const permissions = DEFAULT_ROLE_PERMISSIONS[role] || [];
      req.user = {
        id: 'test-user',
        roleName: role,
        permissions,
        name: 'Test User',
        email: 'test@example.com',
        branchId: 'b-1',
        departmentId: 'dept-1',
        status: 'active',
      };
      next();
    },
  };
});

jest.mock('../../src/modules/auth/auth.service', () => ({
  login: jest.fn(),
  refreshTokens: jest.fn(),
  logout: jest.fn(),
  getMe: jest.fn(),
  changePassword: jest.fn(),
}));

jest.mock('../../src/modules/audit/audit.service', () => ({
  logAudit: jest.fn(),
}));

import authRouter from '../../src/modules/auth/auth.router';
import * as authService from '../../src/modules/auth/auth.service';

const mockService = authService as jest.Mocked<typeof authService>;

const app = express();
app.use(express.json());
app.use('/api/auth', authRouter);

describe('auth.router', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('POST /login', () => {
    it('returns 200 with tokens on valid login', async () => {
      mockService.login.mockResolvedValue({
        user: { id: 'user-1', name: 'Test', email: 'test@test.com' } as any,
        accessToken: 'access-token',
        refreshToken: 'refresh-token',
      });

      const response = await request(app)
        .post('/api/auth/login')
        .send({ email: 'test@test.com', password: 'password123' });

      expect(response.status).toBe(200);
      expect(mockService.login).toHaveBeenCalledTimes(1);
    });

    it('returns 400 when missing credentials', async () => {
      const response = await request(app)
        .post('/api/auth/login')
        .send({});

      expect(response.status).toBe(400);
      expect(mockService.login).not.toHaveBeenCalled();
    });

    it('returns 400 when missing password', async () => {
      const response = await request(app)
        .post('/api/auth/login')
        .send({ email: 'test@test.com' });

      expect(response.status).toBe(400);
      expect(mockService.login).not.toHaveBeenCalled();
    });
  });

  describe('POST /refresh', () => {
    it('returns 200 with new tokens', async () => {
      mockService.refreshTokens.mockResolvedValue({
        accessToken: 'new-access-token',
        refreshToken: 'new-refresh-token',
      });

      const response = await request(app)
        .post('/api/auth/refresh')
        .send({ refreshToken: 'valid-refresh-token' });

      expect(response.status).toBe(200);
      expect(mockService.refreshTokens).toHaveBeenCalledTimes(1);
    });

    it('returns 400 when refresh token is missing', async () => {
      const response = await request(app)
        .post('/api/auth/refresh')
        .send({});

      expect(response.status).toBe(400);
      expect(mockService.refreshTokens).not.toHaveBeenCalled();
    });
  });

  describe('POST /logout', () => {
    it('returns 200 for authenticated user', async () => {
      mockService.logout.mockResolvedValue(undefined);

      const response = await request(app)
        .post('/api/auth/logout')
        .set('x-test-role', 'admin')
        .send({ refreshToken: 'some-token' });

      expect(response.status).toBe(200);
      expect(mockService.logout).toHaveBeenCalledTimes(1);
    });

    it('returns 200 even without refreshToken', async () => {
      const response = await request(app)
        .post('/api/auth/logout')
        .set('x-test-role', 'admin')
        .send({});

      expect(response.status).toBe(200);
      expect(mockService.logout).not.toHaveBeenCalled();
    });

    it('returns 401 when not authenticated', async () => {
      const response = await request(app)
        .post('/api/auth/logout');

      expect(response.status).toBe(401);
      expect(mockService.logout).not.toHaveBeenCalled();
    });
  });

  describe('GET /me', () => {
    it('returns 200 with user profile', async () => {
      mockService.getMe.mockResolvedValue({
        id: 'test-user',
        name: 'Test User',
        email: 'test@example.com',
      } as any);

      const response = await request(app)
        .get('/api/auth/me')
        .set('x-test-role', 'admin');

      expect(response.status).toBe(200);
      expect(mockService.getMe).toHaveBeenCalledTimes(1);
    });

    it('returns 401 when not authenticated', async () => {
      const response = await request(app)
        .get('/api/auth/me');

      expect(response.status).toBe(401);
      expect(mockService.getMe).not.toHaveBeenCalled();
    });
  });

  describe('PATCH /change-password', () => {
    it('returns 200 on successful password change', async () => {
      mockService.changePassword.mockResolvedValue(undefined);

      const response = await request(app)
        .patch('/api/auth/change-password')
        .set('x-test-role', 'admin')
        .send({ currentPassword: 'oldpass', newPassword: 'newpassword123' });

      expect(response.status).toBe(200);
      expect(mockService.changePassword).toHaveBeenCalledTimes(1);
    });

    it('returns 400 for short new password', async () => {
      const response = await request(app)
        .patch('/api/auth/change-password')
        .set('x-test-role', 'admin')
        .send({ currentPassword: 'oldpass', newPassword: '123' });

      expect(response.status).toBe(400);
      expect(mockService.changePassword).not.toHaveBeenCalled();
    });

    it('returns 401 when not authenticated', async () => {
      const response = await request(app)
        .patch('/api/auth/change-password')
        .send({ currentPassword: 'oldpass', newPassword: 'newpassword123' });

      expect(response.status).toBe(401);
      expect(mockService.changePassword).not.toHaveBeenCalled();
    });
  });
});
