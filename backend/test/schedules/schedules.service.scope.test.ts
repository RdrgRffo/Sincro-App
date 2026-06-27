import {
  getScheduleByIdForActor,
  listSchedulesForActor,
  listWeekSchedulesForActor,
} from '../../src/modules/schedules/schedules.service';

jest.mock('../../src/modules/schedules/schedules.repository', () => ({
  findSchedules: jest.fn(),
  findScheduleById: jest.fn(),
}));

import { findScheduleById, findSchedules } from '../../src/modules/schedules/schedules.repository';

const mockedFindSchedules = findSchedules as jest.MockedFunction<typeof findSchedules>;
const mockedFindScheduleById = findScheduleById as jest.MockedFunction<typeof findScheduleById>;

describe('schedules.service visible branch scope', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('listSchedulesForActor usa branchId in-scope cuando no-admin no filtra branch', async () => {
    mockedFindSchedules.mockResolvedValue([]);

    await listSchedulesForActor(
      {},
      {
        id: 'gm-1',
        roleName: 'general_manager',
        branchId: 'branch-a',
        visibleBranchIds: ['branch-b'],
      },
    );

    expect(mockedFindSchedules).toHaveBeenCalledWith(
      expect.objectContaining({
        branchId: { in: ['branch-a', 'branch-b'] },
      }),
    );
  });

  it('listSchedulesForActor normaliza type desde scheduleType.value', async () => {
    mockedFindSchedules.mockResolvedValue([
      {
        id: 'sch-type-1',
        title: 'Formación técnica',
        scheduleType: { value: 'formacion' },
      } as any,
    ]);

    const result = await listSchedulesForActor(
      {},
      {
        id: 'admin-1',
        roleName: 'admin',
        branchId: 'branch-a',
        visibleBranchIds: [],
      },
    );

    expect(result[0]).toEqual(
      expect.objectContaining({
        id: 'sch-type-1',
        type: 'formacion',
      }),
    );
  });

  it('listSchedulesForActor rechaza branch fuera de scope', async () => {
    expect(() =>
      listSchedulesForActor(
        { branchId: 'branch-z' },
        {
          id: 'dm-1',
          roleName: 'department_manager',
          branchId: 'branch-a',
          visibleBranchIds: ['branch-b'],
        },
      ),
    ).toThrow('No tienes permiso para consultar esa sucursal');
  });

  it('getScheduleByIdForActor permite acceso cuando schedule está en visibleBranchIds', async () => {
    mockedFindScheduleById.mockResolvedValue({
      id: 'sch-1',
      branchId: 'branch-b',
    } as any);

    const schedule = await getScheduleByIdForActor('sch-1', {
      roleName: 'employee',
      branchId: 'branch-a',
      visibleBranchIds: ['branch-b'],
    });

    expect(schedule).toMatchObject({ id: 'sch-1' });
  });

  it('getScheduleByIdForActor rechaza acceso fuera de scope visible', async () => {
    mockedFindScheduleById.mockResolvedValue({
      id: 'sch-2',
      branchId: 'branch-z',
    } as any);

    await expect(
      getScheduleByIdForActor('sch-2', {
        roleName: 'employee',
        branchId: 'branch-a',
        visibleBranchIds: ['branch-b'],
      }),
    ).rejects.toMatchObject({
      code: 'FORBIDDEN',
      statusCode: 403,
    });
  });

  it('listWeekSchedulesForActor usa branch base cuando no se filtra branch', async () => {
    mockedFindSchedules.mockResolvedValue([]);

    await listWeekSchedulesForActor(
      2026,
      20,
      undefined,
      undefined,
      undefined,
      {
        id: 'emp-1',
        roleName: 'employee',
        branchId: 'branch-a',
        visibleBranchIds: ['branch-b'],
      },
    );

    expect(mockedFindSchedules).toHaveBeenCalledWith(
      expect.objectContaining({
        AND: expect.arrayContaining([
          { branchId: 'branch-a' },
        ]),
      }),
    );
  });
});
