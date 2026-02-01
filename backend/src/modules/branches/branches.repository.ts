import { Prisma } from '@prisma/client';
import { prisma } from '../../config/database';
import { TransactionClient } from '../../common/transactions/transaction.utils';

type BranchWhere = Prisma.Args<typeof prisma.branch, 'findMany'>['where'];
type BranchCreateData = Prisma.Args<typeof prisma.branch, 'create'>['data'];
type BranchUpdateData = Prisma.Args<typeof prisma.branch, 'update'>['data'];
type BranchHolidayWhere = Prisma.Args<typeof prisma.branchHoliday, 'findMany'>['where'];
type BranchHolidayCreateData = Prisma.Args<typeof prisma.branchHoliday, 'create'>['data'];
type BranchHolidayUpdateData = Prisma.Args<typeof prisma.branchHoliday, 'update'>['data'];

function getDb(tx?: TransactionClient) {
  return tx ?? prisma;
}

export function findBranchById(id: string, tx?: TransactionClient) {
  return getDb(tx).branch.findUnique({ where: { id } });
}

export function findBranchByCode(code: string, tx?: TransactionClient) {
  return getDb(tx).branch.findUnique({ where: { code } });
}

export function findBranchCodeConflict(code: string, excludedBranchId: string, tx?: TransactionClient) {
  return getDb(tx).branch.findFirst({
    where: { code, id: { not: excludedBranchId } },
    select: { id: true },
  });
}

export function findBranchByName(name: string, tx?: TransactionClient) {
  return getDb(tx).branch.findFirst({ where: { name } });
}

export function findBranchNameConflict(name: string, excludedBranchId: string, tx?: TransactionClient) {
  return getDb(tx).branch.findFirst({
    where: { name, id: { not: excludedBranchId } },
    select: { id: true },
  });
}

export function findBranches(where: BranchWhere) {
  return prisma.branch.findMany({
    where,
    orderBy: [{ isActive: 'desc' }, { name: 'asc' }],
    include: {
      manager: {
        select: {
          id: true,
          name: true,
          email: true,
          roleId: true,
          role: { select: { name: true } },
        },
      },
    },
  });
}

export function countActiveBranches(tx?: TransactionClient) {
  return getDb(tx).branch.count({ where: { isActive: true } });
}

export function createBranchRecord(data: BranchCreateData, tx?: TransactionClient) {
  return getDb(tx).branch.create({ data });
}

export function updateBranchRecord(branchId: string, data: BranchUpdateData, tx?: TransactionClient) {
  return getDb(tx).branch.update({
    where: { id: branchId },
    data,
  });
}

export function softDeleteBranchRecord(branchId: string, tx?: TransactionClient) {
  return getDb(tx).branch.update({
    where: { id: branchId },
    data: { isActive: false },
  });
}

export function hardDeleteBranchRecord(branchId: string, tx?: TransactionClient) {
  return getDb(tx).branch.delete({ where: { id: branchId } });
}

export function countSchedulesByBranch(branchId: string, tx?: TransactionClient) {
  return getDb(tx).schedule.count({ where: { branchId } });
}

export function findBranchHolidayByIdAndBranch(holidayId: string, branchId: string, tx?: TransactionClient) {
  return getDb(tx).branchHoliday.findFirst({ where: { id: holidayId, branchId } });
}

export function countDepartmentsByBranch(branchId: string, tx?: TransactionClient) {
  return getDb(tx).departmentBranch.count({ where: { branchId } });
}

export function countAbsencesByBranch(branchId: string, tx?: TransactionClient) {
  return getDb(tx).absence.count({ where: { branchId } });
}

export function findBranchHolidays(where: BranchHolidayWhere) {
  return prisma.branchHoliday.findMany({
    where,
    include: {
      branch: {
        select: {
          id: true,
          name: true,
          code: true,
        },
      },
    },
    orderBy: [{ date: 'asc' }, { name: 'asc' }],
  });
}

export function createBranchHolidayRecord(data: BranchHolidayCreateData, tx?: TransactionClient) {
  return getDb(tx).branchHoliday.create({ data });
}

export function updateBranchHolidayRecord(holidayId: string, data: BranchHolidayUpdateData, tx?: TransactionClient) {
  return getDb(tx).branchHoliday.update({
    where: { id: holidayId },
    data,
  });
}

export function deleteBranchHolidayRecord(holidayId: string, tx?: TransactionClient) {
  return getDb(tx).branchHoliday.delete({ where: { id: holidayId } });
}

export function findBranchHolidaysByIds(holidayIds: string[], tx?: TransactionClient) {
  const db = tx ?? prisma;
  return db.branchHoliday.findMany({
    where: { id: { in: holidayIds } },
    include: {
      branch: {
        select: {
          id: true,
          name: true,
          code: true,
        },
      },
    },
  });
}

export function updateBranchHolidaysByIds(
  holidayIds: string[],
  data: BranchHolidayUpdateData,
  tx: TransactionClient,
) {
  return tx.branchHoliday.updateMany({
    where: { id: { in: holidayIds } },
    data,
  });
}

export function deleteBranchHolidaysByIds(holidayIds: string[], tx: TransactionClient) {
  return tx.branchHoliday.deleteMany({
    where: { id: { in: holidayIds } },
  });
}

export function countBranchesForManager(managerId: string, tx?: TransactionClient) {
  const db = tx ?? prisma;
  return db.branch.count({
    where: { managerId },
  });
}

export function updateBranchManager(branchId: string, managerId: string | null, tx?: TransactionClient) {
  const db = tx ?? prisma;
  return db.branch.update({
    where: { id: branchId },
    data: { managerId },
  });
}
