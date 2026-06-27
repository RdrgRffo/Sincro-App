import { planningManager } from '../../src/modules/planning/planning.manager';
import { prismaMock } from '../config/singleton';

describe('PlanningManager.listEquity', () => {
  const filters = {
    from: new Date('2026-05-12T00:00:00.000Z'),
    to: new Date('2026-05-18T23:59:59.999Z'),
    branchIds: ['branch-1'],
  };

  const branch = { id: 'branch-1', name: 'Sucursal' };
  const department = { id: 'dept-1', name: 'Dept' };

  beforeEach(() => {
    prismaMock.$queryRaw.mockClear();
    (prismaMock.absence.groupBy as jest.Mock).mockClear();
    prismaMock.user.findMany.mockResolvedValue([
      {
        id: 'u1',
        name: 'User One',
        email: 'u1@test.com',
        branchId: branch.id,
        departmentId: department.id,
        branch,
        department,
        skills: [],
      },
    ] as never);
    prismaMock.$queryRaw.mockResolvedValue([
      {
        user_id: 'u1',
        total_hours: 12,
        weekend_shifts: 1,
        urgent_shifts: 2,
      },
    ] as never);
    (prismaMock.absence.groupBy as jest.Mock).mockResolvedValue([
      { employeeId: 'u1', status: 'approved', _count: { _all: 2 } },
      { employeeId: 'u1', status: 'rejected', _count: { _all: 1 } },
    ] as never);
  });

  it('aggregates assignment stats via SQL and absence counts via groupBy', async () => {
    const rows = await planningManager.listEquity(filters);

    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({
      id: 'u1',
      name: 'User One',
      totalHours: 12,
      overtimeEstimate: 0,
      weekendShifts: 1,
      urgentShifts: 2,
      approvedAbsences: 2,
      rejectedAbsences: 1,
    });
    expect(prismaMock.$queryRaw).toHaveBeenCalledTimes(1);
    expect(prismaMock.absence.groupBy).toHaveBeenCalledTimes(1);
  });

  it('skips SQL aggregation when no users in scope', async () => {
    prismaMock.user.findMany.mockResolvedValueOnce([] as never);
    const rows = await planningManager.listEquity(filters);
    expect(rows).toEqual([]);
    expect(prismaMock.$queryRaw).not.toHaveBeenCalled();
    expect(prismaMock.absence.groupBy).not.toHaveBeenCalled();
  });
});
