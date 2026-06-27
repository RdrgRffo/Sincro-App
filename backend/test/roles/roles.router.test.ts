import express from 'express';
import request from 'supertest';
import { createAppError } from '../../src/common/errors/error-catalog';

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
        status: 'active',
      };
      next();
    },
  };
});

jest.mock('../../src/modules/roles/roles.service', () => ({
  listRoles: jest.fn(),
  getRole: jest.fn(),
  createRole: jest.fn(),
  updateRole: jest.fn(),
  deleteRole: jest.fn(),
  listPermissions: jest.fn(),
}));

import rolesRouter from '../../src/modules/roles/roles.router';
import * as rolesService from '../../src/modules/roles/roles.service';

const mockService = rolesService as jest.Mocked<typeof rolesService>;

const app = express();
app.use(express.json());
app.use('/api/roles', rolesRouter);

describe('roles.router', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('POST /', () => {
    it('creates a role for admin', async () => {
      mockService.createRole.mockResolvedValue({
        id: 'role-1',
        name: 'supervisor',
        description: 'Supervisor',
        permissions: [],
      } as any);

      const response = await request(app)
        .post('/api/roles')
        .set('x-test-role', 'admin')
        .send({ name: 'supervisor', description: 'Supervisor', permissions: ['schedules:view'] });

      expect(response.status).toBe(201);
      expect(mockService.createRole).toHaveBeenCalledWith({
        name: 'supervisor',
        description: 'Supervisor',
        permissions: ['schedules:view'],
      });
    });

    it('returns 400 without calling service for invalid body', async () => {
      const response = await request(app)
        .post('/api/roles')
        .set('x-test-role', 'admin')
        .send({ name: '', permissions: ['unknown:permission'] });

      expect(response.status).toBe(400);
      expect(response.body.code).toBe('BAD_REQUEST');
      expect(mockService.createRole).not.toHaveBeenCalled();
    });

    it('preserves AppError from service', async () => {
      mockService.createRole.mockRejectedValueOnce(createAppError('CONFLICT', 'Role duplicado'));

      const response = await request(app)
        .post('/api/roles')
        .set('x-test-role', 'admin')
        .send({ name: 'supervisor', permissions: ['schedules:view'] });

      expect(response.status).toBe(409);
      expect(response.body).toMatchObject({
        success: false,
        error: 'Role duplicado',
        code: 'CONFLICT',
      });
    });
  });

  describe('PATCH /:id', () => {
    it('preserves NOT_FOUND from service', async () => {
      mockService.updateRole.mockRejectedValueOnce(createAppError('NOT_FOUND', 'Role no encontrado'));

      const response = await request(app)
        .patch('/api/roles/role-1')
        .set('x-test-role', 'admin')
        .send({ description: 'Nuevo texto' });

      expect(response.status).toBe(404);
      expect(response.body).toMatchObject({
        success: false,
        error: 'Role no encontrado',
        code: 'NOT_FOUND',
      });
    });
  });
});
