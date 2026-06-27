/**
 * @file schedules.router.test.ts
 * Tests del router de schedules: autenticación, permisos, validación de body.
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
        status: 'active',
      };
      next();
    },
  };
});

jest.mock('../../src/modules/schedules/schedules.service', () => ({
  createScheduleEntry: jest.fn(),
  createScheduleEntriesBulk: jest.fn(),
  deleteScheduleEntry: jest.fn(),
  getScheduleAlerts: jest.fn(),
  getScheduleByIdForActor: jest.fn(),
  listSchedulesForActor: jest.fn(),
  listWeekSchedulesForActor: jest.fn(),
  updateScheduleEntry: jest.fn(),
}));

jest.mock('../../src/modules/schedules/weekly-summary.service', () => ({
  getWeeklySummary: jest.fn(),
  getWeeklySummaries: jest.fn(),
  getTeamWeeklySummaries: jest.fn(),
  recalculateWeeklySummary: jest.fn(),
}));

import schedulesRouter from '../../src/modules/schedules/schedules.router';
import * as schedulesService from '../../src/modules/schedules/schedules.service';
import * as weeklySummaryService from '../../src/modules/schedules/weekly-summary.service';

const mockService = schedulesService as jest.Mocked<typeof schedulesService>;
const mockWeeklySummaryService = weeklySummaryService as jest.Mocked<typeof weeklySummaryService>;

const app = express();
app.use(express.json());
app.use('/api/schedules', schedulesRouter);

const validScheduleItem = {
  title: 'Guardia Test',
  startDatetime: '2026-06-01T08:00:00Z',
  endDatetime: '2026-06-01T16:00:00Z',
  scheduleTypeId: 'st-guardia',
  branchId: 'b-1',
  assigneeIds: ['user-1'],
  color: '#2563eb',
};

describe('schedules.router', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('POST /bulk', () => {
    it('creates multiple schedules for admin', async () => {
      mockService.createScheduleEntriesBulk.mockResolvedValue([
        { id: 's-1', title: 'Guardia Test' } as any,
        { id: 's-2', title: 'Guardia Test 2' } as any,
      ]);

      const response = await request(app)
        .post('/api/schedules/bulk')
        .set('x-test-role', 'admin')
        .send({
          items: [
            validScheduleItem,
            { ...validScheduleItem, startDatetime: '2026-06-02T08:00:00Z', endDatetime: '2026-06-02T16:00:00Z' },
          ],
        });

      expect(response.status).toBe(201);
      expect(mockService.createScheduleEntriesBulk).toHaveBeenCalledTimes(1);
      expect(response.body.data).toHaveLength(2);
    });

    it('returns 401 when not authenticated', async () => {
      const response = await request(app)
        .post('/api/schedules/bulk')
        .send({ items: [validScheduleItem] });

      expect(response.status).toBe(401);
      expect(mockService.createScheduleEntriesBulk).not.toHaveBeenCalled();
    });

    it('returns 403 for employee (requires schedules:manage)', async () => {
      const response = await request(app)
        .post('/api/schedules/bulk')
        .set('x-test-role', 'employee')
        .send({ items: [validScheduleItem] });

      expect(response.status).toBe(403);
      expect(mockService.createScheduleEntriesBulk).not.toHaveBeenCalled();
    });

    it('allows department_manager to create bulk schedules', async () => {
      mockService.createScheduleEntriesBulk.mockResolvedValue([
        { id: 's-1' } as any,
      ]);

      const response = await request(app)
        .post('/api/schedules/bulk')
        .set('x-test-role', 'department_manager')
        .send({ items: [validScheduleItem] });

      expect(response.status).toBe(201);
      expect(mockService.createScheduleEntriesBulk).toHaveBeenCalledTimes(1);
    });

    it('returns 400 for empty items array', async () => {
      const response = await request(app)
        .post('/api/schedules/bulk')
        .set('x-test-role', 'admin')
        .send({ items: [] });

      expect(response.status).toBe(400);
      expect(mockService.createScheduleEntriesBulk).not.toHaveBeenCalled();
    });

    it('returns 400 for missing items field', async () => {
      const response = await request(app)
        .post('/api/schedules/bulk')
        .set('x-test-role', 'admin')
        .send({});

      expect(response.status).toBe(400);
      expect(mockService.createScheduleEntriesBulk).not.toHaveBeenCalled();
    });

    it('returns 400 for invalid schedule item in bulk', async () => {
      const response = await request(app)
        .post('/api/schedules/bulk')
        .set('x-test-role', 'admin')
        .send({
          items: [
            { ...validScheduleItem, title: 'A' }, // title too short (min 2 chars)
          ],
        });

      expect(response.status).toBe(400);
      expect(mockService.createScheduleEntriesBulk).not.toHaveBeenCalled();
    });

    it('allows general_manager to create bulk schedules', async () => {
      mockService.createScheduleEntriesBulk.mockResolvedValue([
        { id: 's-1' } as any,
      ]);

      const response = await request(app)
        .post('/api/schedules/bulk')
        .set('x-test-role', 'general_manager')
        .send({ items: [validScheduleItem] });

      expect(response.status).toBe(201);
      expect(mockService.createScheduleEntriesBulk).toHaveBeenCalledTimes(1);
    });
  });

  describe('GET /', () => {
    it('returns 200 for admin', async () => {
      mockService.listSchedulesForActor.mockResolvedValue([] as any);

      const response = await request(app)
        .get('/api/schedules')
        .set('x-test-role', 'admin');

      expect(response.status).toBe(200);
      expect(mockService.listSchedulesForActor).toHaveBeenCalledTimes(1);
    });

    it('returns 200 for employee', async () => {
      mockService.listSchedulesForActor.mockResolvedValue([] as any);

      const response = await request(app)
        .get('/api/schedules')
        .set('x-test-role', 'employee');

      expect(response.status).toBe(200);
      expect(mockService.listSchedulesForActor).toHaveBeenCalledTimes(1);
    });

    it('returns 401 when not authenticated', async () => {
      const response = await request(app)
        .get('/api/schedules');

      expect(response.status).toBe(401);
      expect(mockService.listSchedulesForActor).not.toHaveBeenCalled();
    });
  });

  describe('GET /week/:year/:week', () => {
    it('returns 200 for admin', async () => {
      mockService.listWeekSchedulesForActor.mockResolvedValue({ year: 2026, week: 23, weekStart: new Date(), weekEnd: new Date(), total: 0, items: [] });

      const response = await request(app)
        .get('/api/schedules/week/2026/23')
        .set('x-test-role', 'admin');

      expect(response.status).toBe(200);
      expect(mockService.listWeekSchedulesForActor).toHaveBeenCalledTimes(1);
    });

    it('returns 200 for employee', async () => {
      mockService.listWeekSchedulesForActor.mockResolvedValue({ year: 2026, week: 23, weekStart: new Date(), weekEnd: new Date(), total: 0, items: [] });

      const response = await request(app)
        .get('/api/schedules/week/2026/23')
        .set('x-test-role', 'employee');

      expect(response.status).toBe(200);
      expect(mockService.listWeekSchedulesForActor).toHaveBeenCalledTimes(1);
    });

    it('returns 401 when not authenticated', async () => {
      const response = await request(app)
        .get('/api/schedules/week/2026/23');

      expect(response.status).toBe(401);
      expect(mockService.listWeekSchedulesForActor).not.toHaveBeenCalled();
    });
  });

  describe('GET /my-weekly-summary/:year/:week', () => {
    it('returns 200 for authenticated user', async () => {
      mockWeeklySummaryService.getWeeklySummary.mockResolvedValue({
        userId: 'test-user',
        year: 2026,
        week: 23,
        totalHours: 40,
        baseHours: 40,
        overtimeHours: 0,
        dailyBreakdown: {},
      } as any);

      const response = await request(app)
        .get('/api/schedules/my-weekly-summary/2026/23')
        .set('x-test-role', 'employee');

      expect(response.status).toBe(200);
      expect(mockWeeklySummaryService.getWeeklySummary).toHaveBeenCalledTimes(1);
      expect(mockWeeklySummaryService.recalculateWeeklySummary).not.toHaveBeenCalled();
    });

    it('returns 401 when not authenticated', async () => {
      const response = await request(app)
        .get('/api/schedules/my-weekly-summary/2026/23');

      expect(response.status).toBe(401);
      expect(mockWeeklySummaryService.getWeeklySummary).not.toHaveBeenCalled();
    });
  });

  describe('GET /:id', () => {
    it('returns 200 for admin', async () => {
      mockService.getScheduleByIdForActor.mockResolvedValue({ id: 's-1' } as any);

      const response = await request(app)
        .get('/api/schedules/s-1')
        .set('x-test-role', 'admin');

      expect(response.status).toBe(200);
      expect(mockService.getScheduleByIdForActor).toHaveBeenCalledTimes(1);
    });

    it('returns 401 when not authenticated', async () => {
      const response = await request(app)
        .get('/api/schedules/s-1');

      expect(response.status).toBe(401);
      expect(mockService.getScheduleByIdForActor).not.toHaveBeenCalled();
    });
  });

  describe('GET /alerts', () => {
    it('returns 200 for admin', async () => {
      mockService.getScheduleAlerts.mockResolvedValue([]);

      const response = await request(app)
        .get('/api/schedules/alerts')
        .set('x-test-role', 'admin');

      expect(response.status).toBe(200);
      expect(mockService.getScheduleAlerts).toHaveBeenCalledTimes(1);
    });

    it('returns 401 when not authenticated', async () => {
      const response = await request(app)
        .get('/api/schedules/alerts');

      expect(response.status).toBe(401);
      expect(mockService.getScheduleAlerts).not.toHaveBeenCalled();
    });
  });
});
