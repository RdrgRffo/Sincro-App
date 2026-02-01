import { prisma } from '../../config/database';
import { TransactionClient } from '../../common/transactions/transaction.utils';
import { USER_RESPONSE_SELECT, USER_SAFE_SELECT, type UserResponse } from './users.selects';

type UserWhere = NonNullable<Parameters<typeof prisma.user.findMany>[0]>['where'];
type UserCreateData = NonNullable<Parameters<typeof prisma.user.create>[0]>['data'];
type UserUpdateData = NonNullable<Parameters<typeof prisma.user.update>[0]>['data'];
type IdentityConflict = { id: string; email: string } | null;
export type UsersSortBy = 'createdAt' | 'name' | 'email' | 'roleId' | 'status' | 'lastLoginAt' | 'department' | 'branchId' | 'branch';
export type SortOrder = 'asc' | 'desc';

function getDb(tx?: TransactionClient) {
  return tx ?? prisma;
}

export function findUserById(id: string, tx?: TransactionClient) {
  return getDb(tx).user.findUnique({ where: { id } });
}

export function findUserDetailById(id: string, tx?: TransactionClient) {
  return getDb(tx).user.findUnique({ where: { id }, select: USER_RESPONSE_SELECT });
}

export function findUserByEmail(email: string, tx?: TransactionClient) {
  return getDb(tx).user.findFirst({ 
    where: { email, isActive: true },
    include: { role: { include: { permissions: true } } }
  });
}

export function findUserByEmailIncludingInactive(email: string, tx?: TransactionClient) {
  return getDb(tx).user.findFirst({ 
    where: { email },
    select: {
      id: true,
      name: true,
      email: true,
      isActive: true,
      roleId: true,
      status: true,
      employeeId: true,
      branchId: true,
      companyPhone: true,
      auxiliaryPhone: true,
      avatarUrl: true,
      forcePasswordChange: true,
      passwordChangePolicy: true,
      passwordChangeWarnedAt: true,
      passwordChangeDeadlineAt: true,
      passwordChangedAt: true,
      role: { include: { permissions: true } },
    },
  });
}

export function findUserByEmployeeId(employeeId: string, tx?: TransactionClient) {
  return getDb(tx).user.findUnique({ where: { employeeId } });
}

export async function reserveNextEmployeeId(tx?: TransactionClient): Promise<string> {
  const db = getDb(tx);
  const sequenceId = 'global';

  await db.employeeIdSequence.upsert({
    where: { id: sequenceId },
    create: { id: sequenceId, lastNumber: 0 },
    update: {},
  });

  await db.$executeRaw`
    SELECT id
    FROM employee_id_sequences
    WHERE id = ${sequenceId}
    FOR UPDATE
  `;

  const [row] = await db.$queryRaw<Array<{ maxNumber: number | bigint | null }>>`
    SELECT COALESCE(MAX(CAST(SUBSTRING(employee_id, 5) AS UNSIGNED)), 0) AS maxNumber
    FROM users
    WHERE employee_id LIKE 'USR-%'
  `;

  const sequence = await db.employeeIdSequence.findUnique({ where: { id: sequenceId } });
  const currentNumber = Math.max(sequence?.lastNumber ?? 0, Number(row?.maxNumber ?? 0));
  const nextNumber = currentNumber + 1;

  await db.employeeIdSequence.update({
    where: { id: sequenceId },
    data: { lastNumber: nextNumber },
  });

  return `USR-${String(nextNumber).padStart(4, '0')}`;
}

export function findUserByDerivedUsername(username: string, tx?: TransactionClient) {
  return getDb(tx).user.findFirst({
    where: {
      derivedUsername: username,
      isActive: true,
    },
    include: { role: { include: { permissions: true } } }
  });
}

export function findUserIdentityConflict(email: string, username: string, excludeUserId: string, tx?: TransactionClient): Promise<IdentityConflict> {
  return getDb(tx).user.findFirst({
    where: {
      id: { not: excludeUserId },
      isActive: true,
      OR: [{ email }, { derivedUsername: username }],
    },
    select: { id: true, email: true },
  });
}

export function createUserRecord(data: UserCreateData, tx?: TransactionClient): Promise<UserResponse> {
  return getDb(tx).user.create({
    data,
    select: USER_SAFE_SELECT,
  });
}

export function updateUserRecord(id: string, data: UserUpdateData, tx?: TransactionClient): Promise<UserResponse> {
  return getDb(tx).user.update({
    where: { id },
    data,
    select: USER_RESPONSE_SELECT,
  });
}

function buildOrderBy(sortBy: UsersSortBy, sortOrder: SortOrder) {
  if (sortBy === 'branch') {
    return { branch: { name: sortOrder } };
  }
  if (sortBy === 'department') {
    return { department: { name: sortOrder } };
  }
  return { [sortBy]: sortOrder };
}

export function listUsers(
  where: UserWhere,
  page: number,
  limit: number,
  sortBy: UsersSortBy = 'createdAt',
  sortOrder: SortOrder = 'desc'
) {
  return Promise.all([
    prisma.user.findMany({
      where,
      select: USER_RESPONSE_SELECT,
      orderBy: buildOrderBy(sortBy, sortOrder),
      skip: (page - 1) * limit,
      take: limit,
    }),
    prisma.user.count({ where }),
  ]);
}

export function listUserSchedules(userId: string, from?: Date, to?: Date) {
  const dateFilters =
    from && to
      ? {
          AND: [
            { startDatetime: { lte: to } },
            { endDatetime: { gte: from } },
          ],
        }
      : {
          ...(from ? { endDatetime: { gte: from } } : {}),
          ...(to ? { startDatetime: { lte: to } } : {}),
        };

  return prisma.schedule.findMany({
    where: {
      assignments: { some: { userId } },
      ...dateFilters,
    },
    include: {
      assignments: {
        include: {
          user: {
            select: {
              id: true,
              name: true,
              email: true,
              avatarUrl: true,
              department: {
                select: {
                  id: true,
                  name: true,
                  code: true,
                },
              },
              companyPhone: true,
              auxiliaryPhone: true,
            },
          },
        },
      },
    },
    orderBy: { startDatetime: 'asc' },
  });
}

export function buildUsersWhere(params: {
  search?: string;
  roleId?: string;
  role?: string;
  status?: string;
  email?: string;
  departmentId?: string;
  employeeId?: string;
  branchId?: string;
  lastLoginFrom?: Date;
  lastLoginTo?: Date;
  createdFrom?: Date;
  createdTo?: Date;
}): UserWhere {
  const where: UserWhere = {};
  if (params.search) {
    where.OR = [{ name: { contains: params.search } }, { email: { contains: params.search } }];
  }
  if (params.email) where.email = params.email;
  if (params.roleId) where.roleId = params.roleId;
  if (params.role) where.role = { name: params.role };
  if (params.status) where.status = params.status;
  if (params.departmentId) where.departmentId = params.departmentId;
  if (params.employeeId) where.employeeId = { contains: params.employeeId };
  if (params.branchId) where.branchId = params.branchId;
  if (params.lastLoginFrom || params.lastLoginTo) {
    where.lastLoginAt = {
      ...(params.lastLoginFrom && { gte: params.lastLoginFrom }),
      ...(params.lastLoginTo && { lte: params.lastLoginTo }),
    };
  }
  if (params.createdFrom || params.createdTo) {
    where.createdAt = {
      ...(params.createdFrom && { gte: params.createdFrom }),
      ...(params.createdTo && { lte: params.createdTo }),
    };
  }
  return where;
}
