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
        status: 'active'
      };
      next();
    },
  };
});

jest.mock('../../src/modules/branches/branches.controller', () => ({
  listBranchesController: jest.fn((_req: any, res: any) => res.status(200).json({ success: true, data: [] })),
  createBranchController: jest.fn((_req: any, res: any) => res.status(201).json({ success: true, data: { id: 'b-1' } })),
  updateBranchController: jest.fn((_req: any, res: any) => res.status(200).json({ success: true })),
  deleteBranchController: jest.fn((_req: any, res: any) => res.status(200).json({ success: true })),
  hardDeleteBranchController: jest.fn((_req: any, res: any) => res.status(200).json({ success: true })),
  listBranchHolidaysController: jest.fn((_req: any, res: any) => res.status(200).json({ success: true, data: [] })),
  bulkUpdateBranchHolidayController: jest.fn((_req: any, res: any) => res.status(200).json({ success: true })),
  bulkDeleteBranchHolidayController: jest.fn((_req: any, res: any) => res.status(200).json({ success: true })),
  createBranchHolidayController: jest.fn((_req: any, res: any) => res.status(201).json({ success: true })),
  updateBranchHolidayController: jest.fn((_req: any, res: any) => res.status(200).json({ success: true })),
  deleteBranchHolidayController: jest.fn((_req: any, res: any) => res.status(200).json({ success: true })),
}));

import branchesRouter from '../../src/modules/branches/branches.router';
import * as branchesController from '../../src/modules/branches/branches.controller';

const app = express();
app.use(express.json());
app.use('/api/branches', branchesRouter);

describe('branches.router', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('delegates GET / to listBranchesController for employee', async () => {
    const response = await request(app).get('/api/branches').set('x-test-role', 'employee');

    expect(response.status).toBe(200);
    expect(branchesController.listBranchesController).toHaveBeenCalledTimes(1);
  });

  it('returns 401 on POST / when role header is missing', async () => {
    const response = await request(app).post('/api/branches').send({ name: 'Madrid', code: 'MAD01' });

    expect(response.status).toBe(401);
    expect(response.body).toEqual({
      success: false,
      error: 'Token de acceso requerido',
      code: 'UNAUTHORIZED',
    });
    expect(branchesController.createBranchController).not.toHaveBeenCalled();
  });

  it('returns 403 on POST / for employee and does not call controller', async () => {
    const response = await request(app)
      .post('/api/branches')
      .set('x-test-role', 'employee')
      .send({ name: 'Madrid', code: 'MAD01' });

    expect(response.status).toBe(403);
    expect(branchesController.createBranchController).not.toHaveBeenCalled();
  });

  it('delegates POST / to createBranchController for admin', async () => {
    const response = await request(app)
      .post('/api/branches')
      .set('x-test-role', 'admin')
      .send({ name: 'Madrid', code: 'MAD01' });

    expect(response.status).toBe(201);
    expect(branchesController.createBranchController).toHaveBeenCalledTimes(1);
  });

  it('delegates GET /:branchId/holidays to listBranchHolidaysController', async () => {
    const response = await request(app).get('/api/branches/b-1/holidays?year=2026').set('x-test-role', 'employee');

    expect(response.status).toBe(200);
    expect(branchesController.listBranchHolidaysController).toHaveBeenCalledTimes(1);
  });

  it('delegates PATCH /all/holidays/bulk to bulkUpdateBranchHolidayController for admin', async () => {
    const response = await request(app)
      .patch('/api/branches/all/holidays/bulk')
      .set('x-test-role', 'admin')
      .send({ holidayIds: ['h-1'], name: 'Nuevo nombre' });

    expect(response.status).toBe(200);
    expect(branchesController.bulkUpdateBranchHolidayController).toHaveBeenCalledTimes(1);
  });

  it('delegates DELETE /all/holidays/bulk to bulkDeleteBranchHolidayController for admin', async () => {
    const response = await request(app)
      .delete('/api/branches/all/holidays/bulk')
      .set('x-test-role', 'admin')
      .send({ holidayIds: ['h-1'] });

    expect(response.status).toBe(200);
    expect(branchesController.bulkDeleteBranchHolidayController).toHaveBeenCalledTimes(1);
  });
});
