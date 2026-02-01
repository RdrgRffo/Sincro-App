import { Prisma } from '@prisma/client';
import { createAppError } from '../../common/errors/error-catalog';
import { logAuditOrThrow, sanitizeSnapshot } from '../audit/audit.service';
import { executeInTransaction } from '../../common/transactions/transaction.utils';
import { ensureUserRole, downgradeManagerIfLast } from '../common/manager-utils';
import { assertUniqueField } from '../common/reactivation-utils';
import { assertNoDependencies } from '../common/dependency-checks';
import { findSchedules } from '../schedules/schedules.repository';
import { findUserById, updateUserRecord } from '../users/users.repository';
import {
  countAbsencesByBranch,
  countActiveBranches,
  countDepartmentsByBranch,
  countSchedulesByBranch,
  createBranchHolidayRecord,
  createBranchRecord,
  deleteBranchHolidayRecord,
  findBranchByCode,
  findBranchById,
  findBranchCodeConflict,
  findBranchByName,
  findBranchNameConflict,
  findBranchHolidayByIdAndBranch,
  findBranchHolidaysByIds,
  findBranchHolidays,
  findBranches,
  hardDeleteBranchRecord,
  softDeleteBranchRecord,
  deleteBranchHolidaysByIds,
  updateBranchHolidaysByIds,
  updateBranchHolidayRecord,
  updateBranchRecord,
  countBranchesForManager,
  updateBranchManager,
} from './branches.repository';

import { ensureDateRange, normalizeBranchCode, normalizeHolidayDate, resolveHolidayScope } from './domain/branches.rules';
import {
  BranchActor,
  BulkHolidayActionInput,
  GroupedBranchHoliday,
  BranchHolidayInput,
  BranchInput,
  ListBranchHolidaysParams,
  ListBranchesParams,
} from './domain/branches.types';

async function ensureBranch(branchId: string) {
  const branch = await findBranchById(branchId);
  if (!branch) throw createAppError('NOT_FOUND', 'Sucursal no encontrada');
  return branch;
}

function isUniqueViolation(error: unknown) {
  return (
    error instanceof Prisma.PrismaClientKnownRequestError
    && error.code === 'P2002'
  );
}

type BranchHolidayWithBranch = Awaited<ReturnType<typeof findBranchHolidays>>[number];

function buildGroupedHolidayKey(holiday: BranchHolidayWithBranch) {
  return [
    holiday.date.toISOString().slice(0, 10),
    holiday.name.trim().toLowerCase(),
    holiday.type,
    holiday.isPartial ? '1' : '0',
  ].join('|');
}

function groupBranchHolidays(
  holidays: BranchHolidayWithBranch[],
): GroupedBranchHoliday[] {
  const groupedMap = new Map<string, GroupedBranchHoliday>();

  holidays.forEach((holiday) => {
    const key = buildGroupedHolidayKey(holiday);
    const current = groupedMap.get(key);

    if (!current) {
      groupedMap.set(key, {
        id: `shared-${key}`,
        branchId: 'all',
        date: holiday.date,
        originalDate: holiday.originalDate,
        name: holiday.name,
        type: holiday.type,
        scope: holiday.scope as GroupedBranchHoliday['scope'],
        isPartial: holiday.isPartial,
        isActive: holiday.isActive,
        createdAt: holiday.createdAt,
        updatedAt: holiday.updatedAt,
        branch: null,
        holidayIds: [holiday.id],
        branches: holiday.branch ? [{ ...holiday.branch }] : [],
        sharedCount: 1,
      });
      return;
    }

    current.holidayIds.push(holiday.id);
    current.sharedCount += 1;
    if (holiday.updatedAt > current.updatedAt) {
      current.updatedAt = holiday.updatedAt;
    }
    if (holiday.createdAt < current.createdAt) {
      current.createdAt = holiday.createdAt;
    }
    if (holiday.branch && !current.branches.some((branch) => branch.id === holiday.branch.id)) {
      current.branches.push({ ...holiday.branch });
    }
  });

  return [...groupedMap.values()].sort((a, b) => {
    const byDate = a.date.getTime() - b.date.getTime();
    if (byDate !== 0) return byDate;
    return a.name.localeCompare(b.name, 'es');
  });
}

export async function listBranches(params: ListBranchesParams) {
  const baseWhere = params.includeInactive ? {} : { isActive: true };
  const actor = params.actor;
  if (!actor) {
    return findBranches(baseWhere);
  }
  const role = String(actor.roleName ?? '').trim().toLowerCase();
  if (role === 'admin' || role === 'general_manager') {
    return findBranches(baseWhere);
  }
  const ids = [actor.branchId, ...(actor.visibleBranchIds ?? [])].filter((x): x is string => Boolean(x));
  const uniqueIds = [...new Set(ids)];
  if (uniqueIds.length === 0) {
    return [];
  }
  return findBranches({
    ...baseWhere,
    id: { in: uniqueIds },
  });
}

export async function createBranch(data: BranchInput, actor: BranchActor) {
  const code = normalizeBranchCode(data.code);

  const existingByCode = await findBranchByCode(code);
  if (existingByCode) {
    if (!existingByCode.isActive) {
      throw createAppError('CONFLICT',
        `Ya existe una sucursal con el código "${code}" (actualmente desactivada). Reactívala o elige otro código.`);
    }
    throw createAppError('CONFLICT', 'Ya existe una sucursal con ese código');
  }

  const existingByName = await findBranchByName(data.name);
  if (existingByName) {
    if (!existingByName.isActive) {
      throw createAppError('CONFLICT',
        `Ya existe una sucursal con el nombre "${data.name}" (actualmente desactivada). Reactívala o elige otro nombre.`);
    }
    throw createAppError('CONFLICT', 'Ya existe una sucursal con ese nombre');
  }

  return executeInTransaction(async (tx) => {
    const branch = await createBranchRecord({
      ...data,
      code,
      countryCode: data.countryCode?.toUpperCase() ?? 'ES',
      timezone: data.timezone ?? 'Europe/Madrid',
    }, tx);

    await logAuditOrThrow({
      userId: actor.id,
      action: 'CREATE_BRANCH',
      entityType: 'Branch',
      entityId: branch.id,
      detailsJson: { name: branch.name, code: branch.code },
      ipAddress: actor.ipAddress,
    }, tx);

    return branch;
  });
}

export async function updateBranch(branchId: string, data: Partial<BranchInput>, actor: BranchActor) {
  const branch = await ensureBranch(branchId);

  if (data.code) {
    const code = normalizeBranchCode(data.code);
    const conflict = await findBranchCodeConflict(code, branchId);

    if (conflict) {
      throw createAppError('CONFLICT', 'Ya existe una sucursal con ese código');
    }

    data.code = code;
  }

  if (data.name) {
    const conflict = await findBranchNameConflict(data.name, branchId);
    if (conflict) {
      throw createAppError('CONFLICT', 'Ya existe una sucursal con ese nombre');
    }
  }

  return executeInTransaction(async (tx) => {
    const updated = await updateBranchRecord(branchId, {
      ...data,
      ...(data.countryCode ? { countryCode: data.countryCode.toUpperCase() } : {}),
    }, tx);

    await logAuditOrThrow({
      userId: actor.id,
      action: 'UPDATE_BRANCH',
      entityType: 'Branch',
      entityId: branchId,
      detailsJson: {
        before: sanitizeSnapshot({
          id: branch.id,
          name: branch.name,
          code: branch.code,
          address: branch.address,
          city: branch.city,
          region: branch.region,
          countryCode: branch.countryCode,
          timezone: branch.timezone,
          isActive: branch.isActive,
        }),
        after: sanitizeSnapshot({
          id: updated.id,
          name: updated.name,
          code: updated.code,
          address: updated.address,
          city: updated.city,
          region: updated.region,
          countryCode: updated.countryCode,
          timezone: updated.timezone,
          isActive: updated.isActive,
        }),
      },
      ipAddress: actor.ipAddress,
    }, tx);

    return updated;
  });
}

export async function deleteBranch(branchId: string, actor: BranchActor) {
  const branch = await ensureBranch(branchId);

  const activeBranches = await countActiveBranches();
  if (branch.isActive && activeBranches <= 1) {
    throw createAppError('BAD_REQUEST', 'Debe existir al menos una sucursal activa');
  }

  await assertNoDependencies(countDepartmentsByBranch(branchId), 'la sucursal', 'departamento(s)');
  await assertNoDependencies(countSchedulesByBranch(branchId), 'la sucursal', 'turno(s)');
  await assertNoDependencies(countAbsencesByBranch(branchId), 'la sucursal', 'ausencia(s)');

  return executeInTransaction(async (tx) => {
    await softDeleteBranchRecord(branchId, tx);

    await logAuditOrThrow({
      userId: actor.id,
      action: 'DELETE_BRANCH',
      entityType: 'Branch',
      entityId: branchId,
      detailsJson: { name: branch.name, code: branch.code },
      ipAddress: actor.ipAddress,
    }, tx);
  });
}

export async function reactivateBranch(branchId: string, actor: BranchActor) {
  const branch = await ensureBranch(branchId);
  if (branch.isActive) throw createAppError('BAD_REQUEST', 'La sucursal ya está activa');

  await assertUniqueField({
    lookup: (value) => findBranchByCode(value),
    entityLabel: 'sucursal',
    fieldLabel: 'código',
  }, 'code', branch.code, branchId);

  await assertUniqueField({
    lookup: (value) => findBranchByName(value),
    entityLabel: 'sucursal',
    fieldLabel: 'nombre',
  }, 'name', branch.name, branchId);

  return executeInTransaction(async (tx) => {
    const updated = await updateBranchRecord(branchId, { isActive: true }, tx);
    await logAuditOrThrow({
      userId: actor.id,
      action: 'REACTIVATE_BRANCH',
      entityType: 'Branch',
      entityId: branchId,
      detailsJson: { before: sanitizeSnapshot(branch), after: sanitizeSnapshot(updated) },
      ipAddress: actor.ipAddress,
    }, tx);
    return updated;
  });
}

export async function hardDeleteBranch(branchId: string, actor: BranchActor) {
  const branch = await ensureBranch(branchId);

  const activeBranches = await countActiveBranches();
  if (branch.isActive && activeBranches <= 1) {
    throw createAppError('BAD_REQUEST', 'Debe existir al menos una sucursal activa');
  }

  await assertNoDependencies(countDepartmentsByBranch(branchId), 'definitivamente la sucursal', 'departamento(s)');
  await assertNoDependencies(countSchedulesByBranch(branchId), 'definitivamente la sucursal', 'turno(s)');
  await assertNoDependencies(countAbsencesByBranch(branchId), 'definitivamente la sucursal', 'ausencia(s)');

  return executeInTransaction(async (tx) => {
    await hardDeleteBranchRecord(branchId, tx);

    await logAuditOrThrow({
      userId: actor.id,
      action: 'HARD_DELETE_BRANCH',
      entityType: 'Branch',
      entityId: branchId,
      detailsJson: { name: branch.name, code: branch.code },
      ipAddress: actor.ipAddress,
    }, tx);
  });
}

export async function listBranchHolidays(
  branchId: string,
  params: ListBranchHolidaysParams,
) {
  if (branchId !== 'all') {
    await ensureBranch(branchId);
  }

  const { fromDate, toDate } = ensureDateRange(params.from, params.to);

  let dateFilter: Prisma.DateTimeFilter | undefined;
  if (params.year) {
    const yearStart = new Date(params.year, 0, 1);
    const yearEnd = new Date(params.year, 11, 31, 23, 59, 59, 999);
    dateFilter = { gte: yearStart, lte: yearEnd };
  }

  if (fromDate || toDate) {
    dateFilter = {
      ...(dateFilter ?? {}),
      ...(fromDate ? { gte: fromDate } : {}),
      ...(toDate ? { lte: toDate } : {}),
    };
  }

  const holidays = await findBranchHolidays({
    ...(branchId !== 'all' ? { branchId } : {}),
    ...(params.includeInactive ? {} : { isActive: true }),
    ...(dateFilter ? { date: dateFilter } : {}),
  });

  if (branchId === 'all' && params.groupShared) {
    return groupBranchHolidays(holidays);
  }

  return holidays;
}

export async function createBranchHoliday(branchId: string, data: BranchHolidayInput, actor: BranchActor) {
  const branch = await ensureBranch(branchId);
  if (!branch.isActive) throw createAppError('BAD_REQUEST', 'La sucursal está desactivada');

  // Validar que no haya otro festivo en la misma fecha para esta sucursal
  const normalizedDate = normalizeHolidayDate(data.date);
  const existingHolidays = await findBranchHolidays({
    branchId,
    date: normalizedDate,
    isActive: true,
  });
  if (existingHolidays.length > 0) {
    throw createAppError(
      'CONFLICT',
      `Ya existe un festivo en esta fecha para la sucursal "${branch.name}": "${existingHolidays[0].name}"`,
    );
  }

  try {
    return await executeInTransaction(async (tx) => {
      const holiday = await createBranchHolidayRecord({
        branchId,
        date: normalizedDate,
        name: data.name.trim(),
        type: data.type,
        scope: resolveHolidayScope(data)!,
      }, tx);


      await logAuditOrThrow({
        userId: actor.id,
        action: 'CREATE_BRANCH_HOLIDAY',
        entityType: 'BranchHoliday',
        entityId: holiday.id,
        detailsJson: {
          before: null,
          after: {
            id: holiday.id,
            branchId,
            date: holiday.date.toISOString(),
            name: holiday.name,
            type: holiday.type,
            scope: holiday.scope,
            isPartial: holiday.isPartial,
            isActive: holiday.isActive,
          },
        },
        ipAddress: actor.ipAddress,
      }, tx);

      // Verificar si hay schedules existentes en la fecha del feriado
      const holidayDate = normalizeHolidayDate(data.date);
      const dayStart = new Date(holidayDate);
      dayStart.setHours(0, 0, 0, 0);
      const dayEnd = new Date(holidayDate);
      dayEnd.setHours(23, 59, 59, 999);

      const conflictingSchedules = await findSchedules({
        branchId,
        AND: [
          { startDatetime: { lte: dayEnd } },
          { endDatetime: { gte: dayStart } },
        ],
      });

      const result: Record<string, unknown> & { holiday: typeof holiday; warning?: string; conflictingSchedules?: unknown[] } = {
        holiday,
      };

      if (conflictingSchedules.length > 0) {
        result.warning = `Existen ${conflictingSchedules.length} turno(s) programado(s) en esta fecha que podrían verse afectados`;
        result.conflictingSchedules = conflictingSchedules.filter((s): s is NonNullable<typeof s> => s !== null).map((s) => ({
          id: s.id,
          title: s.title,
          startDatetime: s.startDatetime,
          endDatetime: s.endDatetime,
          type: s.scheduleType?.label || 'Turno',
          assignees: s.assignments.map((a) => ({
            id: a.user.id,
            name: a.user.name,
          })),
        }));
      }

      return result;
    });
  } catch (error) {
    if (isUniqueViolation(error)) {
      throw createAppError('CONFLICT', 'Ya existe un festivo con esa fecha y nombre en esta sucursal');
    }
    throw error;
  }
}


export async function updateBranchHoliday(
  branchId: string,
  holidayId: string,
  data: Partial<BranchHolidayInput>,
  actor: BranchActor,
) {
  await ensureBranch(branchId);

  const existing = await findBranchHolidayByIdAndBranch(holidayId, branchId);
  if (!existing) throw createAppError('NOT_FOUND', 'Festivo no encontrado');

  try {
    return await executeInTransaction(async (tx) => {
      const nextScope = resolveHolidayScope(data);

      const updated = await updateBranchHolidayRecord(holidayId, {
        ...(data.date ? { date: normalizeHolidayDate(data.date) } : {}),
        ...(data.name ? { name: data.name.trim() } : {}),
        ...(data.type ? { type: data.type } : {}),
        ...(nextScope ? { scope: nextScope } : {}),
      }, tx);

      await logAuditOrThrow({
        userId: actor.id,
        action: 'UPDATE_BRANCH_HOLIDAY',
        entityType: 'BranchHoliday',
        entityId: holidayId,
        detailsJson: {
          before: {
            id: existing.id,
            branchId: existing.branchId,
            date: existing.date.toISOString(),
            originalDate: existing.originalDate?.toISOString() ?? null,
            name: existing.name,
            type: existing.type,
            scope: existing.scope,
            isPartial: existing.isPartial,
            isActive: existing.isActive,
          },
          after: {
            id: updated.id,
            branchId: updated.branchId,
            date: updated.date.toISOString(),
            originalDate: updated.originalDate?.toISOString() ?? null,
            name: updated.name,
            type: updated.type,
            scope: updated.scope,
            isPartial: updated.isPartial,
            isActive: updated.isActive,
          },
        },
        ipAddress: actor.ipAddress,
      }, tx);

      return updated;
    });
  } catch (error) {
    if (isUniqueViolation(error)) {
      throw createAppError('CONFLICT', 'Ya existe un festivo con esa fecha y nombre en esta sucursal');
    }
    throw error;
  }
}

export async function deleteBranchHoliday(branchId: string, holidayId: string, actor: BranchActor) {
  await ensureBranch(branchId);

  const existing = await findBranchHolidayByIdAndBranch(holidayId, branchId);
  if (!existing) throw createAppError('NOT_FOUND', 'Festivo no encontrado');

  // Verificar si hay schedules solapados en la fecha del festivo
  const holidayDate = existing.date;
  const dayStart = new Date(holidayDate);
  dayStart.setHours(0, 0, 0, 0);
  const dayEnd = new Date(holidayDate);
  dayEnd.setHours(23, 59, 59, 999);

  const conflictingSchedules = await findSchedules({
    branchId,
    AND: [
      { startDatetime: { lte: dayEnd } },
      { endDatetime: { gte: dayStart } },
    ],
  });

  if (conflictingSchedules.length > 0) {
    throw createAppError(
      'BAD_REQUEST',
      `No se puede eliminar el festivo: ${conflictingSchedules.length} turno(s) están programados en esta fecha. Reasigna o elimina los turnos primero.`,
      { conflictingSchedules: conflictingSchedules.length },
    );
  }

  return executeInTransaction(async (tx) => {
    await deleteBranchHolidayRecord(holidayId, tx);

    await logAuditOrThrow({
      userId: actor.id,
      action: 'DELETE_BRANCH_HOLIDAY',
      entityType: 'BranchHoliday',
      entityId: holidayId,
      detailsJson: {
        before: {
          id: existing.id,
          branchId: existing.branchId,
          date: existing.date.toISOString(),
          originalDate: existing.originalDate?.toISOString() ?? null,
          name: existing.name,
          type: existing.type,
          scope: existing.scope,
          isPartial: existing.isPartial,
          isActive: existing.isActive,
        },
        after: null,
      },
      ipAddress: actor.ipAddress,
    }, tx);
  });
}

export async function bulkUpdateSharedHolidays(
  data: BulkHolidayActionInput,
  actor: BranchActor,
) {
  const uniqueIds = [...new Set(data.holidayIds)];
  const nextScope = resolveHolidayScope(data);

  await executeInTransaction(async (tx) => {
    const holidays = await findBranchHolidaysByIds(uniqueIds, tx);
    if (holidays.length !== uniqueIds.length) {
      throw createAppError('NOT_FOUND', 'Uno o más festivos no existen');
    }

    await updateBranchHolidaysByIds(
      uniqueIds,
      {
        ...(data.date ? { date: normalizeHolidayDate(data.date) } : {}),
        ...(data.name ? { name: data.name.trim() } : {}),
        ...(data.type ? { type: data.type } : {}),
        ...(nextScope ? { scope: nextScope } : {}),
        ...(data.isPartial !== undefined ? { isPartial: data.isPartial } : {}),
      },
      tx,
    );

    await logAuditOrThrow({
      userId: actor.id,
      action: 'BULK_UPDATE_BRANCH_HOLIDAY',
      entityType: 'BranchHoliday',
      entityId: 'all',
      detailsJson: {
        holidayIds: uniqueIds,
        updates: {
          ...(data.date ? { date: normalizeHolidayDate(data.date).toISOString() } : {}),
          ...(data.name ? { name: data.name.trim() } : {}),
          ...(data.type ? { type: data.type } : {}),
          ...(nextScope ? { scope: nextScope } : {}),
          ...(data.isPartial !== undefined ? { isPartial: data.isPartial } : {}),
        },
      },
      ipAddress: actor.ipAddress,
    }, tx);
  });
}

export async function bulkDeleteSharedHolidays(
  holidayIds: string[],
  actor: BranchActor,
) {
  const uniqueIds = [...new Set(holidayIds)];

  await executeInTransaction(async (tx) => {
    const holidays = await findBranchHolidaysByIds(uniqueIds, tx);
    if (holidays.length !== uniqueIds.length) {
      throw createAppError('NOT_FOUND', 'Uno o más festivos no existen');
    }

    await deleteBranchHolidaysByIds(uniqueIds, tx);

    await logAuditOrThrow({
      userId: actor.id,
      action: 'BULK_DELETE_BRANCH_HOLIDAY',
      entityType: 'BranchHoliday',
      entityId: 'all',
      detailsJson: {
        holidayIds: uniqueIds,
        deletedCount: uniqueIds.length,
      },
      ipAddress: actor.ipAddress,
    }, tx);
  });
}

/**
 * Asigna un manager a una sucursal dentro de una transacción única.
 * Si el usuario no tiene el rol 'general_manager', se le otorga.
 * Genera auditoría atómica.
 */
export async function assignBranchManager(
  branchId: string,
  userId: string,
  actor: BranchActor,
) {
  const branch = await ensureBranch(branchId);
  const user = await findUserById(userId);
  if (!user) throw createAppError('NOT_FOUND', 'Usuario no encontrado');

  if (branch.managerId === userId) {
    throw createAppError('BAD_REQUEST', 'Este usuario ya es manager de esta sucursal');
  }

  return executeInTransaction(async (tx) => {
    // 1. Actualizar sucursal
    const updatedBranch = await updateBranchManager(branchId, userId, tx);

    // 2. Otorgar rol si no lo tiene
    await ensureUserRole(userId, 'general_manager', tx);

    // 3. Actualizar branchId del usuario
    await updateUserRecord(userId, { branchId }, tx);

    // 4. Auditoría
    await logAuditOrThrow({
      userId: actor.id,
      action: 'ASSIGN_BRANCH_MANAGER',
      entityType: 'Branch',
      entityId: branchId,
      detailsJson: {
        branchName: updatedBranch.name,
        managerName: user.name,
        managerId: userId,
      },
      ipAddress: actor.ipAddress,
    }, tx);

    return updatedBranch;
  });
}

/**
 * Remueve un manager de una sucursal dentro de una transacción única.
 * Si el usuario no es manager de otras sucursales, se le quita el rol 'employee'.
 * Genera auditoría atómica.
 */
export async function removeBranchManager(
  branchId: string,
  actor: BranchActor,
) {
  const branch = await ensureBranch(branchId);
  if (!branch.managerId) {
    throw createAppError('BAD_REQUEST', 'Esta sucursal no tiene un manager asignado');
  }

  const managerId = branch.managerId;
  const manager = await findUserById(managerId);
  if (!manager) throw createAppError('NOT_FOUND', 'Manager no encontrado');

  return executeInTransaction(async (tx) => {
    // 1. Remover manager de la sucursal
    const updatedBranch = await updateBranchManager(branchId, null, tx);

    // 2. Limpiar branchId del usuario si coincide con esta sucursal
    if (manager.branchId === branchId) {
      await updateUserRecord(managerId, { branchId: null }, tx);
    }

    // 3. Si no es manager de ninguna otra, quitar el rol
    const remainingBranches = await countBranchesForManager(managerId, tx);
    await downgradeManagerIfLast(managerId, (t) => countBranchesForManager(managerId, t), tx);

    // 4. Auditoría
    await logAuditOrThrow({
      userId: actor.id,
      action: 'REMOVE_BRANCH_MANAGER',
      entityType: 'Branch',
      entityId: branchId,
      detailsJson: {
        branchName: updatedBranch.name,
        formerManagerName: manager.name,
        formerManagerId: managerId,
        stillManagerOfOtherBranches: remainingBranches > 0,
      },
      ipAddress: actor.ipAddress,
    }, tx);

    return updatedBranch;
  });
}
