import { Prisma } from '@prisma/client';
import { prisma } from '../../config/database';
import { TransactionClient } from '../../common/transactions/transaction.utils';

type DepartmentWhere = Prisma.Args<typeof prisma.department, 'findMany'>['where'];
type DepartmentCreateData = Prisma.Args<typeof prisma.department, 'create'>['data'];
type DepartmentUpdateData = Prisma.Args<typeof prisma.department, 'update'>['data'];

function getDb(tx?: TransactionClient) {
  return tx ?? prisma;
}

export function findDepartmentById(id: string, tx?: TransactionClient) {
  return getDb(tx).department.findUnique({
    where: { id },
    include: {
      branches: {
        include: {
          branch: {
            select: { id: true, name: true, code: true, isActive: true },
          },
        },
      },
      managers: {
        include: {
          user: {
            select: {
              id: true,
              name: true,
              email: true,
              avatarUrl: true,
              roleId: true,
              role: { select: { name: true } },
            },
          },
        },
      },
      _count: { select: { users: true } },
    },
  });
}

export function findDepartmentByCode(code: string, tx?: TransactionClient) {
  return getDb(tx).department.findUnique({ where: { code } });
}

export function findDepartmentByName(name: string, tx?: TransactionClient) {
  return getDb(tx).department.findFirst({ where: { name } });
}

export function findDepartmentCodeConflict(code: string, excludedId: string, tx?: TransactionClient) {
  return getDb(tx).department.findFirst({
    where: { code, id: { not: excludedId } },
    select: { id: true },
  });
}

export function findDepartmentNameConflict(name: string, excludedId: string, tx?: TransactionClient) {
  return getDb(tx).department.findFirst({
    where: { name, id: { not: excludedId } },
    select: { id: true },
  });
}

const departmentListManagersInclude = {
  managers: {
    include: {
      user: {
        select: {
          id: true,
          name: true,
          email: true,
          avatarUrl: true,
          roleId: true,
          role: { select: { name: true } },
        },
      },
    },
  },
} as const;

export function findDepartments(where: DepartmentWhere) {
  return prisma.department.findMany({
    where,
    include: {
      branches: {
        include: {
          branch: {
            select: { id: true, name: true, code: true, isActive: true },
          },
        },
      },
      ...departmentListManagersInclude,
      _count: { select: { users: true } },
    },
    orderBy: [{ isActive: 'desc' }, { name: 'asc' }],
  });
}

export function findDepartmentsByBranch(branchId: string, includeInactive: boolean) {
  return prisma.department.findMany({
    where: {
      branches: { some: { branchId } },
      ...(includeInactive ? {} : { isActive: true }),
    },
    include: {
      branches: {
        include: {
          branch: {
            select: { id: true, name: true, code: true, isActive: true },
          },
        },
      },
      ...departmentListManagersInclude,
      _count: { select: { users: true } },
    },
    orderBy: [{ isActive: 'desc' }, { name: 'asc' }],
  });
}

export function createDepartmentRecord(data: DepartmentCreateData, tx?: TransactionClient) {
  return getDb(tx).department.create({ data });
}

export function updateDepartmentRecord(departmentId: string, data: DepartmentUpdateData, tx?: TransactionClient) {
  return getDb(tx).department.update({
    where: { id: departmentId },
    data,
  });
}

export function softDeleteDepartmentRecord(departmentId: string, tx?: TransactionClient) {
  return getDb(tx).department.update({
    where: { id: departmentId },
    data: { isActive: false },
  });
}

export function hardDeleteDepartmentRecord(departmentId: string, tx?: TransactionClient) {
  return getDb(tx).department.delete({ where: { id: departmentId } });
}

export function findDepartmentBranchIds(departmentId: string, tx?: TransactionClient) {
  return getDb(tx).departmentBranch.findMany({
    where: { departmentId },
    select: { branchId: true },
  });
}

export function setDepartmentBranches(departmentId: string, branchIds: string[], tx: TransactionClient) {
  return tx.departmentBranch.createMany({
    data: branchIds.map((branchId) => ({ departmentId, branchId })),
  });
}

export function removeDepartmentBranches(departmentId: string, tx: TransactionClient) {
  return tx.departmentBranch.deleteMany({ where: { departmentId } });
}

export function countAbsencesByDepartment(departmentId: string, tx?: TransactionClient) {
  return getDb(tx).absence.count({ where: { departmentId } });
}

export function findDepartmentBranches(departmentId: string, tx?: TransactionClient) {
  return getDb(tx).departmentBranch.findMany({
    where: { departmentId },
    include: {
      branch: {
        select: { id: true, name: true, code: true, isActive: true },
      },
    },
    orderBy: { createdAt: 'asc' },
  });
}

export function countDepartmentsForManager(managerId: string, tx?: TransactionClient) {
  return getDb(tx).departmentManager.count({
    where: { userId: managerId },
  });
}

export function upsertDepartmentManager(departmentId: string, userId: string, tx: TransactionClient) {
  return tx.departmentManager.upsert({
    where: { departmentId_userId: { departmentId, userId } },
    create: { departmentId, userId },
    update: { assignedAt: new Date() },
  });
}

export function deleteDepartmentManager(departmentId: string, userId: string, tx: TransactionClient) {
  return tx.departmentManager.delete({
    where: { departmentId_userId: { departmentId, userId } },
  });
}

export function findDepartmentMembers(departmentId: string, tx?: TransactionClient) {
  return getDb(tx).user.findMany({
    where: { departmentId, isActive: true },
    select: {
      id: true,
      name: true,
      email: true,
      employeeId: true,
      avatarUrl: true,
      role: { select: { id: true, name: true } },
      branch: { select: { id: true, name: true } },
    },
    orderBy: { name: 'asc' },
  });
}
