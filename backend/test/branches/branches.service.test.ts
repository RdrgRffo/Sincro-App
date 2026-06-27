import {
  deleteBranch,
  bulkDeleteSharedHolidays,
  bulkUpdateSharedHolidays,
  hardDeleteBranch,
  reactivateBranch,
  listBranchHolidays,
  listBranches,
} from '../../src/modules/branches/branches.service';
import * as branchesRepository from '../../src/modules/branches/branches.repository';

jest.mock('../../src/modules/branches/branches.repository');
jest.mock('../../src/modules/audit/audit.service', () => ({
  logAuditOrThrow: jest.fn().mockResolvedValue(undefined),
  sanitizeSnapshot: jest.fn((x) => x),
}));
jest.mock('../../src/common/transactions/transaction.utils', () => ({
  executeInTransaction: jest.fn(async (operation: any) => operation({ tx: true })),
}));

import { prismaMock } from '../config/singleton';
const repo = branchesRepository as jest.Mocked<typeof branchesRepository>;

const actor = {
  id: 'admin-1',
  ipAddress: '127.0.0.1',
};

describe('listBranches', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('sin actor devuelve todas las sucursales activas', async () => {
    repo.findBranches.mockResolvedValue([] as any);
    await listBranches({ includeInactive: false });
    expect(repo.findBranches).toHaveBeenCalledWith({ isActive: true });
  });

  it('admin ve todas las sucursales (activas por defecto)', async () => {
    repo.findBranches.mockResolvedValue([] as any);
    await listBranches({
      includeInactive: false,
      actor: { roleName: 'admin', branchId: 'b-1', visibleBranchIds: [] },
    });
    expect(repo.findBranches).toHaveBeenCalledWith({ isActive: true });
  });

  it('general_manager ve todas las sucursales', async () => {
    repo.findBranches.mockResolvedValue([] as any);
    await listBranches({
      includeInactive: false,
      actor: { roleName: 'general_manager', branchId: 'b-1', visibleBranchIds: [] },
    });
    expect(repo.findBranches).toHaveBeenCalledWith({ isActive: true });
  });

  it('empleado solo ve sucursales asignadas (home + visibles)', async () => {
    repo.findBranches.mockResolvedValue([] as any);
    await listBranches({
      includeInactive: false,
      actor: { roleName: 'employee', branchId: 'b-1', visibleBranchIds: ['b-2'] },
    });
    expect(repo.findBranches).toHaveBeenCalledWith({
      isActive: true,
      id: { in: ['b-1', 'b-2'] },
    });
  });

  it('empleado sin sucursales asignadas recibe lista vacía', async () => {
    const result = await listBranches({
      includeInactive: false,
      actor: { roleName: 'employee', branchId: null, visibleBranchIds: [] },
    });
    expect(result).toEqual([]);
    expect(repo.findBranches).not.toHaveBeenCalled();
  });
});

describe('branches.service grouped holidays', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('agrupa festivos compartidos cuando groupShared=true y branchId=all', async () => {
    repo.findBranchHolidays.mockResolvedValue([
      {
        id: 'h-1',
        branchId: 'b-1',
        date: new Date('2026-01-01T00:00:00Z'),
        originalDate: null,
        name: 'Año Nuevo',
        type: 'nacional',
        scope: 'national',
        isPartial: false,
        isActive: true,
        createdAt: new Date('2025-01-01T00:00:00Z'),
        updatedAt: new Date('2025-01-01T00:00:00Z'),
        branch: { id: 'b-1', name: 'Madrid', code: 'MAD01' },
      } as any,
      {
        id: 'h-2',
        branchId: 'b-2',
        date: new Date('2026-01-01T00:00:00Z'),
        originalDate: null,
        name: 'Año Nuevo',
        type: 'nacional',
        scope: 'national',
        isPartial: false,
        isActive: true,
        createdAt: new Date('2025-01-01T00:00:00Z'),
        updatedAt: new Date('2025-01-02T00:00:00Z'),
        branch: { id: 'b-2', name: 'Barcelona', code: 'BCN02' },
      } as any,
    ]);

    const result = await listBranchHolidays('all', {
      includeInactive: true,
      groupShared: true,
    });

    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({
      branchId: 'all',
      name: 'Año Nuevo',
      holidayIds: ['h-1', 'h-2'],
      sharedCount: 2,
    });
  });
});

describe('branches.service shared holiday bulk actions', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('actualiza en bloque todos los festivos indicados', async () => {
    repo.findBranchHolidaysByIds.mockResolvedValue([
      { id: 'h-1' } as any,
      { id: 'h-2' } as any,
    ]);
    repo.updateBranchHolidaysByIds.mockResolvedValue({ count: 2 } as any);

    await bulkUpdateSharedHolidays(
      {
        holidayIds: ['h-1', 'h-2'],
        name: 'Festivo Nacional',
      },
      actor,
    );

    expect(repo.findBranchHolidaysByIds).toHaveBeenCalledWith(['h-1', 'h-2'], { tx: true });
    expect(repo.updateBranchHolidaysByIds).toHaveBeenCalledWith(
      ['h-1', 'h-2'],
      expect.objectContaining({ name: 'Festivo Nacional' }),
      { tx: true },
    );
  });

  it('elimina en bloque todos los festivos indicados', async () => {
    repo.findBranchHolidaysByIds.mockResolvedValue([
      { id: 'h-1' } as any,
      { id: 'h-2' } as any,
    ]);
    repo.deleteBranchHolidaysByIds.mockResolvedValue({ count: 2 } as any);

    await bulkDeleteSharedHolidays(['h-1', 'h-2'], actor);

    expect(repo.findBranchHolidaysByIds).toHaveBeenCalledWith(['h-1', 'h-2'], { tx: true });
    expect(repo.deleteBranchHolidaysByIds).toHaveBeenCalledWith(['h-1', 'h-2'], { tx: true });
  });
});

describe('reactivateBranch', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('reactiva una sucursal inactiva', async () => {
    repo.findBranchById.mockResolvedValue({
      id: 'b-1',
      name: 'Madrid',
      code: 'MAD',
      isActive: false,
    } as any);
    repo.findBranchByCode.mockResolvedValue(null as any);
    repo.updateBranchRecord.mockResolvedValue({
      id: 'b-1',
      name: 'Madrid',
      code: 'MAD',
      isActive: true,
    } as any);

    const result = await reactivateBranch('b-1', actor as any);

    expect(result.isActive).toBe(true);
    expect(repo.updateBranchRecord).toHaveBeenCalledWith('b-1', { isActive: true }, { tx: true });
  });

  it('lanza error si la sucursal ya está activa', async () => {
    repo.findBranchById.mockResolvedValue({
      id: 'b-1',
      name: 'Madrid',
      code: 'MAD',
      isActive: true,
    } as any);

    await expect(reactivateBranch('b-1', actor as any)).rejects.toThrow('La sucursal ya está activa');
  });
});

describe('deleteBranch', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('bloquea el borrado si hay departamentos vinculados', async () => {
    repo.findBranchById.mockResolvedValue({
      id: 'b-1',
      name: 'Madrid',
      code: 'MAD',
      isActive: false,
    } as any);
    repo.countActiveBranches.mockResolvedValue(2 as any);
    repo.countDepartmentsByBranch.mockResolvedValue(1 as any);
    repo.countSchedulesByBranch.mockResolvedValue(0 as any);
    repo.countAbsencesByBranch.mockResolvedValue(0 as any);

    await expect(deleteBranch('b-1', actor as any)).rejects.toThrow('departamento(s)');
  });

  it('bloquea el borrado si hay turnos vinculados', async () => {
    repo.findBranchById.mockResolvedValue({
      id: 'b-1',
      name: 'Madrid',
      code: 'MAD',
      isActive: false,
    } as any);
    repo.countActiveBranches.mockResolvedValue(2 as any);
    repo.countDepartmentsByBranch.mockResolvedValue(0 as any);
    repo.countSchedulesByBranch.mockResolvedValue(1 as any);
    repo.countAbsencesByBranch.mockResolvedValue(0 as any);

    await expect(deleteBranch('b-1', actor as any)).rejects.toThrow('turno(s)');
  });

  it('bloquea el borrado si hay ausencias vinculadas', async () => {
    repo.findBranchById.mockResolvedValue({
      id: 'b-1',
      name: 'Madrid',
      code: 'MAD',
      isActive: false,
    } as any);
    repo.countActiveBranches.mockResolvedValue(2 as any);
    repo.countDepartmentsByBranch.mockResolvedValue(0 as any);
    repo.countSchedulesByBranch.mockResolvedValue(0 as any);
    repo.countAbsencesByBranch.mockResolvedValue(1 as any);

    await expect(deleteBranch('b-1', actor as any)).rejects.toThrow('ausencia(s)');
  });
});

describe('hardDeleteBranch', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('bloquea el borrado definitivo si hay ausencias vinculadas', async () => {
    repo.findBranchById.mockResolvedValue({
      id: 'b-1',
      name: 'Madrid',
      code: 'MAD',
      isActive: false,
    } as any);
    repo.countActiveBranches.mockResolvedValue(2 as any);
    repo.countDepartmentsByBranch.mockResolvedValue(0 as any);
    repo.countSchedulesByBranch.mockResolvedValue(0 as any);
    repo.countAbsencesByBranch.mockResolvedValue(1 as any);

    await expect(hardDeleteBranch('b-1', actor as any)).rejects.toThrow('ausencia(s)');
  });
});
