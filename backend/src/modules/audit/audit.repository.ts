import { prisma } from '../../config/database';
import { TransactionClient } from '../../common/transactions/transaction.utils';
import { Prisma } from '@prisma/client';

export type AuditLogWhere = Prisma.Args<typeof prisma.auditLog, 'findMany'>['where'];
type AuditLogCreateData = Prisma.Args<typeof prisma.auditLog, 'create'>['data'];
export type AuditSortBy = 'createdAt' | 'action' | 'entityType' | 'userName' | 'userDepartment';
export type SortOrder = 'asc' | 'desc';

function getDb(tx?: TransactionClient) {
  return tx ?? prisma;
}

export async function createAuditLog(data: AuditLogCreateData, tx?: TransactionClient) {
  return getDb(tx).auditLog.create({ data });
}

export async function findAuditLogs(
  where: AuditLogWhere,
  page: number,
  limit: number,
  sortBy: AuditSortBy = 'createdAt',
  sortOrder: SortOrder = 'desc'
) {
  // Construir orderBy: los campos de relación requieren sintaxis anidada específica.
  let orderBy: any;
  if (sortBy === 'userName') {
    orderBy = { user: { name: sortOrder } };
  } else if (sortBy === 'userDepartment') {
    orderBy = { user: { department: { name: sortOrder } } };
  } else {
    orderBy = { [sortBy]: sortOrder };
  }

  const [logs, total] = await Promise.all([
    prisma.auditLog.findMany({
      where,
      include: {
        user: { select: { id: true, name: true, email: true, department: true } },
        rolledBackBy: { select: { id: true, name: true } },
      },
      orderBy,
      skip: (page - 1) * limit,
      take: limit,
    }),
    prisma.auditLog.count({ where }),
  ]);

  return { logs, total };
}

export async function findAuditLogById(id: string) {
  return prisma.auditLog.findUnique({
    where: { id },
      include: {
        user: { select: { id: true, name: true, email: true, department: true } },
        rolledBackBy: { select: { id: true, name: true } },
      },
  });
}
