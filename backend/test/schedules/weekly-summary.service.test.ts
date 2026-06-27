jest.mock('../../src/modules/schedules/schedules.repository');

import { prismaMock } from '../config/singleton';
import * as schedulesRepository from '../../src/modules/schedules/schedules.repository';
import { recalculateWeeklySummary } from '../../src/modules/schedules/weekly-summary.service';

const mockSchedulesRepository = schedulesRepository as jest.Mocked<typeof schedulesRepository>;

function buildSchedule(date: string) {
  return {
    startDatetime: new Date(`${date}T08:00:00.000Z`),
    endDatetime: new Date(`${date}T16:00:00.000Z`),
    hoursPerDay: 8,
  };
}

describe('weekly-summary.service', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockSchedulesRepository.findSchedules.mockResolvedValue([
      buildSchedule('2026-06-01'),
      buildSchedule('2026-06-02'),
      buildSchedule('2026-06-03'),
      buildSchedule('2026-06-04'),
    ] as any);
    prismaMock.absence.findMany.mockResolvedValue([]);
    prismaMock.weeklyWorkSummary.upsert.mockResolvedValue({ id: 'summary-1' } as any);
  });

  it('reduces weekly base hours for approved absence days', async () => {
    prismaMock.absence.findMany.mockResolvedValue([
      {
        startDate: new Date('2026-06-03T00:00:00.000Z'),
        endDate: new Date('2026-06-04T00:00:00.000Z'),
      },
    ] as any);

    await recalculateWeeklySummary('user-1', 2026, 23);

    expect(prismaMock.absence.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          employeeId: 'user-1',
          status: 'approved',
        }),
      }),
    );
    expect(prismaMock.weeklyWorkSummary.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        create: expect.objectContaining({
          totalHours: 32,
          baseHours: 24,
          overtimeHours: 8,
        }),
        update: expect.objectContaining({
          totalHours: 32,
          baseHours: 24,
          overtimeHours: 8,
        }),
      }),
    );
  });

  it('keeps the default base hours when there are no approved absences', async () => {
    await recalculateWeeklySummary('user-1', 2026, 23);

    expect(prismaMock.weeklyWorkSummary.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        create: expect.objectContaining({
          totalHours: 32,
          baseHours: 40,
          overtimeHours: 0,
        }),
        update: expect.objectContaining({
          totalHours: 32,
          baseHours: 40,
          overtimeHours: 0,
        }),
      }),
    );
  });
});
