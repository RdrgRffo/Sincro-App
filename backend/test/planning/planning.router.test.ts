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
        branchId: 'branch-1',
        departmentId: 'department-1',
        permissions,
        name: 'Test User',
        email: 'test@example.com',
        status: 'active',
      };
      next();
    },
  };
});

import planningRouter from '../../src/modules/planning/planning.router';
import { planningManager } from '../../src/modules/planning/planning.manager';
import { planningService } from '../../src/modules/planning/planning.service';
import { prismaMock } from '../config/singleton';

const app = express();
app.use(express.json());
app.use('/api/planning', planningRouter);

const range = 'from=2026-05-12T00:00:00.000Z&to=2026-05-18T23:59:59.999Z';

describe('planning.router', () => {
  beforeEach(() => {
    jest.restoreAllMocks();
    prismaMock.user.findMany.mockResolvedValue([]);
    prismaMock.schedule.findMany.mockResolvedValue([]);
    prismaMock.absence.findMany.mockResolvedValue([]);
  });

  it('returns 403 for employees without planning:view on planning reads', async () => {
    const response = await request(app)
      .get(`/api/planning/coverage-risks?${range}`)
      .set('x-test-role', 'employee');

    expect(response.status).toBe(403);
    expect(response.body.success).toBe(false);
    expect(response.body.code).toBe('FORBIDDEN');
  });

  it('returns empty coverage risks scaffold for users with planning:view permission', async () => {
    const response = await request(app)
      .get(`/api/planning/coverage-risks?${range}`)
      .set('x-test-role', 'admin');

    expect(response.status).toBe(200);
    expect(response.body).toEqual({ success: true, data: [] });
  });

  it('returns empty availability scaffold for managers with planning:view permission', async () => {
    const response = await request(app)
      .get(`/api/planning/availability?${range}`)
      .set('x-test-role', 'general_manager');

    expect(response.status).toBe(200);
    expect(response.body).toEqual({
      success: true,
      data: {
        data: [],
        pagination: { page: 1, pageSize: 200, totalPages: null },
      },
    });
  });

  it('returns empty availability matrix scaffold for managers with planning:view permission', async () => {
    const response = await request(app)
      .get(`/api/planning/availability-matrix?${range}`)
      .set('x-test-role', 'department_manager');

    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);
    expect(response.body.data.rows).toEqual([]);
    expect(response.body.data.days).toHaveLength(7);
  });

  it('returns 401 when authentication is missing', async () => {
    const response = await request(app).get(`/api/planning/coverage-risks?${range}`);

    expect(response.status).toBe(401);
    expect(response.body.code).toBe('UNAUTHORIZED');
  });

  it('validates range query parameters', async () => {
    const response = await request(app)
      .get('/api/planning/coverage-risks?from=bad-date&to=2026-05-18')
      .set('x-test-role', 'admin');

    expect(response.status).toBe(400);
    expect(response.body.success).toBe(false);
    expect(response.body.code).toBe('BAD_REQUEST');
  });

  it('rejects ranges where from is after to', async () => {
    const response = await request(app)
      .get('/api/planning/coverage-risks?from=2026-05-18&to=2026-05-12')
      .set('x-test-role', 'admin');

    expect(response.status).toBe(400);
    expect(response.body.success).toBe(false);
    expect(response.body.code).toBe('BAD_REQUEST');
    expect(response.body.errors.fieldErrors.from).toContain(
      'La fecha de inicio no puede ser posterior a la fecha de fin',
    );
  });

  it('requires from and to query parameters', async () => {
    const response = await request(app)
      .get('/api/planning/coverage-risks')
      .set('x-test-role', 'admin');

    expect(response.status).toBe(400);
    expect(response.body.success).toBe(false);
    expect(response.body.code).toBe('BAD_REQUEST');
    expect(response.body.errors.fieldErrors.from).toBeDefined();
    expect(response.body.errors.fieldErrors.to).toBeDefined();
  });

  it('normalizes optional empty scope filters before calling the service', async () => {
    const spy = jest.spyOn(planningService, 'getCoverageRisks').mockResolvedValue([]);

    const response = await request(app)
      .get(`/api/planning/coverage-risks?${range}&branchId=&departmentId=`)
      .set('x-test-role', 'admin');

    expect(response.status).toBe(200);
    expect(spy).toHaveBeenCalledWith(
      expect.objectContaining({
        from: expect.any(Date),
        to: expect.any(Date),
        branchId: undefined,
        departmentId: undefined,
      }),
      expect.objectContaining({ id: 'test-user', roleName: 'admin' }),
    );
  });

  it('does not restrict admin when no branch filter is requested', async () => {
    const spy = jest.spyOn(planningManager, 'listCoverageRisks').mockResolvedValue([]);

    const response = await request(app)
      .get(`/api/planning/coverage-risks?${range}`)
      .set('x-test-role', 'admin');

    expect(response.status).toBe(200);
    expect(spy).toHaveBeenCalledWith(
      expect.objectContaining({ branchIds: undefined }),
      expect.objectContaining({ roleName: 'admin' }),
    );
  });

  it('limits non-admin planning queries to the actor branch when no branch is requested', async () => {
    const spy = jest.spyOn(planningManager, 'listAvailability').mockResolvedValue([]);

    const response = await request(app)
      .get(`/api/planning/availability?${range}`)
      .set('x-test-role', 'general_manager');

    expect(response.status).toBe(200);
    expect(spy).toHaveBeenCalledWith(
      expect.objectContaining({ branchIds: ['branch-1'] }),
      expect.objectContaining({ roleName: 'general_manager' }),
    );
  });

  it('allows non-admin planning queries for their own branch', async () => {
    const spy = jest.spyOn(planningManager, 'getAvailabilityMatrix').mockResolvedValue({ days: [], rows: [] });

    const response = await request(app)
      .get(`/api/planning/availability-matrix?${range}&branchId=branch-1`)
      .set('x-test-role', 'department_manager');

    expect(response.status).toBe(200);
    expect(spy).toHaveBeenCalledWith(
      expect.objectContaining({ branchId: 'branch-1', branchIds: ['branch-1'] }),
      expect.objectContaining({ roleName: 'department_manager' }),
    );
  });

  it('rejects non-admin planning queries outside their branch scope', async () => {
    const spy = jest.spyOn(planningManager, 'listCoverageRisks').mockResolvedValue([]);

    const response = await request(app)
      .get(`/api/planning/coverage-risks?${range}&branchId=other-branch`)
      .set('x-test-role', 'general_manager');

    expect(response.status).toBe(403);
    expect(response.body.success).toBe(false);
    expect(response.body.code).toBe('FORBIDDEN');
    expect(spy).not.toHaveBeenCalled();
  });

  it('returns absence impact payload when query is valid', async () => {
    const spy = jest.spyOn(planningService, 'getAbsenceImpact').mockResolvedValue({
      employee: { id: 'u1', name: 'Ana', branch: null, department: null },
      overlappingAbsences: [],
      assignedSchedules: [],
      holidays: [],
      likelihood: 'high',
      summary: 'ok',
    });

    const response = await request(app)
      .get('/api/planning/absence-impact?startDate=2026-05-12&endDate=2026-05-18&employeeId=u1')
      .set('x-test-role', 'admin');

    expect(response.status).toBe(200);
    expect(spy).toHaveBeenCalled();
  });

  it('lists comments for planning entities', async () => {
    const spy = jest.spyOn(planningService, 'listComments').mockResolvedValue([]);

    const response = await request(app)
      .get('/api/planning/comments?entityType=schedule&entityId=sc-1')
      .set('x-test-role', 'admin');

    expect(response.status).toBe(200);
    expect(spy).toHaveBeenCalledWith({ entityType: 'schedule', entityId: 'sc-1' });
  });

  it('creates comments for planning entities', async () => {
    const spy = jest.spyOn(planningService, 'addComment').mockResolvedValue({
      id: 'c1',
      entityType: 'schedule',
      entityId: 'sc-1',
      authorId: 'test-user',
      body: 'ok',
      createdAt: new Date().toISOString(),
      author: { id: 'test-user', name: 'Test User' },
    });

    const response = await request(app)
      .post('/api/planning/comments')
      .set('x-test-role', 'admin')
      .send({ entityType: 'schedule', entityId: 'sc-1', body: 'ok' });

    expect(response.status).toBe(201);
    expect(spy).toHaveBeenCalled();
  });
});
