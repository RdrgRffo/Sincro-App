/**
 * @file absences.service.create-in-app.test.ts
 * Verifica notificaciones in-app al crear una solicitud de ausencia (empleado + revisores).
 */

jest.mock('../../src/modules/absences/absences.repository', () => ({
  countPendingOverlap: jest.fn(),
  findDepartmentOverlap: jest.fn(),
  createAbsenceRequest: jest.fn(),
  findAbsenceReviewerUserIds: jest.fn(),
}));

jest.mock('../../src/common/transactions/transaction.utils', () => ({
  executeInTransaction: jest.fn(async (fn: (tx: unknown) => Promise<unknown>) => fn({})),
}));

jest.mock('../../src/modules/audit/audit.service', () => ({
  logAuditOrThrow: jest.fn().mockResolvedValue(undefined),
  sanitizeSnapshot: (v: unknown) => v,
}));

jest.mock('../../src/modules/notifications/notifications.service', () => ({
  notifyAbsenceChange: jest.fn().mockResolvedValue(undefined),
}));

jest.mock('../../src/modules/in-app-notifications/in-app.service', () => ({
  createInAppNotification: jest.fn().mockResolvedValue(undefined),
  createInAppNotificationBatch: jest.fn().mockResolvedValue(undefined),
}));

import { prismaMock } from '../config/singleton';
import { createAbsenceEntry } from '../../src/modules/absences/absences.service';
import {
  countPendingOverlap,
  findDepartmentOverlap,
  createAbsenceRequest,
  findAbsenceReviewerUserIds,
} from '../../src/modules/absences/absences.repository';

const mockedCountPendingOverlap = countPendingOverlap as jest.MockedFunction<typeof countPendingOverlap>;
const mockedFindDepartmentOverlap = findDepartmentOverlap as jest.MockedFunction<typeof findDepartmentOverlap>;
const mockedCreateAbsenceRequest = createAbsenceRequest as jest.MockedFunction<typeof createAbsenceRequest>;
const mockedFindAbsenceReviewerUserIds = findAbsenceReviewerUserIds as jest.MockedFunction<
  typeof findAbsenceReviewerUserIds
>;

function flushAsync(): Promise<void> {
  return new Promise((resolve) => setImmediate(resolve));
}

describe('absences.service createAbsenceEntry in-app', () => {
  const actor = {
    id: 'emp-1',
    roleName: 'employee' as const,
    email: 'emp@test.com',
    name: 'Empleado Uno',
    branchId: 'branch-1',
    departmentId: 'dept-1',
    ipAddress: '127.0.0.1',
    permissions: [] as string[],
  };

  beforeEach(() => {
    jest.clearAllMocks();
    prismaMock.user.findUnique.mockResolvedValue({
      id: 'emp-1',
      branchId: 'branch-1',
      departmentId: 'dept-1',
      status: 'active',
      name: 'Empleado Uno',
      email: 'emp@test.com',
    } as any);
    mockedCountPendingOverlap.mockResolvedValue(0);
    mockedFindDepartmentOverlap.mockResolvedValue([] as any);
    mockedFindAbsenceReviewerUserIds.mockResolvedValue(['dm-1', 'gm-1']);
    prismaMock.userNotificationPreference.findMany.mockResolvedValue([
      { userId: 'dm-1', departmentAbsenceRequests: true, criticalAlertsOnly: false },
      { userId: 'gm-1', departmentAbsenceRequests: true, criticalAlertsOnly: false },
    ] as any);
    mockedCreateAbsenceRequest.mockResolvedValue({
      id: 'abs-new',
      employeeId: 'emp-1',
      startDate: new Date('2026-08-04T00:00:00.000Z'),
      endDate: new Date('2026-08-06T00:00:00.000Z'),
      note: 'Vacaciones',
      status: 'pending',
      branch: { timezone: 'Europe/Madrid' },
      employee: { name: 'Empleado Uno' },
    } as any);
  });

  it('notifica al empleado (absence_request_sent) y en batch a revisores (absence_requested)', async () => {
    const createInAppNotification = jest.requireMock('../../src/modules/in-app-notifications/in-app.service')
      .createInAppNotification as jest.Mock;
    const createInAppNotificationBatch = jest.requireMock('../../src/modules/in-app-notifications/in-app.service')
      .createInAppNotificationBatch as jest.Mock;

    await createAbsenceEntry(
      {
        startDate: new Date('2026-08-04T00:00:00.000Z'),
        endDate: new Date('2026-08-06T00:00:00.000Z'),
        type: 'vacaciones',
        note: 'Vacaciones',
      },
      actor,
    );

    await flushAsync();

    expect(createInAppNotification).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: 'emp-1',
        type: 'absence_request_sent',
        link: '/ausencias',
      }),
    );

    expect(mockedFindAbsenceReviewerUserIds).toHaveBeenCalledWith('branch-1', 'dept-1', 'emp-1');
    expect(createInAppNotificationBatch).toHaveBeenCalledWith(
      expect.arrayContaining([
        expect.objectContaining({ userId: 'dm-1', type: 'absence_requested' }),
        expect.objectContaining({ userId: 'gm-1', type: 'absence_requested' }),
      ]),
    );
    expect(createInAppNotificationBatch.mock.calls[0][0]).toHaveLength(2);
  });

  it('al crear para otro empleado notifica al target y localiza revisores por sucursal/departamento del target', async () => {
    const createInAppNotification = jest.requireMock('../../src/modules/in-app-notifications/in-app.service')
      .createInAppNotification as jest.Mock;
    const createInAppNotificationBatch = jest.requireMock('../../src/modules/in-app-notifications/in-app.service')
      .createInAppNotificationBatch as jest.Mock;

    const adminActor = {
      id: 'admin-1',
      roleName: 'admin' as const,
      email: 'admin@test.com',
      name: 'Admin',
      branchId: 'branch-1',
      departmentId: 'dept-1',
      ipAddress: '127.0.0.1',
      permissions: [] as string[],
    };

    prismaMock.user.findUnique.mockResolvedValue({
      id: 'emp-2',
      branchId: 'branch-2',
      departmentId: 'dept-2',
      status: 'active',
      name: 'Empleado Dos',
      email: 'dos@test.com',
    } as any);

    mockedCreateAbsenceRequest.mockResolvedValue({
      id: 'abs-proxy',
      employeeId: 'emp-2',
      startDate: new Date('2026-08-04T00:00:00.000Z'),
      endDate: new Date('2026-08-06T00:00:00.000Z'),
      note: 'Vacaciones',
      status: 'pending',
      branch: { timezone: 'Europe/Madrid' },
      employee: { name: 'Empleado Dos' },
    } as any);

    await createAbsenceEntry(
      {
        startDate: new Date('2026-08-04T00:00:00.000Z'),
        endDate: new Date('2026-08-06T00:00:00.000Z'),
        type: 'vacaciones',
        note: 'Vacaciones',
        employeeId: 'emp-2',
      },
      adminActor,
    );

    await flushAsync();

    expect(createInAppNotification).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: 'emp-2',
        type: 'absence_request_sent',
        message: expect.stringContaining('Admin ha registrado una solicitud de ausencia en tu nombre'),
      }),
    );

    expect(mockedFindAbsenceReviewerUserIds).toHaveBeenCalledWith('branch-2', 'dept-2', 'emp-2');
    expect(createInAppNotificationBatch).toHaveBeenCalled();
  });

  it('no llama batch si ningún revisor pasa el filtro de preferencias', async () => {
    const createInAppNotificationBatch = jest.requireMock('../../src/modules/in-app-notifications/in-app.service')
      .createInAppNotificationBatch as jest.Mock;

    prismaMock.userNotificationPreference.findMany.mockResolvedValue([
      { userId: 'dm-1', departmentAbsenceRequests: false, criticalAlertsOnly: false },
      { userId: 'gm-1', departmentAbsenceRequests: true, criticalAlertsOnly: true },
    ] as any);

    await createAbsenceEntry(
      {
        startDate: new Date('2026-08-04T00:00:00.000Z'),
        endDate: new Date('2026-08-06T00:00:00.000Z'),
        type: 'vacaciones',
      },
      actor,
    );

    await flushAsync();

    expect(createInAppNotificationBatch).not.toHaveBeenCalled();
  });
});
