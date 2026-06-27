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

jest.mock('../../src/modules/schedule-types/schedule-types.service', () => ({
  getScheduleTypes: jest.fn(),
  getScheduleTypeById: jest.fn(),
  createScheduleType: jest.fn(),
  updateScheduleType: jest.fn(),
  deleteScheduleType: jest.fn(),
}));

import scheduleTypesRouter from '../../src/modules/schedule-types/schedule-types.router';
import * as scheduleTypesService from '../../src/modules/schedule-types/schedule-types.service';
import { createAppError } from '../../src/common/errors/error-catalog';

const mockService = scheduleTypesService as jest.Mocked<typeof scheduleTypesService>;

const app = express();
app.use(express.json());
app.use('/api/schedule-types', scheduleTypesRouter);

describe('schedule-types.router', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('GET /', () => {
    it('returns schedule types for authenticated employee', async () => {
      mockService.getScheduleTypes.mockResolvedValue([{ id: 'st-1', value: 'guardia', label: 'Guardia', color: '#ff0000', isActive: true }] as any);

      const response = await request(app).get('/api/schedule-types').set('x-test-role', 'employee');
      expect(response.status).toBe(200);
      expect(mockService.getScheduleTypes).toHaveBeenCalledTimes(1);
    });

    it('returns 401 when not authenticated', async () => {
      const response = await request(app).get('/api/schedule-types');
      expect(response.status).toBe(401);
      expect(mockService.getScheduleTypes).not.toHaveBeenCalled();
    });
  });

  describe('GET /:id', () => {
    it('returns schedule type by id for authenticated user', async () => {
      mockService.getScheduleTypeById.mockResolvedValue({ id: 'st-1', value: 'guardia', label: 'Guardia', color: '#ff0000', isActive: true } as any);

      const response = await request(app).get('/api/schedule-types/st-1').set('x-test-role', 'employee');
      expect(response.status).toBe(200);
      expect(mockService.getScheduleTypeById).toHaveBeenCalledWith('st-1');
    });

    it('returns 401 when not authenticated', async () => {
      const response = await request(app).get('/api/schedule-types/st-1');
      expect(response.status).toBe(401);
    });
  });

  describe('POST /', () => {
    it('creates schedule type for admin', async () => {
      mockService.createScheduleType.mockResolvedValue({ id: 'st-1', value: 'nuevo', label: 'Nuevo', color: '#ff0000' } as any);

      const response = await request(app)
        .post('/api/schedule-types')
        .set('x-test-role', 'admin')
        .send({ value: 'nuevo', label: 'Nuevo', color: '#ff0000' });
      expect(response.status).toBe(201);
      expect(mockService.createScheduleType).toHaveBeenCalledTimes(1);
    });

    it('returns 403 for department_manager', async () => {
      const response = await request(app)
        .post('/api/schedule-types')
        .set('x-test-role', 'department_manager')
        .send({ value: 'nuevo', label: 'Nuevo', color: '#ff0000' });
      expect(response.status).toBe(403);
      expect(mockService.createScheduleType).not.toHaveBeenCalled();
    });

    it('returns 403 for employee', async () => {
      const response = await request(app)
        .post('/api/schedule-types')
        .set('x-test-role', 'employee')
        .send({ value: 'nuevo', label: 'Nuevo', color: '#ff0000' });
      expect(response.status).toBe(403);
      expect(mockService.createScheduleType).not.toHaveBeenCalled();
    });

    it('returns 400 for invalid body', async () => {
      const response = await request(app)
        .post('/api/schedule-types')
        .set('x-test-role', 'admin')
        .send({ value: '', label: '', color: 'invalid' });
      expect(response.status).toBe(400);
      expect(mockService.createScheduleType).not.toHaveBeenCalled();
    });

    it('preserves AppError status and code', async () => {
      mockService.createScheduleType.mockRejectedValueOnce(createAppError('CONFLICT', 'Tipo duplicado'));

      const response = await request(app)
        .post('/api/schedule-types')
        .set('x-test-role', 'admin')
        .send({ value: 'nuevo', label: 'Nuevo', color: '#ff0000' });

      expect(response.status).toBe(409);
      expect(response.body).toMatchObject({
        success: false,
        error: 'Tipo duplicado',
        code: 'CONFLICT',
      });
    });

    it('returns 500 for unexpected errors', async () => {
      mockService.createScheduleType.mockRejectedValueOnce(new Error('database down'));

      const response = await request(app)
        .post('/api/schedule-types')
        .set('x-test-role', 'admin')
        .send({ value: 'nuevo', label: 'Nuevo', color: '#ff0000' });

      expect(response.status).toBe(500);
      expect(response.body).toMatchObject({
        success: false,
        error: 'Error al crear tipo de turno',
        code: 'INTERNAL_ERROR',
      });
    });
  });

  describe('PUT /:id', () => {
    it('updates schedule type for admin', async () => {
      mockService.updateScheduleType.mockResolvedValue({ id: 'st-1', value: 'actualizado', label: 'Actualizado', color: '#00ff00' } as any);

      const response = await request(app)
        .put('/api/schedule-types/st-1')
        .set('x-test-role', 'admin')
        .send({ label: 'Actualizado' });
      expect(response.status).toBe(200);
      expect(mockService.updateScheduleType).toHaveBeenCalledTimes(1);
    });

    it('returns 403 for employee', async () => {
      const response = await request(app)
        .put('/api/schedule-types/st-1')
        .set('x-test-role', 'employee')
        .send({ label: 'Actualizado' });
      expect(response.status).toBe(403);
      expect(mockService.updateScheduleType).not.toHaveBeenCalled();
    });

    it('preserves NOT_FOUND from service', async () => {
      mockService.updateScheduleType.mockRejectedValueOnce(createAppError('NOT_FOUND', 'Schedule type not found'));

      const response = await request(app)
        .put('/api/schedule-types/st-1')
        .set('x-test-role', 'admin')
        .send({ label: 'Actualizado' });

      expect(response.status).toBe(404);
      expect(response.body).toMatchObject({
        success: false,
        error: 'Schedule type not found',
        code: 'NOT_FOUND',
      });
    });
  });

  describe('DELETE /:id', () => {
    it('deletes schedule type for admin', async () => {
      mockService.deleteScheduleType.mockResolvedValue({
        id: 'st-1',
        value: 'morning',
        label: 'Morning',
        color: '#ff0000',
        isActive: false,
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      const response = await request(app)
        .delete('/api/schedule-types/st-1')
        .set('x-test-role', 'admin');
      expect(response.status).toBe(200);
      expect(mockService.deleteScheduleType).toHaveBeenCalledTimes(1);
    });

    it('returns 403 for employee', async () => {
      const response = await request(app)
        .delete('/api/schedule-types/st-1')
        .set('x-test-role', 'employee');
      expect(response.status).toBe(403);
      expect(mockService.deleteScheduleType).not.toHaveBeenCalled();
    });

    it('preserves BAD_REQUEST when the type is in use', async () => {
      mockService.deleteScheduleType.mockRejectedValueOnce(createAppError('BAD_REQUEST', 'Cannot delete schedule type that is being used by existing schedules'));

      const response = await request(app)
        .delete('/api/schedule-types/st-1')
        .set('x-test-role', 'admin');

      expect(response.status).toBe(400);
      expect(response.body).toMatchObject({
        success: false,
        error: 'Cannot delete schedule type that is being used by existing schedules',
        code: 'BAD_REQUEST',
      });
    });
  });
});
