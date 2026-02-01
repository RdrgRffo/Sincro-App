import { createAppError } from '../../common/errors/error-catalog';
import { prisma } from '../../config/database';
import type {
  CoverageRiskItem,
  PlanningActor,
  ScopedPlanningRangeFilters,
  AbsenceImpact,
} from './planning.types';
import type { AbsenceImpactQueryInput } from './planning.validation';
import type { PlanningManagerCore } from './planning.manager.core';
import {
  coverageScheduleSelect,
  coverageAbsenceSelect,
  overlapWhere,
  unique,
  absenceOverlapWhere,
  type CoverageSchedule,
  type CoverageAbsence,
} from './planning.manager.core';

function toCoverageRisk(
  schedule: CoverageSchedule,
  absencesByUserId: Map<string, CoverageAbsence[]>,
): CoverageRiskItem | null {
  const assignedCount = schedule.assignments.length;
  const absenceConflicts = schedule.assignments.flatMap((assignment) =>
    absencesByUserId.get(assignment.userId) ?? [],
  );

  if (assignedCount >= 2 && absenceConflicts.length === 0) return null;

  return {
    severity: assignedCount === 0 || absenceConflicts.length > 0 ? 'high' : 'medium',
    reasons: [
      ...(assignedCount === 0 ? ['Turno descubierto'] : []),
      ...(assignedCount === 1 ? ['Turno con una sola persona asignada'] : []),
      ...(absenceConflicts.length > 0
        ? [`${absenceConflicts.length} asignado(s) con ausencias aprobadas`]
        : []),
    ],
    schedule: {
      id: schedule.id,
      title: schedule.title,
      startDatetime: schedule.startDatetime.toISOString(),
      endDatetime: schedule.endDatetime.toISOString(),
      branch: schedule.branch,
    },
    ...(absenceConflicts.length > 0
      ? {
          absenceConflicts: absenceConflicts.map((absence) => ({
            userId: absence.employeeId,
            absenceId: absence.id,
            startDate: absence.startDate.toISOString(),
            endDate: absence.endDate.toISOString(),
          })),
        }
      : {}),
  };
}

export class PlanningCoverageManager {
  constructor(private readonly core: PlanningManagerCore) {}

  /**
   * List coverage risks in the requested planning range.
   */
  async listCoverageRisks(
    filters: ScopedPlanningRangeFilters,
    _actor: PlanningActor,
  ): Promise<CoverageRiskItem[]> {
    const schedules = await prisma.schedule.findMany({
      where: {
        ...overlapWhere(filters.from, filters.to),
        ...(filters.branchIds ? { branchId: { in: filters.branchIds } } : {}),
      },
      select: coverageScheduleSelect,
      orderBy: { startDatetime: 'asc' },
    });

    const assignedUserIds = unique(schedules.flatMap((schedule) =>
      schedule.assignments.map((assignment) => assignment.userId),
    ));
    const approvedAbsences = assignedUserIds.length > 0
      ? await prisma.absence.findMany({
          where: {
            employeeId: { in: assignedUserIds },
            status: 'approved',
            ...absenceOverlapWhere(filters.from, filters.to),
          },
          select: coverageAbsenceSelect,
        })
      : [];
    const absencesByUserId = new Map<string, CoverageAbsence[]>();
    approvedAbsences.forEach((absence) => {
      const current = absencesByUserId.get(absence.employeeId) ?? [];
      current.push(absence);
      absencesByUserId.set(absence.employeeId, current);
    });

    return schedules
      .map((schedule) => toCoverageRisk(schedule, absencesByUserId))
      .filter((risk): risk is CoverageRiskItem => risk !== null);
  }

  /**
   * Estimate absence request impact and potential conflicts.
   */
  async getAbsenceImpact(filters: AbsenceImpactQueryInput, actor: PlanningActor): Promise<AbsenceImpact> {
    const employeeId = filters.employeeId ?? actor.id;
    const employee = await prisma.user.findUnique({
      where: { id: employeeId },
      select: {
        id: true,
        name: true,
        branchId: true,
        departmentId: true,
        branch: { select: { id: true, name: true } },
        department: { select: { id: true, name: true } },
      },
    });
    if (!employee) throw createAppError('NOT_FOUND', 'Empleado no encontrado');

    const scoped = await this.core.resolveScopedFilters({
      from: filters.startDate,
      to: filters.endDate,
      branchId: employee.branchId ?? undefined,
      departmentId: employee.departmentId ?? undefined,
    }, actor);

    const [overlappingAbsences, assignedSchedules, holidays] = await Promise.all([
      prisma.absence.findMany({
        where: {
          employeeId: { not: employee.id },
          branchId: employee.branchId ?? undefined,
          departmentId: employee.departmentId ?? undefined,
          status: { in: ['approved', 'pending'] },
          ...absenceOverlapWhere(filters.startDate, filters.endDate),
        },
        select: {
          id: true,
          status: true,
          employeeId: true,
          startDate: true,
          endDate: true,
          employee: { select: { id: true, name: true } },
        },
      }),
      prisma.scheduleAssignment.findMany({
        where: {
          userId: employee.id,
          schedule: {
            ...overlapWhere(filters.startDate, filters.endDate),
            ...(scoped.branchIds ? { branchId: { in: scoped.branchIds } } : {}),
          },
        },
        select: {
          schedule: {
            select: {
              id: true,
              title: true,
              startDatetime: true,
              endDatetime: true,
            },
          },
        },
      }),
      prisma.branchHoliday.findMany({
        where: {
          branchId: employee.branchId ?? undefined,
          isActive: true,
          date: { gte: filters.startDate, lte: filters.endDate },
        },
        select: { id: true, name: true, date: true },
      }),
    ]);

    const hardConflicts =
      assignedSchedules.length + overlappingAbsences.filter((item) => item.status === 'approved').length;
    const likelihood: AbsenceImpact['likelihood'] =
      hardConflicts >= 2 ? 'low' : hardConflicts === 1 || overlappingAbsences.length > 0 ? 'medium' : 'high';

    return {
      employee: {
        id: employee.id,
        name: employee.name,
        branch: employee.branch,
        department: employee.department,
      },
      overlappingAbsences: overlappingAbsences.map((item) => ({
        ...item,
        startDate: item.startDate.toISOString(),
        endDate: item.endDate.toISOString(),
      })),
      assignedSchedules: assignedSchedules.map((item) => ({
        ...item.schedule,
        startDatetime: item.schedule.startDatetime.toISOString(),
        endDatetime: item.schedule.endDatetime.toISOString(),
      })),
      holidays: holidays.map((item) => ({ ...item, date: item.date.toISOString() })),
      likelihood,
      summary:
        likelihood === 'high'
          ? 'Parece viable con los datos actuales'
          : likelihood === 'medium'
            ? 'Requiere revisión por solapes o turnos asignados'
            : 'Riesgo alto: hay varios conflictos antes de aprobar',
    };
  }
}
