/**
 * @file schedules.http.schemas.test.ts
 * Tests de validación Zod para los schemas HTTP de schedules.
 */

import {
  scheduleIdParamsSchema,
  weekParamsSchema,
  listSchedulesQuerySchema,
  listWeekSchedulesQuerySchema,
  createScheduleBodySchema,
  createScheduleBulkBodySchema,
  updateScheduleBodySchema,
  deleteScheduleBodySchema,
  weeklySummaryParamsSchema,
  weeklySummaryQuerySchema,
  teamWeeklySummaryParamsSchema,
  teamWeeklySummaryQuerySchema,
} from '../../src/modules/schedules/schedules.http.schemas';

describe('schedules.http.schemas', () => {
  describe('scheduleIdParamsSchema', () => {
    it('accepts valid id', () => {
      const result = scheduleIdParamsSchema.safeParse({ id: 'sch-123' });
      expect(result.success).toBe(true);
    });

    it('rejects empty id', () => {
      const result = scheduleIdParamsSchema.safeParse({ id: '' });
      expect(result.success).toBe(false);
    });
  });

  describe('weekParamsSchema', () => {
    it('accepts valid year and week', () => {
      const result = weekParamsSchema.safeParse({ year: '2026', week: '27' });
      expect(result.success).toBe(true);
    });

    it('rejects year out of range', () => {
      const result = weekParamsSchema.safeParse({ year: '1999', week: '1' });
      expect(result.success).toBe(false);
    });

    it('rejects week out of range', () => {
      const result = weekParamsSchema.safeParse({ year: '2026', week: '0' });
      expect(result.success).toBe(false);
    });
  });

  describe('createScheduleBodySchema', () => {
    const validSchedule = {
      title: 'Morning Shift',
      startDatetime: '2026-07-01T08:00:00Z',
      endDatetime: '2026-07-01T16:00:00Z',
      scheduleTypeId: 'type-1',
      branchId: 'b-1',
      assigneeIds: ['user-1'],
    };

    it('accepts valid schedule', () => {
      const result = createScheduleBodySchema.safeParse(validSchedule);
      expect(result.success).toBe(true);
    });

    it('rejects missing title', () => {
      const result = createScheduleBodySchema.safeParse({ ...validSchedule, title: 'A' });
      expect(result.success).toBe(false);
    });

    it('rejects missing assigneeIds', () => {
      const result = createScheduleBodySchema.safeParse({ ...validSchedule, assigneeIds: [] });
      expect(result.success).toBe(false);
    });

    it('rejects missing branchId', () => {
      const { branchId, ...noBranch } = validSchedule;
      const result = createScheduleBodySchema.safeParse(noBranch);
      expect(result.success).toBe(false);
    });

    it('accepts schedule with nested objects (preprocess)', () => {
      const result = createScheduleBodySchema.safeParse({
        ...validSchedule,
        scheduleTypeId: undefined,
        scheduleType: { id: 'type-1' },
        branchId: undefined,
        branch: { id: 'b-1' },
      });
      expect(result.success).toBe(true);
    });
  });

  describe('createScheduleBulkBodySchema', () => {
    it('accepts valid bulk', () => {
      const result = createScheduleBulkBodySchema.safeParse({
        items: [{
          title: 'Shift 1',
          startDatetime: '2026-07-01T08:00:00Z',
          endDatetime: '2026-07-01T16:00:00Z',
          scheduleTypeId: 'type-1',
          branchId: 'b-1',
          assigneeIds: ['user-1'],
        }],
      });
      expect(result.success).toBe(true);
    });

    it('rejects empty items', () => {
      const result = createScheduleBulkBodySchema.safeParse({ items: [] });
      expect(result.success).toBe(false);
    });
  });

  describe('updateScheduleBodySchema', () => {
    it('accepts partial update', () => {
      const result = updateScheduleBodySchema.safeParse({ title: 'Updated Shift' });
      expect(result.success).toBe(true);
    });

    it('accepts empty object (partial)', () => {
      const result = updateScheduleBodySchema.safeParse({});
      expect(result.success).toBe(true);
    });
  });

  describe('deleteScheduleBodySchema', () => {
    it('accepts with reason', () => {
      const result = deleteScheduleBodySchema.safeParse({ reason: 'Cancelled' });
      expect(result.success).toBe(true);
    });

    it('accepts without reason', () => {
      const result = deleteScheduleBodySchema.safeParse({});
      expect(result.success).toBe(true);
    });
  });

  describe('weeklySummaryParamsSchema', () => {
    it('accepts valid params', () => {
      const result = weeklySummaryParamsSchema.safeParse({ userId: 'u-1', year: '2026', week: '27' });
      expect(result.success).toBe(true);
    });
  });

  describe('teamWeeklySummaryParamsSchema', () => {
    it('accepts valid params', () => {
      const result = teamWeeklySummaryParamsSchema.safeParse({ year: '2026', week: '27' });
      expect(result.success).toBe(true);
    });
  });
});
