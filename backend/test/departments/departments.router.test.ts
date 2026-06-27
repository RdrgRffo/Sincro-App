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
        status: 'active',
      };
      next();
    },
  };
});

jest.mock('../../src/modules/departments/departments.controller', () => ({
  listDepartmentsController: jest.fn((_req: any, res: any) => res.status(200).json({ success: true, data: [] })),
  createDepartmentController: jest.fn((_req: any, res: any) => res.status(201).json({ success: true, data: { id: 'd-1' } })),
  updateDepartmentController: jest.fn((_req: any, res: any) => res.status(200).json({ success: true })),
  deleteDepartmentController: jest.fn((_req: any, res: any) => res.status(200).json({ success: true })),
  hardDeleteDepartmentController: jest.fn((_req: any, res: any) => res.status(200).json({ success: true })),
  listDepartmentBranchesController: jest.fn((_req: any, res: any) => res.status(200).json({ success: true, data: [] })),
  assignDepartmentManagerController: jest.fn((_req: any, res: any) => res.status(200).json({ success: true })),
  removeDepartmentManagerController: jest.fn((_req: any, res: any) => res.status(200).json({ success: true })),
}));

import departmentsRouter from '../../src/modules/departments/departments.router';
import * as departmentsController from '../../src/modules/departments/departments.controller';

const app = express();
app.use(express.json());
app.use('/api/departments', departmentsRouter);

describe('departments.router', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('GET /', () => {
    it('delegates to listDepartmentsController for admin', async () => {
      const response = await request(app).get('/api/departments').set('x-test-role', 'admin');
      expect(response.status).toBe(200);
      expect(departmentsController.listDepartmentsController).toHaveBeenCalledTimes(1);
    });

    it('delegates to listDepartmentsController for employee (tiene departments:view)', async () => {
      const response = await request(app).get('/api/departments').set('x-test-role', 'employee');
      expect(response.status).toBe(200);
      expect(departmentsController.listDepartmentsController).toHaveBeenCalledTimes(1);
    });

    it('returns 200 for department_manager (tiene departments:view)', async () => {
      const response = await request(app).get('/api/departments').set('x-test-role', 'department_manager');
      expect(response.status).toBe(200);
      expect(departmentsController.listDepartmentsController).toHaveBeenCalledTimes(1);
    });

    it('returns 401 when role header is missing', async () => {
      const response = await request(app).get('/api/departments');
      expect(response.status).toBe(401);
      expect(departmentsController.listDepartmentsController).not.toHaveBeenCalled();
    });
  });

  describe('POST /', () => {
    it('delegates to createDepartmentController for admin', async () => {
      const response = await request(app)
        .post('/api/departments')
        .set('x-test-role', 'admin')
        .send({ name: 'RH', code: 'RH01', branchIds: ['b-1'] });
      expect(response.status).toBe(201);
      expect(departmentsController.createDepartmentController).toHaveBeenCalledTimes(1);
    });

    it('returns 403 for general_manager', async () => {
      const response = await request(app)
        .post('/api/departments')
        .set('x-test-role', 'general_manager')
        .send({ name: 'RH', code: 'RH01', branchIds: ['b-1'] });
      expect(response.status).toBe(403);
      expect(departmentsController.createDepartmentController).not.toHaveBeenCalled();
    });
  });

  describe('PATCH /:departmentId', () => {
    it('delegates to updateDepartmentController for admin', async () => {
      const response = await request(app)
        .patch('/api/departments/d-1')
        .set('x-test-role', 'admin')
        .send({ name: 'RH Updated' });
      expect(response.status).toBe(200);
      expect(departmentsController.updateDepartmentController).toHaveBeenCalledTimes(1);
    });
  });

  describe('DELETE /:departmentId', () => {
    it('delegates to deleteDepartmentController for admin', async () => {
      const response = await request(app)
        .delete('/api/departments/d-1')
        .set('x-test-role', 'admin');
      expect(response.status).toBe(200);
      expect(departmentsController.deleteDepartmentController).toHaveBeenCalledTimes(1);
    });
  });

  describe('DELETE /:departmentId/permanent', () => {
    it('delegates to hardDeleteDepartmentController for admin', async () => {
      const response = await request(app)
        .delete('/api/departments/d-1/permanent')
        .set('x-test-role', 'admin');
      expect(response.status).toBe(200);
      expect(departmentsController.hardDeleteDepartmentController).toHaveBeenCalledTimes(1);
    });
  });

  describe('GET /:departmentId/branches', () => {
    it('delegates to listDepartmentBranchesController for admin', async () => {
      const response = await request(app)
        .get('/api/departments/d-1/branches')
        .set('x-test-role', 'admin');
      expect(response.status).toBe(200);
      expect(departmentsController.listDepartmentBranchesController).toHaveBeenCalledTimes(1);
    });
  });

  describe('PATCH /:departmentId/manager', () => {
    it('delegates to assignDepartmentManagerController for admin', async () => {
      const response = await request(app)
        .patch('/api/departments/d-1/manager')
        .set('x-test-role', 'admin')
        .send({ userId: 'user-1' });
      expect(response.status).toBe(200);
      expect(departmentsController.assignDepartmentManagerController).toHaveBeenCalledTimes(1);
    });

    it('returns 403 for general_manager', async () => {
      const response = await request(app)
        .patch('/api/departments/d-1/manager')
        .set('x-test-role', 'general_manager')
        .send({ userId: 'user-1' });
      expect(response.status).toBe(403);
      expect(departmentsController.assignDepartmentManagerController).not.toHaveBeenCalled();
    });
  });

  describe('DELETE /:departmentId/manager', () => {
    it('delegates to removeDepartmentManagerController for admin', async () => {
      const response = await request(app)
        .delete('/api/departments/d-1/manager')
        .set('x-test-role', 'admin');
      expect(response.status).toBe(200);
      expect(departmentsController.removeDepartmentManagerController).toHaveBeenCalledTimes(1);
    });
  });
});
