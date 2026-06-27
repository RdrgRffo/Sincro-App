import { createAppError } from '../../src/common/errors/error-catalog';

jest.mock('../../src/modules/absences/absences.repository', () => ({
  findAbsenceRequestById: jest.fn(),
  updateAbsenceRequest: jest.fn(),
}));

jest.mock('../../src/modules/absences/domain/absences.rules', () => ({
  ensureCanCancel: jest.fn(),
  ensureCanReview: jest.fn(),
}));

jest.mock('../../src/common/transactions/transaction.utils', () => ({
  executeInTransaction: jest.fn(async (fn: any) => fn({})),
}));

jest.mock('../../src/modules/audit/audit.service', () => ({
  logAuditOrThrow: jest.fn(),
  sanitizeSnapshot: (value: unknown) => value,
}));

jest.mock('../../src/modules/notifications/notifications.service', () => ({
  notifyAbsenceChange: jest.fn(() => Promise.resolve()),
}));

jest.mock('../../src/modules/in-app-notifications/in-app.service', () => ({
  createInAppNotification: jest.fn(() => Promise.resolve()),
}));

jest.mock('../../src/modules/schedules/weekly-summary.service', () => ({
  recalculateWeeklySummariesForAbsence: jest.fn(() => Promise.resolve()),
}));

import { cancelAbsenceEntry } from '../../src/modules/absences/absences.service';
import { findAbsenceRequestById, updateAbsenceRequest } from '../../src/modules/absences/absences.repository';
import { ensureCanCancel, ensureCanReview } from '../../src/modules/absences/domain/absences.rules';

const mockedFindAbsenceRequestById = findAbsenceRequestById as jest.MockedFunction<typeof findAbsenceRequestById>;
const mockedUpdateAbsenceRequest = updateAbsenceRequest as jest.MockedFunction<typeof updateAbsenceRequest>;
const mockedEnsureCanCancel = ensureCanCancel as jest.MockedFunction<typeof ensureCanCancel>;
const mockedEnsureCanReview = ensureCanReview as jest.MockedFunction<typeof ensureCanReview>;

describe('absences.service cancelAbsenceEntry', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('permite a employee cancelar su propia solicitud pendiente', async () => {
    mockedFindAbsenceRequestById.mockResolvedValue({
      id: 'abs-1',
      employeeId: 'emp-1',
      status: 'pending',
      branchId: 'b-1',
      departmentId: 'dept-1',
      startDate: new Date('2026-07-01T00:00:00.000Z'),
      endDate: new Date('2026-07-03T00:00:00.000Z'),
      branch: { timezone: 'Europe/Madrid' },
    } as any);
    mockedUpdateAbsenceRequest.mockResolvedValue({
      id: 'abs-1',
      status: 'cancelled',
      employeeId: 'emp-1',
    } as any);

    const result = await cancelAbsenceEntry('abs-1', {
      id: 'emp-1',
      roleName: 'employee',
      email: 'emp@example.com',
      name: 'Employee',
      permissions: ['absences:cancel'],
    });

    expect(mockedEnsureCanCancel).toHaveBeenCalledWith('pending');
    expect(mockedEnsureCanReview).not.toHaveBeenCalled();
    expect(mockedUpdateAbsenceRequest).toHaveBeenCalledWith(
      'abs-1',
      { status: 'cancelled' },
      expect.anything(),
    );
    expect(result).toMatchObject({ id: 'abs-1', status: 'cancelled' });
  });

  it('permite a employee cancelar su propia solicitud colindante', async () => {
    mockedFindAbsenceRequestById.mockResolvedValue({
      id: 'abs-3',
      employeeId: 'emp-1',
      status: 'colindante',
      branchId: 'b-1',
      departmentId: 'dept-1',
      startDate: new Date('2026-07-01T00:00:00.000Z'),
      endDate: new Date('2026-07-03T00:00:00.000Z'),
      branch: { timezone: 'Europe/Madrid' },
    } as any);
    mockedUpdateAbsenceRequest.mockResolvedValue({
      id: 'abs-3',
      status: 'cancelled',
      employeeId: 'emp-1',
    } as any);

    const result = await cancelAbsenceEntry('abs-3', {
      id: 'emp-1',
      roleName: 'employee',
      email: 'emp@example.com',
      name: 'Employee',
      permissions: ['absences:cancel'],
    });

    expect(mockedEnsureCanCancel).toHaveBeenCalledWith('colindante');
    expect(result).toMatchObject({ id: 'abs-3', status: 'cancelled' });
  });

  it('rechaza cancelación de employee sobre solicitud de otra persona', async () => {
    mockedFindAbsenceRequestById.mockResolvedValue({
      id: 'abs-2',
      employeeId: 'emp-2',
      status: 'pending',
      branchId: 'b-1',
      departmentId: 'dept-1',
      startDate: new Date('2026-07-01T00:00:00.000Z'),
      endDate: new Date('2026-07-03T00:00:00.000Z'),
      branch: { timezone: 'Europe/Madrid' },
    } as any);

    await expect(
      cancelAbsenceEntry('abs-2', {
        id: 'emp-1',
        roleName: 'employee',
        email: 'emp@example.com',
        name: 'Employee',
        permissions: ['absences:cancel'],
      }),
    ).rejects.toMatchObject(createAppError('FORBIDDEN', 'Solo puedes cancelar tus propias solicitudes'));

    expect(mockedUpdateAbsenceRequest).not.toHaveBeenCalled();
  });
});
