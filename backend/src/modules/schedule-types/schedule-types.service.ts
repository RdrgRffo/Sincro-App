import { prisma } from '../../config/database';
import { createAppError } from '../../common/errors/error-catalog';
import { logAuditOrThrow, sanitizeSnapshot } from '../audit/audit.service';
import { executeInTransaction } from '../../common/transactions/transaction.utils';
import type { CreateScheduleTypeInput, UpdateScheduleTypeInput } from './schedule-types.http.schemas';

type ScheduleTypeActor = { id?: string; ipAddress?: string };

export async function getScheduleTypes(options?: { includeInactive?: boolean }) {
  return prisma.scheduleType.findMany({
    where: options?.includeInactive ? undefined : { isActive: true },
    orderBy: { createdAt: 'asc' },
  });
}

export async function getScheduleTypeById(id: string) {
  const scheduleType = await prisma.scheduleType.findUnique({
    where: { id, isActive: true },
  });

  if (!scheduleType) {
    throw createAppError('NOT_FOUND', 'Tipo de turno no encontrado');
  }

  return scheduleType;
}

export async function createScheduleType(input: CreateScheduleTypeInput, actor?: ScheduleTypeActor) {
  // Check if value already exists
  const existing = await prisma.scheduleType.findUnique({
    where: { value: input.value },
  });

  if (existing && existing.isActive) {
    throw createAppError('BAD_REQUEST', 'Ya existe un tipo de turno con este valor');
  }

  if (existing && !existing.isActive) {
    // Si el tipo de turno existe pero está inactivo, lo reactivamos con los nuevos datos
    return executeInTransaction(async (tx) => {
      const updated = await tx.scheduleType.update({
        where: { id: existing.id },
        data: { ...input, isActive: true },
      });
      await logAuditOrThrow({
        userId: actor?.id,
        action: 'UPDATE_SCHEDULE_TYPE',
        entityType: 'ScheduleType',
        entityId: existing.id,
        ipAddress: actor?.ipAddress,
        detailsJson: { before: sanitizeSnapshot(existing), after: sanitizeSnapshot(updated) },
      }, tx);
      return updated;
    });
  }

  return executeInTransaction(async (tx) => {
    const scheduleType = await tx.scheduleType.create({ data: input });
    await logAuditOrThrow({
      userId: actor?.id,
      action: 'CREATE_SCHEDULE_TYPE',
      entityType: 'ScheduleType',
      entityId: scheduleType.id,
      ipAddress: actor?.ipAddress,
      detailsJson: { before: null, after: sanitizeSnapshot(scheduleType) },
    }, tx);
    return scheduleType;
  });
}

export async function updateScheduleType(id: string, input: UpdateScheduleTypeInput, actor?: ScheduleTypeActor) {
  const scheduleType = await getScheduleTypeById(id);

  // Check if updating value and it conflicts
  if (input.value && input.value !== scheduleType.value) {
    const existing = await prisma.scheduleType.findUnique({
      where: { value: input.value },
    });
    if (existing) {
      throw createAppError('BAD_REQUEST', 'Ya existe un tipo de turno con este valor');
    }
  }

  return executeInTransaction(async (tx) => {
    const updated = await tx.scheduleType.update({ where: { id }, data: input });
    await logAuditOrThrow({
      userId: actor?.id,
      action: 'UPDATE_SCHEDULE_TYPE',
      entityType: 'ScheduleType',
      entityId: id,
      ipAddress: actor?.ipAddress,
      detailsJson: { before: sanitizeSnapshot(scheduleType), after: sanitizeSnapshot(updated) },
    }, tx);
    return updated;
  });
}

export async function deleteScheduleType(id: string, actor?: ScheduleTypeActor) {
  const scheduleType = await getScheduleTypeById(id);

  // Check if it's being used by schedules
  const usageCount = await prisma.schedule.count({
    where: { scheduleTypeId: id },
  });

  if (usageCount > 0) {
    throw createAppError('BAD_REQUEST', 'No se puede eliminar un tipo de turno que está siendo usado por horarios existentes');
  }

  return executeInTransaction(async (tx) => {
    const updated = await tx.scheduleType.update({
      where: { id },
      data: { isActive: false },
    });
    await logAuditOrThrow({
      userId: actor?.id,
      action: 'DELETE_SCHEDULE_TYPE',
      entityType: 'ScheduleType',
      entityId: id,
      ipAddress: actor?.ipAddress,
      detailsJson: { before: sanitizeSnapshot(scheduleType), after: sanitizeSnapshot(updated) },
    }, tx);
    return updated;
  });
}

export async function reactivateScheduleType(id: string, actor?: ScheduleTypeActor) {
  const scheduleType = await prisma.scheduleType.findUnique({ where: { id } });
  if (!scheduleType) throw createAppError('NOT_FOUND', 'Tipo de turno no encontrado');
  if (scheduleType.isActive) throw createAppError('BAD_REQUEST', 'El tipo de turno ya está activo');

  // Check if value conflicts with another active type
  const conflicting = await prisma.scheduleType.findUnique({ where: { value: scheduleType.value } });
  if (conflicting && conflicting.id !== id && conflicting.isActive) {
    throw createAppError('CONFLICT', `Ya existe un tipo de turno activo con el valor "${scheduleType.value}"`);
  }

  return executeInTransaction(async (tx) => {
    const updated = await tx.scheduleType.update({
      where: { id },
      data: { isActive: true },
    });
    await logAuditOrThrow({
      userId: actor?.id,
      action: 'UPDATE_SCHEDULE_TYPE',
      entityType: 'ScheduleType',
      entityId: id,
      ipAddress: actor?.ipAddress,
      detailsJson: { before: sanitizeSnapshot(scheduleType), after: sanitizeSnapshot(updated) },
    }, tx);
    return updated;
  });
}
