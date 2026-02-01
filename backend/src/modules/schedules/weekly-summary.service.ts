import { prisma } from '../../config/database';
import { findSchedules } from './schedules.repository';
import { computeWeeklySummary, getWeekInfo } from './domain/schedule.rules';
import type { WeeklyWorkSummary } from '@prisma/client';

const STANDARD_WORK_DAYS_PER_WEEK = 5;
const DEFAULT_BASE_HOURS = 40;
const DEFAULT_ABSENCE_HOURS_PER_DAY = DEFAULT_BASE_HOURS / STANDARD_WORK_DAYS_PER_WEEK;

function getIsoWeekRange(year: number, week: number): { weekStart: Date; weekEnd: Date } {
  const jan4 = new Date(year, 0, 4);
  const weekStart = new Date(jan4);
  weekStart.setDate(jan4.getDate() - ((jan4.getDay() + 6) % 7) + (week - 1) * 7);
  weekStart.setHours(0, 0, 0, 0);

  const weekEnd = new Date(weekStart);
  weekEnd.setDate(weekStart.getDate() + 6);
  weekEnd.setHours(23, 59, 59, 999);

  return { weekStart, weekEnd };
}

function isWeekday(date: Date): boolean {
  const day = date.getDay();
  return day !== 0 && day !== 6;
}

function countWeekdaysInRange(startDate: Date, endDate: Date): number {
  const current = new Date(startDate);
  current.setHours(0, 0, 0, 0);

  const end = new Date(endDate);
  end.setHours(0, 0, 0, 0);

  let count = 0;
  while (current <= end) {
    if (isWeekday(current)) count += 1;
    current.setDate(current.getDate() + 1);
  }

  return count;
}

async function calculateApprovedAbsenceHours(
  userId: string,
  weekStart: Date,
  weekEnd: Date,
): Promise<number> {
  const approvedAbsences = await prisma.absence.findMany({
    where: {
      employeeId: userId,
      status: 'approved',
      startDate: { lte: weekEnd },
      endDate: { gte: weekStart },
    },
    select: {
      startDate: true,
      endDate: true,
    },
  });

  const absenceWeekdays = approvedAbsences.reduce((total, absence) => {
    const overlapStart = absence.startDate > weekStart ? absence.startDate : weekStart;
    const overlapEnd = absence.endDate < weekEnd ? absence.endDate : weekEnd;
    return total + countWeekdaysInRange(overlapStart, overlapEnd);
  }, 0);

  return Math.min(DEFAULT_BASE_HOURS, absenceWeekdays * DEFAULT_ABSENCE_HOURS_PER_DAY);
}

/**
 * Recalcula el resumen semanal de horas para un usuario en una semana ISO específica.
 *
 * Busca todos los schedules del usuario en esa semana, calcula las horas totales,
 * el desglose diario y las horas extra, y guarda/actualiza el resumen en BD.
 *
 * Esta función es no-bloqueante: se llama con .catch(() => {}) para no interferir
 * con la operación principal (crear/editar/borrar schedule).
 */
export async function recalculateWeeklySummary(
  userId: string,
  year: number,
  week: number,
): Promise<WeeklyWorkSummary> {
  const { weekStart, weekEnd } = getIsoWeekRange(year, week);

  // Obtener todos los schedules del usuario en esa semana
  const schedules = await findSchedules({
    assignments: { some: { userId } },
    AND: [
      { startDatetime: { lte: weekEnd } },
      { endDatetime: { gte: weekStart } },
    ],
  });

  const absenceHours = await calculateApprovedAbsenceHours(userId, weekStart, weekEnd);
  const baseHours = Math.max(0, DEFAULT_BASE_HOURS - absenceHours);

  // Calcular horas totales y extra
  const summary = computeWeeklySummary(
    schedules.map((s) => ({
      startDatetime: s.startDatetime,
      endDatetime: s.endDatetime,
      hoursPerDay: s.hoursPerDay,
    })),
    baseHours,
  );

  // Guardar/actualizar en BD
  return prisma.weeklyWorkSummary.upsert({
    where: { userId_year_week: { userId, year, week } },
    create: {
      userId,
      year,
      week,
      totalHours: summary.totalHours,
      baseHours: summary.baseHours,
      overtimeHours: summary.overtimeHours,
      dailyBreakdown: JSON.stringify(summary.dailyBreakdown),
    },
    update: {
      totalHours: summary.totalHours,
      baseHours: summary.baseHours,
      overtimeHours: summary.overtimeHours,
      dailyBreakdown: JSON.stringify(summary.dailyBreakdown),
      calculatedAt: new Date(),
    },
  });
}

/**
 * Recalcula los resúmenes semanales para todos los usuarios asignados a un schedule.
 * Se llama después de crear, modificar o eliminar un schedule.
 *
 * Como un schedule multi-día puede abarcar dos semanas ISO, recalcula ambas.
 */
export async function recalculateWeeklySummariesForAssignees(
  assigneeIds: string[],
  startDatetime: Date,
  endDatetime: Date,
): Promise<void> {
  const weeks = new Set<string>();

  // Obtener todas las semanas ISO que cubre el schedule
  const startWeek = getWeekInfo(startDatetime);
  const endWeek = getWeekInfo(endDatetime);
  weeks.add(`${startWeek.year}-${startWeek.week}`);
  if (endWeek.year !== startWeek.year || endWeek.week !== startWeek.week) {
    weeks.add(`${endWeek.year}-${endWeek.week}`);
  }

  // Recalcular para cada asignado y cada semana
  const promises: Promise<unknown>[] = [];
  for (const userId of assigneeIds) {
    for (const weekKey of weeks) {
      const [yearStr, weekStr] = weekKey.split('-');
      promises.push(
        recalculateWeeklySummary(userId, parseInt(yearStr, 10), parseInt(weekStr, 10)),
      );
    }
  }

  await Promise.all(promises);
}

/**
 * Recalcula resúmenes cuando una ausencia aprobada cambia el cupo semanal.
 */
export async function recalculateWeeklySummariesForAbsence(
  userId: string,
  startDate: Date,
  endDate: Date,
): Promise<void> {
  await recalculateWeeklySummariesForAssignees([userId], startDate, endDate);
}

/**
 * Obtiene el resumen semanal de un usuario.
 */
export async function getWeeklySummary(
  userId: string,
  year: number,
  week: number,
): Promise<WeeklyWorkSummary | null> {
  return prisma.weeklyWorkSummary.findUnique({
    where: { userId_year_week: { userId, year, week } },
  });
}

/**
 * Obtiene los resúmenes semanales de un usuario para un rango de semanas.
 */
export async function getWeeklySummaries(
  userId: string,
  year: number,
  fromWeek: number,
  toWeek: number,
): Promise<WeeklyWorkSummary[]> {
  return prisma.weeklyWorkSummary.findMany({
    where: {
      userId,
      year,
      week: { gte: fromWeek, lte: toWeek },
    },
    orderBy: { week: 'asc' },
  });
}

/**
 * Resultado del resumen semanal de equipo.
 */
export interface TeamWeeklySummaryItem {
  userId: string;
  userName: string;
  totalHours: number;
  baseHours: number;
  overtimeHours: number;
  dailyBreakdown: Record<string, number>;
}

/**
 * Obtiene los resúmenes semanales de todo un equipo para una semana específica.
 *
 * @param year - Año ISO
 * @param week - Semana ISO
 * @param filters - Filtros opcionales (branchId, departmentId, page, pageSize)
 * @returns Array de resúmenes por usuario
 */
export async function getTeamWeeklySummaries(
  year: number,
  week: number,
  filters?: { branchId?: string; departmentId?: string; page?: number; pageSize?: number },
): Promise<TeamWeeklySummaryItem[]> {
  // Construir filtro de usuarios
  const userWhere: Record<string, unknown> = { status: 'active' };
  if (filters?.branchId) userWhere.branchId = filters.branchId;
  if (filters?.departmentId) userWhere.departmentId = filters.departmentId;

  const take = filters?.pageSize ?? 200;
  const skip = filters?.page ? (filters.page - 1) * take : 0;

  const users = await prisma.user.findMany({
    where: userWhere,
    select: { id: true, name: true },
    orderBy: { name: 'asc' },
    take,
    skip,
  });

  if (users.length === 0) return [];

  const userIds = users.map((u) => u.id);

  // Obtener resúmenes semanales de esos usuarios
  const summaries = await prisma.weeklyWorkSummary.findMany({
    where: {
      userId: { in: userIds },
      year,
      week,
    },
  });

  const summaryMap = new Map(summaries.map((s) => [s.userId, s]));

  return users.map((user) => {
    const summary = summaryMap.get(user.id);
    return {
      userId: user.id,
      userName: user.name,
      totalHours: summary?.totalHours ?? 0,
      baseHours: summary?.baseHours ?? 40,
      overtimeHours: summary?.overtimeHours ?? 0,
      dailyBreakdown: summary?.dailyBreakdown ? JSON.parse(summary.dailyBreakdown) : {},
    };
  });
}

/**
 * Cuenta el total de usuarios activos visibles para el resumen semanal de equipo.
 */
export async function countTeamWeeklySummaries(
  filters?: { branchId?: string; departmentId?: string },
): Promise<number> {
  const userWhere: Record<string, unknown> = { status: 'active' };
  if (filters?.branchId) userWhere.branchId = filters.branchId;
  if (filters?.departmentId) userWhere.departmentId = filters.departmentId;

  return prisma.user.count({ where: userWhere });
}
