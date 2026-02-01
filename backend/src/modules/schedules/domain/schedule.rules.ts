import { addHours, isBefore, differenceInDays, format, getWeek, getISOWeekYear } from 'date-fns';
import { createAppError } from '../../../common/errors/error-catalog';

export function parseOptionalDate(value?: string): Date | undefined {
  if (!value) return undefined;
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    throw createAppError('BAD_REQUEST', 'Rango de fechas inválido');
  }
  return parsed;
}

export function buildOverlapRangeFilter(from?: Date, to?: Date) {
  if (!from && !to) return undefined;

  if (from && to) {
    if (from > to) {
      throw createAppError('BAD_REQUEST', 'El rango de fechas es inválido: from debe ser menor o igual a to');
    }
    return {
      AND: [
        { startDatetime: { lte: to } },
        { endDatetime: { gte: from } },
      ],
    };
  }

  return {
    ...(from ? { endDatetime: { gte: from } } : {}),
    ...(to ? { startDatetime: { lte: to } } : {}),
  };
}

export function ensureValidScheduleRange(startDatetime: Date, endDatetime: Date) {
  if (isBefore(endDatetime, startDatetime)) {
    throw createAppError('BAD_REQUEST', 'La fecha de fin debe ser posterior a la de inicio');
  }
}

export function isLastMinuteSchedule(startDatetime: Date): boolean {
  return isBefore(startDatetime, addHours(new Date(), 24));
}

// ──────────────────────────────────────────────
// Cómputo de horas semanales y horas extra
// ──────────────────────────────────────────────

export interface DailyHours {
  date: string; // "2026-05-04"
  hours: number;
}

export interface WeeklySummary {
  totalHours: number;
  baseHours: number;
  overtimeHours: number;
  dailyBreakdown: Record<string, number>;
}

/**
 * Calcula las horas reales trabajadas en un schedule, desglosadas por día.
 *
 * - Si el schedule es de un solo día: usa hoursPerDay o calcula la duración real.
 * - Si el schedule abarca varios días: prorratea hoursPerDay entre los días.
 * - Si no tiene hoursPerDay, calcula la duración total y la divide entre los días.
 */
export function calculateScheduleDailyHours(
  startDatetime: Date,
  endDatetime: Date,
  hoursPerDay: number | null,
): DailyHours[] {
  const start = new Date(startDatetime);
  const end = new Date(endDatetime);
  const days = differenceInDays(end, start) + 1;

  if (days <= 1) {
    // Un solo día: usar hoursPerDay o calcular duración real
    const hours = hoursPerDay ?? Math.round(((end.getTime() - start.getTime()) / (1000 * 60 * 60)) * 10) / 10;
    return [{
      date: format(start, 'yyyy-MM-dd'),
      hours: Math.round(hours * 10) / 10,
    }];
  }

  // Multi-día: prorratear hoursPerDay entre los días
  const perDay = hoursPerDay
    ? Math.round((hoursPerDay / days) * 10) / 10
    : Math.round(((end.getTime() - start.getTime()) / (1000 * 60 * 60) / days) * 10) / 10;

  return Array.from({ length: days }, (_, i) => {
    const date = new Date(start);
    date.setDate(date.getDate() + i);
    return {
      date: format(date, 'yyyy-MM-dd'),
      hours: perDay,
    };
  });
}

/**
 * Calcula el resumen semanal para un conjunto de schedules.
 *
 * @param schedules - Lista de schedules con sus fechas y hoursPerDay
 * @param baseHours - Jornada base semanal (default 40h)
 * @returns Resumen con totales, horas extra y desglose diario
 */
export function computeWeeklySummary(
  schedules: Array<{ startDatetime: Date; endDatetime: Date; hoursPerDay: number | null }>,
  baseHours: number = 40,
): WeeklySummary {
  const dailyMap = new Map<string, number>();

  for (const schedule of schedules) {
    const dailyHours = calculateScheduleDailyHours(
      schedule.startDatetime,
      schedule.endDatetime,
      schedule.hoursPerDay,
    );
    for (const day of dailyHours) {
      dailyMap.set(day.date, Math.round(((dailyMap.get(day.date) ?? 0) + day.hours) * 10) / 10);
    }
  }

  const totalHours = Math.round(Array.from(dailyMap.values()).reduce((a, b) => a + b, 0) * 10) / 10;
  const overtimeHours = Math.max(0, Math.round((totalHours - baseHours) * 10) / 10);

  return {
    totalHours,
    baseHours,
    overtimeHours,
    dailyBreakdown: Object.fromEntries(dailyMap),
  };
}

/**
 * Obtiene el año y semana ISO a partir de una fecha.
 */
export function getWeekInfo(date: Date): { year: number; week: number } {
  return {
    year: getISOWeekYear(date),
    week: getWeek(date, { weekStartsOn: 1 }),
  };
}
