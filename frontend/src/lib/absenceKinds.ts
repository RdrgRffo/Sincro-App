import type { AbsenceKind } from '@/types';

export const ABSENCE_KIND_LABELS: Record<AbsenceKind, string> = {
  vacaciones: 'Vacaciones',
  asuntos_propios: 'Asuntos propios',
  formacion: 'Formación',
  permiso_retribuido: 'Permiso retribuido',
  cumpleanos: 'Cumpleaños',
  baja_medica: 'Baja médica',
  maternidad: 'Maternidad',
  paternidad: 'Paternidad',
  compensatorio: 'Compensatorio',
  festivo: 'Festivo',
};

/** Orden del selector al solicitar ausencia (casos frecuentes primero). */
const ABSENCE_KIND_SELECT_ORDER: AbsenceKind[] = [
  'vacaciones',
  'asuntos_propios',
  'permiso_retribuido',
  'compensatorio',
  'formacion',
  'cumpleanos',
  'festivo',
  'baja_medica',
  'maternidad',
  'paternidad',
];

export const ABSENCE_KIND_OPTIONS: { value: AbsenceKind; label: string }[] = ABSENCE_KIND_SELECT_ORDER.map(
  (value) => ({ value, label: ABSENCE_KIND_LABELS[value] }),
);
