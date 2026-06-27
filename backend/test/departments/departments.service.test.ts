/**
 * @file departments.service.test.ts
 * Cubre la lógica de reactivación de departamentos y los conflictos básicos de estado.
 */

jest.mock('../../src/modules/audit/audit.service', () => ({
  logAuditOrThrow: jest.fn().mockResolvedValue(undefined),
}));

jest.mock('../../src/common/transactions/transaction.utils', () => ({
  executeInTransaction: jest.fn(async (fn: any) => fn({
    department: {
      update: jest.fn((args: any) => Promise.resolve({ id: args.where.id, ...args.data })),
    },
  })),
}));

jest.mock('../../src/modules/branches/branches.repository', () => ({
  findBranchById: jest.fn().mockResolvedValue({ id: 'branch-1' }),
}));

jest.mock('../../src/modules/departments/departments.repository', () => ({
  findDepartmentById: jest.fn(),
  findDepartmentByCode: jest.fn(),
  findDepartmentByName: jest.fn(),
  findDepartmentBranchIds: jest.fn(),
  updateDepartmentRecord: jest.fn(),
  countAbsencesByDepartment: jest.fn().mockResolvedValue(0),
  countDepartmentsForManager: jest.fn().mockResolvedValue(0),
  createDepartmentRecord: jest.fn(),
  deleteDepartmentManager: jest.fn(),
  findDepartmentCodeConflict: jest.fn(),
  findDepartmentNameConflict: jest.fn(),
  findDepartmentBranches: jest.fn(),
  findDepartmentsByBranch: jest.fn(),
  findDepartments: jest.fn(),
  hardDeleteDepartmentRecord: jest.fn(),
  removeDepartmentBranches: jest.fn(),
  softDeleteDepartmentRecord: jest.fn(),
  setDepartmentBranches: jest.fn(),
  upsertDepartmentManager: jest.fn(),
}));

import * as departmentsRepository from '../../src/modules/departments/departments.repository';
import {
  deleteDepartment,
  hardDeleteDepartment,
  reactivateDepartment,
} from '../../src/modules/departments/departments.service';

const repo = departmentsRepository as jest.Mocked<typeof departmentsRepository>;
const actor = { id: 'admin-1', ipAddress: '127.0.0.1' };

describe('reactivateDepartment', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('reactiva un departamento inactivo', async () => {
    repo.findDepartmentById.mockResolvedValue({
      id: 'dept-1',
      name: 'Atención',
      code: 'ATEN',
      description: null,
      isActive: false,
      managers: [],
      branches: [],
      _count: { users: 0 },
    } as any);
    repo.findDepartmentBranchIds.mockResolvedValue([{ branchId: 'branch-1' }] as any);
    repo.findDepartmentByCode.mockResolvedValue(null as any);
    repo.findDepartmentByName.mockResolvedValue(null as any);
    repo.updateDepartmentRecord.mockResolvedValue({ id: 'dept-1', isActive: true } as any);

    const result = await reactivateDepartment('dept-1', actor as any);

    expect(result.isActive).toBe(true);
    expect(repo.updateDepartmentRecord).toHaveBeenCalledWith(
      'dept-1',
      { isActive: true },
      expect.objectContaining({ department: expect.any(Object) }),
    );
  });

  it('lanza error si ya está activo', async () => {
    repo.findDepartmentById.mockResolvedValue({
      id: 'dept-1',
      name: 'Atención',
      code: 'ATEN',
      description: null,
      isActive: true,
      managers: [],
      branches: [],
      _count: { users: 0 },
    } as any);
    repo.findDepartmentBranchIds.mockResolvedValue([{ branchId: 'branch-1' }] as any);

    await expect(reactivateDepartment('dept-1', actor as any)).rejects.toThrow('El departamento ya está activo');
  });
});

describe('deleteDepartment', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('bloquea el borrado si hay usuarios asignados', async () => {
    repo.findDepartmentById.mockResolvedValue({
      id: 'dept-1',
      name: 'Atención',
      code: 'ATEN',
      description: null,
      isActive: true,
      managers: [] as any,
      branches: [] as any,
      _count: { users: 2 },
    } as any);
    repo.findDepartmentBranchIds.mockResolvedValue([{ branchId: 'branch-1' }] as any);
    repo.countAbsencesByDepartment.mockResolvedValue(0 as any);

    await expect(deleteDepartment('dept-1', actor as any)).rejects.toThrow('usuario(s)');
  });

  it('bloquea el borrado si hay ausencias asociadas', async () => {
    repo.findDepartmentById.mockResolvedValue({
      id: 'dept-1',
      name: 'Atención',
      code: 'ATEN',
      description: null,
      isActive: true,
      managers: [] as any,
      branches: [] as any,
      _count: { users: 0 },
    } as any);
    repo.findDepartmentBranchIds.mockResolvedValue([{ branchId: 'branch-1' }] as any);
    repo.countAbsencesByDepartment.mockResolvedValue(3 as any);

    await expect(deleteDepartment('dept-1', actor as any)).rejects.toThrow('ausencia(s)');
  });
});

describe('hardDeleteDepartment', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('bloquea el borrado definitivo si hay ausencias asociadas', async () => {
    repo.findDepartmentById.mockResolvedValue({
      id: 'dept-1',
      name: 'Atención',
      code: 'ATEN',
      description: null,
      isActive: true,
      managers: [] as any,
      branches: [] as any,
      _count: { users: 0 },
    } as any);
    repo.findDepartmentBranchIds.mockResolvedValue([{ branchId: 'branch-1' }] as any);
    repo.countAbsencesByDepartment.mockResolvedValue(1 as any);

    await expect(hardDeleteDepartment('dept-1', actor as any)).rejects.toThrow('ausencia(s)');
  });
});
