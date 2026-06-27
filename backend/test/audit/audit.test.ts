/**
 * @file audit.test.ts
 * Tests del motor de auditoría y rollback: protecciones de irreversibilidad, duplicados, snapshots incompletos.
 */

// ── Mocks antes de imports ──────────────────────────────────────────────────
const mockTransaction = {
  schedule: { upsert: jest.fn() },
  user: { update: jest.fn(), upsert: jest.fn() },
  webhookConfig: { delete: jest.fn(), upsert: jest.fn() },
  auditLog: { update: jest.fn() },
  department: { upsert: jest.fn(), delete: jest.fn() },
  departmentBranch: { deleteMany: jest.fn(), createMany: jest.fn() },
  absence: { delete: jest.fn(), upsert: jest.fn() },
  shiftPreset: { delete: jest.fn(), upsert: jest.fn() },
  scheduleType: { delete: jest.fn(), upsert: jest.fn() },
  role: { delete: jest.fn(), upsert: jest.fn() },
  // Skill
  skill: { delete: jest.fn(), upsert: jest.fn(), update: jest.fn() },
  userSkill: { count: jest.fn(), deleteMany: jest.fn(), createMany: jest.fn(), findMany: jest.fn() },
  // Branch
  branch: { update: jest.fn(), upsert: jest.fn() },
};

jest.mock('../../src/modules/audit/audit.repository');
jest.mock('../../src/modules/schedules/schedules.repository');
jest.mock('../../src/modules/users/users.repository');
jest.mock('../../src/common/transactions/transaction.utils', () => ({
  executeInTransaction: jest.fn((fn: any) => fn(mockTransaction)),
}));

import * as auditRepo from '../../src/modules/audit/audit.repository';
import { rollbackAudit, getAuditLogById, listAuditLogs } from '../../src/modules/audit/audit.service';
import { IRREVERSIBLE_ACTIONS } from '../../src/modules/audit/domain/audit.types';
import * as usersRepo from '../../src/modules/users/users.repository';

const mockAuditRepo = auditRepo as jest.Mocked<typeof auditRepo>;
const mockUsersRepo = usersRepo as jest.Mocked<typeof usersRepo>;

// ── Helper ────────────────────────────────────────────────────────────────────
const buildLog = (overrides: Record<string, any> = {}) => ({
  id: 'log-1',
  userId: 'user-1',
  action: 'UPDATE',
  entityType: 'User',
  entityId: 'user-99',
  detailsJson: JSON.stringify({
    before: { id: 'user-99', name: 'Anterior', email: 'ant@test.com', roleId: 'role-viewer-id', status: 'active' },
    after: { id: 'user-99', name: 'Posterior', email: 'ant@test.com', roleId: 'role-admin-id', status: 'active' },
  }),
  ipAddress: '127.0.0.1',
  createdAt: new Date(),
  ...overrides,
});

// ═══════════════════════════════════════════════════════════════════════════════
describe('rollbackAudit', () => {
  beforeEach(() => {
    mockAuditRepo.createAuditLog.mockResolvedValue({
      id: 'rollback-log',
      createdAt: new Date(),
      userId: 'admin-id',
    } as any);
  });

  // ── Caso: Log no encontrado (404) ─────────────────────────────────────────
  it('lanza NOT_FOUND si el log de auditoría no existe', async () => {
    mockAuditRepo.findAuditLogById.mockResolvedValue(null as any);

    await expect(rollbackAudit('nonexistent-id', 'admin', '127.0.0.1'))
      .rejects.toThrow('Log no encontrado');
  });

  // ── Caso: Intentar revertir acciones IRREVERSIBLES ─────────────────────────
  // Probamos cada acción de la lista de inflexibilidad negocial
  IRREVERSIBLE_ACTIONS.forEach((action) => {
    it(`bloquea el rollback de la acción irreversible: "${action}"`, async () => {
      mockAuditRepo.findAuditLogById.mockResolvedValue(
        buildLog({ action, detailsJson: JSON.stringify({ before: { id: 'x' } }) }) as any
      );
      mockAuditRepo.createAuditLog.mockResolvedValue(undefined as any);

      await expect(rollbackAudit('log-1', 'admin', '127.0.0.1'))
        .rejects.toThrow(/no puede ser revertida/);
    });
  });

  // ── Caso: Log sin snapshot "before" → no rollbackeable ───────────────────
  it('rechaza rollback de un log UPDATE sin información "before" en detailsJson', async () => {
    mockAuditRepo.findAuditLogById.mockResolvedValue(
      buildLog({ action: 'UPDATE', detailsJson: JSON.stringify({ after: { id: 'x' } }) }) as any // sin before
    );

    await expect(rollbackAudit('log-1', 'admin', '127.0.0.1'))
      .rejects.toThrow(/snapshot/i);
  });

  // ── Caso: Log con detailsJson = null → también rechazado ─────────────────
  it('rechaza rollback cuando detailsJson es null (log incompleto)', async () => {
    mockAuditRepo.findAuditLogById.mockResolvedValue(
      buildLog({ action: 'UPDATE', detailsJson: null }) as any
    );

    await expect(rollbackAudit('log-1', 'admin', '127.0.0.1'))
      .rejects.toThrow();
  });

  // ── Caso: Rollback de usuario recalcula derivedUsername ───────────────────
  it('recalcula el derivedUsername al revertir un UPDATE_USER a un email normal', async () => {
    const logWithUserUpdate = buildLog({
      action: 'UPDATE_USER',
      entityType: 'User',
      detailsJson: JSON.stringify({
        before: { email: 'restaurado@example.com', name: 'Nombre Viejo' },
        after: { email: 'cambiado@example.com', name: 'Nombre Nuevo' },
      }),
    });
    mockAuditRepo.findAuditLogById.mockResolvedValue(logWithUserUpdate as any);

    await rollbackAudit('log-1', 'admin-id');

    expect(mockUsersRepo.updateUserRecord).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({
        email: 'restaurado@example.com',
        derivedUsername: 'restaurado',
      }),
      expect.anything()
    );
  });

  it('maneja el derivedUsername para emails anonimizados (revoked_) en un rollback', async () => {
    const logWithUserUpdate = buildLog({
      action: 'UPDATE_USER',
      entityType: 'User',
      detailsJson: JSON.stringify({
        before: { email: 'revoked_12345_test@example.com', name: 'Usuario Revocado' },
      }),
    });
    mockAuditRepo.findAuditLogById.mockResolvedValue(logWithUserUpdate as any);

    await rollbackAudit('log-1', 'admin-id');

    expect(mockUsersRepo.updateUserRecord).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({ derivedUsername: 'revoked_12345_test@example.com' }),
      expect.anything()
    );
  });

  it('restaura un Department con sus branchIds al hacer rollback de un UPDATE_DEPARTMENT', async () => {
    mockAuditRepo.findAuditLogById.mockResolvedValue(
      buildLog({
        action: 'UPDATE_DEPARTMENT',
        entityType: 'Department',
        entityId: 'dept-1',
        detailsJson: JSON.stringify({
          before: {
            id: 'dept-1',
            name: 'Recursos Humanos',
            code: 'RH01',
            description: 'Equipo interno',
            isActive: true,
            branchIds: ['branch-1', 'branch-2'],
          },
          after: {
            id: 'dept-1',
            name: 'RRHH',
            code: 'RH02',
            description: 'Equipo interno nuevo',
            isActive: true,
            branchIds: ['branch-2'],
          },
        }),
      }) as any,
    );

    await rollbackAudit('log-1', 'admin-id');

    expect(mockTransaction.department.upsert).toHaveBeenCalledWith(expect.objectContaining({
      where: { id: 'dept-1' },
      create: expect.objectContaining({
        id: 'dept-1',
        name: 'Recursos Humanos',
        code: 'RH01',
      }),
      update: expect.objectContaining({
        name: 'Recursos Humanos',
        code: 'RH01',
      }),
    }));
    expect(mockTransaction.departmentBranch.deleteMany).toHaveBeenCalledWith({ where: { departmentId: 'dept-1' } });
    expect(mockTransaction.departmentBranch.createMany).toHaveBeenCalledWith({
      data: [
        { departmentId: 'dept-1', branchId: 'branch-1' },
        { departmentId: 'dept-1', branchId: 'branch-2' },
      ],
    });
  });

  it('restaura un ShiftPreset desde snapshot before', async () => {
    mockAuditRepo.findAuditLogById.mockResolvedValue(
      buildLog({
        action: 'UPDATE_SHIFT_PRESET',
        entityType: 'ShiftPreset',
        entityId: 'preset-1',
        detailsJson: JSON.stringify({
          before: {
            id: 'preset-1',
            name: 'Mañana',
            startTime: '08:00',
            endTime: '16:00',
            isActive: true,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
          },
        }),
      }) as any,
    );

    await rollbackAudit('log-1', 'admin-id');

    expect(mockTransaction.shiftPreset.upsert).toHaveBeenCalledWith(expect.objectContaining({
      where: { id: 'preset-1' },
      create: expect.objectContaining({
        id: 'preset-1',
        name: 'Mañana',
        startTime: '08:00',
        endTime: '16:00',
      }),
      update: expect.objectContaining({
        name: 'Mañana',
        startTime: '08:00',
        endTime: '16:00',
      }),
    }));
  });

  it('elimina una ausencia creada al revertir CREATE_ABSENCE_REQUEST', async () => {
    mockAuditRepo.findAuditLogById.mockResolvedValue(
      buildLog({
        action: 'CREATE_ABSENCE_REQUEST',
        entityType: 'Absence',
        entityId: 'abs-new',
        detailsJson: JSON.stringify({
          before: null,
          after: { id: 'abs-new', status: 'pending' },
        }),
      }) as any,
    );

    await rollbackAudit('log-1', 'admin-id');

    expect(mockTransaction.absence.delete).toHaveBeenCalledWith({ where: { id: 'abs-new' } });
    expect(mockTransaction.absence.upsert).not.toHaveBeenCalled();
  });

  it('restaura una ausencia aprobada desde snapshot before', async () => {
    mockAuditRepo.findAuditLogById.mockResolvedValue(
      buildLog({
        action: 'APPROVE_ABSENCE',
        entityType: 'Absence',
        entityId: 'abs-1',
        detailsJson: JSON.stringify({
          before: {
            id: 'abs-1',
            employeeId: 'employee-1',
            type: 'vacaciones',
            status: 'pending',
            startDate: '2026-05-12T00:00:00.000Z',
            endDate: '2026-05-13T00:00:00.000Z',
            note: 'Viaje',
            reviewedBy: null,
            reviewedAt: null,
            rejectionReason: null,
            branchId: 'branch-1',
            departmentId: 'dept-1',
          },
        }),
      }) as any,
    );

    await rollbackAudit('log-1', 'admin-id');

    expect(mockTransaction.absence.upsert).toHaveBeenCalledWith(expect.objectContaining({
      where: { id: 'abs-1' },
      update: expect.objectContaining({
        employeeId: 'employee-1',
        status: 'pending',
        branchId: 'branch-1',
        departmentId: 'dept-1',
      }),
    }));
  });

  it('restaura permisos de Role desde snapshot before', async () => {
    mockAuditRepo.findAuditLogById.mockResolvedValue(
      buildLog({
        action: 'UPDATE_ROLE',
        entityType: 'Role',
        entityId: 'role-1',
        detailsJson: JSON.stringify({
          before: {
            id: 'role-1',
            name: 'manager',
            description: 'Manager',
            isSystem: false,
            permissions: [{ name: 'schedules:view' }, { name: 'users:view' }],
          },
        }),
      }) as any,
    );

    await rollbackAudit('log-1', 'admin-id');

    expect(mockTransaction.role.upsert).toHaveBeenCalledWith(expect.objectContaining({
      where: { id: 'role-1' },
      update: expect.objectContaining({
        name: 'manager',
        permissions: {
          set: [{ name: 'schedules:view' }, { name: 'users:view' }],
        },
      }),
    }));
  });

  // ══════════════════════════════════════════════════════════════════════════
  // Skill rollback
  // ══════════════════════════════════════════════════════════════════════════

  it('elimina una skill recién creada al revertir CREATE_SKILL (sin asignaciones)', async () => {
    mockTransaction.userSkill.count.mockResolvedValue(0);
    mockAuditRepo.findAuditLogById.mockResolvedValue(
      buildLog({
        action: 'CREATE_SKILL',
        entityType: 'Skill',
        entityId: 'skill-new',
        detailsJson: JSON.stringify({
          before: null,
          after: { id: 'skill-new', name: 'TypeScript', isActive: true },
        }),
      }) as any,
    );

    await rollbackAudit('log-1', 'admin-id');

    expect(mockTransaction.skill.delete).toHaveBeenCalledWith({ where: { id: 'skill-new' } });
    expect(mockTransaction.skill.upsert).not.toHaveBeenCalled();
  });

  it('lanza CONFLICT al revertir CREATE_SKILL cuando la skill tiene asignaciones', async () => {
    mockTransaction.userSkill.count.mockResolvedValue(3);
    mockAuditRepo.findAuditLogById.mockResolvedValue(
      buildLog({
        action: 'CREATE_SKILL',
        entityType: 'Skill',
        entityId: 'skill-with-assignments',
        detailsJson: JSON.stringify({
          before: null,
          after: { id: 'skill-with-assignments', name: 'React', isActive: true },
        }),
      }) as any,
    );

    await expect(rollbackAudit('log-1', 'admin-id'))
      .rejects.toThrow(/asignación/);
  });

  it('restaura una skill desde snapshot before al revertir UPDATE_SKILL', async () => {
    mockAuditRepo.findAuditLogById.mockResolvedValue(
      buildLog({
        action: 'UPDATE_SKILL',
        entityType: 'Skill',
        entityId: 'skill-1',
        detailsJson: JSON.stringify({
          before: {
            id: 'skill-1',
            name: 'Comunicación',
            category: 'Soft Skills',
            color: '#1d4ed8',
            description: null,
            isActive: true,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
          },
          after: {
            id: 'skill-1',
            name: 'Comunicación Avanzada',
            category: 'Soft Skills',
            color: '#1d4ed8',
            description: 'Descripción nueva',
            isActive: true,
          },
        }),
      }) as any,
    );

    await rollbackAudit('log-1', 'admin-id');

    expect(mockTransaction.skill.upsert).toHaveBeenCalledWith(expect.objectContaining({
      where: { id: 'skill-1' },
      update: expect.objectContaining({
        name: 'Comunicación',
        category: 'Soft Skills',
        isActive: true,
      }),
    }));
  });

  it('restaura un soft-delete de skill al revertir UPDATE_SKILL (isActive: false → true)', async () => {
    mockAuditRepo.findAuditLogById.mockResolvedValue(
      buildLog({
        action: 'UPDATE_SKILL',
        entityType: 'Skill',
        entityId: 'skill-2',
        detailsJson: JSON.stringify({
          before: {
            id: 'skill-2',
            name: 'Liderazgo',
            category: 'Management',
            color: '#1d4ed8',
            description: null,
            isActive: true,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
          },
          after: { id: 'skill-2', name: 'Liderazgo', isActive: false },
        }),
      }) as any,
    );

    await rollbackAudit('log-1', 'admin-id');

    expect(mockTransaction.skill.upsert).toHaveBeenCalledWith(expect.objectContaining({
      where: { id: 'skill-2' },
      update: expect.objectContaining({ isActive: true }),
    }));
  });

  it('restaura asignaciones de skills de un usuario al revertir ASSIGN_USER_SKILLS', async () => {
    mockTransaction.userSkill.findMany.mockResolvedValue([]);
    mockAuditRepo.findAuditLogById.mockResolvedValue(
      buildLog({
        action: 'ASSIGN_USER_SKILLS',
        entityType: 'User',
        entityId: 'user-10',
        detailsJson: JSON.stringify({
          before: [
            { skillId: 'skill-a', skill: { id: 'skill-a', name: 'Excel' } },
            { skillId: 'skill-b', skill: { id: 'skill-b', name: 'Word' } },
          ],
          after: [
            { skillId: 'skill-c', skill: { id: 'skill-c', name: 'PowerPoint' } },
          ],
        }),
      }) as any,
    );

    await rollbackAudit('log-1', 'admin-id');

    expect(mockTransaction.userSkill.deleteMany).toHaveBeenCalledWith({ where: { userId: 'user-10' } });
    expect(mockTransaction.userSkill.createMany).toHaveBeenCalledWith({
      data: [
        expect.objectContaining({ userId: 'user-10', skillId: 'skill-a' }),
        expect.objectContaining({ userId: 'user-10', skillId: 'skill-b' }),
      ],
      skipDuplicates: true,
    });
  });

  it('restaura estado vacío de skills (antes no tenía ninguna) al revertir ASSIGN_USER_SKILLS', async () => {
    mockTransaction.userSkill.findMany.mockResolvedValue([]);
    mockAuditRepo.findAuditLogById.mockResolvedValue(
      buildLog({
        action: 'ASSIGN_USER_SKILLS',
        entityType: 'User',
        entityId: 'user-11',
        detailsJson: JSON.stringify({
          before: [],
          after: [{ skillId: 'skill-x' }],
        }),
      }) as any,
    );

    await rollbackAudit('log-1', 'admin-id');

    expect(mockTransaction.userSkill.deleteMany).toHaveBeenCalledWith({ where: { userId: 'user-11' } });
    expect(mockTransaction.userSkill.createMany).not.toHaveBeenCalled();
  });

  // ══════════════════════════════════════════════════════════════════════════
  // Branch rollback
  // ══════════════════════════════════════════════════════════════════════════

  it('soft-delete una sucursal creada al revertir CREATE_BRANCH', async () => {
    mockAuditRepo.findAuditLogById.mockResolvedValue(
      buildLog({
        action: 'CREATE_BRANCH',
        entityType: 'Branch',
        entityId: 'branch-new',
        detailsJson: JSON.stringify({ name: 'Sucursal Norte', code: 'NORTE' }),
      }) as any,
    );

    await rollbackAudit('log-1', 'admin-id');

    expect(mockTransaction.branch.update).toHaveBeenCalledWith({
      where: { id: 'branch-new' },
      data: { isActive: false },
    });
  });

  it('restaura una sucursal desde snapshot before al revertir UPDATE_BRANCH', async () => {
    mockAuditRepo.findAuditLogById.mockResolvedValue(
      buildLog({
        action: 'UPDATE_BRANCH',
        entityType: 'Branch',
        entityId: 'branch-1',
        detailsJson: JSON.stringify({
          before: {
            id: 'branch-1',
            name: 'Sucursal Madrid',
            code: 'MAD',
            city: 'Madrid',
            countryCode: 'ES',
            timezone: 'Europe/Madrid',
            isActive: true,
          },
          after: {
            id: 'branch-1',
            name: 'Sucursal Madrid Centro',
            code: 'MADC',
            city: 'Madrid',
            countryCode: 'ES',
            timezone: 'Europe/Madrid',
            isActive: true,
          },
        }),
      }) as any,
    );

    await rollbackAudit('log-1', 'admin-id');

    expect(mockTransaction.branch.upsert).toHaveBeenCalledWith(expect.objectContaining({
      where: { id: 'branch-1' },
      update: expect.objectContaining({ name: 'Sucursal Madrid', code: 'MAD' }),
    }));
  });

  it('reactiva una sucursal soft-deleted al revertir DELETE_BRANCH', async () => {
    mockAuditRepo.findAuditLogById.mockResolvedValue(
      buildLog({
        action: 'DELETE_BRANCH',
        entityType: 'Branch',
        entityId: 'branch-del',
        detailsJson: JSON.stringify({ name: 'Sucursal Sur', code: 'SUR' }),
      }) as any,
    );

    await rollbackAudit('log-1', 'admin-id');

    expect(mockTransaction.branch.update).toHaveBeenCalledWith({
      where: { id: 'branch-del' },
      data: { isActive: true },
    });
  });

  it('lanza CONFLICT al revertir HARD_DELETE_BRANCH (borrado físico irreversible)', async () => {
    mockAuditRepo.findAuditLogById.mockResolvedValue(
      buildLog({
        action: 'HARD_DELETE_BRANCH',
        entityType: 'Branch',
        entityId: 'branch-gone',
        detailsJson: JSON.stringify({ name: 'Sucursal Cerrada', code: 'CLOSED' }),
      }) as any,
    );

    await expect(rollbackAudit('log-1', 'admin-id'))
      .rejects.toThrow(/borrado físico/);
  });

  it('quita el manager de una sucursal al revertir ASSIGN_BRANCH_MANAGER', async () => {
    mockAuditRepo.findAuditLogById.mockResolvedValue(
      buildLog({
        action: 'ASSIGN_BRANCH_MANAGER',
        entityType: 'Branch',
        entityId: 'branch-mgr',
        detailsJson: JSON.stringify({
          branchName: 'Sucursal Este',
          managerName: 'Ana García',
          managerId: 'user-mgr-1',
        }),
      }) as any,
    );

    await rollbackAudit('log-1', 'admin-id');

    expect(mockTransaction.branch.update).toHaveBeenCalledWith({
      where: { id: 'branch-mgr' },
      data: { managerId: null },
    });
  });

  it('restaura el ex-manager de una sucursal al revertir REMOVE_BRANCH_MANAGER', async () => {
    mockAuditRepo.findAuditLogById.mockResolvedValue(
      buildLog({
        action: 'REMOVE_BRANCH_MANAGER',
        entityType: 'Branch',
        entityId: 'branch-no-mgr',
        detailsJson: JSON.stringify({
          branchName: 'Sucursal Oeste',
          formerManagerName: 'Carlos López',
          formerManagerId: 'user-former-mgr',
          stillManagerOfOtherBranches: false,
        }),
      }) as any,
    );

    await rollbackAudit('log-1', 'admin-id');

    expect(mockTransaction.branch.update).toHaveBeenCalledWith({
      where: { id: 'branch-no-mgr' },
      data: { managerId: 'user-former-mgr' },
    });
  });

  it('lanza BAD_REQUEST al revertir REMOVE_BRANCH_MANAGER sin formerManagerId en el snapshot', async () => {
    mockAuditRepo.findAuditLogById.mockResolvedValue(
      buildLog({
        action: 'REMOVE_BRANCH_MANAGER',
        entityType: 'Branch',
        entityId: 'branch-incomplete',
        detailsJson: JSON.stringify({ branchName: 'Sin Manager' }),
      }) as any,
    );

    await expect(rollbackAudit('log-1', 'admin-id'))
      .rejects.toThrow(/ex-manager/);
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
describe('getAuditLogById', () => {
  // ── Caso: Log no encontrado ──────────────────────────────────────────────
  it('lanza NOT_FOUND si el id de auditoría no existe en BD', async () => {
    mockAuditRepo.findAuditLogById.mockResolvedValue(null as any);

    await expect(getAuditLogById('ghost-id'))
      .rejects.toThrow('Registro de auditoría no encontrado');
  });

  // ── Caso: Retorna el log decodificado ─────────────────────────────────────
  it('devuelve el log con detailsJson parseado desde string a objeto', async () => {
    const rawLog = buildLog();
    mockAuditRepo.findAuditLogById.mockResolvedValue(rawLog as any);

    const result = await getAuditLogById('log-1');

    expect(result.id).toBe('log-1');
    // detailsJson debe venir como objeto, no como string crudo
    expect(typeof result.detailsJson).toBe('object');
    expect((result.detailsJson as any).before).toBeDefined();
  });
});

describe('listAuditLogs', () => {
  beforeEach(() => {
    mockAuditRepo.findAuditLogs.mockResolvedValue({ logs: [], total: 0 } as any);
  });

  it('usa orden por defecto createdAt desc cuando no se envía sort', async () => {
    await listAuditLogs({ page: 1, limit: 20 });

    expect(mockAuditRepo.findAuditLogs).toHaveBeenCalledWith(
      expect.any(Object),
      1,
      20,
      'createdAt',
      'desc',
    );
  });

  it('propaga sortBy/sortOrder hacia repositorio', async () => {
    await listAuditLogs({
      page: 3,
      limit: 15,
      sortBy: 'action',
      sortOrder: 'asc',
    });

    expect(mockAuditRepo.findAuditLogs).toHaveBeenCalledWith(
      expect.any(Object),
      3,
      15,
      'action',
      'asc',
    );
  });
});
