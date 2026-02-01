import { prisma } from '../../config/database';
import { Prisma } from '@prisma/client';
import { TransactionClient } from '../../common/transactions/transaction.utils';

const absenceInclude = {
  employee: {
    select: {
      id: true,
      name: true,
      email: true,
      avatarUrl: true,
      employeeId: true,
      department: { select: { id: true, name: true } },
      branch: { select: { id: true, name: true } },
    },
  },
  reviewer: {
    select: {
      id: true,
      name: true,
      email: true,
    },
  },
  branch: {
    select: { id: true, name: true, code: true, timezone: true },
  },
  department: {
    select: { id: true, name: true, code: true },
  },
} as const;

export type AbsenceWithRelations = Prisma.AbsenceGetPayload<{
  include: typeof absenceInclude;
}>;

type AbsenceCreateData = Prisma.Args<typeof prisma.absence, 'create'>['data'];
type AbsenceUpdateData = Prisma.Args<typeof prisma.absence, 'update'>['data'];
type AbsenceWhere = Prisma.Args<typeof prisma.absence, 'findMany'>['where'];

function getDb(tx?: TransactionClient) {
  return tx ?? prisma;
}

export function findAbsenceRequests(
  where: AbsenceWhere,
  options?: { sortBy?: string; sortOrder?: 'asc' | 'desc'; skip?: number; take?: number },
  tx?: TransactionClient,
): Promise<AbsenceWithRelations[]> {
  const orderBy: Record<string, 'asc' | 'desc'> = {};
  if (options?.sortBy) {
    orderBy[options.sortBy] = options.sortOrder ?? 'desc';
  } else {
    orderBy.createdAt = 'desc';
  }

  return getDb(tx).absence.findMany({
    where,
    include: absenceInclude,
    orderBy,
    skip: options?.skip,
    take: options?.take,
  });
}

export function countAbsenceRequests(where: AbsenceWhere, tx?: TransactionClient): Promise<number> {
  return getDb(tx).absence.count({ where });
}

export function findAbsenceRequestById(id: string, tx?: TransactionClient): Promise<AbsenceWithRelations | null> {
  return getDb(tx).absence.findUnique({
    where: { id },
    include: absenceInclude,
  });
}

export function createAbsenceRequest(data: AbsenceCreateData, tx?: TransactionClient): Promise<AbsenceWithRelations> {
  return getDb(tx).absence.create({
    data,
    include: absenceInclude,
  });
}

export function updateAbsenceRequest(id: string, data: AbsenceUpdateData, tx?: TransactionClient): Promise<AbsenceWithRelations> {
  return getDb(tx).absence.update({
    where: { id },
    data,
    include: absenceInclude,
  });
}

export function countPendingOverlap(employeeId: string, startDate: Date, endDate: Date, excludeId?: string, tx?: TransactionClient) {
  const where: AbsenceWhere = {
    employeeId,
    status: 'pending',
    AND: [
      { startDate: { lte: endDate } },
      { endDate: { gte: startDate } },
    ],
  };
  if (excludeId) {
    where.id = { not: excludeId };
  }
  return getDb(tx).absence.count({ where });
}

/**
 * Busca solicitudes de ausencias de compañeros del mismo departamento
 * cuyas fechas se solapen con el rango solicitado.
 * Considera estados: approved, pending, colindante
 */
export function findDepartmentOverlap(
  departmentId: string,
  employeeId: string,
  startDate: Date,
  endDate: Date,
  excludeId?: string,
  tx?: TransactionClient,
) {
  const where: AbsenceWhere = {
    departmentId,
    employeeId: { not: employeeId },
    status: { in: ['approved', 'pending', 'colindante'] as any },
    AND: [
      { startDate: { lte: endDate } },
      { endDate: { gte: startDate } },
    ],
  };
  if (excludeId) {
    where.id = { not: excludeId };
  }
  return getDb(tx).absence.findMany({
    where,
    include: {
      employee: {
        select: {
          id: true,
          name: true,
          email: true,
          avatarUrl: true,
        },
      },
    },
  });
}

/**
 * Usuarios que pueden aprobar/rechazar ausencias en el mismo ámbito (managers de departamento + GMs de sucursal).
 * Excluye `excludeUserId` (p. ej. el solicitante).
 */
export async function findAbsenceReviewerUserIds(
  branchId: string,
  departmentId: string,
  excludeUserId: string,
  tx?: TransactionClient,
): Promise<string[]> {
  const db = getDb(tx);
  const ids = new Set<string>();

  const deptManagers = await db.departmentManager.findMany({
    where: { departmentId },
    select: { userId: true },
  });
  for (const row of deptManagers) {
    if (row.userId !== excludeUserId) ids.add(row.userId);
  }

  const gmRows = await db.user.findMany({
    where: {
      branchId,
      status: 'active',
      role: { name: 'general_manager' },
      id: { not: excludeUserId },
    },
    select: { id: true },
  });
  for (const u of gmRows) ids.add(u.id);

  return [...ids];
}
