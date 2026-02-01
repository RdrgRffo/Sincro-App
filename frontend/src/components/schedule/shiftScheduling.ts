import { timezoneToUtc } from '../../lib/timezone';

export type ShiftPreset = {
  id: string;
  name: string;
  startTime: string;
  endTime: string;
};

export type ShiftChunk = {
  startDate: Date;
  endDate: Date;
  presetId: string;
};

/**
 * Normaliza una fecha recibida del DayPicker (hora local) a UTC midnight.
 * El DayPicker devuelve fechas en hora local (ej: 2026-05-20 00:00:00 GMT+1).
 * Para evitar off-by-one al serializar a ISO, convertimos a UTC midnight
 * del mismo día calendario.
 */
export function normalizeDate(value: Date): Date {
  const date = new Date(value);
  // Extraer componentes locales y construir fecha UTC
  return new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate(), 0, 0, 0, 0));
}

export function toIsoDate(value: Date): string {
  return `${value.getUTCFullYear()}-${String(value.getUTCMonth() + 1).padStart(2, '0')}-${String(value.getUTCDate()).padStart(2, '0')}`;
}

export function parseTimeToMinutes(time: string): number {
  const [hours, minutes] = time.split(':').map(Number);
  return (hours || 0) * 60 + (minutes || 0);
}

export function buildDateTime(day: Date, time: string, branchTimezone?: string): Date {
  const [hours, minutes] = time.split(':').map(Number);
  if (branchTimezone) {
    // Usar timezoneToUtc para convertir hora local de la sucursal a UTC
    return timezoneToUtc(
      day.getFullYear(),
      day.getMonth() + 1,
      day.getDate(),
      hours || 0,
      minutes || 0,
      branchTimezone,
    );
  }
  const date = normalizeDate(day);
  date.setUTCHours(hours || 0, minutes || 0, 0, 0);
  return date;
}

export function getPresetDurationHours(preset: ShiftPreset): number {
  const startMinutes = parseTimeToMinutes(preset.startTime);
  const endMinutes = parseTimeToMinutes(preset.endTime);
  const durationMinutes = endMinutes <= startMinutes
    ? 24 * 60 - startMinutes + endMinutes
    : endMinutes - startMinutes;

  return Math.round((durationMinutes / 60) * 10) / 10;
}

export function buildDateRange(start: Date, end: Date): Date[] {
  const dates: Date[] = [];
  const cursor = normalizeDate(start);
  const endDay = normalizeDate(end);

  while (cursor.getTime() <= endDay.getTime()) {
    dates.push(new Date(cursor));
    cursor.setUTCDate(cursor.getUTCDate() + 1);
  }

  return dates;
}

function isNextDay(prev: Date, next: Date): boolean {
  const nextExpected = normalizeDate(prev);
  nextExpected.setUTCDate(nextExpected.getUTCDate() + 1);
  return nextExpected.getTime() === normalizeDate(next).getTime();
}

export function buildScheduleChunks(
  dates: Date[],
  presetByDate: Record<string, string>,
  defaultPresetId: string,
): ShiftChunk[] {
  const sorted = [...dates].sort((a, b) => normalizeDate(a).getTime() - normalizeDate(b).getTime());
  const chunks: ShiftChunk[] = [];

  for (const date of sorted) {
    const key = toIsoDate(date);
    const presetId = presetByDate[key] ?? defaultPresetId;
    const current = chunks[chunks.length - 1];

    if (current && current.presetId === presetId && isNextDay(current.endDate, date)) {
      current.endDate = normalizeDate(date);
      continue;
    }

    chunks.push({
      startDate: normalizeDate(date),
      endDate: normalizeDate(date),
      presetId,
    });
  }

  return chunks;
}

export function buildChunkRange(chunk: ShiftChunk, preset: ShiftPreset, branchTimezone?: string) {
  const start = buildDateTime(chunk.startDate, preset.startTime, branchTimezone);
  let end = buildDateTime(chunk.endDate, preset.endTime, branchTimezone);

  if (end.getTime() <= start.getTime()) {
    end = new Date(end.getTime());
    end.setUTCDate(end.getUTCDate() + 1);
  }

  return {
    start,
    end,
    hoursPerDay: getPresetDurationHours(preset),
  };
}
