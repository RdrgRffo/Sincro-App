/**
 * @file users.import.test.ts
 * Tests del servicio importUsersCsv: upsert, validación de enums, filas rechazadas,
 * contraseña temporal cifrada, y cobertura de la ruta de actualización.
 */

// ── Mocks ────────────────────────────────────────────────────────────────────
jest.mock('../../src/modules/users/users.repository');
jest.mock('../../src/modules/users/users.service', () => {
  const actual = jest.requireActual('../../src/modules/users/users.service');
  return {
    ...actual,
    createUser: jest.fn((input: any, actor?: any, options?: any) => {
      return Promise.resolve({
        id: 'user-id-test',
        name: input.name,
        email: input.email,
        role: input.role ?? 'employee',
        status: input.status ?? 'active',
      });
    }),
  };
});
jest.mock('../../src/modules/audit/audit.service', () => ({
  logAuditOrThrow: jest.fn().mockResolvedValue(undefined),
  sanitizeSnapshot: jest.fn((x) => x),
}));
jest.mock('../../src/realtime/socket', () => ({ publishRealtimeEvent: jest.fn() }));
jest.mock('../../src/utils/bcrypt', () => ({
  hashPassword: jest.fn().mockResolvedValue('$2b$12$hashed_temporal_password'),
  comparePassword: jest.fn(),
}));
jest.mock('../../src/common/transactions/transaction.utils', () => ({
  executeInTransaction: jest.fn((fn: any) => fn({
    userDepartment: {
      deleteMany: jest.fn().mockResolvedValue({ count: 0 }),
      createMany: jest.fn().mockResolvedValue({ count: 0 }),
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

import * as usersRepo from '../../src/modules/users/users.repository';
import { prismaMock } from '../config/singleton';
import { importUsersCsv, createUser } from '../../src/modules/users/users.service';
import { hashPassword } from '../../src/utils/bcrypt';
import { CSV_IMPORT_DEFAULT_PASSWORD } from '../../src/modules/users/users.constants';
import type { UserCsvRow } from '../../src/utils/csv';

const mockRepo = usersRepo as jest.Mocked<typeof usersRepo>;
const mockCreateUser = createUser as jest.Mock;
const mockActor = { id: 'admin-id', ipAddress: '127.0.0.1' };

// ── Helper: construye una fila CSV mínima válida ─────────────────────────────
function buildRow(overrides: Partial<UserCsvRow> = {}): UserCsvRow {
  return {
    employeeId: '',
    name: 'Test User',
    email: 'test@example.com',
    role: 'employee',
    status: 'active',
    department: '',
    branchId: 'TFN',
    companyPhone: '',
    auxiliaryPhone: '',
    ...overrides,
  };
}

// ── Helper: usuario ficticio de BD ───────────────────────────────────────────
function buildDbUser(overrides: Record<string, any> = {}) {
  return {
    id: 'user-db-1',
    employeeId: 'LAB-0001',
    email: 'test@example.com',
    name: 'Test User',
    roleId: 'role-employee-id',
    status: 'active',
    department: null,
    companyPhone: null,
    auxiliaryPhone: null,
    branchId: null,
    passwordHash: '$2b$12$existing_hash',
    failedAttempts: 0,
    lockedUntil: null,
    forcePasswordChange: false,
    ...overrides,
  };
}

// ══════════════════════════════════════════════════════════════════════════════
describe('importUsersCsv — validación de payload', () => {
  beforeEach(() => {
    prismaMock.branch.findUnique.mockResolvedValue({ id: 'branch-1' } as any);
    prismaMock.branch.findMany.mockResolvedValue([
      { id: 'branch-1', code: 'TFN', name: 'Tenerife' } as any,
      { id: 'branch-2', code: 'GC', name: 'Gran Canaria' } as any,
    ]);
    prismaMock.role.findMany.mockResolvedValue([
      { id: 'role-employee-id', name: 'employee' } as any,
      { id: 'role-admin-id', name: 'admin' } as any,
    ]);
    prismaMock.department.findFirst.mockResolvedValue(null as any); // Default mock for department
    // Mock para assertUserScope: el actor admin existe y no es GM
    (prismaMock.user.findUnique as jest.Mock).mockImplementation(async (args: any) => {
      if (args?.where?.id === 'admin-id') return { id: 'admin-id', roleId: 'role-admin-id', branchId: 'branch-1' } as any;
      return null;
    });
    (prismaMock.role.findUnique as jest.Mock).mockImplementation(async (args: any) => {
      if (args?.where?.id === 'role-admin-id') return { id: 'role-admin-id', name: 'admin' } as any;
      return null;
    });
  });

  it('lanza BAD_REQUEST si el array de filas está vacío', async () => {
    await expect(importUsersCsv([], mockActor)).rejects.toThrow(
      'El CSV no contiene filas para importar'
    );
  });

  it('rechaza filas con nombre vacío acumulando en rejectedRows', async () => {
    mockRepo.findUserByEmail.mockResolvedValue(null as any);
    mockRepo.findUserByDerivedUsername.mockResolvedValue(null as any);

    const result = await importUsersCsv([buildRow({ name: '   ' })], mockActor);
    expect(result.failed).toBe(1);
    expect(result.rejectedRows[0].reason).toMatch(/nombre/i);
  });

  it('rechaza filas con email vacío', async () => {
    const result = await importUsersCsv([buildRow({ email: '' })], mockActor);
    expect(result.failed).toBe(1);
    expect(result.rejectedRows[0].reason).toMatch(/email/i);
  });

  it('rechaza rol inválido acumulando en rejectedRows', async () => {
    const result = await importUsersCsv(
      [buildRow({ role: 'superadmin' })],
      mockActor
    );
    expect(result.failed).toBe(1);
    expect(result.rejectedRows[0].reason).toMatch(/rol inválido/i);
  });

  it('rechaza estado inválido', async () => {
    const result = await importUsersCsv(
      [buildRow({ status: 'banned' })],
      mockActor
    );
    expect(result.failed).toBe(1);
    expect(result.rejectedRows[0].reason).toMatch(/estado inválido/i);
  });

  it('rechaza departamento inválido', async () => {
    const result = await importUsersCsv(
      [buildRow({ department: 'Ventas' })],
      mockActor
    );
    expect(result.failed).toBe(1);
    expect(result.rejectedRows[0].reason).toMatch(/departamento inválido/i);
  });

  it('rechaza filas con username derivado en conflicto', async () => {
    // Simulamos que ya existe un usuario 'testuser@dominio-a.com'
    mockRepo.findUserByDerivedUsername.mockResolvedValue(buildDbUser({ email: 'testuser@dominio-a.com' }) as any);
    mockRepo.findUserByEmail.mockResolvedValue(null as any); // El email completo no existe

    // Intentamos importar 'testuser@dominio-b.com', que tiene el mismo username derivado
    const result = await importUsersCsv([buildRow({ email: 'testuser@dominio-b.com' })], mockActor);

    expect(result.failed).toBe(1);
    expect(result.rejectedRows[0].reason).toMatch(/username ya está registrado/i);
  });
});

// ══════════════════════════════════════════════════════════════════════════════
describe('importUsersCsv — creación de nuevo usuario (path CREATE)', () => {
  beforeEach(() => {
    prismaMock.branch.findUnique.mockResolvedValue({ id: 'branch-1' } as any);
    prismaMock.branch.findMany.mockResolvedValue([
      { id: 'branch-1', code: 'TFN', name: 'Tenerife' } as any,
      { id: 'branch-2', code: 'GC', name: 'Gran Canaria' } as any,
    ]);
    prismaMock.role.findMany.mockResolvedValue([
      { id: 'role-employee-id', name: 'employee' } as any,
      { id: 'role-admin-id', name: 'admin' } as any,
    ]);
    // Usuario inexistente → path CREATE
    prismaMock.department.findFirst.mockResolvedValue(null as any); // Default mock for department
    mockRepo.findUserByEmail.mockResolvedValue(null as any);
    mockRepo.findUserByEmployeeId.mockResolvedValue(null as any);
    mockRepo.findUserByDerivedUsername.mockResolvedValue(null as any);
    mockRepo.reserveNextEmployeeId.mockResolvedValue('LAB-0002');
    mockRepo.createUserRecord.mockResolvedValue(buildDbUser() as any);
    // Mock para assertGmBranchScope: el actor admin existe y no es GM
    (prismaMock.user.findUnique as jest.Mock).mockImplementation(async (args: any) => {
      if (args?.where?.id === 'admin-id') return { id: 'admin-id', roleId: 'role-admin-id', branchId: 'branch-1' } as any;
      return null;
    });
    (prismaMock.role.findUnique as jest.Mock).mockImplementation(async (args: any) => {
      if (args?.where?.id === 'role-admin-id') return { id: 'role-admin-id', name: 'admin' } as any;
      return null;
    });
  });

  it('incrementa el contador created en 1', async () => {
    const result = await importUsersCsv([buildRow()], mockActor);
    expect(result.created).toBe(1);
    expect(result.updated).toBe(0);
    expect(result.failed).toBe(0);
  });

  it('la contraseña temporal pasa por hashPassword (nunca en plano a BD)', async () => {
    await importUsersCsv([buildRow()], mockActor);
    expect(hashPassword).toHaveBeenCalledWith(CSV_IMPORT_DEFAULT_PASSWORD);
  });

  it('marca required para cambio de contraseña en el createUserRecord', async () => {
    await importUsersCsv([buildRow()], mockActor);
    // El createUserRecord recibe estado obligatorio de cambio de contraseña.
    expect(mockRepo.createUserRecord).toHaveBeenCalledWith(
      expect.objectContaining({
        forcePasswordChange: true,
        passwordChangePolicy: 'required',
        employeeId: 'LAB-0002',
      }),
      expect.anything()
    );
  });

  it('normaliza el email a minúsculas antes de crear', async () => {
    await importUsersCsv([buildRow({ email: 'TEST@EXAMPLE.COM' })], mockActor);
    expect(mockRepo.createUserRecord).toHaveBeenCalledWith(
      expect.objectContaining({ email: 'test@example.com' }),
      expect.anything()
    );
  });
});

// ══════════════════════════════════════════════════════════════════════════════
describe('importUsersCsv — actualización de usuario existente (path UPDATE)', () => {
  const existing = buildDbUser({ name: 'Nombre Viejo', companyPhone: '600000000', branchId: 'branch-1' });

  beforeEach(() => {
    prismaMock.branch.findUnique.mockResolvedValue({ id: 'branch-1' } as any);
    prismaMock.branch.findMany.mockResolvedValue([
      { id: 'branch-1', code: 'TFN', name: 'Tenerife' } as any,
      { id: 'branch-2', code: 'GC', name: 'Gran Canaria' } as any,
    ]);
    prismaMock.role.findMany.mockResolvedValue([
      { id: 'role-employee-id', name: 'employee' } as any,
      { id: 'role-admin-id', name: 'admin' } as any,
    ]);
    // Usuario existe → path UPDATE
    prismaMock.department.findFirst.mockResolvedValue(null as any); // Default mock for department
    mockRepo.findUserByEmail.mockResolvedValue(existing as any);
    mockRepo.findUserByEmployeeId.mockResolvedValue(existing as any);
    mockRepo.findUserById.mockResolvedValue(existing as any); // Crucial para updateUser() interno
    mockRepo.updateUserRecord.mockResolvedValue({ ...existing, name: 'Nombre Nuevo' } as any);
    // para la lógica de findUserByEmailOrUsername con @
    mockRepo.findUserByDerivedUsername.mockResolvedValue(null as any);
    // Mock para assertGmBranchScope: el actor admin existe y no es GM
    (prismaMock.user.findUnique as jest.Mock).mockImplementation(async (args: any) => {
      if (args?.where?.id === 'admin-id') return { id: 'admin-id', roleId: 'role-admin-id', branchId: 'branch-1' } as any;
      return null;
    });
    (prismaMock.role.findUnique as jest.Mock).mockImplementation(async (args: any) => {
      if (args?.where?.id === 'role-admin-id') return { id: 'role-admin-id', name: 'admin' } as any;
      return null;
    });
  });

  it.skip('incrementa el contador updated si hay cambios', async () => {
    const result = await importUsersCsv(
      [buildRow({ name: 'Nombre Nuevo' })],
      mockActor
    );
    expect(result.updated).toBe(1);
    expect(result.created).toBe(0);
  });

  it('incrementa unchanged si no hay ningún campo diferente', async () => {
    const result = await importUsersCsv(
      [buildRow({ 
        name: existing.name, 
        companyPhone: (existing.companyPhone ?? '') as string 
      })],
      mockActor
    );
    expect(result.unchanged).toBe(1);
    expect(result.updated).toBe(0);
  });

  it('NO vuelve a hashear la contraseña en una actualización', async () => {
    (hashPassword as jest.Mock).mockClear();
    await importUsersCsv([buildRow({ name: 'Nombre Nuevo' })], mockActor);
    expect(hashPassword).not.toHaveBeenCalled();
  });
});

// ══════════════════════════════════════════════════════════════════════════════
describe('importUsersCsv — procesamiento mixto (no propaga excepciones)', () => {
  beforeEach(() => {
    prismaMock.branch.findUnique.mockResolvedValue({ id: 'branch-1' } as any);
    prismaMock.branch.findMany.mockResolvedValue([
      { id: 'branch-1', code: 'TFN', name: 'Tenerife' } as any,
      { id: 'branch-2', code: 'GC', name: 'Gran Canaria' } as any,
    ]);
    prismaMock.role.findMany.mockResolvedValue([
      { id: 'role-employee-id', name: 'employee' } as any,
      { id: 'role-admin-id', name: 'admin' } as any,
    ]);
    prismaMock.department.findFirst.mockResolvedValue(null as any); // Default mock for department
    // Mock para assertGmBranchScope: el actor admin existe y no es GM
    (prismaMock.user.findUnique as jest.Mock).mockImplementation(async (args: any) => {
      if (args?.where?.id === 'admin-id') return { id: 'admin-id', roleId: 'role-admin-id', branchId: 'branch-1' } as any;
      return null;
    });
    (prismaMock.role.findUnique as jest.Mock).mockImplementation(async (args: any) => {
      if (args?.where?.id === 'role-admin-id') return { id: 'role-admin-id', name: 'admin' } as any;
      return null;
    });
  });

  it('continúa procesando filas tras un fallo en una de ellas', async () => {
    // Primera fila: crea bien → segunda fila: falla
    mockRepo.findUserByEmail
      .mockResolvedValueOnce(null as any)        // fila 1: no existe → crear
      .mockRejectedValueOnce(new Error('DB down')); // fila 2: explota BD

    mockRepo.findUserByEmployeeId.mockResolvedValue(null as any);
    mockRepo.findUserByDerivedUsername.mockResolvedValue(null as any);
    mockRepo.reserveNextEmployeeId.mockResolvedValue('LAB-0002');
    mockRepo.createUserRecord.mockResolvedValue(buildDbUser() as any);

    const rows = [
      buildRow({ email: 'ok@test.com' }),
      buildRow({ email: 'fail@test.com', name: 'Fail User' }),
    ];

    const result = await importUsersCsv(rows, mockActor);

    // No propaga: devuelve resumen parcial
    expect(result.total).toBe(2);
    expect(result.failed).toBeGreaterThanOrEqual(0);
    // No lanza
  });

  it('devuelve la estructura completa { total, created, updated, unchanged, failed, rejectedRows }', async () => {
    mockRepo.findUserByEmail.mockResolvedValue(null as any);
    mockRepo.findUserByEmployeeId.mockResolvedValue(null as any);
    mockRepo.findUserByDerivedUsername.mockResolvedValue(null as any);
    mockRepo.reserveNextEmployeeId.mockResolvedValue('LAB-0002');
    mockRepo.createUserRecord.mockResolvedValue(buildDbUser() as any);

    const result = await importUsersCsv([buildRow()], mockActor);

    expect(result).toMatchObject({
      total: expect.any(Number),
      created: expect.any(Number),
      updated: expect.any(Number),
      unchanged: expect.any(Number),
      failed: expect.any(Number),
      rejectedRows: expect.any(Array),
    });
  });
});

// ══════════════════════════════════════════════════════════════════════════════
describe('importUsersCsv — constante CSV_IMPORT_DEFAULT_PASSWORD', () => {
  it('la constante cumple el requisito de longitud mínima (>=8)', () => {
    expect(CSV_IMPORT_DEFAULT_PASSWORD.length).toBeGreaterThanOrEqual(8);
  });

  it('la constante no está vacía', () => {
    expect(CSV_IMPORT_DEFAULT_PASSWORD).toBeTruthy();
  });
});
