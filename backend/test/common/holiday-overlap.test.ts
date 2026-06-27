import { prisma } from '../../src/config/database';
import { createScheduleEntry } from '../../src/modules/schedules/schedules.service';
import * as schedulesRepo from '../../src/modules/schedules/schedules.repository';

// Mocking needed services for the business logic test
jest.mock('../../src/modules/audit/audit.service', () => ({
  logAuditOrThrow: jest.fn().mockResolvedValue(undefined),
  sanitizeSnapshot: jest.fn((x) => x),
}));
jest.mock('../../src/modules/notifications/notifications.service', () => ({
  notifyScheduleChange: jest.fn().mockResolvedValue(undefined),
}));
jest.mock('../../src/modules/in-app-notifications/in-app.service', () => ({
  createInAppNotification: jest.fn().mockResolvedValue(undefined),
  createInAppNotificationBatch: jest.fn().mockResolvedValue(undefined),
}));
jest.mock('../../src/realtime/socket', () => ({ publishRealtimeEvent: jest.fn() }));
jest.mock('../../src/modules/schedules/schedules.repository');
// We'll set up the tx mock dynamically in beforeEach
const mockTx = {
  scheduleType: { findUnique: jest.fn() },
  user: { findMany: jest.fn((args: any) => Promise.resolve((args?.where?.id?.in ?? []).map((id: string) => ({ id })))) },
};
jest.mock('../../src/common/transactions/transaction.utils', () => ({
  executeInTransaction: jest.fn(async (fn: any) => await fn(mockTx)),
}));

import { prismaMock } from '../config/singleton';

const mockRepo = schedulesRepo as jest.Mocked<typeof schedulesRepo>;

const mockActor = {
  id: 'admin-1',
  roleName: 'admin',
  email: 'admin@test.com',
  name: 'Admin',
};

describe('Holiday and Task Overlap Logic', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    prismaMock.user.findMany.mockResolvedValue([{ id: 'u-1' }] as any);
    // Default tx mock for scheduleType
    mockTx.scheduleType.findUnique.mockResolvedValue({ id: 'st-guardia', value: 'guardia' });
  });

  it('bloquea la creación de tarea de guardia en un día festivo', async () => {
    // Escenario: 1 de Junio es festivo en Sucursal A
    prismaMock.branch.findUnique.mockResolvedValue({ id: 'b-1', isActive: true } as any);
    
    // Simulamos que existe un festivo ese día
    prismaMock.branchHoliday.findMany.mockResolvedValue([{
      id: 'h-1',
      name: 'Festivo Test',
      date: new Date('2026-06-01')
    } as any]);
    prismaMock.scheduleType.findUnique.mockResolvedValue({ id: 'st-guardia', value: 'guardia' } as any);

    await expect(createScheduleEntry({
      title: 'Guardia de Festivo',
      startDatetime: new Date('2026-06-01T08:00:00Z'),
      endDatetime: new Date('2026-06-01T16:00:00Z'),
      branchId: 'b-1',
      assigneeIds: ['u-1'],
      scheduleTypeId: 'st-guardia',
      color: '#1e3a5f',
      hoursPerDay: 8,
      confirmed: false,
    }, mockActor)).rejects.toMatchObject({
      code: 'BAD_REQUEST',
      message: expect.stringContaining('No se puede asignar trabajo en días festivos: Festivo Test')
    });
  });

  it('permite crear una tarea de tipo "otro" en un día festivo (excepción)', async () => {
    prismaMock.branch.findUnique.mockResolvedValue({ id: 'b-1', isActive: true } as any);
    prismaMock.branchHoliday.findMany.mockResolvedValue([{
      id: 'h-1',
      name: 'Festivo Test',
      date: new Date('2026-06-01')
    } as any]);

    prismaMock.scheduleType.findUnique.mockResolvedValue({ id: 'st-otro', value: 'otro' } as any);
    mockTx.scheduleType.findUnique.mockResolvedValue({ id: 'st-otro', value: 'otro' });

    mockRepo.findSchedules.mockResolvedValue([]);
    mockRepo.createSchedule.mockResolvedValue({
      id: 's-1',
      title: 'Tarea Excepcional',
      type: 'otro',
      assignments: [{ user: { name: 'User A' } }],
      startDatetime: new Date('2026-06-01T08:00:00Z'),
      endDatetime: new Date('2026-06-01T16:00:00Z'),
      scheduleType: { value: 'otro' },
    } as any);

    const result = await createScheduleEntry({
      title: 'Tarea Excepcional',
      startDatetime: new Date('2026-06-01T08:00:00Z'),
      endDatetime: new Date('2026-06-01T16:00:00Z'),
      branchId: 'b-1',
      assigneeIds: ['u-1'],
      scheduleTypeId: 'st-otro',
      color: '#1e3a5f',
      hoursPerDay: 8,
      confirmed: false,
    }, mockActor);

    expect(result).toBeDefined();
    expect(mockRepo.createSchedule).toHaveBeenCalled();
  });
});
