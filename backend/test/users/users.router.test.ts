/**
 * @file users.router.test.ts
 * Tests del router de usuarios: autenticación, permisos, validación de body.
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

jest.mock('../../src/modules/users/users.service', () => ({
  getUsersList: jest.fn(),
  getUserById: jest.fn(),
  createUser: jest.fn(),
  updateUser: jest.fn(),
  changeUserStatus: jest.fn(),
  changeUserRole: jest.fn(),
  resetUserPassword: jest.fn(),
  forceUserPasswordChange: jest.fn(),
  deleteUser: jest.fn(),
  getUserSchedules: jest.fn(),
  importUsersCsv: jest.fn(),
}));

import usersRouter from '../../src/modules/users/users.router';
import * as usersService from '../../src/modules/users/users.service';
import { createAppError } from '../../src/common/errors/error-catalog';

const mockService = usersService as jest.Mocked<typeof usersService>;

const app = express();
app.use(express.json());
app.use('/api/users', usersRouter);

const validUserItem = {
  name: 'Juan Perez',
  email: 'juan@test.com',
  password: 'password123',
  branchId: 'b-1',
};

describe('users.router', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('GET /', () => {
    it('returns 200 for admin', async () => {
      mockService.getUsersList.mockResolvedValue({ users: [], total: 0 });

      const response = await request(app)
        .get('/api/users')
        .set('x-test-role', 'admin');

      expect(response.status).toBe(200);
      expect(mockService.getUsersList).toHaveBeenCalledTimes(1);
    });

    it('returns 200 for employee (has users:view)', async () => {
      mockService.getUsersList.mockResolvedValue({ users: [], total: 0 });

      const response = await request(app)
        .get('/api/users')
        .set('x-test-role', 'employee');

      expect(response.status).toBe(200);
      expect(mockService.getUsersList).toHaveBeenCalledTimes(1);
    });

    it('returns 401 when not authenticated', async () => {
      const response = await request(app)
        .get('/api/users');

      expect(response.status).toBe(401);
      expect(mockService.getUsersList).not.toHaveBeenCalled();
    });

    it('preserves AppError status from service', async () => {
      mockService.getUsersList.mockRejectedValueOnce(createAppError('FORBIDDEN', 'No puedes listar estos usuarios'));

      const response = await request(app)
        .get('/api/users')
        .set('x-test-role', 'admin');

      expect(response.status).toBe(403);
      expect(response.body).toMatchObject({
        success: false,
        error: 'No puedes listar estos usuarios',
        code: 'FORBIDDEN',
      });
    });
  });

  describe('GET /:id', () => {
    it('returns 200 for admin', async () => {
      mockService.getUserById.mockResolvedValue({ id: 'user-1' } as any);

      const response = await request(app)
        .get('/api/users/user-1')
        .set('x-test-role', 'admin');

      expect(response.status).toBe(200);
      expect(mockService.getUserById).toHaveBeenCalledTimes(1);
    });

    it('returns 200 for employee con users:view', async () => {
      mockService.getUserById.mockResolvedValue({ id: 'user-1' } as any);

      const response = await request(app)
        .get('/api/users/user-1')
        .set('x-test-role', 'employee');

      expect(response.status).toBe(200);
      expect(mockService.getUserById).toHaveBeenCalledTimes(1);
    });

    it('returns 403 when role has no users:view', async () => {
      const response = await request(app)
        .get('/api/users/user-1')
        .set('x-test-role', 'unknown_role');

      expect(response.status).toBe(403);
      expect(mockService.getUserById).not.toHaveBeenCalled();
    });

    it('returns 401 when not authenticated', async () => {
      const response = await request(app)
        .get('/api/users/user-1');

      expect(response.status).toBe(401);
      expect(mockService.getUserById).not.toHaveBeenCalled();
    });
  });

  describe('POST /', () => {
    it('creates user for admin', async () => {
      mockService.createUser.mockResolvedValue({ id: 'user-1' } as any);

      const response = await request(app)
        .post('/api/users')
        .set('x-test-role', 'admin')
        .send(validUserItem);

      expect(response.status).toBe(201);
      expect(mockService.createUser).toHaveBeenCalledTimes(1);
    });

    it('returns 403 for employee (requires users:create)', async () => {
      const response = await request(app)
        .post('/api/users')
        .set('x-test-role', 'employee')
        .send(validUserItem);

      expect(response.status).toBe(403);
      expect(mockService.createUser).not.toHaveBeenCalled();
    });

    it('returns 401 when not authenticated', async () => {
      const response = await request(app)
        .post('/api/users')
        .send(validUserItem);

      expect(response.status).toBe(401);
      expect(mockService.createUser).not.toHaveBeenCalled();
    });

    it('returns 400 for missing required fields', async () => {
      const response = await request(app)
        .post('/api/users')
        .set('x-test-role', 'admin')
        .send({});

      expect(response.status).toBe(400);
      expect(mockService.createUser).not.toHaveBeenCalled();
    });

    it('returns 400 for short password', async () => {
      const response = await request(app)
        .post('/api/users')
        .set('x-test-role', 'admin')
        .send({ ...validUserItem, password: '123' });

      expect(response.status).toBe(400);
      expect(mockService.createUser).not.toHaveBeenCalled();
    });
  });

  describe('PATCH /:id', () => {
    it('updates user for admin', async () => {
      mockService.updateUser.mockResolvedValue({ id: 'user-1' } as any);

      const response = await request(app)
        .patch('/api/users/user-1')
        .set('x-test-role', 'admin')
        .send({ name: 'Juan Updated' });

      expect(response.status).toBe(200);
      expect(mockService.updateUser).toHaveBeenCalledTimes(1);
    });

    it('returns 403 for employee (requires users:update)', async () => {
      const response = await request(app)
        .patch('/api/users/user-1')
        .set('x-test-role', 'employee')
        .send({ name: 'Juan Updated' });

      expect(response.status).toBe(403);
      expect(mockService.updateUser).not.toHaveBeenCalled();
    });

    it('returns 401 when not authenticated', async () => {
      const response = await request(app)
        .patch('/api/users/user-1')
        .send({ name: 'Juan Updated' });

      expect(response.status).toBe(401);
      expect(mockService.updateUser).not.toHaveBeenCalled();
    });
  });

  describe('PATCH /:id/status', () => {
    it('changes status for admin', async () => {
      mockService.changeUserStatus.mockResolvedValue(undefined);

      const response = await request(app)
        .patch('/api/users/user-1/status')
        .set('x-test-role', 'admin')
        .send({ status: 'disabled' });

      expect(response.status).toBe(200);
      expect(mockService.changeUserStatus).toHaveBeenCalledTimes(1);
    });

    it('returns 403 for employee (requires users:update)', async () => {
      const response = await request(app)
        .patch('/api/users/user-1/status')
        .set('x-test-role', 'employee')
        .send({ status: 'disabled' });

      expect(response.status).toBe(403);
      expect(mockService.changeUserStatus).not.toHaveBeenCalled();
    });

    it('returns 400 for invalid status', async () => {
      const response = await request(app)
        .patch('/api/users/user-1/status')
        .set('x-test-role', 'admin')
        .send({ status: 'invalid_status' });

      expect(response.status).toBe(400);
      expect(mockService.changeUserStatus).not.toHaveBeenCalled();
    });
  });

  describe('PATCH /:id/role', () => {
    it('changes role for admin', async () => {
      mockService.changeUserRole.mockResolvedValue(undefined);

      const response = await request(app)
        .patch('/api/users/user-1/role')
        .set('x-test-role', 'admin')
        .send({ role: 'general_manager' });

      expect(response.status).toBe(200);
      expect(mockService.changeUserRole).toHaveBeenCalledTimes(1);
    });

    it('returns 403 for employee (requires users:update)', async () => {
      const response = await request(app)
        .patch('/api/users/user-1/role')
        .set('x-test-role', 'employee')
        .send({ role: 'general_manager' });

      expect(response.status).toBe(403);
      expect(mockService.changeUserRole).not.toHaveBeenCalled();
    });
  });

  describe('POST /:id/reset-password', () => {
    it('resets password for admin', async () => {
      mockService.resetUserPassword.mockResolvedValue(undefined);

      const response = await request(app)
        .post('/api/users/user-1/reset-password')
        .set('x-test-role', 'admin')
        .send({ newPassword: 'newPassword123' });

      expect(response.status).toBe(200);
      expect(mockService.resetUserPassword).toHaveBeenCalledTimes(1);
    });

    it('returns 400 for short password', async () => {
      const response = await request(app)
        .post('/api/users/user-1/reset-password')
        .set('x-test-role', 'admin')
        .send({ newPassword: '123' });

      expect(response.status).toBe(400);
      expect(mockService.resetUserPassword).not.toHaveBeenCalled();
    });
  });

  describe('POST /:id/force-password-change', () => {
    it('forces password change for admin', async () => {
      mockService.forceUserPasswordChange.mockResolvedValue(undefined);

      const response = await request(app)
        .post('/api/users/user-1/force-password-change')
        .set('x-test-role', 'admin');

      expect(response.status).toBe(200);
      expect(mockService.forceUserPasswordChange).toHaveBeenCalledTimes(1);
    });
  });

  describe('DELETE /:id', () => {
    it('deletes user for admin', async () => {
      mockService.deleteUser.mockResolvedValue(undefined);

      const response = await request(app)
        .delete('/api/users/user-1')
        .set('x-test-role', 'admin');

      expect(response.status).toBe(200);
      expect(mockService.deleteUser).toHaveBeenCalledTimes(1);
    });

    it('returns 403 for employee (requires users:delete)', async () => {
      const response = await request(app)
        .delete('/api/users/user-1')
        .set('x-test-role', 'employee');

      expect(response.status).toBe(403);
      expect(mockService.deleteUser).not.toHaveBeenCalled();
    });

    it('returns 401 when not authenticated', async () => {
      const response = await request(app)
        .delete('/api/users/user-1');

      expect(response.status).toBe(401);
      expect(mockService.deleteUser).not.toHaveBeenCalled();
    });
  });

  describe('GET /:id/schedules', () => {
    it('returns schedules for admin', async () => {
      mockService.getUserSchedules.mockResolvedValue([]);

      const response = await request(app)
        .get('/api/users/user-1/schedules')
        .set('x-test-role', 'admin');

      expect(response.status).toBe(200);
      expect(mockService.getUserSchedules).toHaveBeenCalledTimes(1);
    });

    it('returns 401 when not authenticated', async () => {
      const response = await request(app)
        .get('/api/users/user-1/schedules');

      expect(response.status).toBe(401);
      expect(mockService.getUserSchedules).not.toHaveBeenCalled();
    });
  });
});
