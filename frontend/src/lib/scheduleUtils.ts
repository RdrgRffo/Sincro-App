/**
 * Utilidades compartidas para ScheduleCalendar y SchedulePage.
 * Centraliza tipos y funciones duplicadas.
 */

import type { ScheduleTypeValue } from '@/types';

// 7.1: Tipo ScheduleApiLike compartido
export interface ScheduleApiLike {
  id: string;
  title: string;
  startDatetime: string;
  endDatetime: string;
  type: string;
  scheduleTypeId: string;
  color: string;
  location?: string;
  notes?: string;
  isLastMinute: boolean;
  hoursPerDay?: number;
  branchId?: string;
  branch?: { id: string; name: string; code: string; isActive: boolean } | null;
  departmentId?: string;
  department?: { id: string; name: string; code: string } | null;
  createdById: string;
  createdBy: { id: string; name: string };
  createdAt: string;
  updatedAt: string;
  assignments: Array<{
    scheduleId: string;
    userId: string;
    user: {
      id: string;
      name: string;
      email: string;
      avatarUrl?: string;
      department?: { id: string; name: string; code: string; branchId?: string } | null;
      companyPhone?: string;
      auxiliaryPhone?: string;
    };
    assignedAt: string;
  }>;
}

// 7.2: resolveScheduleType compartido
export function resolveScheduleType(type: string, scheduleTypeId?: string): ScheduleTypeValue {
  if (scheduleTypeId) {
    if (scheduleTypeId === 'guardia') return 'guardia';
    if (scheduleTypeId === 'ausencia') return 'ausencia';
    if (scheduleTypeId === 'vacaciones') return 'vacaciones';
    if (scheduleTypeId === 'formacion') return 'formacion';
    if (scheduleTypeId === 'excepcion') return 'excepcion';
  }
  const lower = (type ?? '').toLowerCase();
  if (lower.includes('guardia')) return 'guardia';
  if (lower.includes('ausenc') || lower.includes('absence')) return 'ausencia';
  if (lower.includes('vacac')) return 'vacaciones';
  if (lower.includes('formac')) return 'formacion';
  if (lower.includes('excep')) return 'excepcion';
  return 'otro';
}

// 7.3: toLocalDateOnly compartido
export function toLocalDateOnly(date: Date | string): string {
  const d = typeof date === 'string' ? new Date(date) : date;
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

// 7.4: Oscurecer un color hex en un porcentaje (0-1)
export function darkenColor(hex: string, amount: number): string {
  const normalized = hex.replace('#', '').trim();
  if (normalized.length !== 6 || /[^0-9a-f]/i.test(normalized)) {
    return '#000000';
  }
  const red = Math.max(0, Number.parseInt(normalized.slice(0, 2), 16) * (1 - amount));
  const green = Math.max(0, Number.parseInt(normalized.slice(2, 4), 16) * (1 - amount));
  const blue = Math.max(0, Number.parseInt(normalized.slice(4, 6), 16) * (1 - amount));
  const toHex = (n: number) => Math.round(n).toString(16).padStart(2, '0');
  return `#${toHex(red)}${toHex(green)}${toHex(blue)}`;
}

// 7.5: Comprobar si un evento dura más de 24h (multi‑día)
export function isMultiDayEvent(startDatetime: string, endDatetime: string): boolean {
  const start = new Date(startDatetime);
  const end = new Date(endDatetime);
  const diffMs = end.getTime() - start.getTime();
  return diffMs >= 24 * 60 * 60 * 1000;
}
