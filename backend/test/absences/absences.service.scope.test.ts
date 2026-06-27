import { createAppError } from '../../src/common/errors/error-catalog';

jest.mock('../../src/modules/absences/absences.repository', () => ({
  findAbsenceRequests: jest.fn(),
  countAbsenceRequests: jest.fn(),
}));

import { countAbsenceRequests, findAbsenceRequests } from '../../src/modules/absences/absences.repository';
import { listAbsences } from '../../src/modules/absences/absences.service';

const mockedFindAbsenceRequests = findAbsenceRequests as jest.MockedFunction<typeof findAbsenceRequests>;
const mockedCountAbsenceRequests = countAbsenceRequests as jest.MockedFunction<typeof countAbsenceRequests>;

describe('absences.service scope', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockedFindAbsenceRequests.mockResolvedValue([]);
    mockedCountAbsenceRequests.mockResolvedValue(0);
  });

  it('general_manager usa branchId in visibleBranchIds cuando no filtra', async () => {
    await listAbsences(
      { page: 1, pageSize: 20, sortBy: 'createdAt', sortOrder: 'desc' },
      {
        id: 'gm-1',
        roleName: 'general_manager',
        email: 'gm@test.com',
        name: 'GM',
        branchId: 'branch-a',
        visibleBranchIds: ['branch-b'],
        permissions: ['absences:read-all'],
      },
    );

    expect(mockedFindAbsenceRequests).toHaveBeenCalledWith(
      expect.objectContaining({
        branchId: { in: ['branch-a', 'branch-b'] },
      }),
      expect.anything(),
    );
  });

  it('general_manager rechaza branch fuera de visibleBranchIds', async () => {
    await expect(
      listAbsences(
        { page: 1, pageSize: 20, sortBy: 'createdAt', sortOrder: 'desc', branchId: 'branch-z' },
        {
          id: 'gm-1',
          roleName: 'general_manager',
          email: 'gm@test.com',
          name: 'GM',
          branchId: 'branch-a',
          visibleBranchIds: ['branch-b'],
          permissions: ['absences:read-all'],
        },
      ),
    ).rejects.toMatchObject(createAppError('FORBIDDEN', 'No puedes consultar ausencias de otra sucursal'));
  });

  it('general_manager sin visibleBranchIds extra usa solo su branchId en el scope', async () => {
    await listAbsences(
      { page: 1, pageSize: 20, sortBy: 'createdAt', sortOrder: 'desc' },
      {
        id: 'gm-1',
        roleName: 'general_manager',
        email: 'gm@test.com',
        name: 'GM',
        branchId: 'branch-a',
        visibleBranchIds: [],
        permissions: ['absences:read-all'],
      },
    );

    expect(mockedFindAbsenceRequests).toHaveBeenCalledWith(
      expect.objectContaining({
        branchId: { in: ['branch-a'] },
      }),
      expect.anything(),
    );
  });

  it('department_manager rechaza branch fuera de visibleBranchIds', async () => {
    await expect(
      listAbsences(
        { page: 1, pageSize: 20, sortBy: 'createdAt', sortOrder: 'desc', branchId: 'branch-z' },
        {
          id: 'dm-1',
          roleName: 'department_manager',
          email: 'dm@test.com',
          name: 'DM',
          branchId: 'branch-a',
          visibleBranchIds: ['branch-b'],
          departmentId: 'dept-1',
          permissions: ['absences:read-all'],
        },
      ),
    ).rejects.toMatchObject(createAppError('FORBIDDEN', 'No puedes consultar ausencias de otra sucursal'));
  });

  it('employee sin read-all solo ve solicitudes propias', async () => {
    await listAbsences(
      { page: 1, pageSize: 20, sortBy: 'createdAt', sortOrder: 'desc' },
      {
        id: 'emp-1',
        roleName: 'employee',
        email: 'e@test.com',
        name: 'Emp',
        branchId: 'branch-a',
        permissions: ['absences:read', 'absences:create'],
      },
    );

    expect(mockedFindAbsenceRequests).toHaveBeenCalledWith(
      expect.objectContaining({
        employeeId: 'emp-1',
      }),
      expect.anything(),
    );
  });

  it('aplica búsqueda por nombre/email/employeeId', async () => {
    await listAbsences(
      { page: 1, pageSize: 20, sortBy: 'createdAt', sortOrder: 'desc', search: 'maria' },
      {
        id: 'admin-1',
        roleName: 'admin',
        email: 'admin@test.com',
        name: 'Admin',
        permissions: ['absences:read-all'],
      },
    );

    expect(mockedFindAbsenceRequests).toHaveBeenCalledWith(
      expect.objectContaining({
        OR: [
          { employee: { name: { contains: 'maria', mode: 'insensitive' } } },
          { employee: { email: { contains: 'maria', mode: 'insensitive' } } },
          { employee: { employeeId: { contains: 'maria', mode: 'insensitive' } } },
        ],
      }),
      expect.anything(),
    );
  });
});
