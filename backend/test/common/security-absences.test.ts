/**
 * @file security-absences.test.ts
 * Tests de seguridad: DM no puede aprobar ausencias de otro departamento,
 * permisos de webhooks y settings.
 */

// ── Mocks antes de imports ──────────────────────────────────────────────────
jest.mock('../../src/modules/audit/audit.service', () => ({
  logAuditOrThrow: jest.fn().mockResolvedValue(undefined),
  sanitizeSnapshot: jest.fn((x) => x),
}));
jest.mock('../../src/realtime/socket', () => ({ publishRealtimeEvent: jest.fn() }));
jest.mock('../../src/modules/notifications/notifications.service', () => ({
  notifyScheduleChange: jest.fn().mockResolvedValue(undefined),
  notifyAbsenceChange: jest.fn().mockResolvedValue(undefined),
}));
jest.mock('../../src/modules/in-app-notifications/in-app.service', () => ({
  createInAppNotification: jest.fn().mockResolvedValue(undefined),
  createInAppNotificationBatch: jest.fn().mockResolvedValue(undefined),
}));
jest.mock('../../src/modules/schedules/weekly-summary.service', () => ({
  recalculateWeeklySummariesForAbsence: jest.fn().mockResolvedValue(undefined),
}));

import { prismaMock } from '../config/singleton';
import { approveAbsenceEntry } from '../../src/modules/absences/absences.service';

// ═══════════════════════════════════════════════════════════════════════════════
describe('Seguridad: DM no puede aprobar ausencias de otro departamento', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    prismaMock.$transaction.mockImplementation(async (cb: (tx: typeof prismaMock) => Promise<unknown>) =>
      cb(prismaMock),
    );
  });

  it('department_manager puede aprobar ausencias de su propio departamento', async () => {
    const actor = {
      id: 'dm-1',
      roleName: 'department_manager',
      email: 'dm@test.com',
      name: 'DM',
      branchId: 'branch-1',
      departmentId: 'dept-1',
      ipAddress: '127.0.0.1',
    };

    (prismaMock as any).absence.findUnique.mockResolvedValue({
      id: 'abs-1',
      userId: 'user-1',
      employeeId: 'user-1',
      status: 'pending',
      startDate: new Date('2026-07-01'),
      endDate: new Date('2026-07-05'),
      branchId: 'branch-1',
      departmentId: 'dept-1',
      user: {
        id: 'user-1',
        departmentId: 'dept-1',
        department: { id: 'dept-1', name: 'Mi Depto' },
      },
    });

    (prismaMock as any).absence.update.mockResolvedValue({
      id: 'abs-1',
      employeeId: 'user-1',
      status: 'approved',
      branch: { timezone: 'Europe/Madrid' },
    });

    await expect(
      approveAbsenceEntry('abs-1', { note: 'aprobado' }, actor)
    ).resolves.not.toThrow();
  });

  it('department_manager NO puede aprobar ausencias de otro departamento', async () => {
    const actor = {
      id: 'dm-1',
      roleName: 'department_manager',
      email: 'dm@test.com',
      name: 'DM',
      branchId: 'branch-1',
      departmentId: 'dept-1',
      ipAddress: '127.0.0.1',
    };

    (prismaMock as any).absence.findUnique.mockResolvedValue({
      id: 'abs-2',
      userId: 'user-2',
      employeeId: 'user-2',
      status: 'pending',
      startDate: new Date('2026-07-01'),
      endDate: new Date('2026-07-05'),
      branchId: 'branch-1',
      departmentId: 'dept-2',
      user: {
        id: 'user-2',
        departmentId: 'dept-2',
        department: { id: 'dept-2', name: 'Otro Depto' },
      },
    });

    await expect(
      approveAbsenceEntry('abs-2', { note: 'aprobado' }, actor)
    ).rejects.toThrow(/departamento/i);
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
describe('Permisos: Webhooks endpoints requieren webhooks:view/webhooks:manage', () => {
  it('webhooks:view existe en DEFAULT_ROLE_PERMISSIONS para general_manager', () => {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const { DEFAULT_ROLE_PERMISSIONS } = require('../../src/modules/roles/roles.constants');
    const gmPerms = DEFAULT_ROLE_PERMISSIONS.general_manager;
    expect(gmPerms).toContain('webhooks:view');
  });

  it('webhooks:manage NO está en general_manager (CRUD webhooks solo admin)', () => {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const { DEFAULT_ROLE_PERMISSIONS } = require('../../src/modules/roles/roles.constants');
    const gmPerms = DEFAULT_ROLE_PERMISSIONS.general_manager;
    expect(gmPerms).not.toContain('webhooks:manage');
  });

  it('notifications:send está en general_manager (envíos manuales acotados a su sede)', () => {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const { DEFAULT_ROLE_PERMISSIONS } = require('../../src/modules/roles/roles.constants');
    const gmPerms = DEFAULT_ROLE_PERMISSIONS.general_manager;
    expect(gmPerms).toContain('notifications:send');
  });

  it('settings:manage existe en DEFAULT_ROLE_PERMISSIONS para admin', () => {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const { DEFAULT_ROLE_PERMISSIONS } = require('../../src/modules/roles/roles.constants');
    const adminPerms = DEFAULT_ROLE_PERMISSIONS.admin;
    expect(adminPerms).toContain('settings:manage');
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
describe('Notificaciones in-app', () => {
  beforeEach(() => {
    prismaMock.$transaction.mockImplementation(async (cb: (tx: typeof prismaMock) => Promise<unknown>) =>
      cb(prismaMock),
    );
  });

  it('se crea notificación al aprobar ausencia', async () => {
    const createInAppNotification = jest.requireMock('../../src/modules/in-app-notifications/in-app.service')
      .createInAppNotification;

    const actor = {
      id: 'admin-1',
      roleName: 'admin',
      email: 'admin@test.com',
      name: 'Admin',
      branchId: 'branch-1',
      ipAddress: '127.0.0.1',
    };

    (prismaMock as any).absence.findUnique.mockResolvedValue({
      id: 'abs-3',
      userId: 'user-1',
      employeeId: 'user-1',
      status: 'pending',
      startDate: new Date('2026-07-01'),
      endDate: new Date('2026-07-05'),
      branchId: 'branch-1',
      departmentId: 'dept-1',
      branch: { timezone: 'Europe/Madrid' },
      user: { id: 'user-1', departmentId: 'dept-1', department: { id: 'dept-1', name: 'Depto' } },
    });

    (prismaMock as any).absence.update.mockResolvedValue({
      id: 'abs-3',
      employeeId: 'user-1',
      status: 'approved',
      branch: { timezone: 'Europe/Madrid' },
    });

    await approveAbsenceEntry('abs-3', { note: 'aprobado' }, actor);

    expect(createInAppNotification).toHaveBeenCalledWith(
      expect.objectContaining({ userId: 'user-1', type: 'absence_approved' })
    );
  });
});
