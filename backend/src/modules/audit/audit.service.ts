import { AuditParams, IRREVERSIBLE_ACTIONS, AuditDetails } from './domain/audit.types';
import type { Prisma } from '@prisma/client';
import { prisma } from '../../config/database';
import * as auditRepository from './audit.repository';
import * as scheduleRepository from '../schedules/schedules.repository';
import * as userRepository from '../users/users.repository';
import { AppError } from '../../common/errors/app-error';
import type { AuditSortBy, SortOrder } from './audit.repository';
import { executeInTransaction, TransactionClient } from '../../common/transactions/transaction.utils';
import { REALTIME_EVENTS } from '../../realtime/events';
import { publishRealtimeEvent } from '../../realtime/socket';
import { extractUsernameFromEmail } from '../users/domain/user.factory';

export * from './domain/audit.types';

/**
 * @description Exporta logs de auditoría a formato CSV.
 */
export async function exportAuditLogsCsv(params: {
  from?: Date;
  to?: Date;
  userId?: string;
  userName?: string;
  action?: string;
  entityType?: string;
  reversible?: 'true' | 'false';
  userDepartment?: string;
  branchId?: string;
}): Promise<string> {
  const auditWhere: auditRepository.AuditLogWhere = {};
  if (params.userId) auditWhere.userId = params.userId;
  const actionFilter: Prisma.StringFilter = {};
  if (params.action) actionFilter.contains = params.action;
  if (params.entityType) auditWhere.entityType = params.entityType;
  if (params.from || params.to) {
    auditWhere.createdAt = {
      ...(params.from && { gte: params.from }),
      ...(params.to && { lte: params.to }),
    };
  }
  if (params.userName) {
    auditWhere.user = { ...(auditWhere.user as Record<string, unknown> || {}), name: { contains: params.userName } };
  }
  if (params.userDepartment) {
    auditWhere.user = { ...(auditWhere.user as Record<string, unknown> || {}), departmentId: params.userDepartment };
  }
  if (params.branchId) {
    auditWhere.user = { ...(auditWhere.user as Record<string, unknown> || {}), branchId: params.branchId };
  }
  if (params.reversible === 'true') {
    actionFilter.notIn = [...IRREVERSIBLE_ACTIONS];
  } else if (params.reversible === 'false') {
    delete actionFilter.contains;
    actionFilter.in = IRREVERSIBLE_ACTIONS.filter(a => a !== 'ROLLBACK_PERFORMED');
  }
  if (Object.keys(actionFilter).length > 0) {
    auditWhere.action = actionFilter;
  }

  // Obtener todos los logs sin paginación para exportación
  const logs = await prisma.auditLog.findMany({
    where: auditWhere,
    include: {
      user: { select: { id: true, name: true, email: true } },
      rolledBackBy: { select: { id: true, name: true } },
    },
    orderBy: { createdAt: 'desc' },
  });

  // Generar CSV
  const headers = ['ID', 'Fecha', 'Usuario', 'Email', 'Acción', 'Entidad', 'ID Entidad', 'IP', 'Revertido Por', 'Revertido En'];
  const rows = logs.map((log) => [
    log.id,
    log.createdAt.toISOString(),
    log.user?.name ?? '',
    log.user?.email ?? '',
    log.action,
    log.entityType ?? '',
    log.entityId ?? '',
    log.ipAddress ?? '',
    log.rolledBackBy?.name ?? '',
    log.rolledBackAt?.toISOString() ?? '',
  ]);

  const csvContent = [
    headers.join(','),
    ...rows.map((row) => row.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(',')),
  ].join('\n');

  return csvContent;
}

function buildAuditCreateData(params: AuditParams) {
  return {
    userId: params.userId,
    action: params.action,
    entityType: params.entityType,
    entityId: params.entityId,
    detailsJson: params.detailsJson ? JSON.stringify(params.detailsJson) : undefined,
    ipAddress: params.ipAddress,
    userAgent: params.userAgent,
  };
}

function parseDetails(detailsJson: string | null): AuditDetails | null {
  if (!detailsJson) return null;
  try {
    const parsed = JSON.parse(detailsJson);
    if (isObjectRecord(parsed)) {
      return parsed as AuditDetails;
    }
    return null;
  } catch {
    return null;
  }
}

function isObjectRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isIrreversibleAction(action: string): action is (typeof IRREVERSIBLE_ACTIONS)[number] {
  return (IRREVERSIBLE_ACTIONS as readonly string[]).includes(action);
}

function optionalDate(value: unknown): Date | null {
  if (!value) return null;
  return new Date(value as string);
}

function restoreTimestampedScalarSnapshot(snapshot: Record<string, unknown>) {
  const { id: _id, createdAt: _createdAt, updatedAt: _updatedAt, ...data } = snapshot;
  return data;
}

function extractPermissionNames(value: unknown): string[] {
  if (!Array.isArray(value)) return [];

  return value
    .map((permission) => {
      if (typeof permission === 'string') return permission;
      if (isObjectRecord(permission) && typeof permission.name === 'string') return permission.name;
      return null;
    })
    .filter((name): name is string => Boolean(name));
}

/** Desinfecta los payloads de auditoría eliminando campos comprometedores (passwords, tokens) mediante recorrido recursivo. */
export function sanitizeSnapshot<T>(data: T): T {
  if (!data) return data;
  const sanitized = JSON.parse(JSON.stringify(data)) as unknown; // Clonación profunda simple
  
  const sensitiveFields = ['passwordHash', 'password', 'token', 'refreshToken'];
  
  const removeSensitive = (obj: unknown): void => {
    if (Array.isArray(obj)) {
      for (const item of obj) {
        removeSensitive(item);
      }
      return;
    }

    if (!isObjectRecord(obj)) return;

    for (const key of Object.keys(obj)) {
      if (sensitiveFields.includes(key)) {
        delete obj[key];
      } else {
        removeSensitive(obj[key]);
      }
    }
  };

  removeSensitive(sanitized);
  return sanitized as T;
}

/**
 * @description Inserta un log de auditoría forzando su permanencia (fail-fast) dentro de un bloque transaccional Prisma.
 * @param params @param tx
 */
export async function logAuditOrThrow(params: AuditParams, tx: TransactionClient) {
  const created = await auditRepository.createAuditLog(buildAuditCreateData(params), tx);
  
  publishRealtimeEvent(REALTIME_EVENTS.AUDIT_CREATED, {
    entity: 'audit',
    action: 'created',
    id: created.id,
    changedAt: created.createdAt.toISOString(),
    actorId: created.userId,
    meta: {
      action: created.action,
      entityType: created.entityType,
      entityId: created.entityId,
    },
  });
}

/**
 * @description Emite un registro de auditoría flexible: si falla fuera de una transacción, no corrompe la ejecución principal subyacente.
 * @param params @param tx
 */
export async function logAudit(params: AuditParams, tx?: TransactionClient) {
  if (tx) {
    await logAuditOrThrow(params, tx);
    return;
  }

  try {
    const created = await auditRepository.createAuditLog(buildAuditCreateData(params));
    publishRealtimeEvent(REALTIME_EVENTS.AUDIT_CREATED, {
      entity: 'audit',
      action: 'created',
      id: created.id,
      changedAt: created.createdAt.toISOString(),
      actorId: created.userId,
      meta: {
        action: created.action,
        entityType: created.entityType,
        entityId: created.entityId,
      },
    });
  } catch {
    // Audit failures must not break the main flow outside atomic transactions
  }
}

/** Paginador del historial que soporta filtros complejos (fechas, entidad, actor, departamento, sucursal y flag reversible/irreversible). */
export async function listAuditLogs(params: {
  page: number;
  limit: number;
  userId?: string;
  userName?: string;
  action?: string;
  entityType?: string;
  from?: Date;
  to?: Date;
  reversible?: 'true' | 'false';
  userDepartment?: string;
  branchId?: string;
  sortBy?: AuditSortBy;
  sortOrder?: SortOrder;
}) {
  const auditWhere: auditRepository.AuditLogWhere = {};
  if (params.userId) auditWhere.userId = params.userId;
  const actionFilter: Prisma.StringFilter = {};
  if (params.action) actionFilter.contains = params.action;
  if (params.entityType) auditWhere.entityType = params.entityType;
  if (params.from || params.to) {
    auditWhere.createdAt = {
      ...(params.from && { gte: params.from }),
      ...(params.to && { lte: params.to }),
    };
  }
  // Filtro por nombre del usuario que realizó la acción (búsqueda parcial)
  if (params.userName) {
    auditWhere.user = { ...(auditWhere.user as Record<string, unknown> || {}), name: { contains: params.userName } };
  }
  // Filtro por departamento del usuario que realizó la acción
  if (params.userDepartment) {
    auditWhere.user = {
      ...(auditWhere.user as Record<string, unknown> || {}),
      departmentId: params.userDepartment,
    };
  }
  // Filtro por sucursal del usuario que realizó la acción
  if (params.branchId) {
    auditWhere.user = { ...(auditWhere.user as Record<string, unknown> || {}), branchId: params.branchId };
  }
  // Filtros de pestaña: reversible vs irreversible
  if (params.reversible === 'true') {
    actionFilter.notIn = [...IRREVERSIBLE_ACTIONS];
  } else if (params.reversible === 'false') {
    delete actionFilter.contains;
    // Excluir ROLLBACK_PERFORMED de los logs de seguridad ya que se visualiza en la acción original
    actionFilter.in = IRREVERSIBLE_ACTIONS.filter(a => a !== 'ROLLBACK_PERFORMED');
  }

  if (Object.keys(actionFilter).length > 0) {
    auditWhere.action = actionFilter;
  }

  const { logs, total } = await auditRepository.findAuditLogs(
    auditWhere,
    params.page,
    params.limit,
    params.sortBy ?? 'createdAt',
    params.sortOrder ?? 'desc',
  );

  return {
    logs: logs.map(log => ({
      ...log,
      detailsJson: parseDetails(log.detailsJson),
    })),
    total,
  };
}

/**
 * @description Retorna el log decodificado y sanitizado de la base de datos o revienta (404) si no existe.
 * @param id
 */
export async function getAuditLogById(id: string) {
  const log = await auditRepository.findAuditLogById(id);
  if (!log) {
    throw new AppError('NOT_FOUND', 404, 'Registro de auditoría no encontrado');
  }

  return {
    ...log,
    detailsJson: parseDetails(log.detailsJson),
  };
}

/**
 * @description Restaura un evento manipulado (creación/edición) inyectando el snapshot state-before dentro del contenedor. Emite su propio Audit.
 * @param logId @param actorId @param ipAddress
 */
export async function rollbackAudit(logId: string, actorId: string, ipAddress?: string) {
  const log = await auditRepository.findAuditLogById(logId);
  if (!log) throw new AppError('NOT_FOUND', 404, 'Log no encontrado');

  const details = parseDetails(log.detailsJson);
  if (!details && !log.action.startsWith('CREATE')) {
    throw new AppError('BAD_REQUEST', 400, 'Este log no contiene información para un rollback (JSON inválido)');
  }
  // Acciones que no almacenan snapshot "before" pero tienen su propia lógica de rollback
  const ACTIONS_WITHOUT_BEFORE = new Set([
    'DELETE_BRANCH',
    'HARD_DELETE_BRANCH',
    'ASSIGN_BRANCH_MANAGER',
    'REMOVE_BRANCH_MANAGER',
  ]);
  if (!details?.before && !log.action.startsWith('CREATE') && !ACTIONS_WITHOUT_BEFORE.has(log.action)) {
    throw new AppError('BAD_REQUEST', 400, 'Este log no contiene información suficiente para un rollback (falta snapshot "before")');
  }

  // Verificar si la acción es irreversible o ya ha sido revertida
  if (isIrreversibleAction(log.action)) {
    throw new AppError('BAD_REQUEST', 400, `La acción "${log.action}" no puede ser revertida`);
  }

  if ((log as any).rolledBackAt) {
    throw new AppError('BAD_REQUEST', 400, 'Este cambio ya ha sido revertido');
  }

  return executeInTransaction(async (tx) => {
    const { entityId, entityType, action } = log;
    if (!entityId) throw new AppError('INTERNAL_ERROR', 500, 'El log no tiene un entityId asociado');

    let rollbackResult;
    let rollbackMetadata: Record<string, unknown> | undefined;

    // Lógica por tipo de entidad y acción
    if (entityType === 'Schedule') {
      if (action === 'CREATE_SCHEDULE') {
        await scheduleRepository.deleteSchedule(entityId, tx);
      } else if (details?.before && (action === 'UPDATE_SCHEDULE' || action === 'DELETE_SCHEDULE')) {
        const beforeState = details.before as Record<string, unknown>;
        const { assigneeIds, id: _id, createdAt: _createdAt, updatedAt: _updatedAt, ...rawScalars } = beforeState;
        // Convertir tipos: los snapshots vienen como JSON (strings, no Date)
        const upsertData: Record<string, unknown> = {
          title: rawScalars.title,
          description: rawScalars.description ?? null,
          startDatetime: new Date(rawScalars.startDatetime as string),
          endDatetime: new Date(rawScalars.endDatetime as string),
          color: rawScalars.color,
          location: rawScalars.location ?? null,
          notes: rawScalars.notes ?? null,
          isLastMinute: Boolean(rawScalars.isLastMinute),
          hoursPerDay: typeof rawScalars.hoursPerDay === 'number' ? rawScalars.hoursPerDay : Number(rawScalars.hoursPerDay ?? 8),
          branchId: rawScalars.branchId ?? null,
          createdById: rawScalars.createdById as string,
          scheduleTypeId: rawScalars.scheduleTypeId as string,
        };
        rollbackResult = await tx.schedule.upsert({
          where: { id: entityId },
          create: { ...upsertData, id: entityId } as any,
          update: upsertData as any,
        });

        // Restaurar asignaciones
        if (assigneeIds && Array.isArray(assigneeIds)) {
          await scheduleRepository.replaceAssignments(entityId, assigneeIds as string[], tx);
        }


        // Emitir evento de tiempo real para que Calendario se actualice
        publishRealtimeEvent(REALTIME_EVENTS.SCHEDULE_UPDATED, {
          entity: 'schedule',
          action: 'updated',
          id: entityId,
          changedAt: new Date().toISOString(),
          actorId,
        });
      }
    } else if (entityType === 'User') {
      if (action === 'CREATE_USER') {
        // En este sistema los usuarios se deshabilitan, pero un rollback de creación podría ser un borrado real o deshabilitado.
        // Optamos por deshabilitarlo para evitar romper integridad referencial si ya se usó.
        rollbackResult = await tx.user.update({
          where: { id: entityId },
          data: { status: 'disabled', isActive: false },
          select: { id: true, name: true, email: true, status: true, isActive: true },
        });

        publishRealtimeEvent(REALTIME_EVENTS.USER_DELETED, {
          entity: 'user',
          action: 'deleted',
          id: entityId,
          changedAt: new Date().toISOString(),
          actorId,
        });
      } else if (action === 'ASSIGN_USER_SKILLS') {
        // Revertir asignación de skills: restaurar el array de IDs del snapshot "before"
        const beforeSkills = details?.before as Array<{ skillId?: string; skill?: { id?: string } }> | null;
        const previousSkillIds: string[] = (beforeSkills ?? [])
          .map((us) => us.skillId ?? us.skill?.id)
          .filter((id): id is string => Boolean(id));

        await tx.userSkill.deleteMany({ where: { userId: entityId } });
        if (previousSkillIds.length > 0) {
          await tx.userSkill.createMany({
            data: previousSkillIds.map((skillId) => ({
              userId: entityId,
              skillId,
              assignedById: actorId,
            })),
            skipDuplicates: true,
          });
        }
        rollbackResult = await tx.userSkill.findMany({
          where: { userId: entityId },
          include: { skill: true },
          orderBy: { assignedAt: 'asc' },
        });

        publishRealtimeEvent(REALTIME_EVENTS.USER_UPDATED, {
          entity: 'user',
          action: 'updated',
          id: entityId,
          changedAt: new Date().toISOString(),
          actorId,
        });
      } else {
        // UPDATE_USER, USER_STATUS_CHANGE, USER_ROLE_CHANGE, DELETE_USER
        const data: Partial<Prisma.UserGetPayload<{}>> = { ...details?.before };
        // Si el snapshot a restaurar tiene un email, nos aseguramos de recalcular el derivedUsername
        // para mantener la consistencia, por si el snapshot es antiguo y no lo tenía.
        if (data.email && typeof data.email === 'string') {
          const isAnonymized = data.email.startsWith('revoked_');
          data.derivedUsername = isAnonymized ? data.email : extractUsernameFromEmail(data.email);
        }
        rollbackResult = await userRepository.updateUserRecord(entityId, data, tx);

        publishRealtimeEvent(REALTIME_EVENTS.USER_UPDATED, {
          entity: 'user',
          action: 'updated',
          id: entityId,
          changedAt: new Date().toISOString(),
          actorId,
        });
      }
    } else if (entityType === 'WebhookConfig') {
      if (action === 'CREATE_WEBHOOK') {
        rollbackResult = await tx.webhookConfig.delete({ where: { id: entityId } });
      } else if (details?.before) {
        const beforeState = details.before as Prisma.WebhookConfigGetPayload<{}>;
        const { id, createdAt, updatedAt, ...data } = beforeState;
        rollbackMetadata = {
          snapshotId: id,
          snapshotCreatedAt: createdAt,
          snapshotUpdatedAt: updatedAt,
        };

        rollbackResult = await tx.webhookConfig.upsert({
          where: { id: entityId },
          create: { ...beforeState, id: entityId },
          update: data,
        });
      }
    } else if (entityType === 'Branch') {
      if (action === 'CREATE_BRANCH') {
        // Revertir creación: soft-delete de la sucursal
        rollbackResult = await tx.branch.update({ where: { id: entityId }, data: { isActive: false } });
      } else if (action === 'UPDATE_BRANCH' && details?.before) {
        // Revertir actualización: restaurar snapshot "before"
        const beforeState = details.before as Record<string, unknown>;
        const data = restoreTimestampedScalarSnapshot(beforeState);
        rollbackResult = await tx.branch.upsert({
          where: { id: entityId },
          create: { ...data, id: entityId } as any,
          update: data as any,
        });
      } else if (action === 'DELETE_BRANCH') {
        // Revertir soft-delete: volver a activar la sucursal
        rollbackResult = await tx.branch.update({ where: { id: entityId }, data: { isActive: true } });
      } else if (action === 'HARD_DELETE_BRANCH') {
        throw new AppError(
          'CONFLICT',
          409,
          'No se puede revertir un borrado físico de sucursal: el registro ya no existe en la base de datos',
        );
      } else if (action === 'ASSIGN_BRANCH_MANAGER') {
        // Revertir asignación de manager: quitar el manager de la sucursal
        rollbackResult = await tx.branch.update({ where: { id: entityId }, data: { managerId: null } });
      } else if (action === 'REMOVE_BRANCH_MANAGER') {
        // Revertir eliminación de manager: restaurar al ex-manager
        const formerManagerId = (details as Record<string, unknown> | null)?.formerManagerId as string | undefined;
        if (!formerManagerId) {
          throw new AppError('BAD_REQUEST', 400, 'Snapshot insuficiente: no se encontró el ID del ex-manager para revertir');
        }
        rollbackResult = await tx.branch.update({ where: { id: entityId }, data: { managerId: formerManagerId } });
      } else {
        throw new AppError('BAD_REQUEST', 400, `Rollback no soportado para Branch y acción ${action}`);
      }
    } else if (entityType === 'BranchHoliday') {
      if (action === 'CREATE_BRANCH_HOLIDAY') {
        // Revertir creación: eliminar el festivo
        rollbackResult = await tx.branchHoliday.delete({ where: { id: entityId } });
      } else if (details?.before) {
        // UPDATE_BRANCH_HOLIDAY o DELETE_BRANCH_HOLIDAY: restaurar desde snapshot "before"
        const beforeState = details.before as Record<string, unknown>;

        rollbackResult = await tx.branchHoliday.upsert({
          where: { id: entityId },
          create: {
            id: entityId,
            branchId: beforeState.branchId as string,
            date: new Date(beforeState.date as string),
            ...(beforeState.originalDate ? { originalDate: new Date(beforeState.originalDate as string) } : {}),
            name: beforeState.name as string,
            type: beforeState.type as any,
            scope: beforeState.scope as string,
            isPartial: beforeState.isPartial as boolean,
            isActive: beforeState.isActive as boolean,
          },
          update: {
            date: new Date(beforeState.date as string),
            ...(beforeState.originalDate ? { originalDate: new Date(beforeState.originalDate as string) } : {}),
            name: beforeState.name as string,
            type: beforeState.type as any,
            scope: beforeState.scope as string,
            isPartial: beforeState.isPartial as boolean,
            isActive: beforeState.isActive as boolean,
          },
        });
      }
    } else if (entityType === 'Department') {
      if (action === 'CREATE_DEPARTMENT') {
        await tx.departmentBranch.deleteMany({ where: { departmentId: entityId } });
        rollbackResult = await tx.department.delete({ where: { id: entityId } });
      } else if (details?.before) {
        const beforeState = details.before as Record<string, unknown>;
        const branchIds = Array.isArray(beforeState.branchIds)
          ? beforeState.branchIds.filter((branchId): branchId is string => typeof branchId === 'string')
          : [];
        const { branchIds: _branchIds, userCount: _userCount, id: _id, ...departmentData } = beforeState;

        rollbackResult = await tx.department.upsert({
          where: { id: entityId },
          create: {
            id: entityId,
            name: departmentData.name as string,
            code: departmentData.code as string,
            description: departmentData.description as string | null,
            isActive: departmentData.isActive as boolean,
          },
          update: {
            name: departmentData.name as string,
            code: departmentData.code as string,
            description: departmentData.description as string | null,
            isActive: departmentData.isActive as boolean,
          },
        });

        await tx.departmentBranch.deleteMany({ where: { departmentId: entityId } });
        if (branchIds.length > 0) {
          await tx.departmentBranch.createMany({
            data: branchIds.map((branchId) => ({ departmentId: entityId, branchId })),
          });
        }
      }
    } else if (entityType === 'Absence') {
      // CREATE_ABSENCE_REQUEST | APPROVE_ABSENCE | REJECT_ABSENCE | CANCEL_ABSENCE — `before` debe ser fila completa salvo en CREATE (delete).
      if (action === 'CREATE_ABSENCE_REQUEST') {
        rollbackResult = await tx.absence.delete({ where: { id: entityId } });
      } else if (details?.before) {
        const beforeState = details.before as Record<string, unknown>;
        rollbackResult = await tx.absence.upsert({
          where: { id: entityId },
          create: {
            id: entityId,
            employeeId: beforeState.employeeId as string,
            type: (beforeState.type as any) ?? 'vacaciones',
            status: beforeState.status as any,
            startDate: new Date(beforeState.startDate as string),
            endDate: new Date(beforeState.endDate as string),
            note: beforeState.note as string | null,
            reviewedBy: beforeState.reviewedBy as string | null,
            reviewedAt: optionalDate(beforeState.reviewedAt),
            rejectionReason: beforeState.rejectionReason as string | null,
            branchId: beforeState.branchId as string,
            departmentId: beforeState.departmentId as string,
          },
          update: {
            employeeId: beforeState.employeeId as string,
            type: (beforeState.type as any) ?? 'vacaciones',
            status: beforeState.status as any,
            startDate: new Date(beforeState.startDate as string),
            endDate: new Date(beforeState.endDate as string),
            note: beforeState.note as string | null,
            reviewedBy: beforeState.reviewedBy as string | null,
            reviewedAt: optionalDate(beforeState.reviewedAt),
            rejectionReason: beforeState.rejectionReason as string | null,
            branchId: beforeState.branchId as string,
            departmentId: beforeState.departmentId as string,
          },
        });
      }
    } else if (entityType === 'ShiftPreset') {
      if (action === 'CREATE_SHIFT_PRESET') {
        rollbackResult = await tx.shiftPreset.delete({ where: { id: entityId } });
      } else if (details?.before) {
        const beforeState = details.before as Record<string, unknown>;
        const data = restoreTimestampedScalarSnapshot(beforeState);
        rollbackResult = await tx.shiftPreset.upsert({
          where: { id: entityId },
          create: { ...data, id: entityId } as any,
          update: data as any,
        });
      }
    } else if (entityType === 'ScheduleType') {
      if (action === 'CREATE_SCHEDULE_TYPE') {
        rollbackResult = await tx.scheduleType.delete({ where: { id: entityId } });
      } else if (details?.before) {
        const beforeState = details.before as Record<string, unknown>;
        const data = restoreTimestampedScalarSnapshot(beforeState);
        rollbackResult = await tx.scheduleType.upsert({
          where: { id: entityId },
          create: { ...data, id: entityId } as any,
          update: data as any,
        });
      }
    } else if (entityType === 'Role') {
      if (action === 'CREATE_ROLE') {
        rollbackResult = await tx.role.delete({ where: { id: entityId } });
      } else if (details?.before) {
        const beforeState = details.before as Record<string, unknown>;
        const permissionNames = extractPermissionNames(beforeState.permissions);
        rollbackResult = await tx.role.upsert({
          where: { id: entityId },
          create: {
            id: entityId,
            name: beforeState.name as string,
            description: beforeState.description as string | null,
            isSystem: Boolean(beforeState.isSystem),
            permissions: { connect: permissionNames.map((name) => ({ name })) },
          },
          update: {
            name: beforeState.name as string,
            description: beforeState.description as string | null,
            isSystem: Boolean(beforeState.isSystem),
            permissions: { set: permissionNames.map((name) => ({ name })) },
          },
        });
      }
    } else if (entityType === 'EntityComment') {
      if (action === 'CREATE_ENTITY_COMMENT') {
        rollbackResult = await tx.entityComment.delete({ where: { id: entityId } });
      } else {
        throw new AppError('BAD_REQUEST', 400, `Rollback no soportado para EntityComment y acción ${action}`);
      }
    } else if (entityType === 'Skill') {
      if (action === 'CREATE_SKILL') {
        // Revertir creación: eliminar la skill (solo si no tiene asignaciones activas)
        const assignmentCount = await tx.userSkill.count({ where: { skillId: entityId } });
        if (assignmentCount > 0) {
          throw new AppError(
            'CONFLICT',
            409,
            `No se puede revertir la creación: la skill tiene ${assignmentCount} asignación(es) activa(s)`,
          );
        }
        rollbackResult = await tx.skill.delete({ where: { id: entityId } });
      } else if (action === 'UPDATE_SKILL' && details?.before) {
        // Revertir actualización (incluyendo soft-delete): restaurar snapshot "before"
        const beforeState = details.before as Record<string, unknown>;
        const data = restoreTimestampedScalarSnapshot(beforeState);
        rollbackResult = await tx.skill.upsert({
          where: { id: entityId },
          create: { ...data, id: entityId } as any,
          update: data as any,
        });
      } else {
        throw new AppError('BAD_REQUEST', 400, `Rollback no soportado para Skill y acción ${action}`);
      }
    } else {
      throw new AppError('BAD_REQUEST', 400, `Rollback no implementado para la entidad: ${entityType}`);
    }

    // Marcar el registro original como revertido
    // Al usar Prisma.AuditLog.update, @updatedAt se disparará automáticamente,
    // desplazando el registro a la parte superior del listado (si se ordena por updatedAt: desc)
    await tx.auditLog.update({
      where: { id: logId },
      data: {
        rolledBackAt: new Date(),
        rolledBackByUserId: actorId,
      },
    });

    await logAuditOrThrow(
      {
        userId: actorId,
        action: 'ROLLBACK_PERFORMED',
        entityType,
        entityId,
        ipAddress,
        detailsJson: {
          before: null,
          after: {
            rolledBackLogId: logId,
            rolledBackAction: action,
            rollbackMetadata,
          },
        },
      },
      tx
    );

    return rollbackResult;
  });
}
