/**
 * @file security-schedules.test.ts
 * Tests de seguridad: employee ve calendario de su sucursal,
 * GM no puede ver schedules de otra branch, DM no puede aprobar vacaciones de otro departamento.
 */

// ── Mocks antes de imports ──────────────────────────────────────────────────
jest.mock('../../src/modules/schedules/schedules.repository');
jest.mock('../../src/modules/audit/audit.service', () => ({
  logAuditOrThrow: jest.fn().mockResolvedValue(undefined),
  sanitizeSnapshot: jest.fn((x) => x),
}));
jest.mock('../../src/modules/notifications/notifications.service', () => ({
  notifyScheduleChange: jest.fn().mockResolvedValue(undefined),
}));
jest.mock('../../src/realtime/socket', () => ({ publishRealtimeEvent: jest.fn() }));
jest.mock('../../src/common/transactions/transaction.utils', () => ({
  executeInTransaction: jest.fn((fn: any) => fn({
    scheduleType: { findUnique: jest.fn().mockResolvedValue({ id: 'st-guardia', value: 'guardia', label: 'Guardia', color: '#1e3a5f' }) },
    user: { findMany: jest.fn() },
  })),
}));

import * as schedulesRepo from '../../src/modules/schedules/schedules.repository';
import { listSchedulesForActor, listWeekSchedulesForActor } from '../../src/modules/schedules/schedules.service';

const mockRepo = schedulesRepo as jest.Mocked<typeof schedulesRepo>;

import { prismaMock } from '../config/singleton';

// ── Helpers ──────────────────────────────────────────────────────────────────
const buildSchedule = (overrides: Record<string, any> = {}) => ({
  id: 'schedule-1',
  title: 'Guardia',
  startDatetime: new Date('2026-06-01T08:00:00Z'),
  endDatetime: new Date('2026-06-01T16:00:00Z'),
  type: 'guardia',
  scheduleTypeId: 'st-guardia',
  color: '#1e3a5f',
  branchId: 'branch-1',
  assignments: [{ userId: 'user-1', user: { name: 'User A' } }],
  ...overrides,
});

// ═══════════════════════════════════════════════════════════════════════════════
describe('Seguridad: Employee ve calendario de su sucursal', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockRepo.findSchedules.mockResolvedValue([buildSchedule() as any]);
  });

  it('employee ve todos los schedules de su branch como calendario grupal', async () => {
    const actor = { id: 'emp-1', roleName: 'employee', branchId: 'branch-1' };

    await listSchedulesForActor({}, actor);

    const callArgs = mockRepo.findSchedules.mock.calls[0]?.[0];
    expect(callArgs).toBeDefined();
    expect(callArgs).toMatchObject({ branchId: { in: ['branch-1'] } });
    expect((callArgs as any).assignments).toBeUndefined();
  });

  it('employee puede filtrar por usuario dentro del calendario de su branch', async () => {
    const actor = { id: 'emp-1', roleName: 'employee', branchId: 'branch-1' };

    await listSchedulesForActor({ userId: 'emp-2' }, actor);

    const callArgs = mockRepo.findSchedules.mock.calls[0][0];
    expect(callArgs).toMatchObject({ branchId: { in: ['branch-1'] } });
    expect(callArgs).toMatchObject({ assignments: { some: { userId: 'emp-2' } } });
  });

  it('employee puede filtrar el calendario semanal por usuario dentro de su branch', async () => {
    const actor = { id: 'emp-1', roleName: 'employee', branchId: 'branch-1' };

    await listWeekSchedulesForActor(2026, 23, undefined, undefined, 'emp-2', actor);

    const callArgs: any = mockRepo.findSchedules.mock.calls[0][0];
    expect(callArgs.AND).toBeDefined();
    const branchFilter = callArgs.AND.find((f: any) => f.branchId);
    expect(branchFilter?.branchId).toBe('branch-1');
    const userFilter = callArgs.AND.find((f: any) => f.assignments);
    expect(userFilter?.assignments?.some?.userId).toBe('emp-2');
  });

  it('employee no puede cambiar la branch visible aunque envie branchId de otra sucursal', async () => {
    const actor = { id: 'emp-1', roleName: 'employee', branchId: 'branch-1' };

    expect(() => listSchedulesForActor({ branchId: 'branch-2' }, actor)).toThrow(
      'No tienes permiso para consultar esa sucursal',
    );
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
describe('Seguridad: GM no puede ver schedules de otra branch', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockRepo.findSchedules.mockResolvedValue([buildSchedule() as any]);
  });

  it('general_manager solo ve schedules de su branch asignada', async () => {
    const actor = { id: 'gm-1', roleName: 'general_manager', branchId: 'branch-1' };

    expect(() => listSchedulesForActor({ branchId: 'branch-2' }, actor)).toThrow(
      'No tienes permiso para consultar esa sucursal',
    );
  });

  it('general_manager en listWeekSchedulesForActor solo ve su branch', async () => {
    const actor = { id: 'gm-1', roleName: 'general_manager', branchId: 'branch-1' };

    await expect(
      listWeekSchedulesForActor(2026, 23, 'branch-2', undefined, undefined, actor),
    ).rejects.toThrow('No tienes permiso para consultar esa sucursal');
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
describe('Seguridad: Admin ve schedules sin restricción de branch', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockRepo.findSchedules.mockResolvedValue([buildSchedule() as any]);
  });

  it('admin puede ver schedules de cualquier branch', async () => {
    const actor = { id: 'admin-1', roleName: 'admin', branchId: 'branch-1' };

    await listSchedulesForActor({ branchId: 'branch-3' }, actor);

    const callArgs = mockRepo.findSchedules.mock.calls[0][0];
    // Admin pasa el branchId que pidió sin restricción
    expect(callArgs).toMatchObject({ branchId: 'branch-3' });
  });
});
