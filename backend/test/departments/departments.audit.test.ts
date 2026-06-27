/**
 * @file departments.audit.test.ts
 * Verifica que los cambios de Department escriben snapshots before/after en audit y que el hard delete/soft delete quedan trazados.
 */

const mockTx = {
  department: {
    upsert: jest.fn(),
    delete: jest.fn(),
  },
  departmentBranch: {
    deleteMany: jest.fn(),
    createMany: jest.fn(),
  },
  auditLog: {
    update: jest.fn(),
  },
};

jest.mock('../../src/common/transactions/transaction.utils', () => ({
  executeInTransaction: jest.fn((fn: any) => fn(mockTx)),
}));

jest.mock('../../src/modules/audit/audit.service', () => ({
  logAuditOrThrow: jest.fn(),
}));

jest.mock('../../src/modules/branches/branches.repository', () => ({
  findBranchById: jest.fn(),
}));

jest.mock('../../src/modules/departments/departments.repository', () => ({
  createDepartmentRecord: jest.fn(),
  findDepartmentByCode: jest.fn(),
  findDepartmentByName: jest.fn(),
  findDepartmentById: jest.fn(),
  findDepartmentCodeConflict: jest.fn(),
  findDepartmentNameConflict: jest.fn(),
  findDepartmentBranches: jest.fn(),
  findDepartmentsByBranch: jest.fn(),
  findDepartments: jest.fn(),
  hardDeleteDepartmentRecord: jest.fn(),
  countUsersByDepartment: jest.fn(),
  countAbsencesByDepartment: jest.fn().mockResolvedValue(0),
  removeDepartmentBranches: jest.fn(),
  softDeleteDepartmentRecord: jest.fn(),
  setDepartmentBranches: jest.fn(),
  updateDepartmentRecord: jest.fn(),
  findDepartmentBranchIds: jest.fn(),
}));

import { logAuditOrThrow } from '../../src/modules/audit/audit.service';
import {
  createDepartment,
  deleteDepartment,
  hardDeleteDepartment,
  updateDepartment,
} from '../../src/modules/departments/departments.service';
import * as departmentsRepo from '../../src/modules/departments/departments.repository';
import * as branchesRepo from '../../src/modules/branches/branches.repository';

const mockDepartmentsRepo = departmentsRepo as jest.Mocked<typeof departmentsRepo>;
const mockBranchesRepo = branchesRepo as jest.Mocked<typeof branchesRepo>;
const mockLogAuditOrThrow = logAuditOrThrow as jest.MockedFunction<typeof logAuditOrThrow>;

describe('departments audit integration', () => {
  const actor = { id: 'admin-1', ipAddress: '127.0.0.1' };

  let departmentState: any;
  let branchIds: string[];

  beforeEach(() => {
    jest.clearAllMocks();
    departmentState = {
      id: 'dept-1',
      name: 'Recursos Humanos',
      code: 'RH01',
      description: 'Equipo interno',
      isActive: true,
      _count: { users: 0 },
      branches: [],
    };
    branchIds = ['branch-1'];

    (mockBranchesRepo.findBranchById as any).mockImplementation(async (branchId: string) => ({
      id: branchId,
      name: `Sucursal ${branchId}`,
      code: branchId.toUpperCase(),
      isActive: true,
    } as any));

    (mockDepartmentsRepo.findDepartmentById as any).mockImplementation(async () => ({
      ...departmentState,
      branches: branchIds.map((branchId) => ({ branch: { id: branchId, name: `Sucursal ${branchId}`, code: branchId, isActive: true } })),
    } as any));

    (mockDepartmentsRepo.findDepartmentBranchIds as any).mockImplementation(async () => branchIds.map((branchId) => ({ branchId })) as any);
    (mockDepartmentsRepo.setDepartmentBranches as any).mockImplementation(async (_departmentId: string, nextBranchIds: string[]) => {
      branchIds = [...nextBranchIds];
      return undefined as any;
    });
    (mockDepartmentsRepo.removeDepartmentBranches as any).mockImplementation(async () => {
      branchIds = [];
      return undefined as any;
    });
    (mockDepartmentsRepo.createDepartmentRecord as any).mockResolvedValue({
      id: 'dept-1',
      name: 'Recursos Humanos',
      code: 'RH01',
      description: 'Equipo interno',
      isActive: true,
    } as any);
    (mockDepartmentsRepo.updateDepartmentRecord as any).mockImplementation(async (_departmentId: string, data: Record<string, unknown>) => {
      departmentState = { ...departmentState, ...data };
      return departmentState;
    });
    (mockDepartmentsRepo.softDeleteDepartmentRecord as any).mockImplementation(async () => {
      departmentState = { ...departmentState, isActive: false };
      return departmentState;
    });
    (mockDepartmentsRepo.hardDeleteDepartmentRecord as any).mockImplementation(async () => {
      departmentState = null;
      return undefined as any;
    });
  });

  it('guarda snapshots before/after al crear un departamento', async () => {
    await createDepartment({
      name: 'Recursos Humanos',
      code: 'rh01',
      description: 'Equipo interno',
      branchIds: ['branch-1'],
    }, actor);

    expect(mockLogAuditOrThrow).toHaveBeenCalledWith(expect.objectContaining({
      action: 'CREATE_DEPARTMENT',
      entityType: 'Department',
      detailsJson: expect.objectContaining({
        before: null,
        after: expect.objectContaining({
          id: 'dept-1',
          code: 'RH01',
          branchIds: ['branch-1'],
        }),
      }),
    }), expect.anything());
  });

  it('guarda snapshots before/after al actualizar un departamento', async () => {
    await updateDepartment('dept-1', {
      name: 'Recursos Humanos 2',
      branchIds: ['branch-1', 'branch-2'],
    }, actor);

    expect(mockLogAuditOrThrow).toHaveBeenCalledWith(expect.objectContaining({
      action: 'UPDATE_DEPARTMENT',
      entityType: 'Department',
      detailsJson: expect.objectContaining({
        before: expect.objectContaining({ branchIds: ['branch-1'] }),
        after: expect.objectContaining({ branchIds: ['branch-1', 'branch-2'] }),
      }),
    }), expect.anything());
  });

  it('registra el soft delete con snapshot antes y despues', async () => {
    await deleteDepartment('dept-1', actor);

    expect(mockLogAuditOrThrow).toHaveBeenCalledWith(expect.objectContaining({
      action: 'DELETE_DEPARTMENT',
      detailsJson: expect.objectContaining({
        before: expect.objectContaining({ isActive: true }),
        after: expect.objectContaining({ isActive: false }),
      }),
    }), expect.anything());
  });

  it('registra el hard delete con snapshot previo', async () => {
    await hardDeleteDepartment('dept-1', actor);

    expect(mockLogAuditOrThrow).toHaveBeenCalledWith(expect.objectContaining({
      action: 'HARD_DELETE_DEPARTMENT',
      detailsJson: expect.objectContaining({
        before: expect.objectContaining({ branchIds: ['branch-1'] }),
        after: null,
      }),
    }), expect.anything());
  });
});