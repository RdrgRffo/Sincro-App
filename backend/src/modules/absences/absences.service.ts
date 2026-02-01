import { logger } from '../../utils/logger';
import { prisma } from '../../config/database';
import { USER_STATUS } from '../../config/constants';
import { createAppError } from '../../common/errors/error-catalog';
import { executeInTransaction } from '../../common/transactions/transaction.utils';
import { logAuditOrThrow, sanitizeSnapshot } from '../audit/audit.service';
import { notifyAbsenceChange } from '../notifications/notifications.service';
import { createInAppNotification, createInAppNotificationBatch } from '../in-app-notifications/in-app.service';
import { recalculateWeeklySummariesForAbsence } from '../schedules/weekly-summary.service';
import { ABSENCE_PERMISSIONS } from './absences.constants';
import {
  ensureStartDateNotPast,
  ensureValidDateRange,
  ensureCanReview,
  ensureCanCancel,
  ensureIsPending,
} from './domain/absences.rules';
import type { CreateAbsenceRequestInput, ApproveAbsenceInput, RejectAbsenceInput, ListAbsencesQuery } from './absences.http.schemas';
import {
  findAbsenceRequests,
  countAbsenceRequests,
  findAbsenceRequestById,
  createAbsenceRequest,
  updateAbsenceRequest,
  countPendingOverlap,
  findDepartmentOverlap,
  findAbsenceReviewerUserIds,
  type AbsenceWithRelations,
} from './absences.repository';

/** Snapshot completo para rollback de auditoría. */
function snapshotForAbsenceRollback(absence: AbsenceWithRelations) {
  return sanitizeSnapshot({
    id: absence.id,
    employeeId: absence.employeeId,
    type: absence.type,
    status: absence.status,
    startDate: absence.startDate,
    endDate: absence.endDate,
    note: absence.note,
    reviewedBy: absence.reviewedBy,
    reviewedAt: absence.reviewedAt,
    rejectionReason: absence.rejectionReason,
    branchId: absence.branchId,
    departmentId: absence.departmentId,
  });
}

async function filterRecipientsByAbsenceReviewPreference(userIds: string[]): Promise<string[]> {
  const uniqueIds = [...new Set(userIds)];
  if (uniqueIds.length === 0) return [];
  const preferences = await prisma.userNotificationPreference.findMany({
    where: { userId: { in: uniqueIds } },
    select: { userId: true, departmentAbsenceRequests: true, criticalAlertsOnly: true },
  });
  const preferenceByUser = new Map(preferences.map((p) => [p.userId, p]));

  return uniqueIds.filter((userId) => {
    const pref = preferenceByUser.get(userId);
    if (!pref) return true;
    if (pref.criticalAlertsOnly) return false;
    return pref.departmentAbsenceRequests !== false;
  });
}

type Actor = {
  id: string;
  roleName: string;
  email: string;
  name: string;
  branchId?: string | null;
  visibleBranchIds?: string[];
  departmentId?: string | null;
  ipAddress?: string;
  permissions?: string[];
};

function getActorVisibleBranchIds(actor: Pick<Actor, 'branchId' | 'visibleBranchIds'>): string[] {
  return [...new Set([actor.branchId, ...(actor.visibleBranchIds ?? [])].filter(Boolean) as string[])];
}

function assertActorCanCreateAbsenceForTarget(
  actor: Actor,
  target: { id: string; branchId: string | null; departmentId: string | null },
): void {
  if (actor.roleName === 'admin') return;

  if (actor.roleName === 'general_manager') {
    const visible = getActorVisibleBranchIds(actor);
    if (!target.branchId || !visible.includes(target.branchId)) {
      throw createAppError(
        'FORBIDDEN',
        'No puedes registrar ausencias para empleados fuera de tu alcance de sucursales',
      );
    }
    return;
  }

  if (actor.roleName === 'department_manager') {
    if (target.departmentId !== actor.departmentId) {
      throw createAppError(
        'FORBIDDEN',
        'No puedes registrar ausencias para empleados de otro departamento',
      );
    }
    const visible = getActorVisibleBranchIds(actor);
    if (target.branchId && visible.length > 0 && !visible.includes(target.branchId)) {
      throw createAppError(
        'FORBIDDEN',
        'No puedes registrar ausencias para empleados fuera de tu alcance de sucursales',
      );
    }
    return;
  }

  if (target.id !== actor.id) {
    throw createAppError('FORBIDDEN', 'No puedes registrar ausencias para otros empleados');
  }
}

/**
 * Scope de listado según permisos: sin `read-all` solo ve sus ausencias;
 * con `read-all`, el alcance depende del rol (sucursal / departamento / global).
 */
function buildAbsenceScope(actor: Actor, query: ListAbsencesQuery): Record<string, unknown> {
  const where: Record<string, unknown> = {};
  const hasReadAll = actor.permissions?.includes(ABSENCE_PERMISSIONS.READ_ALL) ?? false;

  if (!hasReadAll) {
    where.employeeId = actor.id;
    return where;
  }

  if (actor.roleName === 'department_manager') {
    where.departmentId = actor.departmentId;
    if (query.branchId) {
      const visibleBranchIds = getActorVisibleBranchIds(actor);
      if (!visibleBranchIds.includes(query.branchId)) {
        throw createAppError('FORBIDDEN', 'No puedes consultar ausencias de otra sucursal');
      }
      where.branchId = query.branchId;
    }
  } else if (actor.roleName === 'general_manager') {
    const visibleBranchIds = getActorVisibleBranchIds(actor);
    if (!visibleBranchIds.length) {
      throw createAppError('FORBIDDEN', 'No tienes una sucursal asignada');
    }
    if (query.branchId) {
      if (!visibleBranchIds.includes(query.branchId)) {
        throw createAppError('FORBIDDEN', 'No puedes consultar ausencias de otra sucursal');
      }
      where.branchId = query.branchId;
    } else {
      where.branchId = { in: visibleBranchIds };
    }
    if (query.departmentId) where.departmentId = query.departmentId;
  }

  return where;
}

/**
 * Lista solicitudes de ausencia (modelo `Absence`) con paginación y filtros.
 */
export async function listAbsences(query: ListAbsencesQuery, actor: Actor) {
  const where = buildAbsenceScope(actor, query);

  if (query.status) where.status = query.status;
  if (query.employeeId) where.employeeId = query.employeeId;
  if (query.from || query.to) {
    const dateFilter: Record<string, Date> = {};
    if (query.from) dateFilter.gte = new Date(query.from);
    if (query.to) dateFilter.lte = new Date(query.to);
    where.startDate = dateFilter;
  }
  if (query.search) {
    where.OR = [
      { employee: { name: { contains: query.search, mode: 'insensitive' } } },
      { employee: { email: { contains: query.search, mode: 'insensitive' } } },
      { employee: { employeeId: { contains: query.search, mode: 'insensitive' } } },
    ];
  }

  const skip = (query.page - 1) * query.pageSize;
  const take = query.pageSize;

  const [items, total] = await Promise.all([
    findAbsenceRequests(where as any, { sortBy: query.sortBy, sortOrder: query.sortOrder, skip, take }),
    countAbsenceRequests(where as any),
  ]);

  return {
    items,
    total,
    page: query.page,
    pageSize: query.pageSize,
    totalPages: Math.ceil(total / query.pageSize),
  };
}

export async function getAbsenceById(id: string, actor: Actor) {
  const absence = await findAbsenceRequestById(id);
  if (!absence) {
    throw createAppError('NOT_FOUND', 'Solicitud de ausencia no encontrada');
  }

  const hasReadAll = actor.permissions?.includes(ABSENCE_PERMISSIONS.READ_ALL) ?? false;

  // Caso 1: Es su propia ausencia
  if (absence.employeeId === actor.id) {
    return absence;
  }

  // Caso 2: Tiene READ_ALL permission
  if (hasReadAll) {
    // Admin con READ_ALL ve todo
    if (actor.roleName === 'admin') {
      return absence;
    }

    // Department manager ve su departamento
    if (actor.roleName === 'department_manager') {
      if (absence.departmentId !== actor.departmentId) {
        throw createAppError('FORBIDDEN', 'No puedes ver solicitudes de otros departamentos');
      }
      return absence;
    }

    // General manager ve sus branches visibles
    if (actor.roleName === 'general_manager') {
      const visibleBranchIds = getActorVisibleBranchIds(actor);
      if (absence.branchId && !visibleBranchIds.includes(absence.branchId)) {
        throw createAppError('FORBIDDEN', 'No puedes ver solicitudes de otras sucursales');
      }
      return absence;
    }
  }

  // Caso 3: Sin READ_ALL pero puede verla si está en su rama/departamento
  const visibleBranchIds = getActorVisibleBranchIds(actor);

  // Puede verla si está en su rama visible
  if (absence.branchId && visibleBranchIds.includes(absence.branchId)) {
    // Si es un departamento_manager, también debe estar en su depto
    if (actor.roleName === 'department_manager' && absence.departmentId !== actor.departmentId) {
      throw createAppError('FORBIDDEN', 'No puedes ver solicitudes de otros departamentos');
    }
    return absence;
  }

  // Si no está en su rama, no puede verla
  throw createAppError('FORBIDDEN', 'No puedes ver solicitudes de otros empleados');
}

/**
 * Crea una solicitud de ausencia (modelo `Absence`).
 * Solapamiento con compañeros del mismo departamento → estado `colindante`.
 */
export async function createAbsenceEntry(input: CreateAbsenceRequestInput, actor: Actor) {
  const startDate = new Date(input.startDate);
  const endDate = new Date(input.endDate);

  ensureStartDateNotPast(startDate);
  ensureValidDateRange(startDate, endDate);

  const targetEmployeeId = input.employeeId?.trim() || actor.id;

  if (actor.roleName === 'employee' && targetEmployeeId !== actor.id) {
    throw createAppError('FORBIDDEN', 'Solo puedes crear solicitudes de ausencia para ti mismo');
  }

  const canCreateForOthers =
    actor.roleName === 'admin' ||
    actor.roleName === 'general_manager' ||
    actor.roleName === 'department_manager';
  if (targetEmployeeId !== actor.id && !canCreateForOthers) {
    throw createAppError('FORBIDDEN', 'No puedes crear ausencias para otros empleados');
  }

  const targetUser = await prisma.user.findUnique({
    where: { id: targetEmployeeId },
    select: { id: true, branchId: true, departmentId: true, status: true, name: true, email: true },
  });

  if (!targetUser) {
    throw createAppError('NOT_FOUND', 'Empleado no encontrado');
  }

  if (targetUser.status !== USER_STATUS.ACTIVE) {
    throw createAppError('BAD_REQUEST', 'El empleado no está activo');
  }

  if (!targetUser.branchId || !targetUser.departmentId) {
    throw createAppError('BAD_REQUEST', 'El empleado no tiene sucursal o departamento asignado');
  }

  assertActorCanCreateAbsenceForTarget(actor, targetUser);

  const pendingOverlap = await countPendingOverlap(targetEmployeeId, startDate, endDate);
  if (pendingOverlap > 0) {
    throw createAppError(
      'BAD_REQUEST',
      targetEmployeeId === actor.id
        ? 'Ya tienes una solicitud pendiente con fechas solapadas'
        : 'El empleado ya tiene una solicitud pendiente con fechas solapadas',
    );
  }

  let overlappingEmployees: Array<{ id: string; name: string; email: string }> = [];
  const overlaps = await findDepartmentOverlap(
    targetUser.departmentId,
    targetEmployeeId,
    startDate,
    endDate,
  );
  overlappingEmployees = overlaps.map(
    (o: { employee: { id: string; name: string; email: string } }) => ({
      id: o.employee.id,
      name: o.employee.name,
      email: o.employee.email,
    }),
  );

  const initialStatus = overlappingEmployees.length > 0 ? 'colindante' : 'pending';

  const absence = await executeInTransaction(async (tx) => {
    const created = await createAbsenceRequest({
      employee: { connect: { id: targetEmployeeId } },
      startDate,
      endDate,
      type: input.type,
      note: input.note,
      status: initialStatus as any,
      branch: { connect: { id: targetUser.branchId! } },
      department: { connect: { id: targetUser.departmentId! } },
    }, tx);

    await logAuditOrThrow({
      userId: actor.id,
      action: 'CREATE_ABSENCE_REQUEST',
      entityType: 'Absence',
      entityId: created.id,
      detailsJson: {
        before: null,
        after: sanitizeSnapshot({
          id: created.id,
          employeeId: targetEmployeeId,
          type: created.type,
          startDate: created.startDate,
          endDate: created.endDate,
          note: created.note,
          status: created.status,
          branchId: created.branchId,
          departmentId: created.departmentId,
          overlappingEmployees: overlappingEmployees.length > 0 ? overlappingEmployees : undefined,
        }),
      },
      ipAddress: actor.ipAddress,
    }, tx);

    return created;
  });

  notifyAbsenceChange({
    type: 'absence_requested',
    absence,
    actor,
  }).catch((error: unknown) => {
    logger.error('Failed to notify absence change (absence_requested)', error);
  });

  const branchTimezone = absence.branch?.timezone;
  const formatDt = (dt: Date) => {
    if (branchTimezone) {
      return new Intl.DateTimeFormat('es-ES', {
        day: '2-digit', month: '2-digit', year: 'numeric',
        timeZone: branchTimezone,
      }).format(dt);
    }
    return dt.toLocaleDateString();
  };

  const requestSentMessage =
    targetEmployeeId === actor.id
      ? `Has solicitado ausencia del ${formatDt(startDate)} al ${formatDt(endDate)}.`
      : `${actor.name} ha registrado una solicitud de ausencia en tu nombre del ${formatDt(startDate)} al ${formatDt(endDate)}.`;

  createInAppNotification({
    userId: targetEmployeeId,
    type: 'absence_request_sent',
    title: 'Solicitud de ausencia registrada',
    message: requestSentMessage,
    link: '/ausencias',
    metadata: { absenceId: absence.id, createdBy: actor.id },
  }).catch((error: unknown) => {
    logger.error('Failed to send absence_request_sent notification', error);
  });

  findAbsenceReviewerUserIds(targetUser.branchId!, targetUser.departmentId!, targetEmployeeId)
    .then((reviewerIds) => filterRecipientsByAbsenceReviewPreference(reviewerIds))
    .then((recipientIds) => {
      if (recipientIds.length === 0) return;
      return createInAppNotificationBatch(
        recipientIds.map((userId) => ({
          userId,
          type: 'absence_requested',
          title: 'Nueva solicitud de ausencia',
          message: `${absence.employee.name} ha solicitado ausencia del ${formatDt(startDate)} al ${formatDt(endDate)}.`,
          link: '/ausencias',
          metadata: { absenceId: absence.id, employeeId: absence.employeeId },
        })),
      );
    })
    .catch((error: unknown) => {
      logger.error('Failed to send absence_requested batch notification to reviewers', error);
    });

  return {
    ...absence,
    hasOverlap: overlappingEmployees.length > 0,
    overlappingEmployees,
  };
}

export async function approveAbsenceEntry(id: string, input: ApproveAbsenceInput, actor: Actor) {
  const absence = await findAbsenceRequestById(id);
  if (!absence) {
    throw createAppError('NOT_FOUND', 'Solicitud de ausencia no encontrada');
  }

  ensureIsPending(absence.status);
  ensureCanReview(
    actor.roleName,
    actor.branchId,
    actor.departmentId,
    absence.branchId,
    absence.departmentId,
    actor.visibleBranchIds,
  );

  const updated = await executeInTransaction(async (tx) => {
    const result = await updateAbsenceRequest(id, {
      status: 'approved',
      reviewer: { connect: { id: actor.id } },
      reviewedAt: new Date(),
    }, tx);

    await logAuditOrThrow({
      userId: actor.id,
      action: 'APPROVE_ABSENCE',
      entityType: 'Absence',
      entityId: id,
      detailsJson: {
        before: snapshotForAbsenceRollback(absence),
        after: sanitizeSnapshot({
          status: 'approved',
          type: absence.type,
          reviewedBy: actor.id,
          reviewedAt: new Date().toISOString(),
        }),
        note: input.note,
      },
      ipAddress: actor.ipAddress,
    }, tx);

    return result;
  });

  notifyAbsenceChange({
    type: 'absence_approved',
    absence: updated,
    actor,
  }).catch((error: unknown) => {
    logger.error('Failed to notify absence change (absence_approved)', error);
  });

  const branchTimezone = absence.branch?.timezone;
  const formatDt = (dt: Date) => {
    if (branchTimezone) {
      return new Intl.DateTimeFormat('es-ES', {
        day: '2-digit', month: '2-digit', year: 'numeric',
        timeZone: branchTimezone,
      }).format(dt);
    }
    return dt.toLocaleDateString();
  };

  createInAppNotification({
    userId: absence.employeeId,
    type: 'absence_approved',
    title: 'Ausencia aprobada',
    message: `Tu ausencia del ${formatDt(absence.startDate)} al ${formatDt(absence.endDate)} ha sido aprobada por ${actor.name}.`,
    link: '/ausencias',
    metadata: { absenceId: id, approvedBy: actor.id },
  }).catch((error: unknown) => {
    logger.error('Failed to send absence_approved notification', error);
  });

  recalculateWeeklySummariesForAbsence(
    absence.employeeId,
    absence.startDate,
    absence.endDate,
  ).catch((error: unknown) => {
    logger.error('Failed to recalculate weekly summaries after approval', error);
  });

  return updated;
}

export async function rejectAbsenceEntry(id: string, input: RejectAbsenceInput, actor: Actor) {
  const absence = await findAbsenceRequestById(id);
  if (!absence) {
    throw createAppError('NOT_FOUND', 'Solicitud de ausencia no encontrada');
  }

  ensureIsPending(absence.status);
  ensureCanReview(
    actor.roleName,
    actor.branchId,
    actor.departmentId,
    absence.branchId,
    absence.departmentId,
    actor.visibleBranchIds,
  );

  const updated = await executeInTransaction(async (tx) => {
    const result = await updateAbsenceRequest(id, {
      status: 'rejected',
      reviewer: { connect: { id: actor.id } },
      reviewedAt: new Date(),
      rejectionReason: input.rejectionReason,
    }, tx);

    await logAuditOrThrow({
      userId: actor.id,
      action: 'REJECT_ABSENCE',
      entityType: 'Absence',
      entityId: id,
      detailsJson: {
        before: snapshotForAbsenceRollback(absence),
        after: sanitizeSnapshot({
          status: 'rejected',
          type: absence.type,
          reviewedBy: actor.id,
          reviewedAt: new Date().toISOString(),
          rejectionReason: input.rejectionReason,
        }),
      },
      ipAddress: actor.ipAddress,
    }, tx);

    return result;
  });

  notifyAbsenceChange({
    type: 'absence_rejected',
    absence: updated,
    actor,
  }).catch((error: unknown) => {
    logger.error('Failed to notify absence change (absence_rejected)', error);
  });

  const branchTimezone = absence.branch?.timezone;
  const formatDt = (dt: Date) => {
    if (branchTimezone) {
      return new Intl.DateTimeFormat('es-ES', {
        day: '2-digit', month: '2-digit', year: 'numeric',
        timeZone: branchTimezone,
      }).format(dt);
    }
    return dt.toLocaleDateString();
  };

  const rejectionMsg = input.rejectionReason
    ? `Motivo: ${input.rejectionReason}`
    : 'No se especificó motivo.';
  createInAppNotification({
    userId: absence.employeeId,
    type: 'absence_rejected',
    title: 'Ausencia rechazada',
    message: `Tu ausencia del ${formatDt(absence.startDate)} al ${formatDt(absence.endDate)} ha sido rechazada por ${actor.name}. ${rejectionMsg}`,
    link: '/ausencias',
    metadata: { absenceId: id, rejectedBy: actor.id, rejectionReason: input.rejectionReason },
  }).catch((error: unknown) => {
    logger.error('Failed to send absence_rejected notification', error);
  });

  return updated;
}

export async function cancelAbsenceEntry(id: string, actor: Actor) {
  const absence = await findAbsenceRequestById(id);
  if (!absence) {
    throw createAppError('NOT_FOUND', 'Solicitud de ausencia no encontrada');
  }

  const hasCancelAll = actor.permissions?.includes(ABSENCE_PERMISSIONS.APPROVE) ?? false;

  if (!hasCancelAll) {
    if (absence.employeeId !== actor.id) {
      throw createAppError('FORBIDDEN', 'Solo puedes cancelar tus propias solicitudes');
    }
    ensureCanCancel(absence.status);
  } else {
    ensureCanReview(
      actor.roleName,
      actor.branchId,
      actor.departmentId,
      absence.branchId,
      absence.departmentId,
      actor.visibleBranchIds,
    );
  }

  const updated = await executeInTransaction(async (tx) => {
    const result = await updateAbsenceRequest(id, {
      status: 'cancelled',
    }, tx);

    await logAuditOrThrow({
      userId: actor.id,
      action: 'CANCEL_ABSENCE',
      entityType: 'Absence',
      entityId: id,
      detailsJson: {
        before: snapshotForAbsenceRollback(absence),
        after: sanitizeSnapshot({ status: 'cancelled', type: absence.type }),
      },
      ipAddress: actor.ipAddress,
    }, tx);

    return result;
  });

  notifyAbsenceChange({
    type: 'absence_cancelled',
    absence: updated,
    actor,
  }).catch((error: unknown) => {
    logger.error('Failed to notify absence change (absence_cancelled)', error);
  });

  const branchTimezone = absence.branch?.timezone;
  const formatDt = (dt: Date) => {
    if (branchTimezone) {
      return new Intl.DateTimeFormat('es-ES', {
        day: '2-digit', month: '2-digit', year: 'numeric',
        timeZone: branchTimezone,
      }).format(dt);
    }
    return dt.toLocaleDateString();
  };

  if (absence.employeeId !== actor.id) {
    createInAppNotification({
      userId: absence.employeeId,
      type: 'absence_cancelled',
      title: 'Ausencia cancelada',
      message: `Tu ausencia del ${formatDt(absence.startDate)} al ${formatDt(absence.endDate)} ha sido cancelada por ${actor.name}.`,
      link: '/ausencias',
      metadata: { absenceId: id, cancelledBy: actor.id },
    }).catch((error: unknown) => {
      logger.error('Failed to send absence_cancelled notification to employee', error);
    });
  } else {
    createInAppNotification({
      userId: actor.id,
      type: 'absence_cancelled',
      title: 'Solicitud cancelada',
      message: `Has cancelado tu ausencia del ${formatDt(absence.startDate)} al ${formatDt(absence.endDate)}.`,
      link: '/ausencias',
      metadata: { absenceId: id },
    }).catch((error: unknown) => {
      logger.error('Failed to send absence_cancelled notification to self', error);
    });
  }

  if (absence.status === 'approved') {
    recalculateWeeklySummariesForAbsence(
      absence.employeeId,
      absence.startDate,
      absence.endDate,
    ).catch((error: unknown) => {
      logger.error('Failed to recalculate weekly summaries after cancellation', error);
    });
  }

  return updated;
}

/**
 * Calendario de ausencias aprobadas (rango por semana ISO o `from`/`to`).
 */
export async function getAbsenceCalendar(
  year: number | undefined,
  week: number | undefined,
  branchId: string | undefined,
  departmentId: string | undefined,
  employeeId: string | undefined,
  actor?: Actor,
  from?: string,
  to?: string,
) {
  let rangeStart: Date;
  let rangeEnd: Date;

  if (from && to) {
    rangeStart = new Date(from);
    rangeStart.setHours(0, 0, 0, 0);
    rangeEnd = new Date(to);
    rangeEnd.setHours(23, 59, 59, 999);
  } else {
    const safeYear = year ?? new Date().getFullYear();
    const safeWeek = week ?? 1;
    const jan4 = new Date(safeYear, 0, 4);
    rangeStart = new Date(jan4);
    rangeStart.setDate(jan4.getDate() - ((jan4.getDay() + 6) % 7) + (safeWeek - 1) * 7);
    rangeStart.setHours(0, 0, 0, 0);
    rangeEnd = new Date(rangeStart);
    rangeEnd.setDate(rangeStart.getDate() + 6);
    rangeEnd.setHours(23, 59, 59, 999);
  }

  const where: Record<string, unknown> = {
    status: 'approved',
    AND: [
      { startDate: { lte: rangeEnd } },
      { endDate: { gte: rangeStart } },
    ],
  };

  // Compute allowed branch scope considering actor permissions and optional branchId filter.
  // We'll build a normalized `where.branchId` as `{ in: [...] }` when applicable which
  // simplifies later department-branch intersection logic.
  let allowedBranchIds: string[] | undefined;

  if (actor) {
    const hasReadAll = actor.permissions?.includes(ABSENCE_PERMISSIONS.READ_ALL) ?? false;
    if (hasReadAll && actor.roleName === 'admin') {
      // Admin with read-all can query any branch; if a specific branchId is provided, narrow to it
      allowedBranchIds = branchId ? [branchId] : undefined;
    } else {
      const visible = getActorVisibleBranchIds(actor);
      if (!visible.length) throw createAppError('FORBIDDEN', 'No tienes una sucursal asignada');
      if (branchId) {
        if (!visible.includes(branchId)) throw createAppError('FORBIDDEN', 'No puedes consultar ausencias de otra sucursal');
        allowedBranchIds = [branchId];
      } else {
        allowedBranchIds = visible;
      }
    }
  } else {
    allowedBranchIds = branchId ? [branchId] : undefined;
  }

  if (allowedBranchIds !== undefined) {
    where.branchId = { in: allowedBranchIds };
  }

  // If departmentId filters to specific branches, intersect with allowedBranchIds.
  if (departmentId) {
    const departmentBranches = await prisma.departmentBranch.findMany({ where: { departmentId }, select: { branchId: true } });
    const deptBranchIds = departmentBranches.map((db) => db.branchId);

    if (deptBranchIds.length > 0) {
      if (where.branchId) {
        const currentIn = (where.branchId as any).in as string[] | undefined;
        if (currentIn && currentIn.length > 0) {
          const intersection = currentIn.filter((id) => deptBranchIds.includes(id));
          if (intersection.length === 0) {
            // No overlapping branches → guarantee no results
            where.id = '__none__';
          } else {
            where.branchId = { in: intersection };
            where.departmentId = departmentId;
          }
        } else {
          // Defensive: set to dept branches
          where.branchId = { in: deptBranchIds };
          where.departmentId = departmentId;
        }
      } else {
        where.branchId = { in: deptBranchIds };
        where.departmentId = departmentId;
      }
    } else {
      // Department exists but has no branch links; still filter by departmentId (possible edge-case)
      where.departmentId = departmentId;
    }
  }

  if (employeeId) {
    where.employeeId = employeeId;
  }

  const rows = await findAbsenceRequests(where as any);

  const items = rows.map((v) => ({
    id: v.id,
    employeeId: v.employeeId,
    employeeName: v.employee.name,
    employeeEmail: v.employee.email,
    employeeAvatarUrl: v.employee.avatarUrl,
    employeeDepartment: v.employee.department,
    employeeBranch: v.employee.branch,
    startDate: v.startDate,
    endDate: v.endDate,
    note: v.note,
    branchId: v.branchId,
    departmentId: v.departmentId,
  }));

  return {
    year: year ?? null,
    week: week ?? null,
    weekStart: rangeStart,
    weekEnd: rangeEnd,
    total: items.length,
    items,
  };
}
