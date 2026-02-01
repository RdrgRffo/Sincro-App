import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { format, formatDistanceToNow } from 'date-fns';
import { es } from 'date-fns/locale';
import { formatInTimezone, formatTimeInTimezone, formatDateInTimezone } from './timezone';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/**
 * Formatea una fecha en la zona horaria del navegador del usuario.
 * Para mostrar en la zona horaria de una sucursal, usa formatDateTimeInTz.
 */
export function formatDate(date: string | Date) {
  return format(new Date(date), 'dd/MM/yyyy', { locale: es });
}

/**
 * Formatea fecha y hora en la zona horaria del navegador del usuario.
 * Para mostrar en la zona horaria de una sucursal, usa formatDateTimeInTz.
 */
export function formatDateTime(date: string | Date) {
  return format(new Date(date), "dd/MM/yyyy 'a las' HH:mm", { locale: es });
}

/**
 * Formatea solo hora en la zona horaria del navegador del usuario.
 * Para mostrar en la zona horaria de una sucursal, usa formatTimeInTz.
 */
export function formatTime(date: string | Date) {
  return format(new Date(date), 'HH:mm', { locale: es });
}

/**
 * Formatea fecha y hora en la zona horaria de la sucursal.
 */
export function formatDateTimeInTz(date: string | Date, timezone: string) {
  return formatInTimezone(date, timezone, {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

/**
 * Formatea solo hora en la zona horaria de la sucursal.
 */
export function formatTimeInTz(date: string | Date, timezone: string) {
  return formatTimeInTimezone(date, timezone);
}

/**
 * Formatea solo fecha en la zona horaria de la sucursal.
 */
export function formatDateInTz(date: string | Date, timezone: string) {
  return formatDateInTimezone(date, timezone);
}

export function formatRelative(date: string | Date) {
  return formatDistanceToNow(new Date(date), { addSuffix: true, locale: es });
}

export function getInitials(name: string) {
  return name
    .split(' ')
    .slice(0, 2)
    .map((n) => n[0])
    .join('')
    .toUpperCase();
}

export function getAvatarColor(name: string) {
  const fallbackColors = ['#1e3a5f', '#0d7377', '#6b4fbb', '#c0392b', '#27ae60', '#f39c12', '#2980b9', '#8e44ad'];
  const colors = typeof document !== 'undefined'
    ? [
      getComputedStyle(document.documentElement).getPropertyValue('--theme-sidebar-active-bg').trim() || fallbackColors[0],
      getComputedStyle(document.documentElement).getPropertyValue('--theme-btn-danger-bg').trim() || fallbackColors[1],
      getComputedStyle(document.documentElement).getPropertyValue('--theme-badge-active-text').trim() || fallbackColors[2],
      getComputedStyle(document.documentElement).getPropertyValue('--theme-badge-manager-bg').trim() || fallbackColors[3],
      getComputedStyle(document.documentElement).getPropertyValue('--theme-calendar-active-button').trim() || fallbackColors[4],
      getComputedStyle(document.documentElement).getPropertyValue('--theme-calendar-now-indicator').trim() || fallbackColors[5],
    ]
    : fallbackColors;
  let hash = 0;
  for (const char of name) hash = char.charCodeAt(0) + ((hash << 5) - hash);
  return colors[Math.abs(hash) % colors.length];
}
