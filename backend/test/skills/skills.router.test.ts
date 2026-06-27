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

      req.user = {
        id: 'test-user',
        roleName: role,
        permissions: DEFAULT_ROLE_PERMISSIONS[role] || [],
        name: 'Test User',
        email: 'test@example.com',
        branchId: 'branch-1',
        departmentId: 'department-1',
        status: 'active',
      };
      return next();
    },
  };
});

jest.mock('../../src/modules/skills/skills.service', () => ({
  skillsService: {
    listSkills: jest.fn(),
    createSkill: jest.fn(),
    updateSkill: jest.fn(),
    deleteSkill: jest.fn(),
    assignUserSkills: jest.fn(),
  },
}));

import skillsRouter from '../../src/modules/skills/skills.router';
import { skillsService } from '../../src/modules/skills/skills.service';

const mockService = skillsService as jest.Mocked<typeof skillsService>;

const app = express();
app.use(express.json());
app.use('/api/skills', skillsRouter);

describe('skills.router', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('lists skills for authenticated managers', async () => {
    mockService.listSkills.mockResolvedValue([{ id: 'skill-1', name: 'Soporte L1', category: 'support' }] as any);

    const response = await request(app).get('/api/skills').set('x-test-role', 'general_manager');

    expect(response.status).toBe(200);
    expect(mockService.listSkills).toHaveBeenCalledWith({ includeInactive: false });
  });

  it('lists skills for employee (tiene skills:view)', async () => {
    mockService.listSkills.mockResolvedValue([]);

    const response = await request(app).get('/api/skills').set('x-test-role', 'employee');

    expect(response.status).toBe(200);
    expect(mockService.listSkills).toHaveBeenCalledWith({ includeInactive: false });
  });

  it('creates skills for admins', async () => {
    mockService.createSkill.mockResolvedValue({ id: 'skill-1', name: 'Soporte L1' } as any);

    const response = await request(app)
      .post('/api/skills')
      .set('x-test-role', 'admin')
      .send({ name: 'Soporte L1', category: 'support', color: '#1d4ed8' });

    expect(response.status).toBe(201);
    expect(mockService.createSkill).toHaveBeenCalledTimes(1);
  });

  it('rejects invalid skill payloads', async () => {
    const response = await request(app)
      .post('/api/skills')
      .set('x-test-role', 'admin')
      .send({ name: 'x', color: 'blue' });

    expect(response.status).toBe(400);
    expect(mockService.createSkill).not.toHaveBeenCalled();
  });

  it('blocks skill mutations without permission', async () => {
    const response = await request(app)
      .post('/api/skills')
      .set('x-test-role', 'employee')
      .send({ name: 'Soporte L1' });

    expect(response.status).toBe(403);
    expect(mockService.createSkill).not.toHaveBeenCalled();
  });

  it('assigns user skills for allowed roles', async () => {
    mockService.assignUserSkills.mockResolvedValue([{ userId: 'user-1', skillId: 'skill-1' }] as any);

    const response = await request(app)
      .put('/api/skills/users/user-1')
      .set('x-test-role', 'admin')
      .send({ skillIds: ['skill-1'] });

    expect(response.status).toBe(200);
    expect(mockService.assignUserSkills).toHaveBeenCalledWith(
      'user-1',
      ['skill-1'],
      expect.objectContaining({ id: 'test-user' }),
    );
  });

  it('requires authentication', async () => {
    const response = await request(app).get('/api/skills');

    expect(response.status).toBe(401);
    expect(mockService.listSkills).not.toHaveBeenCalled();
  });
});
