/**
 * @file skills.service.test.ts
 * Cubre la reactivación de skills siguiendo el patrón de SkillsService y skillsManager.
 */

jest.mock('../../src/modules/audit/audit.service', () => ({
  logAuditOrThrow: jest.fn().mockResolvedValue(undefined),
  sanitizeSnapshot: jest.fn((x) => x),
}));

jest.mock('../../src/common/transactions/transaction.utils', () => ({
  executeInTransaction: jest.fn(async (fn: any) => fn({
    skill: {
      update: jest.fn((args: any) => Promise.resolve({ id: args.where.id, ...args.data })),
    },
  })),
}));

jest.mock('../../src/modules/skills/skills.manager', () => ({
  skillsManager: {
    listSkills: jest.fn(),
    findById: jest.fn(),
    findByName: jest.fn(),
    createSkill: jest.fn(),
    updateSkill: jest.fn(),
    replaceUserSkills: jest.fn(),
    listUserSkills: jest.fn(),
    countActiveSkills: jest.fn(),
    userExists: jest.fn(),
  },
}));

import { skillsManager } from '../../src/modules/skills/skills.manager';
import { skillsService, reactivateSkill } from '../../src/modules/skills/skills.service';

const manager = skillsManager as jest.Mocked<typeof skillsManager>;
const actor = { id: 'admin-1', ipAddress: '127.0.0.1' };

describe('reactivateSkill', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('reactiva una skill inactiva', async () => {
    manager.findById.mockResolvedValue({
      id: 'skill-1',
      name: 'Soporte L1',
      category: 'Soporte',
      color: '#1d4ed8',
      description: null,
      isActive: false,
    } as any);
    manager.findByName.mockResolvedValue(null as any);
    manager.updateSkill.mockResolvedValue({ id: 'skill-1', isActive: true } as any);

    const result = await skillsService.reactivateSkill('skill-1', actor as any);

    expect(result.isActive).toBe(true);
    expect(manager.updateSkill).toHaveBeenCalledWith('skill-1', { isActive: true }, { skill: { update: expect.any(Function) } } as any);
  });

  it('lanza error si ya está activa', async () => {
    manager.findById.mockResolvedValue({
      id: 'skill-1',
      name: 'Soporte L1',
      category: 'Soporte',
      color: '#1d4ed8',
      description: null,
      isActive: true,
    } as any);

    await expect(reactivateSkill('skill-1', actor as any)).rejects.toThrow('La skill ya está activa');
  });
});
