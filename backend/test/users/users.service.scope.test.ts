import { getUserSchedules } from '../../src/modules/users/users.service';

jest.mock('../../src/modules/users/users.repository', () => ({
  findUserById: jest.fn(),
  listUserSchedules: jest.fn(),
}));

import { findUserById, listUserSchedules } from '../../src/modules/users/users.repository';

const mockedFindUserById = findUserById as jest.MockedFunction<typeof findUserById>;
const mockedListUserSchedules = listUserSchedules as jest.MockedFunction<typeof listUserSchedules>;

describe('users.service getUserSchedules scope', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('permite a admin consultar horarios de cualquier sucursal', async () => {
    mockedFindUserById.mockResolvedValue({
      id: 'target-user',
      branchId: 'branch-b',
    } as any);
    mockedListUserSchedules.mockResolvedValue([]);

    await getUserSchedules(
      'target-user',
      {
        id: 'admin-1',
        roleName: 'admin',
        branchId: 'branch-a',
      },
      '2026-05-01',
      '2026-05-31',
    );

    expect(mockedListUserSchedules).toHaveBeenCalledTimes(1);
  });

  it('permite a no-admin consultar si la sucursal está en visibleBranchIds', async () => {
    mockedFindUserById.mockResolvedValue({
      id: 'target-user',
      branchId: 'branch-b',
    } as any);
    mockedListUserSchedules.mockResolvedValue([]);

    await getUserSchedules(
      'target-user',
      {
        id: 'gm-1',
        roleName: 'general_manager',
        branchId: 'branch-a',
        visibleBranchIds: ['branch-b'],
      },
    );

    expect(mockedListUserSchedules).toHaveBeenCalledTimes(1);
  });

  it('rechaza acceso no-admin fuera de scope visible', async () => {
    mockedFindUserById.mockResolvedValue({
      id: 'target-user',
      branchId: 'branch-c',
    } as any);

    await expect(
      getUserSchedules('target-user', {
        id: 'emp-1',
        roleName: 'employee',
        branchId: 'branch-a',
        visibleBranchIds: ['branch-b'],
      }),
    ).rejects.toMatchObject({
      code: 'FORBIDDEN',
      statusCode: 403,
    });

    expect(mockedListUserSchedules).not.toHaveBeenCalled();
  });
});
