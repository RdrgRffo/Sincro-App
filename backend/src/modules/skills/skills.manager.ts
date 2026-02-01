import type { Prisma } from '@prisma/client';
import { prisma } from '../../config/database';
import type { TransactionClient } from '../../common/transactions/transaction.utils';
import type { ListSkillsQuery } from './skills.validation';

export class SkillsManager {
  /**
   * List skills with optional search/category filters.
   */
  async listSkills(params: ListSkillsQuery) {
    const where: Prisma.SkillWhereInput = {
      ...(params.includeInactive ? {} : { isActive: true }),
      ...(params.category ? { category: params.category } : {}),
      ...(params.search ? { name: { contains: params.search } } : {}),
    };

    return prisma.skill.findMany({
      where,
      orderBy: [{ category: 'asc' }, { name: 'asc' }],
    });
  }

  /**
   * Find a skill by id.
   */
  async findById(id: string) {
    return prisma.skill.findUnique({ where: { id } });
  }

  /**
   * Find a skill by normalized unique name.
   */
  async findByName(name: string) {
    return prisma.skill.findUnique({ where: { name } });
  }

  /**
   * Create a skill in the provided transaction.
   */
  async createSkill(data: Prisma.SkillCreateInput, tx: TransactionClient) {
    return tx.skill.create({ data });
  }

  /**
   * Update a skill in the provided transaction.
   */
  async updateSkill(id: string, data: Prisma.SkillUpdateInput, tx: TransactionClient) {
    return tx.skill.update({ where: { id }, data });
  }

  /**
   * Replace a user's active skill assignments.
   */
  async replaceUserSkills(userId: string, skillIds: string[], actorId: string, tx: TransactionClient) {
    await tx.userSkill.deleteMany({ where: { userId } });

    if (skillIds.length > 0) {
      await tx.userSkill.createMany({
        data: skillIds.map((skillId) => ({ userId, skillId, assignedById: actorId })),
        skipDuplicates: true,
      });
    }

    return tx.userSkill.findMany({
      where: { userId },
      include: { skill: true },
      orderBy: { assignedAt: 'asc' },
    });
  }

  /**
   * Load the current skill assignments for audit snapshots.
   */
  async listUserSkills(userId: string, tx: TransactionClient = prisma) {
    return tx.userSkill.findMany({
      where: { userId },
      include: { skill: true },
      orderBy: { assignedAt: 'asc' },
    });
  }

  /**
   * Count active skills by id to validate assignment payloads without N+1 queries.
   */
  async countActiveSkills(skillIds: string[]) {
    return prisma.skill.count({
      where: { id: { in: skillIds }, isActive: true },
    });
  }

  /**
   * Check whether a user exists before assigning skills.
   */
  async userExists(userId: string) {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { id: true },
    });
    return Boolean(user);
  }

  /**
   * Count how many users have a specific skill assigned.
   */
  async countUserSkills(skillId: string) {
    return prisma.userSkill.count({
      where: { skillId },
    });
  }

  /**
   * Get skill usage statistics: how many active users have each skill.
   */
  async getSkillStats() {
    const skills = await prisma.skill.findMany({
      where: { isActive: true },
      orderBy: { name: 'asc' },
    });

    const stats = await Promise.all(
      skills.map(async (skill) => {
        const userCount = await prisma.userSkill.count({
          where: { skillId: skill.id },
        });
        return {
          id: skill.id,
          name: skill.name,
          category: skill.category,
          color: skill.color,
          userCount,
        };
      }),
    );

    return stats;
  }
}

export const skillsManager = new SkillsManager();
