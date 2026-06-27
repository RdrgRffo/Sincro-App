/**
 * @file absences.router.test.ts
 * Tests del router de ausencias: autenticación, permisos, validación de body.
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

jest.mock('../../src/modules/absences/absences.service', () => ({
  listAbsences: jest.fn(),
  getAbsenceById: jest.fn(),
  createAbsenceEntry: jest.fn(),
  approveAbsenceEntry: jest.fn(),
  rejectAbsenceEntry: jest.fn(),
  cancelAbsenceEntry: jest.fn(),
  getAbsenceCalendar: jest.fn(),
}));

import absencesRouter from '../../src/modules/absences/absences.router';
import * as absencesService from '../../src/modules/absences/absences.service';

const mockService = absencesService as jest.Mocked<typeof absencesService>;

const app = express();
app.use(express.json());
app.use('/api/absences', absencesRouter);

// 2026-07-01 = miércoles, 2026-07-03 = viernes (ambos laborables)
const validAbsenceItem = {
  startDate: '2026-07-01T00:00:00.000Z',
  endDate: '2026-07-03T00:00:00.000Z',
  type: 'vacaciones',
  note: 'Ausencia',
};

describe('absences.router', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('GET /', () => {
    it('returns 200 for admin', async () => {
      mockService.listAbsences.mockResolvedValue([] as any);

      const response = await request(app)
        .get('/api/absences')
        .set('x-test-role', 'admin');

      expect(response.status).toBe(200);
      expect(mockService.listAbsences).toHaveBeenCalledTimes(1);
    });

    it('returns 200 for employee', async () => {
      mockService.listAbsences.mockResolvedValue([] as any);

      const response = await request(app)
        .get('/api/absences')
        .set('x-test-role', 'employee');

      expect(response.status).toBe(200);
      expect(mockService.listAbsences).toHaveBeenCalledTimes(1);
    });

    it('returns 401 when not authenticated', async () => {
      const response = await request(app)
        .get('/api/absences');

      expect(response.status).toBe(401);
      expect(mockService.listAbsences).not.toHaveBeenCalled();
    });
  });

  describe('GET /calendar', () => {
    it('returns 200 for admin', async () => {
      mockService.getAbsenceCalendar.mockResolvedValue([] as any);

      const response = await request(app)
        .get('/api/absences/calendar?year=2026&week=27')
        .set('x-test-role', 'admin');

      expect(response.status).toBe(200);
      expect(mockService.getAbsenceCalendar).toHaveBeenCalledTimes(1);
    });

    it('returns 401 when not authenticated', async () => {
      const response = await request(app)
        .get('/api/absences/calendar?year=2026&week=27');

      expect(response.status).toBe(401);
      expect(mockService.getAbsenceCalendar).not.toHaveBeenCalled();
    });
  });

  describe('GET /:id', () => {
    it('returns 200 for admin', async () => {
      mockService.getAbsenceById.mockResolvedValue({ id: 'abs-1' } as any);

      const response = await request(app)
        .get('/api/absences/abs-1')
        .set('x-test-role', 'admin');

      expect(response.status).toBe(200);
      expect(mockService.getAbsenceById).toHaveBeenCalledTimes(1);
    });

    it('returns 401 when not authenticated', async () => {
      const response = await request(app)
        .get('/api/absences/abs-1');

      expect(response.status).toBe(401);
      expect(mockService.getAbsenceById).not.toHaveBeenCalled();
    });
  });

  describe('POST /', () => {
    it('creates absence for admin', async () => {
      mockService.createAbsenceEntry.mockResolvedValue({ id: 'abs-1' } as any);

      const response = await request(app)
        .post('/api/absences')
        .set('x-test-role', 'admin')
        .send(validAbsenceItem);

      expect(response.status).toBe(201);
      expect(mockService.createAbsenceEntry).toHaveBeenCalledTimes(1);
    });

    it('returns 201 for employee (employee can create absences)', async () => {
      mockService.createAbsenceEntry.mockResolvedValue({ id: 'abs-1' } as any);

      const response = await request(app)
        .post('/api/absences')
        .set('x-test-role', 'employee')
        .send(validAbsenceItem);

      expect(response.status).toBe(201);
      expect(mockService.createAbsenceEntry).toHaveBeenCalledTimes(1);
    });

    it('returns 401 when not authenticated', async () => {
      const response = await request(app)
        .post('/api/absences')
        .send(validAbsenceItem);

      expect(response.status).toBe(401);
      expect(mockService.createAbsenceEntry).not.toHaveBeenCalled();
    });

    it('returns 400 for missing required fields', async () => {
      const response = await request(app)
        .post('/api/absences')
        .set('x-test-role', 'admin')
        .send({});

      expect(response.status).toBe(400);
      expect(mockService.createAbsenceEntry).not.toHaveBeenCalled();
    });
  });

  describe('PATCH /:id/approve', () => {
    it('approves absence for admin', async () => {
      mockService.approveAbsenceEntry.mockResolvedValue({ id: 'abs-1' } as any);

      const response = await request(app)
        .patch('/api/absences/abs-1/approve')
        .set('x-test-role', 'admin')
        .send({ note: 'Aprobado' });

      expect(response.status).toBe(200);
      expect(mockService.approveAbsenceEntry).toHaveBeenCalledTimes(1);
    });

    it('returns 403 for employee (requires absences:approve)', async () => {
      const response = await request(app)
        .patch('/api/absences/abs-1/approve')
        .set('x-test-role', 'employee')
        .send({ note: 'Aprobado' });

      expect(response.status).toBe(403);
      expect(mockService.approveAbsenceEntry).not.toHaveBeenCalled();
    });

    it('returns 401 when not authenticated', async () => {
      const response = await request(app)
        .patch('/api/absences/abs-1/approve')
        .send({ note: 'Aprobado' });

      expect(response.status).toBe(401);
      expect(mockService.approveAbsenceEntry).not.toHaveBeenCalled();
    });
  });

  describe('PATCH /:id/reject', () => {
    it('rejects absence for admin', async () => {
      mockService.rejectAbsenceEntry.mockResolvedValue({ id: 'abs-1' } as any);

      const response = await request(app)
        .patch('/api/absences/abs-1/reject')
        .set('x-test-role', 'admin')
        .send({ rejectionReason: 'Motivo de rechazo' });

      expect(response.status).toBe(200);
      expect(mockService.rejectAbsenceEntry).toHaveBeenCalledTimes(1);
    });

    it('returns 403 for employee (requires absences:approve)', async () => {
      const response = await request(app)
        .patch('/api/absences/abs-1/reject')
        .set('x-test-role', 'employee')
        .send({ rejectionReason: 'Motivo de rechazo' });

      expect(response.status).toBe(403);
      expect(mockService.rejectAbsenceEntry).not.toHaveBeenCalled();
    });

    it('returns 401 when not authenticated', async () => {
      const response = await request(app)
        .patch('/api/absences/abs-1/reject')
        .send({ rejectionReason: 'Motivo de rechazo' });

      expect(response.status).toBe(401);
      expect(mockService.rejectAbsenceEntry).not.toHaveBeenCalled();
    });
  });

  describe('DELETE /:id', () => {
    it('cancels absence for admin', async () => {
      mockService.cancelAbsenceEntry.mockResolvedValue({ id: 'abs-1' } as any);

      const response = await request(app)
        .delete('/api/absences/abs-1')
        .set('x-test-role', 'admin');

      expect(response.status).toBe(200);
      expect(mockService.cancelAbsenceEntry).toHaveBeenCalledTimes(1);
    });

    it('returns 401 when not authenticated', async () => {
      const response = await request(app)
        .delete('/api/absences/abs-1');

      expect(response.status).toBe(401);
      expect(mockService.cancelAbsenceEntry).not.toHaveBeenCalled();
    });
  });
});
