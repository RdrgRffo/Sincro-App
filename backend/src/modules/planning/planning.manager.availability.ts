import { prisma } from '../../config/database';
import type {
  AvailabilityItem,
  AvailabilityMatrix,
  PlanningActor,
  ScopedPlanningRangeFilters,
  SubstituteSuggestion,
  TemplatePreviewDay,
} from './planning.types';
import type { PlanningManagerCore } from './planning.manager.core';
import {
  getDaysInRange,
  hoursBetween,
  isWeekend,
  overlapWhere,
  toPlanningSkills,
  absenceOverlapWhere,
} from './planning.manager.core';

export class PlanningAvailabilityManager {
  constructor(private readonly core: PlanningManagerCore) {}

  /**
   * List employee availability in the requested planning range.
   */
  async listAvailability(
    filters: ScopedPlanningRangeFilters,
    _actor: PlanningActor,
  ): Promise<AvailabilityItem[]> {
    const users = await this.core.listUsersInScope(filters);

    const userIds = users.map((u) => u.id);

    const schedules = await prisma.schedule.findMany({
      where: {
        ...overlapWhere(filters.from, filters.to),
        assignments: { some: { userId: { in: userIds } } },
      },
      select: {
        id: true,
        startDatetime: true,
        endDatetime: true,
        assignments: { select: { userId: true } },
      },
    });

    const absences = await prisma.absence.findMany({
      where: {
        employeeId: { in: userIds },
        status: 'approved',
        ...absenceOverlapWhere(filters.from, filters.to),
      },
      select: {
        id: true,
        employeeId: true,
        startDate: true,
        endDate: true,
      },
    });

    const days = getDaysInRange(filters.from, filters.to);

    const schedulesByUserId = new Map<string, typeof schedules>();
    schedules.forEach((s) => {
      s.assignments.forEach((a) => {
        const current = schedulesByUserId.get(a.userId) ?? [];
        current.push(s);
        schedulesByUserId.set(a.userId, current);
      });
    });

    const absencesByUserId = new Map<string, typeof absences>();
    absences.forEach((v) => {
      const current = absencesByUserId.get(v.employeeId) ?? [];
      current.push(v);
      absencesByUserId.set(v.employeeId, current);
    });

    return users.map((user) => {
      const userSchedules = schedulesByUserId.get(user.id) ?? [];
      const userAbsences = absencesByUserId.get(user.id) ?? [];

      const availabilityDays = days.map((day) => {
        const dayStart = new Date(day);
        const dayEnd = new Date(day);
        dayEnd.setUTCHours(23, 59, 59, 999);

        // Normalizar fechas de ausencias (date-only) a UTC midnight para comparación correcta
        const isOnAbsence = userAbsences.some((v) => {
          const absenceStart = new Date(v.startDate);
          absenceStart.setUTCHours(0, 0, 0, 0);
          const absenceEnd = new Date(v.endDate);
          absenceEnd.setUTCHours(23, 59, 59, 999);
          return absenceStart <= dayEnd && absenceEnd >= dayStart;
        });
        if (isOnAbsence) return { date: day.toISOString(), status: 'absence' as const };

        const isBusy = userSchedules.some(
          (s) => s.startDatetime <= dayEnd && s.endDatetime >= dayStart,
        );
        if (isBusy) return { date: day.toISOString(), status: 'busy' as const };

        return { date: day.toISOString(), status: 'available' as const };
      });

      return {
        userId: user.id,
        userName: user.name,
        email: user.email,
        branch: user.branch,
        department: user.department,
        skills: toPlanningSkills(user),
        status: userAbsences.length > 0 ? 'absence' : userSchedules.length > 0 ? 'busy' : 'available',
        schedulesCount: userSchedules.length,
        absencesCount: userAbsences.length,
        days: availabilityDays,
      };
    });
  }

  /**
   * Build the daily availability matrix in the requested planning range.
   */
  async getAvailabilityMatrix(
    filters: ScopedPlanningRangeFilters,
    _actor: PlanningActor,
  ): Promise<AvailabilityMatrix> {
    const users = await this.core.listUsersInScope(filters);

    const userIds = users.map((u) => u.id);

    const schedules = await prisma.schedule.findMany({
      where: {
        ...overlapWhere(filters.from, filters.to),
        assignments: { some: { userId: { in: userIds } } },
      },
      select: {
        id: true,
        title: true,
        startDatetime: true,
        endDatetime: true,
        assignments: { select: { userId: true } },
      },
    });

    const absences = await prisma.absence.findMany({
      where: {
        employeeId: { in: userIds },
        status: 'approved',
        ...absenceOverlapWhere(filters.from, filters.to),
      },
      select: {
        id: true,
        employeeId: true,
        startDate: true,
        endDate: true,
      },
    });

    const days = getDaysInRange(filters.from, filters.to);

    const schedulesByUserId = new Map<string, typeof schedules>();
    schedules.forEach((s) => {
      s.assignments.forEach((a) => {
        const current = schedulesByUserId.get(a.userId) ?? [];
        current.push(s);
        schedulesByUserId.set(a.userId, current);
      });
    });

    const absencesByUserId = new Map<string, typeof absences>();
    absences.forEach((v) => {
      const current = absencesByUserId.get(v.employeeId) ?? [];
      current.push(v);
      absencesByUserId.set(v.employeeId, current);
    });

    const rows = users.map((user) => {
      const userSchedules = schedulesByUserId.get(user.id) ?? [];
      const userAbsences = absencesByUserId.get(user.id) ?? [];

      const availabilityDays = days.map((day) => {
        const dayStart = new Date(day);
        const dayEnd = new Date(day);
        dayEnd.setUTCHours(23, 59, 59, 999);

        // Normalizar fechas de ausencias (date-only) a UTC midnight para comparación correcta
        const isOnAbsence = userAbsences.some((v) => {
          const absenceStart = new Date(v.startDate);
          absenceStart.setUTCHours(0, 0, 0, 0);
          const absenceEnd = new Date(v.endDate);
          absenceEnd.setUTCHours(23, 59, 59, 999);
          return absenceStart <= dayEnd && absenceEnd >= dayStart;
        });
        if (isOnAbsence) return { date: day.toISOString(), status: 'absence' as const, schedules: [] };

        const busySchedules = userSchedules.filter(
          (s) => s.startDatetime <= dayEnd && s.endDatetime >= dayStart,
        );
        if (busySchedules.length > 0) {
          return {
            date: day.toISOString(),
            status: 'busy' as const,
            schedules: busySchedules.map(s => ({ id: s.id, title: s.title })),
          };
        }

        return { date: day.toISOString(), status: 'available' as const, schedules: [] };
      });

      return {
        id: user.id,
        name: user.name,
        branch: user.branch,
        department: user.department,
        skills: toPlanningSkills(user),
        days: availabilityDays,
      };
    });

    return {
      days: days.map(day => day.toISOString()),
      rows: rows,
    };
  }

  /**
   * Rank available substitutes using required skills and recent workload.
   */
  async listSubstituteSuggestions(
    filters: ScopedPlanningRangeFilters & { skillIds?: string[] },
    actor: PlanningActor,
  ): Promise<SubstituteSuggestion[]> {
    const availability = await this.listAvailability(filters, actor);
    const requiredSkillIds = new Set(filters.skillIds ?? []);
    const userIds = availability.map((user) => user.userId);
    const lookback = new Date(filters.from.getTime() - 60 * 24 * 60 * 60 * 1000);

    const recentAssignments = userIds.length > 0
      ? await prisma.scheduleAssignment.findMany({
          where: {
            userId: { in: userIds },
            schedule: {
              startDatetime: { gte: lookback },
              endDatetime: { lte: filters.to },
            },
          },
          include: { schedule: true },
        })
      : [];

    const statsByUserId = new Map<string, { hours: number; weekends: number; urgent: number }>();
    recentAssignments.forEach((item) => {
      const current = statsByUserId.get(item.userId) ?? { hours: 0, weekends: 0, urgent: 0 };
      current.hours += hoursBetween(item.schedule.startDatetime, item.schedule.endDatetime);
      if (isWeekend(item.schedule.startDatetime)) current.weekends += 1;
      if (item.schedule.isLastMinute) current.urgent += 1;
      statsByUserId.set(item.userId, current);
    });

    return availability
      .filter((user) => user.status === 'available')
      .map((user) => {
        const skills = user.skills ?? [];
        const matchedSkills = skills.filter((skill) => requiredSkillIds.has(skill.id));
        const equity = statsByUserId.get(user.userId) ?? { hours: 0, weekends: 0, urgent: 0 };
        const sameBranchBonus = user.branch?.id && filters.branchIds?.includes(user.branch.id) ? 6 : 0;
        const skillScore = requiredSkillIds.size === 0 ? 4 : matchedSkills.length * 12;
        const loadPenalty = Math.floor(equity.hours / 20) + (equity.weekends * 2) + (equity.urgent * 2);
        const score = Math.max(0, skillScore + sameBranchBonus - loadPenalty);

        const overtimeEstimate = Math.max(0, equity.hours - 40);

        return {
          id: user.userId,
          name: user.userName,
          email: user.email ?? '',
          branch: user.branch,
          department: user.department,
          skills,
          matchedSkills,
          score,
          equity: {
            ...equity,
            overtimeEstimate,
          },
          reasons: [
            matchedSkills.length > 0
              ? `${matchedSkills.length} skill(s) coinciden`
              : requiredSkillIds.size > 0
                ? 'Sin skills requeridas'
                : 'Disponible en el rango',
            sameBranchBonus > 0 ? 'Misma sucursal visible' : 'Sucursal de apoyo',
            overtimeEstimate > 0
              ? `${Math.round(overtimeEstimate)}h extra disponibles`
              : `${Math.round(equity.hours)}h recientes, ${equity.weekends} finde, ${equity.urgent} urgentes`,
          ],
        };
      })
      .sort((a, b) => b.score - a.score || a.name.localeCompare(b.name, 'es'));
  }

  /**
   * Preview coverage candidates for each day in the requested range.
   */
  async getTemplatePreview(
    filters: ScopedPlanningRangeFilters & { skillIds?: string[]; minCoverage: number },
    actor: PlanningActor,
  ): Promise<TemplatePreviewDay[]> {
    const matrix = await this.getAvailabilityMatrix(filters, actor);
    const requiredSkillIds = new Set(filters.skillIds ?? []);
    const minCoverage = Math.max(1, filters.minCoverage);

    return matrix.days.map((date) => {
      const available = matrix.rows
        .filter((row) => row.days.find((day) => day.date === date)?.status === 'available')
        .map((row) => {
          const matchedSkills = row.skills.filter((skill) => requiredSkillIds.has(skill.id));
          return {
            id: row.id,
            name: row.name,
            branch: row.branch,
            department: row.department,
            matchedSkills,
            score: requiredSkillIds.size > 0 ? matchedSkills.length * 10 : 3,
          };
        })
        .sort((a, b) => b.score - a.score || a.name.localeCompare(b.name, 'es'));

      return {
        date,
        minCoverage,
        recommended: available.slice(0, minCoverage),
        backups: available.slice(minCoverage, minCoverage + 3),
        status: available.length >= minCoverage ? 'covered' : available.length > 0 ? 'partial' : 'uncovered',
      };
    });
  }
}
