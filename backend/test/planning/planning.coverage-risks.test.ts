import { planningManager } from '../../src/modules/planning/planning.manager';
import { prismaMock } from '../config/singleton';

const filters = {
  from: new Date('2026-05-12T00:00:00.000Z'),
  to: new Date('2026-05-18T23:59:59.999Z'),
  branchIds: ['branch-1'],
};

const actor = {
  id: 'manager-1',
  roleName: 'general_manager',
  branchId: 'branch-1',
  departmentId: 'department-1',
  permissions: ['schedules:view'],
};

function buildSchedule(assignmentCount: number, overrides: { id?: string; title?: string } = {}) {
  return {
    id: overrides.id ?? `schedule-${assignmentCount}`,
    title: overrides.title ?? `Turno ${assignmentCount}`,
    startDatetime: new Date('2026-05-12T08:00:00.000Z'),
    endDatetime: new Date('2026-05-12T16:00:00.000Z'),
    branch: { id: 'branch-1', name: 'Sucursal 1' },
    assignments: Array.from({ length: assignmentCount }, (_, index) => ({ userId: `user-${index + 1}` })),
  };
}

function buildAbsence(userId: string, id = `absence-${userId}`) {
  return {
    id,
    employeeId: userId,
    startDate: new Date('2026-05-12T00:00:00.000Z'),
    endDate: new Date('2026-05-13T23:59:59.999Z'),
  };
}

describe('PlanningManager.listCoverageRisks', () => {
  beforeEach(() => {
    prismaMock.absence.findMany.mockResolvedValue([]);
  });

  it('returns high risk for schedules without assignments', async () => {
    prismaMock.schedule.findMany.mockResolvedValue([buildSchedule(0)] as never);

    const risks = await planningManager.listCoverageRisks(filters, actor);

    expect(risks).toEqual([
      {
        severity: 'high',
        reasons: ['Turno descubierto'],
        schedule: {
          id: 'schedule-0',
          title: 'Turno 0',
          startDatetime: '2026-05-12T08:00:00.000Z',
          endDatetime: '2026-05-12T16:00:00.000Z',
          branch: { id: 'branch-1', name: 'Sucursal 1' },
        },
      },
    ]);
  });

  it('returns medium risk for schedules with a single assignment', async () => {
    prismaMock.schedule.findMany.mockResolvedValue([buildSchedule(1)] as never);

    const risks = await planningManager.listCoverageRisks(filters, actor);

    expect(risks).toHaveLength(1);
    expect(risks[0]).toMatchObject({
      severity: 'medium',
      reasons: ['Turno con una sola persona asignada'],
      schedule: { id: 'schedule-1' },
    });
  });

  it('filters out schedules with two or more assignments', async () => {
    prismaMock.schedule.findMany.mockResolvedValue([
      buildSchedule(0, { id: 'uncovered' }),
      buildSchedule(2, { id: 'covered' }),
    ] as never);

    const risks = await planningManager.listCoverageRisks(filters, actor);

    expect(risks.map((risk) => risk.schedule.id)).toEqual(['uncovered']);
  });

  it('queries schedules by date overlap and scoped branches in a single query', async () => {
    prismaMock.schedule.findMany.mockResolvedValue([] as never);

    await planningManager.listCoverageRisks(filters, actor);

    expect(prismaMock.schedule.findMany).toHaveBeenCalledTimes(1);
    expect(prismaMock.absence.findMany).not.toHaveBeenCalled();
    expect(prismaMock.schedule.findMany).toHaveBeenCalledWith({
      where: {
        AND: [
          { startDatetime: { lte: filters.to } },
          { endDatetime: { gte: filters.from } },
        ],
        branchId: { in: ['branch-1'] },
      },
      select: expect.objectContaining({
        id: true,
        title: true,
        assignments: { select: { userId: true } },
      }),
      orderBy: { startDatetime: 'asc' },
    });
  });

  it('returns high risk when an assigned user has approved absence in the range', async () => {
    prismaMock.schedule.findMany.mockResolvedValue([buildSchedule(2, { id: 'covered-with-absence' })] as never);
    prismaMock.absence.findMany.mockResolvedValue([buildAbsence('user-1')] as never);

    const risks = await planningManager.listCoverageRisks(filters, actor);

    expect(risks).toEqual([
      expect.objectContaining({
        severity: 'high',
        reasons: ['1 asignado(s) con ausencias aprobadas'],
        schedule: expect.objectContaining({ id: 'covered-with-absence' }),
        absenceConflicts: [
          {
            userId: 'user-1',
            absenceId: 'absence-user-1',
            startDate: '2026-05-12T00:00:00.000Z',
            endDate: '2026-05-13T23:59:59.999Z',
          },
        ],
      }),
    ]);
  });

  it('queries approved absences for all assigned users in a single batch', async () => {
    prismaMock.schedule.findMany.mockResolvedValue([
      buildSchedule(1, { id: 'one' }),
      {
        ...buildSchedule(2, { id: 'two' }),
        assignments: [{ userId: 'user-2' }, { userId: 'user-3' }],
      },
    ] as never);
    prismaMock.absence.findMany.mockResolvedValue([] as never);

    await planningManager.listCoverageRisks(filters, actor);

    expect(prismaMock.absence.findMany).toHaveBeenCalledTimes(1);
    expect(prismaMock.absence.findMany).toHaveBeenCalledWith({
      where: {
        employeeId: { in: ['user-1', 'user-2', 'user-3'] },
        status: 'approved',
        AND: [
          { startDate: { lte: filters.to } },
          { endDate: { gte: filters.from } },
        ],
      },
      select: expect.objectContaining({
        id: true,
        employeeId: true,
        startDate: true,
        endDate: true,
      }),
    });
  });
});
