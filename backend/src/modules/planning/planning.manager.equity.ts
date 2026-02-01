import { Prisma as PrismaNamespace } from '@prisma/client';
import { prisma } from '../../config/database';
import type { EquityItem, ScopedPlanningRangeFilters, TimelineItem } from './planning.types';
import type { PlanningManagerCore } from './planning.manager.core';
import { overlapWhere, absenceOverlapWhere } from './planning.manager.core';

type AssignmentAggRow = {
  user_id: string;
  total_hours: number | bigint | null;
  weekend_shifts: number | bigint | null;
  urgent_shifts: number | bigint | null;
};

export class PlanningEquityManager {
  constructor(private readonly core: PlanningManagerCore) {}

  /**
   * Calculate fairness indicators for visible users.
   * Assignment stats are aggregated in SQL (MySQL); absence counts use Prisma groupBy.
   */
  async listEquity(filters: ScopedPlanningRangeFilters): Promise<EquityItem[]> {
    const users = await this.core.listUsersInScope(filters);
    const userIds = users.map((user) => user.id);

    const assignmentStats = new Map<string, { totalHours: number; weekendShifts: number; urgentShifts: number }>();
    if (userIds.length > 0) {
      const rawRows = await prisma.$queryRaw<AssignmentAggRow[]>(PrismaNamespace.sql`
        SELECT sa.user_id AS user_id,
          COALESCE(SUM(TIMESTAMPDIFF(SECOND, s.start_datetime, s.end_datetime)) / 3600, 0) AS total_hours,
          SUM(CASE WHEN DAYOFWEEK(s.start_datetime) IN (1, 7) THEN 1 ELSE 0 END) AS weekend_shifts,
          SUM(CASE WHEN s.is_last_minute THEN 1 ELSE 0 END) AS urgent_shifts
        FROM schedule_assignments sa
        INNER JOIN schedules s ON s.id = sa.schedule_id
        WHERE sa.user_id IN (${PrismaNamespace.join(userIds)})
          AND s.start_datetime <= ${filters.to}
          AND s.end_datetime >= ${filters.from}
        GROUP BY sa.user_id
      `);
      const rows = Array.isArray(rawRows) ? rawRows : [];
      rows.forEach((r) => {
        assignmentStats.set(r.user_id, {
          totalHours: Number(r.total_hours ?? 0),
          weekendShifts: Number(r.weekend_shifts ?? 0),
          urgentShifts: Number(r.urgent_shifts ?? 0),
        });
      });
    }

    const absenceCounts = new Map<string, { approved: number; rejected: number }>();
    if (userIds.length > 0) {
      const groups = await prisma.absence.groupBy({
        by: ['employeeId', 'status'],
        where: {
          employeeId: { in: userIds },
          ...absenceOverlapWhere(filters.from, filters.to),
        },
        _count: { _all: true },
      });
      for (const g of groups) {
        const cur = absenceCounts.get(g.employeeId) ?? { approved: 0, rejected: 0 };
        if (g.status === 'approved') cur.approved += g._count._all;
        if (g.status === 'rejected') cur.rejected += g._count._all;
        absenceCounts.set(g.employeeId, cur);
      }
    }

    return users
      .map((user) => {
        const stats = assignmentStats.get(user.id) ?? { totalHours: 0, weekendShifts: 0, urgentShifts: 0 };
        const vac = absenceCounts.get(user.id) ?? { approved: 0, rejected: 0 };
        const totalHours = stats.totalHours;

        return {
          id: user.id,
          name: user.name,
          branch: user.branch,
          department: user.department,
          totalHours,
          overtimeEstimate: Math.max(0, totalHours - 40),
          weekendShifts: stats.weekendShifts,
          urgentShifts: stats.urgentShifts,
          approvedAbsences: vac.approved,
          rejectedAbsences: vac.rejected,
        };
      })
      .sort((a, b) => b.totalHours - a.totalHours);
  }

  /**
   * Build a unified operational timeline.
   */
  async listTimeline(filters: ScopedPlanningRangeFilters): Promise<TimelineItem[]> {
    const [schedules, absences, holidays] = await Promise.all([
      prisma.schedule.findMany({
        where: {
          ...overlapWhere(filters.from, filters.to),
          ...(filters.branchIds ? { branchId: { in: filters.branchIds } } : {}),
        },
        select: {
          id: true,
          title: true,
          startDatetime: true,
          branch: { select: { id: true, name: true } },
          assignments: { select: { user: { select: { id: true, name: true } } } },
        },
        orderBy: { startDatetime: 'asc' },
      }),
      prisma.absence.findMany({
        where: {
          status: 'approved',
          ...(filters.branchIds ? { branchId: { in: filters.branchIds } } : {}),
          ...absenceOverlapWhere(filters.from, filters.to),
        },
        select: {
          startDate: true,
          branchId: true,
          employee: { select: { id: true, name: true } },
        },
        orderBy: { startDate: 'asc' },
      }),
      prisma.branchHoliday.findMany({
        where: {
          isActive: true,
          ...(filters.branchIds ? { branchId: { in: filters.branchIds } } : {}),
          date: { gte: filters.from, lte: filters.to },
        },
        select: {
          date: true,
          name: true,
          branch: { select: { id: true, name: true } },
        },
        orderBy: { date: 'asc' },
      }),
    ]);

    return [
      ...holidays.map((item): TimelineItem => ({
        type: 'holiday',
        at: item.date.toISOString(),
        title: item.name,
        branch: item.branch,
        severity: 'info',
      })),
      ...absences.map((item): TimelineItem => ({
        type: 'absence',
        at: item.startDate.toISOString(),
        title: `${item.employee.name} en ausencia`,
        branchId: item.branchId,
        severity: 'info',
      })),
      ...schedules.map((item): TimelineItem => ({
        type: 'schedule',
        at: item.startDatetime.toISOString(),
        title: item.title,
        branch: item.branch,
        severity: item.assignments.length === 0 ? 'high' : item.assignments.length === 1 ? 'medium' : 'normal',
        assignees: item.assignments.map((assignment) => assignment.user),
      })),
    ].sort((a, b) => new Date(a.at).getTime() - new Date(b.at).getTime());
  }
}
