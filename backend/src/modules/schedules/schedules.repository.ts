import { prisma } from '../../config/database';
import { TransactionClient } from '../../common/transactions/transaction.utils';
import { Prisma } from '@prisma/client';

const assigneeInclude = {
  assignments: {
    include: {
      user: {
        select: {
          id: true,
          name: true,
          email: true,
          avatarUrl: true,
          department: true,
          companyPhone: true,
          auxiliaryPhone: true,
        },
      },
    },
  },
  scheduleType: true,
  department: { select: { id: true, name: true, code: true } },
  createdBy: { select: { id: true, name: true } },
  branch: { select: { id: true, name: true, code: true, isActive: true, timezone: true } },
} as const;

export type ScheduleWhere = Prisma.Args<typeof prisma.schedule, 'findMany'>['where'];
type ScheduleCreateData = Prisma.Args<typeof prisma.schedule, 'create'>['data'];
type ScheduleUpdateData = Prisma.Args<typeof prisma.schedule, 'update'>['data'];
export type ScheduleWithRelations = NonNullable<Prisma.Result<typeof prisma.schedule, { include: typeof assigneeInclude }, 'findUnique'>>;

function getDb(tx?: TransactionClient) {
  return tx ?? prisma;
}

export function findSchedules(where: ScheduleWhere, tx?: TransactionClient): Promise<ScheduleWithRelations[]> {
  return getDb(tx).schedule.findMany({
    where,
    include: assigneeInclude,
    orderBy: { startDatetime: 'asc' },
  });
}

export function findScheduleById(id: string, tx?: TransactionClient): Promise<ScheduleWithRelations | null> {
  return getDb(tx).schedule.findUnique({
    where: { id },
    include: assigneeInclude,
  });
}

export function createSchedule(data: ScheduleCreateData, tx?: TransactionClient): Promise<ScheduleWithRelations> {
  return getDb(tx).schedule.create({
    data,
    include: assigneeInclude,
  });
}

export function updateSchedule(id: string, data: ScheduleUpdateData, tx?: TransactionClient): Promise<ScheduleWithRelations> {
  return getDb(tx).schedule.update({
    where: { id },
    data,
    include: assigneeInclude,
  });
}

export function deleteSchedule(id: string, tx?: TransactionClient) {
  return getDb(tx).schedule.delete({
    where: { id },
  });
}

export function replaceAssignments(scheduleId: string, assigneeIds: string[], tx: TransactionClient) {
  return Promise.all([
    tx.scheduleAssignment.deleteMany({ where: { scheduleId } }),
    tx.scheduleAssignment.createMany({
      data: assigneeIds.map((userId) => ({ scheduleId, userId })),
    }),
  ]);
}
