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

jest.mock('../../src/modules/shift-presets/shift-presets.service', () => ({
  listShiftPresets: jest.fn(),
  getShiftPresetById: jest.fn(),
  createShiftPreset: jest.fn(),
  updateShiftPreset: jest.fn(),
  deleteShiftPreset: jest.fn(),
}));

import shiftPresetsRouter from '../../src/modules/shift-presets/shift-presets.router';
import * as shiftPresetsService from '../../src/modules/shift-presets/shift-presets.service';

const mockService = shiftPresetsService as jest.Mocked<typeof shiftPresetsService>;

const app = express();
app.use(express.json());
app.use('/api/shift-presets', shiftPresetsRouter);

describe('shift-presets.router', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('POST /', () => {
    it('creates a shift preset for admin', async () => {
      mockService.createShiftPreset.mockResolvedValue({
        id: 'preset-1',
        name: 'Mañana',
        startTime: '08:00',
        endTime: '16:00',
        isActive: true,
      } as any);

      const response = await request(app)
        .post('/api/shift-presets')
        .set('x-test-role', 'admin')
        .send({ name: 'Mañana', startTime: '08:00', endTime: '16:00' });

      expect(response.status).toBe(201);
      expect(mockService.createShiftPreset).toHaveBeenCalledWith(
        { name: 'Mañana', startTime: '08:00', endTime: '16:00', isActive: true },
        'test-user',
      );
    });

    it('returns 400 without calling service for invalid body', async () => {
      const response = await request(app)
        .post('/api/shift-presets')
        .set('x-test-role', 'admin')
        .send({ name: '', startTime: '8', endTime: '16:00' });

      expect(response.status).toBe(400);
      expect(response.body.code).toBe('BAD_REQUEST');
      expect(mockService.createShiftPreset).not.toHaveBeenCalled();
    });

    it('preserves AppError from service', async () => {
      mockService.createShiftPreset.mockRejectedValueOnce(createAppError('CONFLICT', 'Preset duplicado'));

      const response = await request(app)
        .post('/api/shift-presets')
        .set('x-test-role', 'admin')
        .send({ name: 'Mañana', startTime: '08:00', endTime: '16:00' });

      expect(response.status).toBe(409);
      expect(response.body).toMatchObject({
        success: false,
        error: 'Preset duplicado',
        code: 'CONFLICT',
      });
    });
  });

  describe('PATCH /:id', () => {
    it('returns 400 without calling service for invalid body', async () => {
      const response = await request(app)
        .patch('/api/shift-presets/preset-1')
        .set('x-test-role', 'admin')
        .send({ startTime: 'bad' });

      expect(response.status).toBe(400);
      expect(mockService.updateShiftPreset).not.toHaveBeenCalled();
    });
  });
});
