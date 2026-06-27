jest.mock('../../src/modules/absences/absences.repository', () => ({
  findAbsenceRequests: jest.fn(),
}));

import { prismaMock } from '../config/singleton';
import { findAbsenceRequests } from '../../src/modules/absences/absences.repository';
import { getAbsenceCalendar } from '../../src/modules/absences/absences.service';

const mockedFindAbsenceRequests = findAbsenceRequests as jest.MockedFunction<typeof findAbsenceRequests>;

describe('getAbsenceCalendar — branch/department filtering', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockedFindAbsenceRequests.mockResolvedValue([] as any);
  });

  it('admin with read-all and department filter uses department branches', async () => {
    // department links to branches b1,b2
    prismaMock.departmentBranch.findMany.mockResolvedValue([{ branchId: 'b1' }, { branchId: 'b2' }] as any);

    await getAbsenceCalendar(undefined, undefined, undefined, 'dept-1', undefined, { id: 'admin-1', roleName: 'admin', permissions: ['absences:read-all'] as any, email: 'admin@example.com', name: 'Admin' } as any);

    expect(mockedFindAbsenceRequests).toHaveBeenCalledWith(expect.objectContaining({
      branchId: { in: ['b1', 'b2'] },
      departmentId: 'dept-1',
    }));
  });

  it('general_manager constrained to visibleBranchIds intersects with department branches', async () => {
    // department links to branches b1,b2
    prismaMock.departmentBranch.findMany.mockResolvedValue([{ branchId: 'b1' }, { branchId: 'b2' }] as any);

    const actor = {
      id: 'gm-1',
      roleName: 'general_manager',
      branchId: undefined,
      visibleBranchIds: ['b2'],
      permissions: [],
      email: 'gm1@example.com',
      name: 'GM One',
    } as any;

    await getAbsenceCalendar(undefined, undefined, undefined, 'dept-1', undefined, actor);

    expect(mockedFindAbsenceRequests).toHaveBeenCalledWith(expect.objectContaining({
      branchId: { in: ['b2'] },
      departmentId: 'dept-1',
    }));
  });

  it('no overlapping branches results in empty scope (id set to __none__)', async () => {
    // department links to branches x,y
    prismaMock.departmentBranch.findMany.mockResolvedValue([{ branchId: 'x' }, { branchId: 'y' }] as any);

    const actor = {
      id: 'gm-2',
      roleName: 'general_manager',
      branchId: 'b1',
      visibleBranchIds: ['b1'],
      permissions: [],
      email: 'gm2@example.com',
      name: 'GM Two',
    } as any;

    await getAbsenceCalendar(undefined, undefined, undefined, 'dept-2', undefined, actor);

    expect(mockedFindAbsenceRequests).toHaveBeenCalledWith(expect.objectContaining({
      id: '__none__',
    }));
  });
});
