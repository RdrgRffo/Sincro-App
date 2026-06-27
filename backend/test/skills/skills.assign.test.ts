/** Tests para assignUserSkills en skills.service */
jest.mock('../../src/modules/audit/audit.service', () => ({
  logAuditOrThrow: jest.fn().mockResolvedValue(undefined),
  sanitizeSnapshot: jest.fn((x) => x),
}));
jest.mock('../../src/common/transactions/transaction.utils', () => ({
  executeInTransaction: jest.fn(async (fn: any) => fn({ skill: {}, userSkill: {}, user: {} })),
}));
jest.mock('../../src/modules/skills/skills.manager', () => ({
  skillsManager: {
    userExists: jest.fn(),
    countActiveSkills: jest.fn(),
    replaceUserSkills: jest.fn(),
    listUserSkills: jest.fn(),
  },
}));

import { skillsManager } from '../../src/modules/skills/skills.manager';
import { skillsService } from '../../src/modules/skills/skills.service';

const manager = skillsManager as jest.Mocked<typeof skillsManager>;
const actor = { id: 'admin-1', ipAddress: '127.0.0.1' };

describe('assignUserSkills', () => {
  beforeEach(() => jest.clearAllMocks());

  it('assigns skills after validation', async () => {
    manager.userExists.mockResolvedValue(true as any);
    manager.countActiveSkills.mockResolvedValue(2 as any);
    manager.listUserSkills.mockResolvedValue([{ skill: { id: 's1' } }] as any);
    manager.replaceUserSkills.mockResolvedValue([{ skill: { id: 's1' } }, { skill: { id: 's2' } }] as any);

    const result = await skillsService.assignUserSkills('user-1', ['s1', 's2'], actor as any);

    expect(manager.userExists).toHaveBeenCalledWith('user-1');
    expect(manager.countActiveSkills).toHaveBeenCalledWith(['s1', 's2']);
    expect(manager.replaceUserSkills).toHaveBeenCalledWith('user-1', ['s1', 's2'], actor.id, expect.any(Object));
    expect(result).toHaveLength(2);
  });

  it('throws if user does not exist', async () => {
    manager.userExists.mockResolvedValue(false as any);
    await expect(skillsService.assignUserSkills('notfound', ['s1'], actor as any)).rejects.toThrow('Usuario no encontrado');
  });

  it('throws if some skills are inactive or missing', async () => {
    manager.userExists.mockResolvedValue(true as any);
    manager.countActiveSkills.mockResolvedValue(1 as any); // expecting 2
    await expect(skillsService.assignUserSkills('user-1', ['s1', 's2'], actor as any)).rejects.toThrow('Una o varias skills no existen o están inactivas');
  });
});
