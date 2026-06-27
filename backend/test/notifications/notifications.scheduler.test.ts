/**
 * @file notifications.scheduler.test.ts
 * Tests de los schedulers de notificaciones: Friday reminder y Monday absence summary.
 * Verifica que las funciones sendFridaySummary y sendMondayAbsenceSummary
 * consulten correctamente los datos y envíen a los webhooks apropiados.
 */

// ── Mocks antes de imports ──────────────────────────────────────────────────
jest.mock('../../src/config/database', () => ({
  __esModule: true,
  prisma: {
    schedule: { findMany: jest.fn() },
    absence: { findMany: jest.fn() },
    webhookConfig: { findMany: jest.fn() },
    notificationLog: { create: jest.fn() },
  },
}));

jest.mock('../../src/modules/notifications/notifications.templates', () => ({
  buildFridaySummaryCard: jest.fn().mockReturnValue({ text: 'Friday summary card' }),
  buildMondayAbsenceCard: jest.fn().mockReturnValue({ text: 'Monday absence card' }),
}));

jest.mock('../../src/modules/notifications/notifications.service', () => ({
  sendToWebhook: jest.fn().mockResolvedValue({ id: 'log-1', status: 'sent' }),
}));

jest.mock('../../src/utils/logger', () => ({
  logger: {
    info: jest.fn(),
    error: jest.fn(),
    warn: jest.fn(),
    debug: jest.fn(),
  },
}));

import { sendFridaySummary, sendMondayAbsenceSummary } from '../../src/modules/notifications/notifications.scheduler';
import { buildFridaySummaryCard, buildMondayAbsenceCard } from '../../src/modules/notifications/notifications.templates';
import { sendToWebhook } from '../../src/modules/notifications/notifications.service';

const prisma = jest.requireMock('../../src/config/database').prisma;
const mockedSendToWebhook = sendToWebhook as jest.MockedFunction<typeof sendToWebhook>;
const mockedBuildFridaySummaryCard = buildFridaySummaryCard as jest.MockedFunction<typeof buildFridaySummaryCard>;
const mockedBuildMondayAbsenceCard = buildMondayAbsenceCard as jest.MockedFunction<typeof buildMondayAbsenceCard>;

describe('notifications.scheduler — sendFridaySummary', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('envía resumen semanal a webhooks con fridayReminderEnabled', async () => {
    const mockSchedules = [
      {
        id: 'sched-1',
        title: 'Turno Mañana',
        startDatetime: new Date('2026-06-01T08:00:00.000Z'),
        endDatetime: new Date('2026-06-01T14:00:00.000Z'),
        location: 'Sala A',
        assignments: [{ user: { name: 'Juan' } }, { user: { name: 'María' } }],
      },
    ];
    prisma.schedule.findMany.mockResolvedValue(mockSchedules);

    const mockWebhooks = [
      { id: 'wh-1', webhookUrl: 'https://hooks.example.com/1', fridayReminderEnabled: true, enabled: true },
      { id: 'wh-2', webhookUrl: 'https://hooks.example.com/2', fridayReminderEnabled: true, enabled: true },
    ];
    prisma.webhookConfig.findMany.mockResolvedValue(mockWebhooks);
    prisma.notificationLog.create.mockResolvedValue({ id: 'log-1' });

    const results = await sendFridaySummary();

    expect(prisma.schedule.findMany).toHaveBeenCalledTimes(1);
    expect(prisma.webhookConfig.findMany).toHaveBeenCalledWith({
      where: { enabled: true, fridayReminderEnabled: true },
    });
    expect(mockedBuildFridaySummaryCard).toHaveBeenCalledTimes(1);
    expect(mockedSendToWebhook).toHaveBeenCalledTimes(2);
    expect(mockedSendToWebhook).toHaveBeenCalledWith(
      expect.objectContaining({
        webhookConfigId: 'wh-1',
        webhookUrl: 'https://hooks.example.com/1',
        type: 'friday_reminder',
      }),
    );
    expect(mockedSendToWebhook).toHaveBeenCalledWith(
      expect.objectContaining({
        webhookConfigId: 'wh-2',
        webhookUrl: 'https://hooks.example.com/2',
        type: 'friday_reminder',
      }),
    );
    expect(results).toHaveLength(2);
  });

  it('filtra por webhookConfigIds específicos cuando se proporcionan', async () => {
    prisma.schedule.findMany.mockResolvedValue([]);
    prisma.webhookConfig.findMany.mockResolvedValue([
      { id: 'wh-1', webhookUrl: 'https://hooks.example.com/1', enabled: true },
    ]);
    prisma.notificationLog.create.mockResolvedValue({ id: 'log-1' });

    await sendFridaySummary(undefined, ['wh-1']);

    expect(prisma.webhookConfig.findMany).toHaveBeenCalledWith({
      where: { id: { in: ['wh-1'] }, enabled: true },
    });
  });

  it('no envía nada si no hay webhooks habilitados', async () => {
    prisma.schedule.findMany.mockResolvedValue([]);
    prisma.webhookConfig.findMany.mockResolvedValue([]);

    const results = await sendFridaySummary();

    expect(results).toHaveLength(0);
    expect(mockedSendToWebhook).not.toHaveBeenCalled();
  });

  it('incluye schedules de la semana siguiente correctamente', async () => {
    prisma.schedule.findMany.mockResolvedValue([]);
    prisma.webhookConfig.findMany.mockResolvedValue([]);

    await sendFridaySummary();

    // Verificar que findMany busca schedules de la próxima semana
    const findManyCall = prisma.schedule.findMany.mock.calls[0][0];
    expect(findManyCall.where.startDatetime).toHaveProperty('gte');
    expect(findManyCall.where.endDatetime).toHaveProperty('lte');
    expect(findManyCall.orderBy).toEqual({ startDatetime: 'asc' });
  });
});

describe('notifications.scheduler — sendMondayAbsenceSummary', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('envía resumen de ausencias a webhooks con mondayAbsenceReminderEnabled', async () => {
    const mockAbsences = [
      {
        id: 'abs-1',
        employee: { name: 'Carlos' },
        startDate: new Date('2026-06-01'),
        endDate: new Date('2026-06-03'),
        status: 'approved',
      },
      {
        id: 'abs-2',
        employee: { name: 'Ana' },
        startDate: new Date('2026-06-02'),
        endDate: new Date('2026-06-05'),
        status: 'approved',
      },
    ];
    prisma.absence.findMany.mockResolvedValue(mockAbsences);

    const mockWebhooks = [
      { id: 'wh-1', webhookUrl: 'https://hooks.example.com/1', mondayAbsenceReminderEnabled: true, enabled: true },
    ];
    prisma.webhookConfig.findMany.mockResolvedValue(mockWebhooks);
    prisma.notificationLog.create.mockResolvedValue({ id: 'log-1' });

    const results = await sendMondayAbsenceSummary();

    expect(prisma.absence.findMany).toHaveBeenCalledTimes(1);
    expect(prisma.webhookConfig.findMany).toHaveBeenCalledWith({
      where: { enabled: true, mondayAbsenceReminderEnabled: true },
    });
    expect(mockedBuildMondayAbsenceCard).toHaveBeenCalledTimes(1);
    expect(mockedSendToWebhook).toHaveBeenCalledTimes(1);
    expect(mockedSendToWebhook).toHaveBeenCalledWith(
      expect.objectContaining({
        webhookConfigId: 'wh-1',
        type: 'monday_absence_summary',
      }),
    );
    expect(results).toHaveLength(1);
  });

  it('filtra ausencias aprobadas que solapan con la semana actual', async () => {
    prisma.absence.findMany.mockResolvedValue([]);
    prisma.webhookConfig.findMany.mockResolvedValue([]);

    await sendMondayAbsenceSummary();

    const findManyCall = prisma.absence.findMany.mock.calls[0][0];
    expect(findManyCall.where.status).toBe('approved');
    expect(findManyCall.where.AND).toBeDefined();
    expect(findManyCall.where.AND[0]).toHaveProperty('startDate.lte');
    expect(findManyCall.where.AND[1]).toHaveProperty('endDate.gte');
    expect(findManyCall.orderBy).toEqual({ startDate: 'asc' });
  });

  it('filtra por webhookConfigIds específicos cuando se proporcionan', async () => {
    prisma.absence.findMany.mockResolvedValue([]);
    prisma.webhookConfig.findMany.mockResolvedValue([
      { id: 'wh-1', webhookUrl: 'https://hooks.example.com/1', enabled: true },
    ]);
    prisma.notificationLog.create.mockResolvedValue({ id: 'log-1' });

    await sendMondayAbsenceSummary(undefined, ['wh-1']);

    expect(prisma.webhookConfig.findMany).toHaveBeenCalledWith({
      where: { id: { in: ['wh-1'] }, enabled: true },
    });
  });

  it('no envía nada si no hay ausencias aprobadas en la semana', async () => {
    prisma.absence.findMany.mockResolvedValue([]);
    prisma.webhookConfig.findMany.mockResolvedValue([
      { id: 'wh-1', webhookUrl: 'https://hooks.example.com/1', mondayAbsenceReminderEnabled: true, enabled: true },
    ]);
    prisma.notificationLog.create.mockResolvedValue({ id: 'log-1' });

    const results = await sendMondayAbsenceSummary();

    expect(results).toHaveLength(1);
    expect(mockedBuildMondayAbsenceCard).toHaveBeenCalledWith(
      expect.objectContaining({ absences: [] }),
    );
  });
});
