import { createAppError } from '../../common/errors/error-catalog';
import { prisma } from '../../config/database';
import type { Prisma } from '@prisma/client';
import type { PlanningActor, PlanningRangeFilters, ScopedPlanningRangeFilters } from './planning.types';

type ScheduleWhereInput = Prisma.Args<typeof prisma.schedule, 'findMany'>['where'];
type AbsenceWhereInput = Prisma.Args<typeof prisma.absence, 'findMany'>['where'];
type ScheduleSelect = Prisma.Args<typeof prisma.schedule, 'findMany'>['select'];
type AbsenceSelect = Prisma.Args<typeof prisma.absence, 'findMany'>['select'];
type UserSelect = Prisma.Args<typeof prisma.user, 'findMany'>['select'];
type ScheduleGetPayload<T extends { select: ScheduleSelect }> = NonNullable<Prisma.Result<typeof prisma.schedule, T, 'findUnique'>>;
type AbsenceGetPayload<T extends { select: AbsenceSelect }> = NonNullable<Prisma.Result<typeof prisma.absence, T, 'findUnique'>>;
type UserGetPayload<T extends { select: UserSelect }> = NonNullable<Prisma.Result<typeof prisma.user, T, 'findUnique'>>;

export function unique(values: string[]): string[] {
  return [...new Set(values)];
}

export function getDaysInRange(from: Date, to: Date): Date[] {
  const days: Date[] = [];
  const current = new Date(from);
  current.setUTCHours(0, 0, 0, 0);
  const end = new Date(to);
  end.setUTCHours(0, 0, 0, 0);

  while (current <= end) {
    days.push(new Date(current));
    current.setUTCDate(current.getUTCDate() + 1);
  }
  return days;
}

export function hoursBetween(start: Date, end: Date): number {
  return Math.max(0, (end.getTime() - start.getTime()) / 36e5);
}

export function isWeekend(date: Date): boolean {
  const day = date.getDay();
  return day === 0 || day === 6;
}

export function overlapWhere(from: Date, to: Date): ScheduleWhereInput {
  return {
    AND: [
      { startDatetime: { lte: to } },
      { endDatetime: { gte: from } },
    ],
  };
}

export function absenceOverlapWhere(from: Date, to: Date): AbsenceWhereInput {
  return {
    AND: [
      { startDate: { lte: to } },
      { endDate: { gte: from } },
    ],
  };
}

export const coverageScheduleSelect = {
  id: true,
  title: true,
  startDatetime: true,
  endDatetime: true,
  branch: { select: { id: true, name: true } },
  assignments: { select: { userId: true } },
} satisfies ScheduleSelect;

export type CoverageSchedule = ScheduleGetPayload<{ select: typeof coverageScheduleSelect }>;

export const coverageAbsenceSelect = {
  id: true,
  employeeId: true,
  startDate: true,
  endDate: true,
} satisfies AbsenceSelect;

export type CoverageAbsence = AbsenceGetPayload<{ select: typeof coverageAbsenceSelect }>;

export const planningUserSelect = {
  id: true,
  name: true,
  email: true,
  branchId: true,
  departmentId: true,
  branch: { select: { id: true, name: true } },
  department: { select: { id: true, name: true } },
  skills: {
    include: {
      skill: {
        select: { id: true, name: true, category: true, color: true },
      },
    },
  },
} satisfies UserSelect;

export type PlanningUser = UserGetPayload<{ select: typeof planningUserSelect }>;

export function toPlanningSkills(user: PlanningUser) {
  return user.skills.map((entry) => entry.skill);
}

/**
 * Shared scope resolution and user loading for planning queries.
 */
export class PlanningManagerCore {
  /**
   * Resolve branch scope for planning queries.
   * Admin users can query all branches. Other roles are limited to their own
   * branch plus any visible branches already attached to the actor.
   */
  async resolveScopedFilters(
    filters: PlanningRangeFilters,
    actor: PlanningActor,
  ): Promise<ScopedPlanningRangeFilters> {
    if (actor.roleName === 'admin') {
      return {
        ...filters,
        branchIds: filters.branchId ? [filters.branchId] : undefined,
      };
    }

    const visibleBranchIds = unique([
      actor.branchId,
      ...(actor.visibleBranchIds ?? []),
    ].filter((branchId): branchId is string => Boolean(branchId)));

    if (filters.branchId) {
      if (!visibleBranchIds.includes(filters.branchId)) {
        throw createAppError('FORBIDDEN', 'No puedes consultar esa sucursal');
      }

      return { ...filters, branchIds: [filters.branchId] };
    }

    return {
      ...filters,
      branchIds: visibleBranchIds.length > 0 ? visibleBranchIds : ['__none__'],
    };
  }

  /**
   * Load active users visible to the current planning query.
   * Supports pagination via page/pageSize filters.
   */
  async listUsersInScope(filters: ScopedPlanningRangeFilters): Promise<PlanningUser[]> {
    const where = {
      status: 'active' as const,
      ...(filters.branchIds ? { branchId: { in: filters.branchIds } } : {}),
      ...(filters.departmentId ? { departmentId: filters.departmentId } : {}),
    };

    const take = filters.pageSize ?? 200;
    const skip = filters.page ? (filters.page - 1) * take : 0;

    return prisma.user.findMany({
      where,
      select: planningUserSelect,
      orderBy: { name: 'asc' },
      take,
      skip,
    });
  }

  /**
   * Count active users visible to the current planning query (without pagination).
   */
  async countUsersInScope(filters: ScopedPlanningRangeFilters): Promise<number> {
    return prisma.user.count({
      where: {
        status: 'active',
        ...(filters.branchIds ? { branchId: { in: filters.branchIds } } : {}),
        ...(filters.departmentId ? { departmentId: filters.departmentId } : {}),
      },
    });
  }
}

export const planningManagerCore = new PlanningManagerCore();
