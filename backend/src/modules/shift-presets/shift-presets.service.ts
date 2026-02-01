import { prisma } from '../../config/database';
import { createAppError } from '../../common/errors/error-catalog';
import { executeInTransaction } from '../../common/transactions/transaction.utils';
import { logAuditOrThrow, sanitizeSnapshot } from '../audit/audit.service';
import { assertUniqueField } from '../common/reactivation-utils';
import { createScheduleEntry } from '../schedules/schedules.service';
import type { CreateShiftPresetInput, UpdateShiftPresetInput, ApplyShiftPresetInput, PreviewShiftPresetInput } from './shift-presets.http.schemas';

export async function listShiftPresets(options?: { includeInactive?: boolean }) {
  return prisma.shiftPreset.findMany({
    where: options?.includeInactive ? undefined : { isActive: true },
    orderBy: { name: 'asc' },
  });
}

export async function getShiftPresetById(id: string) {
  const preset = await prisma.shiftPreset.findUnique({ where: { id } });
  if (!preset) throw createAppError('NOT_FOUND', 'Shift preset no encontrado');
  return preset;
}

export async function createShiftPreset(data: CreateShiftPresetInput, actorId: string) {
  return executeInTransaction(async (tx) => {
    const preset = await tx.shiftPreset.create({ data });
    await logAuditOrThrow({
      userId: actorId,
      action: 'CREATE_SHIFT_PRESET',
      entityType: 'ShiftPreset',
      entityId: preset.id,
      detailsJson: { before: null, after: sanitizeSnapshot(preset) },
    }, tx);
    return preset;
  });
}

export async function updateShiftPreset(id: string, data: UpdateShiftPresetInput, actorId: string) {
  return executeInTransaction(async (tx) => {
    const before = await tx.shiftPreset.findUnique({ where: { id } });
    const preset = await tx.shiftPreset.update({ where: { id }, data });
    await logAuditOrThrow({
      userId: actorId,
      action: 'UPDATE_SHIFT_PRESET',
      entityType: 'ShiftPreset',
      entityId: id,
      detailsJson: { before: sanitizeSnapshot(before), after: sanitizeSnapshot(preset) },
    }, tx);
    return preset;
  });
}

export async function deleteShiftPreset(id: string, actorId: string) {
  const before = await prisma.shiftPreset.findUnique({ where: { id } });
  if (!before) throw createAppError('NOT_FOUND', 'Shift preset no encontrado');

  // Nota: ShiftPreset no tiene relación FK directa con Schedule en el schema actual.
  // Si en el futuro se añade, debe verificarse aquí que ningún schedule lo esté usando.

  return executeInTransaction(async (tx) => {
    const preset = await tx.shiftPreset.update({
      where: { id },
      data: { isActive: false },
    });
    await logAuditOrThrow({
      userId: actorId,
      action: 'DELETE_SHIFT_PRESET',
      entityType: 'ShiftPreset',
      entityId: id,
      detailsJson: { before: sanitizeSnapshot(before), after: sanitizeSnapshot(preset) },
    }, tx);
    return preset;
  });
}



export async function reactivateShiftPreset(id: string, actor: { id: string; ipAddress?: string }) {
  return executeInTransaction(async (tx) => {
    const before = await tx.shiftPreset.findUnique({ where: { id } });
    if (!before) throw createAppError('NOT_FOUND', 'Shift preset no encontrado');
    if (before.isActive) throw createAppError('BAD_REQUEST', 'El preset de turno ya está activo');

    await assertUniqueField({
      lookup: (value) => tx.shiftPreset.findFirst({ where: { name: value } }),
      entityLabel: 'preset de turno',
      fieldLabel: 'nombre',
    }, 'name', before.name, id);

    const preset = await tx.shiftPreset.update({
      where: { id },
      data: { isActive: true },
    });
    await logAuditOrThrow({
      userId: actor.id,
      action: 'UPDATE_SHIFT_PRESET',
      entityType: 'ShiftPreset',
      entityId: id,
      detailsJson: { before: sanitizeSnapshot(before), after: sanitizeSnapshot(preset) },
      ipAddress: actor.ipAddress,
    }, tx);
    return preset;
  });
}

/**
 * Genera los días laborables entre startDate y endDate, excluyendo fines de semana si corresponde.
 */
function generateBusinessDays(startDate: Date, endDate: Date, excludeWeekends: boolean): Date[] {
  const days: Date[] = [];
  const current = new Date(startDate);
  current.setHours(0, 0, 0, 0);
  const end = new Date(endDate);
  end.setHours(23, 59, 59, 999);

  while (current <= end) {
    const dayOfWeek = current.getDay();
    if (!excludeWeekends || (dayOfWeek !== 0 && dayOfWeek !== 6)) {
      days.push(new Date(current));
    }
    current.setDate(current.getDate() + 1);
  }
  return days;
}

/**
 * @description Aplica un preset de turno a un rango de fechas, generando schedules para los asignados.
 * Cada día laborable genera un schedule con el horario del preset.
 */
export async function applyShiftPreset(
  presetId: string,
  input: ApplyShiftPresetInput,
  actor: { id: string; roleName: string; email: string; name: string; branchId?: string | null; visibleBranchIds?: string[]; ipAddress?: string },
) {
  const preset = await prisma.shiftPreset.findUnique({ where: { id: presetId } });
  if (!preset) throw createAppError('NOT_FOUND', 'Shift preset no encontrado');
  if (!preset.isActive) throw createAppError('BAD_REQUEST', 'El preset de turno está desactivado');

  const { startDate, endDate, branchId, scheduleTypeId, assigneeIds, excludeWeekends, hoursPerDay, title, color, location, notes, reason } = input;

  // Validar que el scheduleType existe
  const scheduleType = await prisma.scheduleType.findUnique({ where: { id: scheduleTypeId } });
  if (!scheduleType) throw createAppError('BAD_REQUEST', 'Tipo de turno no encontrado');

  // Validar que la sucursal existe
  const branch = await prisma.branch.findUnique({ where: { id: branchId } });
  if (!branch) throw createAppError('NOT_FOUND', 'Sucursal no encontrada');
  if (!branch.isActive) throw createAppError('BAD_REQUEST', 'La sucursal está desactivada');

  // Validar que los assignees existen
  const users = await prisma.user.findMany({
    where: { id: { in: assigneeIds }, isActive: true },
    select: { id: true },
  });
  if (users.length !== assigneeIds.length) {
    const foundIds = new Set(users.map(u => u.id));
    const missingIds = assigneeIds.filter(id => !foundIds.has(id));
    throw createAppError('BAD_REQUEST', `Los siguientes usuarios no existen o están inactivos: ${missingIds.join(', ')}`);
  }

  // Generar días laborables
  const days = generateBusinessDays(startDate, endDate, excludeWeekends ?? true);

  if (days.length === 0) {
    throw createAppError('BAD_REQUEST', 'El rango de fechas no contiene días laborables');
  }

  // Crear schedules para cada día
  const createdSchedules = [];
  for (const day of days) {
    const [startHour, startMinute] = preset.startTime.split(':').map(Number);
    const [endHour, endMinute] = preset.endTime.split(':').map(Number);

    const startDatetime = new Date(day);
    startDatetime.setHours(startHour, startMinute, 0, 0);

    const endDatetime = new Date(day);
    endDatetime.setHours(endHour, endMinute, 0, 0);

    // Si endTime es menor que startTime, asumimos que cruza la medianoche
    if (endDatetime <= startDatetime) {
      endDatetime.setDate(endDatetime.getDate() + 1);
    }

    const schedule = await createScheduleEntry({
      title: title || `Turno: ${preset.name}`,
      startDatetime,
      endDatetime,
      scheduleTypeId,
      color: color || scheduleType.color,
      location: location || undefined,
      notes: notes || undefined,
      branchId,
      assigneeIds,
      hoursPerDay: hoursPerDay ?? 8,
      confirmed: false,
      reason,
    }, actor);

    createdSchedules.push(schedule);
  }

  return {
    totalCreated: createdSchedules.length,
    schedules: createdSchedules,
  };
}

/**
 * @description Previsualiza los días que se generarían al aplicar un preset, sin crear schedules.
 */
export async function previewShiftPreset(
  presetId: string,
  input: PreviewShiftPresetInput,
) {
  const preset = await prisma.shiftPreset.findUnique({ where: { id: presetId } });
  if (!preset) throw createAppError('NOT_FOUND', 'Shift preset no encontrado');

  const { startDate, endDate, excludeWeekends } = input;

  const days = generateBusinessDays(startDate, endDate, excludeWeekends ?? true);

  return {
    presetId: preset.id,
    presetName: preset.name,
    startTime: preset.startTime,
    endTime: preset.endTime,
    totalDays: days.length,
    days: days.map(d => d.toISOString().split('T')[0]),
    dateRange: {
      start: startDate.toISOString().split('T')[0],
      end: endDate.toISOString().split('T')[0],
    },
    excludeWeekends: excludeWeekends ?? true,
  };
}
