import { isBefore, isAfter, startOfDay, isWeekend } from 'date-fns';
import { createAppError } from '../../../common/errors/error-catalog';

/**
 * Valida que la fecha de inicio no sea anterior a hoy
 */
export function ensureStartDateNotPast(startDate: Date): void {
  const today = startOfDay(new Date());
  if (isBefore(startDate, today)) {
    throw createAppError('BAD_REQUEST', 'La fecha de inicio no puede ser anterior a hoy');
  }
}

/**
 * Valida que ambas fechas sean días laborables
 */
export function ensureWeekdays(startDate: Date, endDate: Date): void {
  if (isWeekend(startDate)) {
    throw createAppError('BAD_REQUEST', 'La fecha de inicio debe ser un día laborable (lunes a viernes)');
  }
  if (isWeekend(endDate)) {
    throw createAppError('BAD_REQUEST', 'La fecha de fin debe ser un día laborable (lunes a viernes)');
  }
}

/**
 * Valida que endDate >= startDate
 */
export function ensureValidDateRange(startDate: Date, endDate: Date): void {
  if (isAfter(startDate, endDate)) {
    throw createAppError('BAD_REQUEST', 'La fecha de fin debe ser igual o posterior a la fecha de inicio');
  }
}

/**
 * Valida que el usuario tenga permiso para aprobar/rechazar una solicitud
 * según su rol y relación con la solicitud
 */
export function ensureCanReview(
  actorRole: string,
  actorBranchId: string | null | undefined,
  actorDepartmentId: string | null | undefined,
  requestBranchId: string | null | undefined,
  requestDepartmentId: string | null | undefined,
  actorVisibleBranchIds?: string[] | null,
): void {
  if (actorRole === 'admin') return; // Admin puede todo

  if (actorRole === 'general_manager') {
    if (!requestBranchId) return;
    const allowedBranches = [
      ...new Set([actorBranchId, ...(actorVisibleBranchIds ?? [])].filter(Boolean) as string[]),
    ];
    if (!allowedBranches.length || !allowedBranches.includes(requestBranchId)) {
      throw createAppError('FORBIDDEN', 'No puedes gestionar ausencias de otra sucursal');
    }
    return;
  }

  if (actorRole === 'department_manager') {
    if (requestDepartmentId && actorDepartmentId && requestDepartmentId !== actorDepartmentId) {
      throw createAppError('FORBIDDEN', 'No puedes gestionar ausencias de otro departamento');
    }
    return;
  }

  throw createAppError('FORBIDDEN', 'No tienes permiso para gestionar ausencias');
}

/**
 * Valida que el empleado pueda cancelar su solicitud
 * (solo si está pending o colindante)
 */
export function ensureCanCancel(status: string): void {
  if (status !== 'pending' && status !== 'colindante') {
    throw createAppError('BAD_REQUEST', 'Solo puedes cancelar solicitudes pendientes o colindantes');
  }
}

/**
 * Valida que la solicitud esté en estado pending o colindante para aprobar/rechazar
 */
export function ensureIsPending(status: string): void {
  if (status !== 'pending' && status !== 'colindante') {
    throw createAppError('BAD_REQUEST', 'La solicitud ya ha sido procesada');
  }
}
