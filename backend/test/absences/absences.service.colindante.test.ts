/**
 * @file absences.service.colindante.test.ts
 * Tests del flujo "colindante" en ausencias: cuando una solicitud se solapa
 * con compañeros del mismo departamento, se asigna estado 'colindante'.
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

jest.mock('../../src/modules/schedules/weekly-summary.service', () => ({
  recalculateWeeklySummariesForAbsence: jest.fn().mockResolvedValue(undefined),
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

describe('absences.service — flujo colindante', () => {
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

  it('asigna estado colindante cuando hay solapamiento con compañeros del mismo departamento', async () => {
    const overlappingEmployees = [
      { employee: { id: 'emp-2', name: 'Compañero', email: 'comp@test.com' } },
      { employee: { id: 'emp-3', name: 'Otro Compañero', email: 'otro@test.com' } },
    ];
    mockedFindDepartmentOverlap.mockResolvedValue(overlappingEmployees as any);

    mockedCreateAbsenceRequest.mockResolvedValue({
      id: 'abs-col',
      employeeId: 'emp-1',
      startDate: new Date('2026-08-04T00:00:00.000Z'),
      endDate: new Date('2026-08-06T00:00:00.000Z'),
      note: 'Vacaciones',
      status: 'colindante',
      branch: { timezone: 'Europe/Madrid' },
      employee: { name: 'Empleado Uno' },
    } as any);

    const result = await createAbsenceEntry(
      {
        startDate: new Date('2026-08-04T00:00:00.000Z'),
        endDate: new Date('2026-08-06T00:00:00.000Z'),
        type: 'vacaciones',
        note: 'Vacaciones',
      },
      actor,
    );

    expect(mockedFindDepartmentOverlap).toHaveBeenCalledWith(
      'dept-1',
      'emp-1',
      expect.any(Date),
      expect.any(Date),
    );
    expect(mockedCreateAbsenceRequest).toHaveBeenCalledWith(
      expect.objectContaining({ status: 'colindante' }),
      expect.anything(),
    );
    expect(result.hasOverlap).toBe(true);
    expect(result.overlappingEmployees).toHaveLength(2);
    expect(result.overlappingEmployees[0]).toMatchObject({ id: 'emp-2', name: 'Compañero' });
    expect(result.overlappingEmployees[1]).toMatchObject({ id: 'emp-3', name: 'Otro Compañero' });
  });

  it('asigna estado pending cuando NO hay solapamiento con compañeros', async () => {
    mockedFindDepartmentOverlap.mockResolvedValue([] as any);

    const result = await createAbsenceEntry(
      {
        startDate: new Date('2026-08-10T00:00:00.000Z'),
        endDate: new Date('2026-08-12T00:00:00.000Z'),
        type: 'vacaciones',
        note: 'Sin solapamiento',
      },
      actor,
    );

    expect(mockedCreateAbsenceRequest).toHaveBeenCalledWith(
      expect.objectContaining({ status: 'pending' }),
      expect.anything(),
    );
    expect(result.hasOverlap).toBe(false);
    expect(result.overlappingEmployees).toHaveLength(0);
  });

  it('detecta solapamiento solo con compañeros del mismo departamento (no de otros)', async () => {
    // Simular que solo emp-2 (mismo depto) tiene solapamiento
    const overlappingEmployees = [
      { employee: { id: 'emp-2', name: 'Compañero Depto', email: 'comp@test.com' } },
    ];
    mockedFindDepartmentOverlap.mockResolvedValue(overlappingEmployees as any);

    mockedCreateAbsenceRequest.mockResolvedValue({
      id: 'abs-col-2',
      employeeId: 'emp-1',
      startDate: new Date('2026-08-04T00:00:00.000Z'),
      endDate: new Date('2026-08-06T00:00:00.000Z'),
      note: 'Vacaciones',
      status: 'colindante',
      branch: { timezone: 'Europe/Madrid' },
      employee: { name: 'Empleado Uno' },
    } as any);

    const result = await createAbsenceEntry(
      {
        startDate: new Date('2026-08-04T00:00:00.000Z'),
        endDate: new Date('2026-08-06T00:00:00.000Z'),
        type: 'vacaciones',
      },
      actor,
    );

    expect(result.hasOverlap).toBe(true);
    expect(result.overlappingEmployees).toHaveLength(1);
    expect(result.overlappingEmployees[0].id).toBe('emp-2');
    // Verificar que findDepartmentOverlap se llamó con el departmentId del target
    expect(mockedFindDepartmentOverlap).toHaveBeenCalledWith(
      'dept-1', // departmentId del empleado target
      'emp-1',  // employeeId del empleado target (excluido)
      expect.any(Date),
      expect.any(Date),
    );
  });

  it('incluye información de solapamiento en el log de auditoría', async () => {
    const overlappingEmployees = [
      { employee: { id: 'emp-2', name: 'Compañero', email: 'comp@test.com' } },
    ];
    mockedFindDepartmentOverlap.mockResolvedValue(overlappingEmployees as any);

    const logAuditOrThrow = jest.requireMock('../../src/modules/audit/audit.service')
      .logAuditOrThrow as jest.Mock;

    mockedCreateAbsenceRequest.mockResolvedValue({
      id: 'abs-audit',
      employeeId: 'emp-1',
      startDate: new Date('2026-08-04T00:00:00.000Z'),
      endDate: new Date('2026-08-06T00:00:00.000Z'),
      note: 'Vacaciones',
      status: 'colindante',
      branch: { timezone: 'Europe/Madrid' },
      employee: { name: 'Empleado Uno' },
    } as any);

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

    expect(logAuditOrThrow).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'CREATE_ABSENCE_REQUEST',
        detailsJson: expect.objectContaining({
          after: expect.objectContaining({
            overlappingEmployees: expect.arrayContaining([
              expect.objectContaining({ id: 'emp-2', name: 'Compañero' }),
            ]),
          }),
        }),
      }),
      expect.anything(),
    );
  });

  it('no marca colindante si el solapamiento es consigo mismo (mismo employeeId)', async () => {
    // findDepartmentOverlap ya excluye al propio employeeId en la query
    mockedFindDepartmentOverlap.mockResolvedValue([] as any);

    const result = await createAbsenceEntry(
      {
        startDate: new Date('2026-08-04T00:00:00.000Z'),
        endDate: new Date('2026-08-06T00:00:00.000Z'),
        type: 'vacaciones',
      },
      actor,
    );

    expect(result.hasOverlap).toBe(false);
    expect(mockedFindDepartmentOverlap).toHaveBeenCalledWith(
      'dept-1',
      'emp-1', // Se excluye a sí mismo
      expect.any(Date),
      expect.any(Date),
    );
  });

  it('considera solapamiento con ausencias en estado approved, pending y colindante', async () => {
    const overlappingEmployees = [
      { employee: { id: 'emp-4', name: 'Con Aprobada', email: 'aprob@test.com' } },
    ];
    mockedFindDepartmentOverlap.mockResolvedValue(overlappingEmployees as any);

    mockedCreateAbsenceRequest.mockResolvedValue({
      id: 'abs-col-3',
      employeeId: 'emp-1',
      startDate: new Date('2026-08-04T00:00:00.000Z'),
      endDate: new Date('2026-08-06T00:00:00.000Z'),
      note: 'Vacaciones',
      status: 'colindante',
      branch: { timezone: 'Europe/Madrid' },
      employee: { name: 'Empleado Uno' },
    } as any);

    const result = await createAbsenceEntry(
      {
        startDate: new Date('2026-08-04T00:00:00.000Z'),
        endDate: new Date('2026-08-06T00:00:00.000Z'),
        type: 'vacaciones',
      },
      actor,
    );

    expect(result.hasOverlap).toBe(true);
    // findDepartmentOverlap internamente busca status in ['approved', 'pending', 'colindante']
    expect(mockedFindDepartmentOverlap).toHaveBeenCalled();
  });
});
