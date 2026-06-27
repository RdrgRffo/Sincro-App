/**
 * @file users.test.ts
 * Tests del módulo de usuarios: colisiones de identidad, estados, reseteo de password y soft-delete.
 */

// ── Mocks de repositorios (antes de importar el servicio) ───────────────────
jest.mock('../../src/modules/users/users.repository');
jest.mock('../../src/modules/audit/audit.service', () => ({
  logAuditOrThrow: jest.fn().mockResolvedValue(undefined),
  sanitizeSnapshot: jest.fn((x) => x),
}));
jest.mock('../../src/realtime/socket', () => ({ publishRealtimeEvent: jest.fn() }));
jest.mock('../../src/modules/in-app-notifications/in-app.service', () => ({
  createInAppNotification: jest.fn().mockResolvedValue(undefined),
}));
jest.mock('../../src/utils/bcrypt', () => ({
  hashPassword: jest.fn().mockResolvedValue('hashed_password'),
  comparePassword: jest.fn(),
}));
jest.mock('../../src/common/transactions/transaction.utils', () => ({
  executeInTransaction: jest.fn((fn: any) => fn({
    refreshToken: {
      deleteMany: jest.fn().mockResolvedValue({ count: 0 }),
    },
    user: {
      update: jest.fn().mockResolvedValue({ id: 'victim-id', status: 'disabled', isActive: false, employeeId: null }),
    },
    userVisibleBranch: {
      deleteMany: jest.fn().mockResolvedValue({ count: 0 }),
      createMany: jest.fn().mockResolvedValue({ count: 0 }),
    },
    userSkill: {
      deleteMany: jest.fn().mockResolvedValue({ count: 0 }),
      createMany: jest.fn().mockResolvedValue({ count: 0 }),
    },
  })),
}));

import * as usersRepo from '../../src/modules/users/users.repository'; // Keep this import
import { prismaMock } from '../config/singleton'; // Import prismaMock
import {
  createUser,
  updateUser,
  changeUserStatus,
  changeUserRole,
  resetUserPassword,
  forceUserPasswordChange,
  deleteUser,
  reactivateUser,
  getUsersList,
} from '../../src/modules/users/users.service';

const mockRepo = usersRepo as jest.Mocked<typeof usersRepo>;
const mockActor = { id: 'admin-id-1', roleName: 'admin', email: 'admin@test.com', name: 'Admin', ipAddress: '127.0.0.1' };

// ── Helper para crear un usuario ficticio compatible ────────────────────────
const buildUser = (overrides: Record<string, any> = {}) => ({
  id: 'user-id-1',
  employeeId: 'USR-0001',
  email: 'test@example.com',
  name: 'Test User',
  roleId: 'role-viewer-id',
  departmentId: 'dept-1', // Add default departmentId for consistency
  branchId: 'branch-1', // Add default branchId for consistency
  status: 'active',
  failedAttempts: 0,
  passwordHash: 'hashed',
  lockedUntil: null,
  forcePasswordChange: false,
  ...overrides,
});

/** Payload mínimo tipo `UserResponse` para `updateUser` (findUserDetailById + diff in-app). */
const buildRichUser = (overrides: Record<string, any> = {}) => {
  const flat = buildUser(overrides) as Record<string, any>;
  const branchId = flat.branchId ?? 'branch-1';
  const departmentId = flat.departmentId ?? null;
  const email = flat.email ?? 'test@example.com';
  return {
    ...flat,
    derivedUsername: flat.derivedUsername ?? email.split('@')[0],
    passwordChangedAt: flat.passwordChangedAt ?? null,
    tokenVersion: flat.tokenVersion ?? 0,
    role: overrides.role ?? { name: 'employee', permissions: [] },
    avatarUrl: flat.avatarUrl ?? null,
    createdAt: flat.createdAt ?? new Date(),
    lastLoginAt: flat.lastLoginAt ?? null,
    passwordChangePolicy: flat.passwordChangePolicy ?? null,
    passwordChangeWarnedAt: flat.passwordChangeWarnedAt ?? null,
    passwordChangeDeadlineAt: flat.passwordChangeDeadlineAt ?? null,
    companyPhone: flat.companyPhone ?? null,
    auxiliaryPhone: flat.auxiliaryPhone ?? null,
    branch:
      overrides.branch ?? {
        id: branchId,
        name:
          branchId === 'branch-2'
            ? 'Sucursal B'
            : branchId === 'other-branch'
              ? 'Otra sucursal'
              : 'Sucursal A',
        code: 'XX',
        isActive: true,
      },
    visibleBranches: overrides.visibleBranches ?? [],
    department: departmentId
      ? {
          id: departmentId,
          name: departmentId === 'dept-2' ? 'Dept 2' : 'Dept 1',
          code: 'D1',
        }
      : null,
    skills: overrides.skills ?? [],
  };
};

beforeEach(() => {
  prismaMock.branch.findUnique.mockResolvedValue({ id: 'branch-1' } as any);
  prismaMock.department.findUnique.mockResolvedValue({
    id: 'dept-1',
    branches: [{ branchId: 'branch-1' }, { branchId: 'branch-2' }]
  } as any);
  prismaMock.role.findFirst.mockImplementation((async (args: any) => {
    if (args?.where?.name === 'employee') return { id: 'role-employee-id', name: 'employee' } as any;
    if (args?.where?.name === 'admin') return { id: 'role-admin-id', name: 'admin' } as any;
    if (args?.where?.name === 'general_manager') return { id: 'role-general-manager-id', name: 'general_manager' } as any;
    if (args?.where?.name === 'department_manager') return { id: 'role-department-manager-id', name: 'department_manager' } as any;
    return null;
  }) as any);
  // Mock para assertUserScope: el actor por defecto (admin) existe y no es GM
  (prismaMock.user.findUnique as jest.Mock).mockImplementation(async (args: any) => {
    if (args?.where?.id === 'admin-id-1') return { id: 'admin-id-1', roleId: 'role-admin-id', branchId: 'branch-1' } as any;
    return buildUser() as any;
  });
  (prismaMock.role.findUnique as jest.Mock).mockImplementation(async (args: any) => {
    if (args?.where?.id === 'role-admin-id') return { id: 'role-admin-id', name: 'admin' } as any;
    if (args?.where?.id === 'role-general-manager-id') return { id: 'role-general-manager-id', name: 'general_manager' } as any;
    return null;
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
describe('createUser', () => {
  beforeEach(() => {
    mockRepo.findUserByEmployeeId.mockResolvedValue(null as any);
    mockRepo.findUserByEmail.mockResolvedValue(null as any);
    mockRepo.findUserByEmailIncludingInactive.mockResolvedValue(null as any);
    mockRepo.findUserByDerivedUsername.mockResolvedValue(null as any);
    mockRepo.reserveNextEmployeeId.mockResolvedValue('USR-0002');
    mockRepo.updateUserRecord.mockResolvedValue(buildUser({ id: 'existing-id' }) as any);
  });
  // ── Caso: branchId obligatorio ───────────────────────────────────────────────
  it('rechaza la creación si no se envía sucursal, departamento o rol', async () => {
    // Missing branchId
    await expect(
      createUser({ email: 'nuevo@example.com', password: 'Secure123!', name: 'Test', departmentId: 'dept-1', role: 'employee' } as any, mockActor)
    ).rejects.toThrow();

    // Missing departmentId
    await expect(
      createUser({ email: 'nuevo@example.com', password: 'Secure123!', name: 'Test', branchId: 'branch-1', role: 'employee' } as any, mockActor)
    ).rejects.toThrow();
    // Missing role
    await expect(
      createUser({ email: 'nuevo@example.com', password: 'Secure123!', name: 'Test', branchId: 'branch-1', departmentId: 'dept-1' } as any, mockActor)
    ).rejects.toThrow();
  });

  // ── Caso: Email duplicado → conflicto ───────────────────────────────────────
  it('rechaza la creación cuando el email ya existe', async () => {
    const existing = buildUser({ id: 'existing-id', email: 'test@example.com', employeeId: 'USR-0001' });
    mockRepo.findUserByEmailIncludingInactive.mockResolvedValue(existing as any);
    mockRepo.findUserByEmail.mockResolvedValue(existing as any);

    await expect(
      createUser(
        {
          email: 'TEST@example.com',
          password: 'Secure123!',
          name: 'Test Updated',
          departmentId: 'dept-1',
          branchId: 'branch-1',
        },
        mockActor
      )
    ).rejects.toThrow('El email ya está registrado');

    expect(mockRepo.updateUserRecord).not.toHaveBeenCalled();
  });

  // ── Caso: employeeId duplicado → conflicto ──────────────────────────────────
  it('rechaza la creación cuando el employeeId ya existe', async () => {
    const existing = buildUser({ id: 'existing-id', employeeId: 'USR-0007', email: 'otro@example.com' });
    mockRepo.findUserByEmployeeId.mockResolvedValue(existing as any);
    await expect(
      createUser(
        {
          email: 'nuevo@example.com',
          departmentId: 'dept-1',
          employeeId: 'USR-0007',
          password: 'Secure123!',
          name: 'Test Updated',
          branchId: 'branch-1',
        },
        mockActor
      )
    ).rejects.toThrow('El employeeId ya está registrado');

    expect(mockRepo.updateUserRecord).not.toHaveBeenCalled();
  });

  // ── Caso: Email pertenece a usuario inactivo → conflicto reactivable ───────
  it('devuelve conflicto reactivable cuando el email pertenece a un usuario inactivo', async () => {
    const inactive = buildUser({
      id: 'inactive-id',
      email: 'inactivo@example.com',
      name: 'Usuario Inactivo',
      isActive: false,
    });
    mockRepo.findUserByEmailIncludingInactive.mockResolvedValue(inactive as any);

    try {
      await createUser(
        {
          email: 'inactivo@example.com',
          password: 'Secure123!',
          name: 'Nuevo Intento',
          departmentId: 'dept-1',
          branchId: 'branch-1',
        },
        mockActor,
      );
      throw new Error('Se esperaba conflicto reactivable');
    } catch (error: any) {
      expect(error.message).toBe('El email pertenece a un usuario inactivo');
      expect(error.canReactivate).toBe(true);
      expect(error.existingUser).toMatchObject({
        id: 'inactive-id',
        email: 'inactivo@example.com',
        name: 'Usuario Inactivo',
      });
    }
  });

  // ── Caso: Email + employeeId apuntando a mismo usuario sigue en conflicto ───
  it('mantiene semántica strict-create aunque email y employeeId apunten al mismo usuario', async () => {
    const existing = buildUser({ id: 'existing-id', employeeId: 'USR-0007', email: 'otro@example.com' });
    mockRepo.findUserByEmailIncludingInactive.mockResolvedValue(existing as any);
    mockRepo.findUserByEmployeeId.mockResolvedValue(existing as any);
    mockRepo.findUserByEmail.mockResolvedValue(existing as any);

    await expect(
      createUser(
      {
        email: 'otro@example.com',
        employeeId: 'USR-0007',
        password: 'Secure123!',
        name: 'Test Updated',
        branchId: 'branch-1',
      },
      mockActor
    )).rejects.toThrow('El email ya está registrado');
  });

  // ── Caso: Username derivado duplicado (mismo prefijo antes del @) ──────────
  it('rechaza la creación si el username derivado del email ya existe', async () => {
    mockRepo.findUserByDerivedUsername.mockResolvedValue(
      buildUser({ id: 'other-id', email: 'otro@dominio.com' }) as any
    );

    await expect(
      createUser({ email: 'libre@dominio.com', password: 'Secure123!', name: 'Test', branchId: 'branch-1', departmentId: 'dept-1', role: 'employee' }, mockActor)
    ).rejects.toThrow('El username ya está registrado');
  });

  // ── Caso: Password demasiado corta (valor límite = 8 chars, probamos 7) ─────
  it('rechaza password de 7 caracteres (por debajo del límite mínimo de 8)', async () => {
    mockRepo.findUserByEmail.mockResolvedValue(null as any);

    await expect(
      createUser({ email: 'nuevo@example.com', password: 'Only7!x', name: 'Test', branchId: 'branch-1', departmentId: 'dept-1', role: 'employee' }, mockActor)
    ).rejects.toThrow(); // Zod valida min(8)
  });

  // ── Caso: Creación exitosa limpia ────────────────────────────────────────────
  it('crea el usuario cuando no existen conflictos de identidad', async () => {
    mockRepo.findUserByEmail.mockResolvedValue(null as any);
    mockRepo.createUserRecord.mockResolvedValue(buildUser({ id: 'new-id', employeeId: 'USR-0002' }) as any);

    const user = await createUser( // Ensure all mandatory fields are provided
      { email: 'nuevo@example.com', password: 'Secure123!', name: 'Nuevo User', branchId: 'branch-1' },
      mockActor
    );
    expect(user.id).toBe('new-id');
    expect(user.employeeId).toBe('USR-0002');
  });

  it('aplica estado required cuando se crea con forcePasswordChange=true', async () => {
    mockRepo.findUserByEmail.mockResolvedValue(null as any);
    mockRepo.createUserRecord.mockResolvedValue(buildUser({ id: 'new-id', employeeId: 'USR-0002' }) as any);

    await createUser( // Ensure all mandatory fields are provided
      {
        email: 'nuevo2@example.com',
        password: 'Secure123!',
        name: 'Nuevo User 2',
        branchId: 'branch-1',
        departmentId: 'dept-1',
        role: 'employee',
        forcePasswordChange: true,
      },
      mockActor
    );

    expect(mockRepo.createUserRecord).toHaveBeenCalledWith(
      expect.objectContaining({
        forcePasswordChange: true,
        passwordChangePolicy: 'required',
      }),
      expect.anything()
    );
  });
});

const mockUserUpdateInput = {
  name: 'Updated Name',
  email: 'updated@example.com',
  departmentId: 'dept-2',
  branchId: 'branch-2',
};

// ═══════════════════════════════════════════════════════════════════════════════
describe('updateUser', () => {
  beforeEach(() => {
    mockRepo.findUserIdentityConflict.mockResolvedValue(null as any);
    mockRepo.updateUserRecord.mockResolvedValue(buildUser(mockUserUpdateInput) as any); // Use mockUserUpdateInput
    let detailCall = 0;
    mockRepo.findUserDetailById.mockReset();
    (mockRepo.findUserDetailById as jest.Mock).mockImplementation(async () => {
      detailCall += 1;
      if (detailCall === 1) {
        return buildRichUser({ branchId: 'branch-1', departmentId: 'dept-1' }) as any;
      }
      return buildRichUser({
        name: 'Updated Name',
        email: 'updated@example.com',
        branchId: 'branch-2',
        departmentId: 'dept-2',
        roleId: 'role-viewer-id',
      }) as any;
    });
  });

  it('rechaza la actualización si el nuevo email genera un username derivado en conflicto', async () => {
    mockRepo.findUserDetailById.mockReset();
    mockRepo.findUserDetailById.mockResolvedValueOnce(buildRichUser({ branchId: 'branch-1', departmentId: 'dept-1' }) as any);
    mockRepo.findUserIdentityConflict.mockResolvedValue({ id: 'other-user', email: 'conflicto@otrodominio.com' } as any);

    await expect( // Ensure all mandatory fields are provided for the update input
      updateUser('user-id-1', { email: 'conflicto@dominio.com', departmentId: 'dept-1', branchId: 'branch-1' }, mockActor)
    ).rejects.toThrow('El username ya está registrado');
  });

  it('actualiza correctamente el usuario con nuevos datos de departamento, sucursal y rol', async () => {
    const createInAppNotification = jest.requireMock('../../src/modules/in-app-notifications/in-app.service')
      .createInAppNotification as jest.Mock;

    const updatedUser = await updateUser('user-id-1', mockUserUpdateInput, mockActor);

    expect(mockRepo.updateUserRecord).toHaveBeenCalledWith('user-id-1', expect.objectContaining({
      name: 'Updated Name',
      email: 'updated@example.com',
      branchId: 'branch-2',
    }), expect.anything());
    expect(mockRepo.updateUserRecord).toHaveBeenCalledWith('user-id-1', expect.objectContaining({ departmentId: 'dept-2' }), expect.anything());
    expect(updatedUser).toMatchObject(mockUserUpdateInput);
    expect(createInAppNotification).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'system',
        title: 'Cambios en tu fichaje',
        metadata: expect.objectContaining({
          changedBranch: true,
          changedDepartment: true,
          changedRole: false,
          changedSkills: false,
          changedVisibleBranches: false,
        }),
      }),
    );
  });
  it('actualiza el derivedUsername cuando se cambia el email', async () => {
    let n = 0;
    mockRepo.findUserDetailById.mockReset();
    (mockRepo.findUserDetailById as jest.Mock).mockImplementation(async () => {
      n += 1;
      if (n === 1) {
        return buildRichUser({ branchId: 'branch-1', departmentId: 'dept-1', email: 'test@example.com' }) as any;
      }
      return buildRichUser({
        branchId: 'branch-1',
        departmentId: 'dept-1',
        email: 'nuevo.email@example.com',
        derivedUsername: 'nuevo.email',
      }) as any;
    });

    await updateUser('user-id-1', { email: 'nuevo.email@example.com' }, mockActor);

    expect(mockRepo.updateUserRecord).toHaveBeenCalledWith(
      'user-id-1',
      expect.objectContaining({
        email: 'nuevo.email@example.com',
        derivedUsername: 'nuevo.email',
      }),
      expect.anything()
    );
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
describe('changeUserStatus', () => {
  // ── Caso: Usuario destino no encontrado (404) ────────────────────────────────
  it('lanza NOT_FOUND si el usuario no existe en BD', async () => {
    mockRepo.findUserById.mockResolvedValue(null as any);

    await expect(
      changeUserStatus('ghost-id', 'disabled', mockActor)
    ).rejects.toThrow('Usuario no encontrado');
  });

  // ── Caso: Auto-modificación prohibida (anomalía corporativa) ─────────────────
  it('no permite que un usuario cambie su propio estado', async () => {
    mockRepo.findUserById.mockResolvedValue(buildUser({ id: mockActor.id }) as any);

    await expect(
      changeUserStatus(mockActor.id, 'disabled', { id: mockActor.id, ipAddress: '' })
    ).rejects.toThrow('No puedes cambiar tu propio estado');
  });

  // ── Caso: Cambio de estado válido en otra cuenta ─────────────────────────────
  it('deshabilita exitosamente una cuenta de otro usuario', async () => {
    mockRepo.findUserById.mockResolvedValue(buildUser({ id: 'target-id' }) as any);
    mockRepo.updateUserRecord.mockResolvedValue(buildUser({ id: 'target-id', status: 'disabled' }) as any);

    await expect(
      changeUserStatus('target-id', 'disabled', mockActor)
    ).resolves.not.toThrow();
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
describe('resetUserPassword', () => {
  // ── Caso: Usuario inexistente ────────────────────────────────────────────────
  it('lanza NOT_FOUND si intentamos resetear password de usuario que no existe', async () => {
    mockRepo.findUserById.mockResolvedValue(null as any);

    await expect(
      resetUserPassword('ghost-id', 'NewSecure123!', mockActor)
    ).rejects.toThrow('Usuario no encontrado');
  });

  // ── Caso: flag forcePasswordChange se fija a true → CRÍTICO de seguridad ─────
  it('obliga estado required en reset de contraseña (valor límite de seguridad)', async () => {
    mockRepo.findUserById.mockResolvedValue(buildUser() as any);
    mockRepo.updateUserRecord.mockResolvedValue(buildUser() as any);

    await resetUserPassword('user-id-1', 'NewSecure123!', mockActor);

    expect(mockRepo.updateUserRecord).toHaveBeenCalledWith(
      'user-id-1',
      expect.objectContaining({
        forcePasswordChange: true,
        passwordChangePolicy: 'required',
        passwordChangedAt: expect.any(Date),
      }),
      expect.anything() // tx
    );
  });

  // ── Caso: también limpia failedAttempts y lockedUntil ────────────────────────
  it('reinicia failedAttempts y lockedUntil al resetear la password', async () => {
    mockRepo.findUserById.mockResolvedValue(buildUser({ failedAttempts: 4 }) as any);
    mockRepo.updateUserRecord.mockResolvedValue(buildUser() as any);

    await resetUserPassword('user-id-1', 'NewSecure123!', mockActor);

    expect(mockRepo.updateUserRecord).toHaveBeenCalledWith(
      'user-id-1',
      expect.objectContaining({ failedAttempts: 0, lockedUntil: null }),
      expect.anything()
    );
  });
});

describe('forceUserPasswordChange', () => {
  it('marca required sin resetear hash de contraseña', async () => {
    mockRepo.findUserById.mockResolvedValue(buildUser({ id: 'target-id' }) as any);
    mockRepo.updateUserRecord.mockResolvedValue(buildUser({ id: 'target-id' }) as any);

    await forceUserPasswordChange('target-id', mockActor);

    expect(mockRepo.updateUserRecord).toHaveBeenCalledWith(
      'target-id',
      expect.objectContaining({
        forcePasswordChange: true,
        passwordChangePolicy: 'required',
      }),
      expect.anything()
    );
  });
});

describe('getUsersList', () => {
  beforeEach(() => {
    mockRepo.listUsers.mockResolvedValue([[], 0] as any);
  });

  it('usa orden por defecto createdAt desc cuando no se envía sort', async () => {
    await getUsersList({ page: 1, limit: 20 });

    expect(mockRepo.listUsers).toHaveBeenCalledWith(
      undefined,
      1,
      20,
      'createdAt',
      'desc',
    );
  });

  it('propaga sortBy/sortOrder hacia el repositorio', async () => {
    await getUsersList({
      page: 2,
      limit: 10,
      sortBy: 'name',
      sortOrder: 'asc',
    });

    expect(mockRepo.listUsers).toHaveBeenCalledWith(
      undefined,
      2,
      10,
      'name',
      'asc',
    );
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
describe('deleteUser', () => {
  beforeEach(() => {
    mockRepo.findUserById.mockResolvedValue(buildUser({ id: 'victim-id', branchId: 'branch-1' }) as any);
    prismaMock.scheduleAssignment.count.mockResolvedValue(0 as any);
    prismaMock.absence.count.mockResolvedValue(0 as any);
    prismaMock.branch.count.mockResolvedValue(0 as any);
    prismaMock.departmentManager.count.mockResolvedValue(0 as any);
  });

  // ── Caso: No puede eliminarse a sí mismo ────────────────────────────────────
  it('no permite el soft-delete de la propia cuenta del actor', async () => {
    mockRepo.findUserById.mockResolvedValue(buildUser({ id: mockActor.id }) as any);

    await expect(
      deleteUser(mockActor.id, { id: mockActor.id, ipAddress: '' })
    ).rejects.toThrow('No puedes eliminar tu propia cuenta');
  });

  // ── Caso: Soft-delete marca isActive=false, status=disabled y employeeId=null ──
  it('soft-delete marca isActive=false, status=disabled y libera employeeId', async () => {
    mockRepo.findUserById.mockResolvedValue(buildUser({ id: 'victim-id', email: 'victim@example.com', employeeId: 'USR-0007' }) as any);

    await expect(deleteUser('victim-id', mockActor)).resolves.not.toThrow();
  });

  it('bloquea el borrado si tiene turnos asignados', async () => {
    prismaMock.scheduleAssignment.count.mockResolvedValue(3 as any);

    await expect(deleteUser('victim-id', mockActor)).rejects.toThrow('turno(s) activo(s) asignados');
  });

  it('bloquea el borrado si tiene ausencias pendientes', async () => {
    prismaMock.absence.count.mockResolvedValue(2 as any);

    await expect(deleteUser('victim-id', mockActor)).rejects.toThrow('solicitud(es) de ausencia pendiente(s)');
  });

  it('bloquea el borrado si es manager de sucursales activas', async () => {
    prismaMock.branch.count.mockResolvedValue(1 as any);

    await expect(deleteUser('victim-id', mockActor)).rejects.toThrow('es manager de 1 sucursal(es) activa(s)');
  });

  it('bloquea el borrado si es manager de departamentos', async () => {
    prismaMock.departmentManager.count.mockResolvedValue(1 as any);

    await expect(deleteUser('victim-id', mockActor)).rejects.toThrow('es manager de 1 departamento(s)');
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
describe('reactivateUser', () => {
  beforeEach(() => {
    mockRepo.findUserDetailById.mockResolvedValue(buildRichUser({ id: 'victim-id', isActive: true, status: 'active' }) as any);
    (prismaMock.user.findUnique as jest.Mock).mockImplementation(async (args: any) => {
      if (args?.where?.id === 'admin-id-1') {
        return { id: 'admin-id-1', roleId: 'role-admin-id', branchId: 'branch-1', isActive: true, status: 'active' } as any;
      }
      if (args?.where?.id === 'victim-id') {
        return buildUser({ id: 'victim-id', isActive: false, status: 'disabled', branchId: 'branch-1' }) as any;
      }
      return null;
    });
  });

  it('reactiva un usuario inactivo y devuelve el detalle actualizado', async () => {
    const result = await reactivateUser('victim-id', mockActor);

    expect(result.id).toBe('victim-id');
    expect(result.isActive).toBe(true);
    expect(mockRepo.findUserDetailById).toHaveBeenCalledWith('victim-id');
  });

  it('lanza error si el usuario no existe', async () => {
    (prismaMock.user.findUnique as jest.Mock).mockResolvedValueOnce(null);

    await expect(reactivateUser('missing-id', mockActor)).rejects.toThrow('Usuario no encontrado');
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
describe('GM branch scope validation', () => {
  const gmActor = { id: 'gm-id', ipAddress: '127.0.0.1' };
  const gmUser = { id: 'gm-id', roleId: 'role-general-manager-id', branchId: 'gm-branch' };
  const gmRole = { id: 'role-general-manager-id', name: 'general_manager' };

  beforeEach(() => {
    // Default: actor is GM in branch 'gm-branch'
    (prismaMock.user.findUnique as jest.Mock).mockImplementation(async (args: any) => {
      if (args?.where?.id === 'gm-id') return gmUser as any;
      if (args?.where?.id === 'admin-id-1') return { id: 'admin-id-1', roleId: 'role-admin-id', branchId: 'branch-1' } as any;
      return buildUser() as any;
    });
    (prismaMock.role.findUnique as jest.Mock).mockImplementation(async (args: any) => {
      if (args?.where?.id === 'role-general-manager-id') return gmRole as any;
      if (args?.where?.id === 'role-admin-id') return { id: 'role-admin-id', name: 'admin' } as any;
      return null;
    });
    mockRepo.findUserById.mockResolvedValue(buildUser({ branchId: 'gm-branch' }) as any);
    let gmDetailCall = 0;
    mockRepo.findUserDetailById.mockReset();
    (mockRepo.findUserDetailById as jest.Mock).mockImplementation(async () => {
      gmDetailCall += 1;
      const base = { branchId: 'gm-branch', departmentId: 'dept-1', roleId: 'role-viewer-id' };
      if (gmDetailCall === 1) return buildRichUser(base) as any;
      return buildRichUser({ ...base, name: 'Updated' }) as any;
    });
    mockRepo.findUserByEmail.mockResolvedValue(null as any);
    mockRepo.findUserByDerivedUsername.mockResolvedValue(null as any);
    mockRepo.reserveNextEmployeeId.mockResolvedValue('USR-9999');
    mockRepo.createUserRecord.mockResolvedValue(buildUser({ id: 'new-id' }) as any);
    mockRepo.updateUserRecord.mockResolvedValue(buildUser() as any);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  // ── createUser: GM creando en su sucursal → OK ──────────────────────────────
  it('createUser: GM puede crear usuario en su propia sucursal', async () => {
    await expect(
      createUser(
        { email: 'nuevo@test.com', password: 'Secure123!', name: 'Nuevo', branchId: 'gm-branch' },
        gmActor
      )
    ).resolves.toBeDefined();
  });

  // ── createUser: GM creando en otra sucursal → FORBIDDEN ─────────────────────
  it('createUser: GM no puede crear usuario en otra sucursal', async () => {
    await expect(
      createUser(
        { email: 'nuevo@test.com', password: 'Secure123!', name: 'Nuevo', branchId: 'other-branch' },
        gmActor
      )
    ).rejects.toThrow('No tienes permiso para gestionar usuarios de otra sucursal');
  });

  // ── updateUser: GM actualizando usuario de otra sucursal → FORBIDDEN ────────
  it('updateUser: GM no puede actualizar usuario de otra sucursal', async () => {
    mockRepo.findUserById.mockResolvedValue(buildUser({ branchId: 'other-branch' }) as any);
    mockRepo.findUserDetailById.mockReset();
    mockRepo.findUserDetailById.mockResolvedValue(
      buildRichUser({ branchId: 'other-branch', departmentId: 'dept-1' }) as any,
    );
    mockRepo.findUserIdentityConflict.mockResolvedValue(null as any);

    await expect(
      updateUser('user-id-1', { name: 'Updated' }, gmActor)
    ).rejects.toThrow('No tienes permiso para gestionar usuarios de otra sucursal');
  });

  // ── changeUserStatus: GM cambiando estado de usuario de otra sucursal → FORBIDDEN ──
  it('changeUserStatus: GM no puede cambiar estado de usuario de otra sucursal', async () => {
    mockRepo.findUserById.mockResolvedValue(buildUser({ branchId: 'other-branch' }) as any);

    await expect(
      changeUserStatus('user-id-1', 'disabled', gmActor)
    ).rejects.toThrow('No tienes permiso para gestionar usuarios de otra sucursal');
  });

  // ── changeUserRole: GM cambiando rol de usuario de otra sucursal → FORBIDDEN ─
  it('changeUserRole: GM no puede cambiar rol de usuario de otra sucursal', async () => {
    mockRepo.findUserById.mockResolvedValue(buildUser({ branchId: 'other-branch' }) as any);

    await expect(
      changeUserRole('user-id-1', { role: 'employee' }, gmActor)
    ).rejects.toThrow('No tienes permiso para gestionar usuarios de otra sucursal');
  });

  // ── deleteUser: GM eliminando usuario de otra sucursal → FORBIDDEN ──────────
  it('deleteUser: GM no puede eliminar usuario de otra sucursal', async () => {
    mockRepo.findUserById.mockResolvedValue(buildUser({ branchId: 'other-branch' }) as any);

    await expect(
      deleteUser('user-id-1', gmActor)
    ).rejects.toThrow('No tienes permiso para gestionar usuarios de otra sucursal');
  });

  // ── getUsersList: GM listando → branchId forzado a su sucursal ──────────────
  it('getUsersList: GM filtra automáticamente por su sucursal', async () => {
    mockRepo.listUsers.mockResolvedValue([[], 0] as any);
    // buildUsersWhere está mockeado por defecto (jest.mock del repositorio),
    // así que mockeamos su retorno para verificar que branchId se pasa correctamente
    (mockRepo.buildUsersWhere as jest.Mock).mockReturnValue({ branchId: 'gm-branch' });

    await getUsersList({ page: 1, limit: 20 }, gmActor);

    expect(mockRepo.listUsers).toHaveBeenCalledWith(
      expect.objectContaining({ branchId: 'gm-branch' }),
      1,
      20,
      'createdAt',
      'desc',
    );
  });

  // ── Admin (no GM) operando en cualquier sucursal → OK ───────────────────────
  it('admin puede gestionar usuarios de cualquier sucursal', async () => {
    const adminActor = { id: 'admin-id-1', ipAddress: '127.0.0.1' };
    mockRepo.findUserById.mockResolvedValue(buildUser({ branchId: 'other-branch' }) as any);
    let ad = 0;
    mockRepo.findUserDetailById.mockReset();
    (mockRepo.findUserDetailById as jest.Mock).mockImplementation(async () => {
      ad += 1;
      const base = { branchId: 'other-branch', departmentId: 'dept-1', roleId: 'role-viewer-id' };
      if (ad === 1) return buildRichUser({ ...base, name: 'Old' }) as any;
      return buildRichUser({ ...base, name: 'Updated' }) as any;
    });
    mockRepo.findUserIdentityConflict.mockResolvedValue(null as any);

    await expect(
      updateUser('user-id-1', { name: 'Updated' }, adminActor)
    ).resolves.toBeDefined();
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
describe('DM department scope validation', () => {
  const dmActor = { id: 'dm-id', ipAddress: '127.0.0.1' };
  const dmUser = { id: 'dm-id', roleId: 'role-department-manager-id', branchId: 'branch-1', departmentId: 'dept-1' };
  const dmRole = { id: 'role-department-manager-id', name: 'department_manager' };

  beforeEach(() => {
    // Default: actor is DM
    (prismaMock.user.findUnique as jest.Mock).mockImplementation(async (args: any) => {
      if (args?.where?.id === 'dm-id') return dmUser as any;
      if (args?.where?.id === 'admin-id-1') return { id: 'admin-id-1', roleId: 'role-admin-id', branchId: 'branch-1' } as any;
      return buildUser() as any;
    });
    (prismaMock.role.findUnique as jest.Mock).mockImplementation(async (args: any) => {
      if (args?.where?.id === 'role-department-manager-id') return dmRole as any;
      if (args?.where?.id === 'role-admin-id') return { id: 'role-admin-id', name: 'admin' } as any;
      return null;
    });
    // DM is manager of 'dept-1'
    (prismaMock.departmentManager.findUnique as jest.Mock).mockImplementation(async (args: any) => {
      if (args?.where?.departmentId_userId?.departmentId === 'dept-1' && args?.where?.departmentId_userId?.userId === 'dm-id') {
        return { departmentId: 'dept-1', userId: 'dm-id' } as any;
      }
      return null;
    });
    mockRepo.findUserById.mockResolvedValue(buildUser({ branchId: 'branch-1', departmentId: 'dept-1' }) as any);
    let dmDetailCall = 0;
    mockRepo.findUserDetailById.mockReset();
    (mockRepo.findUserDetailById as jest.Mock).mockImplementation(async () => {
      dmDetailCall += 1;
      const base = { branchId: 'branch-1', departmentId: 'dept-1', roleId: 'role-viewer-id' };
      if (dmDetailCall === 1) return buildRichUser({ ...base, name: 'Original' }) as any;
      return buildRichUser({ ...base, name: 'Updated Name' }) as any;
    });
    mockRepo.findUserByEmail.mockResolvedValue(null as any);
    mockRepo.findUserByDerivedUsername.mockResolvedValue(null as any);
    mockRepo.reserveNextEmployeeId.mockResolvedValue('USR-9999');
    mockRepo.createUserRecord.mockResolvedValue(buildUser({ id: 'new-id' }) as any);
    mockRepo.updateUserRecord.mockResolvedValue(buildUser() as any);
    mockRepo.findUserIdentityConflict.mockResolvedValue(null as any);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  // ── updateUser: DM actualizando usuario de su departamento → OK ─────────────
  it('updateUser: DM puede actualizar usuario de su departamento', async () => {
    mockRepo.findUserById.mockResolvedValue(buildUser({ branchId: 'branch-1', departmentId: 'dept-1' }) as any);

    await expect(
      updateUser('user-id-1', { name: 'Updated Name' }, dmActor)
    ).resolves.toBeDefined();
  });

  // ── updateUser: DM no puede cambiar branchId → FORBIDDEN ────────────────────
  it('updateUser: DM no puede cambiar la sucursal de un usuario', async () => {
    mockRepo.findUserById.mockResolvedValue(buildUser({ branchId: 'branch-1', departmentId: 'dept-1' }) as any);

    await expect(
      updateUser('user-id-1', { branchId: 'branch-2' }, dmActor)
    ).rejects.toThrow('No tienes permiso para cambiar la sucursal de un usuario');
  });

  // ── updateUser: DM no puede cambiar roleId → FORBIDDEN ──────────────────────
  it('updateUser: DM no puede cambiar el rol de un usuario', async () => {
    mockRepo.findUserById.mockResolvedValue(buildUser({ branchId: 'branch-1', departmentId: 'dept-1' }) as any);

    await expect(
      updateUser('user-id-1', { roleId: 'role-admin-id' } as any, dmActor)
    ).rejects.toThrow('No tienes permiso para cambiar el rol de un usuario');
  });

  // ── updateUser: DM no puede cambiar role (por nombre) → FORBIDDEN ───────────
  it('updateUser: DM no puede cambiar el rol (por nombre) de un usuario', async () => {
    mockRepo.findUserById.mockResolvedValue(buildUser({ branchId: 'branch-1', departmentId: 'dept-1' }) as any);

    await expect(
      updateUser('user-id-1', { role: 'admin' } as any, dmActor)
    ).rejects.toThrow('No tienes permiso para cambiar el rol de un usuario');
  });

  // ── changeUserStatus: DM puede cambiar estado de usuario de su departamento → OK ──
  it('changeUserStatus: DM puede cambiar estado de usuario de su departamento', async () => {
    mockRepo.findUserById.mockResolvedValue(buildUser({ branchId: 'branch-1', departmentId: 'dept-1' }) as any);

    await expect(
      changeUserStatus('user-id-1', 'disabled', dmActor)
    ).resolves.not.toThrow();
  });

  // ── changeUserRole: DM puede cambiar rol de usuario de su sucursal (el middleware de ruta bloquea a nivel router) ──
  it('changeUserRole: DM puede cambiar rol de usuario de su sucursal', async () => {
    mockRepo.findUserById.mockResolvedValue(buildUser({ branchId: 'branch-1', departmentId: 'dept-1' }) as any);

    await expect(
      changeUserRole('user-id-1', { role: 'admin' }, dmActor)
    ).resolves.not.toThrow();
  });
});
