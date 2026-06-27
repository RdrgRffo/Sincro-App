import { assignDepartmentManager, removeDepartmentManager } from '../../src/modules/departments/departments.service';
import * as departmentsRepo from '../../src/modules/departments/departments.repository';
import * as usersRepo from '../../src/modules/users/users.repository';
import * as rolesRepo from '../../src/modules/roles/roles.repository';
import * as auditService from '../../src/modules/audit/audit.service';
import { createAppError } from '../../src/common/errors/error-catalog';

// Mocks
jest.mock('../../src/modules/departments/departments.repository');
jest.mock('../../src/modules/users/users.repository');
jest.mock('../../src/modules/roles/roles.repository');
jest.mock('../../src/modules/audit/audit.service');

const mockDepartmentsRepo = jest.mocked(departmentsRepo);
const mockUsersRepo = jest.mocked(usersRepo);
const mockRolesRepo = jest.mocked(rolesRepo);
const mockLogAuditOrThrow = jest.mocked(auditService.logAuditOrThrow);

const mockTx = {
  $transaction: jest.fn(),
  user: {
    findUnique: jest.fn().mockImplementation(async ({ where: { id } }: { where: { id: string } }) => {
      // Delegate to findUserById mock so the tx sees the same user data
      const user = await mockUsersRepo.findUserById(id);
      if (!user) return null;
      return {
        id: (user as any).id,
        role: { name: (user as any).role?.name ?? (user as any).role },
      };
    }),
  },
} as any;

jest.mock('../../src/common/transactions/transaction.utils', () => ({
  executeInTransaction: jest.fn((fn: (tx: any) => any) => fn(mockTx)),
}));

const actor = { id: 'actor-1', ipAddress: '127.0.0.1' };

describe('assignDepartmentManager', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('asigna manager y otorga rol si no lo tiene', async () => {
    mockDepartmentsRepo.findDepartmentById.mockResolvedValue({
      id: 'dept-1',
      name: 'RH',
      code: 'RH01',
      managers: [],
      isActive: true,
      description: null,
      createdAt: new Date(),
      updatedAt: new Date(),
      branches: [],
      _count: { users: 0 },
    } as any);

    mockUsersRepo.findUserById.mockResolvedValue({
      id: 'user-1',
      name: 'Juan Pérez',
      email: 'juan@test.com',
      role: { name: 'employee' },
    } as any);

    mockRolesRepo.findRoleByName.mockResolvedValue({
      id: 'role-dm-id',
      name: 'department_manager',
    } as any);

    mockDepartmentsRepo.upsertDepartmentManager.mockResolvedValue({
      departmentId: 'dept-1',
      userId: 'user-1',
      assignedAt: new Date(),
    } as any);

    await assignDepartmentManager('dept-1', 'user-1', actor);

    expect(mockDepartmentsRepo.upsertDepartmentManager).toHaveBeenCalledWith('dept-1', 'user-1', mockTx);
    expect(mockUsersRepo.updateUserRecord).toHaveBeenCalledWith(
      'user-1',
      { roleId: 'role-dm-id' },
      mockTx,
    );
    expect(mockLogAuditOrThrow).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'ASSIGN_DEPARTMENT_MANAGER',
        entityType: 'Department',
        entityId: 'dept-1',
      }),
      mockTx,
    );
  });

  it('no otorga rol si el usuario ya es department_manager', async () => {
    mockDepartmentsRepo.findDepartmentById.mockResolvedValue({
      id: 'dept-1',
      name: 'RH',
      code: 'RH01',
      managers: [],
      isActive: true,
      description: null,
      createdAt: new Date(),
      updatedAt: new Date(),
      branches: [],
      _count: { users: 0 },
    } as any);

    mockUsersRepo.findUserById.mockResolvedValue({
      id: 'user-1',
      name: 'Juan Pérez',
      email: 'juan@test.com',
      role: { name: 'department_manager' },
    } as any);

    mockDepartmentsRepo.upsertDepartmentManager.mockResolvedValue({
      departmentId: 'dept-1',
      userId: 'user-1',
      assignedAt: new Date(),
    } as any);

    await assignDepartmentManager('dept-1', 'user-1', actor);

    // No debe llamar a updateUserRecord porque ya tiene el rol
    expect(mockUsersRepo.updateUserRecord).not.toHaveBeenCalled();
  });

  it('lanza error si el departamento no existe', async () => {
    mockDepartmentsRepo.findDepartmentById.mockResolvedValue(null);

    await expect(
      assignDepartmentManager('dept-invalid', 'user-1', actor),
    ).rejects.toThrow('Departamento no encontrado');

    expect(mockDepartmentsRepo.upsertDepartmentManager).not.toHaveBeenCalled();
  });

  it('lanza error si el usuario no existe', async () => {
    mockDepartmentsRepo.findDepartmentById.mockResolvedValue({
      id: 'dept-1',
      name: 'RH',
      code: 'RH01',
      managers: [],
      isActive: true,
      description: null,
      createdAt: new Date(),
      updatedAt: new Date(),
      branches: [],
      _count: { users: 0 },
    } as any);

    mockUsersRepo.findUserById.mockResolvedValue(null);

    await expect(
      assignDepartmentManager('dept-1', 'user-invalid', actor),
    ).rejects.toThrow('Usuario no encontrado');
  });

  it('lanza error si el usuario ya es manager de este departamento', async () => {
    mockDepartmentsRepo.findDepartmentById.mockResolvedValue({
      id: 'dept-1',
      name: 'RH',
      code: 'RH01',
      managers: [{ userId: 'user-1' }],
      isActive: true,
      description: null,
      createdAt: new Date(),
      updatedAt: new Date(),
      branches: [],
      _count: { users: 0 },
    } as any);

    mockUsersRepo.findUserById.mockResolvedValue({
      id: 'user-1',
      name: 'Juan Pérez',
      email: 'juan@test.com',
      role: { name: 'department_manager' },
    } as any);

    await expect(
      assignDepartmentManager('dept-1', 'user-1', actor),
    ).rejects.toThrow('Este usuario ya es manager de este departamento');
  });
});

describe('removeDepartmentManager', () => {
  it('remueve manager y hace downgrade a employee si no es manager de otros departamentos', async () => {
    mockDepartmentsRepo.findDepartmentById.mockResolvedValue({
      id: 'dept-1',
      name: 'RH',
      code: 'RH01',
      managers: [{ userId: 'user-1' }],
      isActive: true,
      description: null,
      createdAt: new Date(),
      updatedAt: new Date(),
      branches: [],
      _count: { users: 0 },
    } as any);

    mockUsersRepo.findUserById.mockResolvedValue({
      id: 'user-1',
      name: 'Juan Pérez',
      email: 'juan@test.com',
      role: { name: 'department_manager' },
    } as any);

    mockDepartmentsRepo.countDepartmentsForManager.mockResolvedValue(0);
    mockRolesRepo.findRoleByName.mockResolvedValue({
      id: 'role-employee-id',
      name: 'employee',
    } as any);

    mockDepartmentsRepo.deleteDepartmentManager.mockResolvedValue({
      departmentId: 'dept-1',
      userId: 'user-1',
      assignedAt: new Date(),
    } as any);

    await removeDepartmentManager('dept-1', undefined, actor);

    // Verificar que se removió el manager
    expect(mockDepartmentsRepo.deleteDepartmentManager).toHaveBeenCalledWith('dept-1', 'user-1', mockTx);

    // Verificar downgrade a employee
    expect(mockUsersRepo.updateUserRecord).toHaveBeenCalledWith(
      'user-1',
      { roleId: 'role-employee-id' },
      mockTx,
    );

    // Verificar auditoría
    expect(mockLogAuditOrThrow).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'REMOVE_DEPARTMENT_MANAGER',
        entityType: 'Department',
        entityId: 'dept-1',
      }),
      mockTx,
    );
  });

  it('no hace downgrade si el usuario sigue siendo manager de otros departamentos', async () => {
    mockDepartmentsRepo.findDepartmentById.mockResolvedValue({
      id: 'dept-1',
      name: 'RH',
      code: 'RH01',
      managers: [{ userId: 'user-1' }],
      isActive: true,
      description: null,
      createdAt: new Date(),
      updatedAt: new Date(),
      branches: [],
      _count: { users: 0 },
    } as any);

    mockUsersRepo.findUserById.mockResolvedValue({
      id: 'user-1',
      name: 'Juan Pérez',
      email: 'juan@test.com',
      role: { name: 'department_manager' },
    } as any);

    mockDepartmentsRepo.countDepartmentsForManager.mockResolvedValue(2);

    mockDepartmentsRepo.deleteDepartmentManager.mockResolvedValue({
      departmentId: 'dept-1',
      userId: 'user-1',
      assignedAt: new Date(),
    } as any);

    await removeDepartmentManager('dept-1', undefined, actor);

    // No debe hacer downgrade porque aún es manager de otros departamentos
    expect(mockUsersRepo.updateUserRecord).not.toHaveBeenCalled();
  });
});
